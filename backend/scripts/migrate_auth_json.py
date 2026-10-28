"""One-time migration of the legacy local auth JSON store into users."""

import argparse
import json
from pathlib import Path

from backend.source.core.database import SessionLocal
from backend.source.models.sql_models import User


def migrate(source: Path) -> int:
    users = json.loads(source.read_text(encoding="utf-8"))
    session = SessionLocal()
    migrated = 0

    try:
        for email, payload in users.items():
            user_id = str(payload["id"])
            normalized_email = email.lower()
            user = session.get(User, user_id)
            if user is None:
                user = (
                    session.query(User)
                    .filter(User.email == normalized_email)
                    .one_or_none()
                )
            if user is None:
                user = User(id=user_id, email=normalized_email)
                session.add(user)

            user.id = user_id
            user.email = normalized_email
            user.password_hash = payload["password"]
            user.full_name = payload.get("full_name")
            user.avatar_url = payload.get("avatar_url")
            migrated += 1

        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

    return migrated


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    args = parser.parse_args()

    count = migrate(args.source)
    print(f"Usuários migrados: {count}")


if __name__ == "__main__":
    main()
