"""
Analytics API Endpoints
Owner/Admin-only analytics with cached aggregations
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.api.dependencies import get_user_context, UserContext
from app.core.database import get_db
from app.core.query_helpers import ensure_shop_access
from app.api.dependencies import require_analytics_access, require_revenue_access
from app.services.analytics_service import AnalyticsService


router = APIRouter()


@router.get("/overview", tags=["Analytics"])
async def get_overview_analytics(
    shop_id: Optional[int] = None,
    force_refresh: bool = Query(False, description="Force cache refresh"),
    context: UserContext = Depends(require_analytics_access()),
    db: Session = Depends(get_db)
):
    """
    Get overview analytics: total orders, revenue, trends
    Requires: VIEW_ANALYTICS permission (Owner, Admin, Viewer only)
    Cached for 5 minutes unless force_refresh=True
    
    Args:
        shop_id: Optional shop filter
        force_refresh: Force cache refresh if True
        
    Returns:
        Overview analytics with 7-day and 30-day trends
    """
    if shop_id:
        ensure_shop_access(shop_id, context, db)
    analytics = AnalyticsService(db)
    return analytics.get_overview_analytics(
        tenant_id=context.tenant_id,
        shop_id=shop_id,
        force_refresh=force_refresh
    )


@router.get("/orders", tags=["Analytics"])
async def get_order_analytics(
    shop_id: Optional[int] = None,
    force_refresh: bool = Query(False, description="Force cache refresh"),
    context: UserContext = Depends(require_analytics_access()),
    db: Session = Depends(get_db)
):
    """
    Get order analytics: status breakdown, payment breakdown
    Requires: VIEW_ANALYTICS permission (Owner, Admin, Viewer only)
    Cached for 5 minutes unless force_refresh=True
    
    Args:
        shop_id: Optional shop filter
        force_refresh: Force cache refresh if True
        
    Returns:
        Order analytics with status and payment breakdowns
    """
    if shop_id:
        ensure_shop_access(shop_id, context, db)
    analytics = AnalyticsService(db)
    return analytics.get_order_analytics(
        tenant_id=context.tenant_id,
        shop_id=shop_id,
        force_refresh=force_refresh
    )


@router.get("/products", tags=["Analytics"])
async def get_product_analytics(
    shop_id: Optional[int] = None,
    force_refresh: bool = Query(False, description="Force cache refresh"),
    context: UserContext = Depends(require_analytics_access()),
    db: Session = Depends(get_db)
):
    """
    Get product analytics: listing performance, publish stats
    Requires: VIEW_ANALYTICS permission (Owner, Admin, Viewer only)
    Cached for 5 minutes unless force_refresh=True
    
    Args:
        shop_id: Optional shop filter
        force_refresh: Force cache refresh if True
        
    Returns:
        Product and listing job analytics
    """
    if shop_id:
        ensure_shop_access(shop_id, context, db)
    analytics = AnalyticsService(db)
    return analytics.get_product_analytics(
        tenant_id=context.tenant_id,
        shop_id=shop_id,
        force_refresh=force_refresh
    )


@router.get("/fulfillment", tags=["Analytics"])
async def get_fulfillment_analytics(
    shop_id: Optional[int] = None,
    force_refresh: bool = Query(False, description="Force cache refresh"),
    context: UserContext = Depends(require_analytics_access()),
    db: Session = Depends(get_db)
):
    """
    Get fulfillment analytics: shipment timing, delivery rates
    Requires: VIEW_ANALYTICS permission (Owner, Admin, Viewer only)
    Cached for 5 minutes unless force_refresh=True
    
    Note: Supplier performance data is included but should only be
    displayed to owners in the frontend
    
    Args:
        shop_id: Optional shop filter
        force_refresh: Force cache refresh if True
        
    Returns:
        Fulfillment analytics with shipment states and timing
    """
    if shop_id:
        ensure_shop_access(shop_id, context, db)
    analytics = AnalyticsService(db)
    return analytics.get_fulfillment_analytics(
        tenant_id=context.tenant_id,
        shop_id=shop_id,
        force_refresh=force_refresh
    )


@router.post("/invalidate", tags=["Analytics"])
async def invalidate_analytics_cache(
    shop_id: Optional[int] = None,
    context: UserContext = Depends(require_analytics_access()),
    db: Session = Depends(get_db)
):
    """
    Force invalidate analytics cache for tenant
    Requires: VIEW_ANALYTICS permission (Owner, Admin, Viewer only)
    
    Args:
        shop_id: Optional shop filter
        
    Returns:
        Success message
    """
    if shop_id:
        ensure_shop_access(shop_id, context, db)
    analytics = AnalyticsService(db)
    analytics.invalidate_all(context.tenant_id, shop_id)
    return {"message": "Analytics cache invalidated"}
