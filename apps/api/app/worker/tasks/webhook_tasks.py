"""
Celery Tasks for Webhook Processing
Handles async processing of webhook events from Etsy and other providers
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any

from app.worker.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.listings import WebhookEvent, ListingJob, Product, Order
from app.models.tenancy import Shop
from app.services.etsy_client import EtsyClient, EtsyAPIError
from app.services.rate_limiter import get_rate_limiter
from app.core.redis import get_redis_client

logger = logging.getLogger(__name__)


@celery_app.task(name="app.worker.tasks.webhook_tasks.process_webhook_event", max_retries=3)
def process_webhook_event(webhook_event_id: int, shop_id: int) -> Dict[str, Any]:
    """
    Process a webhook event asynchronously.
    
    Args:
        webhook_event_id: WebhookEvent ID
        shop_id: Shop ID
    
    Returns:
        dict: Processing result
    """
    db = SessionLocal()
    
    try:
        webhook_event = db.query(WebhookEvent).filter(
            WebhookEvent.id == webhook_event_id
        ).first()
        
        if not webhook_event:
            logger.error(f"Webhook event {webhook_event_id} not found")
            return {"success": False, "error": "event_not_found"}
        
        if webhook_event.status == "processed":
            logger.info(f"Webhook event {webhook_event_id} already processed")
            return {"success": True, "status": "already_processed"}
        
        shop = db.query(Shop).filter(Shop.id == shop_id).first()
        if not shop:
            logger.error(f"Shop {shop_id} not found")
            webhook_event.status = "skipped"
            db.commit()
            return {"success": False, "error": "shop_not_found"}
        
        # Route to appropriate handler based on event type
        payload = webhook_event.payload
        event_type = payload.get("type", "")
        
        result = {}
        
        if event_type.startswith("listing."):
            result = _handle_listing_event(db, shop, payload)
        elif event_type.startswith("receipt.") or event_type.startswith("order."):
            result = _handle_order_event(db, shop, payload)
        elif event_type.startswith("shop."):
            result = _handle_shop_event(db, shop, payload)
        else:
            logger.warning(f"Unknown event type: {event_type}")
            webhook_event.status = "skipped"
            db.commit()
            return {"success": False, "error": "unknown_event_type"}
        
        # Mark as processed
        webhook_event.status = "processed"
        webhook_event.processed_at = datetime.now(timezone.utc)
        db.commit()
        
        logger.info(f"Successfully processed webhook event {webhook_event_id}")
        return {"success": True, "result": result}
        
    except Exception as e:
        logger.exception(f"Error processing webhook event {webhook_event_id}: {e}")
        
        if webhook_event:
            webhook_event.status = "pending"  # Will retry later
            db.commit()
        
        return {"success": False, "error": str(e)}
        
    finally:
        db.close()


def _handle_listing_event(db, shop: Shop, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle listing-related events (created, updated, deleted, state changes).
    
    Event types:
    - listing.created
    - listing.updated
    - listing.deactivated
    - listing.expired
    - listing.sold_out
    """
    event_type = payload.get("type")
    listing_id = str(payload.get("resource_id"))  # Etsy listing ID
    
    logger.info(f"Handling listing event: {event_type} for listing {listing_id}")
    
    # Find associated listing job
    listing_job = db.query(ListingJob).filter(
        ListingJob.shop_id == shop.id,
        ListingJob.etsy_listing_id == listing_id
    ).first()
    
    if not listing_job:
        logger.debug(f"No listing job found for Etsy listing {listing_id}")
        return {"action": "no_job_found"}
    
    # Update job status based on event
    if event_type == "listing.deactivated":
        listing_job.status = "cancelled"
        listing_job.error_message = "Listing deactivated on Etsy"
    elif event_type == "listing.expired":
        listing_job.status = "failed"
        listing_job.error_code = "LISTING_EXPIRED"
        listing_job.error_message = "Listing expired on Etsy"
    elif event_type == "listing.sold_out":
        # Fetch updated quantity from Etsy
        redis_client = get_redis_client()
        rate_limiter = get_rate_limiter(redis_client)
        etsy_client = EtsyClient(db, rate_limiter)
        
        try:
            listing_data = asyncio.run(etsy_client.get_listing(shop.id, listing_id))
            
            # Update product quantity
            product = db.query(Product).filter(Product.id == listing_job.product_id).first()
            if product:
                product.quantity = listing_data.get("quantity", 0)
        except Exception as e:
            logger.error(f"Failed to fetch listing {listing_id}: {e}")
    
    db.commit()
    
    return {
        "action": "job_updated",
        "job_id": listing_job.id,
        "event_type": event_type
    }


