from collections import defaultdict
from dataclasses import dataclass
import re

import pandas as pd


@dataclass(frozen=True)
class DividendSeries:
    confirmed: pd.Series
    estimated: pd.Series

    @property
    def total(self) -> pd.Series:
        return self.confirmed + self.estimated


def normalize_provento_ticker(value: str) -> str:
    match = re.search(r"\b[A-Z]{4}\d{1,2}F?\b", str(value or ""), re.IGNORECASE)
    ticker = match.group(0).upper() if match else ""
    return ticker[:-1] if ticker.endswith("F") else ticker


def resolve_provento_ex_dates(proventos, price_rows) -> int:
    """Resolve missing ex-dates from Yahoo-backed B3 price history.

    ``B3Price.trade_date`` is the ex-date when ``dividend_value`` is present.
    The registered B3 movement keeps the payment date in ``Provento.date``.
    Matching by ticker and per-share amount lets us persist the eligibility
    date without guessing from the payment date.
    """
    rows_by_ticker = defaultdict(list)
    for row in price_rows or []:
        ticker = normalize_provento_ticker(getattr(row, "ticker", ""))
        dividend_value = float(getattr(row, "dividend_value", 0) or 0)
        trade_date = getattr(row, "trade_date", None)
        if ticker and dividend_value > 0 and trade_date:
            rows_by_ticker[ticker].append((trade_date, dividend_value))

    changed = 0
    for provento in proventos or []:
        if getattr(provento, "ex_date", None):
            continue

        quantity = float(getattr(provento, "quantity", 0) or 0)
        payment_date = getattr(provento, "date", None)
        ticker = normalize_provento_ticker(getattr(provento, "product", ""))
        if quantity <= 0 or not payment_date or not ticker:
            continue

        unit_value = float(provento.total_value) / quantity
        candidates = [
            (trade_date, dividend_value)
            for trade_date, dividend_value in rows_by_ticker.get(ticker, [])
            if trade_date < payment_date and abs(dividend_value - unit_value) <= 0.005
        ]
        if not candidates:
            continue

        provento.ex_date = max(trade_date for trade_date, _ in candidates)
        changed += 1

    return changed


def calculate_purchase_dividends(purchases, proventos) -> list[float]:
    """Attribute each registered cash receipt to eligible purchases."""
    dividends = [0.0] * len(purchases)

    for provento in proventos:
        ex_date = getattr(provento, "ex_date", None)
        product = normalize_provento_ticker(provento.product)
        provento_quantity = float(getattr(provento, "quantity", 0) or 0)
        if not product or provento_quantity <= 0:
            continue

        value_per_share = float(provento.total_value) / provento_quantity
        for index, purchase in enumerate(purchases):
            purchase_date = purchase.trade_date or purchase.settlement_date
            if (
                normalize_provento_ticker(purchase.ticker) == product
                and purchase_date
                and ex_date
                and purchase_date < ex_date
            ):
                dividends[index] += float(purchase.qty) * value_per_share

    return dividends


def calculate_dividend_series(
    price_rows,
    common_index: pd.Index,
    holdings_matrix: pd.DataFrame,
    proventos,
    tickers: set[str],
) -> DividendSeries:
    """Calculate confirmed receipts and conservative Yahoo fallback values.

    Registered proventos are authoritative for any ticker that has at least
    one receipt. Yahoo values are only estimated for tickers with no registered
    receipt, preventing ex-date/payment-date mismatches from double counting.
    """
    confirmed_events = defaultdict(float)
    confirmed_tickers = set()
    for provento in proventos:
        ticker = normalize_provento_ticker(provento.product)
        if ticker not in tickers or not provento.date:
            continue
        confirmed_events[(ticker, provento.date)] += float(provento.total_value or 0)
        confirmed_tickers.add(ticker)

    confirmed = pd.Series(0.0, index=common_index)
    estimated = pd.Series(0.0, index=common_index)

    for (_, payment_date), value in confirmed_events.items():
        payment_timestamp = pd.Timestamp(payment_date)
        if payment_timestamp in confirmed.index:
            confirmed.loc[payment_timestamp] += value

    yahoo_rows = price_rows[price_rows["dividend_value"] > 0]
    for _, row in yahoo_rows.iterrows():
        ticker = str(row["ticker"]).upper()
        if ticker in confirmed_tickers or ticker not in holdings_matrix.columns:
            continue

        ex_timestamp = pd.Timestamp(row["trade_date"])
        if ex_timestamp not in estimated.index:
            continue

        estimated.loc[ex_timestamp] += (
            holdings_matrix.loc[ex_timestamp, ticker]
            * float(row["dividend_value"])
        )

    return DividendSeries(confirmed=confirmed, estimated=estimated)
