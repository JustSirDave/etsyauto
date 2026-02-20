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
    tenant_id = Column(BigInteger, ForeignKey('tenants.id', ondelete="CASCADE"), nullable=False)
    shop_id = Column(BigInteger, ForeignKey('shops.id', ondelete="SET NULL"), nullable=True, index=True)
    etsy_listing_id = Column(String(50), nullable=True, index=True)
    
    # Raw product data
    sku = Column(String(255), nullable=True, index=True)  # Product SKU
    title_raw = Column(Text)
    description_raw = Column(Text)
    tags_raw = Column(JSONB)
    images = Column(JSONB)
    variants = Column(JSONB)
    
    price = Column(Integer)
    compare_at_price = Column(Integer)
    cost_usd_cents = Column(Integer, default=0)  # Supplier/wholesale unit cost (USD cents) for COGS
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
    tenant_id = Column(BigInteger, ForeignKey('tenants.id', ondelete="CASCADE"), nullable=False)
    product_id = Column(BigInteger, ForeignKey('products.id', ondelete="CASCADE"), nullable=False)
    
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
    reviewed_by = Column(BigInteger, ForeignKey('users.id', ondelete="SET NULL"), nullable=True)
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
    tenant_id = Column(BigInteger, ForeignKey('tenants.id', ondelete="CASCADE"), nullable=False)
    shop_id = Column(BigInteger, ForeignKey('shops.id', ondelete="CASCADE"), nullable=False)
    product_id = Column(BigInteger, ForeignKey('products.id', ondelete="CASCADE"), nullable=False)
    ai_generation_id = Column(BigInteger, ForeignKey('ai_generations.id', ondelete="SET NULL"), nullable=True)
    
    idempotency_key = Column(String(255), unique=True)
    
    # Policy compliance (pre-publish enforcement)
    policy_status = Column(String(20), CheckConstraint("policy_status IN ('passed','failed','warning','pending')"), default='pending')
    policy_flags = Column(JSONB)
    policy_checked_at = Column(DateTime(timezone=True))
    policy_block_reason = Column(Text, nullable=True)  # Reason if blocked
    
    # Status tracking
    status = Column(
        String(20), 
        CheckConstraint("status IN ('pending','scheduled','processing','verifying','completed','failed','cancelled','policy_blocked')"),
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
    tenant_id = Column(BigInteger, ForeignKey('tenants.id', ondelete="CASCADE"), nullable=False, index=True)
    shop_id = Column(BigInteger, ForeignKey('shops.id', ondelete="SET NULL"), nullable=True, index=True)  # Optional for non-shop tasks

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
    tenant_id = Column(BigInteger, ForeignKey('tenants.id', ondelete="CASCADE"), nullable=False)
    shop_id = Column(BigInteger, ForeignKey('shops.id', ondelete="CASCADE"), nullable=False)
    
    etsy_receipt_id = Column(String(50), unique=True, nullable=False, index=True)
    
    # Order status
    status = Column(
        String(30),
        CheckConstraint("status IN ('pending','processing','shipped','delivered','cancelled','refunded')"),
        default='pending'
    )
    etsy_status = Column(String(50), nullable=True)  # Original Etsy status
    lifecycle_status = Column(
        String(30),
        CheckConstraint("lifecycle_status IN ('processing','in_transit','completed','cancelled','refunded')"),
        nullable=True
    )
    payment_status = Column(
        String(20),
        CheckConstraint("payment_status IN ('paid','unpaid')"),
        nullable=True
    )
    fulfillment_status = Column(
        String(20),
        CheckConstraint("fulfillment_status IN ('unshipped','shipped','delivered')"),
        nullable=True
    )
    
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
    
    # Supplier assignment (manual tracking)
    supplier_user_id = Column(BigInteger, ForeignKey('users.id', ondelete="SET NULL"), nullable=True, index=True)
    supplier_assigned_at = Column(DateTime(timezone=True), nullable=True)
    
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
        Index('idx_orders_lifecycle_status', 'lifecycle_status'),
        Index('idx_orders_payment_status', 'payment_status'),
        Index('idx_orders_fulfillment_status', 'fulfillment_status'),
        Index('idx_orders_synced_at', 'synced_at'),
        Index('idx_orders_supplier_user', 'supplier_user_id'),
    )



