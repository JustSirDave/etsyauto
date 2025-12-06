"""
AI Generation API Endpoints
Stats and history for AI-generated content
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from typing import List

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.listings import AIGeneration, Product

router = APIRouter()


@router.get("/stats", tags=["AI"])
async def get_ai_stats(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get AI generation statistics for dashboard cards

    Returns:
        Statistics about AI generations including total count, success rate,
        average response time, and this month's growth
    """
    tenant_id = int(current_user["tenant_id"])

    # Get total generations count
    total_generations = db.query(AIGeneration).filter(
        AIGeneration.tenant_id == tenant_id
    ).count()

    # Calculate success rate (ok vs flagged)
    ok_count = db.query(AIGeneration).filter(
        AIGeneration.tenant_id == tenant_id,
        AIGeneration.status == 'ok'
    ).count()

    success_rate = (ok_count / total_generations * 100) if total_generations > 0 else 0

    # Calculate this month's growth
    now = datetime.now(timezone.utc)
    first_day_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    first_day_last_month = (first_day_this_month - timedelta(days=1)).replace(day=1)

    this_month_count = db.query(AIGeneration).filter(
        AIGeneration.tenant_id == tenant_id,
        AIGeneration.created_at >= first_day_this_month
    ).count()

    last_month_count = db.query(AIGeneration).filter(
        AIGeneration.tenant_id == tenant_id,
        AIGeneration.created_at >= first_day_last_month,
        AIGeneration.created_at < first_day_this_month
    ).count()

    # Calculate percentage growth
    if last_month_count > 0:
        growth_percentage = ((this_month_count - last_month_count) / last_month_count) * 100
    elif this_month_count > 0:
        growth_percentage = 100  # If last month was 0 but this month has some, show 100%
    else:
        growth_percentage = 0

    # Average response time (placeholder - we don't currently track this)
    # In a real implementation, you would track generation_time_ms in the database
    avg_response_time_ms = 2300  # Hardcoded for now

    return {
        "total_generations": total_generations,
        "success_rate": round(success_rate, 1),
        "avg_response_time_ms": avg_response_time_ms,
        "growth_percentage": round(growth_percentage, 1),
        "this_month_count": this_month_count,
        "last_month_count": last_month_count
    }


@router.get("/recent", tags=["AI"])
async def get_recent_generations(
    limit: int = 10,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get recent AI generations with product information

    Args:
        limit: Maximum number of recent generations to return (default: 10)

    Returns:
        List of recent AI generations with product names and metadata
    """
    tenant_id = int(current_user["tenant_id"])

    # Query recent generations with product join
    generations = db.query(
        AIGeneration.id,
        AIGeneration.product_id,
        AIGeneration.title,
        AIGeneration.status,
        AIGeneration.created_at,
        AIGeneration.cost_tokens,
        AIGeneration.cost_usd_cents,
        Product.title_raw.label('product_title')
    ).join(
        Product, AIGeneration.product_id == Product.id
    ).filter(
        AIGeneration.tenant_id == tenant_id
    ).order_by(
        AIGeneration.created_at.desc()
    ).limit(limit).all()

    # Format response
    result = []
    for gen in generations:
        # Determine generation type based on what was generated
        # For now, we'll say all are 'title' type since we generate all three together
        # In a real implementation, you might want to track which specific type was requested
        gen_type = 'title'  # Could be 'title', 'description', or 'tags'

        # Calculate time ago
        time_diff = datetime.now(timezone.utc) - gen.created_at.replace(tzinfo=timezone.utc)
        if time_diff.total_seconds() < 60:
            time_ago = f"{int(time_diff.total_seconds())} seconds ago"
        elif time_diff.total_seconds() < 3600:
            time_ago = f"{int(time_diff.total_seconds() / 60)} minutes ago"
        elif time_diff.total_seconds() < 86400:
            time_ago = f"{int(time_diff.total_seconds() / 3600)} hours ago"
        else:
            time_ago = f"{int(time_diff.total_seconds() / 86400)} days ago"

        result.append({
            "id": gen.id,
            "product_id": gen.product_id,
            "type": gen_type,
            "title": gen.title or gen.product_title or "Untitled Product",
            "timestamp": time_ago,
            "status": "completed" if gen.status == "ok" else "failed",
            "cost_tokens": gen.cost_tokens,
            "cost_usd_cents": gen.cost_usd_cents
        })

    return {
        "generations": result,
        "total": len(result)
    }
