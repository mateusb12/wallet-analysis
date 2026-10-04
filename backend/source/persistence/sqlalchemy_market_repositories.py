from collections.abc import Sequence
from datetime import date, datetime
from typing import Any

from sqlalchemy import distinct
from sqlalchemy.orm import Session

from backend.source.models.sql_models import (
    AssetClassificationCache,
    AssetPurchase,
    B3FiiDividend,
    B3Price,
    CdiHistory,
    IbovHistory,
    IfixHistory,
    IpcaHistory,
)


def _date_value(value: Any) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def _iso(value: Any) -> str | None:
    return value.isoformat() if value is not None else None


def _datetime_value(value: Any) -> datetime | None:
    if value is None or isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _assign(model: Any, values: dict[str, Any], excluded: set[str] | None = None) -> None:
    columns = {column.name for column in model.__table__.columns} - (excluded or set())
    for key, value in values.items():
        if key not in columns:
            continue
        if key in {"trade_date", "ref_date"}:
            value = _date_value(value)
        elif key in {"inserted_at", "created_at", "updated_at"}:
            value = _datetime_value(value)
        setattr(model, key, value)


class SqlAlchemyMarketDataRepository:
    def __init__(self, session: Session):
        self._session = session

    def get_last_b3_price_date(self, ticker: str) -> str | None:
        row = (
            self._session.query(B3Price.trade_date)
            .filter(B3Price.ticker == ticker)
            .order_by(B3Price.trade_date.desc())
            .first()
        )
        return _iso(row[0]) if row else None

    def upsert_b3_prices(self, records: Sequence[dict[str, Any]]) -> None:
        for record in records:
            trade_date = _date_value(record["trade_date"])
            row = (
                self._session.query(B3Price)
                .filter(B3Price.ticker == record["ticker"], B3Price.trade_date == trade_date)
                .one_or_none()
            )
            if row is None:
                row = B3Price()
                self._session.add(row)
            _assign(row, record, excluded={"id"})
        self._session.commit()

    def upsert_ifix_history(self, records: Sequence[dict[str, Any]]) -> None:
        for record in records:
            trade_date = _date_value(record["trade_date"])
            row = self._session.get(IfixHistory, trade_date) or IfixHistory(trade_date=trade_date)
            _assign(row, record)
            self._session.add(row)
        self._session.commit()

    def upsert_ibov_history(self, records: Sequence[dict[str, Any]]) -> None:
        for record in records:
            trade_date = _date_value(record["trade_date"])
            row = self._session.get(IbovHistory, trade_date) or IbovHistory(trade_date=trade_date)
            _assign(row, record)
            self._session.add(row)
        self._session.commit()

    def get_last_cdi_date(self) -> str | None:
        row = self._session.query(CdiHistory.trade_date).order_by(CdiHistory.trade_date.desc()).first()
        return _iso(row[0]) if row else None

    def upsert_cdi_history(self, records: Sequence[dict[str, Any]]) -> None:
        for record in records:
            trade_date = _date_value(record["trade_date"])
            row = (
                self._session.query(CdiHistory)
                .filter(CdiHistory.trade_date == trade_date)
                .one_or_none()
            )
            if row is None:
                row = CdiHistory(trade_date=trade_date)
                self._session.add(row)
            _assign(row, record)
        self._session.commit()

    def get_classification_cache(self, ticker: str) -> dict[str, Any] | None:
        row = self._session.get(AssetClassificationCache, ticker)
        return _model_dict(row) if row else None

    def upsert_classification_cache(self, record: dict[str, Any]) -> None:
        ticker = record["ticker"]
        row = self._session.get(AssetClassificationCache, ticker)
        if row is None:
            row = AssetClassificationCache(ticker=ticker)
            self._session.add(row)
        _assign(row, record)
        self._session.commit()


