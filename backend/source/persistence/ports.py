from datetime import date
from typing import Any, Protocol, Sequence

from backend.source.models.sql_models import AssetPurchase, User


class UserRepository(Protocol):
    def get_by_id(self, user_id: str) -> User | None:
        ...

    def update(self, user: User, fields: dict) -> User:
        ...


class WalletRepository(Protocol):
    def list_purchases(self, user_id: str) -> Sequence[AssetPurchase]:
        ...

    def add_purchases(self, purchases: Sequence[AssetPurchase]) -> Sequence[AssetPurchase]:
        ...

    def get_purchase(self, purchase_id: int) -> AssetPurchase | None:
        ...

    def save_purchase(self, purchase: AssetPurchase) -> AssetPurchase:
        ...

    def delete_purchase(self, purchase: AssetPurchase) -> None:
        ...

    def get_history_purchases(self, user_id: str) -> Sequence[Any]:
        ...

    def get_prices_from(self, tickers: Sequence[str], start_date: date) -> Sequence[Any]:
        ...

    def get_cdi_from(self, start_date: date) -> Sequence[Any]:
        ...

    def get_adjusted_prices_for_purchases(
        self,
        purchase_keys: Sequence[tuple[str, date]],
    ) -> Sequence[Any]:
        ...

    def get_latest_prices(self, tickers: Sequence[str]) -> Sequence[Any]:
        ...

    def get_classifications(self, tickers: Sequence[str]) -> Sequence[Any]:
        ...

    def get_prices_from_previous_year(self, tickers: Sequence[str], start_year: int) -> Sequence[Any]:
        ...


class MarketDataRepository(Protocol):
    def get_last_b3_price_date(self, ticker: str) -> str | None:
        ...

    def upsert_b3_prices(self, records: Sequence[dict[str, Any]]) -> None:
        ...

    def upsert_ifix_history(self, records: Sequence[dict[str, Any]]) -> None:
        ...

    def upsert_ibov_history(self, records: Sequence[dict[str, Any]]) -> None:
        ...

    def get_last_cdi_date(self) -> str | None:
        ...

    def upsert_cdi_history(self, records: Sequence[dict[str, Any]]) -> None:
        ...

    def get_classification_cache(self, ticker: str) -> dict[str, Any] | None:
        ...

    def upsert_classification_cache(self, record: dict[str, Any]) -> None:
        ...


class AnalysisRepository(Protocol):
    def get_price_history(self, ticker: str, limit: int) -> Sequence[dict[str, Any]]:
        ...

    def get_fii_dividends(self, ticker: str) -> Sequence[dict[str, Any]]:
        ...

    def get_ipca_range(self, start_date: str, end_date: str) -> Sequence[dict[str, Any]]:
        ...

    def get_user_tickers(self, user_id: str) -> Sequence[str]:
        ...

    def get_prices_for_tickers(
        self,
        start_date: str,
        tickers: Sequence[str],
        offset: int,
        limit: int,
    ) -> Sequence[dict[str, Any]]:
        ...


class B3Repository(Protocol):
    def get_prices(self, ticker: str, offset: int, limit: int) -> dict[str, Any]:
        ...

    def get_unique_stock_tickers(self) -> Sequence[str]:
        ...

    def get_full_stock_history(self, ticker: str, limit: int) -> Sequence[dict[str, Any]]:
        ...

    def get_unique_tickers(self) -> Sequence[str]:
        ...

    def get_fii_dividends(self, ticker: str | None, offset: int, limit: int) -> dict[str, Any]:
        ...

    def get_fii_chart_data(self, ticker: str, start_date: str | None) -> Sequence[dict[str, Any]]:
        ...

    def get_fii_date_range(self, ticker: str) -> dict[str, Any] | None:
        ...

    def get_fii_dividend_for_month(self, ticker: str, start_date: str, end_date: str) -> dict[str, Any] | None:
        ...

    def get_first_fii_price(self, ticker: str, oldest_date: str) -> dict[str, Any] | None:
        ...

    def get_price_closest_to_date(self, ticker: str, target_date: str) -> dict[str, Any] | None:
        ...

class ReferenceDataRepository(Protocol):
    def get_ipca(self, ref_date: str | None = None, start_date: str | None = None, end_date: str | None = None) -> Sequence[dict[str, Any]]:
        ...

    def get_last_ipca_date(self) -> str | None:
        ...

    def insert_ipca(self, records: Sequence[dict[str, Any]]) -> None:
        ...

    def get_ifix(self, date: str | None = None, start_date: str | None = None, end_date: str | None = None) -> Sequence[dict[str, Any]]:
        ...

    def get_ibov(self, start_date: str | None = None, end_date: str | None = None) -> Sequence[dict[str, Any]]:
        ...

    def get_last_ibov_date(self) -> str | None:
        ...

    def get_cdi(self, start_date: str, end_date: str) -> Sequence[dict[str, Any]]:
        ...
