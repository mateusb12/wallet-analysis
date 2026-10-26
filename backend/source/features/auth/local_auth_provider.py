import base64
import binascii
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.source.models.sql_models import User


class LocalAuthProvider:
    """Local authentication backed by the application's users table."""

    def __init__(self, session: Session, secret: str | None = None):
        self._session = session
        self._secret = (secret or os.getenv("AUTH_SECRET_KEY", "dev-only-change-me")).encode()

    def login(self, email: str, password: str) -> dict:
        user = self._find_by_email(email)
        if not user or not user.password_hash or not self._verify_password(password, user.password_hash):
            raise ValueError("Invalid email or password")
        return self._session_response(user)

    def register(self, email: str, password: str) -> dict:
        email = email.lower()
        if self._find_by_email(email):
            return {"message": "User already registered", "user": {"identities": []}, "session": None}

        user = User(
            id=str(uuid4()),
            email=email,
            password_hash=self._hash_password(password),
        )
        try:
            self._session.add(user)
            self._session.commit()
            self._session.refresh(user)
        except IntegrityError as exc:
            self._session.rollback()
            raise ValueError("User already registered") from exc

        return {
            "message": "User created successfully",
            "user": self._public_user(user),
            "session": None,
        }

    def get_user(self, token: str) -> dict:
        payload = self._decode_token(token)
        user = self._session.get(User, payload["sub"])
        if not user:
            raise ValueError("Invalid Authentication Token")
        return self._public_user(user)

    def _find_by_email(self, email: str) -> User | None:
        return (
            self._session.query(User)
            .filter(func.lower(User.email) == email.lower())
            .first()
        )

    def _session_response(self, user: User) -> dict:
        access_token = self._encode_token(user.id)
        public_user = self._public_user(user)
        return {
            "user": public_user,
            "session": {
                "access_token": access_token,
                "refresh_token": access_token,
                "user": public_user,
            },
        }

    @staticmethod
    def _public_user(user: User) -> dict:
        return {
            "id": str(user.id),
            "email": user.email,
            "user_metadata": {
                "full_name": user.full_name,
                "avatar_url": user.avatar_url,
            },
        }

    @staticmethod
    def _hash_password(password: str) -> str:
        salt = secrets.token_bytes(16)
        digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
        return ":".join(
            base64.urlsafe_b64encode(value).decode()
            for value in (salt, digest)
        )

    @staticmethod
    def _verify_password(password: str, encoded: str) -> bool:
        try:
            salt_encoded, digest_encoded = encoded.split(":")
            salt = base64.urlsafe_b64decode(salt_encoded)
            expected = base64.urlsafe_b64decode(digest_encoded)
            actual = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
            return hmac.compare_digest(actual, expected)
        except (ValueError, binascii.Error):
            return False

    def _encode_token(self, user_id: str) -> str:
        payload = {
            "sub": user_id,
            "exp": int((datetime.now(timezone.utc) + timedelta(days=7)).timestamp()),
        }
        body = base64.urlsafe_b64encode(
            json.dumps(payload, separators=(",", ":")).encode()
        ).decode().rstrip("=")
        signature = hmac.new(self._secret, body.encode(), hashlib.sha256).digest()
        return f"{body}.{base64.urlsafe_b64encode(signature).decode().rstrip('=')}"

    def _decode_token(self, token: str) -> dict:
        try:
            body, encoded_signature = token.split(".", 1)
            expected = hmac.new(self._secret, body.encode(), hashlib.sha256).digest()
            signature = base64.urlsafe_b64decode(
                encoded_signature + "=" * (-len(encoded_signature) % 4)
            )
            if not hmac.compare_digest(signature, expected):
                raise ValueError("Invalid token signature")
            payload = json.loads(
                base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))
            )
            if payload["exp"] < datetime.now(timezone.utc).timestamp():
                raise ValueError("Expired token")
            return payload
        except (KeyError, ValueError, binascii.Error, json.JSONDecodeError, TypeError) as exc:
            raise ValueError("Invalid Authentication Token") from exc
