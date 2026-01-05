from sqlalchemy import Column, Integer, String, Float, DateTime, UniqueConstraint, Date, Boolean, Numeric, Text, \
    BigInteger, Identity, UUID, ForeignKey, Table, JSON
from sqlalchemy.sql import func
from backend.source.core.database import Base

auth_users_table = Table(
    "users",
    Base.metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    schema="auth",
    extend_existing=True
)

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
    adjusted_close = Column(Numeric)
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

class IbovHistory(Base):
    __tablename__ = "ibov_history"

    trade_date = Column(Date, primary_key=True, nullable=False)
    close_value = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AssetPurchase(Base):
    __tablename__ = "asset_purchases"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)  # Supabase User UUID

    ticker = Column(String, index=True, nullable=False)
    name = Column(String, nullable=True)
    type = Column(String, nullable=False) # 'stock', 'fii', 'etf'

    qty = Column(Float, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    trade_date = Column(Date, nullable=False)

    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class User(Base):
    __tablename__ = "users"
    # O schema padrão geralmente é 'public', mas se precisar ser explícito:
    # __table_args__ = {"schema": "public"}

    # O ID deve ser PK e FK ao mesmo tempo, apontando para a tabela de auth do Supabase
    id = Column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="CASCADE"),
        primary_key=True
    )

    email = Column(String, nullable=True)
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    balancing_settings = Column(JSON, default={}, nullable=True)

    # Opcional: Se quiser converter para dict facilmente
    def to_dict(self):
        return {
            "id": str(self.id),
            "email": self.email,
            "full_name": self.full_name,
            "avatar_url": self.avatar_url,
        }