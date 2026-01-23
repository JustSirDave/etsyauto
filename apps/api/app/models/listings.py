"""
SQLAlchemy Models - Products, AI Generations, Listing Jobs, Orders
"""
from datetime import datetime
from sqlalchemy import (
    Column, BigInteger, String, Text, Integer, DateTime,
    Boolean, ForeignKey, CheckConstraint, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB

from app.core.database import Base


class Product(Base):
    """Products to be listed on Etsy"""
    __tablename__ = "products"
    
    id = Column(BigInteger, primary_key=True, index=True)
    tenant_id = Column(BigInteger, ForeignKey('tenants.id'), nullable=False)
    shop_id = Column(BigInteger, ForeignKey('shops.id'), nullable=True, index=True)
    etsy_listing_id = Column(String(50), nullable=True, index=True)
    
    # Raw product data
    sku = Column(String(255), nullable=True, index=True)  # Product SKU
    title_raw = Column(Text)
    description_raw = Column(Text)
    tags_raw = Column(JSONB)
    images = Column(JSONB)
    variants = Column(JSONB)
    
    # Supplier info
    supplier_name = Column(String(255))
    supplier_product_id = Column(String(255))
    price = Column(Integer)
    compare_at_price = Column(Integer)
    quantity = Column(Integer, nullable=True)  # Available quantity
    
    # Etsy-specific fields
    taxonomy_id = Column(Integer, nullable=True)  # Etsy category/taxonomy ID
    materials = Column(JSONB, nullable=True)  # List of materials used
    who_made = Column(String(50), default='i_did')  # i_did, someone_else, collective
    when_made = Column(String(50), default='made_to_order')  # made_to_order, 2020_2024, etc.
    is_supply = Column(Boolean, default=False)  # Is it a craft supply?
    is_customizable = Column(Boolean, default=False)
    is_personalizable = Column(Boolean, default=False)
    personalization_instructions = Column(Text, nullable=True)
    
    # Dimensions and weight
    item_weight = Column(Integer, nullable=True)  # Weight value
    item_weight_unit = Column(String(10), default='oz')  # oz, lb, g, kg
    item_length = Column(Integer, nullable=True)
    item_width = Column(Integer, nullable=True)
    item_height = Column(Integer, nullable=True)
    item_dimensions_unit = Column(String(10), default='in')  # in, ft, mm, cm, m
    
    # Processing time
    processing_min = Column(Integer, default=1)  # Days
    processing_max = Column(Integer, default=3)  # Days
    
    # Import tracking
    source = Column(String(50), CheckConstraint("source IN ('csv','json','api','manual','etsy')"), default='manual')
    ingest_batch_id = Column(String(255))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class AIGeneration(Base):
    """AI-generated content for products"""
    __tablename__ = "ai_generations"
    
    id = Column(BigInteger, primary_key=True, index=True)
    tenant_id = Column(BigInteger, ForeignKey('tenants.id'), nullable=False)
    product_id = Column(BigInteger, ForeignKey('products.id'), nullable=False)
    
    model = Column(String(100))
    prompt_hash = Column(String(64))
    
    title = Column(Text)
    description = Column(Text)
    tags = Column(JSONB)
    
    # Policy compliance
    policy_status = Column(String(20), CheckConstraint("policy_status IN ('passed','failed','needs_review','warning')"), default='passed')
    policy_flags = Column(JSONB)
    policy_checked_at = Column(DateTime(timezone=True))
    can_publish = Column(Integer, default=0)  # 0=blocked, 1=can publish
    
    # Review workflow
    reviewed_by = Column(BigInteger, ForeignKey('users.id'), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_decision = Column(String(20), CheckConstraint("review_decision IN ('accepted','rejected','modified')"), nullable=True)
    
    # Provider info
    provider = Column(String(20), default='openai')
    tokens_used = Column(Integer, nullable=True)
    generation_time_ms = Column(Integer, nullable=True)
    
    # Legacy fields (kept for backwards compatibility)
    status = Column(String(20), CheckConstraint("status IN ('ok','flagged')"), default='ok')
    cost_tokens = Column(Integer, default=0)
    cost_usd_cents = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class ListingJob(Base):
    """Jobs for publishing listings to Etsy"""
    __tablename__ = "listing_jobs"
    
    id = Column(BigInteger, primary_key=True, index=True)
    tenant_id = Column(BigInteger, ForeignKey('tenants.id'), nullable=False)
    shop_id = Column(BigInteger, ForeignKey('shops.id'), nullable=False)
    product_id = Column(BigInteger, ForeignKey('products.id'), nullable=False)
    ai_generation_id = Column(BigInteger, ForeignKey('ai_generations.id'))
    
    idempotency_key = Column(String(255), unique=True)
    
    # Policy compliance (pre-publish enforcement)
    policy_status = Column(String(20), CheckConstraint("policy_status IN ('passed','failed','warning','pending')"), default='pending')
    policy_flags = Column(JSONB)
    policy_checked_at = Column(DateTime(timezone=True))
    policy_block_reason = Column(Text, nullable=True)  # Reason if blocked
    
    # Status tracking
    status = Column(
        String(20), 
        CheckConstraint("status IN ('pending','scheduled','processing','completed','failed','cancelled','policy_blocked')"),
        default='pending'
    )
    
    # Error tracking
    error_code = Column(String(100))
    error_message = Column(Text)
    error_detail = Column(JSONB)
    
    # Retry tracking
    retry_count = Column(Integer, default=0)
    
    # Timestamps
    scheduled_for = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Etsy info
    etsy_listing_id = Column(String(50))
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class Schedule(Base):
    """Automated task schedules with quota management"""
    __tablename__ = "schedules"

    id = Column(BigInteger, primary_key=True, index=True)
    tenant_id = Column(BigInteger, ForeignKey('tenants.id'), nullable=False, index=True)
    shop_id = Column(BigInteger, ForeignKey('shops.id'), nullable=True, index=True)  # Optional for non-shop tasks

    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String(50), nullable=False)  # sync, generate, backup, report, publish
    cron_expr = Column(String(100), nullable=False)
    
    # Quota configuration
    daily_quota = Column(Integer, default=150)  # Max listings/actions per day
    weekly_quota = Column(Integer, nullable=True)  # Optional weekly limit
    
    # Quota tracking (resets daily/weekly)
    daily_used = Column(Integer, default=0)
    weekly_used = Column(Integer, default=0)
    last_daily_reset = Column(DateTime(timezone=True), default=datetime.utcnow)
    last_weekly_reset = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Status and execution
    status = Column(
        String(20), 
        CheckConstraint("status IN ('active','paused','error','quota_exceeded')"),
        default='active',
        index=True
    )
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    next_run_at = Column(DateTime(timezone=True), nullable=True, index=True)
    last_error = Column(Text, nullable=True)
    execution_count = Column(Integer, default=0)
    
    # Statistics
    total_success = Column(Integer, default=0)
    total_failed = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_schedules_next_run_enabled', 'next_run_at', 'status'),
        Index('idx_schedules_shop_status', 'shop_id', 'status'),
    )


