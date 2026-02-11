"""
Scheduled Publishing Tasks
Celery beat jobs for automated listing publication with quota enforcement
"""
import logging
from celery import shared_task
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.listings import Schedule, Product, ListingJob
from app.services.quota_manager import QuotaManager
from app.services.rate_limiter import RateLimiter
from app.worker.tasks.listing_tasks import publish_listing
from app.services.notification_service import notify_tenant_admins
from app.models.notifications import NotificationType

logger = logging.getLogger(__name__)


@shared_task(name="scheduled_publishing.process_schedules", bind=True, max_retries=3)
def process_schedules(self):
    """
    Main beat task that processes all active schedules
    Runs every minute via Celery beat
    """
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        
        # Get all active schedules that are due
        schedules = db.query(Schedule).filter(
            Schedule.status.in_(['active', 'quota_exceeded']),
            Schedule.next_run_at <= now
        ).all()
        
        logger.info(f"Found {len(schedules)} schedules to process")
        
        for schedule in schedules:
            try:
                process_schedule(schedule.id)
            except Exception as e:
                logger.error(f"Error processing schedule {schedule.id}: {str(e)}", exc_info=True)
        
    except Exception as e:
        logger.error(f"Error in process_schedules: {str(e)}", exc_info=True)
    finally:
        db.close()


@shared_task(name="scheduled_publishing.process_schedule", bind=True, max_retries=3)
def process_schedule(self, schedule_id: int):
    """
    Process a single schedule and enqueue listing jobs
    
    Args:
        schedule_id: ID of schedule to process
    """
    db = SessionLocal()
    try:
        schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
        
        if not schedule:
            logger.error(f"Schedule {schedule_id} not found")
            return
        
        logger.info(f"Processing schedule {schedule_id}: {schedule.name}")
        
        # Initialize quota manager and rate limiter
        quota_manager = QuotaManager(db)
        rate_limiter = RateLimiter()
        
        # Reset quota status if needed (quota may have reset since last run)
        quota_manager.reset_quota_status(schedule)
        
        # Check if schedule has quota available
        has_quota, quota_reason = quota_manager.has_quota_available(schedule)
        
        if not has_quota:
            logger.warning(f"Schedule {schedule_id} has no quota available: {quota_reason}")
            schedule.status = 'quota_exceeded'
            schedule.last_error = quota_reason
            schedule.last_run_at = datetime.now(timezone.utc)
            schedule.next_run_at = calculate_next_run(schedule)
            db.commit()
            notify_tenant_admins(
                db=db,
                tenant_id=schedule.tenant_id,
                notification_type=NotificationType.WARNING,
                title="Schedule paused (quota exceeded)",
                message=f"Schedule '{schedule.name}' paused: {quota_reason}",
                action_url="/schedules",
                action_label="View schedules",
            )
            return
        
        # Check if shop has rate limit capacity
        if schedule.shop_id:
            has_capacity = rate_limiter.has_capacity(f"shop:{schedule.shop_id}")
            if not has_capacity:
                logger.warning(f"Schedule {schedule_id} - Shop {schedule.shop_id} at rate limit capacity")
                # Don't mark as error, just skip this run
                schedule.last_run_at = datetime.now(timezone.utc)
                schedule.next_run_at = calculate_next_run(schedule, delay_minutes=5)  # Retry in 5 minutes
                db.commit()
                return
        
        # Get products to publish based on schedule filter
        products = get_products_for_schedule(db, schedule)
        
        if not products:
            logger.info(f"No products found for schedule {schedule_id}")
            schedule.last_run_at = datetime.now(timezone.utc)
            schedule.next_run_at = calculate_next_run(schedule)
            db.commit()
            return
        
        # Calculate how many we can publish based on quota
        remaining_quota = quota_manager.get_remaining_quota(schedule)
        daily_remaining = remaining_quota['daily_remaining']
        weekly_remaining = remaining_quota['weekly_remaining']
        
        max_to_publish = daily_remaining
        if weekly_remaining is not None:
            max_to_publish = min(max_to_publish, weekly_remaining)
        
        # Also respect rate limiter max concurrency
        if schedule.shop_id:
            max_concurrent = rate_limiter.get_max_concurrent(f"shop:{schedule.shop_id}")
            max_to_publish = min(max_to_publish, max_concurrent)
        
        products_to_publish = products[:max_to_publish]
        
        logger.info(f"Schedule {schedule_id}: Publishing {len(products_to_publish)}/{len(products)} products "
                   f"(quota limit: {max_to_publish})")
        
        # Enqueue publish tasks
        published_count = 0
        failed_count = 0
        
        for product in products_to_publish:
            try:
                # Check if there's already a pending job for this product
                existing_job = db.query(ListingJob).filter(
                    ListingJob.product_id == product.id,
                    ListingJob.status.in_(['pending', 'scheduled', 'processing'])
                ).first()
                
                if existing_job:
                    logger.info(f"Product {product.id} already has a pending job, skipping")
                    continue
                
                # Enqueue the publish task
                publish_listing.delay(
                    product_id=product.id,
                    shop_id=schedule.shop_id,
                    tenant_id=schedule.tenant_id,
                    idempotency_key=f"schedule:{schedule_id}:product:{product.id}:{int(datetime.now().timestamp())}"
                )
                
                # Consume quota
                quota_manager.consume_quota(schedule, count=1)
                published_count += 1
                
            except Exception as e:
                logger.error(f"Error enqueueing product {product.id}: {str(e)}", exc_info=True)
                failed_count += 1
        
        # Update schedule stats
        quota_manager.increment_success(schedule)
        schedule.total_success = (schedule.total_success or 0) + published_count
        schedule.total_failed = (schedule.total_failed or 0) + failed_count
        schedule.last_run_at = datetime.now(timezone.utc)
        schedule.next_run_at = calculate_next_run(schedule)
        schedule.execution_count = (schedule.execution_count or 0) + 1
        
        if failed_count > 0:
            schedule.last_error = f"Published {published_count}, failed {failed_count}"
        else:
            schedule.last_error = None
        
        db.commit()
        
        logger.info(f"Schedule {schedule_id} processed: {published_count} published, {failed_count} failed")
        
    except Exception as e:
        logger.error(f"Error processing schedule {schedule_id}: {str(e)}", exc_info=True)
        
        # Update schedule with error
        if schedule:
            quota_manager = QuotaManager(db)
            quota_manager.increment_failure(schedule, str(e))
            schedule.status = 'error'
            schedule.last_run_at = datetime.now(timezone.utc)
            schedule.next_run_at = calculate_next_run(schedule, delay_minutes=30)  # Retry in 30 minutes on error
            db.commit()
            notify_tenant_admins(
                db=db,
                tenant_id=schedule.tenant_id,
                notification_type=NotificationType.ERROR,
                title="Schedule error",
                message=f"Schedule '{schedule.name}' failed to run. {str(e)}",
                action_url="/schedules",
                action_label="View schedules",
            )
    
    finally:
        db.close()


