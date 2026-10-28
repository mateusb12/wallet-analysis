from fastapi import APIRouter, Depends, HTTPException
from backend.source.core.dependencies import get_auth_provider
from backend.source.features.auth.auth_provider import AuthProvider
from backend.source.features.auth.auth_schemas import UserLogin, UserRegister

auth_bp = APIRouter(prefix="/auth", tags=["Auth"])

@auth_bp.post("/login")
def login(user: UserLogin, auth: AuthProvider = Depends(get_auth_provider)):
    try:
        response = auth.login(user.email, user.password)
        return {
            "user": response["user"],
            "session": response["session"]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@auth_bp.post("/register")
def register(user: UserRegister, auth: AuthProvider = Depends(get_auth_provider)):
    if user.password != user.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    try:
        response = auth.register(user.email, user.password)
        return {
            "message": response.get("message", "User created successfully"),
            "user": response["user"],
            "session": response.get("session")
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
