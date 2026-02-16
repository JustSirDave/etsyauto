"""
Celery Tasks for Financial Data Synchronization
Handles syncing ledger entries and payment details from Etsy
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

from app.worker.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.listings import LedgerEntry, PaymentDetail, Order
from app.models.tenancy import Shop, OAuthToken
from app.services.etsy_client import EtsyClient, EtsyAPIError
from app.services.rate_limiter import get_rate_limiter
from app.core.redis import get_redis_client

logger = logging.getLogger(__name__)

# --- Ledger entry type classification ---

_TYPE_KEYWORDS = {
    "sale": ["sale", "payment for order"],
    "refund": ["refund"],
    "reserve": ["reserve"],
    "payout": ["deposit", "payout", "withdrawal"],
    "listing_renewal": ["listing renewal", "listing fee", "renewal"],
    "transaction_fee": ["transaction fee"],
    "processing_fee": ["processing fee", "payment processing"],
    "advertising": ["etsy ads", "offsite ads", "advertising"],
    "shipping_label": ["shipping label", "postage"],
    "subscription": ["etsy plus", "subscription"],
    "tax": ["sales tax", "vat", "tax remittance"],
}


def _classify_entry(description: str) -> str:
    """Derive an entry_type from the ledger entry description."""
    if not description:
        return "other"
    desc_lower = description.lower()
    for entry_type, keywords in _TYPE_KEYWORDS.items():
        if any(kw in desc_lower for kw in keywords):
            return entry_type
    return "other"


def _has_billing_scope(db, shop: Shop) -> bool:
    """Check whether the shop's OAuth token includes the billing_r scope."""
    token = (
        db.query(OAuthToken)
        .filter(OAuthToken.shop_id == shop.id, OAuthToken.provider == "etsy")
        .first()
    )
    if not token or not token.scopes:
        return False
    return "billing_r" in token.scopes


# ============================================================
#  Ledger sync
# ============================================================

@celery_app.task(name="app.worker.tasks.financial_tasks.sync_ledger_entries", max_retries=3)
def sync_ledger_entries(
    shop_id: int = None,
    tenant_id: Optional[int] = None,
    force_full_sync: bool = False,
) -> Dict[str, Any]:
    """
    Sync shop payment-account ledger entries from Etsy.

    Incremental by default — fetches entries newer than the most recent
    synced entry (minus 5 min buffer).  Requires ``billing_r`` scope.
    """
    db = SessionLocal()
    try:
        shops = _get_shops(db, shop_id, tenant_id)
        results = {
            "shops_processed": 0,
            "entries_created": 0,
            "entries_updated": 0,
            "skipped_no_scope": 0,
            "errors": [],
        }

        redis_client = get_redis_client()
        rate_limiter = get_rate_limiter(redis_client)
        etsy_client = EtsyClient(db, rate_limiter)

        for shop in shops:
            if not _has_billing_scope(db, shop):
                results["skipped_no_scope"] += 1
                continue

            try:
                created, updated = asyncio.run(
                    _sync_shop_ledger(db, etsy_client, shop, force_full_sync)
                )
                results["entries_created"] += created
                results["entries_updated"] += updated
                results["shops_processed"] += 1
            except Exception as exc:
                logger.exception(f"Ledger sync failed for shop {shop.id}")
                results["errors"].append({"shop_id": shop.id, "error": str(exc)})

        return results
    finally:
        db.close()


async def _sync_shop_ledger(
    db, etsy_client: EtsyClient, shop: Shop, force_full: bool
) -> tuple[int, int]:
    """Paginate through ledger entries for a single shop."""
    min_created = None
    if not force_full:
        latest = (
            db.query(LedgerEntry.entry_created_at)
            .filter(LedgerEntry.shop_id == shop.id)
            .order_by(LedgerEntry.entry_created_at.desc())
            .first()
        )
        if latest and latest[0]:
            min_created = int((latest[0] - timedelta(minutes=5)).timestamp())

    created = updated = 0
    offset = 0
    while True:
        data = await etsy_client.get_shop_ledger_entries(
            shop_id=shop.id,
            etsy_shop_id=shop.etsy_shop_id,
            limit=100,
            offset=offset,
            min_created=min_created,
        )
        entries = data.get("results", [])
        if not entries:
            break

        for raw in entries:
            etsy_id = raw.get("entry_id")
            if not etsy_id:
                continue

            existing = (
                db.query(LedgerEntry)
                .filter(LedgerEntry.etsy_entry_id == etsy_id)
                .first()
            )
            description = raw.get("description", "")
            amount_obj = raw.get("amount", {})
            balance_obj = raw.get("balance", {})
            amount_cents = amount_obj.get("amount", 0)
            balance_cents = balance_obj.get("amount", 0)
            currency = amount_obj.get("currency_code", "USD")
            ts = raw.get("create_timestamp")
            entry_dt = datetime.fromtimestamp(ts, tz=timezone.utc) if ts else datetime.now(timezone.utc)

            if existing:
                existing.balance = balance_cents
                existing.synced_at = datetime.now(timezone.utc)
                updated += 1
            else:
                entry = LedgerEntry(
                    tenant_id=shop.tenant_id,
                    shop_id=shop.id,
                    etsy_entry_id=etsy_id,
                    etsy_ledger_id=raw.get("ledger_id", 0),
                    entry_type=_classify_entry(description),
                    description=description,
                    amount=amount_cents,
                    balance=balance_cents,
                    currency=currency,
                    entry_created_at=entry_dt,
                    synced_at=datetime.now(timezone.utc),
                )
                db.add(entry)
                created += 1

        db.commit()

        if len(entries) < 100:
            break
        offset += 100

    return created, updated


