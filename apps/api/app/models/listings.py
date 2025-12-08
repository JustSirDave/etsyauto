"""
SQLAlchemy Models - Products, AI Generations, Listing Jobs, Orders
"""
from datetime import datetime
from sqlalchemy import (
    Column, BigInteger, String, Text, Integer, DateTime, 
    ForeignKey, CheckConstraint, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB

from app.core.database import Base


class Product(Base):
    """Products to be listed on Etsy"""
    __tablename__ = "products"
    
    id = Column(BigInteger, primary_key=True, index=True)
    tenant_id = Column(BigInteger, ForeignKey('tenants.id'), nullable=False)
    
    # Raw product data
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
    
    # Import tracking
    source = Column(String(50), CheckConstraint("source IN ('csv','json','api','manual')"), default='manual')
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
    
    policy_flags = Column(JSONB)
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
    
    # Status tracking
    status = Column(
        String(20), 
        CheckConstraint("status IN ('pending','scheduled','processing','completed','failed','cancelled')"),
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
    """Automated task schedules"""
    __tablename__ = "schedules"

    id = Column(BigInteger, primary_key=True, index=True)
    tenant_id = Column(BigInteger, ForeignKey('tenants.id'), nullable=False)
    shop_id = Column(BigInteger, ForeignKey('shops.id'), nullable=True)  # Optional for non-shop tasks

    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String(50), nullable=False)  # sync, generate, backup, report
    cron_expr = Column(String(100), nullable=False)
    daily_quota = Column(Integer, default=0)
    status = Column(String(20), default='active')  # active, paused, error

    last_run_at = Column(DateTime(timezone=True), nullable=True)
    next_run_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    execution_count = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class Order(Base):
    """Orders from Etsy"""
    __tablename__ = "orders"
    
    id = Column(BigInteger, primary_key=True, index=True)
    tenant_id = Column(BigInteger, ForeignKey('tenants.id'), nullable=False)
    shop_id = Column(BigInteger, ForeignKey('shops.id'), nullable=False)
    
    etsy_receipt_id = Column(String(50), unique=True)
    status = Column(
        String(30),
        CheckConstraint("status IN ('new','submitted_to_supplier','fulfilled','failed')"),
        default='new'
    )
    
    supplier_order_id = Column(String(255))
    tracking = Column(JSONB)
    customer_name = Column(String(255))
    customer_email = Column(String(255))
    order_data = Column(JSONB)
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


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
    """Audit log for all actions"""
    __tablename__ = "audit_logs"
    
    id = Column(BigInteger, primary_key=True, index=True)
    tenant_id = Column(BigInteger, ForeignKey('tenants.id'))
    
    actor_type = Column(String(20), CheckConstraint("actor_type IN ('user','system','worker')"))
    actor_id = Column(String(50))
    shop_id = Column(BigInteger, ForeignKey('shops.id'))
    
    action = Column(String(100))
    target_type = Column(String(50))
    target_id = Column(String(50))
    
    request_id = Column(String(100))
    idempotency_key = Column(String(255))
    
    diff = Column(JSONB)
    status_code = Column(Integer)
    latency_ms = Column(Integer)
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


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