class SqlAlchemyReferenceDataRepository:
    def __init__(self, session: Session):
        self._session = session

    def get_ipca(self, ref_date=None, start_date=None, end_date=None):
        query = self._session.query(IpcaHistory).order_by(IpcaHistory.ref_date.asc())
        if ref_date:
            query = query.filter(IpcaHistory.ref_date == _date_value(ref_date))
        if start_date:
            query = query.filter(IpcaHistory.ref_date >= _date_value(start_date))
        if end_date:
            query = query.filter(IpcaHistory.ref_date <= _date_value(end_date))
        return [_model_dict(row) for row in query.all()]

    def get_last_ipca_date(self):
        row = self._session.query(IpcaHistory.ref_date).order_by(IpcaHistory.ref_date.desc()).first()
        return _iso(row[0]) if row else None

    def insert_ipca(self, records):
        for record in records:
            ref_date = _date_value(record["ref_date"])
            row = self._session.query(IpcaHistory).filter(IpcaHistory.ref_date == ref_date).first()
            if row is None:
                row = IpcaHistory(ref_date=ref_date)
                self._session.add(row)
            _assign(row, record)
        self._session.commit()

    def get_ifix(self, date=None, start_date=None, end_date=None):
        query = self._session.query(IfixHistory).order_by(IfixHistory.trade_date.asc())
        if date:
            query = query.filter(IfixHistory.trade_date == _date_value(date))
        if start_date:
            query = query.filter(IfixHistory.trade_date >= _date_value(start_date))
        if end_date:
            query = query.filter(IfixHistory.trade_date <= _date_value(end_date))
        return [_model_dict(row) for row in query.all()]

    def get_ibov(self, start_date=None, end_date=None):
        query = self._session.query(IbovHistory).order_by(IbovHistory.trade_date.asc())
        if start_date:
            query = query.filter(IbovHistory.trade_date >= _date_value(start_date))
        if end_date:
            query = query.filter(IbovHistory.trade_date <= _date_value(end_date))
        return [_model_dict(row) for row in query.all()]

    def get_last_ibov_date(self):
        row = self._session.query(IbovHistory.trade_date).order_by(IbovHistory.trade_date.desc()).first()
        return _iso(row[0]) if row else None

    def get_cdi(self, start_date, end_date):
        rows = (
            self._session.query(CdiHistory)
            .filter(CdiHistory.trade_date >= _date_value(start_date), CdiHistory.trade_date <= _date_value(end_date))
            .order_by(CdiHistory.trade_date.asc())
            .all()
        )
        return [_model_dict(row) for row in rows]


