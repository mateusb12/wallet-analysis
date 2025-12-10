from sqlalchemy import Column, Integer, String, Float, DateTime, UniqueConstraint, Date
from sqlalchemy.sql import func
from backend.source.core.database import Base

class B3Price(Base):
    __tablename__ = "b3_prices"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, index=True, nullable=False)
    trade_date = Column(DateTime(timezone=True), nullable=False)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Float)
    inserted_at = Column(DateTime(timezone=True), server_default=func.now())

    # Create a composite unique constraint to avoid duplicate ticker/date pairs
    __table_args__ = (
        UniqueConstraint('ticker', 'trade_date', name='uq_ticker_trade_date'),
    )

class IfixHistory(Base):
    __tablename__ = "ifix_history"

    id = Column(Integer, primary_key=True, index=True)
    trade_date = Column(DateTime(timezone=True), unique=True, nullable=False)
    close_value = Column(Float, nullable=False)

class IpcaHistory(Base):
    __tablename__ = "ipca_history"

    id = Column(Integer, primary_key=True, index=True)
    ref_date = Column(Date, nullable=False)
    ipca = Column(Float, nullable=False)