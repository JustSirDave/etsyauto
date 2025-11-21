"""
Celery Tasks for Etsy Listing Publication
Handles background processing of listing jobs
"""
import logging
from datetime import datetime
from typing import Dict, Any
from celery import Task
from sqlalchemy.orm import Session

from app.worker.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.listings import ListingJob, Product, AIGeneration
from app.models.tenancy import Shop
from app.services.etsy_client import EtsyClient, EtsyAPIError, EtsyRateLimitError
from app.services.rate_limiter import get_rate_limiter
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
    max_retries=3,
    default_retry_delay=60,  # Wait 1 minute between retries
)
def publish_listing(self, job_id: int) -> Dict[str, Any]:
    """
    Publish a product as an Etsy listing.

    This task:
    1. Loads the product and AI-generated content
    2. Uploads images to Etsy
    3. Creates the listing with all details
    4. Publishes (activates) the listing
    5. Updates job status

    Args:
        job_id: ID of the ListingJob to process

    Returns:
        dict: Result with listing_id and status
    """
    db = self.db

    # Load job
    job = db.query(ListingJob).filter(ListingJob.id == job_id).first()
    if not job:
        logger.error(f"Job {job_id} not found")
        return {"success": False, "error": "Job not found"}

    try:
        # Update job status to processing
        job.status = "processing"
        job.started_at = datetime.utcnow()
        db.commit()

        # Load product and related data
        product = db.query(Product).filter(Product.id == job.product_id).first()
        if not product:
            raise Exception("Product not found")

        shop = db.query(Shop).filter(Shop.id == job.shop_id).first()
        if not shop:
            raise Exception("Shop not found")

        # Load AI generation if available
        ai_generation = (
            db.query(AIGeneration)
            .filter(
                AIGeneration.product_id == product.id,
                AIGeneration.status == "approved"
            )
            .order_by(AIGeneration.created_at.desc())
            .first()
        )

        # Initialize Etsy client
        redis_client = get_redis_client()
        rate_limiter = get_rate_limiter(redis_client)
        etsy_client = EtsyClient(db, rate_limiter)

        # Prepare listing data
        listing_data = _prepare_listing_data(product, ai_generation)

        logger.info(f"Creating draft listing for product {product.id}")

        # Create draft listing on Etsy
        listing_response = await etsy_client.create_draft_listing(
            shop_id=shop.id,
            etsy_shop_id=shop.etsy_shop_id,
            listing_data=listing_data
        )

        listing_id = str(listing_response["listing_id"])
        logger.info(f"Created draft listing {listing_id}")

        # Upload images if available
        if product.images:
            for rank, image_url in enumerate(product.images[:10], start=1):  # Max 10 images
                try:
                    # TODO: Download image from URL or S3
                    # For now, skip image upload
                    logger.info(f"Skipping image upload for {image_url} (not implemented)")
                except Exception as e:
                    logger.warning(f"Failed to upload image {rank}: {e}")

        # Publish the listing (activate it)
        logger.info(f"Publishing listing {listing_id}")
        await etsy_client.publish_listing(
            shop_id=shop.id,
            listing_id=listing_id
        )

        # Update job as completed
        job.status = "completed"
        job.etsy_listing_id = listing_id
        job.completed_at = datetime.utcnow()
        job.error_message = None
        db.commit()

        logger.info(f"Successfully published listing {listing_id} for job {job_id}")

        return {
            "success": True,
            "job_id": job_id,
            "listing_id": listing_id,
            "etsy_url": f"https://www.etsy.com/listing/{listing_id}"
        }

    except EtsyRateLimitError as e:
        logger.warning(f"Rate limit hit for job {job_id}: {e}")

        # Retry after rate limit delay
        job.status = "pending"
        job.error_message = str(e)
        db.commit()

        # Retry in 2 minutes
        raise self.retry(exc=e, countdown=120)

    except EtsyAPIError as e:
        logger.error(f"Etsy API error for job {job_id}: {e}")

        job.retry_count += 1

        if job.retry_count >= 3:
            # Max retries reached, mark as failed
            job.status = "failed"
            job.error_message = f"Max retries reached. Last error: {str(e)}"
            job.completed_at = datetime.utcnow()
            db.commit()

            return {
                "success": False,
                "job_id": job_id,
                "error": str(e)
            }
        else:
            # Retry
            job.status = "pending"
            job.error_message = str(e)
            db.commit()

            raise self.retry(exc=e, countdown=60 * job.retry_count)

    except Exception as e:
        logger.exception(f"Unexpected error for job {job_id}: {e}")

        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = datetime.utcnow()
        db.commit()

        return {
            "success": False,
            "job_id": job_id,
            "error": str(e)
        }


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
