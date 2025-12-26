import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from dotenv import load_dotenv

from alembic import context

# -------------------------------------------------------------------------
# 1. PATH INJECTION
# -------------------------------------------------------------------------
current_filepath = os.path.abspath(__file__)
alembic_dir = os.path.dirname(current_filepath)  # .../backend/alembic
backend_dir = os.path.dirname(alembic_dir)  # .../backend
project_root = os.path.dirname(backend_dir)  # .../wallet-analysis

sys.path.insert(0, project_root)
sys.path.insert(0, backend_dir)

# --- DEBUG PRINT (Pode remover depois se quiser) ---
print(f"DEBUG: Project Root: {project_root}")
print(f"DEBUG: Backend Dir: {backend_dir}")
# ---------------------------------------------------

# -------------------------------------------------------------------------
# 2. LOAD ENVIRONMENT VARIABLES
# -------------------------------------------------------------------------
load_dotenv(os.path.join(backend_dir, ".env"))

# -------------------------------------------------------------------------
# 3. IMPORT MODELS
# -------------------------------------------------------------------------
try:
    print("DEBUG: Tentando importar Base e Models...")

    from backend.source.core.database import Base
    from backend.source.models.sql_models import *  # IMPORTANTE: Importe o model do User aqui para registrar no metadata

    print("DEBUG: Importação concluída.")
except ImportError as e:
    print(f"ERROR: Falha ao importar models: {e}")
    raise e

# -------------------------------------------------------------------------
# 4. ALEMBIC CONFIGURATION
# -------------------------------------------------------------------------
config = context.config

db_url = os.getenv("DATABASE_URL")
if not db_url:
    raise ValueError("DATABASE_URL is missing from .env")

config.set_main_option("sqlalchemy.url", db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# --- DEBUG PRINT ---
print("-" * 30)
print("DEBUG: Tabelas detectadas no Base.metadata:")
for table_name in target_metadata.tables.keys():
    print(f" - {table_name}")
print("-" * 30)


# -------------------

# -------------------------------------------------------------------------
# 5. INCLUDE OBJECT HOOK (A CORREÇÃO PRINCIPAL)
# -------------------------------------------------------------------------
def include_object(object, name, type_, reflected, compare_to):
    """
    Filtra quais objetos o Alembic deve considerar na autogeração.
    Retorna False para ignorar objetos, True para incluir.
    """
    # Se for uma tabela e pertencer ao schema 'auth', IGNORAR.
    # Isso impede que o Alembic tente recriar a tabela auth.users que já existe no Supabase.
    if type_ == "table" and object.schema == "auth":
        return False

    return True


# -------------------------------------------------------------------------
# 6. MIGRATION RUNNERS
# -------------------------------------------------------------------------

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,  # <--- Adicionado aqui
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object  # <--- Adicionado aqui
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()