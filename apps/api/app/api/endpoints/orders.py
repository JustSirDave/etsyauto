"""
Orders API Endpoints
Manage Etsy orders and synchronization
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.tenancy import Order

router = APIRouter()


@router.get("/", tags=["Orders"])
async def list_orders(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all orders for current tenant

    Args:
        skip: Number of records to skip (pagination)
        limit: Maximum number of records to return
        status: Filter by order status (optional)
        payment_status: Filter by payment status (optional)

    Returns:
        List of orders with pagination info
    """
    tenant_id = int(current_user["tenant_id"])

    # Build query
    query = db.query(Order).filter(
        Order.tenant_id == tenant_id
    )

    # Apply filters
    if status:
        query = query.filter(Order.status == status)
    if payment_status:
        query = query.filter(Order.payment_status == payment_status)

    # Get total count before pagination
    total = query.count()

    # Apply pagination and ordering
    orders = query.order_by(
        Order.created_at.desc()
    ).offset(skip).limit(limit).all()

    # Format orders for response
    formatted_orders = []
    for order in orders:
        formatted_orders.append({
            "id": order.id,
            "order_id": order.etsy_receipt_id or f"#{order.id}",
            "etsy_receipt_id": order.etsy_receipt_id,
            "shop_id": order.shop_id,
            "buyer_name": order.buyer_name,
            "buyer_email": order.buyer_email,
            "total_price": float(order.total_price) if order.total_price else 0.0,
            "currency": order.currency_code or "USD",
            "status": order.status or "pending",
            "payment_status": order.payment_status or "pending",
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "updated_at": order.updated_at.isoformat() if order.updated_at else None,
        })

    return {
        "orders": formatted_orders,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/{order_id}", tags=["Orders"])
async def get_order(
    order_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get single order details

    Args:
        order_id: Order ID

    Returns:
        Order details
    """
    tenant_id = int(current_user["tenant_id"])

    order = db.query(Order).filter(
        Order.id == order_id,
        Order.tenant_id == tenant_id
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return {
        "id": order.id,
        "etsy_receipt_id": order.etsy_receipt_id,
        "shop_id": order.shop_id,
        "buyer_name": order.buyer_name,
        "buyer_email": order.buyer_email,
        "total_price": float(order.total_price) if order.total_price else 0.0,
        "currency": order.currency_code or "USD",
        "status": order.status or "pending",
        "payment_status": order.payment_status or "pending",
        "shipping_address": order.shipping_address,
        "items": order.items or [],
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "updated_at": order.updated_at.isoformat() if order.updated_at else None,
        "synced_at": order.synced_at.isoformat() if order.synced_at else None,
    }


@router.post("/sync", tags=["Orders"])
async def sync_orders(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Trigger order synchronization from Etsy

    This endpoint will:
    1. Fetch latest orders from Etsy API
    2. Update existing orders
    3. Create new orders
    4. Return sync summary

    Note: This is a placeholder - full implementation requires
    Etsy API integration with Shop oauth tokens
    """
    # TODO: Implement actual Etsy API sync
    # For now, return a placeholder response
    return {
        "message": "Order sync initiated",
        "status": "in_progress",
        "note": "Full implementation requires Etsy API integration"
    }
