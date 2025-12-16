"""
RBAC Helpers for Celery Tasks
Enforce permission checking at the task level
"""
import logging
from sqlalchemy.orm import Session
from typing import Optional

from app.models.tenancy import Shop, Membership, Tenant
from app.models.listings import Product, ListingJob

logger = logging.getLogger(__name__)


class TaskRBACError(Exception):
    """Raised when RBAC check fails in a Celery task"""
    pass


def verify_shop_access(db: Session, tenant_id: int, shop_id: int, user_id: Optional[int] = None) -> bool:
    """
    Verify that a tenant has access to a shop.
    
    Args:
        db: Database session
        tenant_id: Tenant ID requesting access
        shop_id: Shop ID to check
        user_id: Optional user ID for additional verification
    
    Returns:
        bool: True if access granted
    
    Raises:
        TaskRBACError: If access denied
    """
    # Check that shop belongs to tenant
    shop = db.query(Shop).filter(
        Shop.id == shop_id,
        Shop.tenant_id == tenant_id
    ).first()
    
    if not shop:
        logger.error(f"RBAC: Shop {shop_id} not found or not accessible by tenant {tenant_id}")
        raise TaskRBACError(f"Shop {shop_id} not accessible by tenant {tenant_id}")
    
    # If user_id provided, verify user is member of tenant
    if user_id:
        membership = db.query(Membership).filter(
            Membership.user_id == user_id,
            Membership.tenant_id == tenant_id
        ).first()
        
        if not membership:
            logger.error(f"RBAC: User {user_id} not a member of tenant {tenant_id}")
            raise TaskRBACError(f"User {user_id} not authorized for tenant {tenant_id}")
    
    return True


def verify_product_access(db: Session, tenant_id: int, product_id: int) -> bool:
    """
    Verify that a tenant owns a product.
    
    Args:
        db: Database session
        tenant_id: Tenant ID requesting access
        product_id: Product ID to check
    
    Returns:
        bool: True if access granted
    
    Raises:
        TaskRBACError: If access denied
    """
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.tenant_id == tenant_id
    ).first()
    
    if not product:
        logger.error(f"RBAC: Product {product_id} not found or not owned by tenant {tenant_id}")
        raise TaskRBACError(f"Product {product_id} not accessible by tenant {tenant_id}")
    
    return True


def verify_listing_job_access(db: Session, tenant_id: int, job_id: int, shop_id: Optional[int] = None) -> ListingJob:
    """
    Verify that a tenant owns a listing job and optionally that it belongs to a specific shop.
    
    Args:
        db: Database session
        tenant_id: Tenant ID requesting access
        job_id: ListingJob ID to check
        shop_id: Optional shop ID for additional verification
    
    Returns:
        ListingJob: The verified listing job
    
    Raises:
        TaskRBACError: If access denied
    """
    query = db.query(ListingJob).filter(
        ListingJob.id == job_id,
        ListingJob.tenant_id == tenant_id
    )
    
    if shop_id:
        query = query.filter(ListingJob.shop_id == shop_id)
    
    job = query.first()
    
    if not job:
        logger.error(f"RBAC: Job {job_id} not found or not accessible by tenant {tenant_id} (shop {shop_id})")
        raise TaskRBACError(f"Job {job_id} not accessible")
    
    return job


def verify_tenant_active(db: Session, tenant_id: int) -> bool:
    """
    Verify that a tenant is active (not suspended).
    
    Args:
        db: Database session
        tenant_id: Tenant ID to check
    
    Returns:
        bool: True if tenant is active
    
    Raises:
        TaskRBACError: If tenant suspended or not found
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    
    if not tenant:
        logger.error(f"RBAC: Tenant {tenant_id} not found")
        raise TaskRBACError(f"Tenant {tenant_id} not found")
    
    if tenant.status != 'active':
        logger.error(f"RBAC: Tenant {tenant_id} is {tenant.status}, access denied")
        raise TaskRBACError(f"Tenant {tenant_id} is {tenant.status}")
    
    return True


def enforce_task_rbac(db: Session, tenant_id: int, shop_id: Optional[int] = None, 
                     product_id: Optional[int] = None, job_id: Optional[int] = None) -> dict:
    """
    Comprehensive RBAC check for Celery tasks.
    
    This should be called at the start of any task that modifies data.
    
    Args:
        db: Database session
        tenant_id: Tenant ID performing the action
        shop_id: Optional shop ID to verify
        product_id: Optional product ID to verify
        job_id: Optional job ID to verify
    
    Returns:
        dict: Verified resources (shop, product, job)
    
    Raises:
        TaskRBACError: If any check fails
    """
    resources = {}
    
    # 1. Verify tenant is active
    verify_tenant_active(db, tenant_id)
    
    # 2. Verify shop access if provided
    if shop_id:
        verify_shop_access(db, tenant_id, shop_id)
        shop = db.query(Shop).filter(Shop.id == shop_id).first()
        resources['shop'] = shop
    
    # 3. Verify product access if provided
    if product_id:
        verify_product_access(db, tenant_id, product_id)
        product = db.query(Product).filter(Product.id == product_id).first()
        resources['product'] = product
    
    # 4. Verify job access if provided
    if job_id:
        job = verify_listing_job_access(db, tenant_id, job_id, shop_id)
        resources['job'] = job
    
    logger.debug(f"RBAC: All checks passed for tenant {tenant_id}")
    return resources

