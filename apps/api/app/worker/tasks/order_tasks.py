"""
Celery Tasks for Order Synchronization
Handles syncing orders from Etsy to local database
"""
import logging
from datetime import datetime
from typing import Dict, Any, List

from app.worker.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.listings import Order
from app.models.tenancy import Shop
from app.services.etsy_client import EtsyClient, EtsyAPIError
from app.services.rate_limiter import get_rate_limiter
from app.core.redis import get_redis_client

logger = logging.getLogger(__name__)


@celery_app.task(name="app.worker.tasks.order_tasks.sync_orders")
def sync_orders(shop_id: int = None) -> Dict[str, Any]:
    """
    Sync orders from Etsy for one or all shops.

    Args:
        shop_id: Optional specific shop ID, or None for all shops

    Returns:
        dict: Summary of sync operation
    """
    db = SessionLocal()

    try:
        # Get shops to sync
        if shop_id:
            shops = [db.query(Shop).filter(Shop.id == shop_id).first()]
            if not shops[0]:
                return {"success": False, "error": "Shop not found"}
        else:
            shops = db.query(Shop).filter(Shop.status == "connected").all()

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
                shop_result = await _sync_shop_orders(db, etsy_client, shop)

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


async def _sync_shop_orders(db, etsy_client: EtsyClient, shop: Shop) -> Dict[str, Any]:
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
        # Fetch recent receipts from Etsy (last 100)
        receipts_response = await etsy_client.get_shop_receipts(
            shop_id=shop.id,
            etsy_shop_id=shop.etsy_shop_id,
            limit=100,
            offset=0
        )

        receipts = receipts_response.get("results", [])
        logger.info(f"Fetched {len(receipts)} receipts for shop {shop.id}")

        for receipt in receipts:
            try:
                # Check if order exists
                existing_order = (
                    db.query(Order)
                    .filter(
                        Order.etsy_order_id == str(receipt["receipt_id"]),
                        Order.shop_id == shop.id
                    )
                    .first()
                )

                # Map Etsy receipt status to our status
                etsy_status = receipt.get("status", "").lower()
                our_status = _map_etsy_status(etsy_status)

                if existing_order:
                    # Update existing order
                    existing_order.status = our_status
                    existing_order.synced_at = datetime.utcnow()

                    # Update tracking if available
                    if receipt.get("shipments"):
                        shipment = receipt["shipments"][0]  # First shipment
                        existing_order.tracking_number = shipment.get("tracking_code")
                        existing_order.tracking_carrier = shipment.get("carrier_name")

                    result["orders_updated"] += 1

                else:
                    # Create new order
                    order = Order(
                        etsy_order_id=str(receipt["receipt_id"]),
                        shop_id=shop.id,
                        tenant_id=shop.tenant_id,
                        status=our_status,
                        buyer_email=receipt.get("buyer_email", ""),
                        total_price=float(receipt.get("grandtotal", {}).get("amount", 0)) / 100,  # Cents to dollars
                        currency=receipt.get("grandtotal", {}).get("currency_code", "USD"),
                        items_count=len(receipt.get("transactions", [])),
                        synced_at=datetime.utcnow()
                    )

                    # Add tracking if available
                    if receipt.get("shipments"):
                        shipment = receipt["shipments"][0]
                        order.tracking_number = shipment.get("tracking_code")
                        order.tracking_carrier = shipment.get("carrier_name")

                    db.add(order)
                    result["orders_created"] += 1

                result["orders_synced"] += 1

            except Exception as e:
                logger.error(f"Error processing receipt {receipt.get('receipt_id')}: {e}")
                continue

        db.commit()

        logger.info(
            f"Shop {shop.id} sync: {result['orders_synced']} orders "
            f"({result['orders_created']} new, {result['orders_updated']} updated)"
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
        "refunded": "cancelled",
    }

    return status_map.get(etsy_status, "pending")


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
        receipt = await etsy_client.get_receipt(
            shop_id=shop.id,
            etsy_shop_id=shop.etsy_shop_id,
            receipt_id=receipt_id
        )

        # Check if order exists
        existing_order = (
            db.query(Order)
            .filter(
                Order.etsy_order_id == receipt_id,
                Order.shop_id == shop.id
            )
            .first()
        )

        etsy_status = receipt.get("status", "").lower()
        our_status = _map_etsy_status(etsy_status)

        if existing_order:
            # Update
            existing_order.status = our_status
            existing_order.synced_at = datetime.utcnow()

            if receipt.get("shipments"):
                shipment = receipt["shipments"][0]
                existing_order.tracking_number = shipment.get("tracking_code")
                existing_order.tracking_carrier = shipment.get("carrier_name")

            db.commit()

            return {
                "success": True,
                "order_id": existing_order.id,
                "action": "updated"
            }

        else:
            # Create
            order = Order(
                etsy_order_id=receipt_id,
                shop_id=shop.id,
                tenant_id=shop.tenant_id,
                status=our_status,
                buyer_email=receipt.get("buyer_email", ""),
                total_price=float(receipt.get("grandtotal", {}).get("amount", 0)) / 100,
                currency=receipt.get("grandtotal", {}).get("currency_code", "USD"),
                items_count=len(receipt.get("transactions", [])),
                synced_at=datetime.utcnow()
            )

            if receipt.get("shipments"):
                shipment = receipt["shipments"][0]
                order.tracking_number = shipment.get("tracking_code")
                order.tracking_carrier = shipment.get("carrier_name")

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
