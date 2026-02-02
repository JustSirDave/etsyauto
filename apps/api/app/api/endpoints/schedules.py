"""
Schedule Management API Endpoints
CRUD operations for automated task schedules
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel

from app.api.dependencies import get_user_context, UserContext, require_permission
from app.core.database import get_db
from app.core.rbac import Permission
from app.core.query_helpers import filter_by_tenant, ensure_tenant_access, ensure_shop_access
from app.models.listings import Schedule
from app.models.tenancy import Shop
from app.services.quota_manager import QuotaManager

router = APIRouter()


# Request/Response Models
class ScheduleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    type: str  # sync, generate, backup, report
    cron_expr: str
    daily_quota: int = 0
    shop_id: Optional[int] = None


class ScheduleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    cron_expr: Optional[str] = None
    daily_quota: Optional[int] = None
    weekly_quota: Optional[int] = None
    shop_id: Optional[int] = None
    status: Optional[str] = None


class QuotaConfigUpdate(BaseModel):
    """Update quota configuration for a schedule"""
    daily_quota: Optional[int] = None
    weekly_quota: Optional[int] = None


class ScheduleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    type: str
    cron_expr: str
    daily_quota: int
    status: str
    shop_id: Optional[int]
    last_run_at: Optional[str]
    next_run_at: Optional[str]
    last_error: Optional[str]
    execution_count: int
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


@router.get("/", tags=["Schedules"])
async def get_schedules(
    status: Optional[str] = None,
    shop_id: Optional[int] = None,
    context: UserContext = Depends(require_permission(Permission.READ_SCHEDULE)),
    db: Session = Depends(get_db)
):
    """
    Get all schedules for the current tenant
    Requires: READ_SCHEDULE permission (all roles)

    Args:
        status: Optional filter by status (active, paused, error)

    Returns:
        List of schedules with statistics
    """
    # Filter by tenant
    query = filter_by_tenant(db.query(Schedule), context.tenant_id, Schedule.tenant_id)
    if shop_id:
        ensure_shop_access(shop_id, context, db)
        query = query.filter(Schedule.shop_id == shop_id)

    if status:
        query = query.filter(Schedule.status == status)

    schedules = query.order_by(Schedule.created_at.desc()).all()

    # Get statistics
    total_query = db.query(Schedule).filter(Schedule.tenant_id == context.tenant_id)
    if shop_id:
        total_query = total_query.filter(Schedule.shop_id == shop_id)
    total = total_query.count()
    active_query = db.query(Schedule).filter(
        Schedule.tenant_id == context.tenant_id,
        Schedule.status == 'active'
    )
    paused_query = db.query(Schedule).filter(
        Schedule.tenant_id == context.tenant_id,
        Schedule.status == 'paused'
    )
    if shop_id:
        active_query = active_query.filter(Schedule.shop_id == shop_id)
        paused_query = paused_query.filter(Schedule.shop_id == shop_id)
    active = active_query.count()
    paused = paused_query.count()

    # Calculate today's executions
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    executions_query = db.query(func.sum(Schedule.execution_count)).filter(
        Schedule.tenant_id == context.tenant_id,
        Schedule.last_run_at >= today_start
    )
    if shop_id:
        executions_query = executions_query.filter(Schedule.shop_id == shop_id)
    executions_today = executions_query.scalar() or 0

    # Format schedules
    schedule_list = []
    for s in schedules:
        schedule_list.append({
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "type": s.type,
            "cron_expr": s.cron_expr,
            "daily_quota": s.daily_quota,
            "status": s.status,
            "shop_id": s.shop_id,
            "last_run_at": s.last_run_at.isoformat() if s.last_run_at else None,
            "next_run_at": s.next_run_at.isoformat() if s.next_run_at else None,
            "last_error": s.last_error,
            "execution_count": s.execution_count,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        })

    return {
        "schedules": schedule_list,
        "stats": {
            "total": total,
            "active": active,
            "paused": paused,
            "executions_today": executions_today
        }
    }


@router.post("/", tags=["Schedules"])
async def create_schedule(
    schedule: ScheduleCreate,
    context: UserContext = Depends(require_permission(Permission.CREATE_SCHEDULE)),
    db: Session = Depends(get_db)
):
    """
    Create a new schedule
    Requires: CREATE_SCHEDULE permission (Owner, Admin, Creator)
    """
    # Verify shop access if shop_id is provided
    if schedule.shop_id:
        ensure_shop_access(schedule.shop_id, context, db)

    new_schedule = Schedule(
        tenant_id=context.tenant_id,
        name=schedule.name,
        description=schedule.description,
        type=schedule.type,
        cron_expr=schedule.cron_expr,
        daily_quota=schedule.daily_quota,
        shop_id=schedule.shop_id,
        status='active'
    )

    db.add(new_schedule)
    db.commit()
    db.refresh(new_schedule)

    return {
        "id": new_schedule.id,
        "name": new_schedule.name,
        "message": "Schedule created successfully"
    }


@router.get("/{schedule_id}", tags=["Schedules"])
async def get_schedule(
    schedule_id: int,
    context: UserContext = Depends(require_permission(Permission.READ_SCHEDULE)),
    db: Session = Depends(get_db)
):
    """
    Get a specific schedule by ID
    Requires: READ_SCHEDULE permission (all roles)
    """
    schedule = db.query(Schedule).filter(
        Schedule.id == schedule_id,
        Schedule.tenant_id == context.tenant_id
    ).first()

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    ensure_tenant_access(schedule.tenant_id, context)
    
    if schedule.shop_id:
        ensure_shop_access(schedule.shop_id, context, db)

    return {
        "id": schedule.id,
        "name": schedule.name,
        "description": schedule.description,
        "type": schedule.type,
        "cron_expr": schedule.cron_expr,
        "daily_quota": schedule.daily_quota,
        "status": schedule.status,
        "shop_id": schedule.shop_id,
        "last_run_at": schedule.last_run_at.isoformat() if schedule.last_run_at else None,
        "next_run_at": schedule.next_run_at.isoformat() if schedule.next_run_at else None,
        "last_error": schedule.last_error,
        "execution_count": schedule.execution_count,
        "created_at": schedule.created_at.isoformat() if schedule.created_at else None,
        "updated_at": schedule.updated_at.isoformat() if schedule.updated_at else None,
    }


@router.put("/{schedule_id}", tags=["Schedules"])
async def update_schedule(
    schedule_id: int,
    schedule_update: ScheduleUpdate,
    context: UserContext = Depends(require_permission(Permission.UPDATE_SCHEDULE)),
    db: Session = Depends(get_db)
):
    """
    Update a schedule
    Requires: UPDATE_SCHEDULE permission (Owner, Admin, Creator*)
    *Creator can only update own schedules (enforced at application level if needed)
    """
    schedule = db.query(Schedule).filter(
        Schedule.id == schedule_id,
        Schedule.tenant_id == context.tenant_id
    ).first()

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    ensure_tenant_access(schedule.tenant_id, context)
    
    if schedule.shop_id:
        ensure_shop_access(schedule.shop_id, context, db)

    # Verify shop access if shop_id is being updated
    if schedule_update.shop_id is not None:
        ensure_shop_access(schedule_update.shop_id, context, db)

    # Update fields
    if schedule_update.name is not None:
        schedule.name = schedule_update.name
    if schedule_update.description is not None:
        schedule.description = schedule_update.description
    if schedule_update.type is not None:
        schedule.type = schedule_update.type
    if schedule_update.cron_expr is not None:
        schedule.cron_expr = schedule_update.cron_expr
    if schedule_update.daily_quota is not None:
        schedule.daily_quota = schedule_update.daily_quota
    if schedule_update.shop_id is not None:
        schedule.shop_id = schedule_update.shop_id
    if schedule_update.status is not None:
        schedule.status = schedule_update.status

    schedule.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(schedule)

    return {
        "id": schedule.id,
        "message": "Schedule updated successfully"
    }


@router.delete("/{schedule_id}", tags=["Schedules"])
async def delete_schedule(
    schedule_id: int,
    context: UserContext = Depends(require_permission(Permission.DELETE_SCHEDULE)),
    db: Session = Depends(get_db)
):
    """
    Delete a schedule
    Requires: DELETE_SCHEDULE permission (Owner, Admin only)
    """
    schedule = db.query(Schedule).filter(
        Schedule.id == schedule_id,
        Schedule.tenant_id == context.tenant_id
    ).first()

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    ensure_tenant_access(schedule.tenant_id, context)

    db.delete(schedule)
    db.commit()

    return {"message": "Schedule deleted successfully"}


@router.post("/{schedule_id}/toggle", tags=["Schedules"])
async def toggle_schedule(
    schedule_id: int,
    context: UserContext = Depends(require_permission(Permission.PAUSE_SCHEDULE)),
    db: Session = Depends(get_db)
):
    """
    Toggle schedule status between active and paused
    Requires: PAUSE_SCHEDULE permission (Owner, Admin, Creator*)
    *Creator can only pause own schedules
    """
    schedule = db.query(Schedule).filter(
        Schedule.id == schedule_id,
        Schedule.tenant_id == context.tenant_id
    ).first()

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    ensure_tenant_access(schedule.tenant_id, context)
    
    if schedule.shop_id:
        ensure_shop_access(schedule.shop_id, context, db)

    # Toggle status
    if schedule.status == 'active':
        schedule.status = 'paused'
    elif schedule.status == 'paused':
        schedule.status = 'active'
    else:
        # If error, set to active
        schedule.status = 'active'
        schedule.last_error = None

    schedule.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(schedule)

    return {
        "id": schedule.id,
        "status": schedule.status,
        "message": f"Schedule {'activated' if schedule.status == 'active' else 'paused'}"
    }


@router.post("/pause-all", tags=["Schedules"])
async def pause_all_schedules(
    context: UserContext = Depends(require_permission(Permission.PAUSE_SCHEDULE)),
    db: Session = Depends(get_db)
):
    """
    Pause all active schedules
    Requires: PAUSE_SCHEDULE permission (Owner, Admin, Creator)
    """
    db.query(Schedule).filter(
        Schedule.tenant_id == context.tenant_id,
        Schedule.status == 'active'
    ).update({"status": "paused", "updated_at": datetime.utcnow()})

    db.commit()

    return {"message": "All schedules paused"}


@router.post("/resume-all", tags=["Schedules"])
async def resume_all_schedules(
    context: UserContext = Depends(require_permission(Permission.PAUSE_SCHEDULE)),
    db: Session = Depends(get_db)
):
    """
    Resume all paused schedules
    Requires: PAUSE_SCHEDULE permission (Owner, Admin, Creator)
    """
    db.query(Schedule).filter(
        Schedule.tenant_id == context.tenant_id,
        Schedule.status == 'paused'
    ).update({"status": "active", "updated_at": datetime.utcnow()})

    db.commit()

    return {"message": "All schedules resumed"}


@router.post("/run-all-syncs", tags=["Schedules"])
async def run_all_syncs(
    context: UserContext = Depends(require_permission(Permission.UPDATE_SCHEDULE)),
    db: Session = Depends(get_db)
):
    """
    Trigger all active sync schedules to run immediately
    Requires: UPDATE_SCHEDULE permission (Owner, Admin, Creator)
    """
    # Get all active sync schedules
    sync_schedules = db.query(Schedule).filter(
        Schedule.tenant_id == context.tenant_id,
        Schedule.type == 'sync',
        Schedule.status == 'active'
    ).all()

    if not sync_schedules:
        return {
            "message": "No active sync schedules found",
            "triggered_count": 0
        }

    # TODO: Implement actual sync triggering logic with Celery/background tasks
    # For now, just update last_run_at and execution_count
    now = datetime.now(timezone.utc)
    for schedule in sync_schedules:
        schedule.last_run_at = now
        schedule.execution_count = (schedule.execution_count or 0) + 1
        schedule.updated_at = now

    db.commit()

    return {
        "message": f"Triggered {len(sync_schedules)} sync schedule{'s' if len(sync_schedules) > 1 else ''}",
        "triggered_count": len(sync_schedules)
    }


# ==================== Quota Management Endpoints ====================

@router.get("/{schedule_id}/quota", tags=["Schedules", "Quotas"])
async def get_schedule_quota(
    schedule_id: int,
    context: UserContext = Depends(require_permission(Permission.READ_SCHEDULE)),
    db: Session = Depends(get_db)
):
    """
    Get quota information for a schedule
    Requires: READ_SCHEDULE permission
    
    Returns:
        Current quota usage, remaining quota, and reset times
    """
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    ensure_tenant_access(schedule.tenant_id, context)
    
    # Get quota information
    quota_manager = QuotaManager(db)
    quota_info = quota_manager.get_remaining_quota(schedule)
    
    return {
        "schedule_id": schedule.id,
        "schedule_name": schedule.name,
        "status": schedule.status,
        **quota_info
    }


@router.put("/{schedule_id}/quota", tags=["Schedules", "Quotas"])
async def update_schedule_quota(
    schedule_id: int,
    quota_config: QuotaConfigUpdate,
    context: UserContext = Depends(require_permission(Permission.UPDATE_SCHEDULE)),
    db: Session = Depends(get_db)
):
    """
    Update quota configuration for a schedule
    Requires: UPDATE_SCHEDULE permission (Admin+)
    
    Allows premium users to set custom quotas per shop
    """
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    ensure_tenant_access(schedule.tenant_id, context)
    
    # Update quota configuration
    if quota_config.daily_quota is not None:
        schedule.daily_quota = quota_config.daily_quota
    
    if quota_config.weekly_quota is not None:
        schedule.weekly_quota = quota_config.weekly_quota
    
    schedule.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(schedule)
    
    # Get updated quota info
    quota_manager = QuotaManager(db)
    quota_info = quota_manager.get_remaining_quota(schedule)
    
    return {
        "message": "Quota configuration updated successfully",
        "schedule_id": schedule.id,
        "quota": quota_info
    }


@router.post("/{schedule_id}/quota/reset", tags=["Schedules", "Quotas"])
async def reset_schedule_quota(
    schedule_id: int,
    reset_daily: bool = True,
    reset_weekly: bool = False,
    context: UserContext = Depends(require_permission(Permission.UPDATE_SCHEDULE)),
    db: Session = Depends(get_db)
):
    """
    Manually reset quota counters for a schedule
    Requires: UPDATE_SCHEDULE permission (Admin+)
    
    Useful for testing or handling edge cases
    """
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    ensure_tenant_access(schedule.tenant_id, context)
    
    # Reset quotas
    now = datetime.now(timezone.utc)
    
    if reset_daily:
        schedule.daily_used = 0
        schedule.last_daily_reset = now
    
    if reset_weekly:
        schedule.weekly_used = 0
        schedule.last_weekly_reset = now
    
    # Reset status if it was quota_exceeded
    quota_manager = QuotaManager(db)
    quota_manager.reset_quota_status(schedule)
    
    db.commit()
    db.refresh(schedule)
    
    # Get updated info
    quota_info = quota_manager.get_remaining_quota(schedule)
    
    return {
        "message": "Quota reset successfully",
        "schedule_id": schedule.id,
        "reset_daily": reset_daily,
        "reset_weekly": reset_weekly,
        "quota": quota_info
    }


@router.get("/quota/summary", tags=["Schedules", "Quotas"])
async def get_quota_summary(
    context: UserContext = Depends(require_permission(Permission.READ_SCHEDULE)),
    db: Session = Depends(get_db)
):
    """
    Get quota summary for all schedules
    Requires: READ_SCHEDULE permission
    
    Returns:
        Summary of quota usage across all tenant's schedules
    """
    schedules = filter_by_tenant(
        db.query(Schedule), 
        context.tenant_id, 
        Schedule.tenant_id
    ).all()
    
    quota_manager = QuotaManager(db)
    
    summary = {
        "total_schedules": len(schedules),
        "active_schedules": len([s for s in schedules if s.status == 'active']),
        "quota_exceeded": len([s for s in schedules if s.status == 'quota_exceeded']),
        "total_daily_quota": sum(s.daily_quota or 0 for s in schedules),
        "total_daily_used": sum(s.daily_used or 0 for s in schedules),
        "schedules": []
    }
    
    for schedule in schedules:
        quota_info = quota_manager.get_remaining_quota(schedule)
        summary["schedules"].append({
            "id": schedule.id,
            "name": schedule.name,
            "status": schedule.status,
            "quota": quota_info
        })
    
    return summary
