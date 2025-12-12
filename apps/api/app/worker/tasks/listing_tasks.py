"""
Celery Tasks for Etsy Listing Publication
Handles background processing of listing jobs
"""
import asyncio
import logging
import json
import time
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from celery import Task
from sqlalchemy.orm import Session

from app.worker.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.listings import ListingJob, Product, AIGeneration, AuditLog
from app.models.tenancy import Shop
from app.services.etsy_client import EtsyClient, EtsyAPIError, EtsyRateLimitError
from app.services.rate_limiter import get_rate_limiter
from app.services.listing_policy_checker import ListingPolicyChecker
from app.core.redis import get_redis_client

logger = logging.getLogger(__name__)


class DatabaseTask(Task):
    """Base task with database session management"""
    _db: Session = None

    @property
    def db(self) -> Session:
        if self._db is None:
            self._db = SessionLocal()
        return self._db

    def after_return(self, *args, **kwargs):
        if self._db is not None:
            self._db.close()
            self._db = None


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name="app.worker.tasks.listing_tasks.publish_listing",
    max_retries=5,
    default_retry_delay=60,
)
def publish_listing(self, job_id: int) -> Dict[str, Any]:
    """
    Publish a product as an Etsy listing with idempotency, smart retries, and audit logging.

    Features:
    - Idempotency: Uses idempotency_key to prevent duplicate listings
    - Smart Retries: Different strategies for 429, 5xx, vs 4xx errors
    - Audit Logging: Tracks all Etsy API calls with metadata
    - Rate Limiting: Respects Etsy rate limits with token bucket
    - Max Concurrency: Limits concurrent jobs per shop

    Args:
        job_id: ID of the ListingJob to process

    Returns:
        dict: Result with listing_id and status
    """
    db = self.db
    redis_client = get_redis_client()
    request_id = str(uuid.uuid4())
    
    # Load job
    job = db.query(ListingJob).filter(ListingJob.id == job_id).first()
    if not job:
        logger.error(f"Job {job_id} not found")
        return {"success": False, "error": "Job not found"}
    
    # ==== IDEMPOTENCY CHECK ====
    if job.idempotency_key:
        cached_result = _check_idempotency_cache(redis_client, job.idempotency_key)
        if cached_result:
            logger.info(f"Idempotency hit for job {job_id} (key: {job.idempotency_key})")
            return cached_result
    
    # Check if already completed/cancelled
    if job.status in ['completed', 'cancelled']:
        result = {
            "success": job.status == 'completed',
            "job_id": job_id,
            "listing_id": job.etsy_listing_id,
            "message": f"Job already {job.status}"
        }
        if job.idempotency_key:
            _cache_idempotency_result(redis_client, job.idempotency_key, result)
        return result
    
    # ==== MAX CONCURRENT JOBS PER SHOP ====
    shop_id = job.shop_id
    acquired_slot = _acquire_shop_concurrency_slot(redis_client, shop_id, max_concurrent=3)
    if not acquired_slot:
        logger.warning(f"Max concurrent jobs (3) reached for shop {shop_id}, retrying job {job_id} in 30s")
        raise self.retry(countdown=30)
    
    try:
        # Update job status to processing
        job.status = "processing"
        job.started_at = datetime.utcnow()
        db.commit()
        
        # Load related data
        product = db.query(Product).filter(Product.id == job.product_id).first()
        if not product:
            raise Exception("Product not found")
        
        shop = db.query(Shop).filter(Shop.id == job.shop_id).first()
        if not shop:
            raise Exception("Shop not found")
        
        ai_generation = (
            db.query(AIGeneration)
            .filter(
                AIGeneration.product_id == product.id,
                AIGeneration.review_decision == "accepted"
            )
            .order_by(AIGeneration.created_at.desc())
            .first()
        )
        
        # ==== POLICY COMPLIANCE CHECK (PRE-PUBLISH) ====
        # Create a mock listing object for policy checking
        from types import SimpleNamespace
        mock_listing = SimpleNamespace(
            product_id=product.id,
            ai_generation_id=ai_generation.id if ai_generation else None
        )
        
        policy_checker = ListingPolicyChecker(db)
        compliance_result = policy_checker.check_listing_compliance(mock_listing, product)
        
        # Store policy results on job
        job.policy_status = compliance_result["policy_status"]
        job.policy_flags = compliance_result["policy_flags"]
        job.policy_checked_at = datetime.utcnow()
        
        # FAIL CLOSED: Block publish if not compliant
        if not compliance_result["can_publish"]:
            job.status = "policy_blocked"
            job.policy_block_reason = f"Policy violations: {', '.join(compliance_result['policy_flags'])}"
            job.completed_at = datetime.utcnow()
            db.commit()
            
            logger.error(f"[{request_id}] Job {job_id} blocked by policy: {job.policy_block_reason}")
            
            # Release concurrency slot
            _release_shop_concurrency_slot(redis_client, shop_id)
            
            result = {
                "success": False,
                "job_id": job_id,
                "error": "policy_blocked",
                "policy_status": compliance_result["policy_status"],
                "policy_flags": compliance_result["policy_flags"],
                "remediation_required": True,
                "message": job.policy_block_reason
            }
            
            if job.idempotency_key:
                _cache_idempotency_result(redis_client, job.idempotency_key, result, ttl=3600)
            
            return result
        
        # Store policy approval on AIGeneration if available
        if ai_generation and compliance_result["can_publish"]:
            ai_generation.policy_status = compliance_result["policy_status"]
            ai_generation.policy_flags = compliance_result["policy_flags"]
            ai_generation.policy_checked_at = datetime.utcnow()
            ai_generation.can_publish = 1
            db.commit()
        
        logger.info(f"[{request_id}] Policy check passed for job {job_id}")
        
        # Initialize Etsy client
        rate_limiter = get_rate_limiter(redis_client)
        etsy_client = EtsyClient(db, rate_limiter)
        
        # Prepare listing data
        listing_data = _prepare_listing_data(product, ai_generation)
        
        # ==== AUDIT LOG: Create Draft Listing ====
        start_time = time.time()
        audit = AuditLog(
            tenant_id=job.tenant_id,
            shop_id=shop.id,
            actor_type='worker',
            actor_id=f'celery:{self.request.id}',
            action='etsy.create_draft_listing',
            target_type='listing',
            target_id=str(product.id),
            request_id=request_id,
            idempotency_key=job.idempotency_key,
            diff={'attempt': job.retry_count, 'product_id': product.id}
        )
        
        logger.info(f"[{request_id}] Creating draft listing for product {product.id}")
        
        # ==== RATE LIMITING: Acquire Token ====
        rate_limit_acquired = asyncio.run(rate_limiter.acquire(shop.id, tokens=1))
        if not rate_limit_acquired:
            # No tokens available, calculate wait time
            wait_time = asyncio.run(rate_limiter.get_wait_time(shop.id, tokens=1))
            logger.warning(f"[{request_id}] Rate limit reached for shop {shop.id}, waiting {wait_time:.1f}s")
            
            # Release concurrency slot before retry
            _release_shop_concurrency_slot(redis_client, shop_id)
            
            # Retry after wait time
            raise self.retry(countdown=int(wait_time) + 5)
        
        try:
            # Create draft listing on Etsy
            listing_response = asyncio.run(etsy_client.create_draft_listing(
                shop_id=shop.id,
                etsy_shop_id=shop.etsy_shop_id,
                listing_data=listing_data
            ))
            
            listing_id = str(listing_response["listing_id"])
            
            # Update audit log with success
            audit.status_code = 201
            audit.latency_ms = int((time.time() - start_time) * 1000)
            db.add(audit)
            db.commit()
            
            logger.info(f"[{request_id}] Created draft listing {listing_id}")
            
        except EtsyAPIError as e:
            # Update audit log with error
            audit.status_code = e.status_code or 500
            audit.latency_ms = int((time.time() - start_time) * 1000)
            audit.diff['error'] = str(e)
            db.add(audit)
            db.commit()
            raise
        
        # ==== AUDIT LOG: Publish Listing ====
        start_time = time.time()
        audit_publish = AuditLog(
            tenant_id=job.tenant_id,
            shop_id=shop.id,
            actor_type='worker',
            actor_id=f'celery:{self.request.id}',
            action='etsy.publish_listing',
            target_type='listing',
            target_id=listing_id,
            request_id=request_id,
            idempotency_key=job.idempotency_key,
            diff={'attempt': job.retry_count, 'listing_id': listing_id}
        )
        
        logger.info(f"[{request_id}] Publishing listing {listing_id}")
        
        # ==== RATE LIMITING: Acquire Token for Publish ====
        rate_limit_acquired = asyncio.run(rate_limiter.acquire(shop.id, tokens=1))
        if not rate_limit_acquired:
            wait_time = asyncio.run(rate_limiter.get_wait_time(shop.id, tokens=1))
            logger.warning(f"[{request_id}] Rate limit reached for shop {shop.id}, waiting {wait_time:.1f}s")
            
            # Release concurrency slot before retry
            _release_shop_concurrency_slot(redis_client, shop_id)
            
            raise self.retry(countdown=int(wait_time) + 5)
        
        try:
            # Publish the listing (activate it)
            asyncio.run(etsy_client.publish_listing(
                shop_id=shop.id,
                listing_id=listing_id
            ))
            
            # Update audit log with success
            audit_publish.status_code = 200
            audit_publish.latency_ms = int((time.time() - start_time) * 1000)
            db.add(audit_publish)
            
        except EtsyAPIError as e:
            # Update audit log with error
            audit_publish.status_code = e.status_code or 500
            audit_publish.latency_ms = int((time.time() - start_time) * 1000)
            audit_publish.diff['error'] = str(e)
            db.add(audit_publish)
            db.commit()
            raise
        
        # ==== SUCCESS: Update Job ====
        job.status = "completed"
        job.etsy_listing_id = listing_id
        job.completed_at = datetime.utcnow()
        job.error_message = None
        job.error_code = None
        db.commit()
        
        result = {
            "success": True,
            "job_id": job_id,
            "listing_id": listing_id,
            "etsy_url": f"https://www.etsy.com/listing/{listing_id}",
            "request_id": request_id
        }
        
        # Cache idempotency result
        if job.idempotency_key:
            _cache_idempotency_result(redis_client, job.idempotency_key, result)
        
        logger.info(f"[{request_id}] Successfully published listing {listing_id} for job {job_id}")
        return result
    
    # ==== ERROR HANDLING WITH SMART RETRIES ====
    except EtsyAPIError as e:
        return _handle_etsy_error(self, db, job, e, request_id)
    
    except Exception as e:
        logger.exception(f"[{request_id}] Unexpected error for job {job_id}: {e}")
        
        job.status = "failed"
        job.error_message = str(e)
        job.error_code = "INTERNAL_ERROR"
        job.completed_at = datetime.utcnow()
        db.commit()
        
        result = {
            "success": False,
            "job_id": job_id,
            "error": str(e),
            "error_code": "INTERNAL_ERROR",
            "request_id": request_id
        }
        
        # Cache failure for idempotency
        if job.idempotency_key:
            _cache_idempotency_result(redis_client, job.idempotency_key, result)
        
        return result
    
    finally:
        # ==== ALWAYS RELEASE CONCURRENCY SLOT ====
        _release_shop_concurrency_slot(redis_client, shop_id)
        logger.info(f"Released concurrency slot for shop {shop_id}")


