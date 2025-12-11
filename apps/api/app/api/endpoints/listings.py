"""
Listing Jobs API Endpoints
CRUD operations for managing listing publication jobs
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel

from app.api.dependencies import get_current_user, get_user_context, UserContext, require_permission, require_shop_access
from app.core.database import get_db
from app.core.rbac import Permission
from app.core.query_helpers import filter_by_tenant, filter_by_tenant_and_shops, ensure_tenant_access, ensure_shop_access
from app.models.listings import ListingJob, Product
from app.models.tenancy import Shop
from app.worker.tasks.listing_tasks import publish_listing, cancel_listing_job

router = APIRouter()


# Request/Response Models
class ListingJobCreate(BaseModel):
    product_id: int
    shop_id: int


class ListingJobResponse(BaseModel):
    id: int
    product_id: int
    shop_id: int
    etsy_listing_id: Optional[str]
    status: str
    error_message: Optional[str]
    retry_count: int
    scheduled_for: Optional[str]
    started_at: Optional[str]
    completed_at: Optional[str]
    created_at: str

    class Config:
        from_attributes = True


@router.get("/", tags=["Listings"])
async def get_listing_jobs(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    context: UserContext = Depends(require_permission(Permission.READ_LISTING)),
    db: Session = Depends(get_db)
):
    """
    Get all listing jobs for the current tenant
    Requires: READ_LISTING permission (all roles)
    
    Args:
        status: Optional filter by status (pending, scheduled, processing, completed, failed, cancelled)
        skip: Number of records to skip
        limit: Maximum number of records to return
    
    Returns:
        List of listing jobs with pagination info
    """
    # Filter by tenant and shops
    query = filter_by_tenant_and_shops(
        db.query(ListingJob),
        ListingJob.tenant_id,
        ListingJob.shop_id,
        context,
        db
    )
    
    if status:
        query = query.filter(ListingJob.status == status if hasattr(ListingJob, 'status') else ListingJob.state == status)
    
    # Get total count
    total = query.count()
    
    # Get paginated results
    jobs = query.order_by(ListingJob.created_at.desc()).offset(skip).limit(limit).all()
    
    # Format response
    job_list = []
    for job in jobs:
        job_list.append({
            "id": job.id,
            "product_id": job.product_id,
            "shop_id": job.shop_id,
            "etsy_listing_id": job.etsy_listing_id,
            "status": job.status if hasattr(job, 'status') else job.state,
            "error_message": job.error_message if hasattr(job, 'error_message') else (job.error_detail.get('message') if job.error_detail else None),
            "retry_count": job.retry_count if hasattr(job, 'retry_count') else job.attempts,
            "scheduled_for": job.scheduled_for.isoformat() if hasattr(job, 'scheduled_for') and job.scheduled_for else None,
            "started_at": job.started_at.isoformat() if hasattr(job, 'started_at') and job.started_at else None,
            "completed_at": job.completed_at.isoformat() if hasattr(job, 'completed_at') and job.completed_at else None,
            "created_at": job.created_at.isoformat() if job.created_at else None,
        })
    
    return {
        "jobs": job_list,
        "total": total
    }


@router.post("/", tags=["Listings"])
async def create_listing_job(
    job: ListingJobCreate,
    context: UserContext = Depends(require_permission(Permission.CREATE_LISTING)),
    db: Session = Depends(get_db)
):
    """
    Create a new listing job to publish a product to Etsy
    Requires: CREATE_LISTING permission (Owner, Admin, Creator)
    
    Args:
        job: Job creation details (product_id, shop_id)
    
    Returns:
        Created job details
    """
    # Verify product belongs to tenant
    product = db.query(Product).filter(
        Product.id == job.product_id,
        Product.tenant_id == context.tenant_id
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    ensure_tenant_access(product.tenant_id, context)
    
    # Verify shop access
    ensure_shop_access(job.shop_id, context, db)
    
    # Check if job already exists for this product
    existing_job = db.query(ListingJob).filter(
        ListingJob.product_id == job.product_id,
        ListingJob.shop_id == job.shop_id,
        ListingJob.status.in_(["pending", "processing", "scheduled"]) if hasattr(ListingJob, 'status') else ListingJob.state.in_(["queued", "processing"])
    ).first()
    
    if existing_job:
        raise HTTPException(
            status_code=400,
            detail=f"A listing job for this product already exists (Job ID: {existing_job.id})"
        )
    
    # Create new listing job
    new_job = ListingJob(
        tenant_id=context.tenant_id,
        product_id=job.product_id,
        shop_id=job.shop_id,
        status="pending" if hasattr(ListingJob, 'status') else None,
        state="queued" if hasattr(ListingJob, 'state') else None,
        retry_count=0 if hasattr(ListingJob, 'retry_count') else None,
        attempts=0 if hasattr(ListingJob, 'attempts') else None
    )
    
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    
    # Trigger the Celery task to publish the listing
    try:
        publish_listing.delay(new_job.id)
    except Exception as e:
        # If task fails to queue, mark job as failed
        if hasattr(new_job, 'status'):
            new_job.status = "failed"
        if hasattr(new_job, 'state'):
            new_job.state = "failed"
        if hasattr(new_job, 'error_message'):
            new_job.error_message = f"Failed to queue job: {str(e)}"
        db.commit()
    
    return {
        "id": new_job.id,
        "product_id": new_job.product_id,
        "shop_id": new_job.shop_id,
        "status": new_job.status if hasattr(new_job, 'status') else new_job.state,
        "message": "Listing job created and queued for processing"
    }


@router.get("/{job_id}", tags=["Listings"])
async def get_listing_job(
    job_id: int,
    context: UserContext = Depends(require_permission(Permission.READ_LISTING)),
    db: Session = Depends(get_db)
):
    """
    Get a specific listing job by ID
    Requires: READ_LISTING permission (all roles)
    
    Args:
        job_id: ID of the listing job
    
    Returns:
        Job details
    """
    job = db.query(ListingJob).filter(
        ListingJob.id == job_id,
        ListingJob.tenant_id == context.tenant_id
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Listing job not found")
    
    ensure_tenant_access(job.tenant_id, context)
    ensure_shop_access(job.shop_id, context, db)
    
    return {
        "id": job.id,
        "product_id": job.product_id,
        "shop_id": job.shop_id,
        "etsy_listing_id": job.etsy_listing_id,
        "status": job.status if hasattr(job, 'status') else job.state,
        "error_message": job.error_message if hasattr(job, 'error_message') else (job.error_detail.get('message') if job.error_detail else None),
        "retry_count": job.retry_count if hasattr(job, 'retry_count') else job.attempts,
        "scheduled_for": job.scheduled_for.isoformat() if hasattr(job, 'scheduled_for') and job.scheduled_for else None,
        "started_at": job.started_at.isoformat() if hasattr(job, 'started_at') and job.started_at else None,
        "completed_at": job.completed_at.isoformat() if hasattr(job, 'completed_at') and job.completed_at else None,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
    }


@router.post("/{job_id}/retry", tags=["Listings"])
async def retry_listing_job(
    job_id: int,
    context: UserContext = Depends(require_permission(Permission.UPDATE_LISTING)),
    db: Session = Depends(get_db)
):
    """
    Retry a failed listing job
    Requires: UPDATE_LISTING permission (Owner, Admin, Creator)
    
    Args:
        job_id: ID of the listing job to retry
    
    Returns:
        Success message
    """
    job = db.query(ListingJob).filter(
        ListingJob.id == job_id,
        ListingJob.tenant_id == context.tenant_id
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Listing job not found")
    
    ensure_tenant_access(job.tenant_id, context)
    ensure_shop_access(job.shop_id, context, db)
    
    current_status = job.status if hasattr(job, 'status') else job.state
    
    if current_status != "failed":
        raise HTTPException(
            status_code=400,
            detail=f"Can only retry failed jobs. Current status: {current_status}"
        )
    
    # Reset job status
    if hasattr(job, 'status'):
        job.status = "pending"
    if hasattr(job, 'state'):
        job.state = "queued"
    
    if hasattr(job, 'error_message'):
        job.error_message = None
    if hasattr(job, 'error_detail'):
        job.error_detail = None
    if hasattr(job, 'error_code'):
        job.error_code = None
    
    job.updated_at = datetime.utcnow()
    db.commit()
    
    # Trigger the Celery task again
    try:
        publish_listing.delay(job.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to queue retry: {str(e)}")
    
    return {
        "id": job.id,
        "message": "Listing job queued for retry",
        "status": "pending"
    }


@router.delete("/{job_id}", tags=["Listings"])
async def cancel_listing_job_endpoint(
    job_id: int,
    context: UserContext = Depends(require_permission(Permission.DELETE_LISTING)),
    db: Session = Depends(get_db)
):
    """
    Cancel a pending or scheduled listing job
    Requires: DELETE_LISTING permission (Owner, Admin only)
    
    Args:
        job_id: ID of the listing job to cancel
    
    Returns:
        Success message
    """
    job = db.query(ListingJob).filter(
        ListingJob.id == job_id,
        ListingJob.tenant_id == context.tenant_id
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Listing job not found")
    
    ensure_tenant_access(job.tenant_id, context)
    ensure_shop_access(job.shop_id, context, db)
    
    current_status = job.status if hasattr(job, 'status') else job.state
    
    if current_status not in ["pending", "scheduled", "queued"]:
        raise HTTPException(
            status_code=400,
            detail=f"Can only cancel pending or scheduled jobs. Current status: {current_status}"
        )
    
    # Cancel the job
    if hasattr(job, 'status'):
        job.status = "cancelled"
    if hasattr(job, 'state'):
        job.state = "failed"  # No cancelled state in constraint
    
    if hasattr(job, 'completed_at'):
        job.completed_at = datetime.utcnow()
    
    job.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "id": job.id,
        "message": "Listing job cancelled successfully"
    }
