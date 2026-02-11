"""
Analytics Service
Provides cached, server-side aggregations for owner/admin dashboards
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, case
import json

from app.models.listings import Order, ShipmentEvent, Product, ListingJob
from app.core.redis import get_redis_client


class AnalyticsService:
    """
    Analytics service with 5-minute caching and real-time refresh capability
    All metrics computed from authoritative order/shipment data
    """
    
    CACHE_TTL = 300  # 5 minutes
    
    def __init__(self, db: Session):
        self.db = db
        self.redis = get_redis_client()
    
    def _cache_key(self, tenant_id: int, shop_id: Optional[int], metric: str) -> str:
        """Generate Redis cache key for a metric"""
        shop_suffix = f":shop_{shop_id}" if shop_id else ""
        return f"analytics:tenant_{tenant_id}{shop_suffix}:{metric}"
    
    def _get_cached(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached analytics data"""
        if not self.redis:
            return None
        try:
            cached = self.redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass
        return None
    
    def _set_cached(self, cache_key: str, data: Dict[str, Any]) -> None:
        """Cache analytics data"""
        if not self.redis:
            return
        try:
            self.redis.setex(cache_key, self.CACHE_TTL, json.dumps(data))
        except Exception:
            pass
    
    def _invalidate_cache(self, tenant_id: int, shop_id: Optional[int] = None) -> None:
        """Invalidate all analytics caches for a tenant/shop"""
        if not self.redis:
            return
        try:
            pattern = self._cache_key(tenant_id, shop_id, "*")
            keys = self.redis.keys(pattern)
            if keys:
                self.redis.delete(*keys)
        except Exception:
            pass
    
    def get_overview_analytics(
        self,
        tenant_id: int,
        shop_id: Optional[int] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Get overview analytics: sales, orders, revenue trends
        Cached for 5 minutes unless force_refresh=True
        """
        cache_key = self._cache_key(tenant_id, shop_id, "overview")
        
        if not force_refresh:
            cached = self._get_cached(cache_key)
            if cached:
                return cached
        
        # Compute fresh analytics
        now = datetime.now(timezone.utc)
        last_7_days = now - timedelta(days=7)
        last_30_days = now - timedelta(days=30)
        prev_7_days = last_7_days - timedelta(days=7)
        prev_30_days = last_30_days - timedelta(days=30)
        
        # Base query
        base_query = self.db.query(Order).filter(Order.tenant_id == tenant_id)
        if shop_id:
            base_query = base_query.filter(Order.shop_id == shop_id)
        
        # Total orders
        total_orders = base_query.count()
        
        # Last 7/30 days orders
        orders_7d = base_query.filter(Order.created_at >= last_7_days).count()
        orders_30d = base_query.filter(Order.created_at >= last_30_days).count()
        
        # Previous period for trends
        prev_orders_7d = base_query.filter(
            Order.created_at >= prev_7_days,
            Order.created_at < last_7_days
        ).count()
        prev_orders_30d = base_query.filter(
            Order.created_at >= prev_30_days,
            Order.created_at < last_30_days
        ).count()
        
        # Revenue (in cents, convert to dollars)
        total_revenue_cents = self.db.query(func.sum(Order.total_price)).filter(
            Order.tenant_id == tenant_id,
            Order.shop_id == shop_id if shop_id else True,
        ).scalar() or 0
        total_revenue = float(total_revenue_cents) / 100
        
        revenue_7d_cents = self.db.query(func.sum(Order.total_price)).filter(
            Order.tenant_id == tenant_id,
            Order.shop_id == shop_id if shop_id else True,
            Order.created_at >= last_7_days
        ).scalar() or 0
        revenue_7d = float(revenue_7d_cents) / 100
        
        revenue_30d_cents = self.db.query(func.sum(Order.total_price)).filter(
            Order.tenant_id == tenant_id,
            Order.shop_id == shop_id if shop_id else True,
            Order.created_at >= last_30_days
        ).scalar() or 0
        revenue_30d = float(revenue_30d_cents) / 100
        
        prev_revenue_7d_cents = self.db.query(func.sum(Order.total_price)).filter(
            Order.tenant_id == tenant_id,
            Order.shop_id == shop_id if shop_id else True,
            Order.created_at >= prev_7_days,
            Order.created_at < last_7_days
        ).scalar() or 0
        prev_revenue_7d = float(prev_revenue_7d_cents) / 100
        
        prev_revenue_30d_cents = self.db.query(func.sum(Order.total_price)).filter(
            Order.tenant_id == tenant_id,
            Order.shop_id == shop_id if shop_id else True,
            Order.created_at >= prev_30_days,
            Order.created_at < last_30_days
        ).scalar() or 0
        prev_revenue_30d = float(prev_revenue_30d_cents) / 100
        
        # Calculate trends
        orders_7d_trend = self._calculate_trend(orders_7d, prev_orders_7d)
        orders_30d_trend = self._calculate_trend(orders_30d, prev_orders_30d)
        revenue_7d_trend = self._calculate_trend(revenue_7d, prev_revenue_7d)
        revenue_30d_trend = self._calculate_trend(revenue_30d, prev_revenue_30d)
        
        # Average order value
        avg_order_value = total_revenue / total_orders if total_orders > 0 else 0
        
        result = {
            "total_orders": total_orders,
            "total_revenue": round(total_revenue, 2),
            "avg_order_value": round(avg_order_value, 2),
            "orders_7d": orders_7d,
            "orders_30d": orders_30d,
            "revenue_7d": round(revenue_7d, 2),
            "revenue_30d": round(revenue_30d, 2),
            "orders_7d_trend": round(orders_7d_trend, 2),
            "orders_30d_trend": round(orders_30d_trend, 2),
            "revenue_7d_trend": round(revenue_7d_trend, 2),
            "revenue_30d_trend": round(revenue_30d_trend, 2),
            "computed_at": now.isoformat(),
        }
        
        self._set_cached(cache_key, result)
        return result
    
    def get_order_analytics(
        self,
        tenant_id: int,
        shop_id: Optional[int] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Get order analytics: status breakdown, volume trends
        """
        cache_key = self._cache_key(tenant_id, shop_id, "orders")
        
        if not force_refresh:
            cached = self._get_cached(cache_key)
            if cached:
                return cached
        
        # Base query
        base_query = self.db.query(Order).filter(Order.tenant_id == tenant_id)
        if shop_id:
            base_query = base_query.filter(Order.shop_id == shop_id)
        
        # Order status breakdown
        status_counts = {}
        for status in ["processing", "in_transit", "completed", "cancelled", "refunded"]:
            if status == "processing":
                count = base_query.filter(
                    or_(
                        Order.lifecycle_status == "processing",
                        and_(
                            Order.lifecycle_status.is_(None),
                            or_(
                                Order.etsy_status.is_(None),
                                ~Order.etsy_status.in_(["completed", "canceled", "cancelled", "refunded", "fully refunded"])
                            ),
                            or_(Order.fulfillment_status.is_(None), Order.fulfillment_status == "unshipped")
                        )
                    )
                ).count()
            elif status == "in_transit":
                count = base_query.filter(
                    or_(
                        Order.lifecycle_status == "in_transit",
                        and_(Order.lifecycle_status.is_(None), Order.fulfillment_status == "shipped")
                    )
                ).count()
            elif status == "completed":
                count = base_query.filter(
                    or_(
                        Order.lifecycle_status == "completed",
                        and_(
                            Order.lifecycle_status.is_(None),
                            or_(Order.fulfillment_status == "delivered", Order.etsy_status == "completed")
                        )
                    )
                ).count()
            elif status == "cancelled":
                count = base_query.filter(
                    or_(
                        Order.lifecycle_status == "cancelled",
                        and_(Order.lifecycle_status.is_(None), Order.etsy_status.in_(["canceled", "cancelled"]))
                    )
                ).count()
            elif status == "refunded":
                count = base_query.filter(
                    or_(
                        Order.lifecycle_status == "refunded",
                        and_(Order.lifecycle_status.is_(None), Order.etsy_status.in_(["refunded", "fully refunded"]))
                    )
                ).count()
            else:
                count = 0
            status_counts[status] = count
        
        # Payment status
        paid_count = base_query.filter(
            or_(
                Order.payment_status == "paid",
                and_(Order.payment_status.is_(None), Order.etsy_status.in_(["paid", "completed"]))
            )
        ).count()
        
        unpaid_count = base_query.filter(
            or_(
                Order.payment_status == "unpaid",
                and_(
                    Order.payment_status.is_(None),
                    or_(Order.etsy_status.is_(None), ~Order.etsy_status.in_(["paid", "completed"]))
                )
            )
        ).count()
        
        result = {
            "status_breakdown": status_counts,
            "payment_breakdown": {
                "paid": paid_count,
                "unpaid": unpaid_count,
            },
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }
        
        self._set_cached(cache_key, result)
        return result
    
    def get_product_analytics(
        self,
        tenant_id: int,
        shop_id: Optional[int] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Get product analytics: listing performance, publish stats
        """
        cache_key = self._cache_key(tenant_id, shop_id, "products")
        
        if not force_refresh:
            cached = self._get_cached(cache_key)
            if cached:
                return cached
        
        # Product counts
        product_query = self.db.query(Product).filter(Product.tenant_id == tenant_id)
        if shop_id:
            product_query = product_query.filter(Product.shop_id == shop_id)
        
        total_products = product_query.count()
        published_products = product_query.filter(Product.etsy_listing_id.isnot(None)).count()
        draft_products = product_query.filter(Product.etsy_listing_id.is_(None)).count()
        
        # Listing job stats
        job_query = self.db.query(ListingJob).filter(ListingJob.tenant_id == tenant_id)
        if shop_id:
            job_query = job_query.filter(ListingJob.shop_id == shop_id)
        
        total_jobs = job_query.count()
        successful_jobs = job_query.filter(ListingJob.status == "completed").count()
        failed_jobs = job_query.filter(ListingJob.status == "failed").count()
        pending_jobs = job_query.filter(ListingJob.status.in_(["pending", "processing"])).count()
        
        result = {
            "total_products": total_products,
            "published_products": published_products,
            "draft_products": draft_products,
            "listing_jobs": {
                "total": total_jobs,
                "successful": successful_jobs,
                "failed": failed_jobs,
                "pending": pending_jobs,
            },
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }
        
        self._set_cached(cache_key, result)
        return result
    
    def get_fulfillment_analytics(
        self,
        tenant_id: int,
        shop_id: Optional[int] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Get fulfillment analytics: shipment timing, delivery rates, supplier performance
        """
        cache_key = self._cache_key(tenant_id, shop_id, "fulfillment")
        
        if not force_refresh:
            cached = self._get_cached(cache_key)
            if cached:
                return cached
        
        # Shipment events
        event_query = self.db.query(ShipmentEvent).filter(ShipmentEvent.tenant_id == tenant_id)
        if shop_id:
            event_query = event_query.filter(ShipmentEvent.shop_id == shop_id)
        
        # State counts
        state_counts = {}
        for state in ["processing", "shipped", "in_transit", "delivered", "delayed", "cancelled"]:
            count = event_query.filter(ShipmentEvent.state == state).count()
            state_counts[state] = count
        
        # Source breakdown
        manual_count = event_query.filter(ShipmentEvent.source == "manual").count()
        etsy_sync_count = event_query.filter(ShipmentEvent.source == "etsy_sync").count()
        auto_count = event_query.filter(ShipmentEvent.source == "auto").count()
        
        # Average fulfillment time (order created to shipped)
        avg_fulfillment_query = self.db.query(
            func.avg(
                func.extract('epoch', ShipmentEvent.shipped_at - Order.created_at)
            )
        ).join(Order, ShipmentEvent.order_id == Order.id).filter(
            ShipmentEvent.tenant_id == tenant_id,
            ShipmentEvent.shop_id == shop_id if shop_id else True,
            ShipmentEvent.state == "shipped",
            ShipmentEvent.shipped_at.isnot(None)
        )
        
        avg_fulfillment_seconds = avg_fulfillment_query.scalar() or 0
        avg_fulfillment_hours = avg_fulfillment_seconds / 3600 if avg_fulfillment_seconds else 0
        
        # Supplier performance (owner-only metric)
        supplier_stats = {}
        supplier_query = self.db.query(
            Order.supplier_user_id,
            func.count(ShipmentEvent.id).label('shipment_count'),
        ).join(ShipmentEvent, Order.id == ShipmentEvent.order_id).filter(
            Order.tenant_id == tenant_id,
            Order.shop_id == shop_id if shop_id else True,
            Order.supplier_user_id.isnot(None)
        ).group_by(Order.supplier_user_id).all()
        
        for supplier_id, shipment_count in supplier_query:
            supplier_stats[str(supplier_id)] = {
                "shipment_count": shipment_count,
            }
        
        result = {
            "state_breakdown": state_counts,
            "source_breakdown": {
                "manual": manual_count,
                "etsy_sync": etsy_sync_count,
                "auto": auto_count,
            },
            "avg_fulfillment_time_hours": round(avg_fulfillment_hours, 2),
            "supplier_performance": supplier_stats,
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }
        
        self._set_cached(cache_key, result)
        return result
    
    def _calculate_trend(self, current: float, previous: float) -> float:
        """Calculate percentage change between two values"""
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return ((current - previous) / previous) * 100
    
    def invalidate_all(self, tenant_id: int, shop_id: Optional[int] = None) -> None:
        """Force invalidation of all analytics caches"""
        self._invalidate_cache(tenant_id, shop_id)
