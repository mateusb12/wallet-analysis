from typing import List, Dict, Optional
import pandas as pd
from datetime import datetime, date

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.source.core.database import get_db
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
    """
    Calcula as projeções de rentabilidade (Dia, Mês, Ano) baseadas no histórico.
    """
    if not start_date:
        return {
            "total": {"profit": profit, "yield": yield_pct},
            "day": {"profit": 0, "yield": 0},
            "month": {"profit": 0, "yield": 0},
            "year": {"profit": 0, "yield": 0}
        }

    today = datetime.now().date()
    # Converte start_date para date se for datetime
    if isinstance(start_date, datetime):
        start_date = start_date.date()

    diff_days = (today - start_date).days
    days = max(1, diff_days) # Evita divisão por zero

    # Médias
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

def _calculate_history_logic(user_id: str, db: Session) -> List[Dict]:
    """
    Calcula histórico comparativo (Carteira vs Benchmark Equivalente).
    """
    purchases = db.query(
        AssetPurchase.ticker,
        AssetPurchase.qty,
        AssetPurchase.price,
        AssetPurchase.trade_date
    ).filter(
        AssetPurchase.user_id == user_id
    ).order_by(AssetPurchase.trade_date.asc()).all()

    if not purchases:
        return []

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

    if not prices_query:
        return []

    df_prices = pd.DataFrame(prices_query, columns=['ticker', 'trade_date', 'close'])
    df_prices['trade_date'] = pd.to_datetime(df_prices['trade_date'])
    df_prices['close'] = pd.to_numeric(df_prices['close'])

    price_matrix = df_prices.pivot(index='trade_date', columns='ticker', values='close').resample('D').ffill()
    holdings_matrix = pd.DataFrame(0.0, index=price_matrix.index, columns=unique_tickers)
    daily_cash_flow = df_purchases.groupby('trade_date')['cash_flow'].sum()

    for _, row in df_purchases.iterrows():
        p_date = row['trade_date']
        ticker = row['ticker']
        qty = row['qty']
        if ticker in holdings_matrix.columns:
            try:
                holdings_matrix.loc[p_date:, ticker] += qty
            except KeyError:
                pass

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
    current_bench_balance = 0.0
    dates_list = common_idx.tolist()
    cash_flows_vals = aligned_cash_flow.values
    limit = min(len(dates_list), len(cash_flows_vals), len(cdi_factors_vals))

    for i in range(limit):
        factor = cdi_factors_vals[i]
        new_money = cash_flows_vals[i]
        current_bench_balance *= factor
        current_bench_balance += new_money
        benchmark_values.append(current_bench_balance)

    result = []
    for i in range(limit):
        result.append({
            "trade_date": dates_list[i].strftime("%Y-%m-%d"),
            "portfolio_value": round(float(daily_portfolio.iloc[i]), 2),
            "benchmark_value": round(float(benchmark_values[i]), 2)
        })

    return result

# ==========================================
#  ROTAS (ENDPOINTS)
# ==========================================

