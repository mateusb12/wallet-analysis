"""Remove the structural dependency on Supabase auth.users."""

from typing import Sequence, Union

revision: str = "4c2a7e9b1d10"
down_revision: Union[str, Sequence[str], None] = "34cdd836ac18"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Historical Supabase migration; the portable baseline has no auth.users FK.
    return


def downgrade() -> None:
    return
