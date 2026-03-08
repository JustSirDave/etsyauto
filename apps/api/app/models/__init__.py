"""
SQLAlchemy Models Package
Import all models to ensure they're registered with Base.metadata
"""
# Import all models to ensure SQLAlchemy relationships can be resolved
from app.models.tenancy import Tenant, User, Membership, SupplierProfile, Shop, OAuthToken
from app.models.user_preferences import UserPreference
from app.models.exchange_rates import ExchangeRate
from app.models.listings import (
    Product, ListingJob, Schedule, Order,
    UsageCost, AuditLog, WebhookEvent, KeywordResearch
)
from app.models.notifications import Notification, NotificationType
from app.models.ingestion import IngestionBatch

# Make models available at package level
__all__ = [
    # Tenancy models
    "Tenant",
    "User",
    "UserPreference",
    "ExchangeRate",
    "Membership",
    "SupplierProfile",
    "Shop",
    "OAuthToken",
    # Listing models
    "Product",
    "ListingJob",
    "Schedule",
    "Order",
    "UsageCost",
    "AuditLog",
    "WebhookEvent",
    "KeywordResearch",
    # Notification models
    "Notification",
    "NotificationType",
    # Ingestion models
    "IngestionBatch",
]

