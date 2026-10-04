"""Initial portable schema baseline.

The project had accumulated migrations generated from an already-existing
Supabase database. A new installation must instead be able to create the
current schema from scratch, including SQLite.
"""

from typing import Sequence, Union

from alembic import op

from backend.source.core.database import Base


revision: str = "df33b7617cc2"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the current schema for a new database."""
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    """Drop the schema created by this baseline."""
    Base.metadata.drop_all(bind=op.get_bind())
