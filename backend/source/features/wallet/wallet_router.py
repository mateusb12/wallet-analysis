from typing import List
import pandas as pd

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from backend.source.core.database import get_db
from backend.source.models.sql_models import AssetPurchase, CdiHistory, B3Price
from backend.source.features.wallet.wallet_schema import (
    ImportPurchasesRequest,
    AssetPurchaseResponse,
    AssetPurchaseInput, HistoryPoint
)

wallet_bp = APIRouter(prefix="/wallet", tags=["Wallet"])


# --- ROTA DE IMPORTAÇÃO (Mantém igual) ---
@wallet_bp.post("/import")
def import_purchases(payload: ImportPurchasesRequest, db: Session = Depends(get_db)):
    # ... (código da importação mantém igual) ...
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


# --- CRUD DO APORTE MANUAL (CORRIGIDO AQUI) ---

# 1. GET /purchases (Listar)
@wallet_bp.get("/purchases", response_model=List[AssetPurchaseResponse])
def get_user_purchases(user_id: str, db: Session = Depends(get_db)):
    """Fetch all asset purchases for a specific user."""
    purchases = db.query(AssetPurchase).filter(AssetPurchase.user_id == user_id).all()
    return purchases


# 2. POST /purchases (Criar) - ANTES ERA apenas "/"
@wallet_bp.post("/purchases", response_model=AssetPurchaseResponse, status_code=status.HTTP_201_CREATED)
def create_purchase(payload: AssetPurchaseInput, db: Session = Depends(get_db)):
    """Cria um único aporte manual."""
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


# 3. PUT /purchases/{id} (Editar) - ANTES ERA apenas "/{id}"
@wallet_bp.put("/purchases/{purchase_id}", response_model=AssetPurchaseResponse)
def update_purchase(purchase_id: int, payload: AssetPurchaseInput, db: Session = Depends(get_db)):
    """Edita um aporte existente."""
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


