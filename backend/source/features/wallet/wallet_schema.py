from pydantic import BaseModel, ConfigDict
from datetime import date
from typing import List, Optional, Dict


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

class HistoryPoint(BaseModel):
    trade_date: str
    portfolio_value: float
    benchmark_value: float

class PositionSnapshot(BaseModel):
    ticker: str
    name: Optional[str] = None
    type: str  # stock, fii, etf
    subtype: Optional[str] = None # <--- NOVO: Ex: "FII - Papel", "Ação - Bancos"
    sector: Optional[str] = None
    qty: float
    avg_price: float
    current_price: float
    total_value: float # qty * current_price
    profit: float      # total_value - (qty * avg_price)
    profit_percent: float
    allocation_percent: float # % em relação ao total da carteira

class DashboardSummary(BaseModel):
    total_invested: float
    total_current: float
    total_profit: float
    total_profit_percent: float
    best_performer: Optional[str] = None
    worst_performer: Optional[str] = None

class CategoryTotal(BaseModel):
    label: str
    total: float
    percent: float

class TransactionSnapshot(BaseModel):
    ticker: str
    price: float
    qty: float
    trade_date: date
    type: str       # "buy" ou o tipo do ativo, dependendo do que vc quer exibir
    asset_type: str # Sugestão: adicionei para saber se é FII/Stock

class DashboardResponse(BaseModel):
    summary: DashboardSummary
    positions: List[PositionSnapshot]
    transactions: List[TransactionSnapshot]
    history: List[Dict] # Lista simplificada para o gráfico
    allocation: Dict[str, float] # Totais por categoria (stock, fii, etf)

    model_config = ConfigDict(from_attributes=True)