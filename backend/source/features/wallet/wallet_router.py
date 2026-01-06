from typing import List, Dict, Optional
import pandas as pd
from datetime import datetime, date

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import func, text, bindparam, tuple_ # <--- ADICIONAR tuple_ AQUI

from backend.source.core.database import get_db
from backend.source.features.auth.jwt_identity_extraction import get_current_user
from backend.source.models.sql_models import AssetPurchase, CdiHistory, B3Price
from backend.source.features.wallet.wallet_schema import (
    ImportPurchasesRequest,
    AssetPurchaseResponse,
    AssetPurchaseInput,
    HistoryPoint
)

wallet_bp = APIRouter(prefix="/wallet", tags=["Wallet"])

# ==========================================
#  LÓGICA INTERNA (SERVICE) - AUXILIARES
# ==========================================

def _calculate_period_stats(profit: float, yield_pct: float, start_date: Optional[date]) -> Dict:
    if not start_date:
        return {
            "total": {"profit": profit, "yield": yield_pct},
            "day": {"profit": 0, "yield": 0},
            "month": {"profit": 0, "yield": 0},
            "year": {"profit": 0, "yield": 0}
        }

    today = datetime.now().date()
    if isinstance(start_date, datetime):
        start_date = start_date.date()

    diff_days = (today - start_date).days
    days = max(1, diff_days)

    avg_day_profit = profit / days
    avg_day_yield = yield_pct / days

    return {
        "total": {
            "profit": round(profit, 2),
            "yield": round(yield_pct, 2)
        },
        "day": {
            "profit": round(avg_day_profit, 2),
            "yield": round(avg_day_yield, 4)
        },
        "month": {
            "profit": round(avg_day_profit * 30, 2),
            "yield": round(avg_day_yield * 30, 2)
        },
        "year": {
            "profit": round(avg_day_profit * 365, 2),
            "yield": round(avg_day_yield * 365, 2)
        }
    }

def _format_asset_age(first_purchase_date) -> str:
    if not first_purchase_date:
        return "-"
    today = datetime.now().date()
    start_date = first_purchase_date
    if isinstance(start_date, (datetime, pd.Timestamp)):
        start_date = start_date.date()
    delta = today - start_date
    total_days = delta.days
    if total_days < 0: return "0d"
    years = total_days // 365
    remaining_days = total_days % 365
    months = remaining_days // 30
    days = remaining_days % 30
    parts = []
    if years > 0: parts.append(f"{years}a")
    if months > 0: parts.append(f"{months}m")
    if days > 0 or (years == 0 and months == 0): parts.append(f"{days}d")
    return " ".join(parts)

def _calculate_history_logic(user_id: str, db: Session) -> List[Dict]:
    purchases = db.query(AssetPurchase.ticker, AssetPurchase.qty, AssetPurchase.price, AssetPurchase.trade_date) \
        .filter(AssetPurchase.user_id == user_id).order_by(AssetPurchase.trade_date.asc()).all()
    if not purchases: return []

    df_purchases = pd.DataFrame(purchases, columns=['ticker', 'qty', 'price', 'trade_date'])
    df_purchases['trade_date'] = pd.to_datetime(df_purchases['trade_date'])
    df_purchases['price'] = df_purchases['price'].astype(float)
    df_purchases['cash_flow'] = df_purchases['qty'] * df_purchases['price']

    start_date = df_purchases['trade_date'].min()
    unique_tickers = df_purchases['ticker'].unique().tolist()

    prices_query = db.query(B3Price.ticker, B3Price.trade_date, B3Price.close) \
        .filter(B3Price.ticker.in_(unique_tickers), B3Price.trade_date >= start_date).all()
    cdi_query = db.query(CdiHistory.trade_date, CdiHistory.value) \
        .filter(CdiHistory.trade_date >= start_date).all()

    if not prices_query: return []

    df_prices = pd.DataFrame(prices_query, columns=['ticker', 'trade_date', 'close'])
    df_prices['trade_date'] = pd.to_datetime(df_prices['trade_date'])
    df_prices['close'] = pd.to_numeric(df_prices['close'])

    price_matrix = df_prices.pivot(index='trade_date', columns='ticker', values='close').resample('D').ffill()
    holdings_matrix = pd.DataFrame(0.0, index=price_matrix.index, columns=unique_tickers)
    daily_cash_flow = df_purchases.groupby('trade_date')['cash_flow'].sum()

    for _, row in df_purchases.iterrows():
        try:
            holdings_matrix.loc[row['trade_date']:, row['ticker']] += row['qty']
        except KeyError: pass

    common_idx = price_matrix.index.intersection(holdings_matrix.index)
    price_matrix = price_matrix.loc[common_idx]
    holdings_matrix = holdings_matrix.loc[common_idx]
    daily_portfolio = (holdings_matrix * price_matrix).sum(axis=1)

    aligned_cash_flow = daily_cash_flow.reindex(common_idx, fill_value=0.0)
    df_cdi = pd.DataFrame(cdi_query, columns=['trade_date', 'value'])
    cdi_factors_vals = [1.0] * len(common_idx)
    if not df_cdi.empty:
        df_cdi['trade_date'] = pd.to_datetime(df_cdi['trade_date'])
        df_cdi.set_index('trade_date', inplace=True)
        aligned_cdi = df_cdi.reindex(common_idx).fillna(0.0)
        cdi_factors_series = 1 + (aligned_cdi['value'] / 100.0)
        cdi_factors_vals = cdi_factors_series.values

    benchmark_values = []
    curr_bench = 0.0
    cash_flows_vals = aligned_cash_flow.values
    limit = min(len(common_idx), len(cash_flows_vals), len(cdi_factors_vals))
    for i in range(limit):
        curr_bench = (curr_bench * cdi_factors_vals[i]) + cash_flows_vals[i]
        benchmark_values.append(curr_bench)

    return [{"trade_date": common_idx[i].strftime("%Y-%m-%d"),
             "portfolio_value": round(float(daily_portfolio.iloc[i]), 2),
             "benchmark_value": round(float(benchmark_values[i]), 2)} for i in range(limit)]