def _check_idempotency_cache(redis_client, idempotency_key: str) -> Optional[Dict]:
    """Check if this idempotency key has a cached result"""
    cache_key = f"idempotency:listing:{idempotency_key}"
    cached = redis_client.get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except json.JSONDecodeError:
            return None
    return None


def _cache_idempotency_result(redis_client, idempotency_key: str, result: Dict, ttl: int = 86400):
    """Cache the result for this idempotency key (24 hours default)"""
    cache_key = f"idempotency:listing:{idempotency_key}"
    redis_client.setex(cache_key, ttl, json.dumps(result))


def _acquire_shop_concurrency_slot(redis_client, shop_id: int, max_concurrent: int = 3) -> bool:
    """
    Acquire a concurrency slot for the shop (semaphore pattern)
    
    Args:
        redis_client: Redis client
        shop_id: Shop ID
        max_concurrent: Maximum concurrent jobs per shop (default 3)
    
    Returns:
        True if slot acquired, False if at max capacity
    """
    semaphore_key = f"shop_concurrency:{shop_id}"
    current_count = redis_client.incr(semaphore_key)
    
    if current_count > max_concurrent:
        # Over capacity, decrement and fail
        redis_client.decr(semaphore_key)
        return False
    
    # Set expiry to prevent stale counters (5 minutes)
    redis_client.expire(semaphore_key, 300)
    return True