# 4. DELETE /purchases/{id} (Deletar) - ANTES ERA apenas "/{id}"
@wallet_bp.delete("/purchases/{purchase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase(purchase_id: int, db: Session = Depends(get_db)):
    """Remove um aporte permanentemente."""
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

@wallet_bp.get("/performance/history", response_model=List[HistoryPoint])
def get_wallet_history(user_id: str, db: Session = Depends(get_db)):
    """
    Gera o histórico diário do patrimônio do usuário cruzando
    compras (AssetPurchase) com preços de mercado (B3Price).
    """

    # 1. Buscar todas as compras do usuário ordenadas por data
    purchases = db.query(
        AssetPurchase.ticker,
        AssetPurchase.qty,
        AssetPurchase.trade_date
    ).filter(
        AssetPurchase.user_id == user_id
    ).order_by(AssetPurchase.trade_date.asc()).all()

    if not purchases:
        return []

    # Converter para DataFrame Pandas
    df_purchases = pd.DataFrame(purchases, columns=['ticker', 'qty', 'trade_date'])
    df_purchases['trade_date'] = pd.to_datetime(df_purchases['trade_date'])

    start_date = df_purchases['trade_date'].min()
    unique_tickers = df_purchases['ticker'].unique().tolist()

    # 2. Buscar histórico de preços (B3Price) para os ativos da carteira
    prices_query = db.query(
        B3Price.ticker,
        B3Price.trade_date,
        B3Price.close
    ).filter(
        B3Price.ticker.in_(unique_tickers),
        B3Price.trade_date >= start_date
    ).all()

    # 3. Buscar histórico do CDI (Para Benchmark)
    cdi_query = db.query(
        CdiHistory.trade_date,
        CdiHistory.value
    ).filter(
        CdiHistory.trade_date >= start_date
    ).all()

    if not prices_query:
        # Se não tem preços no banco, retorna vazio para não quebrar
        return []

    # --- PROCESSAMENTO PANDAS ---

    # A) Preparar Tabela de Preços (Pivot Table)
    df_prices = pd.DataFrame(prices_query, columns=['ticker', 'trade_date', 'close'])
    df_prices['trade_date'] = pd.to_datetime(df_prices['trade_date'])
    df_prices['close'] = pd.to_numeric(df_prices['close'])

    # Cria matriz: Datas nas linhas, Tickers nas colunas. Preenche buracos (feriados) com preço anterior.
    price_matrix = df_prices.pivot(index='trade_date', columns='ticker', values='close').resample('D').ffill()

    # B) Preparar Tabela de Quantidades (Holdings)
    # Começa uma tabela zerada com as mesmas datas da matriz de preço
    holdings_matrix = pd.DataFrame(0.0, index=price_matrix.index, columns=unique_tickers)

    for _, row in df_purchases.iterrows():
        p_date = row['trade_date']
        ticker = row['ticker']
        qty = row['qty']

        # Se o ticker tem preço no banco
        if ticker in holdings_matrix.columns:
            # Da data da compra até o futuro, soma a quantidade
            try:
                holdings_matrix.loc[p_date:, ticker] += qty
            except KeyError:
                # Caso a data da compra seja feriado e não esteja no index do resample, ajusta
                pass

    # C) Calcular Patrimônio (Qty * Preço)
    # Garante alinhamento de datas
    common_idx = price_matrix.index.intersection(holdings_matrix.index)
    price_matrix = price_matrix.loc[common_idx]
    holdings_matrix = holdings_matrix.loc[common_idx]

    # Multiplicação matricial e soma por linha (por dia)
    daily_portfolio = (holdings_matrix * price_matrix).sum(axis=1)

    # D) Calcular Benchmark (CDI Normalizado)
    benchmark_series = pd.Series(0.0, index=daily_portfolio.index)

    if cdi_query:
        df_cdi = pd.DataFrame(cdi_query, columns=['trade_date', 'value'])
        df_cdi['trade_date'] = pd.to_datetime(df_cdi['trade_date'])
        df_cdi.set_index('trade_date', inplace=True)

        # Reamostra CDI para dias corridos (ffill para manter taxa de sexta no fds, ou 0 se for taxa diária)
        # Assumindo que 'value' no banco é Taxa Diária Percentual (ex: 0.05)
        df_cdi = df_cdi.resample('D').ffill().loc[common_idx]

        # Cálculo acumulado: Começa com o valor do primeiro aporte
        initial_invest = daily_portfolio.iloc[0] if len(daily_portfolio) > 0 else 0

        # Converte taxa percentual para fator (ex: 0.05 -> 1.0005)
        # Ajuste conforme seu banco: se for 5.0 (%), divide por 100. Se for 0.05, divide por 100 também se for a.a., etc.
        # Assumindo padrão B3 (0.04 ao dia ~ 12% ano)
        factors = 1 + (df_cdi['value'] / 100.0)

        # Acumula o produto dos fatores
        cum_factors = factors.cumprod()

        # Normaliza para dinheiro
        # Se cum_factors começa em 1.0004, normalizamos para começar em 1.0 base
        if not cum_factors.empty:
            base_factor = cum_factors.iloc[0]
            benchmark_series = (cum_factors / base_factor) * initial_invest

    # 4. Formatar Retorno
    result = []
    for date, p_val in daily_portfolio.items():
        # Trata NaN como 0
        p_val_clean = float(p_val) if pd.notnull(p_val) else 0.0

        # Pega valor do benchmark na mesma data
        try:
            b_val = benchmark_series.loc[date]
            b_val_clean = float(b_val) if pd.notnull(b_val) else 0.0
        except:
            b_val_clean = 0.0

        result.append({
            "trade_date": date.strftime("%Y-%m-%d"),
            "portfolio_value": round(p_val_clean, 2),
            "benchmark_value": round(b_val_clean, 2)
        })

    return result