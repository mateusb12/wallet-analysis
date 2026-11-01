from dataclasses import dataclass
from datetime import date
from typing import Any, Sequence

from backend.source.persistence.ports import WalletRepository


@dataclass(frozen=True)
class HistoryData:
    purchases: Sequence[Any]
    prices: Sequence[Any]
    benchmark: Sequence[Any]
    proventos: Sequence[Any]


def _from_start_date(rows, start_date: date):
    return [row for row in rows if row.trade_date >= start_date]


def load_history_data(
    user_id: str,
    wallets: WalletRepository,
    asset_type: str | None = None,
    benchmark: str = "CDI",
    ticker: str | None = None,
    preloaded_purchases=None,
    preloaded_prices=None,
    preloaded_benchmark=None,
    preloaded_proventos=None,
) -> HistoryData:
    """Resolve history inputs from preloaded data or the repository.

    Callers do not need to know which inputs are cached. This is the only
    module responsible for applying the preload/filter/fetch policy.
    """
    if preloaded_purchases is None:
        purchases = wallets.get_history_purchases(user_id, asset_type, ticker)
    else:
        purchases = [
            purchase for purchase in preloaded_purchases
            if (not asset_type or purchase.type == asset_type)
            and (not ticker or purchase.ticker == ticker)
        ]

    if not purchases:
        return HistoryData([], [], [], preloaded_proventos or wallets.list_proventos(user_id))

    start_date = min(purchase.trade_date for purchase in purchases)
    unique_tickers = [purchase.ticker for purchase in purchases]

    prices = (
        _from_start_date(preloaded_prices, start_date)
        if preloaded_prices is not None
        else wallets.get_prices_from(unique_tickers, start_date)
    )

    if preloaded_benchmark is not None:
        benchmark_rows = _from_start_date(preloaded_benchmark, start_date)
    elif benchmark == "IBOV":
        benchmark_rows = wallets.get_ibov_from(start_date)
    elif benchmark == "IFIX":
        benchmark_rows = wallets.get_ifix_from(start_date)
    elif benchmark == "SP500":
        benchmark_rows = wallets.get_prices_from(["^GSPC"], start_date)
    else:
        benchmark_rows = wallets.get_cdi_from(start_date)

    proventos = (
        preloaded_proventos
        if preloaded_proventos is not None
        else wallets.list_proventos(user_id)
    )

    return HistoryData(purchases, prices, benchmark_rows, proventos)
