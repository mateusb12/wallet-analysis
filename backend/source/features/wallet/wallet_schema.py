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
    pass

# Request do Import em massa
class ImportPurchasesRequest(BaseModel):
    pass
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
    type: str
    subtype: Optional[str] = None
    sector: Optional[str] = None
    qty: float

    # --- PREÇOS ---
    avg_price: float              # PM "Real" (Dinheiro gasto / Qtd)
    avg_price_adjusted: float     # [NOVO] PM Ajustado (Considera descontos de dividendos na época)

    current_price: float          # Preço de Tela Atual (B3)
    current_adjusted: float       # [NOVO] Preço Ajustado Atual (Para cálculo de retorno total)

    # --- TOTAIS ---
    total_value: float            # Qty * Current Price (Saldo Real)

    # --- RENTABILIDADE REAL (CAIXA) ---
    profit: float                 # Ganho de Capital (Valorização da cota apenas)
    profit_percent: float

    # --- RENTABILIDADE TOTAL (PERFORMANCE) ---
    total_return_profit: float    # [NOVO] (Vl. Atual Ajustado - Custo Ajustado)
    total_return_percent: float   # [NOVO] % de retorno considerando dividendos reinvestidos teóricos

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
    type: str       # "buy" ou o tipo do ativo, dependendo do que vc quer exibir
    asset_type: str # Sugestão: adicionei para saber se é FII/Stock

class DashboardResponse(BaseModel):
    summary: DashboardSummary
    positions: List[PositionSnapshot]
    transactions: List[TransactionSnapshot]
    history: List[Dict] # Lista simplificada para o gráfico
    allocation: Dict[str, float] # Totais por categoria (stock, fii, etf)

    model_config = ConfigDict(from_attributes=True)