class Order(Base):
    """Orders from Etsy"""
    __tablename__ = "orders"
    
    id = Column(BigInteger, primary_key=True, index=True)
    tenant_id = Column(BigInteger, ForeignKey('tenants.id'), nullable=False)
    shop_id = Column(BigInteger, ForeignKey('shops.id'), nullable=False)
    
    etsy_receipt_id = Column(String(50), unique=True, nullable=False, index=True)
    
    # Order status
    status = Column(
        String(30),
        CheckConstraint("status IN ('pending','processing','shipped','delivered','cancelled','refunded')"),
        default='pending'
    )
    etsy_status = Column(String(50), nullable=True)  # Original Etsy status
    
    # Buyer information
    buyer_user_id = Column(String(50), nullable=True)  # Etsy buyer user ID
    buyer_email = Column(String(255), nullable=True)
    buyer_name = Column(String(255), nullable=True)
    
    # Shipping address
    shipping_name = Column(String(255), nullable=True)
    shipping_first_line = Column(String(500), nullable=True)
    shipping_second_line = Column(String(500), nullable=True)
    shipping_city = Column(String(255), nullable=True)
    shipping_state = Column(String(255), nullable=True)
    shipping_zip = Column(String(50), nullable=True)
    shipping_country = Column(String(100), nullable=True)
    shipping_country_iso = Column(String(2), nullable=True)
    
    # Order financials (all in cents)
    subtotal = Column(Integer, nullable=True)  # Subtotal before tax/shipping
    total_price = Column(Integer, nullable=True)  # Grand total
    total_shipping_cost = Column(Integer, nullable=True)
    total_tax_cost = Column(Integer, nullable=True)
    discount_amt = Column(Integer, default=0)  # Total discount amount
    gift_wrap_price = Column(Integer, default=0)
    currency = Column(String(3), default='USD')
    
    # Transaction fees (if available)
    transaction_fee = Column(Integer, nullable=True)
    listing_fee = Column(Integer, nullable=True)
    
    # Line items (stored as JSONB array)
    line_items = Column(JSONB, nullable=True)  # Array of order items
    
    # Shipping/tracking (supports multiple shipments)
    shipments = Column(JSONB, nullable=True)  # Array of shipment objects
    
    # Supplier fulfillment (for future use)
    supplier_order_id = Column(String(255), nullable=True)
    supplier_status = Column(String(50), nullable=True)
    
    # Message to seller
    message_from_buyer = Column(Text, nullable=True)
    
    # Gift options
    is_gift = Column(Boolean, default=False)
    gift_message = Column(Text, nullable=True)
    
    # Timestamps
    etsy_created_at = Column(DateTime(timezone=True), nullable=True)  # Order creation on Etsy
    etsy_updated_at = Column(DateTime(timezone=True), nullable=True)  # Last update on Etsy
    synced_at = Column(DateTime(timezone=True), nullable=True)  # Last sync from Etsy
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_orders_status_shop', 'shop_id', 'status'),
        Index('idx_orders_etsy_status', 'etsy_status'),
        Index('idx_orders_synced_at', 'synced_at'),
    )


