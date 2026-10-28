"""Legacy Supabase users migration kept for Alembic history."""

from typing import Sequence, Union


revision: str = "705ae752d65e"
down_revision: Union[str, Sequence[str], None] = "3a4bdcf67ec9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """The portable baseline already creates the users table."""
    return


def downgrade() -> None:
    return
