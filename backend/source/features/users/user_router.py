from fastapi import APIRouter, Depends, HTTPException, status
import json

from backend.source.core.dependencies import get_user_repository
from backend.source.features.auth.jwt_identity_extraction import get_current_user
from backend.source.features.users.user_schemas import UserUpdate, UserResponse
from backend.source.persistence.ports import UserRepository

user_bp = APIRouter(prefix="/users", tags=["Users"])


@user_bp.patch("/me", response_model=UserResponse)
def update_user_profile(
        payload: UserUpdate,
        users: UserRepository = Depends(get_user_repository),
        current_user=Depends(get_current_user)
):
    """
    Atualiza o perfil do usuário logado.
    """
    print("\n" + "█" * 50)
    print(f"📥 [BACKEND PATCH] Recebido pedido de atualização para User: {current_user}")

    # 1. Debug do Payload
    dados_recebidos = payload.dict(exclude_unset=True)
    if 'balancing_settings' in dados_recebidos:
        print(f"📦 [BACKEND PATCH] Payload contém 'balancing_settings':")
        print(json.dumps(dados_recebidos['balancing_settings'], indent=2))
    else:
        print("⚠️ [BACKEND PATCH] Payload NÃO contém 'balancing_settings'")

    # 2. Busca o usuário
    user_profile = users.get_by_id(current_user)

    if not user_profile:
        print("❌ [BACKEND PATCH] Usuário não encontrado no DB")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found"
        )

    # 3. Atualiza os campos no objeto do banco
    for key, value in dados_recebidos.items():
        print(f"🔄 [BACKEND PATCH] Atualizando campo '{key}'")
        setattr(user_profile, key, value)

    # 4. Salva no banco
    try:
        user_profile = users.update(user_profile, dados_recebidos)

        print("💾 [BACKEND PATCH] Commit realizado com sucesso!")
        print(f"🧐 [BACKEND DB CHECK] Valor salvo no objeto do banco: {user_profile.balancing_settings}")

    except Exception as e:
        print(f"🔥 [BACKEND ERROR] Erro ao salvar: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    print("█" * 50 + "\n")
    return user_profile


@user_bp.get("/me", response_model=UserResponse)
def get_user_profile(
        users: UserRepository = Depends(get_user_repository),
        current_user=Depends(get_current_user)
):
    """
    Retorna os dados do perfil público do usuário logado.
    """
    print("\n" + "═" * 50)
    print(f"📤 [BACKEND GET] Solicitado perfil do usuário (F5): {current_user}")

    user_profile = users.get_by_id(current_user)

    if not user_profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # DEBUG CRÍTICO: Ver o que está saindo do banco
    settings = user_profile.balancing_settings
    print(f"🔍 [BACKEND GET] Dados brutos no DB: {settings}")

    if settings is None:
        print("⚠️ [BACKEND GET] O campo 'balancing_settings' está NULL no banco.")
    else:
        print("✅ [BACKEND GET] O campo existe no banco.")

    # Teste de Validação Pydantic (Simula o filtro de saída)
    try:
        from backend.source.features.users.user_schemas import UserResponse
        teste = UserResponse.model_validate(user_profile)
        if teste.balancing_settings is None and settings is not None:
            print("🚨🚨🚨 [ALERTA VERMELHO] O Pydantic apagou o dado! O erro está no user_schemas.py 🚨🚨🚨")
        else:
            print("✅ [BACKEND VALIDATION] Pydantic manteve o dado corretamente.")
    except Exception as e:
        print(f"⚠️ Erro ao validar debug: {e}")

    print("═" * 50 + "\n")
    return user_profile
