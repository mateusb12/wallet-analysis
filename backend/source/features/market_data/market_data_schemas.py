from pydantic import BaseModel

class TickerSync(BaseModel):
    ticker: str