from typing import Any, Protocol

from supabase import Client


class AuthProvider(Protocol):
    def login(self, email: str, password: str) -> Any:
        ...

    def register(self, email: str, password: str) -> Any:
        ...

    def get_user(self, token: str) -> Any:
        ...


class SupabaseAuthProvider:
    def __init__(self, client: Client):
        self._client = client

    def login(self, email: str, password: str) -> Any:
        response = self._client.auth.sign_in_with_password({"email": email, "password": password})
        return {
            "user": {"id": str(response.user.id), "email": response.user.email},
            "session": response.session,
        }

    def register(self, email: str, password: str) -> Any:
        response = self._client.auth.sign_up({"email": email, "password": password})
        return {
            "message": "User created successfully",
            "user": response.user,
            "session": response.session,
        }

    def get_user(self, token: str) -> Any:
        response = self._client.auth.get_user(token)
        return {"id": str(response.user.id), "email": response.user.email}
