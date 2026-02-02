"""
Celery Tasks for Order Synchronization
Handles syncing orders from Etsy to local database
"""
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from app.worker.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.listings import Order
from app.models.tenancy import Shop
from app.services.etsy_client import EtsyClient, EtsyAPIError
from app.services.rate_limiter import get_rate_limiter
from app.services.notification_service import notify_tenant_admins
from app.models.notifications import NotificationType
from app.core.redis import get_redis_client

logger = logging.getLogger(__name__)


@celery_app.task(name="app.worker.tasks.order_tasks.sync_orders")
def sync_orders(
    shop_id: int = None,
    tenant_id: Optional[int] = None,
    force_full_sync: bool = False
) -> Dict[str, Any]:
    """
    Sync orders from Etsy for one or all shops.

    Args:
        shop_id: Optional specific shop ID, or None for all shops
        tenant_id: Optional tenant scope to limit shops
        force_full_sync: If true, ignore incremental filters and fetch all

    Returns:
        dict: Summary of sync operation
    """
    db = SessionLocal()

    try:
        # Get shops to sync
        if shop_id:
            shop_query = db.query(Shop).filter(Shop.id == shop_id)
            if tenant_id is not None:
                shop_query = shop_query.filter(Shop.tenant_id == tenant_id)
            shop = shop_query.first()
            if not shop:
                return {"success": False, "error": "Shop not found"}
            if shop.status != "connected":
                return {"success": False, "error": "Shop is not connected"}
            shops = [shop]
        else:
            shops_query = db.query(Shop).filter(Shop.status == "connected")
            if tenant_id is not None:
                shops_query = shops_query.filter(Shop.tenant_id == tenant_id)
            shops = shops_query.all()

        results = {
            "shops_processed": 0,
            "orders_synced": 0,
            "orders_updated": 0,
            "orders_created": 0,
            "errors": []
        }

        logger.info(f"Syncing orders for {len(shops)} shops")

        # Initialize Etsy client
        redis_client = get_redis_client()
        rate_limiter = get_rate_limiter(redis_client)
        etsy_client = EtsyClient(db, rate_limiter)

        for shop in shops:
            try:
                shop_result = asyncio.run(
                    _sync_shop_orders(
                        db,
                        etsy_client,
                        shop,
                        force_full_sync=force_full_sync,
                    )
                )

                results["shops_processed"] += 1
                results["orders_synced"] += shop_result["orders_synced"]
                results["orders_updated"] += shop_result["orders_updated"]
                results["orders_created"] += shop_result["orders_created"]

            except Exception as e:
                logger.exception(f"Error syncing orders for shop {shop.id}: {e}")
                results["errors"].append({
                    "shop_id": shop.id,
                    "error": str(e)
                })

        logger.info(
            f"Order sync complete: {results['shops_processed']} shops, "
            f"{results['orders_synced']} orders synced "
            f"({results['orders_created']} new, {results['orders_updated']} updated)"
        )

        return results

    finally:
        db.close()


