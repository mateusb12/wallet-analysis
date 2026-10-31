import os
import subprocess
import sys
import json
from datetime import datetime, timezone
from urllib.error import URLError
from urllib.request import Request, urlopen
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.source.core.database import SessionLocal, get_db
from backend.source.models.sql_models import ScraperJob

scraper_bp = APIRouter(prefix="/internal/scraper", tags=["scraper"])
SCRAPER_NAME = "main"
LOCAL_AGENT_URL = os.getenv("SCRAPER_LOCAL_AGENT_URL", "http://host.docker.internal:8765")


def notify_local_agent(path: str) -> None:
    if os.getenv("APP_ENV", "production").lower() != "development":
        return
    try:
        request = Request(f"{LOCAL_AGENT_URL}{path}", method="POST")
        with urlopen(request, timeout=5):
            return
    except URLError as error:
        raise HTTPException(
            status_code=503,
            detail="Agente local do scraper não está disponível.",
        ) from error


def read_local_agent(path: str) -> dict[str, Any]:
    if os.getenv("APP_ENV", "production").lower() != "development":
        return {"requests": []}
    try:
        with urlopen(f"{LOCAL_AGENT_URL}{path}", timeout=5) as response:
            return json.load(response)
    except URLError as error:
        raise HTTPException(
            status_code=503,
            detail="Agente local do scraper não está disponível.",
        ) from error


def stop_local_scraper() -> None:
    if os.getenv("APP_ENV", "production").lower() == "development":
        try:
            notify_local_agent("/pause")
        except HTTPException:
            pass
        db = SessionLocal()
        try:
            current_state = db.scalar(
                select(ScraperJob).where(ScraperJob.name == SCRAPER_NAME)
            )
            if current_state is not None and current_state.status == "running":
                current_state.status = "paused"
                current_state.finished_at = datetime.now(timezone.utc)
                db.commit()
        finally:
            db.close()


@scraper_bp.post("/run", status_code=status.HTTP_202_ACCEPTED)
def start_scraper(db: Session = Depends(get_db)) -> dict[str, Any]:
    current_state = db.scalar(
        select(ScraperJob)
        .where(ScraperJob.name == SCRAPER_NAME)
        .with_for_update()
    )

    if current_state is None:
        current_state = ScraperJob(name=SCRAPER_NAME, status="idle")
        db.add(current_state)
        db.flush()

    if current_state.status == "running":
        return {
            "status": "already_running",
            "job_id": current_state.job_id,
        }

    job_id = str(uuid4())
    current_state.job_id = job_id
    current_state.status = "running"
    current_state.started_at = None
    current_state.finished_at = None
    current_state.error = None
    db.commit()

    try:
        if os.getenv("APP_ENV", "production").lower() == "development":
            notify_local_agent("/run")
            current_state.started_at = datetime.now(timezone.utc)
            db.commit()
        else:
            subprocess.Popen(
                [sys.executable, "-m", "backend.source.features.scraper.scraper_runner"],
                env={**os.environ, "SCRAPER_JOB_ID": job_id},
                start_new_session=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
    except OSError as error:
        current_state.status = "failed"
        current_state.error = str(error)
        db.commit()
        raise HTTPException(status_code=500, detail="Não foi possível iniciar o scraper.") from error

    return {"status": "started", "job_id": job_id}


@scraper_bp.post("/pause", status_code=status.HTTP_202_ACCEPTED)
def pause_scraper(db: Session = Depends(get_db)) -> dict[str, Any]:
    current_state = db.scalar(
        select(ScraperJob).where(ScraperJob.name == SCRAPER_NAME)
    )

    if current_state is None or current_state.status != "running":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não existe uma job do scraper em execução.",
        )

    current_state.status = "paused"
    current_state.finished_at = datetime.now(timezone.utc)
    db.commit()
    if os.getenv("APP_ENV", "production").lower() == "development":
        notify_local_agent("/pause")
    return {"status": "paused", "job_id": current_state.job_id}


@scraper_bp.get("/status")
def scraper_status(db: Session = Depends(get_db)) -> dict[str, Any]:
    current_state = db.get(ScraperJob, SCRAPER_NAME)
    if current_state is None:
        return {
            "status": "idle",
            "job_id": None,
            "started_at": None,
            "finished_at": None,
            "error": None,
        }

    return {
        "status": current_state.status,
        "job_id": current_state.job_id,
        "started_at": current_state.started_at,
        "finished_at": current_state.finished_at,
        "error": current_state.error,
    }


@scraper_bp.get("/requests")
def scraper_requests() -> dict[str, Any]:
    return read_local_agent("/requests")