# ============================================================
#  Payment detail sync
# ============================================================

@celery_app.task(name="app.worker.tasks.financial_tasks.sync_payment_details", max_retries=3)
def sync_payment_details(
    shop_id: int = None,
    tenant_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Sync payment breakdowns for shipped/delivered orders that are
    missing a PaymentDetail record.  Uses ``transactions_r`` scope.
    """
    db = SessionLocal()
    try:
        shops = _get_shops(db, shop_id, tenant_id)
        results = {
            "shops_processed": 0,
            "payments_created": 0,
            "errors": [],
        }

        redis_client = get_redis_client()
        rate_limiter = get_rate_limiter(redis_client)
        etsy_client = EtsyClient(db, rate_limiter)

        for shop in shops:
            try:
                count = asyncio.run(
                    _sync_shop_payments(db, etsy_client, shop)
                )
                results["payments_created"] += count
                results["shops_processed"] += 1
            except Exception as exc:
                logger.exception(f"Payment sync failed for shop {shop.id}")
                results["errors"].append({"shop_id": shop.id, "error": str(exc)})

        return results
    finally:
        db.close()


async def _sync_shop_payments(
    db, etsy_client: EtsyClient, shop: Shop
) -> int:
    """Fetch payment details for orders that don't have them yet."""
    # Find shipped/delivered orders with no PaymentDetail
    from sqlalchemy import and_

    orders_needing_payments = (
        db.query(Order)
        .outerjoin(PaymentDetail, PaymentDetail.order_id == Order.id)
        .filter(
            Order.shop_id == shop.id,
            Order.fulfillment_status.in_(["shipped", "delivered"]),
            PaymentDetail.id.is_(None),
        )
        .limit(50)  # Batch size to stay within rate limits
        .all()
    )

    created = 0
    for order in orders_needing_payments:
        try:
            data = await etsy_client.get_payment_by_receipt(
                shop_id=shop.id,
                etsy_shop_id=shop.etsy_shop_id,
                receipt_id=order.etsy_receipt_id,
            )
            payments = data if isinstance(data, list) else data.get("results", [data])
            for raw in payments:
                payment_id = raw.get("payment_id")
                if not payment_id:
                    continue
                # Skip duplicates
                exists = db.query(PaymentDetail.id).filter(
                    PaymentDetail.etsy_payment_id == payment_id
                ).first()
                if exists:
                    continue

                def _cents(obj):
                    if isinstance(obj, dict):
                        return obj.get("amount", 0)
                    return obj or 0

                detail = PaymentDetail(
                    tenant_id=shop.tenant_id,
                    shop_id=shop.id,
                    order_id=order.id,
                    etsy_payment_id=payment_id,
                    etsy_receipt_id=order.etsy_receipt_id,
                    amount_gross=_cents(raw.get("amount_gross")),
                    amount_fees=_cents(raw.get("amount_fees")),
                    amount_net=_cents(raw.get("amount_net")),
                    posted_gross=_cents(raw.get("posted_gross")),
                    adjusted_gross=_cents(raw.get("adjusted_gross")),
                    adjusted_fees=_cents(raw.get("adjusted_fees")),
                    adjusted_net=_cents(raw.get("adjusted_net")),
                    currency=raw.get("currency", "USD"),
                    posted_at=_ts(raw.get("create_timestamp")),
                    synced_at=datetime.now(timezone.utc),
                )
                db.add(detail)
                created += 1

            db.commit()
        except EtsyAPIError as exc:
            if exc.status_code == 404:
                logger.debug(f"No payment data yet for receipt {order.etsy_receipt_id}")
            else:
                logger.warning(f"Payment fetch failed for receipt {order.etsy_receipt_id}: {exc}")
        except Exception as exc:
            logger.warning(f"Payment sync error for receipt {order.etsy_receipt_id}: {exc}")

    return created


# ============================================================
#  Helpers
# ============================================================

def _get_shops(db, shop_id: Optional[int], tenant_id: Optional[int]):
    """Return a list of connected shops matching the filter criteria."""
    query = db.query(Shop).filter(Shop.status == "connected")
    if shop_id:
        query = query.filter(Shop.id == shop_id)
    if tenant_id is not None:
        query = query.filter(Shop.tenant_id == tenant_id)
    return query.all()


def _ts(epoch) -> Optional[datetime]:
    """Convert an epoch timestamp to a timezone-aware datetime, or None."""
    if epoch:
        return datetime.fromtimestamp(int(epoch), tz=timezone.utc)
    return None
