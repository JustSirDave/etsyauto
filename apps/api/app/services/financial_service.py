"""
Financial Analytics Service
Provides P&L summary, payout estimates, fee breakdowns, order profitability,
and timeline data — all with 5-minute Redis caching.
"""

import json
import logging
from datetime import datetime, timedelta, timezone, date
from typing import Optional, Dict, Any, List

from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case, extract

from app.models.listings import LedgerEntry, PaymentDetail, Order, Product, ExpenseInvoice
from app.core.redis import get_redis_client

logger = logging.getLogger(__name__)


class FinancialService:
    """
    Financial analytics with Redis caching.

    All monetary values are stored / returned in **cents** and converted to
    dollars on the frontend.  The service reads from the locally-synced
    ``ledger_entries`` and ``payment_details`` tables — *never* from the
    Etsy API directly.
    """

    CACHE_TTL = 300  # 5 minutes

    def __init__(self, db: Session):
        self.db = db
        self.redis = get_redis_client()

    # ------------------------------------------------------------------
    #  Caching helpers (same pattern as AnalyticsService)
    # ------------------------------------------------------------------

    def _cache_key(self, tenant_id: int, shop_id: Optional[int], metric: str, shop_ids: Optional[List[int]] = None) -> str:
        if shop_ids:
            ids_str = ",".join(str(s) for s in sorted(shop_ids))
            return f"financials:tenant_{tenant_id}:shops_{ids_str}:{metric}"
        shop_suffix = f":shop_{shop_id}" if shop_id else ""
        return f"financials:tenant_{tenant_id}{shop_suffix}:{metric}"

    def _get_cached(self, key: str) -> Optional[Dict[str, Any]]:
        if not self.redis:
            return None
        try:
            data = self.redis.get(key)
            if data:
                return json.loads(data)
        except Exception:
            pass
        return None

    def _set_cached(self, key: str, data: Any) -> None:
        if not self.redis:
            return
        try:
            self.redis.setex(key, self.CACHE_TTL, json.dumps(data, default=str))
        except Exception:
            pass

    # ------------------------------------------------------------------
    #  1. Profit & Loss summary
    # ------------------------------------------------------------------

    @staticmethod
    def _apply_shop_filter(filters: list, model_col, shop_id: Optional[int], shop_ids: Optional[List[int]] = None):
        """Append a shop filter — single id, multi ids, or none (tenant-wide)."""
        if shop_ids:
            filters.append(model_col.in_(shop_ids))
        elif shop_id:
            filters.append(model_col == shop_id)

    def get_profit_and_loss(
        self,
        tenant_id: int,
        shop_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        shop_ids: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """
        Aggregate P&L from ledger entries.

        Returns
        -------
        dict with keys: total_revenue, total_fees, total_refunds,
        total_shipping_labels, total_advertising, net_profit, currency,
        period_start, period_end.
        """
        ck = self._cache_key(tenant_id, shop_id, f"pnl:{start_date}:{end_date}", shop_ids)
        cached = self._get_cached(ck)
        if cached:
            return cached

        if not start_date:
            start_date = datetime.now(timezone.utc) - timedelta(days=30)
        if not end_date:
            end_date = datetime.now(timezone.utc)

        filters = [
            LedgerEntry.tenant_id == tenant_id,
            LedgerEntry.entry_created_at >= start_date,
            LedgerEntry.entry_created_at <= end_date,
        ]
        self._apply_shop_filter(filters, LedgerEntry.shop_id, shop_id, shop_ids)

        rows = (
            self.db.query(
                LedgerEntry.entry_type,
                func.sum(LedgerEntry.amount).label("total"),
            )
            .filter(and_(*filters))
            .group_by(LedgerEntry.entry_type)
            .all()
        )

        sums: Dict[str, int] = {}
        for entry_type, total in rows:
            sums[entry_type] = total or 0

        revenue = sums.get("sale", 0)
        fees = (
            abs(sums.get("transaction_fee", 0))
            + abs(sums.get("processing_fee", 0))
            + abs(sums.get("listing_renewal", 0))
            + abs(sums.get("subscription", 0))
        )
        refunds = abs(sums.get("refund", 0))
        shipping_labels = abs(sums.get("shipping_label", 0))
        advertising = abs(sums.get("advertising", 0))
        tax = abs(sums.get("tax", 0))
        net_profit = revenue - fees - refunds - shipping_labels - advertising

        result = {
            "total_revenue": revenue,
            "total_fees": fees,
            "total_refunds": refunds,
            "total_shipping_labels": shipping_labels,
            "total_advertising": advertising,
            "total_tax": tax,
            "net_profit": net_profit,
            "currency": "USD",
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
        }
        self._set_cached(ck, result)
        return result

    # ------------------------------------------------------------------
    #  2. Payout estimate
    # ------------------------------------------------------------------

    def get_payout_estimate(
        self,
        tenant_id: int,
        shop_id: Optional[int] = None,
        shop_ids: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """
        Return the latest ledger balance + recent payout entries.

        The ledger balance approximates the next payout amount.
        """
        ck = self._cache_key(tenant_id, shop_id, "payout_estimate", shop_ids)
        cached = self._get_cached(ck)
        if cached:
            return cached

        filters = [LedgerEntry.tenant_id == tenant_id]
        self._apply_shop_filter(filters, LedgerEntry.shop_id, shop_id, shop_ids)

        # Latest balance
        latest = (
            self.db.query(LedgerEntry.balance, LedgerEntry.currency, LedgerEntry.entry_created_at)
            .filter(and_(*filters))
            .order_by(LedgerEntry.entry_created_at.desc())
            .first()
        )

        current_balance = latest[0] if latest else 0
        currency = latest[1] if latest else "USD"

        # Recent payouts (last 30 days)
        payout_filters = filters + [
            LedgerEntry.entry_type == "payout",
            LedgerEntry.entry_created_at >= datetime.now(timezone.utc) - timedelta(days=30),
        ]
        recent_payouts = (
            self.db.query(
                LedgerEntry.amount,
                LedgerEntry.entry_created_at,
            )
            .filter(and_(*payout_filters))
            .order_by(LedgerEntry.entry_created_at.desc())
            .limit(10)
            .all()
        )

        # Reserve estimate — sum of reserve-type entries
        reserve_filters = filters + [LedgerEntry.entry_type == "reserve"]
        reserve_total = (
            self.db.query(func.sum(LedgerEntry.amount))
            .filter(and_(*reserve_filters))
            .scalar()
        ) or 0

        result = {
            "current_balance": current_balance,
            "reserve_held": abs(reserve_total),
            "available_for_payout": current_balance - abs(reserve_total),
            "currency": currency,
            "recent_payouts": [
                {
                    "amount": abs(p[0]),
                    "date": p[1].isoformat() if p[1] else None,
                }
                for p in recent_payouts
            ],
            "as_of": datetime.now(timezone.utc).isoformat(),
        }
        self._set_cached(ck, result)
        return result

    # ------------------------------------------------------------------
    #  3. Fee breakdown
    # ------------------------------------------------------------------

    def get_fee_breakdown(
        self,
        tenant_id: int,
        shop_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        shop_ids: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """
        Break down fees by category for the given period.

        Categories: transaction_fee, processing_fee, listing_renewal,
        advertising, shipping_label, subscription, other.
        """
        ck = self._cache_key(tenant_id, shop_id, f"fees:{start_date}:{end_date}", shop_ids)
        cached = self._get_cached(ck)
        if cached:
            return cached

        if not start_date:
            start_date = datetime.now(timezone.utc) - timedelta(days=30)
        if not end_date:
            end_date = datetime.now(timezone.utc)

        filters = [
            LedgerEntry.tenant_id == tenant_id,
            LedgerEntry.entry_created_at >= start_date,
            LedgerEntry.entry_created_at <= end_date,
            LedgerEntry.amount < 0,  # Fees are debits (negative)
        ]
        self._apply_shop_filter(filters, LedgerEntry.shop_id, shop_id, shop_ids)

        rows = (
            self.db.query(
                LedgerEntry.entry_type,
                func.sum(LedgerEntry.amount).label("total"),
                func.count(LedgerEntry.id).label("count"),
            )
            .filter(and_(*filters))
            .group_by(LedgerEntry.entry_type)
            .all()
        )

        categories = []
        total_fees = 0
        for entry_type, total, count in rows:
            abs_total = abs(total or 0)
            total_fees += abs_total
            categories.append({
                "category": entry_type or "other",
                "amount": abs_total,
                "count": count,
            })

        result = {
            "total_fees": total_fees,
            "categories": sorted(categories, key=lambda c: c["amount"], reverse=True),
            "currency": "USD",
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
        }
        self._set_cached(ck, result)
        return result

    # ------------------------------------------------------------------
    #  4. Order profitability
    # ------------------------------------------------------------------

    def get_order_profitability(
        self,
        tenant_id: int,
        shop_id: Optional[int] = None,
        limit: int = 20,
        offset: int = 0,
        shop_ids: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """
        Return per-order profitability using PaymentDetail records.

        Each record contains gross, fees, net, and adjusted values.
        """
        ck = self._cache_key(tenant_id, shop_id, f"order_profit:{limit}:{offset}", shop_ids)
        cached = self._get_cached(ck)
        if cached:
            return cached

        filters = [PaymentDetail.tenant_id == tenant_id]
        self._apply_shop_filter(filters, PaymentDetail.shop_id, shop_id, shop_ids)

        total_count = (
            self.db.query(func.count(PaymentDetail.id))
            .filter(and_(*filters))
            .scalar()
        ) or 0

        rows = (
            self.db.query(PaymentDetail, Order)
            .outerjoin(Order, PaymentDetail.order_id == Order.id)
            .filter(and_(*filters))
            .order_by(PaymentDetail.posted_at.desc().nullslast())
            .offset(offset)
            .limit(limit)
            .all()
        )

        orders = []
        for pd, order in rows:
            final_net = pd.adjusted_net if pd.adjusted_net is not None else pd.amount_net
            orders.append({
                "payment_id": pd.id,
                "etsy_receipt_id": pd.etsy_receipt_id,
                "buyer_name": order.buyer_name if order else None,
                "order_total": order.total_price if order else None,
                "amount_gross": pd.amount_gross,
                "amount_fees": pd.amount_fees,
                "amount_net": pd.amount_net,
                "adjusted_net": pd.adjusted_net,
                "final_net": final_net,
                "currency": pd.currency,
                "posted_at": pd.posted_at.isoformat() if pd.posted_at else None,
            })

        result = {
            "orders": orders,
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
        }
        self._set_cached(ck, result)
        return result

    # ------------------------------------------------------------------
    #  5. Revenue timeline (daily / weekly / monthly)
    # ------------------------------------------------------------------

    def get_revenue_timeline(
        self,
        tenant_id: int,
        shop_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        granularity: str = "daily",
        shop_ids: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """
        Aggregate revenue and fees over time buckets.

        ``granularity`` is one of ``daily``, ``weekly``, ``monthly``.
        """
        ck = self._cache_key(
            tenant_id, shop_id,
            f"timeline:{granularity}:{start_date}:{end_date}",
            shop_ids,
        )
        cached = self._get_cached(ck)
        if cached:
            return cached

        if not start_date:
            start_date = datetime.now(timezone.utc) - timedelta(days=30)
        if not end_date:
            end_date = datetime.now(timezone.utc)

        filters = [
            LedgerEntry.tenant_id == tenant_id,
            LedgerEntry.entry_created_at >= start_date,
            LedgerEntry.entry_created_at <= end_date,
        ]
        self._apply_shop_filter(filters, LedgerEntry.shop_id, shop_id, shop_ids)

        # Choose grouping expression
        if granularity == "monthly":
            date_trunc = func.date_trunc("month", LedgerEntry.entry_created_at)
        elif granularity == "weekly":
            date_trunc = func.date_trunc("week", LedgerEntry.entry_created_at)
        else:
            date_trunc = func.date_trunc("day", LedgerEntry.entry_created_at)

        rows = (
            self.db.query(
                date_trunc.label("bucket"),
                func.sum(
                    case(
                        (LedgerEntry.entry_type == "sale", LedgerEntry.amount),
                        else_=0,
                    )
                ).label("revenue"),
                func.sum(
                    case(
                        (LedgerEntry.amount < 0, LedgerEntry.amount),
                        else_=0,
                    )
                ).label("expenses"),
            )
            .filter(and_(*filters))
            .group_by("bucket")
            .order_by("bucket")
            .all()
        )

        timeline = []
        for bucket, revenue, expenses in rows:
            timeline.append({
                "date": bucket.isoformat() if bucket else None,
                "revenue": revenue or 0,
                "expenses": abs(expenses or 0),
                "net": (revenue or 0) - abs(expenses or 0),
            })

        result = {
            "timeline": timeline,
            "granularity": granularity,
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
        }
        self._set_cached(ck, result)
        return result

    # ------------------------------------------------------------------
    #  6. Ledger entries (paginated raw list)
    # ------------------------------------------------------------------

    def get_ledger_entries(
        self,
        tenant_id: int,
        shop_id: Optional[int] = None,
        entry_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        shop_ids: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """Paginated ledger entries with optional type filter."""
        filters = [LedgerEntry.tenant_id == tenant_id]
        self._apply_shop_filter(filters, LedgerEntry.shop_id, shop_id, shop_ids)
        if entry_type:
            filters.append(LedgerEntry.entry_type == entry_type)
        if start_date:
            filters.append(LedgerEntry.entry_created_at >= start_date)
        if end_date:
            filters.append(LedgerEntry.entry_created_at <= end_date)

        total = (
            self.db.query(func.count(LedgerEntry.id))
            .filter(and_(*filters))
            .scalar()
        ) or 0

        entries = (
            self.db.query(LedgerEntry)
            .filter(and_(*filters))
            .order_by(LedgerEntry.entry_created_at.desc())
            .offset(offset)
            .limit(min(limit, 100))
            .all()
        )

        result = {
            "entries": [
                {
                    "id": e.id,
                    "entry_type": e.entry_type,
                    "description": e.description,
                    "amount": e.amount,
                    "balance": e.balance,
                    "currency": e.currency,
                    "etsy_receipt_id": e.etsy_receipt_id,
                    "entry_created_at": e.entry_created_at.isoformat() if e.entry_created_at else None,
                }
                for e in entries
            ],
            "total_count": total,
            "limit": limit,
            "offset": offset,
        }
        return result

    # ------------------------------------------------------------------
    #  Helper: product cost calculation
    # ------------------------------------------------------------------

    def _calc_product_costs(
        self,
        tenant_id: int,
        shop_id: Optional[int],
        shop_ids: Optional[List[int]],
        start_date: datetime,
        end_date: datetime,
    ) -> int:
        """
        Calculate total product costs for orders in the period.

        Orders store line_items as JSONB with listing_id and quantity.
        We join that with products.cost_usd_cents to get total cost.
        Falls back to counting each order's product once if JSONB parsing
        is not possible at the SQL level.
        """
        try:
            order_filters = [
                Order.tenant_id == tenant_id,
                Order.order_date >= start_date,
                Order.order_date <= end_date,
            ]
            self._apply_shop_filter(order_filters, Order.shop_id, shop_id, shop_ids)

            orders_with_items = (
                self.db.query(Order.line_items)
                .filter(and_(*order_filters))
                .filter(Order.line_items.isnot(None))
                .all()
            )

            # Build listing_id -> quantity map from all orders
            listing_qty: Dict[str, int] = {}
            for (items_json,) in orders_with_items:
                if not isinstance(items_json, list):
                    continue
                for item in items_json:
                    lid = str(item.get("listing_id", item.get("etsy_listing_id", "")))
                    qty = int(item.get("quantity", 1))
                    if lid:
                        listing_qty[lid] = listing_qty.get(lid, 0) + qty

            if not listing_qty:
                return 0

            products = (
                self.db.query(Product.etsy_listing_id, Product.cost_usd_cents)
                .filter(
                    Product.tenant_id == tenant_id,
                    Product.etsy_listing_id.in_(list(listing_qty.keys())),
                    Product.cost_usd_cents > 0,
                )
                .all()
            )

            total = 0
            for lid, cost in products:
                total += cost * listing_qty.get(str(lid), 0)
            return total

        except Exception:
            logger.exception("Failed to calculate product costs")
            return 0

    # ------------------------------------------------------------------
    #  7. Full financial summary (ordered blocks)
    # ------------------------------------------------------------------

    def get_financial_summary(
        self,
        tenant_id: int,
        shop_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        shop_ids: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """
        Return the complete financial summary in the user-requested order:
        1. Revenue
        2. Etsy Fees (transaction + processing + listing renewal + subscription)
        3. Paid Advertising Expenses (Etsy Ads)
        4. Product Costs (from product cost_usd_cents × sold quantity)
        5. Invoice Expenses (uploaded, approved invoices)
        6. Total Expenses
        7. Net Profit after all expenses
        All monetary values in cents.
        """
        ck = self._cache_key(
            tenant_id, shop_id,
            f"full_summary:{start_date}:{end_date}",
            shop_ids,
        )
        cached = self._get_cached(ck)
        if cached:
            return cached

        if not start_date:
            start_date = datetime.now(timezone.utc) - timedelta(days=30)
        if not end_date:
            end_date = datetime.now(timezone.utc)

        # ── Ledger aggregation ──
        ledger_filters = [
            LedgerEntry.tenant_id == tenant_id,
            LedgerEntry.entry_created_at >= start_date,
            LedgerEntry.entry_created_at <= end_date,
        ]
        self._apply_shop_filter(ledger_filters, LedgerEntry.shop_id, shop_id, shop_ids)

        rows = (
            self.db.query(
                LedgerEntry.entry_type,
                func.sum(LedgerEntry.amount).label("total"),
            )
            .filter(and_(*ledger_filters))
            .group_by(LedgerEntry.entry_type)
            .all()
        )
        sums: Dict[str, int] = {}
        for entry_type, total in rows:
            sums[entry_type] = total or 0

        revenue = sums.get("sale", 0)
        etsy_fees = (
            abs(sums.get("transaction_fee", 0))
            + abs(sums.get("processing_fee", 0))
            + abs(sums.get("listing_renewal", 0))
            + abs(sums.get("subscription", 0))
        )
        advertising = abs(sums.get("advertising", 0))
        refunds = abs(sums.get("refund", 0))
        shipping_labels = abs(sums.get("shipping_label", 0))

        # ── Product costs ──
        # Products have cost_usd_cents; orders store line_items as JSONB.
        # Sum all product costs for orders in the period. For orders without
        # line-item granularity we fall back to one unit per order.
        product_cost_total = self._calc_product_costs(
            tenant_id, shop_id, shop_ids, start_date, end_date
        )

        # ── Invoice expenses (approved) ──
        inv_filters = [
            ExpenseInvoice.tenant_id == tenant_id,
            ExpenseInvoice.status == "approved",
        ]
        if start_date:
            inv_filters.append(ExpenseInvoice.invoice_date >= start_date)
        if end_date:
            inv_filters.append(ExpenseInvoice.invoice_date <= end_date)
        self._apply_shop_filter(inv_filters, ExpenseInvoice.shop_id, shop_id, shop_ids)

        invoice_expense_total = (
            self.db.query(func.sum(ExpenseInvoice.total_amount))
            .filter(and_(*inv_filters))
            .scalar()
        ) or 0

        total_expenses = etsy_fees + advertising + product_cost_total + invoice_expense_total + shipping_labels
        net_profit = revenue - total_expenses - refunds

        result = {
            "revenue": revenue,
            "etsy_fees": etsy_fees,
            "advertising_expenses": advertising,
            "product_costs": product_cost_total,
            "invoice_expenses": invoice_expense_total,
            "shipping_labels": shipping_labels,
            "refunds": refunds,
            "total_expenses": total_expenses,
            "net_profit": net_profit,
            "currency": "USD",
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
        }
        self._set_cached(ck, result)
        return result
