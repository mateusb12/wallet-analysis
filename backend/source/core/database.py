import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

project_root = Path(__file__).resolve().parents[3]
load_dotenv(project_root / ".env")
load_dotenv(project_root / "backend" / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")

# Also support Coolify stacks that expose PostgreSQL connection parts instead
# of a single DATABASE_URL variable.
if not DATABASE_URL and os.getenv("POSTGRES_HOST"):
    DATABASE_URL = URL.create(
        "postgresql+psycopg2",
        username=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
        host=os.getenv("POSTGRES_HOST"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.getenv("POSTGRES_DB"),
    )

if DATABASE_URL and str(DATABASE_URL).startswith("sqlite:///./"):
    relative_path = DATABASE_URL.removeprefix("sqlite:///./")
    DATABASE_URL = f"sqlite:///{project_root / relative_path}"

# Coolify commonly exposes PostgreSQL connection strings with the generic
# ``postgres://`` scheme. SQLAlchemy expects the PostgreSQL dialect scheme.
if DATABASE_URL and str(DATABASE_URL).startswith("postgres://"):
    DATABASE_URL = f"postgresql+psycopg2://{DATABASE_URL.removeprefix('postgres://')}"

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in .env")

is_sqlite = str(DATABASE_URL).startswith("sqlite")
engine_options = {"connect_args": {"check_same_thread": False}} if is_sqlite else {}
engine = create_engine(DATABASE_URL, **engine_options)

# Create a Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for your models
Base = declarative_base()

# Dependency to use in FastAPI endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