class SqlAlchemyAnalysisRepository:
    def __init__(self, session: Session):
        self._session = session

    def get_price_history(self, ticker: str, limit: int):
        rows = (
            self._session.query(B3Price)
            .filter(B3Price.ticker == ticker)
            .order_by(B3Price.trade_date.desc())
            .limit(limit)
            .all()
        )
        return [_model_dict(row, only={"trade_date", "close"}) for row in rows]

    def get_fii_dividends(self, ticker: str):
        rows = (
            self._session.query(B3FiiDividend)
            .filter(B3FiiDividend.ticker == ticker)
            .order_by(B3FiiDividend.trade_date.asc())
            .all()
        )
        return [_model_dict(row, only={"trade_date", "price_close", "dividend_value"}) for row in rows]

    def get_ipca_range(self, start_date: str, end_date: str):
        rows = (
            self._session.query(IpcaHistory)
            .filter(IpcaHistory.ref_date >= _date_value(start_date), IpcaHistory.ref_date <= _date_value(end_date))
            .order_by(IpcaHistory.ref_date.asc())
            .all()
        )
        return [_model_dict(row, only={"ref_date", "ipca"}) for row in rows]

    def get_user_tickers(self, user_id: str):
        rows = self._session.query(distinct(AssetPurchase.ticker)).filter(AssetPurchase.user_id == user_id).all()
        return [row[0] for row in rows]

    def get_prices_for_tickers(self, start_date: str, tickers: Sequence[str], offset: int, limit: int):
        rows = (
            self._session.query(B3Price)
            .filter(B3Price.trade_date >= _date_value(start_date), B3Price.ticker.in_(list(tickers)))
            .order_by(B3Price.trade_date.asc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return [_model_dict(row, only={"ticker", "trade_date", "close", "adjusted_close"}) for row in rows]


class SqlAlchemyB3Repository:
    def __init__(self, session: Session):
        self._session = session

    def get_prices(self, ticker: str, offset: int, limit: int):
        query = self._session.query(B3Price).filter(B3Price.ticker == ticker).order_by(B3Price.trade_date.desc())
        total = query.count()
        rows = query.offset(offset).limit(limit).all()
        return {"data": [_model_dict(row) for row in rows], "count": total}

    def get_unique_stock_tickers(self):
        rows = self._session.query(distinct(B3Price.ticker)).order_by(B3Price.ticker.asc()).all()
        return [row[0] for row in rows]

    def get_full_stock_history(self, ticker: str, limit: int):
        rows = (
            self._session.query(B3Price)
            .filter(B3Price.ticker == ticker)
            .order_by(B3Price.trade_date.asc())
            .limit(limit)
            .all()
        )
        return [_model_dict(row, only={"trade_date", "close", "adjusted_close"}) for row in rows]

    def get_unique_tickers(self):
        rows = self._session.query(distinct(B3Price.ticker)).order_by(B3Price.ticker.asc()).all()
        return [row[0] for row in rows]

    def get_fii_dividends(self, ticker: str | None, offset: int, limit: int):
        query = self._session.query(B3FiiDividend).filter(B3FiiDividend.dividend_value > 0)
        if ticker:
            query = query.filter(B3FiiDividend.ticker == ticker)
        query = query.order_by(B3FiiDividend.trade_date.desc())
        total = query.count()
        rows = query.offset(offset).limit(limit).all()
        return {"data": [_model_dict(row) for row in rows], "count": total}

    def get_fii_chart_data(self, ticker: str, start_date: str | None):
        query = self._session.query(B3Price).filter(B3Price.ticker == ticker)
        if start_date:
            query = query.filter(B3Price.trade_date >= _date_value(start_date))
        rows = query.order_by(B3Price.trade_date.desc()).all()
        return [dict(_model_dict(row), price_close=row.close) for row in rows]

    def get_fii_date_range(self, ticker: str):
        rows = self._session.query(B3FiiDividend.trade_date).filter(B3FiiDividend.ticker == ticker).all()
        dates = [row[0] for row in rows]
        return {"oldest_date": _iso(min(dates)), "newest_date": _iso(max(dates))} if dates else None

    def get_fii_dividend_for_month(self, ticker: str, start_date: str, end_date: str):
        row = (
            self._session.query(B3FiiDividend)
            .filter(
                B3FiiDividend.ticker == ticker,
                B3FiiDividend.dividend_value > 0,
                B3FiiDividend.trade_date >= _date_value(start_date),
                B3FiiDividend.trade_date <= _date_value(end_date),
            )
            .order_by(B3FiiDividend.trade_date.asc())
            .first()
        )
        return _model_dict(row) if row else None

    def get_first_fii_price(self, ticker: str, oldest_date: str):
        row = (
            self._session.query(B3FiiDividend)
            .filter(B3FiiDividend.ticker == ticker, B3FiiDividend.trade_date >= _date_value(oldest_date))
            .order_by(B3FiiDividend.trade_date.asc())
            .first()
        )
        return {"price_close": row.price_close} if row else None

    def get_price_closest_to_date(self, ticker: str, target_date: str):
        row = (
            self._session.query(B3Price)
            .filter(B3Price.ticker == ticker, B3Price.trade_date <= _date_value(target_date))
            .order_by(B3Price.trade_date.desc())
            .first()
        )
        return _model_dict(row, only={"close", "adjusted_close", "trade_date"}) if row else None


def _model_dict(row: Any, only: set[str] | None = None) -> dict[str, Any]:
    result = {}
    attribute_by_column = {
        prop.columns[0].name: prop.key
        for prop in row.__mapper__.column_attrs
    }
    for column in row.__table__.columns:
        if only is not None and column.name not in only:
            continue
        attribute_name = attribute_by_column.get(column.name, column.name)
        value = getattr(row, attribute_name)
        result[column.name] = _iso(value) if isinstance(value, (date, datetime)) else value
    return result
