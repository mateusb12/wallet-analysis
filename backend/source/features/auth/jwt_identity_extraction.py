from fastapi import Header, HTTPException

from backend.source.core.db import get_supabase


def get_current_user(authorization: str = Header(None)):
    """
    Extrai o user_id do token Supabase JWT enviado no Header Authorization.
    Formato esperado: 'Bearer <token>'
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authentication Token")

    try:
        token = authorization.split(" ")[1]
        supabase = get_supabase()

        # Verifica o token com o Supabase Auth
        user_response = supabase.auth.get_user(token)

        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid Authentication Token")

        return user_response.user.id

    except Exception as e:
        print(f"Auth Error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid Authentication Token")