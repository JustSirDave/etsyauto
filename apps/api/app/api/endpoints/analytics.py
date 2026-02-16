"""
Analytics API Endpoints
Owner/Admin-only analytics with cached aggregations.
Supports multi-store filtering via shop_ids parameter.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.api.dependencies import get_user_context, UserContext
from app.core.database import get_db
from app.core.query_helpers import ensure_shop_access
from app.api.dependencies import require_analytics_access, require_revenue_access
from app.services.analytics_service import AnalyticsService


router = APIRouter()


def _parse_analytics_shop_ids(
    shop_ids_str: Optional[str],
    shop_id: Optional[int],
    context: "UserContext",
    db: "Session",
) -> Optional[list]:
    """Parse comma-separated shop_ids, verify access for each, return list or None."""
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


@router.get("/overview", tags=["Analytics"])
async def get_overview_analytics(
    shop_id: Optional[int] = None,
    shop_ids: Optional[str] = Query(None, description="Comma-separated shop IDs"),
    force_refresh: bool = Query(False, description="Force cache refresh"),
    context: UserContext = Depends(require_analytics_access()),
    db: Session = Depends(get_db)
):
    """Get overview analytics with multi-store support."""
    parsed = _parse_analytics_shop_ids(shop_ids, shop_id, context, db)
    analytics = AnalyticsService(db)
    return analytics.get_overview_analytics(
        tenant_id=context.tenant_id,
        shop_id=shop_id if not parsed else None,
        force_refresh=force_refresh,
        shop_ids=parsed,
    )


@router.get("/orders", tags=["Analytics"])
async def get_order_analytics(
    shop_id: Optional[int] = None,
    shop_ids: Optional[str] = Query(None, description="Comma-separated shop IDs"),
    force_refresh: bool = Query(False, description="Force cache refresh"),
    context: UserContext = Depends(require_analytics_access()),
    db: Session = Depends(get_db)
):
    """Get order analytics with multi-store support."""
    parsed = _parse_analytics_shop_ids(shop_ids, shop_id, context, db)
    analytics = AnalyticsService(db)
    return analytics.get_order_analytics(
        tenant_id=context.tenant_id,
        shop_id=shop_id if not parsed else None,
        force_refresh=force_refresh,
        shop_ids=parsed,
    )


@router.get("/products", tags=["Analytics"])
async def get_product_analytics(
    shop_id: Optional[int] = None,
    shop_ids: Optional[str] = Query(None, description="Comma-separated shop IDs"),
    force_refresh: bool = Query(False, description="Force cache refresh"),
    context: UserContext = Depends(require_analytics_access()),
    db: Session = Depends(get_db)
):
    """Get product analytics with multi-store support."""
    parsed = _parse_analytics_shop_ids(shop_ids, shop_id, context, db)
    analytics = AnalyticsService(db)
    return analytics.get_product_analytics(
        tenant_id=context.tenant_id,
        shop_id=shop_id if not parsed else None,
        force_refresh=force_refresh,
        shop_ids=parsed,
    )


@router.get("/fulfillment", tags=["Analytics"])
async def get_fulfillment_analytics(
    shop_id: Optional[int] = None,
    shop_ids: Optional[str] = Query(None, description="Comma-separated shop IDs"),
    force_refresh: bool = Query(False, description="Force cache refresh"),
    context: UserContext = Depends(require_analytics_access()),
    db: Session = Depends(get_db)
):
    """Get fulfillment analytics with multi-store support."""
    parsed = _parse_analytics_shop_ids(shop_ids, shop_id, context, db)
    analytics = AnalyticsService(db)
    return analytics.get_fulfillment_analytics(
        tenant_id=context.tenant_id,
        shop_id=shop_id if not parsed else None,
        force_refresh=force_refresh,
        shop_ids=parsed,
    )


@router.get("/comparison", tags=["Analytics"])
async def get_comparison_analytics(
    shop_ids: str = Query(..., description="Comma-separated shop IDs to compare"),
    force_refresh: bool = Query(False, description="Force cache refresh"),
    context: UserContext = Depends(require_analytics_access()),
    db: Session = Depends(get_db)
):
    """
    Get per-shop analytics breakdown for comparison.
    Returns individual analytics for each shop so they can be displayed side-by-side.
    """
    parsed = _parse_analytics_shop_ids(shop_ids, None, context, db)
    if not parsed or len(parsed) < 1:
        raise HTTPException(status_code=400, detail="At least one shop_id is required")

    analytics = AnalyticsService(db)
    per_shop = {}
    for sid in parsed:
        overview = analytics.get_overview_analytics(
            tenant_id=context.tenant_id,
            shop_id=sid,
            force_refresh=force_refresh,
        )
        orders = analytics.get_order_analytics(
            tenant_id=context.tenant_id,
            shop_id=sid,
            force_refresh=force_refresh,
        )
        per_shop[str(sid)] = {
            "overview": overview,
            "orders": orders,
        }

    return {
        "shops": per_shop,
        "shop_ids": parsed,
    }


@router.post("/invalidate", tags=["Analytics"])
async def invalidate_analytics_cache(
    shop_id: Optional[int] = None,
    context: UserContext = Depends(require_analytics_access()),
    db: Session = Depends(get_db)
):
    """Force invalidate analytics cache for tenant."""
    if shop_id:
        ensure_shop_access(shop_id, context, db)
    analytics = AnalyticsService(db)
    analytics.invalidate_all(context.tenant_id, shop_id)
    return {"message": "Analytics cache invalidated"}
