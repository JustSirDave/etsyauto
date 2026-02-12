"""
AI Generation API Endpoints
Stats and history for AI-generated content
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from typing import List

from app.api.dependencies import get_user_context, UserContext, require_permission
from app.core.database import get_db
from app.core.rbac import Permission
from app.core.query_helpers import filter_by_tenant
from app.models.listings import AIGeneration, Product

router = APIRouter()


@router.get("/stats", tags=["AI"])
async def get_ai_stats(
    context: UserContext = Depends(require_permission(Permission.READ_PRODUCT)),  # AI stats tied to products
    db: Session = Depends(get_db)
):
    """
    Get AI generation statistics for dashboard cards
    Requires: READ_PRODUCT permission (all roles have access to AI stats)

    Returns:
        Statistics about AI generations including total count, success rate,
        average response time, and this month's growth
    """
    # Filter by tenant
    base_query = filter_by_tenant(db.query(AIGeneration), context.tenant_id, AIGeneration.tenant_id)

    # Get total generations count
    total_generations = base_query.count()

    # Calculate success rate (ok vs flagged)
    ok_count = base_query.filter(AIGeneration.status == 'ok').count()

    success_rate = (ok_count / total_generations * 100) if total_generations > 0 else 0

    # Calculate this month's growth
    now = datetime.now(timezone.utc)
    first_day_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    first_day_last_month = (first_day_this_month - timedelta(days=1)).replace(day=1)

    this_month_count = base_query.filter(AIGeneration.created_at >= first_day_this_month).count()

    last_month_count = base_query.filter(
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

    # Average response time from actual generation data
    avg_time_result = base_query.filter(
        AIGeneration.generation_time_ms.isnot(None)
    ).with_entities(func.avg(AIGeneration.generation_time_ms)).scalar()
    avg_response_time_ms = round(float(avg_time_result)) if avg_time_result else 0

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
    context: UserContext = Depends(require_permission(Permission.READ_PRODUCT)),
    db: Session = Depends(get_db)
):
    """
    Get recent AI generations with product information
    Requires: READ_PRODUCT permission (all roles)

    Args:
        limit: Maximum number of recent generations to return (default: 10)

    Returns:
        List of recent AI generations with product names and metadata
    """
    # Query recent generations with product join, filtered by tenant
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
        AIGeneration.tenant_id == context.tenant_id,
        Product.tenant_id == context.tenant_id
    ).order_by(
        AIGeneration.created_at.desc()
    ).limit(limit).all()

    # Format response
    result = []
    for gen in generations:
        # Determine generation type based on what was generated
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


# Policy and Review Workflow Endpoints

@router.get("/generations/pending-review", tags=["AI Policy"])
async def get_pending_reviews(
    limit: int = 50,
    context: UserContext = Depends(require_permission(Permission.READ_PRODUCT)),
    db: Session = Depends(get_db)
):
    """
    Get AI generations that need review due to policy violations
    Requires: READ_PRODUCT permission
    
    Returns:
        List of generations with policy_status='failed' or 'needs_review'
    """
    from app.services.ai_generation_service import AIGenerationService
    
    service = AIGenerationService(db)
    pending = service.get_pending_reviews(context.tenant_id, limit=limit)
    
    return {
        "pending_reviews": [
            {
                "id": gen.id,
                "product_id": gen.product_id,
                "title": gen.title,
                "description": gen.description,
                "tags": gen.tags,
                "policy_status": gen.policy_status,
                "policy_flags": gen.policy_flags,
                "provider": gen.provider,
                "created_at": gen.created_at.isoformat() if gen.created_at else None
            }
            for gen in pending
        ],
        "total": len(pending)
    }


@router.post("/generations/{generation_id}/accept", tags=["AI Policy"])
async def accept_generation(
    generation_id: int,
    context: UserContext = Depends(require_permission(Permission.UPDATE_PRODUCT)),
    db: Session = Depends(get_db)
):
    """
    Accept generated content (mark as reviewed and approved)
    Requires: UPDATE_PRODUCT permission (Creator+)
    """
    from app.services.ai_generation_service import AIGenerationService
    
    service = AIGenerationService(db)
    
    # Get generation filtered by tenant_id to prevent cross-tenant access
    generation = db.query(AIGeneration).filter(
        AIGeneration.id == generation_id,
        AIGeneration.tenant_id == context.tenant_id
    ).first()
    
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")
    
    # Review and accept
    updated = service.review_generation(
        generation_id=generation_id,
        user_id=context.user_id,
        decision='accepted'
    )
    
    return {
        "message": "Generation accepted",
        "generation_id": updated.id,
        "review_decision": updated.review_decision,
        "reviewed_at": updated.reviewed_at.isoformat() if updated.reviewed_at else None
    }


@router.post("/generations/{generation_id}/reject", tags=["AI Policy"])
async def reject_generation(
    generation_id: int,
    context: UserContext = Depends(require_permission(Permission.UPDATE_PRODUCT)),
    db: Session = Depends(get_db)
):
    """
    Reject generated content (mark as reviewed and rejected)
    Requires: UPDATE_PRODUCT permission (Creator+)
    """
    from app.services.ai_generation_service import AIGenerationService
    
    service = AIGenerationService(db)
    
    # Get generation filtered by tenant_id to prevent cross-tenant access
    generation = db.query(AIGeneration).filter(
        AIGeneration.id == generation_id,
        AIGeneration.tenant_id == context.tenant_id
    ).first()
    
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")
    
    # Review and reject
    updated = service.review_generation(
        generation_id=generation_id,
        user_id=context.user_id,
        decision='rejected'
    )
    
    return {
        "message": "Generation rejected",
        "generation_id": updated.id,
        "review_decision": updated.review_decision,
        "reviewed_at": updated.reviewed_at.isoformat() if updated.reviewed_at else None
    }


@router.post("/generations/{generation_id}/modify", tags=["AI Policy"])
async def modify_generation(
    generation_id: int,
    title: str = None,
    description: str = None,
    tags: List[str] = None,
    context: UserContext = Depends(require_permission(Permission.UPDATE_PRODUCT)),
    db: Session = Depends(get_db)
):
    """
    Modify and re-validate generated content
    Requires: UPDATE_PRODUCT permission (Creator+)
    
    The modified content will be automatically re-checked against policies
    """
    from app.services.ai_generation_service import AIGenerationService
    
    service = AIGenerationService(db)
    
    # Get generation filtered by tenant_id to prevent cross-tenant access
    generation = db.query(AIGeneration).filter(
        AIGeneration.id == generation_id,
        AIGeneration.tenant_id == context.tenant_id
    ).first()
    
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")
    
    # Build modified content
    modified_content = {}
    if title:
        modified_content['title'] = title
    if description:
        modified_content['description'] = description
    if tags:
        modified_content['tags'] = tags
    
    if not modified_content:
        raise HTTPException(
            status_code=400, 
            detail="At least one field (title, description, or tags) must be provided"
        )
    
    # Review with modifications (triggers re-policy-check)
    updated = service.review_generation(
        generation_id=generation_id,
        user_id=context.user_id,
        decision='modified',
        modified_content=modified_content
    )
    
    return {
        "message": "Generation modified and re-validated",
        "generation_id": updated.id,
        "policy_status": updated.policy_status,
        "policy_flags": updated.policy_flags,
        "review_decision": updated.review_decision,
        "reviewed_at": updated.reviewed_at.isoformat() if updated.reviewed_at else None,
        "title": updated.title,
        "description": updated.description,
        "tags": updated.tags
    }


@router.get("/generations/{generation_id}", tags=["AI Policy"])
async def get_generation_detail(
    generation_id: int,
    context: UserContext = Depends(require_permission(Permission.READ_PRODUCT)),
    db: Session = Depends(get_db)
):
    """
    Get detailed information about a specific generation
    Requires: READ_PRODUCT permission
    """
    # Get generation filtered by tenant_id to prevent cross-tenant access
    generation = db.query(AIGeneration).filter(
        AIGeneration.id == generation_id,
        AIGeneration.tenant_id == context.tenant_id
    ).first()
    
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")
    
    return {
        "id": generation.id,
        "product_id": generation.product_id,
        "title": generation.title,
        "description": generation.description,
        "tags": generation.tags,
        "policy_status": generation.policy_status,
        "policy_flags": generation.policy_flags,
        "policy_checked_at": generation.policy_checked_at.isoformat() if generation.policy_checked_at else None,
        "reviewed_by": generation.reviewed_by,
        "reviewed_at": generation.reviewed_at.isoformat() if generation.reviewed_at else None,
        "review_decision": generation.review_decision,
        "provider": generation.provider,
        "model": generation.model,
        "tokens_used": generation.tokens_used,
        "generation_time_ms": generation.generation_time_ms,
        "created_at": generation.created_at.isoformat() if generation.created_at else None
    }
