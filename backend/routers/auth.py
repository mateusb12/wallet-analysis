from fastapi import APIRouter, HTTPException
from ..core.connections import get_supabase
from ..schemas import UserLogin, UserRegister

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/login")
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
        # Map Supabase errors to HTTP exceptions
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/register")
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