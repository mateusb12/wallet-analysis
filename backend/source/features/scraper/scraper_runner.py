import asyncio
import os
import sys
from datetime import datetime, timezone

from playwright.async_api import async_playwright
from sqlalchemy import select

from backend.source.core.database import SessionLocal
from backend.source.models.sql_models import ScraperJob
from backend.source.features.scraper.scraper_router import SCRAPER_NAME


async def run() -> int:
    job_id = os.environ.get("SCRAPER_JOB_ID")
    if not job_id:
        print("SCRAPER_JOB_ID não foi informado.", file=sys.stderr)
        return 1

    db = SessionLocal()
    job = db.scalar(
        select(ScraperJob).where(
            ScraperJob.name == SCRAPER_NAME,
            ScraperJob.job_id == job_id,
        )
    )
    if job is None:
        db.close()
        print("Job do scraper não encontrada no banco.", file=sys.stderr)
        return 1

    started_at = datetime.now(timezone.utc)
    job.started_at = started_at
    db.commit()

    try:
        target_url = os.getenv("SCRAPER_TARGET_URL", "about:blank")
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto(target_url, wait_until="domcontentloaded")
            print(f"Playwright abriu {target_url} para a job {job_id}.")
            await browser.close()

        job.status = "stopped"
        job.finished_at = datetime.now(timezone.utc)
        job.error = None
        db.commit()
        return 0
    except Exception as error:  # pragma: no cover - exercised by the real browser
        job.status = "failed"
        job.finished_at = datetime.now(timezone.utc)
        job.error = str(error)
        db.commit()
        print(f"Scraper falhou: {error}", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