def _release_shop_concurrency_slot(redis_client, shop_id: int):
    """Release a concurrency slot for the shop"""
    semaphore_key = f"shop_concurrency:{shop_id}"
    redis_client.decr(semaphore_key)


def _handle_etsy_error(task, db: Session, job: ListingJob, error: EtsyAPIError, request_id: str) -> Dict[str, Any]:
    """
    Smart error handling with different strategies based on error type
    
    - 4xx (client errors): Don't retry (except 429)
    - 429 (rate limit): Retry with Retry-After header
    - 5xx (server errors): Retry with exponential backoff
    """
    status_code = error.status_code or 500
    job.error_code = f"ETSY_{status_code}"
    job.error_message = str(error)
    job.retry_count += 1
    
    # ==== Client Errors (4xx) - Don't Retry ====
    if 400 <= status_code < 500 and status_code != 429:
        logger.error(f"[{request_id}] Client error {status_code} for job {job.id}: {error}")
        
        job.status = "failed"
        job.completed_at = datetime.utcnow()
        job.error_detail = {
            "status_code": status_code,
            "message": str(error),
            "request_id": request_id,
            "note": "Client error - not retrying"
        }
        db.commit()
        
        result = {
            "success": False,
            "job_id": job.id,
            "error": str(error),
            "error_code": f"ETSY_{status_code}",
            "request_id": request_id,
            "retryable": False
        }
        
        # Cache failure
        if job.idempotency_key:
            redis_client = get_redis_client()
            _cache_idempotency_result(redis_client, job.idempotency_key, result)
        
        return result
    
    # ==== Rate Limit (429) - Retry with Retry-After ====
    if status_code == 429:
        # Parse Retry-After header (seconds or HTTP date)
        retry_after = error.headers.get('Retry-After', '300')
        try:
            countdown = int(retry_after)
        except ValueError:
            # If it's an HTTP date, default to 5 minutes
            countdown = 300
        
        logger.warning(f"[{request_id}] Rate limit hit for job {job.id}, retry in {countdown}s")
        
        job.status = "pending"
        job.error_detail = {
            "status_code": 429,
            "retry_after": countdown,
            "attempt": job.retry_count,
            "request_id": request_id
        }
        db.commit()
        
        raise task.retry(exc=error, countdown=countdown)
    
    # ==== Server Errors (5xx) - Retry with Exponential Backoff ====
    if status_code >= 500:
        max_retries = 5
        
        if job.retry_count >= max_retries:
            logger.error(f"[{request_id}] Max retries ({max_retries}) reached for job {job.id}")
            
            job.status = "failed"
            job.completed_at = datetime.utcnow()
            job.error_detail = {
                "status_code": status_code,
                "message": str(error),
                "attempts": job.retry_count,
                "request_id": request_id,
                "note": f"Max retries ({max_retries}) reached"
            }
            db.commit()
            
            return {
                "success": False,
                "job_id": job.id,
                "error": f"Max retries reached. Last error: {str(error)}",
                "error_code": f"ETSY_{status_code}",
                "request_id": request_id
            }
        
        # Exponential backoff: 60, 120, 240, 480, 960 seconds (max 16 min)
        countdown = min(60 * (2 ** (job.retry_count - 1)), 960)
        
        logger.warning(f"[{request_id}] Server error {status_code} for job {job.id}, retry #{job.retry_count} in {countdown}s")
        
        job.status = "pending"
        job.error_detail = {
            "status_code": status_code,
            "countdown": countdown,
            "attempt": job.retry_count,
            "request_id": request_id
        }
        db.commit()
        
        raise task.retry(exc=error, countdown=countdown)
    
    # ==== Unknown Error - Retry Once ====
    logger.error(f"[{request_id}] Unknown error type {status_code} for job {job.id}")
    
    if job.retry_count >= 2:
        job.status = "failed"
        job.completed_at = datetime.utcnow()
        db.commit()
        
        return {
            "success": False,
            "job_id": job.id,
            "error": str(error),
            "error_code": f"ETSY_{status_code}",
            "request_id": request_id
        }
    
    job.status = "pending"
    db.commit()
    raise task.retry(exc=error, countdown=120)


def _prepare_listing_data(product: Product, ai_generation: AIGeneration = None) -> Dict[str, Any]:
    """
    Prepare Etsy listing data from product and AI generation.

    Args:
        product: Product model instance
        ai_generation: Optional AI generation data

    Returns:
        dict: Etsy API listing data
    """
    # Use AI-generated content if available, otherwise use product data
    if ai_generation:
        title = ai_generation.title
        description = ai_generation.description
        tags = ai_generation.tags[:13]  # Etsy max 13 tags
    else:
        title = product.title
        description = product.description or ""
        tags = []

    # Etsy listing data structure
    listing_data = {
        "quantity": product.quantity,
        "title": title[:140],  # Etsy max 140 chars
        "description": description,
        "price": product.price,
        "who_made": "i_did",  # Required: who made it
        "when_made": "made_to_order",  # Required: when made
        "taxonomy_id": 1,  # TODO: Map to proper Etsy category
        "shipping_profile_id": None,  # TODO: Use shop's shipping profile
        "return_policy_id": None,  # TODO: Use shop's return policy
        "materials": [],  # Optional materials
        "shop_section_id": None,  # Optional shop section
        "processing_min": 1,  # Processing time in days
        "processing_max": 3,
        "tags": tags,
        "styles": [],  # Optional styles
        "item_weight": None,  # Optional weight
        "item_length": None,  # Optional dimensions
        "item_width": None,
        "item_height": None,
        "item_weight_unit": "oz",  # oz, lb, g, kg
        "item_dimensions_unit": "in",  # in, ft, mm, cm, m
        "is_personalizable": False,
        "personalization_is_required": False,
        "personalization_char_count_max": None,
        "personalization_instructions": None,
        "is_supply": False,  # Is it a craft supply?
        "is_customizable": False,
        "should_auto_renew": True,  # Auto-renew when expires
        "is_taxable": True,
        "type": "physical",  # physical or download
    }

    return listing_data


