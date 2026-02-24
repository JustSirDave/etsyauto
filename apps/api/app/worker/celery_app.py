"""
Celery Application Configuration
Background task worker for async operations
"""
from celery import Celery
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Create Celery app
celery_app = Celery(
    "etsy_automation",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.worker.tasks.listing_tasks",
        "app.worker.tasks.order_tasks",
        "app.worker.tasks.schedule_tasks",
        "app.worker.tasks.token_tasks",
        "app.worker.tasks.ingestion_tasks",
        "app.worker.tasks.scheduled_publishing",
        "app.worker.tasks.audit_cleanup",
        "app.worker.tasks.product_sync_tasks",
        "app.worker.tasks.financial_tasks",
        "app.worker.tasks.exchange_rate_tasks",
    ]
)

# Setup Celery metrics collection
try:
    from app.observability.celery_metrics import setup_celery_metrics
    setup_celery_metrics(celery_app)
    logger.info("✅ Celery metrics enabled")
except ImportError as e:
    logger.warning(f"⚠️ Celery metrics not available: {e}")

# Setup Celery Sentry integration
try:
    from app.core.sentry_config import initialize_sentry
    from app.observability.celery_sentry import setup_celery_sentry
    initialize_sentry()
    setup_celery_sentry(celery_app)
    logger.info("✅ Celery Sentry integration enabled")
except ImportError as e:
    logger.warning(f"⚠️ Celery Sentry not available: {e}")

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max per task
    task_soft_time_limit=240,  # Soft limit at 4 minutes
    worker_prefetch_multiplier=1,  # One task at a time for rate limiting
    worker_max_tasks_per_child=1000,  # Restart worker after 1000 tasks
    task_acks_late=True,  # Acknowledge task after completion
    task_reject_on_worker_lost=True,
    result_expires=3600,  # Results expire after 1 hour
)

# Periodic tasks (Celery Beat schedule)
celery_app.conf.beat_schedule = {
    "refresh-tokens-every-hour": {
        "task": "app.worker.tasks.token_tasks.refresh_expiring_tokens",
        "schedule": 3600.0,  # Every hour
    },
    "run-scheduled-listings-every-5-minutes": {
        "task": "app.worker.tasks.schedule_tasks.process_scheduled_listings",
        "schedule": 300.0,  # Every 5 minutes
    },
    "process-schedules-every-minute": {
        "task": "scheduled_publishing.process_schedules",
        "schedule": 60.0,  # Every minute
    },
    "reset-quota-statuses-hourly": {
        "task": "scheduled_publishing.reset_quota_statuses",
        "schedule": 3600.0,  # Every hour
    },
    "cleanup-old-audit-logs-daily": {
        "task": "audit.cleanup_old_logs",
        "schedule": 86400.0,  # Every 24 hours (daily at midnight UTC)
    },
    "sync-orders-every-15-minutes": {
        "task": "app.worker.tasks.order_tasks.sync_orders",
        "schedule": 900.0,  # Every 15 minutes
    },
    "reconcile-orders-hourly": {
        "task": "app.worker.tasks.order_tasks.reconcile_orders",
        "schedule": 3600.0,  # Every hour
    },
    "sync-ledger-entries-every-6-hours": {
        "task": "app.worker.tasks.financial_tasks.sync_ledger_entries",
        "schedule": 21600.0,  # Every 6 hours
    },
    "sync-payment-details-every-3-hours": {
        "task": "app.worker.tasks.financial_tasks.sync_payment_details",
        "schedule": 10800.0,  # Every 3 hours
    },
    "fetch-daily-exchange-rates": {
        "task": "app.worker.tasks.exchange_rate_tasks.fetch_daily_exchange_rates",
        "schedule": 86400.0,  # Every 24 hours (daily)
    },
}
