"""
SQLAlchemy Models Package
Import all models to ensure they're registered with Base.metadata
"""
# Import all models to ensure SQLAlchemy relationships can be resolved
from app.models.tenancy import Tenant, User, Membership, Shop, OAuthToken
from app.models.listings import (
    Product, AIGeneration, ListingJob, Schedule, Order,
    UsageCost, AuditLog, WebhookEvent, SupplierOrderAssignment, SupplierProductAssignment
)
from app.models.notifications import Notification, NotificationType
from app.models.ingestion import IngestionBatch

# Make models available at package level
__all__ = [
    # Tenancy models
    "Tenant",
    "User",
    "Membership",
    "Shop",
    "OAuthToken",
    # Listing models
    "Product",
    "AIGeneration",
    "ListingJob",
    "Schedule",
    "Order",
    "SupplierOrderAssignment",
    "SupplierProductAssignment",
    "UsageCost",
    "AuditLog",
    "WebhookEvent",
    # Notification models
    "Notification",
    "NotificationType",
    # Ingestion models
    "IngestionBatch",
]

