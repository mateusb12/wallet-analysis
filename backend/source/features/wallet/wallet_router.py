from typing import List, Dict, Optional
import pandas as pd
import re
from datetime import datetime, date

from fastapi import APIRouter, HTTPException, Depends, status
from backend.source.core.dependencies import get_wallet_repository
from backend.source.features.auth.jwt_identity_extraction import get_current_user
from backend.source.models.sql_models import AssetPurchase
from backend.source.persistence.ports import WalletRepository
from backend.source.features.wallet.wallet_schema import (
    ImportPurchasesRequest,
    AssetPurchaseResponse,
    AssetPurchaseInput,
    SyncB3PurchasesRequest,
    ReconcileTradeDatesRequest,
    ProventoResponse,
    HistoryPoint
)
from backend.source.features.wallet.dividend_calculator import (
    calculate_dividend_series,
    calculate_purchase_dividends,
    resolve_provento_ex_dates,
)
from backend.source.features.wallet.history_data import load_history_data

# Compatibility name for existing callers/tests; implementation lives in the
# dividend calculator module.
_calculate_purchase_dividends = calculate_purchase_dividends

wallet_bp = APIRouter(prefix="/wallet", tags=["Wallet"])

# ==========================================
#  LÓGICA INTERNA (SERVICE) - AUXILIARES
# ==========================================

