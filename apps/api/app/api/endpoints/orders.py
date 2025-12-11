"""
Orders API Endpoints
Manage Etsy orders and synchronization
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone

from app.api.dependencies import get_user_context, UserContext, require_permission, require_any_permission
from app.core.database import get_db
from app.core.rbac import Permission
from app.core.query_helpers import filter_by_tenant, ensure_tenant_access
from app.models.tenancy import Order, Shop

router = APIRouter()


@router.get("/stats", tags=["Orders"])
async def get_order_stats(
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

    # Get total order count
    total_orders = base_query.count()

    # Count by payment status
    pending_payment = base_query.filter(Order.payment_status == 'pending').count()

    completed = base_query.filter(Order.status.in_(['delivered', 'completed'])).count()

    refunded = base_query.filter(Order.payment_status == 'refunded').count()

    failed = base_query.filter(Order.payment_status == 'failed').count()

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

    # Apply filters
    if status:
        query = query.filter(Order.status == status)
    if payment_status:
        query = query.filter(Order.payment_status == payment_status)

    # Get total count before pagination
    total = query.count()

    # Apply pagination and ordering
    orders = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()

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
    from app.services.etsy_client import EtsyClient
    from app.core.redis import get_redis_client
    from app.services.rate_limiter import get_rate_limiter
    
    # Get all connected shops for this tenant
    shops = db.query(Shop).filter(
        Shop.tenant_id == context.tenant_id,
        Shop.status == 'connected'
    ).all()
    
    if not shops:
        raise HTTPException(
            status_code=400,
            detail="No connected shops found. Please connect an Etsy shop first."
        )
    
    # Initialize Etsy client
    redis_client = get_redis_client()
    rate_limiter = get_rate_limiter(redis_client)
    etsy_client = EtsyClient(db, rate_limiter)
    
    total_synced = 0
    total_new = 0
    total_updated = 0
    errors = []
    
    # Sync orders from each shop
    for shop in shops:
        try:
            # Fetch receipts (orders) from Etsy
            receipts_response = await etsy_client.get_shop_receipts(
                shop_id=shop.id,
                etsy_shop_id=shop.etsy_shop_id,
                limit=100  # Fetch last 100 orders
            )
            
            receipts = receipts_response.get("results", [])
            
            for receipt in receipts:
                receipt_id = str(receipt.get("receipt_id"))
                
                # Check if order already exists
                existing_order = db.query(Order).filter(
                    Order.etsy_receipt_id == receipt_id
                ).first()
                
                # Extract order data
                buyer_name = f"{receipt.get('name', '')}".strip() or "Unknown"
                buyer_email = receipt.get('buyer_email', 'unknown@example.com')
                total_price = float(receipt.get('grandtotal', {}).get('amount', 0)) / 100  # Convert cents to dollars
                currency = receipt.get('grandtotal', {}).get('currency_code', 'USD')
                
                # Map Etsy status to our status
                etsy_status = receipt.get('status', '').lower()
                if etsy_status in ['paid', 'completed']:
                    order_status = 'completed'
                elif etsy_status in ['open', 'pending']:
                    order_status = 'pending'
                else:
                    order_status = 'pending'
                
                # Map payment status
                payment_method = receipt.get('payment_method', '').lower()
                if 'paid' in payment_method or etsy_status == 'paid':
                    payment_status = 'paid'
                else:
                    payment_status = 'pending'
                
                # Extract shipping address
                shipping_address = {}
                if 'formatted_address' in receipt:
                    shipping_address = {
                        "name": receipt.get('name'),
                        "address1": receipt.get('first_line'),
                        "address2": receipt.get('second_line'),
                        "city": receipt.get('city'),
                        "state": receipt.get('state'),
                        "zip": receipt.get('zip'),
                        "country": receipt.get('country_iso')
                    }
                
                if existing_order:
                    # Ensure existing order belongs to tenant
                    ensure_tenant_access(existing_order.tenant_id, context)
                    
                    # Update existing order
                    existing_order.buyer_name = buyer_name
                    existing_order.buyer_email = buyer_email
                    existing_order.total_price = total_price
                    existing_order.currency = currency
                    existing_order.status = order_status
                    existing_order.payment_status = payment_status
                    existing_order.shipping_address = shipping_address
                    existing_order.synced_at = datetime.now(timezone.utc)
                    existing_order.updated_at = datetime.now(timezone.utc)
                    total_updated += 1
                else:
                    # Create new order
                    new_order = Order(
                        tenant_id=context.tenant_id,
                        shop_id=shop.id,
                        etsy_receipt_id=receipt_id,
                        order_id=f"ETSY-{receipt_id}",
                        buyer_name=buyer_name,
                        buyer_email=buyer_email,
                        total_price=total_price,
                        currency=currency,
                        status=order_status,
                        payment_status=payment_status,
                        shipping_address=shipping_address,
                        synced_at=datetime.now(timezone.utc)
                    )
                    db.add(new_order)
                    total_new += 1
                
                total_synced += 1
            
            db.commit()
            
        except Exception as e:
            errors.append({
                "shop_id": shop.id,
                "shop_name": shop.display_name,
                "error": str(e)
            })
            continue
    
    # Prepare response
    response = {
        "message": f"Successfully synced {total_synced} orders",
        "total_synced": total_synced,
        "new_orders": total_new,
        "updated_orders": total_updated,
        "shops_processed": len(shops),
        "status": "completed"
    }
    
    if errors:
        response["errors"] = errors
        response["status"] = "completed_with_errors"
    
    return response
