"""
Financial Analytics API Endpoints
Owner/Admin-only access to P&L, payout estimates, fee breakdowns,
order profitability, revenue timeline, and raw ledger entries.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import get_user_context, UserContext, require_revenue_access
from app.core.database import get_db
from app.core.query_helpers import ensure_shop_access
from app.services.financial_service import FinancialService
from app.models.tenancy import OAuthToken
from app.worker.tasks.financial_tasks import sync_ledger_entries, sync_payment_details

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Scope check ──

@router.get("/scope-status", tags=["Financials"])
async def get_billing_scope_status(
    shop_id: Optional[int] = None,
    context: UserContext = Depends(require_revenue_access()),
    db: Session = Depends(get_db),
):
    """
    Check whether the active shop's OAuth token includes ``billing_r``.

    Returns ``{ has_billing_scope: bool, reconnect_url: str | null }``.
    The frontend uses this to show a graceful banner when the scope
    hasn't been granted yet, without blocking order-based analytics.
    """
    if shop_id:
        ensure_shop_access(shop_id, context, db)

    # Find the shop's Etsy OAuth token
    query = db.query(OAuthToken).filter(
        OAuthToken.provider == "etsy",
    )
    if shop_id:
        query = query.filter(OAuthToken.shop_id == shop_id)
    else:
        # Get any token for the tenant
        from app.models.tenancy import Shop
        shop_ids = [
            s.id for s in db.query(Shop.id).filter(Shop.tenant_id == context.tenant_id).all()
        ]
        query = query.filter(OAuthToken.shop_id.in_(shop_ids))

    token = query.first()
    has_scope = False
    if token and token.scopes:
        has_scope = "billing_r" in token.scopes

    return {
        "has_billing_scope": has_scope,
        "reconnect_url": "/settings?reconnect=etsy" if not has_scope else None,
    }


# ── Helpers ──

def _parse_shop_ids(
    shop_ids_str: Optional[str],
    shop_id: Optional[int],
    context: "UserContext",
    db: "Session",
) -> Optional[list]:
    """Parse comma-separated shop_ids and verify access for each."""
    if not shop_ids_str:
        if shop_id:
            ensure_shop_access(shop_id, context, db)
        return None
    try:
        ids = [int(s.strip()) for s in shop_ids_str.split(",") if s.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="shop_ids must be comma-separated integers")
    for sid in ids:
        ensure_shop_access(sid, context, db)
    return ids


def _parse_date(value: Optional[str], default: datetime) -> datetime:
    """Parse an ISO date string into a timezone-aware datetime, or return default."""
    if not value:
        return default
    try:
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {value}")


# ── 0. Full Financial Summary (ordered blocks) ──

@router.get("/summary", tags=["Financials"])
async def get_financial_summary(
    shop_id: Optional[int] = None,
    shop_ids: Optional[str] = Query(None, description="Comma-separated shop IDs"),
    start_date: Optional[str] = Query(None, description="ISO start date"),
    end_date: Optional[str] = Query(None, description="ISO end date"),
    context: UserContext = Depends(require_revenue_access()),
    db: Session = Depends(get_db),
):
    """
    Full financial summary in ordered blocks:
    Revenue → Etsy Fees → Advertising → Product Costs → Invoice Expenses → Total Expenses → Net Profit.
    Supports multi-store via shop_ids parameter.
    """
    parsed_shop_ids = _parse_shop_ids(shop_ids, shop_id, context, db)

    svc = FinancialService(db)
    return svc.get_financial_summary(
        tenant_id=context.tenant_id,
        shop_id=shop_id if not parsed_shop_ids else None,
        start_date=_parse_date(start_date, datetime.now(timezone.utc) - timedelta(days=30)),
        end_date=_parse_date(end_date, datetime.now(timezone.utc)),
        shop_ids=parsed_shop_ids,
    )


# ── 1. Profit & Loss ──

@router.get("/profit-and-loss", tags=["Financials"])
async def get_profit_and_loss(
    shop_id: Optional[int] = None,
    shop_ids: Optional[str] = Query(None, description="Comma-separated shop IDs"),
    start_date: Optional[str] = Query(None, description="ISO start date"),
    end_date: Optional[str] = Query(None, description="ISO end date"),
    context: UserContext = Depends(require_revenue_access()),
    db: Session = Depends(get_db),
):
    """
    Get profit & loss summary for the selected period.
    Requires Owner/Admin/Viewer role.
    """
    parsed_shop_ids = _parse_shop_ids(shop_ids, shop_id, context, db)

    svc = FinancialService(db)
    return svc.get_profit_and_loss(
        tenant_id=context.tenant_id,
        shop_id=shop_id if not parsed_shop_ids else None,
        start_date=_parse_date(start_date, datetime.now(timezone.utc) - timedelta(days=30)),
        end_date=_parse_date(end_date, datetime.now(timezone.utc)),
        shop_ids=parsed_shop_ids,
    )


# ── 2. Payout estimate ──

@router.get("/payout-estimate", tags=["Financials"])
async def get_payout_estimate(
    shop_id: Optional[int] = None,
    shop_ids: Optional[str] = Query(None, description="Comma-separated shop IDs"),
    context: UserContext = Depends(require_revenue_access()),
    db: Session = Depends(get_db),
):
    """
    Get estimated next payout amount and recent payout history.
    Requires Owner/Admin/Viewer role.
    """
    parsed_shop_ids = _parse_shop_ids(shop_ids, shop_id, context, db)

    svc = FinancialService(db)
    return svc.get_payout_estimate(
        tenant_id=context.tenant_id,
        shop_id=shop_id if not parsed_shop_ids else None,
        shop_ids=parsed_shop_ids,
    )


# ── 3. Fee breakdown ──

@router.get("/fee-breakdown", tags=["Financials"])
async def get_fee_breakdown(
    shop_id: Optional[int] = None,
    shop_ids: Optional[str] = Query(None, description="Comma-separated shop IDs"),
    start_date: Optional[str] = Query(None, description="ISO start date"),
    end_date: Optional[str] = Query(None, description="ISO end date"),
    context: UserContext = Depends(require_revenue_access()),
    db: Session = Depends(get_db),
):
    """
    Get fee breakdown by category (transaction, processing, listing, ads, etc.).
    Requires Owner/Admin/Viewer role.
    """
    parsed_shop_ids = _parse_shop_ids(shop_ids, shop_id, context, db)

    svc = FinancialService(db)
    return svc.get_fee_breakdown(
        tenant_id=context.tenant_id,
        shop_id=shop_id if not parsed_shop_ids else None,
        start_date=_parse_date(start_date, datetime.now(timezone.utc) - timedelta(days=30)),
        end_date=_parse_date(end_date, datetime.now(timezone.utc)),
        shop_ids=parsed_shop_ids,
    )


# ── 4. Order profitability ──

@router.get("/order-profitability", tags=["Financials"])
async def get_order_profitability(
    shop_id: Optional[int] = None,
    shop_ids: Optional[str] = Query(None, description="Comma-separated shop IDs"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    context: UserContext = Depends(require_revenue_access()),
    db: Session = Depends(get_db),
):
    """
    Get per-order profitability (gross, fees, net) from payment details.
    Requires Owner/Admin/Viewer role.
    """
    parsed_shop_ids = _parse_shop_ids(shop_ids, shop_id, context, db)

    svc = FinancialService(db)
    return svc.get_order_profitability(
        tenant_id=context.tenant_id,
        shop_id=shop_id if not parsed_shop_ids else None,
        limit=limit,
        offset=offset,
        shop_ids=parsed_shop_ids,
    )


# ── 5. Revenue timeline ──

@router.get("/timeline", tags=["Financials"])
async def get_revenue_timeline(
    shop_id: Optional[int] = None,
    shop_ids: Optional[str] = Query(None, description="Comma-separated shop IDs"),
    start_date: Optional[str] = Query(None, description="ISO start date"),
    end_date: Optional[str] = Query(None, description="ISO end date"),
    granularity: str = Query("daily", regex="^(daily|weekly|monthly)$"),
    context: UserContext = Depends(require_revenue_access()),
    db: Session = Depends(get_db),
):
    """
    Get revenue/expenses timeline aggregated by day/week/month.
    Requires Owner/Admin/Viewer role.
    """
    parsed_shop_ids = _parse_shop_ids(shop_ids, shop_id, context, db)

    svc = FinancialService(db)
    return svc.get_revenue_timeline(
        tenant_id=context.tenant_id,
        shop_id=shop_id if not parsed_shop_ids else None,
        start_date=_parse_date(start_date, datetime.now(timezone.utc) - timedelta(days=30)),
        end_date=_parse_date(end_date, datetime.now(timezone.utc)),
        granularity=granularity,
        shop_ids=parsed_shop_ids,
    )


# ── 6. Raw ledger entries (paginated) ──

@router.get("/ledger", tags=["Financials"])
async def get_ledger_entries(
    shop_id: Optional[int] = None,
    shop_ids: Optional[str] = Query(None, description="Comma-separated shop IDs"),
    entry_type: Optional[str] = Query(None, description="Filter by entry type"),
    start_date: Optional[str] = Query(None, description="ISO start date"),
    end_date: Optional[str] = Query(None, description="ISO end date"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    context: UserContext = Depends(require_revenue_access()),
    db: Session = Depends(get_db),
):
    """
    Browse raw ledger entries with optional filters.
    Requires Owner/Admin/Viewer role.
    """
    parsed_shop_ids = _parse_shop_ids(shop_ids, shop_id, context, db)

    svc = FinancialService(db)
    return svc.get_ledger_entries(
        tenant_id=context.tenant_id,
        shop_id=shop_id if not parsed_shop_ids else None,
        entry_type=entry_type,
        limit=limit,
        offset=offset,
        start_date=_parse_date(start_date, None) if start_date else None,
        end_date=_parse_date(end_date, None) if end_date else None,
        shop_ids=parsed_shop_ids,
    )


# ── 7. Manual sync trigger ──

@router.post("/sync", tags=["Financials"])
async def trigger_financial_sync(
    shop_id: Optional[int] = None,
    context: UserContext = Depends(require_revenue_access()),
    db: Session = Depends(get_db),
):
    """
    Trigger an immediate financial data sync.
    Dispatches Celery tasks for ledger and payment sync.
    Requires Owner/Admin role.
    """
    if context.role.lower() not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can trigger syncs")

    if shop_id:
        ensure_shop_access(shop_id, context, db)

    sync_ledger_entries.delay(shop_id=shop_id, tenant_id=context.tenant_id)
    sync_payment_details.delay(shop_id=shop_id, tenant_id=context.tenant_id)

    return {"status": "sync_triggered", "shop_id": shop_id}
