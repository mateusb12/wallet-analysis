from pydantic import BaseModel
from datetime import date
from typing import List, Optional

class AssetPurchaseCreate(BaseModel):
    ticker: str
    name: Optional[str] = None
    type: str
    qty: float
    price: float
    trade_date: date

class ImportPurchasesRequest(BaseModel):
    user_id: str
    purchases: List[AssetPurchaseCreate]