class UsageCost(Base):
    """Daily usage and cost tracking"""
    __tablename__ = "usage_costs"
    
    id = Column(BigInteger, primary_key=True, index=True)
    tenant_id = Column(BigInteger, ForeignKey('tenants.id', ondelete="CASCADE"), nullable=False)
    date = Column(DateTime(timezone=True), nullable=False)
    
    ai_tokens = Column(Integer, default=0)
    ai_cost_usd_cents = Column(Integer, default=0)
    api_calls = Column(JSONB)
    storage_bytes = Column(BigInteger, default=0)
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'date', name='uq_tenant_date'),
    )


class ShipmentEvent(Base):
    """
    Shipment event history for analytics and tracking lineage
    Records all shipment state transitions with full context
    """
    __tablename__ = "shipment_events"
    
    id = Column(BigInteger, primary_key=True, index=True)
    order_id = Column(BigInteger, ForeignKey('orders.id', ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(BigInteger, ForeignKey('tenants.id', ondelete="CASCADE"), nullable=False, index=True)
    shop_id = Column(BigInteger, ForeignKey('shops.id', ondelete="CASCADE"), nullable=False)
    
    # Canonical shipment state
    state = Column(
        String(20),
        CheckConstraint("state IN ('processing','shipped','in_transit','delivered','delayed','cancelled')"),
        nullable=False,
        index=True
    )
    previous_state = Column(String(20), nullable=True)  # For state transition tracking
    
    # Tracking details
    tracking_code = Column(String(255), nullable=True, index=True)
    carrier_name = Column(String(100), nullable=True)
    tracking_url = Column(String(500), nullable=True)
    
    # Event context
    source = Column(
        String(20),
        CheckConstraint("source IN ('manual','etsy_sync','auto')"),
        nullable=False,
        index=True
    )
    actor_user_id = Column(BigInteger, ForeignKey('users.id', ondelete="SET NULL"), nullable=True, index=True)
    actor_role = Column(String(20), nullable=True)
    
    # Timestamps
    event_timestamp = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)
    shipped_at = Column(DateTime(timezone=True), nullable=True)  # When shipment started
    delivered_at = Column(DateTime(timezone=True), nullable=True)  # When delivered
    
    # Additional metadata
    notes = Column(Text, nullable=True)
    event_metadata = Column(JSONB, nullable=True)  # Extra event data
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        Index('idx_shipment_events_order_state', 'order_id', 'state'),
        Index('idx_shipment_events_tenant_timestamp', 'tenant_id', 'event_timestamp'),
        Index('idx_shipment_events_state_timestamp', 'state', 'event_timestamp'),
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
    actor_user_id = Column(BigInteger, ForeignKey('users.id', ondelete="SET NULL"), nullable=True, index=True)
    actor_email = Column(String(255), nullable=True)
    actor_ip = Column(String(45), nullable=True)  # IPv6 max length
    
    # Tenant/Shop scoping (for multi-tenancy)
    tenant_id = Column(BigInteger, ForeignKey('tenants.id', ondelete="SET NULL"), nullable=True, index=True)
    shop_id = Column(BigInteger, ForeignKey('shops.id', ondelete="SET NULL"), nullable=True, index=True)
    
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


class LedgerEntryTypeRegistry(Base):
    """Discovery engine for ledger entry types. Manual mapping of entry_type -> category."""
    __tablename__ = "ledger_entry_type_registry"

    entry_type = Column(Text, primary_key=True)
    category = Column(Text, nullable=True)  # sales, fees, marketing, refunds, adjustments, other
    first_seen_at = Column(DateTime(timezone=True), nullable=True)
    last_seen_at = Column(DateTime(timezone=True), nullable=True)
    mapped = Column(Boolean, default=False, nullable=False)


class LedgerEntry(Base):
    """Etsy Shop Ledger entries — raw storage, category from registry join"""
    __tablename__ = "ledger_entries"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id = Column(BigInteger, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    shop_id = Column(BigInteger, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False)

    etsy_entry_id = Column(BigInteger, unique=True, nullable=False, index=True)
    etsy_ledger_id = Column(BigInteger, nullable=False)

    # Raw Etsy value (ledger_type or description); category comes from registry join
    entry_type = Column(String(255), nullable=True, index=True)
    category = Column(Text, nullable=True)  # Denormalized from registry; nullable at insert
    description = Column(Text, nullable=True)

    # All monetary values in cents (positive = credit, negative = debit)
    amount = Column(Integer, nullable=False)
    balance = Column(Integer, nullable=False)  # Running balance after this entry
    currency = Column(String(3), default="USD")

    # Link to order if this entry relates to a receipt
    etsy_receipt_id = Column(String(50), nullable=True, index=True)

    entry_created_at = Column(DateTime(timezone=True), nullable=False)
    created_timestamp = Column(BigInteger, nullable=True)  # Unix epoch for date-range queries
    raw_payload = Column(JSONB, nullable=True)  # Full Etsy API response
    synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        Index("idx_ledger_tenant_shop_date", "tenant_id", "shop_id", "entry_created_at"),
    )


class PaymentDetail(Base):
    """Etsy Payment breakdown per order — finalized after shipping"""
    __tablename__ = "payment_details"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id = Column(BigInteger, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    shop_id = Column(BigInteger, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False)
    order_id = Column(BigInteger, ForeignKey("orders.id", ondelete="CASCADE"), nullable=True)

    etsy_payment_id = Column(BigInteger, unique=True, nullable=False, index=True)
    etsy_receipt_id = Column(String(50), nullable=False, index=True)

    # All values in cents
    amount_gross = Column(Integer, nullable=False)      # Total buyer paid
    amount_fees = Column(Integer, nullable=False)       # Processing fees
    amount_net = Column(Integer, nullable=False)        # gross - fees
    posted_gross = Column(Integer, nullable=True)       # Value posted to ledger upon shipping
    adjusted_gross = Column(Integer, nullable=True)     # After refunds
    adjusted_fees = Column(Integer, nullable=True)      # Fees after refund adjustments
    adjusted_net = Column(Integer, nullable=True)       # Final net after all adjustments
    currency = Column(String(3), default="USD")

    posted_at = Column(DateTime(timezone=True), nullable=True)
    synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        Index("idx_payment_tenant_shop", "tenant_id", "shop_id"),
    )


class ExpenseInvoice(Base):
    """Uploaded expense invoices for product cost tracking"""
    __tablename__ = "expense_invoices"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    tenant_id = Column(BigInteger, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    shop_id = Column(BigInteger, ForeignKey("shops.id", ondelete="SET NULL"), nullable=True)
    uploaded_by_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(Text, nullable=False)
    file_path = Column(Text, nullable=False)
    file_type = Column(String(20), nullable=False)
    file_size_bytes = Column(Integer, nullable=True)
    vendor_name = Column(Text, nullable=True)
    invoice_date = Column(DateTime(timezone=True), nullable=True)
    total_amount = Column(Integer, nullable=True)  # cents
    currency = Column(String(3), default="USD")
    category = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(
        String(20),
        CheckConstraint("status IN ('pending','approved','rejected')"),
        default="pending",
        nullable=False,
    )
    parsed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    line_items = relationship("ExpenseLineItem", back_populates="invoice", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_expense_invoices_tenant_shop", "tenant_id", "shop_id"),
    )


class ExpenseLineItem(Base):
    """Parsed line items from an expense invoice"""
    __tablename__ = "expense_line_items"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    invoice_id = Column(BigInteger, ForeignKey("expense_invoices.id", ondelete="CASCADE"), nullable=False)
    description = Column(Text, nullable=True)
    amount = Column(Integer, nullable=False)  # cents
    category = Column(String(50), nullable=True)
    quantity = Column(Integer, default=1)

    invoice = relationship("ExpenseInvoice", back_populates="line_items")

    __table_args__ = (
        Index("idx_expense_line_items_invoice", "invoice_id"),
    )


class FinancialSyncStatus(Base):
    """Tracks last sync timestamps for ledger and payment data per shop.
    Enables sync status API and 'last updated' UI without querying large tables."""
    __tablename__ = "financial_sync_status"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    tenant_id = Column(BigInteger, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    shop_id = Column(BigInteger, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False)

    ledger_last_sync_at = Column(DateTime(timezone=True), nullable=True)
    payment_last_sync_at = Column(DateTime(timezone=True), nullable=True)
    ledger_last_error = Column(Text, nullable=True)
    payment_last_error = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("shop_id", name="uq_financial_sync_status_shop_id"),
        Index("idx_financial_sync_status_tenant_shop", "tenant_id", "shop_id"),
    )


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