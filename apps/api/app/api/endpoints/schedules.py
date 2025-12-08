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

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.listings import Schedule


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
    shop_id: Optional[int] = None
    status: Optional[str] = None


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
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all schedules for the current tenant

    Args:
        status: Optional filter by status (active, paused, error)

    Returns:
        List of schedules with statistics
    """
    tenant_id = int(current_user["tenant_id"])

    # Build query
    query = db.query(Schedule).filter(Schedule.tenant_id == tenant_id)

    if status:
        query = query.filter(Schedule.status == status)

    schedules = query.order_by(Schedule.created_at.desc()).all()

    # Get statistics
    total = db.query(Schedule).filter(Schedule.tenant_id == tenant_id).count()
    active = db.query(Schedule).filter(
        Schedule.tenant_id == tenant_id,
        Schedule.status == 'active'
    ).count()
    paused = db.query(Schedule).filter(
        Schedule.tenant_id == tenant_id,
        Schedule.status == 'paused'
    ).count()

    # Calculate today's executions
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    executions_today = db.query(func.sum(Schedule.execution_count)).filter(
        Schedule.tenant_id == tenant_id,
        Schedule.last_run_at >= today_start
    ).scalar() or 0

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
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new schedule
    """
    tenant_id = int(current_user["tenant_id"])

    new_schedule = Schedule(
        tenant_id=tenant_id,
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
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific schedule by ID
    """
    tenant_id = int(current_user["tenant_id"])

    schedule = db.query(Schedule).filter(
        Schedule.id == schedule_id,
        Schedule.tenant_id == tenant_id
    ).first()

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

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
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a schedule
    """
    tenant_id = int(current_user["tenant_id"])

    schedule = db.query(Schedule).filter(
        Schedule.id == schedule_id,
        Schedule.tenant_id == tenant_id
    ).first()

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

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
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a schedule
    """
    tenant_id = int(current_user["tenant_id"])

    schedule = db.query(Schedule).filter(
        Schedule.id == schedule_id,
        Schedule.tenant_id == tenant_id
    ).first()

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    db.delete(schedule)
    db.commit()

    return {"message": "Schedule deleted successfully"}


@router.post("/{schedule_id}/toggle", tags=["Schedules"])
async def toggle_schedule(
    schedule_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Toggle schedule status between active and paused
    """
    tenant_id = int(current_user["tenant_id"])

    schedule = db.query(Schedule).filter(
        Schedule.id == schedule_id,
        Schedule.tenant_id == tenant_id
    ).first()

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

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
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Pause all active schedules
    """
    tenant_id = int(current_user["tenant_id"])

    db.query(Schedule).filter(
        Schedule.tenant_id == tenant_id,
        Schedule.status == 'active'
    ).update({"status": "paused", "updated_at": datetime.utcnow()})

    db.commit()

    return {"message": "All schedules paused"}


@router.post("/resume-all", tags=["Schedules"])
async def resume_all_schedules(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Resume all paused schedules
    """
    tenant_id = int(current_user["tenant_id"])

    db.query(Schedule).filter(
        Schedule.tenant_id == tenant_id,
        Schedule.status == 'paused'
    ).update({"status": "active", "updated_at": datetime.utcnow()})

    db.commit()

    return {"message": "All schedules resumed"}


@router.post("/run-all-syncs", tags=["Schedules"])
async def run_all_syncs(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Trigger all active sync schedules to run immediately
    """
    tenant_id = int(current_user["tenant_id"])

    # Get all active sync schedules
    sync_schedules = db.query(Schedule).filter(
        Schedule.tenant_id == tenant_id,
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
