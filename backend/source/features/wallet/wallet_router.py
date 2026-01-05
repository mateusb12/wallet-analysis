from typing import List, Dict
import pandas as pd
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.source.core.database import get_db
from backend.source.models.sql_models import AssetPurchase, CdiHistory, B3Price
from backend.source.features.wallet.wallet_schema import (
    ImportPurchasesRequest,
    AssetPurchaseResponse,
    AssetPurchaseInput,
    HistoryPoint,
    DashboardResponse
)

wallet_bp = APIRouter(prefix="/wallet", tags=["Wallet"])

# ==========================================
#  LÓGICA INTERNA (SERVICE) - REUTILIZÁVEL
# ==========================================

def _calculate_history_logic(user_id: str, db: Session) -> List[Dict]:
    """
    Calcula histórico comparativo (Carteira vs Benchmark Equivalente).
    CORREÇÃO: Tratamento de Decimal e acesso correto aos valores do CDI.
    """
    # 1. Buscar todas as compras
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

    # Converter para DataFrame
    df_purchases = pd.DataFrame(purchases, columns=['ticker', 'qty', 'price', 'trade_date'])
    df_purchases['trade_date'] = pd.to_datetime(df_purchases['trade_date'])

    # --- FIX 1: Converter Decimal para Float explicitamente ---
    # O banco retorna 'price' como Decimal, o que quebra contas com float (qty) no Pandas
    df_purchases['price'] = df_purchases['price'].astype(float)

    df_purchases['cash_flow'] = df_purchases['qty'] * df_purchases['price']

    start_date = df_purchases['trade_date'].min()
    unique_tickers = df_purchases['ticker'].unique().tolist()

    # 2. Buscar histórico de preços (Mark to Market)
    prices_query = db.query(
        B3Price.ticker,
        B3Price.trade_date,
        B3Price.close
    ).filter(
        B3Price.ticker.in_(unique_tickers),
        B3Price.trade_date >= start_date
    ).all()

    # 3. Buscar CDI
    cdi_query = db.query(
        CdiHistory.trade_date,
        CdiHistory.value
    ).filter(
        CdiHistory.trade_date >= start_date
    ).all()

    if not prices_query:
        return []

    # --- PROCESSAMENTO PANDAS ---
    df_prices = pd.DataFrame(prices_query, columns=['ticker', 'trade_date', 'close'])
    df_prices['trade_date'] = pd.to_datetime(df_prices['trade_date'])
    df_prices['close'] = pd.to_numeric(df_prices['close'])

    # Pivot: Datas x Tickers
    price_matrix = df_prices.pivot(index='trade_date', columns='ticker', values='close').resample('D').ffill()

    # Holdings Matrix
    holdings_matrix = pd.DataFrame(0.0, index=price_matrix.index, columns=unique_tickers)

    # Série de Fluxo de Caixa (Soma de aportes por dia)
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

                # Alinhar
    common_idx = price_matrix.index.intersection(holdings_matrix.index)
    price_matrix = price_matrix.loc[common_idx]
    holdings_matrix = holdings_matrix.loc[common_idx]

    # 4. Cálculo Carteira
    daily_portfolio = (holdings_matrix * price_matrix).sum(axis=1)

    # 5. Cálculo Benchmark (CDI Equivalente)
    aligned_cash_flow = daily_cash_flow.reindex(common_idx, fill_value=0.0)

    # Prepara série do CDI
    df_cdi = pd.DataFrame(cdi_query, columns=['trade_date', 'value'])

    # Inicializa fatores padrão (1.0 = sem rendimento)
    cdi_factors_vals = [1.0] * len(common_idx)

    if not df_cdi.empty:
        df_cdi['trade_date'] = pd.to_datetime(df_cdi['trade_date'])
        df_cdi.set_index('trade_date', inplace=True)

        # Alinha CDI com as datas da carteira
        aligned_cdi = df_cdi.reindex(common_idx).fillna(0.0)

        # Calcula fator diário (ex: 1.0005)
        # aligned_cdi['value'] é uma Series. A conta abaixo retorna uma Series.
        cdi_factors_series = 1 + (aligned_cdi['value'] / 100.0)

        # --- FIX 2: Usar .values diretamente (Series não tem coluna 'value') ---
        cdi_factors_vals = cdi_factors_series.values

    # Loop Acumulativo
    benchmark_values = []
    current_bench_balance = 0.0

    dates_list = common_idx.tolist()
    cash_flows_vals = aligned_cash_flow.values

    # Segurança caso os tamanhos não batam (ex: dados corrompidos)
    limit = min(len(dates_list), len(cash_flows_vals), len(cdi_factors_vals))

    for i in range(limit):
        factor = cdi_factors_vals[i]
        new_money = cash_flows_vals[i]

        # 1. Rende o saldo anterior
        current_bench_balance *= factor

        # 2. Adiciona aporte
        current_bench_balance += new_money

        benchmark_values.append(current_bench_balance)

    # 6. Formatar
    result = []
    for i in range(limit):
        date = dates_list[i]
        p_val = daily_portfolio.iloc[i]
        b_val = benchmark_values[i]

        result.append({
            "trade_date": date.strftime("%Y-%m-%d"),
            "portfolio_value": round(float(p_val), 2),
            "benchmark_value": round(float(b_val), 2)
        })

    return result

# ==========================================
#  ROTAS (ENDPOINTS)
# ==========================================

@wallet_bp.get("/dashboard") # Removi o response_model estrito por enquanto para facilitar
def get_dashboard_data(user_id: str, db: Session = Depends(get_db)):
    # 1. Buscar todas as compras
    purchases = db.query(AssetPurchase).filter(AssetPurchase.user_id == user_id).all()

    # --- NOVO: Preparar lista de transações para o gráfico ---
    transactions_list = [{
        "ticker": p.ticker,
        "price": float(p.price),
        "qty": p.qty,
        "trade_date": p.trade_date,
        "type": "buy",       # Hardcoded 'buy' pois sua tabela é só de purchases por enquanto
        "asset_type": p.type # 'stock', 'fii', etc. (Vem do banco)
    } for p in purchases]
    # ---------------------------------------------------------

    if not purchases:
        return {
            "summary": {"total_invested": 0, "total_current": 0, "total_profit": 0, "total_profit_percent": 0},
            "positions": [],
            "history": [],
            "transactions": [], # Agora isso será validado pelo Schema
            "allocation": {"stock": 0, "fii": 0, "etf": 0}
        }

    # 2. Consolidar Posições
    df_purchases = pd.DataFrame([{
        'ticker': p.ticker,
        'qty': p.qty,
        'price': float(p.price),
        'total_cost': p.qty * float(p.price),
        'type': p.type
    } for p in purchases])

    df_pos = df_purchases.groupby('ticker').agg({
        'qty': 'sum',
        'total_cost': 'sum',
        'type': 'first',
        'price': 'mean'
    }).reset_index()

    df_pos = df_pos[df_pos['qty'] > 0.0001].copy()

    if df_pos.empty:
        return {
            "summary": {"total_invested": 0, "total_current": 0, "total_profit": 0, "total_profit_percent": 0},
            "positions": [],
            "history": [],
            "transactions": [],
            "allocation": {"stock": 0, "fii": 0, "etf": 0}
        }

    df_pos['avg_price'] = df_pos['total_cost'] / df_pos['qty']
    tickers = df_pos['ticker'].tolist()

    # 3. Buscar Preços Atuais
    latest_prices_query = db.query(
        B3Price.ticker,
        B3Price.close,
        B3Price.name # Tentar pegar o nome também
    ).filter(
        B3Price.ticker.in_(tickers)
    ).order_by(B3Price.trade_date.desc()).all()

    price_map = {}
    name_map = {}
    for item in latest_prices_query:
        if item.ticker not in price_map:
            price_map[item.ticker] = float(item.close)
            name_map[item.ticker] = item.name

    # 4. Cálculos Finais
    def get_current_price(row):
        return price_map.get(row['ticker'], row['avg_price'])

    df_pos['current_price'] = df_pos.apply(get_current_price, axis=1)
    df_pos['current_total'] = df_pos['qty'] * df_pos['current_price']
    df_pos['profit'] = df_pos['current_total'] - df_pos['total_cost']
    df_pos['profit_percent'] = (df_pos['profit'] / df_pos['total_cost']) * 100

    total_invested = df_pos['total_cost'].sum()
    total_current = df_pos['current_total'].sum()
    total_profit = total_current - total_invested
    total_profit_pct = (total_profit / total_invested * 100) if total_invested > 0 else 0

    df_pos['allocation_percent'] = (df_pos['current_total'] / total_current) * 100

    allocation_by_type = df_pos.groupby('type')['current_total'].sum().to_dict()
    final_allocation = {
        "stock": allocation_by_type.get('stock', 0),
        "fii": allocation_by_type.get('fii', 0),
        "etf": allocation_by_type.get('etf', 0)
    }

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
        "positions": positions_list,
        "history": history_data,
        "transactions": transactions_list, # <--- Agora o Pydantic vai aceitar isso
        "allocation": final_allocation
    }

# Rota legado (caso o gráfico antigo ainda tente chamar direto)
@wallet_bp.get("/performance/history", response_model=List[HistoryPoint])
def get_wallet_history(user_id: str, db: Session = Depends(get_db)):
    return _calculate_history_logic(user_id, db)

# --- ROTAS DE CRUD (Mantidas) ---

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