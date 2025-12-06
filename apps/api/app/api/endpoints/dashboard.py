"""
Dashboard API Endpoints
Provides aggregated statistics for the dashboard
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.listings import Product, ListingJob, Order

router = APIRouter()


@router.get("/stats", tags=["Dashboard"])
async def get_dashboard_stats(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get dashboard statistics

    Returns:
    - total_products: Total number of products
    - total_customers: Unique customers count (from orders)
    - total_orders: Total number of orders
    - active_listings: Number of active/completed listing jobs
    - recent_activity: Recent changes summary
    """
    tenant_id = int(current_user["tenant_id"])

    # Count total products
    total_products = db.query(Product).filter(
        Product.tenant_id == tenant_id
    ).count()

    # Count active/completed listings
    active_listings = db.query(ListingJob).filter(
        ListingJob.tenant_id == tenant_id,
        ListingJob.status.in_(['completed', 'processing', 'pending'])
    ).count()

    # Count total orders
    total_orders = db.query(Order).filter(
        Order.tenant_id == tenant_id
    ).count()

    # Count unique customers (from orders)
    # Assuming orders have buyer_email or buyer_name field
    total_customers = db.query(
        func.count(distinct(Order.buyer_email))
    ).filter(
        Order.tenant_id == tenant_id,
        Order.buyer_email.isnot(None)
    ).scalar() or 0

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
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get recent orders for dashboard

    Args:
        limit: Number of orders to return (default 5)

    Returns:
        List of recent orders with basic info
    """
    tenant_id = int(current_user["tenant_id"])

    # Get recent orders
    orders = db.query(Order).filter(
        Order.tenant_id == tenant_id
    ).order_by(
        Order.created_at.desc()
    ).limit(limit).all()

    # Format orders for dashboard display
    formatted_orders = []
    for order in orders:
        formatted_orders.append({
            "order_id": order.etsy_receipt_id or f"#{order.id}",
            "customer": order.buyer_name or "Unknown Customer",
            "customer_email": order.buyer_email,
            "date": order.created_at.strftime("%Y-%m-%d") if order.created_at else "N/A",
            "amount": f"${float(order.total_price):.2f}" if order.total_price else "$0.00",
            "status": order.status or "pending",
            "payment_status": order.payment_status or "pending"
        })

    return {
        "orders": formatted_orders,
        "total": len(formatted_orders)
    }
