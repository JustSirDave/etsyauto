"""
Super-admin portal API (password + HMAC session cookie).
"""
from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, text
from sqlalchemy.orm import Session
from starlette.responses import JSONResponse

from app.core.config import settings
from app.core.database import get_db
from app.models.tenancy import Shop, Tenant, User

router = APIRouter()

_TENANTS_BASE_SQL = """
SELECT
  t.id,
  t.name,
  u.email AS owner_email,
  t.billing_tier,
  t.status,
  t.messaging_access,
  COUNT(DISTINCT s.id) AS shop_count,
  COUNT(DISTINCT m2.id) AS member_count,
  t.created_at
FROM tenants t
LEFT JOIN memberships m ON m.tenant_id = t.id AND m.role = 'owner'
LEFT JOIN users u ON u.id = m.user_id
LEFT JOIN shops s ON s.tenant_id = t.id
LEFT JOIN memberships m2 ON m2.tenant_id = t.id
"""


def _admin_session_token() -> str:
    return hmac.new(
        settings.ADMIN_PORTAL_SECRET.encode(),
        b"admin_session",
        hashlib.sha256,
    ).hexdigest()


def verify_admin_session(
    admin_session: str | None = Cookie(None, alias="admin_session"),
):
    if not settings.ADMIN_PORTAL_SECRET or len(settings.ADMIN_PORTAL_SECRET) < 16:
        raise HTTPException(status_code=503, detail="Admin portal not configured")
    if not admin_session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    expected = _admin_session_token()
    if not hmac.compare_digest(admin_session.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Invalid session")


class VerifyBody(BaseModel):
    password: str = Field(..., min_length=1)


@router.post("/auth/verify")
async def verify_admin_password(body: VerifyBody):
    """Validate admin password and set httpOnly session cookie. No header required."""
    if len(body.password) < 16:
        raise HTTPException(status_code=401, detail="Invalid password")
    if not settings.ADMIN_PORTAL_SECRET or len(settings.ADMIN_PORTAL_SECRET) < 16:
        raise HTTPException(status_code=503, detail="Admin portal not configured")
    if not hmac.compare_digest(
        body.password.encode(),
        settings.ADMIN_PORTAL_SECRET.encode(),
    ):
        raise HTTPException(status_code=401, detail="Invalid password")

    token = _admin_session_token()
    secure = bool(settings.COOKIE_SECURE)
    samesite = (settings.COOKIE_SAMESITE or "lax").lower()
    if samesite not in ("lax", "strict", "none"):
        samesite = "lax"

    resp = JSONResponse(content={"ok": True})
    resp.set_cookie(
        key="admin_session",
        value=token,
        httponly=True,
        samesite=samesite,  # type: ignore[arg-type]
        secure=secure,
        path="/",
        max_age=None,
        domain=settings.COOKIE_DOMAIN or None,
    )
    return resp


def _row_to_tenant_dict(r) -> dict:
    return {
        "id": int(r["id"]),
        "name": r["name"],
        "owner_email": r["owner_email"] or "",
        "billing_tier": r["billing_tier"],
        "status": r["status"],
        "messaging_access": r["messaging_access"],
        "shop_count": int(r["shop_count"] or 0),
        "member_count": int(r["member_count"] or 0),
        "created_at": r["created_at"].isoformat() if r["created_at"] else "",
    }


@router.get("/stats", dependencies=[Depends(verify_admin_session)])
async def get_platform_stats(db: Session = Depends(get_db)):
    total_tenants = db.query(func.count(Tenant.id)).scalar() or 0
    active_tenants = (
        db.query(func.count(Tenant.id)).filter(Tenant.status == "active").scalar() or 0
    )
    total_shops = (
        db.query(func.count(Shop.id)).filter(Shop.status == "connected").scalar() or 0
    )
    total_users = (
        db.query(func.count(User.id)).filter(User.deleted_at.is_(None)).scalar() or 0
    )
    pending_messaging_requests = (
        db.query(func.count(Tenant.id))
        .filter(Tenant.messaging_access == "pending")
        .scalar()
        or 0
    )
    return {
        "total_tenants": int(total_tenants),
        "active_tenants": int(active_tenants),
        "total_shops": int(total_shops),
        "total_users": int(total_users),
        "pending_messaging_requests": int(pending_messaging_requests),
    }


@router.get("/tenants", dependencies=[Depends(verify_admin_session)])
async def list_tenants(db: Session = Depends(get_db)):
    sql = text(
        _TENANTS_BASE_SQL
        + """
GROUP BY t.id, t.name, u.email, t.billing_tier, t.status, t.messaging_access, t.created_at
ORDER BY t.created_at DESC
"""
    )
    result = db.execute(sql)
    rows = result.mappings().all()
    return [_row_to_tenant_dict(r) for r in rows]


@router.get("/messaging-requests", dependencies=[Depends(verify_admin_session)])
async def list_messaging_requests(db: Session = Depends(get_db)):
    sql = text(
        _TENANTS_BASE_SQL
        + """
WHERE t.messaging_access IN ('pending', 'approved', 'denied')
GROUP BY t.id, t.name, u.email, t.billing_tier, t.status, t.messaging_access, t.created_at
ORDER BY
  CASE t.messaging_access
    WHEN 'pending' THEN 0
    WHEN 'approved' THEN 1
    WHEN 'denied' THEN 2
    ELSE 3
  END,
  t.created_at DESC
"""
    )
    result = db.execute(sql)
    rows = result.mappings().all()
    return [_row_to_tenant_dict(r) for r in rows]


@router.post(
    "/messaging-access/{tenant_id}/approve",
    dependencies=[Depends(verify_admin_session)],
)
async def approve_messaging_access(tenant_id: int, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant.messaging_access = "approved"
    tenant.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True, "tenant_id": tenant_id}


@router.post(
    "/messaging-access/{tenant_id}/deny",
    dependencies=[Depends(verify_admin_session)],
)
async def deny_messaging_access(tenant_id: int, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant.messaging_access = "denied"
    tenant.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True, "tenant_id": tenant_id}
