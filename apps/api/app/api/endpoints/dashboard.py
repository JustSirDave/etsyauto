"""
Dashboard API Endpoints
Provides aggregated statistics for the dashboard
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct

from app.api.dependencies import get_user_context, UserContext, require_permission
from app.core.database import get_db
from app.core.rbac import Permission
from app.core.query_helpers import filter_by_tenant, ensure_shop_access
from app.models.listings import Product, ListingJob, Order
from app.services.order_utils import derive_payment_status

router = APIRouter()


@router.get("/stats", tags=["Dashboard"])
async def get_dashboard_stats(
    shop_id: int | None = None,
    context: UserContext = Depends(get_user_context),  # Dashboard accessible to all authenticated users
    db: Session = Depends(get_db)
):
    """
    Get dashboard statistics
    Available to: all authenticated users

    Returns:
    - total_products: Total number of products
    - total_customers: Unique customers count (from orders)
    - total_orders: Total number of orders
    - active_listings: Number of active/completed listing jobs
    - recent_activity: Recent changes summary
    """
    # Count total products (filtered by tenant)
    products_query = filter_by_tenant(
        db.query(Product),
        context.tenant_id,
        Product.tenant_id
    )
    if shop_id:
        ensure_shop_access(shop_id, context, db)
        products_query = products_query.filter(Product.shop_id == shop_id)
    total_products = products_query.count()

    # Count active/completed listings (filtered by tenant)
    listings_query = filter_by_tenant(
        db.query(ListingJob),
        context.tenant_id,
        ListingJob.tenant_id
    ).filter(
        ListingJob.status.in_(['completed', 'processing', 'pending']) if hasattr(ListingJob, 'status') else ListingJob.state.in_(['done', 'processing', 'queued'])
    )
    if shop_id:
        listings_query = listings_query.filter(ListingJob.shop_id == shop_id)
    active_listings = listings_query.count()

    # Count total orders (filtered by tenant)
    orders_query = filter_by_tenant(
        db.query(Order),
        context.tenant_id,
        Order.tenant_id
    )
    if shop_id:
        orders_query = orders_query.filter(Order.shop_id == shop_id)
    total_orders = orders_query.count()

    # Count unique customers (from orders, filtered by tenant)
    customers_query = db.query(
        func.count(distinct(Order.buyer_email))
    ).filter(
        Order.tenant_id == context.tenant_id,
        Order.buyer_email.isnot(None)
    )
    if shop_id:
        customers_query = customers_query.filter(Order.shop_id == shop_id)
    total_customers = customers_query.scalar() or 0

    # Get percentage changes (mock for now, would need historical data)
    # In a real implementation, you'd compare with previous period
    product_change = 12  # +12%
    customer_change = 8   # +8%
    order_change = 15     # +15%
    listing_change = 5    # +5%

    return {
        "total_products": total_products,
        "total_customers": total_customers,
        "total_orders": total_orders,
        "active_listings": active_listings,
        "changes": {
            "products": product_change,
            "customers": customer_change,
            "orders": order_change,
            "listings": listing_change
        }
    }


@router.get("/recent-orders", tags=["Dashboard"])
async def get_recent_orders(
    limit: int = 5,
    shop_id: int | None = None,
    context: UserContext = Depends(require_permission(Permission.READ_ORDER)),
    db: Session = Depends(get_db)
):
    """
    Get recent orders for dashboard
    Requires: READ_ORDER permission (all roles)

    Args:
        limit: Number of orders to return (default 5)

    Returns:
        List of recent orders with basic info
    """
    # Get recent orders (filtered by tenant)
    orders_query = filter_by_tenant(
        db.query(Order),
        context.tenant_id,
        Order.tenant_id
    )
    if shop_id:
        ensure_shop_access(shop_id, context, db)
        orders_query = orders_query.filter(Order.shop_id == shop_id)
    
    # Order by Etsy date first (most accurate), fall back to local created_at
    from sqlalchemy import nullslast
    orders = orders_query.order_by(
        nullslast(Order.etsy_created_at.desc()),
        Order.created_at.desc()
    ).limit(limit).all()

    # Format orders for dashboard display
    formatted_orders = []
    for order in orders:
        # Prioritize Etsy-provided dates for accuracy
        order_date = order.etsy_created_at or order.created_at
        formatted_orders.append({
            "order_id": order.etsy_receipt_id or f"#{order.id}",
            "customer": order.buyer_name or "Unknown Customer",
            "customer_email": order.buyer_email,
            "date": order_date.strftime("%Y-%m-%d") if order_date else "N/A",
            "amount": f"${float(order.total_price or 0) / 100:.2f}",
            "status": order.status or "pending",
            "payment_status": derive_payment_status(order)
        })

    return {
        "orders": formatted_orders,
        "total": len(formatted_orders)
    }
