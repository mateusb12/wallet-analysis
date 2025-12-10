import os

from dotenv import load_dotenv
from fastapi import HTTPException
from supabase import Client, create_client


def get_supabase() -> Client:
    load_dotenv()
    url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("VITE_SUPABASE_SERVICE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase credentials missing")
    return create_client(url, key)