class UsageCost(Base):
    """Daily usage and cost tracking"""
    __tablename__ = "usage_costs"
    
    id = Column(BigInteger, primary_key=True, index=True)
    tenant_id = Column(BigInteger, ForeignKey('tenants.id'), nullable=False)
    date = Column(DateTime(timezone=True), nullable=False)
    
    ai_tokens = Column(Integer, default=0)
    ai_cost_usd_cents = Column(Integer, default=0)
    api_calls = Column(JSONB)
    storage_bytes = Column(BigInteger, default=0)
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'date', name='uq_tenant_date'),
    )


class AuditLog(Base):
    """
    Audit log for tracking all significant actions in the system
    Retention: 30 days (TTL enforced by cleanup job)
    """
    __tablename__ = "audit_logs"
    
    # Primary key
    id = Column(BigInteger, primary_key=True, index=True)
    
    # Request identification
    request_id = Column(String(36), nullable=False, index=True)  # UUID for request correlation
    
    # Actor information
    actor_user_id = Column(BigInteger, ForeignKey('users.id'), nullable=True, index=True)
    actor_email = Column(String(255), nullable=True)
    actor_ip = Column(String(45), nullable=True)  # IPv6 max length
    
    # Tenant/Shop scoping (for multi-tenancy)
    tenant_id = Column(BigInteger, ForeignKey('tenants.id'), nullable=True, index=True)
    shop_id = Column(BigInteger, ForeignKey('shops.id'), nullable=True, index=True)
    
    # Action details
    action = Column(String(100), nullable=False, index=True)  # e.g., 'auth.login', 'product.create'
    target_type = Column(String(50), nullable=True)  # e.g., 'product', 'listing', 'user'
    target_id = Column(String(100), nullable=True)  # ID of the target resource
    
    # HTTP request details
    http_method = Column(String(10), nullable=True)  # GET, POST, PUT, DELETE, etc.
    http_path = Column(String(500), nullable=True)  # /api/products/123
    http_status = Column(Integer, nullable=True)  # 200, 404, 500, etc.
    
    # Operation status
    status = Column(String(20), nullable=False, index=True)  # success, failure, pending, error
    error_message = Column(Text, nullable=True)  # Error details if status=failure/error
    
    # Metadata (no secrets!)
    request_metadata = Column(JSONB, nullable=True)  # Request params/body (sanitized)
    response_metadata = Column(JSONB, nullable=True)  # Response summary (sanitized)
    
    # Performance tracking
    attempt = Column(Integer, default=1)  # Retry attempt number
    latency_ms = Column(Integer, nullable=True)  # Request duration in milliseconds
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True)
    
    # Indexes for common queries
    __table_args__ = (
        Index('idx_audit_tenant_created', 'tenant_id', 'created_at'),
        Index('idx_audit_actor_created', 'actor_user_id', 'created_at'),
        Index('idx_audit_action_created', 'action', 'created_at'),
        Index('idx_audit_status_created', 'status', 'created_at'),
    )
    
    def __repr__(self):
        return f"<AuditLog(id={self.id}, action={self.action}, actor={self.actor_email}, status={self.status})>"
    
    @classmethod
    def sanitize_metadata(cls, data: dict) -> dict:
        """
        Remove sensitive fields from metadata before logging
        """
        if not data:
            return {}
        
        sensitive_keys = [
            'password', 'secret', 'token', 'api_key', 'access_token', 
            'refresh_token', 'authorization', 'cookie', 'session',
            'credit_card', 'ssn', 'cvv', 'pin'
        ]
        
        sanitized = {}
        for key, value in data.items():
            key_lower = key.lower()
            
            # Skip sensitive keys
            if any(sensitive in key_lower for sensitive in sensitive_keys):
                sanitized[key] = "[REDACTED]"
            # Recursively sanitize nested dicts
            elif isinstance(value, dict):
                sanitized[key] = cls.sanitize_metadata(value)
            # Truncate large strings
            elif isinstance(value, str) and len(value) > 1000:
                sanitized[key] = value[:1000] + "... [TRUNCATED]"
            else:
                sanitized[key] = value
        
        return sanitized


class WebhookEvent(Base):
    """Webhook events from external services"""
    __tablename__ = "webhook_events"
    
    id = Column(BigInteger, primary_key=True, index=True)
    provider = Column(String(50))
    external_id = Column(String(255), unique=True)
    
    payload = Column(JSONB)
    received_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    processed_at = Column(DateTime(timezone=True))
    status = Column(
        String(20),
        CheckConstraint("status IN ('pending','processed','skipped')"),
        default='pending'
    )