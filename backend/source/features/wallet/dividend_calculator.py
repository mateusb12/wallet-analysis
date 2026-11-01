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


def calculate_purchase_dividends(purchases, proventos) -> list[float]:
    """Attribute each registered cash receipt to eligible purchases."""
    dividends = [0.0] * len(purchases)

    for provento in proventos:
        payment_date = provento.date
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
                and purchase_date <= payment_date
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