def get_products_for_schedule(db: Session, schedule: Schedule) -> list:
    """
    Get products that match the schedule's filter criteria
    
    Args:
        db: Database session
        schedule: Schedule object
        
    Returns:
        List of Product objects
    """
    query = db.query(Product).filter(
        Product.tenant_id == schedule.tenant_id
    )
    
    # Apply schedule filters if specified
    if schedule.product_filter:
        filters = schedule.product_filter
        
        # Filter by tags
        if 'tags' in filters and filters['tags']:
            # PostgreSQL JSONB containment
            query = query.filter(Product.tags_raw.contains(filters['tags']))
        
        # Filter by price range
        if 'min_price' in filters:
            query = query.filter(Product.price >= filters['min_price'])
        if 'max_price' in filters:
            query = query.filter(Product.price <= filters['max_price'])
        
        # Filter by SKU pattern
        if 'sku_pattern' in filters:
            query = query.filter(Product.sku.like(f"%{filters['sku_pattern']}%"))
    
    # Only get products that haven't been published yet
    # (or add your own logic for republishing)
    query = query.filter(Product.etsy_listing_id == None)
    
    # Order by created date (oldest first)
    query = query.order_by(Product.created_at.asc())
    
    # Limit to prevent overwhelming the system
    query = query.limit(500)
    
    return query.all()


def calculate_next_run(schedule: Schedule, delay_minutes: int = 0) -> datetime:
    """
    Calculate the next run time based on schedule's cron expression
    
    Args:
        schedule: Schedule object
        delay_minutes: Additional delay in minutes (for retries)
        
    Returns:
        Next run datetime
    """
    now = datetime.now(timezone.utc)
    
    # Simple cron parsing (expand this for full cron support)
    # Format: "minute hour day month weekday"
    # Example: "0 */6 * * *" = every 6 hours
    
    try:
        from croniter import croniter
        
        cron = croniter(schedule.cron_expr, now)
        next_run = cron.get_next(datetime)
        
        if delay_minutes > 0:
            next_run = next_run + timedelta(minutes=delay_minutes)
        
        return next_run
        
    except ImportError:
        # Fallback if croniter not installed
        logger.warning("croniter not installed, using simple 1-hour interval")
        return now + timedelta(hours=1, minutes=delay_minutes)
    
    except Exception as e:
        logger.error(f"Error calculating next run for schedule {schedule.id}: {str(e)}")
        # Default to 1 hour from now
        return now + timedelta(hours=1, minutes=delay_minutes)


@shared_task(name="scheduled_publishing.reset_quota_statuses", bind=True, max_retries=3)
def reset_quota_statuses(self):
    """
    Periodic task to reset quota_exceeded statuses when quota becomes available
    Runs every hour
    """
    db = SessionLocal()
    try:
        # Get all schedules with quota_exceeded status
        schedules = db.query(Schedule).filter(
            Schedule.status == 'quota_exceeded'
        ).all()
        
        logger.info(f"Checking {len(schedules)} schedules with quota_exceeded status")
        
        quota_manager = QuotaManager(db)
        reset_count = 0
        
        for schedule in schedules:
            try:
                quota_manager.reset_quota_status(schedule)
                if schedule.status == 'active':
                    reset_count += 1
            except Exception as e:
                logger.error(f"Error resetting quota status for schedule {schedule.id}: {str(e)}")
        
        logger.info(f"Reset {reset_count} schedules from quota_exceeded to active")
        
    except Exception as e:
        logger.error(f"Error in reset_quota_statuses: {str(e)}", exc_info=True)
    finally:
        db.close()

