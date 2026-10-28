"""create scraper jobs table

Revision ID: 8f1c2d3e4a5b
Revises: 7c9d1e4a6b20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8f1c2d3e4a5b"
down_revision: Union[str, Sequence[str], None] = "7c9d1e4a6b20"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scraper_jobs",
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("job_id", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="idle"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("name"),
    )


def downgrade() -> None:
    op.drop_table("scraper_jobs")
