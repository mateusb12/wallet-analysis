"""Create the portable FII dividends table."""

from typing import Sequence, Union

revision: str = "5e7f0a2b3c41"
down_revision: Union[str, Sequence[str], None] = "4c2a7e9b1d10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Historical migration; the portable baseline already creates this table.
    return

    op.create_table(
        "b3_fiis_dividends",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("ticker", sa.String(), nullable=False),
        sa.Column("trade_date", sa.Date(), nullable=False),
        sa.Column("price_close", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("dividend_value", sa.Numeric(precision=10, scale=4), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ticker", "trade_date", name="uq_fii_dividend_ticker_date"),
    )
    op.create_index("ix_b3_fiis_dividends_ticker", "b3_fiis_dividends", ["ticker"])
    op.create_index("ix_b3_fiis_dividends_trade_date", "b3_fiis_dividends", ["trade_date"])


def downgrade() -> None:
    op.drop_index("ix_b3_fiis_dividends_trade_date", table_name="b3_fiis_dividends")
    op.drop_index("ix_b3_fiis_dividends_ticker", table_name="b3_fiis_dividends")
    op.drop_table("b3_fiis_dividends")
