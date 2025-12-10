from pydantic import BaseModel

class SimulationRequest(BaseModel):
    ticker: str
    initial_investment: float
    monthly_deposit: float
    months: int