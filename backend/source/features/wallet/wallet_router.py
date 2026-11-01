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
        yield_pct: float,
        start_date: Optional[date],
        dividends: float = 0.0,
) -> Dict:
    valuation = profit - dividends
    if not start_date:
        return {
            "total": {"profit": profit, "yield": yield_pct, "valuation": valuation, "dividends": dividends},
            "day": {"profit": 0, "yield": 0, "valuation": 0, "dividends": 0},
            "month": {"profit": 0, "yield": 0, "valuation": 0, "dividends": 0},
            "year": {"profit": 0, "yield": 0, "valuation": 0, "dividends": 0}
        }

    today = datetime.now().date()
    if isinstance(start_date, datetime):
        start_date = start_date.date()

    diff_days = (today - start_date).days
    days = max(1, diff_days)

    avg_day_profit = profit / days
    avg_day_yield = yield_pct / days
    avg_day_dividends = dividends / days
    avg_day_valuation = valuation / days

    return {
        "total": {
            "profit": round(profit, 2),
            "yield": round(yield_pct, 2),
            "valuation": round(valuation, 2),
            "dividends": round(dividends, 2),
        },
        "day": {
            "profit": round(avg_day_profit, 2),
            "yield": round(avg_day_yield, 4),
            "valuation": round(avg_day_valuation, 2),
            "dividends": round(avg_day_dividends, 2),
        },
        "month": {
            "profit": round(avg_day_profit * 30, 2),
            "yield": round(avg_day_yield * 30, 2),
            "valuation": round(avg_day_valuation * 30, 2),
            "dividends": round(avg_day_dividends * 30, 2),
        },
        "year": {
            "profit": round(avg_day_profit * 365, 2),
            "yield": round(avg_day_yield * 365, 2),
            "valuation": round(avg_day_valuation * 365, 2),
            "dividends": round(avg_day_dividends * 365, 2),
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


def _build_cdi_factors(benchmark_query, common_idx):
    """Build CDI factors without applying a business-day rate on calendar gaps."""
    factors = pd.Series(1.0, index=common_idx, dtype=float)
    df_cdi = pd.DataFrame(benchmark_query, columns=['trade_date', 'value'])

    if df_cdi.empty:
        return factors.values

    df_cdi['trade_date'] = pd.to_datetime(df_cdi['trade_date'])
    df_cdi.set_index('trade_date', inplace=True)
    df_cdi.sort_index(inplace=True)

    observed_cdi = pd.to_numeric(df_cdi['value']).reindex(common_idx)
    observed_dates = observed_cdi.notna()
    factors.loc[observed_dates] = 1 + (observed_cdi.loc[observed_dates] / 100.0)
    return factors.values

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
    )
    purchases = history_data.purchases
    if not purchases: return []

    df_purchases = pd.DataFrame(purchases, columns=['ticker', 'qty', 'price', 'trade_date', 'type'])
    df_purchases['trade_date'] = pd.to_datetime(df_purchases['trade_date'])
    df_purchases['price'] = df_purchases['price'].astype(float)
    df_purchases['cash_flow'] = df_purchases['qty'] * df_purchases['price']

    start_date = df_purchases['trade_date'].min()
    unique_tickers = df_purchases['ticker'].unique().tolist()

    prices_query = [
        row for row in history_data.prices
        if row.ticker in unique_tickers
    ]
    benchmark_query = history_data.benchmark
    proventos = history_data.proventos

    if not prices_query: return []

    df_prices = pd.DataFrame(
        prices_query,
        columns=['ticker', 'trade_date', 'close', 'dividend_value'],
    )
    df_prices['trade_date'] = pd.to_datetime(df_prices['trade_date'])
    df_prices['close'] = pd.to_numeric(df_prices['close'])
    df_prices['dividend_value'] = pd.to_numeric(df_prices['dividend_value'], errors='coerce').fillna(0.0)

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
    dividend_series = calculate_dividend_series(
        df_prices,
        common_idx,
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

    aligned_cash_flow = daily_cash_flow.reindex(common_idx, fill_value=0.0)
    benchmark_values = []
    if benchmark in {'IBOV', 'IFIX'}:
        df_benchmark = pd.DataFrame(benchmark_query, columns=['trade_date', 'value'])
        if not df_benchmark.empty:
            df_benchmark['trade_date'] = pd.to_datetime(df_benchmark['trade_date'])
            df_benchmark.set_index('trade_date', inplace=True)
            prices = pd.to_numeric(df_benchmark['value']).reindex(common_idx).ffill()
            benchmark_factors = (prices / prices.shift(1)).fillna(1.0).values
        else:
            benchmark_factors = [1.0] * len(common_idx)
    elif benchmark == 'SP500':
        df_benchmark = pd.DataFrame(
            benchmark_query,
            columns=['ticker', 'trade_date', 'value', 'dividend_value'],
        )
        if not df_benchmark.empty:
            df_benchmark['trade_date'] = pd.to_datetime(df_benchmark['trade_date'])
            df_benchmark['value'] = pd.to_numeric(df_benchmark['value'])
            prices = df_benchmark.set_index('trade_date')['value'].sort_index()
            prices = prices.reindex(common_idx).ffill()
            benchmark_factors = (prices / prices.shift(1)).fillna(1.0).values
        else:
            benchmark_factors = [1.0] * len(common_idx)
    else:
        benchmark_factors = _build_cdi_factors(benchmark_query, common_idx)

    curr_bench = 0.0
    cash_flows_vals = aligned_cash_flow.values
    limit = min(len(common_idx), len(cash_flows_vals), len(benchmark_factors))
    for i in range(limit):
        curr_bench = (curr_bench * benchmark_factors[i]) + cash_flows_vals[i]
        benchmark_values.append(curr_bench)

    return [{
        "trade_date": common_idx[i].strftime("%Y-%m-%d"),
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

    for r in rows:
        tck = r.ticker
        if not r.adjusted_close: continue

        if r.trade_date.month != 12 or r.trade_date.day <= 20:
            continue

        y = r.trade_date.year
        val = float(r.adjusted_close)

        if tck not in yearly_closes: yearly_closes[tck] = {}
        # Como ordenamos ASC, o último valor sobrescreve os anteriores, ficando o último de Dezembro
        yearly_closes[tck][y] = val

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
    }

    if not purchases:
        return empty_response

    dividend_by_purchase = calculate_purchase_dividends(purchases, proventos)

    # Identificar Data Inicial Global da Carteira para buscar histórico anual
    effective_dates = [p.trade_date or p.settlement_date for p in purchases]
    min_trade_date = min(d for d in effective_dates if d is not None)
    start_year_portfolio = min_trade_date.year if isinstance(min_trade_date, date) else min_trade_date.year

    # 2. Buscar Histórico de Preços Ajustados (Para cálculo de Total Return da posição)
    purchase_keys = list({
        (p.ticker, p.trade_date or p.settlement_date)
        for p in purchases
        if p.trade_date or p.settlement_date
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
    pos_map = {}
    transactions_list = []

    for purchase_index, p in enumerate(purchases):
        purchase_date = p.trade_date or p.settlement_date
        # Adiciona à lista de transações
        transactions_list.append({
            "ticker": p.ticker, "price": float(p.price), "qty": p.qty,
            "trade_date": purchase_date, "type": "buy", "asset_type": p.type,
            "dividend_value": round(dividend_by_purchase[purchase_index], 2),
        })

        price_raw = float(p.price)
        hist_key = f"{p.ticker}_{purchase_date}"
        price_adj = history_map.get(hist_key, price_raw)
        if not price_adj or price_adj <= 0: price_adj = price_raw

        if p.ticker not in pos_map:
            pos_map[p.ticker] = {
                'qty': 0.0,
                'cost_raw': 0.0,
                'cost_adjusted': 0.0,
                'type': p.type,
                'min_date': purchase_date
            }

        pos = pos_map[p.ticker]
        pos['qty'] += p.qty
        pos['cost_raw'] += (p.qty * price_raw)
        pos['cost_adjusted'] += (p.qty * price_adj)
        if purchase_date and purchase_date < pos['min_date']:
            pos['min_date'] = purchase_date

    active_tickers = [t for t, d in pos_map.items() if d['qty'] > 0.0001]

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

    price_map_raw = {}
    price_map_adj = {}
    name_map = {}

    for row in latest_prices:
        if row.ticker not in price_map_raw:
            raw_val = float(row.close)
            adj_val = float(row.adjusted_close) if row.adjusted_close and row.adjusted_close > 0 else raw_val
            price_map_raw[row.ticker] = raw_val
            price_map_adj[row.ticker] = adj_val
            name_map[row.ticker] = row.name

    for transaction, purchase in zip(transactions_list, purchases):
        current_price = price_map_raw.get(purchase.ticker)
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

    # --- NOVO: BUSCAR PREÇOS ANUAIS (FECHAMENTO DE DEZEMBRO) PARA TOOLTIP ---
    # Busca desde o ano anterior ao início da carteira (para calcular a variação do primeiro ano)
    yearly_closes_map = _get_yearly_prices(wallets, active_tickers, start_year_portfolio)
    current_year = datetime.now().year

    # 5. Montar Lista Final e Totais
    positions_list = []

    total_invested_global = 0.0
    total_current_global = 0.0
    allocation_by_type = {"stock": 0.0, "fii": 0.0, "etf": 0.0}

    cat_stats = {k: {'invested': 0.0, 'current': 0.0, 'start_date': None} for k in ['stock', 'fii', 'etf']}

    for ticker in active_tickers:
        data = pos_map[ticker]
        qty = data['qty']

        curr_price_raw = price_map_raw.get(ticker)
        curr_price_adj = price_map_adj.get(ticker)

        pm_raw = data['cost_raw'] / qty
        val_total_raw = qty * curr_price_raw if curr_price_raw is not None else None
        profit_raw = val_total_raw - data['cost_raw'] if val_total_raw is not None else None
        profit_pct_raw = (
            (profit_raw / data['cost_raw'] * 100)
            if profit_raw is not None and data['cost_raw'] > 0
            else None
        )

        pm_adj = data['cost_adjusted'] / qty
        val_total_adj_theoretical = qty * curr_price_adj if curr_price_adj is not None else None
        profit_adj = (
            val_total_adj_theoretical - data['cost_adjusted']
            if val_total_adj_theoretical is not None
            else None
        )
        profit_pct_adj = (
            (profit_adj / data['cost_adjusted'] * 100)
            if profit_adj is not None and data['cost_adjusted'] > 0
            else None
        )

        total_invested_global += data['cost_raw']
        if val_total_raw is not None:
            total_current_global += val_total_raw

        atype = data['type']
        if val_total_raw is not None:
            allocation_by_type[atype] = allocation_by_type.get(atype, 0) + val_total_raw

        if atype in cat_stats:
            cat_stats[atype]['invested'] += data['cost_raw']
            if val_total_raw is not None:
                cat_stats[atype]['current'] += val_total_raw
            if not cat_stats[atype]['start_date'] or data['min_date'] < cat_stats[atype]['start_date']:
                cat_stats[atype]['start_date'] = data['min_date']

        # --- CALCULA BREAKDOWN ANUAL DO ATIVO ---
        yearly_breakdown = []
        ticker_yearly_closes = yearly_closes_map.get(ticker, {})

        # Se temos dados anuais, calculamos a performance ano a ano
        # Começamos do ano de início da carteira até o ano atual
        # O "Start Date" do cálculo de um ano é o fechamento do ano anterior.

        # Considerar preço atual como fechamento do ano corrente (YTD)
        # Adiciona o ano corrente no mapa temporariamente para o calculo
        if curr_price_adj is not None:
            ticker_yearly_closes[current_year] = curr_price_adj

        sorted_years = sorted(ticker_yearly_closes.keys())

        for i in range(1, len(sorted_years)):
            prev_year = sorted_years[i-1]
            curr_loop_year = sorted_years[i]

            # Só calculamos se o ano estiver dentro do horizonte da carteira (ou 1 antes pra base)
            if curr_loop_year < start_year_portfolio:
                continue

            v_start = ticker_yearly_closes[prev_year]
            v_end = ticker_yearly_closes[curr_loop_year]

            if v_start > 0:
                y_perf = ((v_end - v_start) / v_start) * 100
                yearly_breakdown.append({
                    "year": curr_loop_year,
                    "value": round(y_perf, 2),
                    "start_price": v_start,
                    "end_price": v_end
                })

        cls = classification_map.get(ticker, {})

        positions_list.append({
            "ticker": ticker,
            "name": name_map.get(ticker, ticker),
            "type": atype,
            "subtype": cls.get("subtype", "Indefinido"),
            "sector": cls.get("sector", "Outros"),
            "qty": round(qty, 4),
            "age": _format_asset_age(data['min_date']),

            "avg_price": round(pm_raw, 2),
            "avg_price_adjusted": round(pm_adj, 2),
            "current_price": round(curr_price_raw, 2) if curr_price_raw is not None else None,
            "current_adjusted": round(curr_price_adj, 2) if curr_price_adj is not None else None,

            "total_value": round(val_total_raw, 2) if val_total_raw is not None else None,

            "profit": round(profit_raw, 2) if profit_raw is not None else None,
            "profit_percent": round(profit_pct_raw, 2) if profit_pct_raw is not None else None,

            "total_return_profit": round(profit_adj, 2) if profit_adj is not None else None,
            "total_return_percent": round(profit_pct_adj, 2) if profit_pct_adj is not None else None,

            # INSERE OS DADOS REAIS
            "yearly_breakdown": yearly_breakdown,

            "allocation_percent": 0
        })

    # 6. Finalização
    positions_list.sort(key=lambda x: x['total_value'] or 0, reverse=True)

    for p in positions_list:
        if total_current_global > 0:
            p['allocation_percent'] = round(((p['total_value'] or 0) / total_current_global) * 100, 2)

    valuation_profit_global = total_current_global - total_invested_global

    start_date_global = min([p['min_date'] for p in pos_map.values()]) if pos_map else None

    history_by_type = {
        "stock": _calculate_history_logic(
            current_user, wallets, "stock", "IBOV", preloaded_prices=history_prices,
            preloaded_purchases=history_purchases,
            preloaded_benchmark=history_benchmarks["IBOV"],
            preloaded_proventos=proventos,
        ),
        "fii": _calculate_history_logic(
            current_user, wallets, "fii", "IFIX", preloaded_prices=history_prices,
            preloaded_purchases=history_purchases,
            preloaded_benchmark=history_benchmarks["IFIX"],
            preloaded_proventos=proventos,
        ),
        "etf": _calculate_history_logic(
            current_user, wallets, "etf", "SP500", preloaded_prices=history_prices,
            preloaded_purchases=history_purchases,
            preloaded_benchmark=history_benchmarks["SP500"],
            preloaded_proventos=proventos,
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

    projections = {
        "total": _calculate_period_stats(
            total_profit_global,
            total_profit_pct_global,
            start_date_global,
            dividends_global,
        )
    }

    for cat, stats in cat_stats.items():
        c_valuation = stats['current'] - stats['invested']
        c_profit = c_valuation + dividends_by_type.get(cat, 0.0)
        c_yield = (c_profit / stats['invested'] * 100) if stats['invested'] > 0 else 0
        projections[cat] = _calculate_period_stats(
            c_profit,
            c_yield,
            stats['start_date'],
            dividends_by_type.get(cat, 0.0),
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
        for ticker, position in pos_map.items()
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
            k: round(v['invested'], 2) for k, v in cat_stats.items()
        },
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
