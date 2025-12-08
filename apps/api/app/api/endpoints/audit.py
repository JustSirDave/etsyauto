"""
Audit Logs API Endpoints
Track and retrieve audit trail of user actions
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from pydantic import BaseModel

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.listings import AuditLog

router = APIRouter()


# Response Models
class AuditLogResponse(BaseModel):
    id: int
    user_id: int
    tenant_id: int
    action: str
    resource_type: str
    resource_id: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    request_id: Optional[str]
    diff: Optional[dict]
    status_code: Optional[int]
    latency_ms: Optional[int]
    created_at: str

    class Config:
        from_attributes = True


class AuditStatsResponse(BaseModel):
    total_events: int
    unique_users: int
    events_today: int
    events_this_week: int
    top_actions: List[dict]


@router.get("/", tags=["Audit Logs"])
async def get_audit_logs(
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    user_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get audit logs for the current tenant
    
    Args:
        action: Optional filter by action (e.g., 'create', 'update', 'delete')
        resource_type: Optional filter by resource type (e.g., 'product', 'order', 'user')
        user_id: Optional filter by user ID
        start_date: Optional filter by start date (ISO format)
        end_date: Optional filter by end date (ISO format)
        skip: Number of records to skip
        limit: Maximum number of records to return
    
    Returns:
        List of audit log entries
    """
    tenant_id = int(current_user["tenant_id"])

    # Build query
    query = db.query(AuditLog).filter(AuditLog.tenant_id == tenant_id)
    
    if action:
        query = query.filter(AuditLog.action == action)
    
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    
    if start_date:
        try:
            start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            query = query.filter(AuditLog.created_at >= start)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format")
    
    if end_date:
        try:
            end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            query = query.filter(AuditLog.created_at <= end)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format")
    
    # Get total count
    total = query.count()
    
    # Get paginated results
    logs = query.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit).all()
    
    # Format response
    log_list = []
    for log in logs:
        log_list.append({
            "id": log.id,
            "user_id": log.user_id,
            "tenant_id": log.tenant_id,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "request_id": log.request_id,
            "diff": log.diff,
            "status_code": log.status_code,
            "latency_ms": log.latency_ms,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })
    
    return {
        "logs": log_list,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/stats", tags=["Audit Logs"])
async def get_audit_stats(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get audit log statistics for the current tenant
    
    Returns:
        Statistics about audit events
    """
    tenant_id = int(current_user["tenant_id"])
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)

    # Total events
    total_events = db.query(AuditLog).filter(
        AuditLog.tenant_id == tenant_id
    ).count()

    # Unique users
    unique_users = db.query(func.count(func.distinct(AuditLog.user_id))).filter(
        AuditLog.tenant_id == tenant_id
    ).scalar() or 0

    # Events today
    events_today = db.query(AuditLog).filter(
        AuditLog.tenant_id == tenant_id,
        AuditLog.created_at >= today_start
    ).count()

    # Events this week
    events_this_week = db.query(AuditLog).filter(
        AuditLog.tenant_id == tenant_id,
        AuditLog.created_at >= week_start
    ).count()

    # Top actions
    top_actions_query = db.query(
        AuditLog.action,
        func.count(AuditLog.id).label('count')
    ).filter(
        AuditLog.tenant_id == tenant_id
    ).group_by(AuditLog.action).order_by(desc('count')).limit(5).all()

    top_actions = [
        {"action": action, "count": count}
        for action, count in top_actions_query
    ]

    return {
        "total_events": total_events,
        "unique_users": unique_users,
        "events_today": events_today,
        "events_this_week": events_this_week,
        "top_actions": top_actions
    }


@router.post("/", tags=["Audit Logs"])
async def create_audit_log(
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    request_id: Optional[str] = None,
    diff: Optional[dict] = None,
    status_code: Optional[int] = None,
    latency_ms: Optional[int] = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new audit log entry
    
    Args:
        action: Action performed (e.g., 'create', 'update', 'delete', 'login', 'logout')
        resource_type: Type of resource (e.g., 'product', 'order', 'user', 'shop')
        resource_id: ID of the resource affected
        ip_address: IP address of the user
        user_agent: User agent string
        request_id: Request ID for tracking
        diff: Changes made (before/after)
        status_code: HTTP status code
        latency_ms: Request latency in milliseconds
    
    Returns:
        Created audit log entry
    """
    tenant_id = int(current_user["tenant_id"])
    user_id = int(current_user["id"])

    new_log = AuditLog(
        user_id=user_id,
        tenant_id=tenant_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=ip_address,
        user_agent=user_agent,
        request_id=request_id,
        diff=diff,
        status_code=status_code,
        latency_ms=latency_ms
    )

    db.add(new_log)
    db.commit()
    db.refresh(new_log)

    return {
        "id": new_log.id,
        "message": "Audit log created successfully"
    }


@router.get("/{log_id}", tags=["Audit Logs"])
async def get_audit_log(
    log_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific audit log entry by ID
    
    Args:
        log_id: ID of the audit log
    
    Returns:
        Audit log details
    """
    tenant_id = int(current_user["tenant_id"])

    log = db.query(AuditLog).filter(
        AuditLog.id == log_id,
        AuditLog.tenant_id == tenant_id
    ).first()

    if not log:
        raise HTTPException(status_code=404, detail="Audit log not found")

    return {
        "id": log.id,
        "user_id": log.user_id,
        "tenant_id": log.tenant_id,
        "action": log.action,
        "resource_type": log.resource_type,
        "resource_id": log.resource_id,
        "ip_address": log.ip_address,
        "user_agent": log.user_agent,
        "request_id": log.request_id,
        "diff": log.diff,
        "status_code": log.status_code,
        "latency_ms": log.latency_ms,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }
