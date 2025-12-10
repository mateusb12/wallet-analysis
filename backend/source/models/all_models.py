from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

# --- Core User Entities ---
class User(BaseModel):
    id: str
    email: EmailStr

# --- Core Market Entities ---
class TickerPrice(BaseModel):
    ticker: str
    trade_date: str  # YYYY-MM-DD
    open: float
    high: float
    low: float
    close: float
    volume: float
    inserted_at: Optional[datetime] = None

class IfixRecord(BaseModel):
    trade_date: str
    close_value: float