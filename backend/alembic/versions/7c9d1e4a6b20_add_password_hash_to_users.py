"""Store local authentication credentials in the users table."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7c9d1e4a6b20"
down_revision: Union[str, Sequence[str], None] = "5e7f0a2b3c41"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "password_hash")