# ==========================================
#  DASHBOARD COMPLETO (RAW + ADJUSTED)
# ==========================================

@wallet_bp.get("/dashboard")
def get_dashboard_data(
        db: Session = Depends(get_db),
        current_user: str = Depends(get_current_user)
):
    # 1. Buscar todas as compras
    purchases = db.query(AssetPurchase).filter(AssetPurchase.user_id == current_user).all()

    # Estrutura vazia
    empty_response = {
        "summary": {"total_invested": 0, "total_current": 0, "total_profit": 0, "total_profit_percent": 0},
        "period_projections": {k: _calculate_period_stats(0, 0, None) for k in ["total", "stock", "fii", "etf"]},
        "positions": [], "history": [], "transactions": [], "allocation": {"stock": 0, "fii": 0, "etf": 0}
    }

    if not purchases:
        return empty_response

    # 2. Buscar Histórico de Preços Ajustados (Para cálculo de Total Return)
    # Precisamos do 'adjusted_close' exato da data de cada compra para calcular o PM Ajustado
    purchase_keys = list({(p.ticker, p.trade_date) for p in purchases})
    history_map = {}

    if purchase_keys:
        # Busca em lote: SELECT * FROM b3_prices WHERE (ticker, trade_date) IN ((...), (...))
        try:
            hist_rows = db.query(B3Price.ticker, B3Price.trade_date, B3Price.adjusted_close) \
                .filter(tuple_(B3Price.ticker, B3Price.trade_date).in_(purchase_keys)).all()

            for r in hist_rows:
                key = f"{r.ticker}_{r.trade_date}"
                history_map[key] = float(r.adjusted_close) if r.adjusted_close else None
        except Exception as e:
            print(f"⚠️ Erro ao buscar histórico ajustado: {e}")

    # 3. Consolidar Posições
    pos_map = {}
    transactions_list = []

    for p in purchases:
        # Adiciona à lista de transações (para o histórico visual)
        transactions_list.append({
            "ticker": p.ticker, "price": float(p.price), "qty": p.qty,
            "trade_date": p.trade_date, "type": "buy", "asset_type": p.type
        })

        # Preço Raw (Pago de fato)
        price_raw = float(p.price)

        # Preço Ajustado (Recuperado do histórico ou fallback para Raw)
        hist_key = f"{p.ticker}_{p.trade_date}"
        price_adj = history_map.get(hist_key, price_raw)
        if not price_adj or price_adj <= 0:
            price_adj = price_raw # Fallback de segurança

        if p.ticker not in pos_map:
            pos_map[p.ticker] = {
                'qty': 0.0,
                'cost_raw': 0.0,      # Custo Caixa
                'cost_adjusted': 0.0, # Custo Econômico (Teórico)
                'type': p.type,
                'min_date': p.trade_date
            }

        pos = pos_map[p.ticker]
        pos['qty'] += p.qty
        pos['cost_raw'] += (p.qty * price_raw)
        pos['cost_adjusted'] += (p.qty * price_adj)
        if p.trade_date < pos['min_date']:
            pos['min_date'] = p.trade_date

    # Filtra posições zeradas
    active_tickers = [t for t, d in pos_map.items() if d['qty'] > 0.0001]

    if not active_tickers:
        return empty_response

    # 4. Buscar Preços Atuais (Raw e Adjusted)
    latest_prices = db.query(B3Price.ticker, B3Price.close, B3Price.adjusted_close, B3Price.name) \
        .filter(B3Price.ticker.in_(active_tickers)) \
        .order_by(B3Price.trade_date.desc()).all()

    price_map_raw = {}      # Fechamento de Tela
    price_map_adj = {}      # Fechamento Ajustado
    name_map = {}

    # Processa os preços mais recentes (pega o primeiro que aparecer pois ordenamos DESC)
    for row in latest_prices:
        if row.ticker not in price_map_raw:
            raw_val = float(row.close)
            # Se adjusted for nulo ou zero, usa raw
            adj_val = float(row.adjusted_close) if row.adjusted_close and row.adjusted_close > 0 else raw_val

            price_map_raw[row.ticker] = raw_val
            price_map_adj[row.ticker] = adj_val
            name_map[row.ticker] = row.name

    # 4.1 Buscar Classificações (Subtipo e Setor)
    classification_map = {}
    try:
        stmt = text("SELECT ticker, detected_type, sector FROM asset_classification_cache WHERE ticker IN :tickers")
        stmt = stmt.bindparams(bindparam("tickers", expanding=True))
        cls_rows = db.execute(stmt, {"tickers": active_tickers}).fetchall()
        for r in cls_rows:
            classification_map[r.ticker] = {"subtype": r.detected_type, "sector": r.sector}
    except Exception:
        pass

    # 5. Montar Lista Final e Totais
    positions_list = []

    # Acumuladores globais (Baseados no RAW - Dinheiro Real)
    total_invested_global = 0.0
    total_current_global = 0.0
    allocation_by_type = {"stock": 0.0, "fii": 0.0, "etf": 0.0}

    # Acumuladores para projeções por categoria
    cat_stats = {
        k: {'invested': 0.0, 'current': 0.0, 'start_date': None}
        for k in ['stock', 'fii', 'etf']
    }

    for ticker in active_tickers:
        data = pos_map[ticker]
        qty = data['qty']

        # Dados de Preço
        curr_price_raw = price_map_raw.get(ticker, 0.0)
        curr_price_adj = price_map_adj.get(ticker, curr_price_raw)

        # Se não tiver preço atual (erro de sync), usa o preço médio pra não quebrar
        if curr_price_raw == 0:
            curr_price_raw = data['cost_raw'] / qty
            curr_price_adj = curr_price_raw

        # --- CÁLCULOS RAW (Obrigatório para o Saldo) ---
        pm_raw = data['cost_raw'] / qty
        val_total_raw = qty * curr_price_raw
        profit_raw = val_total_raw - data['cost_raw']
        profit_pct_raw = (profit_raw / data['cost_raw'] * 100) if data['cost_raw'] > 0 else 0

        # --- CÁLCULOS ADJUSTED (Opcional - Total Return) ---
        pm_adj = data['cost_adjusted'] / qty
        val_total_adj_theoretical = qty * curr_price_adj
        profit_adj = val_total_adj_theoretical - data['cost_adjusted']
        profit_pct_adj = (profit_adj / data['cost_adjusted'] * 100) if data['cost_adjusted'] > 0 else 0

        # Totais Globais
        total_invested_global += data['cost_raw']
        total_current_global += val_total_raw

        # Totais por Categoria
        atype = data['type']
        allocation_by_type[atype] = allocation_by_type.get(atype, 0) + val_total_raw

        if atype in cat_stats:
            cat_stats[atype]['invested'] += data['cost_raw']
            cat_stats[atype]['current'] += val_total_raw
            # Define data inicial da categoria
            if not cat_stats[atype]['start_date'] or data['min_date'] < cat_stats[atype]['start_date']:
                cat_stats[atype]['start_date'] = data['min_date']

        # Monta objeto da Posição
        cls = classification_map.get(ticker, {})

        positions_list.append({
            "ticker": ticker,
            "name": name_map.get(ticker, ticker),
            "type": atype,
            "subtype": cls.get("subtype", "Indefinido"),
            "sector": cls.get("sector", "Outros"),
            "qty": round(qty, 4),
            "age": _format_asset_age(data['min_date']),

            # Preços
            "avg_price": round(pm_raw, 2),
            "avg_price_adjusted": round(pm_adj, 2), # <--- NOVO
            "current_price": round(curr_price_raw, 2),
            "current_adjusted": round(curr_price_adj, 2), # <--- NOVO

            # Valor (Sempre Raw)
            "total_value": round(val_total_raw, 2),

            # Rentabilidade Caixa (Raw)
            "profit": round(profit_raw, 2),
            "profit_percent": round(profit_pct_raw, 2),

            # Rentabilidade Performance (Adjusted)
            "total_return_profit": round(profit_adj, 2), # <--- NOVO
            "total_return_percent": round(profit_pct_adj, 2), # <--- NOVO

            # Placeholder (será calculado após loop final)
            "allocation_percent": 0
        })

    # 6. Finalização (Allocations % e Projeções)
    positions_list.sort(key=lambda x: x['total_value'], reverse=True)

    for p in positions_list:
        if total_current_global > 0:
            p['allocation_percent'] = round((p['total_value'] / total_current_global) * 100, 2)

    total_profit_global = total_current_global - total_invested_global
    total_profit_pct_global = (total_profit_global / total_invested_global * 100) if total_invested_global > 0 else 0

    # Projeções por período
    start_date_global = min([p['min_date'] for p in pos_map.values()]) if pos_map else None

    projections = {
        "total": _calculate_period_stats(total_profit_global, total_profit_pct_global, start_date_global)
    }

    for cat, stats in cat_stats.items():
        c_profit = stats['current'] - stats['invested']
        c_yield = (c_profit / stats['invested'] * 100) if stats['invested'] > 0 else 0
        projections[cat] = _calculate_period_stats(c_profit, c_yield, stats['start_date'])

    return {
        "summary": {
            "total_invested": round(total_invested_global, 2),
            "total_current": round(total_current_global, 2),
            "total_profit": round(total_profit_global, 2),
            "total_profit_percent": round(total_profit_pct_global, 2)
        },
        "period_projections": projections,
        "positions": positions_list,
        "history": _calculate_history_logic(current_user, db),
        "transactions": transactions_list,
        "allocation": {k: round(v, 2) for k, v in allocation_by_type.items()}
    }

