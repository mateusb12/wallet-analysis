import os

from fastapi import Depends
from sqlalchemy.orm import Session

from backend.source.core.database import get_db
from backend.source.core.db import get_supabase
from backend.source.features.auth.auth_provider import AuthProvider, SupabaseAuthProvider
from backend.source.features.auth.local_auth_provider import LocalAuthProvider
from backend.source.persistence.sqlalchemy_repositories import (
    SqlAlchemyUserRepository,
    SqlAlchemyWalletRepository,
)
from backend.source.persistence.supabase_repositories import (
    SupabaseAnalysisRepository,
    SupabaseB3Repository,
    SupabaseMarketDataRepository,
    SupabaseReferenceDataRepository,
)


def get_user_repository(
    db: Session = Depends(get_db),
) -> SqlAlchemyUserRepository:
    return SqlAlchemyUserRepository(db)


def get_wallet_repository(
    db: Session = Depends(get_db),
) -> SqlAlchemyWalletRepository:
    return SqlAlchemyWalletRepository(db)


def get_market_data_repository() -> SupabaseMarketDataRepository:
    return SupabaseMarketDataRepository(get_supabase())


def get_analysis_repository() -> SupabaseAnalysisRepository:
    return SupabaseAnalysisRepository(get_supabase())


def get_b3_repository() -> SupabaseB3Repository:
    return SupabaseB3Repository(get_supabase())


def get_reference_data_repository() -> SupabaseReferenceDataRepository:
    return SupabaseReferenceDataRepository(get_supabase())


def get_auth_provider() -> AuthProvider:
    if os.getenv("AUTH_PROVIDER", "supabase").lower() == "local":
        return LocalAuthProvider()
    return SupabaseAuthProvider(get_supabase())