async def _sync_shop_orders(
    db,
    etsy_client: EtsyClient,
    shop: Shop,
    force_full_sync: bool = False
) -> Dict[str, Any]:
    """
    Sync orders for a specific shop.

    Args:
        db: Database session
        etsy_client: Etsy API client
        shop: Shop instance

    Returns:
        dict: Sync summary
    """
    result = {
        "orders_synced": 0,
        "orders_created": 0,
        "orders_updated": 0
    }

    try:
        # Get last sync time for incremental sync
        last_order = (
            db.query(Order)
            .filter(Order.shop_id == shop.id)
            .order_by(Order.synced_at.desc())
            .first()
        )
        
        # Use incremental sync if we have a last sync time (fetch orders modified since then)
        min_last_modified = None
        if not force_full_sync and last_order and last_order.synced_at and last_order.etsy_receipt_id:
            # Subtract 5 minutes for safety (avoid missing updates)
            from datetime import timedelta
            sync_from = last_order.synced_at - timedelta(minutes=5)
            min_last_modified = int(sync_from.timestamp())
            logger.info(f"Incremental sync for shop {shop.id} from {sync_from}")
        else:
            logger.info(f"Full sync for shop {shop.id} (no previous sync)")
        
        # Paginate through all results (Etsy limit: 100 per page)
        all_receipts = []
        offset = 0
        limit = 100
        
        async def _fetch_receipts(min_modified: Optional[int]) -> List[Dict[str, Any]]:
            receipts_collected: List[Dict[str, Any]] = []
            current_offset = 0
            while True:
                receipts_response = await etsy_client.get_shop_receipts(
                    shop_id=shop.id,
                    etsy_shop_id=shop.etsy_shop_id,
                    limit=limit,
                    offset=current_offset,
                    min_last_modified=min_modified
                )

                receipts = receipts_response.get("results", [])
                count = receipts_response.get("count", 0)

                if not receipts:
                    break

                receipts_collected.extend(receipts)
                logger.debug(
                    f"Fetched {len(receipts)} receipts at offset {current_offset} "
                    f"(total: {count})"
                )

                # Check if there are more pages
                if len(receipts) < limit or current_offset + len(receipts) >= count:
                    break

                current_offset += limit

            return receipts_collected

        receipts = await _fetch_receipts(min_last_modified)

        # If incremental sync yields nothing, retry once with full sync
        if not receipts and min_last_modified is not None:
            logger.info(f"No receipts with incremental sync for shop {shop.id}. Retrying full sync.")
            receipts = await _fetch_receipts(None)
        
        logger.info(f"Fetched {len(receipts)} total receipts for shop {shop.id}")

        for receipt in receipts:
            try:
                receipt_id = str(receipt.get("receipt_id"))
                
                # Check if order exists
                existing_order = (
                    db.query(Order)
                    .filter(
                        Order.etsy_receipt_id == receipt_id,
                        Order.shop_id == shop.id
                    )
                    .first()
                )

                # Extract comprehensive order data
                    order_data = await _extract_order_data(
                        receipt,
                        shop.id,
                        shop.tenant_id,
                        shop.etsy_shop_id,
                        etsy_client,
                    )

                if existing_order:
                    # Update existing order with all fields
                    for key, value in order_data.items():
                        if hasattr(existing_order, key):
                            setattr(existing_order, key, value)
                    
                    result["orders_updated"] += 1
                    logger.debug(f"Updated order {receipt_id}")

                else:
                    # Create new order with all extracted data
                    order = Order(**order_data)
                    db.add(order)
                    result["orders_created"] += 1
                    logger.debug(f"Created new order {receipt_id}")

                result["orders_synced"] += 1

            except Exception as e:
                logger.error(f"Error processing receipt {receipt.get('receipt_id')}: {e}", exc_info=True)
                continue

        db.commit()

        logger.info(
            f"Shop {shop.id} sync: {result['orders_synced']} orders "
            f"({result['orders_created']} new, {result['orders_updated']} updated)"
        )

        if result["orders_created"] > 0:
            shop_name = shop.display_name or f"Shop {shop.id}"
            notify_tenant_admins(
                db=db,
                tenant_id=shop.tenant_id,
                notification_type=NotificationType.ORDER,
                title="New orders synced",
                message=f"{result['orders_created']} new order(s) synced for {shop_name}.",
                action_url="/orders",
                action_label="View orders",
            )

        return result

    except EtsyAPIError as e:
        logger.error(f"Etsy API error syncing shop {shop.id}: {e}")
        raise

    except Exception as e:
        logger.exception(f"Unexpected error syncing shop {shop.id}: {e}")
        raise


def _map_etsy_status(etsy_status: str) -> str:
    """
    Map Etsy receipt status to our internal status.

    Args:
        etsy_status: Etsy status string

    Returns:
        str: Our internal status
    """
    status_map = {
        "paid": "pending",
        "completed": "processing",
        "open": "pending",
        "payment processing": "pending",
        "shipped": "shipped",
        "delivered": "delivered",
        "canceled": "cancelled",
        "refunded": "refunded",
    }

    return status_map.get(etsy_status, "pending")


