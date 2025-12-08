from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Depends
from supabase import Client, create_client
import os
from ..schemas import UserLogin, UserRegister

router = APIRouter(prefix="/auth", tags=["Auth"])

# Initialize Supabase Client (Singleton-ish for this module)
def get_supabase() -> Client:
    load_dotenv()
    url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("VITE_SUPABASE_SERVICE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase credentials missing")
    return create_client(url, key)

@router.post("/login")
def login(user: UserLogin):
    supabase = get_supabase()
    try:
        # Supabase Python client handles the validation against the DB
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