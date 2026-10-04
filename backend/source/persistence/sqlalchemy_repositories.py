from collections.abc import Sequence
from datetime import date

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from backend.source.models.sql_models import (
    AssetClassificationCache,
    AssetPurchase,
    B3Price,
    CdiHistory,
    User,
)


class SqlAlchemyUserRepository:
    def __init__(self, session: Session):
        self._session = session

    def get_by_id(self, user_id: str) -> User | None:
        return self._session.query(User).filter(User.id == user_id).first()

    def update(self, user: User, fields: dict) -> User:
        try:
            for key, value in fields.items():
                setattr(user, key, value)

            self._session.add(user)
            self._session.commit()
            self._session.refresh(user)
            return user
        except Exception:
            self._session.rollback()
            raise


class SqlAlchemyWalletRepository:
    def __init__(self, session: Session):
        self._session = session

    def list_purchases(self, user_id: str) -> Sequence[AssetPurchase]:
        return (
            self._session.query(AssetPurchase)
            .filter(AssetPurchase.user_id == user_id)
            .all()
        )

    def add_purchases(self, purchases: Sequence[AssetPurchase]) -> Sequence[AssetPurchase]:
        if not purchases:
            return purchases

        try:
            self._session.add_all(purchases)
            self._session.commit()
            for purchase in purchases:
                self._session.refresh(purchase)
            return purchases
        except Exception:
            self._session.rollback()
            raise

    def get_purchase(self, purchase_id: int) -> AssetPurchase | None:
        return (
            self._session.query(AssetPurchase)
            .filter(AssetPurchase.id == purchase_id)
            .first()
        )

    def save_purchase(self, purchase: AssetPurchase) -> AssetPurchase:
        try:
            self._session.add(purchase)
            self._session.commit()
            self._session.refresh(purchase)
            return purchase
        except Exception:
            self._session.rollback()
            raise

    def delete_purchase(self, purchase: AssetPurchase) -> None:
        try:
            self._session.delete(purchase)
            self._session.commit()
        except Exception:
            self._session.rollback()
            raise

    def get_history_purchases(self, user_id: str) -> Sequence:
        return (
            self._session.query(
                AssetPurchase.ticker,
                AssetPurchase.qty,
                AssetPurchase.price,
                AssetPurchase.trade_date,
            )
            .filter(AssetPurchase.user_id == user_id)
            .order_by(AssetPurchase.trade_date.asc())
            .all()
        )

    def get_prices_from(self, tickers: Sequence[str], start_date: date) -> Sequence:
        return (
            self._session.query(B3Price.ticker, B3Price.trade_date, B3Price.close)
            .filter(B3Price.ticker.in_(tickers), B3Price.trade_date >= start_date)
            .all()
        )

    def get_cdi_from(self, start_date: date) -> Sequence:
        return (
            self._session.query(CdiHistory.trade_date, CdiHistory.value)
            .filter(CdiHistory.trade_date >= start_date)
            .all()
        )

    def get_adjusted_prices_for_purchases(
        self,
        purchase_keys: Sequence[tuple[str, date]],
    ) -> Sequence:
        if not purchase_keys:
            return []

        conditions = [
            and_(B3Price.ticker == ticker, B3Price.trade_date == trade_date)
            for ticker, trade_date in purchase_keys
        ]
        return (
            self._session.query(
                B3Price.ticker,
                B3Price.trade_date,
                B3Price.adjusted_close,
            )
            .filter(or_(*conditions))
            .all()
        )

    def get_latest_prices(self, tickers: Sequence[str]) -> Sequence:
        return (
            self._session.query(
                B3Price.ticker,
                B3Price.close,
                B3Price.adjusted_close,
                B3Price.name,
            )
            .filter(B3Price.ticker.in_(tickers))
            .order_by(B3Price.trade_date.desc())
            .all()
        )

    def get_classifications(self, tickers: Sequence[str]) -> Sequence:
        return (
            self._session.query(
                AssetClassificationCache.ticker,
                AssetClassificationCache.detected_type,
                AssetClassificationCache.sector,
            )
            .filter(AssetClassificationCache.ticker.in_(tickers))
            .all()
        )

    def get_prices_from_previous_year(self, tickers: Sequence[str], start_year: int) -> Sequence:
        start_date = date(start_year - 1, 12, 21)
        return (
            self._session.query(B3Price.ticker, B3Price.trade_date, B3Price.adjusted_close)
            .filter(B3Price.ticker.in_(tickers), B3Price.trade_date >= start_date)
            .order_by(B3Price.trade_date.asc())
            .all()
        )