def _calculate_period_stats(
        profit: float,
        yield_percentage: float,
        start_date: Optional[date],
        dividends: float = 0.0,
) -> Dict:
    valuation = profit - dividends
    if not start_date:
        return {
            "total": {"profit": profit, "yield": yield_percentage, "valuation": valuation, "dividends": dividends},
            "day": {"profit": 0, "yield": 0, "valuation": 0, "dividends": 0},
            "month": {"profit": 0, "yield": 0, "valuation": 0, "dividends": 0},
            "year": {"profit": 0, "yield": 0, "valuation": 0, "dividends": 0}
        }

    today = datetime.now().date()
    if isinstance(start_date, datetime):
        start_date = start_date.date()

    elapsed_days = (today - start_date).days
    days = max(1, elapsed_days)

    average_daily_profit = profit / days
    average_daily_yield = yield_percentage / days
    average_daily_dividends = dividends / days
    average_daily_valuation = valuation / days

    return {
        "total": {
            "profit": round(profit, 2),
            "yield": round(yield_percentage, 2),
            "valuation": round(valuation, 2),
            "dividends": round(dividends, 2),
        },
        "day": {
            "profit": round(average_daily_profit, 2),
            "yield": round(average_daily_yield, 4),
            "valuation": round(average_daily_valuation, 2),
            "dividends": round(average_daily_dividends, 2),
        },
        "month": {
            "profit": round(average_daily_profit * 30, 2),
            "yield": round(average_daily_yield * 30, 2),
            "valuation": round(average_daily_valuation * 30, 2),
            "dividends": round(average_daily_dividends * 30, 2),
        },
        "year": {
            "profit": round(average_daily_profit * 365, 2),
            "yield": round(average_daily_yield * 365, 2),
            "valuation": round(average_daily_valuation * 365, 2),
            "dividends": round(average_daily_dividends * 365, 2),
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


def _resolve_asset_type(stored_type: str, classification: Dict) -> str:
    detected_type = str(classification.get("subtype") or "").upper()
    if detected_type.startswith("ETF"):
        return "etf"
    if detected_type.startswith("FII"):
        return "fii"
    return stored_type


def _build_cdi_factors(benchmark_query, common_date_index):
    """Build CDI factors without applying a business-day rate on calendar gaps."""
    factors = pd.Series(1.0, index=common_date_index, dtype=float)
    cdi_data_frame = pd.DataFrame(benchmark_query, columns=['trade_date', 'value'])

    if cdi_data_frame.empty:
        return factors.values

    cdi_data_frame['trade_date'] = pd.to_datetime(cdi_data_frame['trade_date'])
    cdi_data_frame.set_index('trade_date', inplace=True)
    cdi_data_frame.sort_index(inplace=True)

    observed_cdi = pd.to_numeric(cdi_data_frame['value']).reindex(common_date_index)
    observed_dates = observed_cdi.notna()
    factors.loc[observed_dates] = 1 + (observed_cdi.loc[observed_dates] / 100.0)
    return factors.values


def _calculate_cdb_return(purchases, cdi_rows):
    """Estimate the gross return of investing each purchase at 100% of CDI."""
    if not purchases or not cdi_rows:
        return 0.0

    def get_row_value(row, key, position):
        if isinstance(row, dict):
            return row[key]
        if hasattr(row, key):
            return getattr(row, key)
        return row[position]

    rates = sorted(
        (pd.Timestamp(get_row_value(row, "trade_date", 0)), float(get_row_value(row, "value", 1)))
        for row in cdi_rows
    )
    cash_flows = sorted(
        (
            pd.Timestamp(purchase.trade_date or purchase.settlement_date),
            float(purchase.qty) * float(purchase.price),
        )
        for purchase in purchases
        if purchase.trade_date or purchase.settlement_date
    )
    if not rates or not cash_flows:
        return 0.0

    balance = 0.0
    cash_flow_index = 0
    # Cash flows start earning after the factor for their own date. This also
    # makes weekend purchases start on the next CDI observation.
    for rate_date, daily_rate in rates:
        balance *= 1 + (daily_rate / 100.0)
        while cash_flow_index < len(cash_flows) and cash_flows[cash_flow_index][0] <= rate_date:
            balance += cash_flows[cash_flow_index][1]
            cash_flow_index += 1

    while cash_flow_index < len(cash_flows):
        balance += cash_flows[cash_flow_index][1]
        cash_flow_index += 1

    invested = sum(value for _, value in cash_flows)
    return round(balance - invested, 2)

def _calculate_history_logic(
        user_id: str,
        wallets: WalletRepository,
        asset_type: Optional[str] = None,
        benchmark: str = 'CDI',
        ticker: Optional[str] = None,
        preloaded_purchases=None,
        preloaded_prices=None,
        preloaded_benchmark=None,
        preloaded_proventos=None,
        asset_type_by_ticker=None,
) -> List[Dict]:
    history_data = load_history_data(
        user_id,
        wallets,
        asset_type,
        benchmark,
        ticker,
        preloaded_purchases,
        preloaded_prices,
        preloaded_benchmark,
        preloaded_proventos,
        asset_type_by_ticker,
    )
    purchases = history_data.purchases
    if not purchases: return []

    purchases_data_frame = pd.DataFrame(purchases, columns=['ticker', 'qty', 'price', 'trade_date', 'type'])
    purchases_data_frame['trade_date'] = pd.to_datetime(purchases_data_frame['trade_date'])
    purchases_data_frame['price'] = purchases_data_frame['price'].astype(float)
    purchases_data_frame['cash_flow'] = purchases_data_frame['qty'] * purchases_data_frame['price']

    start_date = purchases_data_frame['trade_date'].min()
    unique_tickers = purchases_data_frame['ticker'].unique().tolist()

    prices_query = [
        row for row in history_data.prices
        if row.ticker in unique_tickers
    ]
    benchmark_query = history_data.benchmark
    proventos = history_data.proventos

    if not prices_query: return []

    prices_data_frame = pd.DataFrame(
        prices_query,
        columns=['ticker', 'trade_date', 'close', 'dividend_value'],
    )
    prices_data_frame['trade_date'] = pd.to_datetime(prices_data_frame['trade_date'])
    prices_data_frame['close'] = pd.to_numeric(prices_data_frame['close'])
    prices_data_frame['dividend_value'] = pd.to_numeric(prices_data_frame['dividend_value'], errors='coerce').fillna(0.0)

    price_matrix = prices_data_frame.pivot(index='trade_date', columns='ticker', values='close').resample('D').ffill()
    holdings_matrix = pd.DataFrame(0.0, index=price_matrix.index, columns=unique_tickers)
    daily_cash_flow = purchases_data_frame.groupby('trade_date')['cash_flow'].sum()

    for _, purchase_row in purchases_data_frame.iterrows():
        try:
            holdings_matrix.loc[purchase_row['trade_date']:, purchase_row['ticker']] += purchase_row['qty']
        except KeyError: pass

    common_date_index = price_matrix.index.intersection(holdings_matrix.index)
    price_matrix = price_matrix.loc[common_date_index]
    holdings_matrix = holdings_matrix.loc[common_date_index]
    daily_portfolio = (holdings_matrix * price_matrix).sum(axis=1)
    dividend_series = calculate_dividend_series(
        prices_data_frame,
        common_date_index,
        holdings_matrix,
        proventos,
        set(unique_tickers),
    )
    confirmed_dividends = dividend_series.confirmed
    estimated_dividends = dividend_series.estimated
    daily_dividends = dividend_series.total
    accumulated_dividends = daily_dividends.cumsum()
    confirmed_accumulated = confirmed_dividends.cumsum()
    estimated_accumulated = estimated_dividends.cumsum()

    aligned_cash_flow = daily_cash_flow.reindex(common_date_index, fill_value=0.0)
    benchmark_values = []
    if benchmark in {'IBOV', 'IFIX'}:
        benchmark_data_frame = pd.DataFrame(benchmark_query, columns=['trade_date', 'value'])
        if not benchmark_data_frame.empty:
            benchmark_data_frame['trade_date'] = pd.to_datetime(benchmark_data_frame['trade_date'])
            benchmark_data_frame.set_index('trade_date', inplace=True)
            prices = pd.to_numeric(benchmark_data_frame['value']).reindex(common_date_index).ffill()
            benchmark_factors = (prices / prices.shift(1)).fillna(1.0).values
        else:
            benchmark_factors = [1.0] * len(common_date_index)
    elif benchmark == 'SP500':
        benchmark_data_frame = pd.DataFrame(
            benchmark_query,
            columns=['ticker', 'trade_date', 'value', 'dividend_value'],
        )
        if not benchmark_data_frame.empty:
            benchmark_data_frame['trade_date'] = pd.to_datetime(benchmark_data_frame['trade_date'])
            benchmark_data_frame['value'] = pd.to_numeric(benchmark_data_frame['value'])
            prices = benchmark_data_frame.set_index('trade_date')['value'].sort_index()
            prices = prices.reindex(common_date_index).ffill()
            benchmark_factors = (prices / prices.shift(1)).fillna(1.0).values
        else:
            benchmark_factors = [1.0] * len(common_date_index)
    else:
        benchmark_factors = _build_cdi_factors(benchmark_query, common_date_index)

    current_benchmark_value = 0.0
    cash_flow_values = aligned_cash_flow.values
    limit = min(len(common_date_index), len(cash_flow_values), len(benchmark_factors))
    for date_index in range(limit):
        current_benchmark_value = (current_benchmark_value * benchmark_factors[date_index]) + cash_flow_values[date_index]
        benchmark_values.append(current_benchmark_value)

    return [{
        "trade_date": common_date_index[i].strftime("%Y-%m-%d"),
        "portfolio_value": round(float(daily_portfolio.iloc[i]), 2),
        "dividends_value": round(float(daily_dividends.iloc[i]), 2),
        "dividends_accumulated": round(float(accumulated_dividends.iloc[i]), 2),
        "dividends_confirmed": round(float(confirmed_dividends.iloc[i]), 2),
        "dividends_confirmed_accumulated": round(float(confirmed_accumulated.iloc[i]), 2),
        "dividends_estimated": round(float(estimated_dividends.iloc[i]), 2),
        "dividends_estimated_accumulated": round(float(estimated_accumulated.iloc[i]), 2),
        "benchmark_value": round(float(benchmark_values[i]), 2),
    } for i in range(limit)]

# Função auxiliar para calcular rentabilidade anual do ativo (ano fechado)
def _get_yearly_prices(
        wallets: WalletRepository,
        tickers: List[str],
        start_year: int,
) -> Dict[str, Dict[int, float]]:
    rows = wallets.get_prices_from_previous_year(tickers, start_year)

    # Processa para pegar apenas a ÚLTIMA data de cada ano para cada ticker
    # map: ticker -> { 2021: 15.50, 2022: 18.20 }
    yearly_closes = {}

    for price_record in rows:
        ticker = price_record.ticker
        if not price_record.adjusted_close: continue

        if price_record.trade_date.month != 12 or price_record.trade_date.day <= 20:
            continue

        year = price_record.trade_date.year
        adjusted_close = float(price_record.adjusted_close)

        if ticker not in yearly_closes: yearly_closes[ticker] = {}
        # Como ordenamos ASC, o último valor sobrescreve os anteriores, ficando o último de Dezembro
        yearly_closes[ticker][year] = adjusted_close

    return yearly_closes

# ==========================================
#  DASHBOARD COMPLETO (RAW + ADJUSTED)
# ==========================================

@wallet_bp.get("/dashboard")
def get_dashboard_data(
        wallets: WalletRepository = Depends(get_wallet_repository),
        current_user: str = Depends(get_current_user)
):
    # 1. Buscar todas as compras e proventos recebidos
    purchases = wallets.list_purchases(current_user)
    proventos = wallets.list_proventos(current_user)

    # Estrutura vazia
    empty_response = {
        "summary": {"total_invested": 0, "total_current": 0, "total_profit": 0, "total_profit_percent": 0},
        "period_projections": {k: _calculate_period_stats(0, 0, None) for k in ["total", "stock", "fii", "etf"]},
        "positions": [], "history": [], "transactions": [],
        "allocation": {"stock": 0, "fii": 0, "etf": 0},
        "invested_by_type": {"stock": 0, "fii": 0, "etf": 0},
        "cdb_return": 0,
        "cdb_return_by_type": {"stock": 0, "fii": 0, "etf": 0},
    }

    if not purchases:
        return empty_response

    dividend_by_purchase = calculate_purchase_dividends(purchases, proventos)
    dividends_by_ticker = {}
    for purchase, dividend_value in zip(purchases, dividend_by_purchase):
        dividends_by_ticker[purchase.ticker] = (
            dividends_by_ticker.get(purchase.ticker, 0.0) + dividend_value
        )

    # Identificar Data Inicial Global da Carteira para buscar histórico anual
    effective_dates = [purchase.trade_date or purchase.settlement_date for purchase in purchases]
    min_trade_date = min(d for d in effective_dates if d is not None)
    start_year_portfolio = min_trade_date.year if isinstance(min_trade_date, date) else min_trade_date.year

    # 2. Buscar Histórico de Preços Ajustados (Para cálculo de Total Return da posição)
    purchase_keys = list({
        (purchase.ticker, purchase.trade_date or purchase.settlement_date)
        for purchase in purchases
        if purchase.trade_date or purchase.settlement_date
    })
    history_map = {}

    if purchase_keys:
        try:
            hist_rows = wallets.get_adjusted_prices_for_purchases(purchase_keys)

            for r in hist_rows:
                key = f"{r.ticker}_{r.trade_date}"
                history_map[key] = float(r.adjusted_close) if r.adjusted_close else None
        except Exception as e:
            print(f"⚠️ Erro ao buscar histórico ajustado: {e}")

    # 3. Consolidar Posições
    positions_by_ticker = {}
    transactions_list = []

    for purchase_index, purchase in enumerate(purchases):
        purchase_date = purchase.trade_date or purchase.settlement_date
        # Adiciona à lista de transações
        transactions_list.append({
            "ticker": purchase.ticker, "price": float(purchase.price), "qty": purchase.qty,
            "trade_date": purchase_date, "type": "buy", "asset_type": purchase.type,
            "dividend_value": round(dividend_by_purchase[purchase_index], 2),
        })

        raw_purchase_price = float(purchase.price)
        history_key = f"{purchase.ticker}_{purchase_date}"
        adjusted_purchase_price = history_map.get(history_key, raw_purchase_price)
        if not adjusted_purchase_price or adjusted_purchase_price <= 0:
            adjusted_purchase_price = raw_purchase_price

        if purchase.ticker not in positions_by_ticker:
            positions_by_ticker[purchase.ticker] = {
                'qty': 0.0,
                'cost_raw': 0.0,
                'cost_adjusted': 0.0,
                'type': purchase.type,
                'min_date': purchase_date
            }

        position = positions_by_ticker[purchase.ticker]
        position['qty'] += purchase.qty
        position['cost_raw'] += (purchase.qty * raw_purchase_price)
        position['cost_adjusted'] += (purchase.qty * adjusted_purchase_price)
        if purchase_date and purchase_date < position['min_date']:
            position['min_date'] = purchase_date

    active_tickers = [
        ticker for ticker, position in positions_by_ticker.items()
        if position['qty'] > 0.0001
    ]

    if not active_tickers:
        return empty_response

    history_start_date = min(
        purchase.trade_date or purchase.settlement_date
        for purchase in purchases
        if purchase.trade_date or purchase.settlement_date
    )
    history_purchases = (
        wallets.get_history_purchases(current_user)
        if hasattr(wallets, 'get_history_purchases')
        else purchases
    )
    if hasattr(wallets, 'get_prices_from'):
        history_prices = wallets.get_prices_from(active_tickers, history_start_date)
        history_benchmarks = {
            "CDI": wallets.get_cdi_from(history_start_date),
            "IBOV": wallets.get_ibov_from(history_start_date),
            "IFIX": wallets.get_ifix_from(history_start_date),
            "SP500": wallets.get_prices_from(["^GSPC"], history_start_date),
        }
    else:
        history_prices = []
        history_benchmarks = {key: [] for key in ("CDI", "IBOV", "IFIX", "SP500")}

    resolved_ex_dates = resolve_provento_ex_dates(proventos, history_prices)
    if resolved_ex_dates and hasattr(wallets, 'save_proventos'):
        wallets.save_proventos(proventos)

    dividend_by_purchase = calculate_purchase_dividends(purchases, proventos)
    for purchase_index, transaction in enumerate(transactions_list):
        transaction["dividend_value"] = round(dividend_by_purchase[purchase_index], 2)

    # 4. Buscar Preços Atuais (Raw e Adjusted)
    latest_prices = wallets.get_latest_prices(active_tickers)

    raw_price_by_ticker = {}
    adjusted_price_by_ticker = {}
    name_map = {}

    for row in latest_prices:
        if row.ticker not in raw_price_by_ticker:
            raw_value = float(row.close)
            adjusted_value = (
                float(row.adjusted_close)
                if row.adjusted_close and row.adjusted_close > 0
                else raw_value
            )
            raw_price_by_ticker[row.ticker] = raw_value
            adjusted_price_by_ticker[row.ticker] = adjusted_value
            name_map[row.ticker] = row.name

    for transaction, purchase in zip(transactions_list, purchases):
        current_price = raw_price_by_ticker.get(purchase.ticker)
        valuation = (
            (current_price - float(purchase.price)) * float(purchase.qty)
            if current_price is not None
            else None
        )
        transaction["valuation_value"] = round(valuation, 2) if valuation is not None else None
        transaction["total_return_value"] = (
            round(valuation + transaction["dividend_value"], 2)
            if valuation is not None
            else None
        )

    # 4.1 Buscar Classificações
    classification_map = {}
    try:
        cls_rows = wallets.get_classifications(active_tickers)
        for r in cls_rows:
            classification_map[r.ticker] = {"subtype": r.detected_type, "sector": r.sector}
    except Exception: pass

    for transaction in transactions_list:
        classification = classification_map.get(transaction["ticker"], {})
        transaction["asset_type"] = _resolve_asset_type(
            transaction.get("asset_type", "stock"), classification
        )

    # --- NOVO: BUSCAR PREÇOS ANUAIS (FECHAMENTO DE DEZEMBRO) PARA TOOLTIP ---
    # Busca desde o ano anterior ao início da carteira (para calcular a variação do primeiro ano)
    yearly_closes_map = _get_yearly_prices(wallets, active_tickers, start_year_portfolio)
    current_year = datetime.now().year

    # 5. Montar Lista Final e Totais
    positions_list = []

    total_invested_global = 0.0
    total_current_global = 0.0
    allocation_by_type = {"stock": 0.0, "fii": 0.0, "etf": 0.0}

    statistics_by_asset_type = {
        asset_type: {'invested': 0.0, 'current': 0.0, 'start_date': None}
        for asset_type in ['stock', 'fii', 'etf']
    }

    for ticker in active_tickers:
        position_data = positions_by_ticker[ticker]
        quantity = position_data['qty']

        current_raw_price = raw_price_by_ticker.get(ticker)
        current_adjusted_price = adjusted_price_by_ticker.get(ticker)

        average_raw_price = position_data['cost_raw'] / quantity
        total_raw_value = quantity * current_raw_price if current_raw_price is not None else None
        raw_profit = total_raw_value - position_data['cost_raw'] if total_raw_value is not None else None
        raw_profit_percentage = (
            (raw_profit / position_data['cost_raw'] * 100)
            if raw_profit is not None and position_data['cost_raw'] > 0
            else None
        )

        dividends_total = dividends_by_ticker.get(ticker, 0.0)
        total_return_profit_sql = (
            raw_profit + dividends_total if raw_profit is not None else None
        )
        total_return_pct_sql = (
            (total_return_profit_sql / position_data['cost_raw'] * 100)
            if total_return_profit_sql is not None and position_data['cost_raw'] > 0
            else None
        )

        average_adjusted_price = position_data['cost_adjusted'] / quantity
        theoretical_adjusted_value = (
            quantity * current_adjusted_price
            if current_adjusted_price is not None
            else None
        )
        adjusted_profit = (
            theoretical_adjusted_value - position_data['cost_adjusted']
            if theoretical_adjusted_value is not None
            else None
        )
        adjusted_profit_percentage = (
            (adjusted_profit / position_data['cost_adjusted'] * 100)
            if adjusted_profit is not None and position_data['cost_adjusted'] > 0
            else None
        )

        total_invested_global += position_data['cost_raw']
        if total_raw_value is not None:
            total_current_global += total_raw_value

        resolved_asset_type = _resolve_asset_type(
            position_data['type'], classification_map.get(ticker, {})
        )
        if total_raw_value is not None:
            allocation_by_type[resolved_asset_type] = allocation_by_type.get(resolved_asset_type, 0) + total_raw_value

        if resolved_asset_type in statistics_by_asset_type:
            statistics_by_asset_type[resolved_asset_type]['invested'] += position_data['cost_raw']
            if total_raw_value is not None:
                statistics_by_asset_type[resolved_asset_type]['current'] += total_raw_value
            if not statistics_by_asset_type[resolved_asset_type]['start_date'] or position_data['min_date'] < statistics_by_asset_type[resolved_asset_type]['start_date']:
                statistics_by_asset_type[resolved_asset_type]['start_date'] = position_data['min_date']

        # --- CALCULA BREAKDOWN ANUAL DO ATIVO ---
        yearly_breakdown = []
        ticker_yearly_closes = yearly_closes_map.get(ticker, {})

        # Se temos dados anuais, calculamos a performance ano a ano
        # Começamos do ano de início da carteira até o ano atual
        # O "Start Date" do cálculo de um ano é o fechamento do ano anterior.

        # Considerar preço atual como fechamento do ano corrente (YTD)
        # Adiciona o ano corrente no mapa temporariamente para o calculo
        if current_adjusted_price is not None:
            ticker_yearly_closes[current_year] = current_adjusted_price

        sorted_years = sorted(ticker_yearly_closes.keys())

        for year_index in range(1, len(sorted_years)):
            previous_year = sorted_years[year_index - 1]
            current_loop_year = sorted_years[year_index]

            # Só calculamos se o ano estiver dentro do horizonte da carteira (ou 1 antes pra base)
            if current_loop_year < start_year_portfolio:
                continue

            starting_value = ticker_yearly_closes[previous_year]
            ending_value = ticker_yearly_closes[current_loop_year]

            if starting_value > 0:
                yearly_performance = ((ending_value - starting_value) / starting_value) * 100
                yearly_breakdown.append({
                    "year": current_loop_year,
                    "value": round(yearly_performance, 2),
                    "start_price": starting_value,
                    "end_price": ending_value
                })

        classification = classification_map.get(ticker, {})

        positions_list.append({
            "ticker": ticker,
            "name": name_map.get(ticker, ticker),
            "type": resolved_asset_type,
            "subtype": classification.get("subtype", "Indefinido"),
            "sector": classification.get("sector", "Outros"),
            "qty": round(quantity, 4),
            "age": _format_asset_age(position_data['min_date']),

            "avg_price": round(average_raw_price, 2),
            "avg_price_adjusted": round(average_adjusted_price, 2),
            "current_price": round(current_raw_price, 2) if current_raw_price is not None else None,
            "current_adjusted": (
                round(current_adjusted_price, 2)
                if current_adjusted_price is not None
                else None
            ),

            "total_value": round(total_raw_value, 2) if total_raw_value is not None else None,

            # Rentabilidade total: valorização da posição + proventos registrados no SQL.
            "profit": round(total_return_profit_sql, 2) if total_return_profit_sql is not None else None,
            "profit_percent": round(total_return_pct_sql, 2) if total_return_pct_sql is not None else None,

            "total_return_profit": round(total_return_profit_sql, 2) if total_return_profit_sql is not None else None,
            "total_return_percent": round(total_return_pct_sql, 2) if total_return_pct_sql is not None else None,

            # INSERE OS DADOS REAIS
            "yearly_breakdown": yearly_breakdown,

            "allocation_percent": 0
        })

    # 6. Finalização
    positions_list.sort(key=lambda x: x['total_value'] or 0, reverse=True)

    for position in positions_list:
        if total_current_global > 0:
            position['allocation_percent'] = round(
                ((position['total_value'] or 0) / total_current_global) * 100,
                2,
            )

    valuation_profit_global = total_current_global - total_invested_global

    start_date_global = min(
        position['min_date'] for position in positions_by_ticker.values()
    ) if positions_by_ticker else None

    resolved_type_by_ticker = {
        ticker: _resolve_asset_type(position['type'], classification_map.get(ticker, {}))
        for ticker, position in positions_by_ticker.items()
    }

    history_by_type = {
        "stock": _calculate_history_logic(
            current_user, wallets, "stock", "IBOV", preloaded_prices=history_prices,
            preloaded_purchases=history_purchases,
            preloaded_benchmark=history_benchmarks["IBOV"],
            preloaded_proventos=proventos,
            asset_type_by_ticker=resolved_type_by_ticker,
        ),
        "fii": _calculate_history_logic(
            current_user, wallets, "fii", "IFIX", preloaded_prices=history_prices,
            preloaded_purchases=history_purchases,
            preloaded_benchmark=history_benchmarks["IFIX"],
            preloaded_proventos=proventos,
            asset_type_by_ticker=resolved_type_by_ticker,
        ),
        "etf": _calculate_history_logic(
            current_user, wallets, "etf", "SP500", preloaded_prices=history_prices,
            preloaded_purchases=history_purchases,
            preloaded_benchmark=history_benchmarks["SP500"],
            preloaded_proventos=proventos,
            asset_type_by_ticker=resolved_type_by_ticker,
        ),
    }
    history_total = _calculate_history_logic(
        current_user,
        wallets,
        preloaded_purchases=history_purchases,
        preloaded_prices=history_prices,
        preloaded_benchmark=history_benchmarks["CDI"],
        preloaded_proventos=proventos,
    )

    dividends_global = (
        history_total[-1].get("dividends_accumulated", 0.0)
        if history_total else 0.0
    )
    dividends_by_type = {
        asset_type: (
            history[-1].get("dividends_accumulated", 0.0)
            if history else 0.0
        )
        for asset_type, history in history_by_type.items()
    }

    total_profit_global = valuation_profit_global + dividends_global
    total_profit_pct_global = (total_profit_global / total_invested_global * 100) if total_invested_global > 0 else 0
    cdb_benchmark_value = (
        float(history_total[-1].get("benchmark_value", 0.0))
        if history_total
        else 0.0
    )
    cdb_return_global = round(cdb_benchmark_value - total_invested_global, 2)
    if cdb_return_global <= 0:
        cdb_return_global = _calculate_cdb_return(purchases, history_benchmarks["CDI"])
    cdb_return_by_type = {
        asset_type: _calculate_cdb_return(
            [
                purchase
                for purchase in purchases
                if resolved_type_by_ticker.get(purchase.ticker, purchase.type) == asset_type
            ],
            history_benchmarks["CDI"],
        )
        for asset_type in ("stock", "fii", "etf")
    }

    projections = {
        "total": _calculate_period_stats(
            total_profit_global,
            total_profit_pct_global,
            start_date_global,
            dividends_global,
        )
    }

    for asset_type, asset_type_statistics in statistics_by_asset_type.items():
        asset_type_valuation = (
            asset_type_statistics['current'] - asset_type_statistics['invested']
        )
        asset_type_profit = asset_type_valuation + dividends_by_type.get(asset_type, 0.0)
        asset_type_yield = (
            asset_type_profit / asset_type_statistics['invested'] * 100
            if asset_type_statistics['invested'] > 0
            else 0
        )
        projections[asset_type] = _calculate_period_stats(
            asset_type_profit,
            asset_type_yield,
            asset_type_statistics['start_date'],
            dividends_by_type.get(asset_type, 0.0),
        )

    benchmark_by_type = {"stock": "IBOV", "fii": "IFIX", "etf": "SP500"}
    history_by_ticker = {
        ticker: _calculate_history_logic(
            current_user,
            wallets,
            position["type"],
            benchmark_by_type.get(position["type"], "CDI"),
            ticker,
            preloaded_purchases=history_purchases,
            preloaded_prices=history_prices,
            preloaded_benchmark=history_benchmarks.get(
                benchmark_by_type.get(position["type"], "CDI"),
                history_benchmarks["CDI"],
            ),
            preloaded_proventos=proventos,
        )
        for ticker, position in positions_by_ticker.items()
    }

    return {
        "summary": {
            "total_invested": round(total_invested_global, 2),
            "total_current": round(total_current_global, 2),
            "total_profit": round(total_profit_global, 2),
            "total_profit_percent": round(total_profit_pct_global, 2)
        },
        "period_projections": projections,
        "positions": positions_list,
        "history": history_total,
        "history_by_type": history_by_type,
        "history_by_ticker": history_by_ticker,
        "transactions": transactions_list,
        "allocation": {k: round(v, 2) for k, v in allocation_by_type.items()},
        "invested_by_type": {
            asset_type: round(statistics['invested'], 2)
            for asset_type, statistics in statistics_by_asset_type.items()
        },
        "cdb_return": cdb_return_global,
        "cdb_return_by_type": cdb_return_by_type,
    }

# --- OUTROS ENDPOINTS (CRUD) PERMANECEM IGUAIS ---
@wallet_bp.get("/performance/history", response_model=List[HistoryPoint])
def get_wallet_history(
        wallets: WalletRepository = Depends(get_wallet_repository),
        current_user: str = Depends(get_current_user)
):
    return _calculate_history_logic(current_user, wallets)

@wallet_bp.post("/import")
def import_purchases(
        payload: ImportPurchasesRequest,
        wallets: WalletRepository = Depends(get_wallet_repository),
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
                trade_date=item.trade_date,
                settlement_date=item.settlement_date,
            )
            new_records.append(record)
        wallets.add_purchases(new_records)
        return {"success": True, "count": len(new_records), "message": "Import successful"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@wallet_bp.get("/purchases", response_model=List[AssetPurchaseResponse])
def get_user_purchases(
        wallets: WalletRepository = Depends(get_wallet_repository),
        current_user: str = Depends(get_current_user)
):
    return wallets.list_purchases(current_user)


@wallet_bp.get("/proventos", response_model=List[ProventoResponse])
def get_user_proventos(
        wallets: WalletRepository = Depends(get_wallet_repository),
        current_user: str = Depends(get_current_user),
):
    return wallets.list_proventos(current_user)


@wallet_bp.post("/purchases/sync-b3")
def sync_b3_purchases(
        payload: SyncB3PurchasesRequest,
        wallets: WalletRepository = Depends(get_wallet_repository),
        current_user: str = Depends(get_current_user)
):
    """Persist B3 trades while keeping trade and settlement dates distinct.

    Existing rows from before settlement_date was introduced have that field
    backfilled from their old date. When such a row matches a B3 trade by
    settlement date, this endpoint repairs its trade_date in place.
    """
    existing = list(wallets.list_purchases(current_user))
    matched_existing: set[int] = set()
    new_purchases = []
    created_count = 0
    reconciled_count = 0
    skipped_count = 0

    for item in payload.purchases:
        ticker = item.ticker.strip().upper()
        if re.fullmatch(r"[A-Z]{4}\d{1,2}F", ticker):
            ticker = ticker[:-1]
        match_index = None
        legacy_index = None

        for index, purchase in enumerate(existing):
            if index in matched_existing:
                continue
            if purchase.ticker.upper() != ticker:
                continue
            if abs(float(purchase.qty) - item.qty) > 0.0001:
                continue
            if abs(float(purchase.price) - item.price) > 0.01:
                continue

            if (purchase.trade_date == item.trade_date
                    and purchase.settlement_date == item.settlement_date):
                match_index = index
                break

            if (purchase.trade_date is None
                    and purchase.settlement_date == item.settlement_date):
                legacy_index = index

        if match_index is not None:
            matched_existing.add(match_index)
            skipped_count += 1
            continue

        if legacy_index is not None:
            purchase = existing[legacy_index]
            purchase.trade_date = item.trade_date
            purchase.settlement_date = item.settlement_date
            purchase.name = item.name or purchase.name or ticker
            purchase.type = item.type.lower()
            wallets.save_purchase(purchase)
            matched_existing.add(legacy_index)
            reconciled_count += 1
            continue

        new_purchases.append(AssetPurchase(
            user_id=current_user,
            ticker=ticker,
            name=item.name or ticker,
            type=item.type.lower(),
            qty=item.qty,
            price=item.price,
            trade_date=item.trade_date,
            settlement_date=item.settlement_date,
        ))
        created_count += 1

    wallets.add_purchases(new_purchases)
    return {
        "created": created_count,
        "reconciled": reconciled_count,
        "skipped": skipped_count,
        "total": len(payload.purchases),
    }


@wallet_bp.post("/purchases/reconcile-trade-dates")
def reconcile_trade_dates(
        payload: ReconcileTradeDatesRequest,
        wallets: WalletRepository = Depends(get_wallet_repository),
        current_user: str = Depends(get_current_user)
):
    """Load captured B3 purchases without duplicating existing records.

    Existing rows with a missing trade date are completed in place. Captures
    with no matching SQL row are inserted with the trade date and any known
    settlement date. Existing settlement dates are never overwritten.
    """
    existing = list(wallets.list_purchases(current_user))
    used_ids: set[int] = set()
    updated_count = 0
    created_count = 0
    already_complete_count = 0
    unmatched_count = 0
    ambiguous_count = 0
    updated_purchases = []
    new_purchases = []

    for item in payload.purchases:
        ticker = item.ticker.strip().upper()
        if re.fullmatch(r"[A-Z]{4}\d{1,2}F", ticker):
            ticker = ticker[:-1]

        candidates = []
        for purchase in existing:
            if purchase.id in used_ids:
                continue
            if purchase.ticker.upper() != ticker:
                continue
            if abs(float(purchase.qty) - item.qty) > 0.0001:
                continue
            if abs(float(purchase.price) - item.price) > 0.01:
                continue

            trade_date_matches = (
                purchase.trade_date is not None
                and purchase.trade_date == item.trade_date
            )
            settlement_date_matches = (
                purchase.settlement_date is not None
                and item.settlement_date is not None
                and purchase.settlement_date == item.settlement_date
            )
            both_dates_missing = (
                purchase.trade_date is None
                and purchase.settlement_date is None
            )
            if trade_date_matches or settlement_date_matches or both_dates_missing:
                candidates.append(purchase)

        if not candidates:
            new_purchases.append(AssetPurchase(
                user_id=current_user,
                ticker=ticker,
                name=item.name or ticker,
                type=item.type.lower(),
                qty=item.qty,
                price=item.price,
                trade_date=item.trade_date,
                settlement_date=item.settlement_date,
            ))
            created_count += 1
            continue

        if len(candidates) != 1:
            ambiguous_count += 1
            continue

        purchase = candidates[0]
        changed = False
        if purchase.trade_date is None:
            purchase.trade_date = item.trade_date
            changed = True
        if purchase.settlement_date is None and item.settlement_date is not None:
            purchase.settlement_date = item.settlement_date
            changed = True

        if not changed:
            already_complete_count += 1
            continue

        used_ids.add(purchase.id)
        updated_purchases.append(purchase)
        updated_count += 1

    wallets.save_purchases(updated_purchases)
    wallets.add_purchases(new_purchases)

    return {
        "updated": updated_count,
        "created": created_count,
        "already_complete": already_complete_count,
        "unmatched": unmatched_count,
        "ambiguous": ambiguous_count,
        "total": len(payload.purchases),
    }

@wallet_bp.post("/purchases", response_model=AssetPurchaseResponse, status_code=status.HTTP_201_CREATED)
def create_purchase(
        payload: AssetPurchaseInput,
        wallets: WalletRepository = Depends(get_wallet_repository),
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
            trade_date=payload.trade_date,
            settlement_date=payload.settlement_date,
        )
        return wallets.save_purchase(new_purchase)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@wallet_bp.put("/purchases/{purchase_id}", response_model=AssetPurchaseResponse)
def update_purchase(
        purchase_id: int,
        payload: AssetPurchaseInput,
        wallets: WalletRepository = Depends(get_wallet_repository),
        current_user: str = Depends(get_current_user)
):
    purchase = wallets.get_purchase(purchase_id)
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
        purchase.settlement_date = payload.settlement_date
        return wallets.save_purchase(purchase)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@wallet_bp.delete("/purchases/{purchase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase(
        purchase_id: int,
        wallets: WalletRepository = Depends(get_wallet_repository),
        current_user: str = Depends(get_current_user)
):
    purchase = wallets.get_purchase(purchase_id)
    if not purchase:
        raise HTTPException(status_code=404, detail="Aporte não encontrado")
    if purchase.user_id != current_user:
        raise HTTPException(status_code=403, detail="Não autorizado a deletar este registro")
    try:
        wallets.delete_purchase(purchase)
        return None
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
