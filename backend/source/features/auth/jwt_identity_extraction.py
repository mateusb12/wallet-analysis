from fastapi import Depends, Header, HTTPException

from backend.source.core.dependencies import get_auth_provider
from backend.source.features.auth.auth_provider import AuthProvider


def get_current_user(
    authorization: str = Header(None),
    auth: AuthProvider = Depends(get_auth_provider),
):
    """
    Extrai o user_id do token Supabase JWT enviado no Header Authorization.
    Formato esperado: 'Bearer <token>'
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authentication Token")

    try:
        token = authorization.split(" ")[1]
        # Verifica o token com o Supabase Auth
        user_response = auth.get_user(token)

        if not user_response or not user_response.get("id"):
            raise HTTPException(status_code=401, detail="Invalid Authentication Token")

        return user_response["id"]

    except Exception as e:
        print(f"Auth Error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid Authentication Token")
