from fastapi import APIRouter, HTTPException
from backend.source.core.db import get_supabase
from backend.source.features.auth.auth_schemas import UserLogin, UserRegister

auth_bp = APIRouter(prefix="/auth", tags=["Auth"])

@auth_bp.post("/login")
def login(user: UserLogin):
    supabase = get_supabase()
    try:
        response = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password
        })
        return {
            "user": response.user,
            "session": response.session
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@auth_bp.post("/register")
def register(user: UserRegister):
    if user.password != user.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    supabase = get_supabase()
    try:
        response = supabase.auth.sign_up({
            "email": user.email,
            "password": user.password
        })
        return {
            "message": "User created successfully",
            "user": response.user,
            "session": response.session
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))