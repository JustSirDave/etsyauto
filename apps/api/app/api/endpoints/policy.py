"""
Policy Compliance API Endpoints
Check policy compliance and handle remediation
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone

from app.api.dependencies import get_user_context, UserContext, require_permission
from app.core.database import get_db
from app.core.rbac import Permission
from app.core.query_helpers import ensure_tenant_access
from app.models.listings import Product, AIGeneration, ListingJob
from app.services.listing_policy_checker import ListingPolicyChecker
from app.services.audit_service import AuditService
from app.models.audit_constants import AuditAction, AuditStatus

router = APIRouter()


# ==================== Request/Response Models ====================

class PolicyCheckResponse(BaseModel):
    compliant: bool
    policy_status: str
    policy_flags: List[str]
    can_publish: bool
    remediation_required: bool
    checks: dict
    checked_at: str


class RemediationRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None


# ==================== API Endpoints ====================

@router.get("/product/{product_id}/check", tags=["Policy"])
async def check_product_policy(
    product_id: int,
    context: UserContext = Depends(require_permission(Permission.READ_PRODUCT)),
    db: Session = Depends(get_db)
) -> PolicyCheckResponse:
    """
    Check policy compliance for a product before publishing
    Requires: READ_PRODUCT permission
    
    Returns:
        Policy check results with violations and can_publish status
    """
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.tenant_id == context.tenant_id,
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Run policy check
    policy_checker = ListingPolicyChecker(db)
    
    # Create mock listing object
    from types import SimpleNamespace
    mock_listing = SimpleNamespace(
        product_id=product.id,
        ai_generation_id=None
    )
    
    result = policy_checker.check_listing_compliance(mock_listing, product)
    
    # Log policy check
    audit_service = AuditService(db)
    audit_service.log_action(
        action="policy.check",
        status=AuditStatus.SUCCESS if result["can_publish"] else AuditStatus.FAILURE,
        actor_user_id=context.user_id,
        tenant_id=context.tenant_id,
        target_type="product",
        target_id=str(product_id),
        response_metadata={"policy_status": result["policy_status"], "flags": result["policy_flags"]}
    )
    
    return PolicyCheckResponse(**result)


@router.post("/product/{product_id}/recheck", tags=["Policy"])
async def recheck_product_policy(
    product_id: int,
    context: UserContext = Depends(require_permission(Permission.UPDATE_PRODUCT)),
    db: Session = Depends(get_db)
) -> PolicyCheckResponse:
    """
    Re-check policy compliance after content updates
    Requires: UPDATE_PRODUCT permission
    
    Use this after remediation to verify compliance
    """
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.tenant_id == context.tenant_id,
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Run fresh policy check
    policy_checker = ListingPolicyChecker(db)
    
    from types import SimpleNamespace
    mock_listing = SimpleNamespace(
        product_id=product.id,
        ai_generation_id=None
    )
    
    result = policy_checker.check_listing_compliance(mock_listing, product)
    
    # Update AIGeneration policy status if exists
    ai_gen = db.query(AIGeneration).filter(
        AIGeneration.product_id == product_id
    ).order_by(AIGeneration.created_at.desc()).first()
    
    if ai_gen:
        ai_gen.policy_status = result["policy_status"]
        ai_gen.policy_flags = result["policy_flags"]
        ai_gen.policy_checked_at = datetime.now(timezone.utc)
        ai_gen.can_publish = 1 if result["can_publish"] else 0
        db.commit()
    
    # Log re-check
    audit_service = AuditService(db)
    audit_service.log_action(
        action="policy.recheck",
        status=AuditStatus.SUCCESS if result["can_publish"] else AuditStatus.FAILURE,
        actor_user_id=context.user_id,
        tenant_id=context.tenant_id,
        target_type="product",
        target_id=str(product_id),
        response_metadata={"policy_status": result["policy_status"], "flags": result["policy_flags"]}
    )
    
    return PolicyCheckResponse(**result)


@router.post("/generation/{generation_id}/remediate", tags=["Policy"])
async def remediate_generation(
    generation_id: int,
    remediation: RemediationRequest,
    context: UserContext = Depends(require_permission(Permission.UPDATE_PRODUCT)),
    db: Session = Depends(get_db)
) -> dict:
    """
    Update AI generation content and re-check policy compliance
    Requires: UPDATE_PRODUCT permission
    
    Workflow:
    1. Update title/description/tags
    2. Run fresh policy check
    3. Update policy status
    4. Return new compliance status
    """
    ai_gen = db.query(AIGeneration).filter(
        AIGeneration.id == generation_id,
        AIGeneration.tenant_id == context.tenant_id,
    ).first()
    
    if not ai_gen:
        raise HTTPException(status_code=404, detail="AI Generation not found")
    
    # Get product (tenant already verified above)
    product = db.query(Product).filter(
        Product.id == ai_gen.product_id,
        Product.tenant_id == context.tenant_id,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Track changes
    changes = {}
    
    # Update content
    if remediation.title is not None:
        changes["title"] = {"old": ai_gen.title, "new": remediation.title}
        ai_gen.title = remediation.title
    
    if remediation.description is not None:
        changes["description"] = {"old": ai_gen.description[:50] + "...", "new": remediation.description[:50] + "..."}
        ai_gen.description = remediation.description
    
    if remediation.tags is not None:
        changes["tags"] = {"old": ai_gen.tags, "new": remediation.tags}
        ai_gen.tags = remediation.tags
    
    db.commit()
    
    # Use updated AI generation content for policy check
    # Temporarily override product fields with AI generation content
    product.title = ai_gen.title or product.title_raw
    product.description = ai_gen.description or product.description_raw
    product.tags = ai_gen.tags or product.tags_raw
    
    # Run policy check on updated content
    policy_checker = ListingPolicyChecker(db)
    from types import SimpleNamespace
    mock_listing = SimpleNamespace(
        product_id=product.id,
        ai_generation_id=ai_gen.id
    )
    
    result = policy_checker.check_listing_compliance(mock_listing, product)
    
    # Update policy status
    ai_gen.policy_status = result["policy_status"]
    ai_gen.policy_flags = result["policy_flags"]
    ai_gen.policy_checked_at = datetime.now(timezone.utc)
    ai_gen.can_publish = 1 if result["can_publish"] else 0
    db.commit()
    
    # Log remediation
    audit_service = AuditService(db)
    audit_service.log_action(
        action="policy.remediate",
        status=AuditStatus.SUCCESS if result["can_publish"] else AuditStatus.FAILURE,
        actor_user_id=context.user_id,
        tenant_id=context.tenant_id,
        target_type="ai_generation",
        target_id=str(generation_id),
        request_metadata={"changes": changes},
        response_metadata={"policy_status": result["policy_status"], "flags": result["policy_flags"]}
    )
    
    return {
        "message": "Content updated and re-checked successfully",
        "generation_id": generation_id,
        "changes_made": list(changes.keys()),
        "policy_check": result
    }


@router.get("/job/{job_id}/policy-status", tags=["Policy"])
async def get_job_policy_status(
    job_id: int,
    context: UserContext = Depends(require_permission(Permission.READ_LISTING)),
    db: Session = Depends(get_db)
) -> dict:
    """
    Get policy compliance status for a listing job
    Requires: READ_LISTING permission
    """
    job = db.query(ListingJob).filter(
        ListingJob.id == job_id,
        ListingJob.tenant_id == context.tenant_id,
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Listing job not found")
    
    return {
        "job_id": job.id,
        "policy_status": job.policy_status,
        "policy_flags": job.policy_flags or [],
        "policy_checked_at": job.policy_checked_at.isoformat() if job.policy_checked_at else None,
        "policy_block_reason": job.policy_block_reason,
        "can_publish": job.policy_status not in ['failed', 'policy_blocked'],
        "status": job.status
    }


@router.post("/job/{job_id}/retry-after-remediation", tags=["Policy"])
async def retry_job_after_remediation(
    job_id: int,
    context: UserContext = Depends(require_permission(Permission.PUBLISH_LISTING)),
    db: Session = Depends(get_db)
) -> dict:
    """
    Retry a policy-blocked job after remediation
    Requires: PUBLISH_LISTING permission
    
    This will re-check policy and retry publishing if compliant
    """
    job = db.query(ListingJob).filter(
        ListingJob.id == job_id,
        ListingJob.tenant_id == context.tenant_id,
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Listing job not found")
    
    if job.status != "policy_blocked":
        raise HTTPException(
            status_code=400, 
            detail=f"Job is not policy blocked (current status: {job.status})"
        )
    
    # Get product for re-check (tenant already verified via job query)
    product = db.query(Product).filter(
        Product.id == job.product_id,
        Product.tenant_id == context.tenant_id,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Run fresh policy check
    policy_checker = ListingPolicyChecker(db)
    from types import SimpleNamespace
    mock_listing = SimpleNamespace(
        product_id=product.id,
        ai_generation_id=job.ai_generation_id
    )
    
    result = policy_checker.check_listing_compliance(mock_listing, product)
    
    # Update job with new policy status
    job.policy_status = result["policy_status"]
    job.policy_flags = result["policy_flags"]
    job.policy_checked_at = datetime.now(timezone.utc)
    
    if not result["can_publish"]:
        # Still not compliant
        job.policy_block_reason = f"Still non-compliant: {', '.join(result['policy_flags'])}"
        db.commit()
        
        return {
            "success": False,
            "message": "Product still has policy violations",
            "policy_check": result
        }
    
    # Policy passed! Reset job to pending and trigger publish
    job.status = "pending"
    job.policy_block_reason = None
    db.commit()
    
    # Trigger publish task
    from app.worker.tasks.listing_tasks import publish_listing
    task = publish_listing.delay(job.id)
    
    # Log retry
    audit_service = AuditService(db)
    audit_service.log_action(
        action="policy.retry_after_remediation",
        status=AuditStatus.SUCCESS,
        actor_user_id=context.user_id,
        tenant_id=context.tenant_id,
        target_type="listing_job",
        target_id=str(job_id),
        response_metadata={"task_id": task.id}
    )
    
    return {
        "success": True,
        "message": "Policy check passed. Publishing job re-queued.",
        "job_id": job.id,
        "task_id": task.id,
        "policy_check": result
    }

