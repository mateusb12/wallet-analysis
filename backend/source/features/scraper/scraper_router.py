import os
import subprocess
import sys
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.source.core.database import get_db
from backend.source.models.sql_models import ScraperJob

scraper_bp = APIRouter(prefix="/internal/scraper", tags=["scraper"])
SCRAPER_NAME = "main"


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
