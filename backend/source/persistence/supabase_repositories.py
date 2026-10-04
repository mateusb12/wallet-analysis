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


class SupabaseB3Repository:
    def __init__(self, client: Client):
        self._client = client

    def get_prices(self, ticker: str, offset: int, limit: int) -> dict[str, Any]:
        response = (
            self._client.table("b3_prices")
            .select("*", count="exact")
            .eq("ticker", ticker)
            .order("trade_date", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return {"data": response.data, "count": response.count}

    def get_unique_stock_tickers(self) -> Sequence[str]:
        response = self._client.table("unique_stocks_view").select("ticker").execute()
        return sorted(row["ticker"] for row in response.data)

    def get_full_stock_history(self, ticker: str, limit: int) -> Sequence[dict[str, Any]]:
        response = (
            self._client.table("b3_prices")
            .select("trade_date,close,adjusted_close")
            .eq("ticker", ticker)
            .order("trade_date", desc=False)
            .limit(limit)
            .execute()
        )
        return response.data

    def get_unique_tickers(self) -> Sequence[str]:
        response = self._client.table("unique_tickers_view").select("ticker").execute()
        return [row["ticker"] for row in response.data]

    def get_fii_dividends(self, ticker: str | None, offset: int, limit: int) -> dict[str, Any]:
        query = (
            self._client.table("b3_fiis_dividends")
            .select("*", count="exact")
            .gt("dividend_value", 0)
            .order("trade_date", desc=True)
        )
        if ticker:
            query = query.eq("ticker", ticker)
        response = query.range(offset, offset + limit - 1).execute()
        return {"data": response.data, "count": response.count}

    def get_fii_chart_data(self, ticker: str, start_date: str | None) -> Sequence[dict[str, Any]]:
        query = (
            self._client.table("b3_prices")
            .select("*, price_close:close")
            .eq("ticker", ticker)
            .order("trade_date", desc=True)
        )
        if start_date:
            query = query.gte("trade_date", start_date)
        return query.execute().data

    def get_fii_date_range(self, ticker: str) -> dict[str, Any] | None:
        response = (
            self._client.table("fii_date_ranges_view")
            .select("oldest_date,newest_date")
            .eq("ticker", ticker)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    def get_fii_dividend_for_month(self, ticker: str, start_date: str, end_date: str) -> dict[str, Any] | None:
        response = (
            self._client.table("b3_fiis_dividends")
            .select("*")
            .eq("ticker", ticker)
            .gt("dividend_value", 0)
            .gte("trade_date", start_date)
            .lte("trade_date", end_date)
            .order("trade_date", desc=False)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    def get_first_fii_price(self, ticker: str, oldest_date: str) -> dict[str, Any] | None:
        response = (
            self._client.table("b3_fiis_dividends")
            .select("price_close")
            .eq("ticker", ticker)
            .gte("trade_date", oldest_date)
            .order("trade_date", desc=False)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    def get_price_closest_to_date(self, ticker: str, target_date: str) -> dict[str, Any] | None:
        response = (
            self._client.table("b3_prices")
            .select("close,adjusted_close,trade_date")
            .eq("ticker", ticker)
            .lte("trade_date", target_date)
            .order("trade_date", desc=True)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

class SupabaseReferenceDataRepository:
    def __init__(self, client: Client):
        self._client = client

    def get_ipca(self, ref_date=None, start_date=None, end_date=None):
        query = self._client.table("ipca_history").select("*")
        if ref_date:
            query = query.eq("ref_date", ref_date)
        if start_date:
            query = query.gte("ref_date", start_date)
        if end_date:
            query = query.lte("ref_date", end_date)
        return query.order("ref_date", desc=False).execute().data

    def get_last_ipca_date(self):
        rows = self._client.table("ipca_history").select("ref_date").order("ref_date", desc=True).limit(1).execute().data
        return rows[0]["ref_date"] if rows else None

    def insert_ipca(self, records):
        if records:
            self._client.table("ipca_history").upsert(list(records), on_conflict="ref_date").execute()

    def get_ifix(self, date=None, start_date=None, end_date=None):
        query = self._client.table("ifix_history").select("trade_date,close_value")
        if date:
            query = query.eq("trade_date", date)
        if start_date:
            query = query.gte("trade_date", start_date)
        if end_date:
            query = query.lte("trade_date", end_date)
        return query.order("trade_date", desc=False).execute().data

    def get_ibov(self, start_date=None, end_date=None):
        query = self._client.table("ibov_history").select("trade_date,close_value")
        if start_date:
            query = query.gte("trade_date", start_date)
        if end_date:
            query = query.lte("trade_date", end_date)
        return query.order("trade_date", desc=False).execute().data

    def get_last_ibov_date(self):
        rows = self._client.table("ibov_history").select("trade_date").order("trade_date", desc=True).limit(1).execute().data
        return rows[0]["trade_date"] if rows else None

    def get_cdi(self, start_date, end_date):
        return (
            self._client.table("cdi_history")
            .select("trade_date,value")
            .gte("trade_date", start_date)
            .lte("trade_date", end_date)
            .order("trade_date", desc=False)
            .execute()
            .data
        )