# --- OUTROS ENDPOINTS (CRUD) PERMANECEM IGUAIS ---
# (Pode manter o resto do arquivo original wallet_router.py daqui pra baixo)
# ...
@wallet_bp.get("/performance/history", response_model=List[HistoryPoint])
def get_wallet_history(
        db: Session = Depends(get_db),
        current_user: str = Depends(get_current_user)
):
    return _calculate_history_logic(current_user, db)

@wallet_bp.post("/import")
def import_purchases(
        payload: ImportPurchasesRequest,
        db: Session = Depends(get_db),
        current_user: str = Depends(get_current_user)
):
    try:
        new_records = []
        for item in payload.purchases:
            record = AssetPurchase(
                user_id=current_user,
                ticker=item.ticker.upper(),
                name=item.name,
                type=item.type.lower(),
                qty=item.qty,
                price=item.price,
                trade_date=item.trade_date
            )
            new_records.append(record)
        if new_records:
            db.add_all(new_records)
            db.commit()
        return {"success": True, "count": len(new_records), "message": "Import successful"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@wallet_bp.get("/purchases", response_model=List[AssetPurchaseResponse])
def get_user_purchases(
        db: Session = Depends(get_db),
        current_user: str = Depends(get_current_user)
):
    purchases = db.query(AssetPurchase).filter(AssetPurchase.user_id == current_user).all()
    return purchases

@wallet_bp.post("/purchases", response_model=AssetPurchaseResponse, status_code=status.HTTP_201_CREATED)
def create_purchase(
        payload: AssetPurchaseInput,
        db: Session = Depends(get_db),
        current_user: str = Depends(get_current_user)
):
    try:
        new_purchase = AssetPurchase(
            user_id=current_user,
            ticker=payload.ticker.upper(),
            name=payload.name or payload.ticker.upper(),
            type=payload.type.lower(),
            qty=payload.qty,
            price=payload.price,
            trade_date=payload.trade_date
        )
        db.add(new_purchase)
        db.commit()
        db.refresh(new_purchase)
        return new_purchase
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@wallet_bp.put("/purchases/{purchase_id}", response_model=AssetPurchaseResponse)
def update_purchase(
        purchase_id: int,
        payload: AssetPurchaseInput,
        db: Session = Depends(get_db),
        current_user: str = Depends(get_current_user)
):
    purchase = db.query(AssetPurchase).filter(AssetPurchase.id == purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Aporte não encontrado")
    if purchase.user_id != current_user:
        raise HTTPException(status_code=403, detail="Não autorizado a alterar este registro")
    try:
        purchase.ticker = payload.ticker.upper()
        purchase.name = payload.name or payload.ticker.upper()
        purchase.type = payload.type.lower()
        purchase.qty = payload.qty
        purchase.price = payload.price
        purchase.trade_date = payload.trade_date
        db.commit()
        db.refresh(purchase)
        return purchase
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@wallet_bp.delete("/purchases/{purchase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase(
        purchase_id: int,
        db: Session = Depends(get_db),
        current_user: str = Depends(get_current_user)
):
    purchase = db.query(AssetPurchase).filter(AssetPurchase.id == purchase_id).first()

    if not purchase:
        raise HTTPException(status_code=404, detail="Aporte não encontrado")

    if purchase.user_id != current_user:
        raise HTTPException(status_code=403, detail="Não autorizado a deletar este registro")

    try:
        db.delete(purchase)
        db.commit()
        return None
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))