def _handle_order_event(db, shop: Shop, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle order/receipt events (new order, shipped, cancelled, refunded).
    
    Event types:
    - receipt.created
    - receipt.updated
    - receipt.shipped
    - receipt.refunded
    """
    event_type = payload.get("type")
    receipt_id = str(payload.get("resource_id"))  # Etsy receipt ID
    
    logger.info(f"Handling order event: {event_type} for receipt {receipt_id}")
    
    # Trigger order sync for this specific receipt
    from app.worker.tasks.order_tasks import sync_order_by_id
    sync_order_by_id.delay(shop.id, receipt_id)
    
    return {
        "action": "order_sync_triggered",
        "receipt_id": receipt_id,
        "event_type": event_type
    }


def _handle_shop_event(db, shop: Shop, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle shop-level events (shop updated, vacation mode, etc.).
    
    Event types:
    - shop.updated
    - shop.vacation_mode_changed
    """
    event_type = payload.get("type")
    
    logger.info(f"Handling shop event: {event_type} for shop {shop.id}")
    
    # Update shop metadata if available (with payload size limit)
    if event_type == "shop.updated" and "data" in payload:
        shop_data = payload.get("data", {})
        # Limit stored payload size to 64KB to prevent unbounded writes
        import json as _json
        serialized = _json.dumps(shop_data)
        if len(serialized) > 65536:
            logger.warning(f"Shop event payload too large ({len(serialized)} bytes) for shop {shop.id}, truncating")
            shop_data = {"_truncated": True, "shop_name": shop_data.get("shop_name")}
        shop.shop_data = shop_data
        shop.display_name = shop_data.get("shop_name", shop.display_name)
        db.commit()
    
    return {
        "action": "shop_updated",
        "event_type": event_type
    }


@celery_app.task(name="app.worker.tasks.webhook_tasks.reconcile_listings", max_retries=3)
def reconcile_listings(shop_id: int = None) -> Dict[str, Any]:
    """
    Periodic task to reconcile listing states with Etsy.
    
    This is a fallback for shops without webhooks or to catch missed events.
    Runs every hour to check for discrepancies.
    
    Args:
        shop_id: Optional specific shop ID, or None for all shops
    
    Returns:
        dict: Reconciliation summary
    """
    db = SessionLocal()
    
    try:
        # Get shops to reconcile
        if shop_id:
            shops = [db.query(Shop).filter(Shop.id == shop_id).first()]
            if not shops[0]:
                return {"success": False, "error": "shop_not_found"}
        else:
            shops = db.query(Shop).filter(Shop.status == "connected").all()
        
        results = {
            "shops_processed": 0,
            "listings_checked": 0,
            "discrepancies_found": 0,
            "updated": []
        }
        
        redis_client = get_redis_client()
        rate_limiter = get_rate_limiter(redis_client)
        etsy_client = EtsyClient(db, rate_limiter)
        
        for shop in shops:
            logger.info(f"Reconciling listings for shop {shop.id}")
            
            # Get active/processing listing jobs
            listing_jobs = db.query(ListingJob).filter(
                ListingJob.shop_id == shop.id,
                ListingJob.status.in_(['completed', 'processing']),
                ListingJob.etsy_listing_id.isnot(None)
            ).all()
            
            for job in listing_jobs:
                try:
                    # Fetch current listing state from Etsy
                    listing_data = asyncio.run(etsy_client.get_listing(
                        shop.id,
                        job.etsy_listing_id
                    ))
                    
                    etsy_state = listing_data.get("state")  # active, inactive, draft, expired, etc.
                    etsy_quantity = listing_data.get("quantity", 0)
                    
                    # Check for discrepancies
                    needs_update = False
                    
                    if etsy_state in ["inactive", "expired", "sold_out"] and job.status == "completed":
                        job.status = "failed"
                        job.error_code = f"ETSY_STATE_{etsy_state.upper()}"
                        job.error_message = f"Listing is {etsy_state} on Etsy"
                        needs_update = True
                    
                    # Update product quantity if significantly different
                    product = db.query(Product).filter(Product.id == job.product_id).first()
                    if product and abs((product.quantity or 0) - etsy_quantity) > 0:
                        product.quantity = etsy_quantity
                        needs_update = True
                    
                    if needs_update:
                        results["discrepancies_found"] += 1
                        results["updated"].append({
                            "job_id": job.id,
                            "listing_id": job.etsy_listing_id,
                            "etsy_state": etsy_state
                        })
                    
                    results["listings_checked"] += 1
                    
                except EtsyAPIError as e:
                    if e.status_code == 404:
                        # Listing deleted on Etsy
                        job.status = "failed"
                        job.error_code = "LISTING_DELETED"
                        job.error_message = "Listing not found on Etsy (deleted)"
                        results["discrepancies_found"] += 1
                    else:
                        logger.error(f"Error checking listing {job.etsy_listing_id}: {e}")
                    
                except Exception as e:
                    logger.error(f"Error reconciling listing job {job.id}: {e}")
            
            results["shops_processed"] += 1
            db.commit()
        
        logger.info(f"Reconciliation complete: {results}")
        return results
        
    except Exception as e:
        logger.exception(f"Error in listing reconciliation: {e}")
        return {"success": False, "error": str(e)}
        
    finally:
        db.close()