async def _extract_order_data(
    receipt: Dict[str, Any],
    shop_id: int,
    tenant_id: int,
    etsy_shop_id: str,
    etsy_client: EtsyClient,
) -> Dict[str, Any]:
    """
    Extract comprehensive order data from Etsy receipt.

    Args:
        receipt: Etsy receipt/order data
        shop_id: Shop ID
        tenant_id: Tenant ID

    Returns:
        dict: Order data ready for database insertion/update
    """
    etsy_status = receipt.get("status", "").lower()
    
    # Get buyer information
    buyer_email = receipt.get("buyer_email", "")
    buyer_user_id = str(receipt.get("buyer_user_id", "")) if receipt.get("buyer_user_id") else None
    
    # Extract shipping address
    shipping_address = receipt.get("first_line", {})  # Etsy uses nested structure
    name = receipt.get("name", "")
    
    # Get financial data (Etsy uses Money objects with amount in cents)
    grandtotal = receipt.get("grandtotal", {})
    subtotal = receipt.get("subtotal", {})
    total_shipping = receipt.get("total_shipping_cost", {})
    total_tax = receipt.get("total_tax_cost", {})
    discount = receipt.get("discount_amt", {})
    gift_wrap = receipt.get("gift_wrap_price", {})
    
    async def _get_listing_image_url(listing_id: Optional[str]) -> Optional[str]:
        if not listing_id:
            return None
        try:
            images = await etsy_client.get_listing_images(
                shop_id=shop_id,
                listing_id=str(listing_id),
                limit=1,
                offset=0,
            )
            results = images.get("results", []) if isinstance(images, dict) else []
            if not results:
                return None
            image = results[0] or {}
            return (
                image.get("url_fullxfull")
                or image.get("url_570xN")
                or image.get("url_170x135")
                or image.get("url_75x75")
                or image.get("url")
            )
        except Exception as e:
            logger.warning(f"Failed to fetch listing image for {listing_id}: {e}")
            return None

    # Extract line items (transactions)
    line_items = []
    transactions = receipt.get("transactions", [])
    if not transactions and receipt.get("receipt_id"):
        try:
            full_receipt = await etsy_client.get_receipt(
                shop_id=shop_id,
                etsy_shop_id=etsy_shop_id,
                receipt_id=str(receipt.get("receipt_id")),
            )
            if isinstance(full_receipt, dict):
                transactions = full_receipt.get("transactions", []) or transactions
        except Exception as e:
            logger.warning(f"Failed to fetch receipt details for {receipt.get('receipt_id')}: {e}")
    for txn in transactions:
        listing_id = txn.get("listing_id")
        listing_image = txn.get("listing_image") or {}
        image_url = (
            txn.get("image_url")
            or txn.get("listing_image_url")
            or listing_image.get("url_fullxfull")
            or listing_image.get("url_570xN")
            or listing_image.get("url_170x135")
            or listing_image.get("url_75x75")
            or listing_image.get("url")
        )
        if not image_url:
            image_url = await _get_listing_image_url(listing_id)

        line_item = {
            "transaction_id": str(txn.get("transaction_id")),
            "listing_id": str(listing_id) if listing_id is not None else None,
            "quantity": txn.get("quantity", 1),
            "title": txn.get("title", ""),
            "description": txn.get("description", ""),
            "sku": txn.get("sku", ""),
            "price": txn.get("price", {}).get("amount", 0),
            "currency": txn.get("price", {}).get("currency_code", "USD"),
            "variations": txn.get("variations", []),
            "product_data": txn.get("product_data", {}),
            "image": image_url,
        }
        line_items.append(line_item)
    
    # Extract shipments (can be multiple)
    shipments = []
    for shipment in receipt.get("shipments", []):
        shipment_data = {
            "receipt_shipping_id": str(shipment.get("receipt_shipping_id", "")),
            "tracking_code": shipment.get("tracking_code"),
            "tracking_url": shipment.get("tracking_url"),
            "carrier_name": shipment.get("carrier_name"),
            "shipping_date": shipment.get("mailing_date"),
            "is_delivered": shipment.get("is_delivered", False),
            "notification_date": shipment.get("notification_date")
        }
        shipments.append(shipment_data)
    
    # Parse timestamps
    created_timestamp = receipt.get("create_timestamp")
    updated_timestamp = receipt.get("update_timestamp")
    
    from datetime import datetime, timezone
    etsy_created_at = datetime.fromtimestamp(created_timestamp, tz=timezone.utc) if created_timestamp else None
    etsy_updated_at = datetime.fromtimestamp(updated_timestamp, tz=timezone.utc) if updated_timestamp else None
    
    # Build order data dictionary
    order_data = {
        "etsy_receipt_id": str(receipt.get("receipt_id")),
        "shop_id": shop_id,
        "tenant_id": tenant_id,
        "status": _map_etsy_status(etsy_status),
        "etsy_status": etsy_status,
        
        # Buyer info
        "buyer_user_id": buyer_user_id,
        "buyer_email": buyer_email,
        "buyer_name": name,
        
        # Shipping address
        "shipping_name": receipt.get("name", ""),
        "shipping_first_line": receipt.get("first_line", ""),
        "shipping_second_line": receipt.get("second_line", ""),
        "shipping_city": receipt.get("city", ""),
        "shipping_state": receipt.get("state", ""),
        "shipping_zip": receipt.get("zip", ""),
        "shipping_country": receipt.get("country", ""),
        "shipping_country_iso": receipt.get("country_iso", ""),
        
        # Financials (convert from cents to integer cents for storage)
        "subtotal": subtotal.get("amount", 0) if isinstance(subtotal, dict) else 0,
        "total_price": grandtotal.get("amount", 0) if isinstance(grandtotal, dict) else 0,
        "total_shipping_cost": total_shipping.get("amount", 0) if isinstance(total_shipping, dict) else 0,
        "total_tax_cost": total_tax.get("amount", 0) if isinstance(total_tax, dict) else 0,
        "discount_amt": discount.get("amount", 0) if isinstance(discount, dict) else 0,
        "gift_wrap_price": gift_wrap.get("amount", 0) if isinstance(gift_wrap, dict) else 0,
        "currency": grandtotal.get("currency_code", "USD") if isinstance(grandtotal, dict) else "USD",
        
        # Line items and shipments
        "line_items": line_items,
        "shipments": shipments,
        
        # Gift options
        "is_gift": receipt.get("is_gift", False),
        "gift_message": receipt.get("gift_message", ""),
        "message_from_buyer": receipt.get("message_from_buyer", ""),
        
        # Timestamps
        "etsy_created_at": etsy_created_at,
        "etsy_updated_at": etsy_updated_at,
        "synced_at": datetime.now(timezone.utc)
    }
    
    return order_data


