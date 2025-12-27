from pydantic import BaseModel, HttpUrl, EmailStr
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime

# O que o Frontend envia para atualizar
class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    password: Optional[str] = None
    email: Optional[EmailStr] = None
    balancing_settings: Optional[Dict[str, Any]] = None


# O que o Backend devolve (o objeto User completo)
class UserResponse(BaseModel):
    id: UUID
    email: Optional[str]
    full_name: Optional[str]
    avatar_url: Optional[str]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True # Antigo orm_mode