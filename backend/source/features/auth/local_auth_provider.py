import base64
import binascii
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4


class LocalAuthProvider:
    def __init__(self, store_path: str | None = None, secret: str | None = None):
        self._store_path = Path(store_path or os.getenv("LOCAL_AUTH_STORE", "./data/auth_users.json"))
        self._secret = (secret or os.getenv("AUTH_SECRET_KEY", "dev-only-change-me")).encode()

    def login(self, email: str, password: str) -> dict:
        users = self._read_users()
        user = users.get(email.lower())
        if not user or not self._verify_password(password, user["password"]):
            raise ValueError("Invalid email or password")
        return self._session(user)

    def register(self, email: str, password: str) -> dict:
        email = email.lower()
        users = self._read_users()
        if email in users:
            return {"message": "User already registered", "user": {"identities": []}, "session": None}

        user = {
            "id": str(uuid4()),
            "email": email,
            "full_name": None,
            "avatar_url": None,
            "password": self._hash_password(password),
        }
        users[email] = user
        self._write_users(users)
        return {"message": "User created successfully", "user": self._public_user(user), "session": None}

    def get_user(self, token: str) -> dict:
        payload = self._decode_token(token)
        users = self._read_users()
        user = next((item for item in users.values() if item["id"] == payload["sub"]), None)
        if not user:
            raise ValueError("Invalid Authentication Token")
        return self._public_user(user)

    def _session(self, user: dict) -> dict:
        access_token = self._encode_token(user["id"])
        return {
            "user": self._public_user(user),
            "session": {
                "access_token": access_token,
                "refresh_token": access_token,
                "user": self._public_user(user),
            },
        }

    def _public_user(self, user: dict) -> dict:
        return {
            "id": user["id"],
            "email": user["email"],
            "user_metadata": {
                "full_name": user.get("full_name"),
                "avatar_url": user.get("avatar_url"),
            },
        }

    def _read_users(self) -> dict:
        if not self._store_path.exists():
            return {}
        return json.loads(self._store_path.read_text())

    def _write_users(self, users: dict) -> None:
        self._store_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = self._store_path.with_suffix(".tmp")
        temporary_path.write_text(json.dumps(users, indent=2))
        temporary_path.replace(self._store_path)

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
        salt_encoded, digest_encoded = encoded.split(":")
        salt = base64.urlsafe_b64decode(salt_encoded)
        expected = base64.urlsafe_b64decode(digest_encoded)
        actual = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
        return hmac.compare_digest(actual, expected)

    def _encode_token(self, user_id: str) -> str:
        payload = {
            "sub": user_id,
            "exp": int((datetime.now(timezone.utc) + timedelta(days=7)).timestamp()),
        }
        body = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
        signature = hmac.new(self._secret, body.encode(), hashlib.sha256).digest()
        return f"{body}.{base64.urlsafe_b64encode(signature).decode().rstrip('=')}"

    def _decode_token(self, token: str) -> dict:
        try:
            body, encoded_signature = token.split(".", 1)
            expected = hmac.new(self._secret, body.encode(), hashlib.sha256).digest()
            signature = base64.urlsafe_b64decode(encoded_signature + "=" * (-len(encoded_signature) % 4))
            if not hmac.compare_digest(signature, expected):
                raise ValueError("Invalid token signature")
            payload = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
            if payload["exp"] < datetime.now(timezone.utc).timestamp():
                raise ValueError("Expired token")
            return payload
        except (KeyError, ValueError, binascii.Error, json.JSONDecodeError, TypeError) as exc:
            raise ValueError("Invalid Authentication Token") from exc