@celery_app.task(name="app.worker.tasks.order_tasks.sync_order_by_id")
def sync_order_by_id(shop_id: int, receipt_id: str) -> Dict[str, Any]:
    """
    Sync a specific order by receipt ID.

    Args:
        shop_id: Shop ID
        receipt_id: Etsy receipt ID

    Returns:
        dict: Sync result
    """
    db = SessionLocal()

    try:
        shop = db.query(Shop).filter(Shop.id == shop_id).first()
        if not shop:
            return {"success": False, "error": "Shop not found"}

        # Initialize Etsy client
        redis_client = get_redis_client()
        rate_limiter = get_rate_limiter(redis_client)
        etsy_client = EtsyClient(db, rate_limiter)

        # Fetch specific receipt
        receipt = asyncio.run(etsy_client.get_receipt(
            shop_id=shop.id,
            etsy_shop_id=shop.etsy_shop_id,
            receipt_id=receipt_id
        ))

        # Check if order exists
        existing_order = (
            db.query(Order)
            .filter(
                Order.etsy_receipt_id == receipt_id,
                Order.shop_id == shop.id
            )
            .first()
        )

        # Extract comprehensive order data
        order_data = asyncio.run(
            _extract_order_data(
                receipt,
                shop.id,
                shop.tenant_id,
                shop.etsy_shop_id,
                etsy_client,
            )
        )

        if existing_order:
            # Update with all extracted data
            for key, value in order_data.items():
                if hasattr(existing_order, key):
                    setattr(existing_order, key, value)
            
            db.commit()

            return {
                "success": True,
                "order_id": existing_order.id,
                "action": "updated"
            }

        else:
            # Create new order
            order = Order(**order_data)
            db.add(order)
            db.commit()

            return {
                "success": True,
                "order_id": order.id,
                "action": "created"
            }

    except EtsyAPIError as e:
        logger.error(f"Etsy API error syncing order {receipt_id}: {e}")
        return {"success": False, "error": str(e)}

    except Exception as e:
        logger.exception(f"Error syncing order {receipt_id}: {e}")
        return {"success": False, "error": str(e)}

    finally:
        db.close()
