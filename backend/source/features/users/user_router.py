from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

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
    Atualiza o perfil do usuário logado (Avatar, Nome, Configurações de Carteira, etc).
    """
    # 1. Busca o usuário
    user_profile = db.query(User).filter(User.id == current_user).first()

    if not user_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found"
        )

    # 2. Prepara os dados (excluindo o que não foi enviado)
    update_data = payload.dict(exclude_unset=True)

    # 3. Atualiza os campos no objeto do banco
    for key, value in update_data.items():
        setattr(user_profile, key, value)

    # 4. Salva no banco
    try:
        db.add(user_profile)
        db.commit()
        db.refresh(user_profile)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    return user_profile


@user_bp.get("/me", response_model=UserResponse)
def get_user_profile(
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user)
):
    """
    Retorna os dados do perfil público do usuário logado.
    """
    user_profile = db.query(User).filter(User.id == current_user).first()

    if not user_profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    return user_profile