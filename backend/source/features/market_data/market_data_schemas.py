from typing import Optional

from pydantic import BaseModel

class TickerSync(BaseModel):
    ticker: str
    force: Optional[bool] = False