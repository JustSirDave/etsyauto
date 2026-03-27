"""Debug log endpoint (router is only registered when ENVIRONMENT is not production)."""
import json
import logging
import os

from fastapi import APIRouter, Request

logger = logging.getLogger(__name__)

router = APIRouter()

DEBUG_LOG_PATH = os.environ.get("DEBUG_LOG_PATH", "/debug-logs/debug.log")


@router.post("/log")
async def debug_log(request: Request):
    """Accept client debug logs and append to file (NDJSON). Used for debugging."""
    try:
        body = await request.json()
        line = (body if isinstance(body, str) else json.dumps(body)) + "\n"
        with open(DEBUG_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(line)
        return {"ok": True}
    except Exception as e:
        logger.warning("debug_log failed: %s", e)
        return {"ok": False, "error": str(e)}