@wallet_bp.get("/dashboard")
def get_dashboard_data(user_id: str, db: Session = Depends(get_db)):
    # 1. Buscar todas as compras
    purchases = db.query(AssetPurchase).filter(AssetPurchase.user_id == user_id).all()

    transactions_list = [{
        "ticker": p.ticker,
        "price": float(p.price),
        "qty": p.qty,
        "trade_date": p.trade_date,
        "type": "buy",
        "asset_type": p.type
    } for p in purchases]

    # Estrutura vazia padrão
    empty_response = {
        "summary": {"total_invested": 0, "total_current": 0, "total_profit": 0, "total_profit_percent": 0},
        "period_projections": { # Novo objeto para médias
            "total": _calculate_period_stats(0, 0, None),
            "stock": _calculate_period_stats(0, 0, None),
            "fii": _calculate_period_stats(0, 0, None),
            "etf": _calculate_period_stats(0, 0, None),
        },
        "positions": [],
        "history": [],
        "transactions": [],
        "allocation": {"stock": 0, "fii": 0, "etf": 0}
    }

    if not purchases:
        return empty_response

    # 2. Consolidar Posições
    df_raw = pd.DataFrame([{
        'ticker': p.ticker,
        'qty': p.qty,
        'price': float(p.price),
        'total_cost': p.qty * float(p.price),
        'type': p.type,
        'trade_date': p.trade_date # Importante para calcular idade da categoria
    } for p in purchases])

    # Agrupa por Ticker
    df_pos = df_raw.groupby('ticker').agg({
        'qty': 'sum',
        'total_cost': 'sum',
        'type': 'first',
        'price': 'mean'
    }).reset_index()

    df_pos = df_pos[df_pos['qty'] > 0.0001].copy()

    if df_pos.empty:
        return empty_response

    df_pos['avg_price'] = df_pos['total_cost'] / df_pos['qty']
    tickers = df_pos['ticker'].tolist()

    # 3. Buscar Preços Atuais
    latest_prices_query = db.query(B3Price.ticker, B3Price.close, B3Price.name) \
        .filter(B3Price.ticker.in_(tickers)).order_by(B3Price.trade_date.desc()).all()

    price_map = {}
    name_map = {}
    for item in latest_prices_query:
        if item.ticker not in price_map:
            price_map[item.ticker] = float(item.close)
            name_map[item.ticker] = item.name

    # 4. Cálculo de Lucros e Totais
    def get_current_price(row):
        return price_map.get(row['ticker'], row['avg_price'])

    df_pos['current_price'] = df_pos.apply(get_current_price, axis=1)
    df_pos['current_total'] = df_pos['qty'] * df_pos['current_price']
    df_pos['profit'] = df_pos['current_total'] - df_pos['total_cost']
    df_pos['profit_percent'] = (df_pos['profit'] / df_pos['total_cost']) * 100

    # 5. Totais Gerais
    total_invested = df_pos['total_cost'].sum()
    total_current = df_pos['current_total'].sum()
    total_profit = total_current - total_invested
    total_profit_pct = (total_profit / total_invested * 100) if total_invested > 0 else 0

    df_pos['allocation_percent'] = (df_pos['current_total'] / total_current) * 100

    # 6. Alocação Simples
    allocation_by_type = df_pos.groupby('type')['current_total'].sum().to_dict()
    final_allocation = {
        "stock": allocation_by_type.get('stock', 0),
        "fii": allocation_by_type.get('fii', 0),
        "etf": allocation_by_type.get('etf', 0)
    }

    # 7. CÁLCULO DAS PROJEÇÕES (Média Dia, Mês, Ano)
    # Precisamos da data mais antiga DE CADA CATEGORIA para calcular a média corretamente
    # Ex: Ações comecei há 2 anos, FIIs comecei ontem. A média diária deve respeitar isso.

    # Data de início Global
    global_start_date = df_raw['trade_date'].min()
    projections = {
        "total": _calculate_period_stats(total_profit, total_profit_pct, global_start_date)
    }

    for cat_type in ['stock', 'fii', 'etf']:
        # Filtra transações apenas desse tipo para achar a data de início
        cat_txs = df_raw[df_raw['type'] == cat_type]

        # Filtra posições consolidadas apenas desse tipo para achar o lucro total da categoria
        cat_pos = df_pos[df_pos['type'] == cat_type]

        if not cat_txs.empty and not cat_pos.empty:
            cat_start = cat_txs['trade_date'].min()
            cat_invested = cat_pos['total_cost'].sum()
            cat_current = cat_pos['current_total'].sum()
            cat_profit = cat_current - cat_invested
            cat_yield = (cat_profit / cat_invested * 100) if cat_invested > 0 else 0

            projections[cat_type] = _calculate_period_stats(cat_profit, cat_yield, cat_start)
        else:
            # Se não tem ativo desse tipo, zera
            projections[cat_type] = _calculate_period_stats(0, 0, None)


    # 8. Montar Lista de Posições
    positions_list = []
    for _, row in df_pos.iterrows():
        positions_list.append({
            "ticker": row['ticker'],
            "name": name_map.get(row['ticker'], row['ticker']),
            "type": row['type'],
            "qty": round(row['qty'], 4),
            "avg_price": round(row['avg_price'], 2),
            "current_price": round(row['current_price'], 2),
            "total_value": round(row['current_total'], 2),
            "profit": round(row['profit'], 2),
            "profit_percent": round(row['profit_percent'], 2),
            "allocation_percent": round(row['allocation_percent'], 2)
        })

    positions_list.sort(key=lambda x: x['total_value'], reverse=True)
    history_data = _calculate_history_logic(user_id, db)

    return {
        "summary": {
            "total_invested": round(total_invested, 2),
            "total_current": round(total_current, 2),
            "total_profit": round(total_profit, 2),
            "total_profit_percent": round(total_profit_pct, 2)
        },
        "period_projections": projections, # <--- OBJETO NOVO AQUI
        "positions": positions_list,
        "history": history_data,
        "transactions": transactions_list,
        "allocation": final_allocation
    }

# --- ROTAS DE CRUD (Mantidas inalteradas abaixo) ---
@wallet_bp.get("/performance/history", response_model=List[HistoryPoint])
def get_wallet_history(user_id: str, db: Session = Depends(get_db)):
    return _calculate_history_logic(user_id, db)

@wallet_bp.post("/import")
def import_purchases(payload: ImportPurchasesRequest, db: Session = Depends(get_db)):
    try:
        new_records = []
        for item in payload.purchases:
            record = AssetPurchase(
                user_id=payload.user_id,
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
def get_user_purchases(user_id: str, db: Session = Depends(get_db)):
    purchases = db.query(AssetPurchase).filter(AssetPurchase.user_id == user_id).all()
    return purchases

@wallet_bp.post("/purchases", response_model=AssetPurchaseResponse, status_code=status.HTTP_201_CREATED)
def create_purchase(payload: AssetPurchaseInput, db: Session = Depends(get_db)):
    try:
        new_purchase = AssetPurchase(
            user_id=payload.user_id,
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
def update_purchase(purchase_id: int, payload: AssetPurchaseInput, db: Session = Depends(get_db)):
    purchase = db.query(AssetPurchase).filter(AssetPurchase.id == purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Aporte não encontrado")
    if purchase.user_id != payload.user_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
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
def delete_purchase(purchase_id: int, db: Session = Depends(get_db)):
    purchase = db.query(AssetPurchase).filter(AssetPurchase.id == purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Aporte não encontrado")
    try:
        db.delete(purchase)
        db.commit()
        return None
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))