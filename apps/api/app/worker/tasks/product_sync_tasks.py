"""
Celery Tasks for Etsy Product Sync
Fetch listings from Etsy and upsert into Product catalog
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.worker.celery_app import celery_app
from app.core.database import SessionLocal
from app.core.redis import get_redis_client
from app.models.listings import Product
from app.models.tenancy import Shop
from app.services.etsy_client import EtsyClient, EtsyAPIError
from app.services.rate_limiter import get_rate_limiter
from app.services.notification_service import notify_tenant_admins
from app.models.notifications import NotificationType

logger = logging.getLogger(__name__)


@celery_app.task(name="app.worker.tasks.product_sync_tasks.sync_products_from_etsy")
def sync_products_from_etsy(shop_id: int, tenant_id: int) -> Dict[str, Any]:
    """
    Sync Etsy listings into Products.

    Args:
        shop_id: Internal shop ID
        tenant_id: Tenant ID for access validation
    """
    db = SessionLocal()
    try:
        logger.info("Starting Etsy product sync for shop_id=%s tenant_id=%s", shop_id, tenant_id)
        shop = db.query(Shop).filter(
            Shop.id == shop_id,
            Shop.tenant_id == tenant_id
        ).first()
        if not shop:
            logger.warning("Etsy product sync aborted: shop not found shop_id=%s tenant_id=%s", shop_id, tenant_id)
            return {"success": False, "error": "Shop not found"}

        redis_client = get_redis_client()
        rate_limiter = get_rate_limiter(redis_client)
        etsy_client = EtsyClient(db, rate_limiter)

        results = {
            "success": True,
            "shop_id": shop_id,
            "tenant_id": tenant_id,
            "listings_fetched": 0,
            "products_created": 0,
            "products_updated": 0,
            "errors": []
        }

        limit = 100
        seen_listing_ids = set()
        states = ["active", "inactive", "draft", "sold_out"]

        for state in states:
            offset = 0
            while True:
                response = asyncio.run(etsy_client.get_shop_listings(
                    shop_id=shop.id,
                    etsy_shop_id=shop.etsy_shop_id,
                    limit=limit,
                    offset=offset,
                    state=state
                ))

                listings = response.get("results", [])
                count = response.get("count", 0)
                if not listings:
                    break

                for listing in listings:
                    listing_id = listing.get("listing_id")
                    if listing_id in seen_listing_ids:
                        continue
                    seen_listing_ids.add(listing_id)
                    results["listings_fetched"] += 1

                    try:
                        product_data = _extract_listing_product_data(
                            listing=listing,
                            shop=shop,
                            tenant_id=tenant_id,
                            etsy_client=etsy_client
                        )
                        if not product_data:
                            continue

                        existing = db.query(Product).filter(
                            Product.tenant_id == tenant_id,
                            Product.etsy_listing_id == product_data["etsy_listing_id"]
                        ).first()

                        if existing:
                            for key, value in product_data.items():
                                if hasattr(existing, key):
                                    setattr(existing, key, value)
                            results["products_updated"] += 1
                        else:
                            db.add(Product(**product_data))
                            results["products_created"] += 1

                    except Exception as e:
                        logger.error(f"Error processing listing {listing_id}: {e}")
                        results["errors"].append({
                            "listing_id": listing_id,
                            "error": str(e)
                        })

                if len(listings) < limit or offset + len(listings) >= count:
                    break
                offset += limit

        db.commit()
        logger.info(
            "Etsy product sync complete for shop_id=%s tenant_id=%s listings=%s created=%s updated=%s errors=%s",
            shop_id,
            tenant_id,
            results["listings_fetched"],
            results["products_created"],
            results["products_updated"],
            len(results["errors"]),
        )

        shop_name = shop.display_name or f"Shop {shop.id}"
        if results["products_created"] or results["products_updated"]:
            message = f"{shop_name}: {results['products_created']} new, {results['products_updated']} updated."
        else:
            message = f"{shop_name}: no listings found to sync."

        notify_tenant_admins(
            db=db,
            tenant_id=tenant_id,
            notification_type=NotificationType.INFO,
            title="Products synced from Etsy",
            message=message,
            action_url="/products",
            action_label="View products",
        )

        return results

    except EtsyAPIError as e:
        logger.error(f"Etsy API error syncing products for shop {shop_id}: {e}")
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.exception(f"Unexpected error syncing products for shop {shop_id}: {e}")
        return {"success": False, "error": str(e)}
    finally:
        db.close()


def _extract_listing_product_data(
    listing: Dict[str, Any],
    shop: Shop,
    tenant_id: int,
    etsy_client: EtsyClient
) -> Optional[Dict[str, Any]]:
    listing_id = listing.get("listing_id")
    if not listing_id:
        return None

    title = listing.get("title") or ""
    description = listing.get("description") or ""
    tags = listing.get("tags") or []
    quantity = listing.get("quantity")
    if quantity is None:
        quantity = listing.get("quantity_on_hand")

    sku = listing.get("sku")
    if not sku and listing.get("skus"):
        sku = listing.get("skus")[0]

    price_cents = _parse_listing_price_cents(listing.get("price"))

    images = []
    if listing.get("images"):
        images = [img.get("url_fullxfull") or img.get("url_570xN") for img in listing.get("images", []) if img]
    else:
        try:
            images_response = asyncio.run(etsy_client.get_listing_images(
                shop_id=shop.id,
                listing_id=str(listing_id),
                limit=10,
                offset=0
            ))
            images = [
                img.get("url_fullxfull") or img.get("url_570xN")
                for img in images_response.get("results", [])
                if img
            ]
        except Exception:
            images = []

    images = [img for img in images if img]

    return {
        "tenant_id": tenant_id,
        "shop_id": shop.id,
        "etsy_listing_id": str(listing_id),
        "sku": sku,
        "title_raw": title,
        "description_raw": description,
        "tags_raw": tags,
        "images": images,
        "price": price_cents,
        "quantity": quantity,
        "source": "etsy",
        "ingest_batch_id": f"etsy:{shop.etsy_shop_id}:{int(datetime.now(timezone.utc).timestamp())}",
    }


def _parse_listing_price_cents(price_data: Any) -> Optional[int]:
    if price_data is None:
        return None
    if isinstance(price_data, (int, float)):
        return int(round(float(price_data) * 100))

    if isinstance(price_data, dict):
        amount = price_data.get("amount")
        divisor = price_data.get("divisor") or 100
        if amount is None:
            return None
        try:
            return int(round(amount * (100 / float(divisor))))
        except (ValueError, TypeError, ZeroDivisionError):
            return None

    return None
