from pydantic import BaseModel, HttpUrl
from typing import Optional
from uuid import UUID
from datetime import datetime

# O que o Frontend envia para atualizar
class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None  # Recebe a URL (string)

# O que o Backend devolve (o objeto User completo)
class UserResponse(BaseModel):
    id: UUID
    email: Optional[str]
    full_name: Optional[str]
    avatar_url: Optional[str]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True # Antigo orm_mode