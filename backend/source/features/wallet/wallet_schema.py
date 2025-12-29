from pydantic import BaseModel, ConfigDict
from datetime import date
from typing import List, Optional

# Base comum para reaproveitar campos
class AssetPurchaseBase(BaseModel):
    ticker: str
    name: Optional[str] = None
    type: str
    qty: float
    price: float
    trade_date: date

# Usado na lista do Import (que já existia, mas agora herda da Base)
class AssetPurchaseCreate(AssetPurchaseBase):
    pass

# NOVO: Usado para criar/editar um único aporte (Frontend envia user_id junto)
class AssetPurchaseInput(AssetPurchaseBase):
    user_id: str

# Request do Import em massa
class ImportPurchasesRequest(BaseModel):
    user_id: str
    purchases: List[AssetPurchaseCreate]

# Resposta para o frontend
class AssetPurchaseResponse(AssetPurchaseBase):
    id: int

    model_config = ConfigDict(from_attributes=True)