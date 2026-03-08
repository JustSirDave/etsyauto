"""
Celery Tasks for Keyword Research
Runs keyword research (Etsy + Google Trends) in background
"""
import asyncio
import logging

from app.worker.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.listings import KeywordResearch
from app.services.keyword_research import research_keyword

logger = logging.getLogger(__name__)


@celery_app.task(name="app.worker.tasks.keyword_tasks.run_keyword_research", bind=True, max_retries=2)
def run_keyword_research(
    self,
    research_id: int,
    seed: str,
    etsy_token: str | None = None,
) -> dict:
    """
    Run keyword research and update the KeywordResearch record.

    Args:
        research_id: KeywordResearch record ID
        seed: Seed keyword to research
        etsy_token: OAuth access token (optional; uses API key if not provided)
    """
    db = SessionLocal()
    try:
        rec = db.query(KeywordResearch).filter(KeywordResearch.id == research_id).first()
        if not rec:
            logger.warning("Keyword research record not found: id=%s", research_id)
            return {"success": False, "error": "Record not found"}

        rec.status = "running"
        db.commit()

        result = asyncio.run(research_keyword(seed, etsy_token))

        rec.primary_keyword = result["primary_keyword"]
        rec.longtail_keywords = result["longtail_keywords"]
        rec.top_tags = result["top_tags"]
        rec.raw_scores = result["raw_scores"]
        rec.status = "completed"
        rec.error_message = None
        db.commit()

        logger.info("Keyword research completed: id=%s seed=%s", research_id, seed)
        return {"success": True, "research_id": research_id}

    except Exception as exc:
        logger.exception("Keyword research failed: id=%s seed=%s", research_id, seed)
        rec = db.query(KeywordResearch).filter(KeywordResearch.id == research_id).first()
        if rec:
            rec.status = "failed"
            rec.error_message = str(exc)
            db.commit()
        raise self.retry(exc=exc, countdown=10)

    finally:
        db.close()
