"""
SQLAlchemy Models - Core Tenancy & Authentication
"""
from datetime import datetime
from sqlalchemy import (
    Column, BigInteger, String, Text, Boolean, DateTime, 
    ForeignKey, CheckConstraint, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import CITEXT, JSONB, BYTEA

from app.core.database import Base
from app.models.listings import ListingJob, Order


class Tenant(Base):
    """Organization/Company that owns shops"""
    __tablename__ = "tenants"
    
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    name = Column(Text, nullable=False)
    billing_tier = Column(
        String(20), 
        CheckConstraint("billing_tier IN ('starter', 'pro', 'enterprise')"),
        default='starter',
        nullable=False
    )
    status = Column(
        String(20),
        CheckConstraint("status IN ('active', 'suspended')"),
        default='active',
        nullable=False
    )
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    memberships = relationship("Membership", back_populates="tenant")
    shops = relationship("Shop", back_populates="tenant")
    # products = relationship("Product", back_populates="tenant")


class User(Base):
    """Platform users"""
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    email = Column(CITEXT, unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=True)  # Nullable for SSO
    name = Column(Text, nullable=True)

    # Email verification
    email_verified = Column(Boolean, default=False, nullable=False)
    verification_token = Column(String(255), unique=True, nullable=True, index=True)
    verification_token_expires = Column(DateTime(timezone=True), nullable=True)

    # Password reset
    reset_token = Column(String(255), unique=True, nullable=True, index=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)

    # Security
    failed_login_attempts = Column(BigInteger, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)

    last_login_at = Column(DateTime(timezone=True), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    memberships = relationship("Membership", back_populates="user")


class Membership(Base):
    """User membership in tenants with RBAC"""
    __tablename__ = "memberships"
    
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    tenant_id = Column(BigInteger, ForeignKey("tenants.id"), nullable=False)
    role = Column(
        String(20),
        CheckConstraint("role IN ('owner', 'admin', 'creator', 'viewer')"),
        nullable=False
    )
    
    __table_args__ = (
        UniqueConstraint('user_id', 'tenant_id', name='uq_user_tenant'),
        Index('idx_membership_user', 'user_id'),
        Index('idx_membership_tenant', 'tenant_id'),
    )
    
    # Relationships
    user = relationship("User", back_populates="memberships")
    tenant = relationship("Tenant", back_populates="memberships")


class Shop(Base):
    """Connected Etsy shops"""
    __tablename__ = "shops"
    
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    tenant_id = Column(BigInteger, ForeignKey("tenants.id"), nullable=False)
    etsy_shop_id = Column(Text, unique=True, nullable=False, index=True)
    display_name = Column(Text, nullable=True)
    status = Column(
        String(20),
        CheckConstraint("status IN ('connected', 'revoked')"),
        default='connected',
        nullable=False
    )
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="shops")
    oauth_tokens = relationship("OAuthToken", back_populates="shop")
    # listing_jobs = relationship("ListingJob", back_populates="shop")
    # orders = relationship("Order", back_populates="shop")


class OAuthToken(Base):
    """Encrypted OAuth tokens for external services"""
    __tablename__ = "oauth_tokens"
    
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    shop_id = Column(BigInteger, ForeignKey("shops.id"), nullable=False)
    provider = Column(
        String(20),
        CheckConstraint("provider IN ('etsy', 'printful')"),
        nullable=False
    )
    access_token = Column(BYTEA, nullable=False)  # Encrypted
    refresh_token = Column(BYTEA, nullable=True)  # Encrypted
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        UniqueConstraint('shop_id', 'provider', name='uq_shop_provider'),
    )
    
    # Relationships
    shop = relationship("Shop", back_populates="oauth_tokens")
