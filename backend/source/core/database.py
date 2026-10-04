import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

project_root = Path(__file__).resolve().parents[3]
load_dotenv(project_root / ".env")
load_dotenv(project_root / "backend" / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in .env")

is_sqlite = DATABASE_URL.startswith("sqlite")
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
