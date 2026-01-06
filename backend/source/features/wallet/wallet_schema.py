from pydantic import BaseModel, ConfigDict
from datetime import date
from typing import List, Optional, Dict, Any


# Base comum para reaproveitar campos
class AssetPurchaseBase(BaseModel):
    ticker: str
    name: Optional[str] = None
    type: str
    qty: float
    price: float
    trade_date: date

# Usado na lista do Import
class AssetPurchaseCreate(AssetPurchaseBase):
    pass

# Usado para criar/editar um único aporte
class AssetPurchaseInput(AssetPurchaseBase):
    pass

# Request do Import em massa
class ImportPurchasesRequest(BaseModel):
    purchases: List[AssetPurchaseCreate]

# Resposta para o frontend
class AssetPurchaseResponse(AssetPurchaseBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class HistoryPoint(BaseModel):
    trade_date: str
    portfolio_value: float
    benchmark_value: float

# [NOVO] Modelo para o detalhamento anual
class YearlyPerformance(BaseModel):
    year: int
    value: float # Percentual de retorno no ano
    start_price: float
    end_price: float

class PositionSnapshot(BaseModel):
    ticker: str
    name: Optional[str] = None
    type: str
    subtype: Optional[str] = None
    sector: Optional[str] = None
    qty: float

    # --- PREÇOS ---
    avg_price: float              # PM "Real"
    avg_price_adjusted: float     # PM Ajustado
    current_price: float          # Preço de Tela Atual
    current_adjusted: float       # Preço Ajustado Atual

    # --- TOTAIS ---
    total_value: float            # Saldo Real

    # --- RENTABILIDADE REAL (CAIXA) ---
    profit: float
    profit_percent: float

    # --- RENTABILIDADE TOTAL (PERFORMANCE) ---
    total_return_profit: float
    total_return_percent: float

    # [NOVO] Detalhamento Ano a Ano para o Tooltip
    yearly_breakdown: List[YearlyPerformance] = []

    allocation_percent: float
    age: str

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
    type: str
    asset_type: str

class DashboardResponse(BaseModel):
    summary: DashboardSummary
    positions: List[PositionSnapshot]
    transactions: List[TransactionSnapshot]
    history: List[Dict]
    allocation: Dict[str, float]

    model_config = ConfigDict(from_attributes=True)