from pydantic import BaseModel, ConfigDict
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

class AssetPurchaseResponse(BaseModel):
    id: int
    ticker: str
    type: str
    qty: float
    price: float
    trade_date: date

    model_config = ConfigDict(from_attributes=True)