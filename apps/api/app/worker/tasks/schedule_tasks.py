"""
Celery Tasks for Schedule Management
Handles automated listing publication based on schedules
"""
import logging
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List

from app.worker.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.listings import Schedule, ListingJob, Product, AIGeneration
from app.models.tenancy import Shop
from app.worker.tasks.listing_tasks import publish_listing

logger = logging.getLogger(__name__)


@celery_app.task(name="app.worker.tasks.schedule_tasks.process_scheduled_listings", max_retries=3)
def process_scheduled_listings() -> Dict[str, Any]:
    """
    Periodic task to process schedules and create listing jobs.

    Runs every 5 minutes and:
    1. Finds active schedules due to run
    2. Checks daily quota
    3. Creates listing jobs for ready products
    4. Triggers publish_listing tasks

    Returns:
        dict: Summary of processing
    """
    db = SessionLocal()

    try:
        now = datetime.now(timezone.utc)

        # Find active schedules that are due to run
        active_schedules = (
            db.query(Schedule)
            .filter(
                Schedule.status == "active",
                # Either never run before, or next_run_at is in the past
                (Schedule.next_run_at == None) | (Schedule.next_run_at <= now)
            )
            .all()
        )

        results = {
            "schedules_processed": 0,
            "jobs_created": 0,
            "jobs_triggered": 0,
            "errors": []
        }

        logger.info(f"Processing {len(active_schedules)} active schedules")

        for schedule in active_schedules:
            try:
                # Process this schedule
                schedule_result = _process_schedule(db, schedule)

                results["schedules_processed"] += 1
                results["jobs_created"] += schedule_result["jobs_created"]
                results["jobs_triggered"] += schedule_result["jobs_triggered"]

            except Exception as e:
                logger.exception(f"Error processing schedule {schedule.id}: {e}")
                results["errors"].append({
                    "schedule_id": schedule.id,
                    "error": str(e)
                })

        logger.info(
            f"Schedule processing complete: {results['schedules_processed']} schedules, "
            f"{results['jobs_created']} jobs created, {results['jobs_triggered']} jobs triggered"
        )

        return results

    finally:
        db.close()


def _process_schedule(db, schedule: Schedule) -> Dict[str, Any]:
    """
    Process a single schedule and create listing jobs.

    Args:
        db: Database session
        schedule: Schedule to process

    Returns:
        dict: Result summary
    """
    now = datetime.now(timezone.utc)

    result = {
        "jobs_created": 0,
        "jobs_triggered": 0
    }

    # Check today's quota usage
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    jobs_today = (
        db.query(ListingJob)
        .filter(
            ListingJob.shop_id == schedule.shop_id,
            ListingJob.created_at >= today_start,
            ListingJob.status.in_(["pending", "processing", "completed"])
        )
        .count()
    )

    remaining_quota = schedule.daily_quota - jobs_today

    if remaining_quota <= 0:
        logger.info(f"Schedule {schedule.id} has reached daily quota ({schedule.daily_quota})")
        # Update next run to tomorrow
        schedule.next_run_at = _calculate_next_run(schedule, now)
        db.commit()
        return result

    # Get shop
    shop = db.query(Shop).filter(Shop.id == schedule.shop_id).first()
    if not shop or shop.status != "connected":
        logger.warning(f"Shop {schedule.shop_id} not connected, skipping schedule {schedule.id}")
        return result

    # Find ready products (those with approved AI generation)
    ready_products = (
        db.query(Product)
        .join(AIGeneration, AIGeneration.product_id == Product.id)
        .filter(
            Product.tenant_id == shop.tenant_id,
            Product.status == "ready",
            AIGeneration.status == "approved"
        )
        .limit(remaining_quota)
        .all()
    )

    if not ready_products:
        logger.info(f"No ready products found for schedule {schedule.id}")
        # Update next run
        schedule.next_run_at = _calculate_next_run(schedule, now)
        schedule.last_run_at = now
        db.commit()
        return result

    # Create listing jobs
    for product in ready_products:
        # Check if product already has a pending/processing job
        existing_job = (
            db.query(ListingJob)
            .filter(
                ListingJob.product_id == product.id,
                ListingJob.shop_id == shop.id,
                ListingJob.status.in_(["pending", "processing", "scheduled"])
            )
            .first()
        )

        if existing_job:
            logger.info(f"Product {product.id} already has a pending job, skipping")
            continue

        # Generate idempotency key for this job
        # Format: {tenant_id}:{shop_id}:{product_id}:{timestamp_hash}
        timestamp_component = datetime.now(timezone.utc).isoformat()
        idempotency_key = hashlib.sha256(
            f"{shop.tenant_id}:{shop.id}:{product.id}:{timestamp_component}".encode()
        ).hexdigest()[:32]  # First 32 chars of hash
        
        # Create new listing job
        job = ListingJob(
            tenant_id=shop.tenant_id,
            product_id=product.id,
            shop_id=shop.id,
            idempotency_key=idempotency_key,
            status="pending",
            retry_count=0
        )
        db.add(job)
        db.flush()  # Get job ID

        result["jobs_created"] += 1

        # Trigger publish task
        try:
            publish_listing.delay(job.id)
            result["jobs_triggered"] += 1
            logger.info(f"Created and triggered job {job.id} for product {product.id}")
        except Exception as e:
            logger.error(f"Failed to trigger job {job.id}: {e}")
            job.status = "failed"
            job.error_message = f"Failed to queue: {str(e)}"

    # Update schedule
    schedule.last_run_at = now
    schedule.next_run_at = _calculate_next_run(schedule, now)
    db.commit()

    logger.info(
        f"Schedule {schedule.id} processed: {result['jobs_created']} jobs created, "
        f"{result['jobs_triggered']} triggered"
    )

    return result


def _calculate_next_run(schedule: Schedule, current_time: datetime) -> datetime:
    """
    Calculate the next run time for a schedule based on cron_expr.

    Args:
        schedule: Schedule instance
        current_time: Current datetime

    Returns:
        datetime: Next run time
    """
    try:
        from croniter import croniter

        now = current_time.replace(tzinfo=timezone.utc) if current_time.tzinfo is None else current_time
        cron = croniter(schedule.cron_expr, now)
        next_run = cron.get_next(datetime)
        return next_run.replace(tzinfo=timezone.utc) if next_run.tzinfo is None else next_run
    except ImportError:
        logger.warning("croniter not installed, using simple 1-hour interval")
        return current_time + timedelta(hours=1)
    except Exception as e:
        logger.error(f"Error calculating next run for schedule {schedule.id}: {e}")
        return current_time + timedelta(hours=1)


@celery_app.task(name="app.worker.tasks.schedule_tasks.trigger_schedule_now", max_retries=3)
def trigger_schedule_now(schedule_id: int) -> Dict[str, Any]:
    """
    Manually trigger a schedule to run immediately.

    Args:
        schedule_id: ID of the schedule to trigger

    Returns:
        dict: Result of trigger
    """
    db = SessionLocal()

    try:
        schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()

        if not schedule:
            return {
                "success": False,
                "error": "Schedule not found"
            }

        if schedule.status != "active":
            return {
                "success": False,
                "error": "Schedule is not active"
            }

        result = _process_schedule(db, schedule)

        return {
            "success": True,
            "schedule_id": schedule_id,
            "jobs_created": result["jobs_created"],
            "jobs_triggered": result["jobs_triggered"]
        }

    except Exception as e:
        logger.exception(f"Error triggering schedule {schedule_id}: {e}")
        return {
            "success": False,
            "error": str(e)
        }

    finally:
        db.close()