@celery_app.task(name="app.worker.tasks.listing_tasks.retry_failed_listing")
def retry_failed_listing(job_id: int) -> Dict[str, Any]:
    """
    Retry a failed listing job.

    Args:
        job_id: ID of the failed ListingJob

    Returns:
        dict: Result of retry attempt
    """
    db = SessionLocal()

    try:
        job = db.query(ListingJob).filter(ListingJob.id == job_id).first()
        if not job:
            return {"success": False, "error": "Job not found"}

        if job.status != "failed":
            return {"success": False, "error": "Job is not in failed status"}

        # Reset job for retry
        job.status = "pending"
        job.retry_count = 0
        job.error_message = None
        job.started_at = None
        job.completed_at = None
        db.commit()

        # Trigger publish task
        publish_listing.delay(job_id)

        return {
            "success": True,
            "job_id": job_id,
            "message": "Job queued for retry"
        }

    finally:
        db.close()


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name="app.worker.tasks.listing_tasks.update_listing",
    max_retries=5,
    default_retry_delay=60,
)
def update_listing(self, job_id: int, listing_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Update an existing Etsy listing with idempotency, smart retries, and audit logging.

    Features:
    - Idempotency: Uses idempotency_key to prevent duplicate updates
    - Smart Retries: Different strategies for 429, 5xx, vs 4xx errors
    - Audit Logging: Tracks all Etsy API calls with metadata
    - Rate Limiting: Respects Etsy rate limits with token bucket
    - Max Concurrency: Limits concurrent jobs per shop

    Args:
        job_id: ID of the ListingJob to process
        listing_data: Optional listing data dict. If not provided, will be generated from product.

    Returns:
        dict: Result with listing_id and status
    """
    db = self.db
    redis_client = get_redis_client()
    request_id = str(uuid.uuid4())
    
    # Load job
    job = db.query(ListingJob).filter(ListingJob.id == job_id).first()
    if not job:
        logger.error(f"Job {job_id} not found")
        return {"success": False, "error": "Job not found"}
    
    # Must have an existing listing_id for updates
    if not job.etsy_listing_id:
        logger.error(f"Job {job_id} missing etsy_listing_id (required for updates)")
        job.status = "failed"
        job.error_message = "Missing etsy_listing_id for update operation"
        job.error_code = "MISSING_LISTING_ID"
        db.commit()
        return {"success": False, "error": "Missing etsy_listing_id"}
    
    # ==== IDEMPOTENCY CHECK ====
    if job.idempotency_key:
        cached_result = _check_idempotency_cache(redis_client, job.idempotency_key)
        if cached_result:
            logger.info(f"Idempotency hit for update job {job_id} (key: {job.idempotency_key})")
            return cached_result
    
    # Check if already completed/cancelled
    if job.status in ['completed', 'cancelled']:
        result = {
            "success": job.status == 'completed',
            "job_id": job_id,
            "listing_id": job.etsy_listing_id,
            "message": f"Job already {job.status}"
        }
        if job.idempotency_key:
            _cache_idempotency_result(redis_client, job.idempotency_key, result)
        return result
    
    # ==== MAX CONCURRENT JOBS PER SHOP ====
    shop_id = job.shop_id
    acquired_slot = _acquire_shop_concurrency_slot(redis_client, shop_id, max_concurrent=3)
    if not acquired_slot:
        logger.warning(f"Max concurrent jobs (3) reached for shop {shop_id}, retrying job {job_id} in 30s")
        raise self.retry(countdown=30)
    
    try:
        # Update job status to processing
        job.status = "processing"
        job.started_at = datetime.utcnow()
        db.commit()
        
        # Load related data
        shop = db.query(Shop).filter(Shop.id == job.shop_id).first()
        if not shop:
            raise Exception("Shop not found")
        
        # Prepare listing data (use provided or generate from product)
        if listing_data is None:
            product = db.query(Product).filter(Product.id == job.product_id).first()
            if not product:
                raise Exception("Product not found")
            
            ai_generation = (
                db.query(AIGeneration)
                .filter(
                    AIGeneration.product_id == product.id,
                    AIGeneration.status == "approved"
                )
                .order_by(AIGeneration.created_at.desc())
                .first()
            )
            
            listing_data = _prepare_listing_data(product, ai_generation)
        
        # Initialize Etsy client
        rate_limiter = get_rate_limiter(redis_client)
        etsy_client = EtsyClient(db, rate_limiter)
        
        # ==== RATE LIMITING: Acquire Token ====
        rate_limit_acquired = asyncio.run(rate_limiter.acquire(shop.id, tokens=1))
        if not rate_limit_acquired:
            wait_time = asyncio.run(rate_limiter.get_wait_time(shop.id, tokens=1))
            logger.warning(f"[{request_id}] Rate limit reached for shop {shop.id}, waiting {wait_time:.1f}s")
            
            _release_shop_concurrency_slot(redis_client, shop_id)
            raise self.retry(countdown=int(wait_time) + 5)
        
        # ==== AUDIT LOG: Update Listing ====
        start_time = time.time()
        audit = AuditLog(
            tenant_id=job.tenant_id,
            shop_id=shop.id,
            actor_type='worker',
            actor_id=f'celery:{self.request.id}',
            action='etsy.update_listing',
            target_type='listing',
            target_id=job.etsy_listing_id,
            request_id=request_id,
            idempotency_key=job.idempotency_key,
            diff={'attempt': job.retry_count, 'listing_id': job.etsy_listing_id}
        )
        
        logger.info(f"[{request_id}] Updating listing {job.etsy_listing_id} for job {job_id}")
        
        try:
            # Update listing on Etsy
            listing_response = asyncio.run(etsy_client.update_listing(
                shop_id=shop.id,
                listing_id=job.etsy_listing_id,
                listing_data=listing_data
            ))
            
            # Update audit log with success
            audit.status_code = 200
            audit.latency_ms = int((time.time() - start_time) * 1000)
            audit.diff.update(listing_response)
            db.add(audit)
            db.commit()
            
            logger.info(f"[{request_id}] Updated listing {job.etsy_listing_id}")
            
        except EtsyAPIError as e:
            # Update audit log with error
            audit.status_code = e.status_code or 500
            audit.latency_ms = int((time.time() - start_time) * 1000)
            audit.diff['error'] = str(e)
            db.add(audit)
            db.commit()
            raise
        
        # ==== SUCCESS: Update Job ====
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        job.error_message = None
        job.error_code = None
        db.commit()
        
        result = {
            "success": True,
            "job_id": job_id,
            "listing_id": job.etsy_listing_id,
            "etsy_url": f"https://www.etsy.com/listing/{job.etsy_listing_id}",
            "request_id": request_id
        }
        
        # Cache idempotency result
        if job.idempotency_key:
            _cache_idempotency_result(redis_client, job.idempotency_key, result)
        
        logger.info(f"[{request_id}] Successfully updated listing {job.etsy_listing_id} for job {job_id}")
        return result
    
    # ==== ERROR HANDLING WITH SMART RETRIES ====
    except EtsyAPIError as e:
        return _handle_etsy_error(self, db, job, e, request_id)
    
    except Exception as e:
        logger.exception(f"[{request_id}] Unexpected error for update job {job_id}: {e}")
        
        job.status = "failed"
        job.error_message = str(e)
        job.error_code = "INTERNAL_ERROR"
        job.completed_at = datetime.utcnow()
        db.commit()
        
        result = {
            "success": False,
            "job_id": job_id,
            "error": str(e),
            "error_code": "INTERNAL_ERROR",
            "request_id": request_id
        }
        
        # Cache failure for idempotency
        if job.idempotency_key:
            _cache_idempotency_result(redis_client, job.idempotency_key, result)
        
        return result
    
    finally:
        # ==== ALWAYS RELEASE CONCURRENCY SLOT ====
        _release_shop_concurrency_slot(redis_client, shop_id)
        logger.info(f"Released concurrency slot for shop {shop_id}")


@celery_app.task(name="app.worker.tasks.listing_tasks.cancel_listing_job")
def cancel_listing_job(job_id: int) -> Dict[str, Any]:
    """
    Cancel a pending or scheduled listing job.

    Args:
        job_id: ID of the ListingJob to cancel

    Returns:
        dict: Result of cancellation
    """
    db = SessionLocal()

    try:
        job = db.query(ListingJob).filter(ListingJob.id == job_id).first()
        if not job:
            return {"success": False, "error": "Job not found"}

        if job.status not in ["pending", "scheduled"]:
            return {"success": False, "error": f"Cannot cancel job with status {job.status}"}

        job.status = "cancelled"
        job.completed_at = datetime.utcnow()
        db.commit()

        return {
            "success": True,
            "job_id": job_id,
            "message": "Job cancelled"
        }

    finally:
        db.close()
