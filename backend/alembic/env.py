import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from dotenv import load_dotenv

from alembic import context

# -------------------------------------------------------------------------
# 1. PATH INJECTION (The Fix)
# -------------------------------------------------------------------------
# Get the absolute path of this file (backend/alembic/env.py)
current_filepath = os.path.abspath(__file__)
alembic_dir = os.path.dirname(current_filepath)     # .../backend/alembic
backend_dir = os.path.dirname(alembic_dir)          # .../backend
project_root = os.path.dirname(backend_dir)         # .../wallet-analysis (Parent of backend)

# Add the project root to sys.path.
# This allows "from backend.source..." imports to work.
sys.path.insert(0, project_root)

# (Optional) Add backend_dir if you have imports like "from source..."
sys.path.insert(0, backend_dir)

# -------------------------------------------------------------------------
# 2. LOAD ENVIRONMENT VARIABLES
# -------------------------------------------------------------------------
load_dotenv(os.path.join(backend_dir, ".env"))

# -------------------------------------------------------------------------
# 3. IMPORT MODELS
# -------------------------------------------------------------------------
# Now this import will work because 'backend' is visible from 'project_root'
from backend.source.core.database import Base
from backend.source.models.sql_models import * # Import all your SQL models here

# -------------------------------------------------------------------------
# 4. ALEMBIC CONFIGURATION
# -------------------------------------------------------------------------
config = context.config

# Overwrite the sqlalchemy.url in the config with the one from .env
db_url = os.getenv("DATABASE_URL")
if not db_url:
    raise ValueError("DATABASE_URL is missing from .env")

config.set_main_option("sqlalchemy.url", db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
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
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()