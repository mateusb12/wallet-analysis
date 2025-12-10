from sqlalchemy import Column, Integer, String, Float, DateTime, UniqueConstraint, Date, Boolean, Numeric, Text, \
    BigInteger, Identity
from sqlalchemy.sql import func
from backend.source.core.database import Base


class B3Price(Base):
    __tablename__ = "b3_prices"

    # MATCH DB: Explicitly define Identity(always=True) to stop Alembic from trying to change it
    id = Column(BigInteger, Identity(always=True), primary_key=True, index=True)

    ticker = Column(Text, index=True, nullable=False)
    trade_date = Column(Date, nullable=False)

    open = Column(Numeric)
    high = Column(Numeric)
    low = Column(Numeric)
    close = Column(Numeric)
    volume = Column(Numeric)

    name = Column(Text)
    market_type = Column(Integer)  # This is the NEW column we want

    dividend_value = Column(Numeric, server_default='0')
    month_ref = Column(Text)
    mes_ano = Column(Text)
    codisi = Column(Text)
    dividend_yield_month = Column(Numeric)
    dividend_r = Column("dividend_r$", Numeric)
    has_dividend = Column(Boolean)

    # MATCH DB: timestamp without time zone -> timezone=False
    inserted_at = Column(DateTime(timezone=False), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('ticker', 'trade_date', name='uq_ticker_trade_date'),
    )


class IfixHistory(Base):
    __tablename__ = "ifix_history"

    # MATCH DB: Your DB does not have an 'id' column for this table, it relies on trade_date.
    # We remove 'id' here to stop Alembic from trying to add a non-nullable column to a populated table.
    trade_date = Column(Date, primary_key=True, nullable=False)

    close_value = Column(Numeric(10, 2), nullable=False)

    # MATCH DB: timestamp with time zone -> timezone=True
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class IpcaHistory(Base):
    __tablename__ = "ipca_history"

    # MATCH DB: Identity(always=True)
    id = Column(BigInteger, Identity(always=True), primary_key=True, index=True)

    ref_date = Column(Date, nullable=False)
    ipca = Column(Numeric(6, 2), nullable=False)


# NEW TABLE
class CdiHistory(Base):
    __tablename__ = "cdi_history"

    id = Column(Integer, primary_key=True, index=True)
    trade_date = Column(Date, unique=True, nullable=False)
    value = Column(Float, nullable=False)