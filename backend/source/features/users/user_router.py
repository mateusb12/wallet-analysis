from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

# Ajuste os imports conforme a estrutura do seu projeto
from backend.source.core.database import get_db
from backend.source.features.analysis.analysis_router import get_current_user
from backend.source.features.users.user_schemas import UserUpdate, UserResponse
from backend.source.models.sql_models import User

user_bp = APIRouter(prefix="/users", tags=["Users"])


@user_bp.patch("/me", response_model=UserResponse)
def update_user_profile(
        payload: UserUpdate,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user)
):
    """
    Atualiza o perfil do usuário logado (Avatar, Nome, etc).
    """
    # 1. Busca o usuário na tabela public.users
    # (current_user.id vem do token JWT do Supabase Auth)
    user_profile = db.query(User).filter(User.id == current_user.id).first()

    if not user_profile:
        # Se a trigger falhou ou o usuário não existe no public schema
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found"
        )

    # 2. Atualiza apenas os campos enviados (PATCH)
    update_data = payload.dict(exclude_unset=True)

    for key, value in update_data.items():
        setattr(user_profile, key, value)

    # 3. Salva
    db.add(user_profile)
    db.commit()
    db.refresh(user_profile)

    return user_profile


@user_bp.get("/me", response_model=UserResponse)
def get_user_profile(
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user)
):
    """
    Retorna os dados do perfil público do usuário logado.
    """
    user_profile = db.query(User).filter(User.id == current_user.id).first()

    if not user_profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    return user_profile