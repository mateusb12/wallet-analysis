from collections.abc import Sequence
from typing import Any

from supabase import Client


class SupabaseMarketDataRepository:
    def __init__(self, client: Client):
        self._client = client

    def get_last_b3_price_date(self, ticker: str) -> str | None:
        response = (
            self._client.table("b3_prices")
            .select("trade_date")
            .eq("ticker", ticker)
            .order("trade_date", desc=True)
            .limit(1)
            .execute()
        )
        return response.data[0]["trade_date"] if response.data else None

    def upsert_b3_prices(self, records: Sequence[dict[str, Any]]) -> None:
        self._upsert_in_batches("b3_prices", records, "ticker,trade_date")

    def upsert_ifix_history(self, records: Sequence[dict[str, Any]]) -> None:
        self._upsert_in_batches("ifix_history", records, "trade_date")

    def upsert_ibov_history(self, records: Sequence[dict[str, Any]]) -> None:
        self._upsert_in_batches("ibov_history", records, "trade_date")

    def get_last_cdi_date(self) -> str | None:
        response = (
            self._client.table("cdi_history")
            .select("trade_date")
            .order("trade_date", desc=True)
            .limit(1)
            .execute()
        )
        return response.data[0]["trade_date"] if response.data else None

    def upsert_cdi_history(self, records: Sequence[dict[str, Any]]) -> None:
        self._upsert_in_batches("cdi_history", records, "trade_date")

    def get_classification_cache(self, ticker: str) -> dict[str, Any] | None:
        response = (
            self._client.table("asset_classification_cache")
            .select("*")
            .eq("ticker", ticker)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    def upsert_classification_cache(self, record: dict[str, Any]) -> None:
        self._client.table("asset_classification_cache").upsert(
            record,
            on_conflict="ticker",
        ).execute()

    def _upsert_in_batches(
        self,
        table: str,
        records: Sequence[dict[str, Any]],
        conflict_columns: str,
        batch_size: int = 1000,
    ) -> None:
        for start in range(0, len(records), batch_size):
            self._client.table(table).upsert(
                list(records[start:start + batch_size]),
                on_conflict=conflict_columns,
            ).execute()


class SupabaseAnalysisRepository:
    def __init__(self, client: Client):
        self._client = client

    def get_price_history(self, ticker: str, limit: int) -> Sequence[dict[str, Any]]:
        response = (
            self._client.table("b3_prices")
            .select("trade_date,close")
            .eq("ticker", ticker)
            .order("trade_date", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data

    def get_fii_dividends(self, ticker: str) -> Sequence[dict[str, Any]]:
        response = (
            self._client.table("b3_fiis_dividends")
            .select("trade_date,price_close,dividend_value")
            .eq("ticker", ticker)
            .order("trade_date", desc=False)
            .execute()
        )
        return response.data

    def get_ipca_range(self, start_date: str, end_date: str) -> Sequence[dict[str, Any]]:
        response = (
            self._client.table("ipca_history")
            .select("ref_date,ipca")
            .gte("ref_date", start_date)
            .lte("ref_date", end_date)
            .execute()
        )
        return response.data

    def get_user_tickers(self, user_id: str) -> Sequence[str]:
        response = (
            self._client.table("asset_purchases")
            .select("ticker")
            .eq("user_id", user_id)
            .execute()
        )
        return [row["ticker"] for row in response.data]

    def get_prices_for_tickers(
        self,
        start_date: str,
        tickers: Sequence[str],
        offset: int,
        limit: int,
    ) -> Sequence[dict[str, Any]]:
        response = (
            self._client.table("b3_prices")
            .select("ticker,trade_date,close,adjusted_close")
            .gte("trade_date", start_date)
            .in_("ticker", list(tickers))
            .range(offset, offset + limit - 1)
            .execute()
        )
        return response.data
