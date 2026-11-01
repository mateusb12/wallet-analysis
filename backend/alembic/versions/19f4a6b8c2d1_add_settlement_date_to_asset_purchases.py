"""Keep trade and settlement dates separately for purchases."""

from alembic import op
import sqlalchemy as sa


revision = "19f4a6b8c2d1"
down_revision = "8f1c2d3e4a5b"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("asset_purchases") as batch_op:
        batch_op.alter_column(
            "trade_date",
            new_column_name="settlement_date",
            existing_type=sa.Date(),
            existing_nullable=False,
        )

    with op.batch_alter_table("asset_purchases") as batch_op:
        batch_op.add_column(sa.Column("trade_date", sa.Date(), nullable=True))


def downgrade():
    with op.batch_alter_table("asset_purchases") as batch_op:
        batch_op.drop_column("trade_date")

    with op.batch_alter_table("asset_purchases") as batch_op:
        batch_op.alter_column(
            "settlement_date",
            new_column_name="trade_date",
            existing_type=sa.Date(),
            existing_nullable=False,
        )
