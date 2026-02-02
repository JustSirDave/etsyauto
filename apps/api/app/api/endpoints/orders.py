"""
Orders API Endpoints
Manage Etsy orders and synchronization
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, nullslast
from sqlalchemy.orm import Session
from typing import Optional

from app.api.dependencies import get_user_context, UserContext, require_permission, require_any_permission
from app.core.database import get_db
from app.core.rbac import Permission
from app.core.query_helpers import filter_by_tenant, ensure_shop_access, ensure_tenant_access
from app.models.listings import Order
from app.models.tenancy import Shop
from app.services.order_utils import build_shipping_address, derive_payment_status

router = APIRouter()


@router.get("/stats", tags=["Orders"])
async def get_order_stats(
    shop_id: Optional[int] = None,
    context: UserContext = Depends(require_permission(Permission.READ_ORDER)),
    db: Session = Depends(get_db)
):
    """
    Get order statistics for dashboard cards
    Requires: READ_ORDER permission (all roles)

    Returns:
        Statistics about order counts by payment and delivery status
    """
    # Filter by tenant
    base_query = filter_by_tenant(db.query(Order), context.tenant_id, Order.tenant_id)
    if shop_id:
        ensure_shop_access(shop_id, context, db)
        base_query = base_query.filter(Order.shop_id == shop_id)

    # Get total order count
    total_orders = base_query.count()

    # Count by lifecycle status (derived payment status is not persisted)
    pending_payment = base_query.filter(Order.status.in_(["pending", "processing"])).count()
    completed = base_query.filter(Order.status.in_(["shipped", "delivered"])).count()
    refunded = base_query.filter(Order.status == "refunded").count()
    failed = base_query.filter(Order.status == "cancelled").count()

    return {
        "pending_payment": pending_payment,
        "completed": completed,
        "refunded": refunded,
        "failed": failed,
        "total": total_orders
    }


@router.get("/", tags=["Orders"])
async def list_orders(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    shop_id: Optional[int] = None,
    context: UserContext = Depends(require_permission(Permission.READ_ORDER)),
    db: Session = Depends(get_db)
):
    """
    List all orders for current tenant
    Requires: READ_ORDER permission (all roles)

    Args:
        skip: Number of records to skip (pagination)
        limit: Maximum number of records to return
        status: Filter by order status (optional)
        payment_status: Filter by payment status (optional)

    Returns:
        List of orders with pagination info
    """
    # Filter by tenant
    query = filter_by_tenant(db.query(Order), context.tenant_id, Order.tenant_id)

    if shop_id:
        ensure_shop_access(shop_id, context, db)
        query = query.filter(Order.shop_id == shop_id)

    # Apply filters
    if status:
        query = query.filter(Order.status == status)
    if payment_status:
        normalized = payment_status.lower()
        if normalized == "paid":
            query = query.filter(Order.etsy_status.in_(["paid", "completed"]))
        elif normalized == "refunded":
            query = query.filter(or_(Order.status == "refunded", Order.etsy_status == "refunded"))
        elif normalized == "failed":
            query = query.filter(Order.status == "cancelled")
        elif normalized == "pending":
            query = query.filter(
                or_(
                    Order.status.in_(["pending", "processing"]),
                    Order.etsy_status.in_(["open", "pending", "payment processing"]),
                )
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid payment_status filter value")

    # Get total count before pagination
    total = query.count()

    # Apply pagination and ordering
    orders = (
        query.order_by(
            nullslast(Order.etsy_created_at.desc()),
            Order.created_at.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )

    # Format orders for response
    formatted_orders = []
    for order in orders:
        first_item = None
        if order.line_items:
            for item in order.line_items:
                if not first_item:
                    first_item = item
                if isinstance(item, dict) and item.get("image"):
                    first_item = item
                    break

        item_image = None
        item_title = None
        if isinstance(first_item, dict):
            item_image = first_item.get("image")
            item_title = first_item.get("title") or first_item.get("product_name")

        formatted_orders.append({
            "id": order.id,
            "order_id": order.etsy_receipt_id or f"#{order.id}",
            "etsy_receipt_id": order.etsy_receipt_id,
            "shop_id": order.shop_id,
            "buyer_name": order.buyer_name,
            "buyer_email": order.buyer_email,
            "total_price": float(order.total_price or 0) / 100,
            "currency": order.currency or "USD",
            "status": order.status or "pending",
            "payment_status": derive_payment_status(order),
            "item_image": item_image,
            "item_title": item_title,
            "created_at": (
                (order.etsy_created_at or order.created_at).isoformat()
                if (order.etsy_created_at or order.created_at)
                else None
            ),
            "updated_at": (
                (order.etsy_updated_at or order.updated_at).isoformat()
                if (order.etsy_updated_at or order.updated_at)
                else None
            ),
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
    context: UserContext = Depends(require_permission(Permission.READ_ORDER)),
    db: Session = Depends(get_db)
):
    """
    Get single order details
    Requires: READ_ORDER permission (all roles)

    Args:
        order_id: Order ID

    Returns:
        Order details
    """
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.tenant_id == context.tenant_id
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    ensure_tenant_access(order.tenant_id, context)

    return {
        "id": order.id,
        "etsy_receipt_id": order.etsy_receipt_id,
        "shop_id": order.shop_id,
        "buyer_name": order.buyer_name,
        "buyer_email": order.buyer_email,
        "total_price": float(order.total_price or 0) / 100,
        "currency": order.currency or "USD",
        "status": order.status or "pending",
        "payment_status": derive_payment_status(order),
        "shipping_address": build_shipping_address(order),
        "items": order.line_items or [],
        "created_at": (
            (order.etsy_created_at or order.created_at).isoformat()
            if (order.etsy_created_at or order.created_at)
            else None
        ),
        "updated_at": (
            (order.etsy_updated_at or order.updated_at).isoformat()
            if (order.etsy_updated_at or order.updated_at)
            else None
        ),
        "synced_at": order.synced_at.isoformat() if order.synced_at else None,
    }


@router.post("/sync", tags=["Orders"])
async def sync_orders(
    force_full_sync: bool = False,
    shop_id: Optional[int] = None,
    context: UserContext = Depends(require_permission(Permission.SYNC_ORDER)),
    db: Session = Depends(get_db)
):
    """
    Trigger order synchronization from Etsy
    Requires: SYNC_ORDER permission (Owner, Admin only)

    This endpoint will:
    1. Fetch latest orders from Etsy API
    2. Update existing orders
    3. Create new orders
    4. Return sync summary
    """
    from app.worker.tasks.order_tasks import sync_orders as sync_orders_task
    
    # Get connected shops for this tenant (optionally scoped)
    shops_query = db.query(Shop).filter(
        Shop.tenant_id == context.tenant_id,
        Shop.status == 'connected'
    )
    if shop_id:
        ensure_shop_access(shop_id, context, db)
        shops_query = shops_query.filter(Shop.id == shop_id)
    shops = shops_query.all()
    
    if not shops:
        raise HTTPException(
            status_code=400,
            detail="No connected shops found. Please connect an Etsy shop first."
        )
    
    try:
        task = sync_orders_task.delay(
            tenant_id=context.tenant_id,
            shop_id=shop_id,
            force_full_sync=force_full_sync,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to queue order sync: {str(e)}")

    return {
        "message": "Order sync queued",
        "task_id": task.id,
        "shops_queued": len(shops),
        "status": "queued",
        "force_full_sync": force_full_sync,
        "shop_id": shop_id,
    }
