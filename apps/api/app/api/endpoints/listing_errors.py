"""
Listing Errors API Endpoints
Fetch and manage listing job errors
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from datetime import datetime, timedelta

from app.core.database import get_db
from app.api.dependencies import get_user_context, UserContext
from app.core.query_helpers import filter_by_tenant
from app.models.listings import ListingJob, Product
from app.models.tenancy import Shop

router = APIRouter()


@router.get("/errors", tags=["Listings"])
async def get_listing_errors(
    context: UserContext = Depends(get_user_context),
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None, description="Filter by status (failed, policy_blocked)"),
    shop_id: Optional[int] = Query(None, description="Filter by shop"),
    days: int = Query(7, description="Number of days to look back"),
    limit: int = Query(100, description="Max number of errors to return")
):
    """
    Get listing job errors for the current tenant.
    
    Returns errors from:
    - Failed jobs
    - Policy-blocked jobs
    - Jobs with error codes
    """
    # Calculate date threshold
    since_date = datetime.utcnow() - timedelta(days=days)
    
    # Build query
    query = db.query(ListingJob).filter(
        ListingJob.tenant_id == context.tenant_id,
        ListingJob.created_at >= since_date,
        ListingJob.status.in_(['failed', 'policy_blocked'])
    )
    
    # Apply filters
    if status:
        query = query.filter(ListingJob.status == status)
    
    if shop_id:
        query = query.filter(ListingJob.shop_id == shop_id)
    
    # Filter by allowed shops for non-admin users
    if context.role.lower() not in ('owner', 'admin') and context.allowed_shop_ids:
        query = query.filter(ListingJob.shop_id.in_(context.allowed_shop_ids))
    
    # Order by most recent first
    query = query.order_by(desc(ListingJob.created_at)).limit(limit)
    
    jobs = query.all()
    
    # Preload products and shops to avoid N+1 queries
    product_ids = [job.product_id for job in jobs if job.product_id]
    shop_ids = [job.shop_id for job in jobs if job.shop_id]
    
    products_map = {p.id: p for p in db.query(Product).filter(Product.id.in_(product_ids)).all()} if product_ids else {}
    shops_map = {s.id: s for s in db.query(Shop).filter(Shop.id.in_(shop_ids)).all()} if shop_ids else {}
    
    # Build error list with context
    errors = []
    for job in jobs:
        # Get product and shop from preloaded maps
        product = products_map.get(job.product_id)
        shop = shops_map.get(job.shop_id)
        
        errors.append({
            "id": job.id,
            "jobId": job.id,
            "productId": job.product_id,
            "shopId": job.shop_id,
            "listingId": job.etsy_listing_id,
            "errorCode": job.error_code or "UNKNOWN",
            "errorMessage": job.error_message or "An error occurred",
            "errorDetail": job.error_detail,
            "status": job.status,
            "retryCount": job.retry_count,
            "createdAt": job.created_at.isoformat(),
            "completedAt": job.completed_at.isoformat() if job.completed_at else None,
            "productName": product.title_raw if product else None,
            "shopName": shop.display_name if shop else None,
            "policyFlags": job.policy_flags if job.status == "policy_blocked" else None,
            "policyBlockReason": job.policy_block_reason if job.status == "policy_blocked" else None
        })
    
    return {
        "errors": errors,
        "total": len(errors),
        "filters": {
            "status": status,
            "shop_id": shop_id,
            "days": days
        }
    }


@router.post("/jobs/{job_id}/retry", tags=["Listings"])
async def retry_listing_job(
    job_id: int,
    context: UserContext = Depends(get_user_context),
    db: Session = Depends(get_db)
):
    """
    Retry a failed listing job.
    
    Resets the job to pending and queues it for re-processing.
    """
    # Get job
    job = db.query(ListingJob).filter(
        ListingJob.id == job_id,
        ListingJob.tenant_id == context.tenant_id
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Verify shop access for non-admin users
    if context.role.lower() not in ('owner', 'admin'):
        if not context.allowed_shop_ids or job.shop_id not in context.allowed_shop_ids:
            raise HTTPException(status_code=403, detail="Access denied to this shop")
    
    # Check if job can be retried
    if job.status not in ['failed', 'policy_blocked']:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot retry job with status '{job.status}'"
        )
    
    # Reset job for retry
    job.status = "pending"
    job.retry_count = (job.retry_count or 0)
    job.error_message = None
    job.error_code = None
    job.error_detail = None
    job.started_at = None
    job.completed_at = None
    
    # If it was policy-blocked, keep the policy info but allow retry
    # (in case policy was fixed or user wants to override)
    
    db.commit()
    
    # Queue for processing
    from app.worker.tasks.listing_tasks import publish_listing
    publish_listing.delay(job_id)
    
    return {
        "success": True,
        "job_id": job_id,
        "message": "Job queued for retry",
        "status": "pending"
    }


@router.get("/errors/summary", tags=["Listings"])
async def get_errors_summary(
    context: UserContext = Depends(get_user_context),
    db: Session = Depends(get_db),
    days: int = Query(7, description="Number of days to look back")
):
    """
    Get a summary of errors grouped by error code.
    
    Useful for dashboards and quick insights.
    """
    since_date = datetime.utcnow() - timedelta(days=days)
    
    query = db.query(ListingJob).filter(
        ListingJob.tenant_id == context.tenant_id,
        ListingJob.created_at >= since_date,
        ListingJob.status.in_(['failed', 'policy_blocked'])
    )
    
    # Filter by allowed shops
    if context.role.lower() not in ('owner', 'admin') and context.allowed_shop_ids:
        query = query.filter(ListingJob.shop_id.in_(context.allowed_shop_ids))
    
    jobs = query.all()
    
    # Group by error code
    error_counts = {}
    for job in jobs:
        code = job.error_code or "UNKNOWN"
        if code not in error_counts:
            error_counts[code] = {
                "code": code,
                "count": 0,
                "sample_message": job.error_message
            }
        error_counts[code]["count"] += 1
    
    return {
        "summary": list(error_counts.values()),
        "total_errors": len(jobs),
        "period_days": days
    }

