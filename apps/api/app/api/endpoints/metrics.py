"""
Metrics and monitoring endpoints
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, List
from app.core.database import get_db
from app.core.redis import get_redis_client
from app.models.listings import ListingJob, AuditLog
from sqlalchemy import func, and_, text
from datetime import datetime, timedelta

router = APIRouter()


@router.get("/concurrency")
def get_concurrency_metrics() -> Dict:
    """
    Get current concurrency metrics for all shops
    
    Returns counts of:
    - Active concurrent jobs per shop
    - Queued jobs per shop
    - Rate limiter token counts
    """
    redis_client = get_redis_client()
    
    # Get all shop concurrency keys
    shop_keys = redis_client.keys("shop_concurrency:*")
    
    concurrency_stats = {}
    for key in shop_keys:
        shop_id = key.decode('utf-8').split(':')[1]
        current_count = int(redis_client.get(key) or 0)
        concurrency_stats[shop_id] = {
            "active_jobs": current_count,
            "max_allowed": 3,
            "available_slots": max(0, 3 - current_count)
        }
    
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "shop_concurrency": concurrency_stats,
        "total_active_jobs": sum(s["active_jobs"] for s in concurrency_stats.values())
    }


@router.get("/rate-limits")
def get_rate_limit_metrics() -> Dict:
    """
    Get current rate limiter metrics for all shops
    
    Returns:
    - Available tokens per shop
    - Last refill time
    - Capacity info
    """
    redis_client = get_redis_client()
    
    # Get all rate limiter keys
    token_keys = redis_client.keys("rate_limit:*:tokens")
    
    rate_limit_stats = {}
    for key in token_keys:
        shop_id = key.decode('utf-8').split(':')[1]
        tokens = float(redis_client.get(key) or 0)
        
        # Get last refill time
        refill_key = f"rate_limit:{shop_id}:last_refill"
        last_refill = redis_client.get(refill_key)
        last_refill_time = float(last_refill) if last_refill else None
        
        rate_limit_stats[shop_id] = {
            "available_tokens": round(tokens, 2),
            "capacity": 10.0,  # Default capacity
            "refill_rate": 10.0,  # 10 tokens per 60 seconds
            "last_refill": datetime.fromtimestamp(last_refill_time).isoformat() if last_refill_time else None
        }
    
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "shop_rate_limits": rate_limit_stats
    }


@router.get("/pipeline-health")
def get_pipeline_health(db: Session = Depends(get_db)) -> Dict:
    """
    Get overall pipeline health metrics
    
    Returns:
    - Job status distribution
    - Average processing time
    - Error rates
    - Retry distribution
    """
    # Last 24 hours
    since = datetime.utcnow() - timedelta(hours=24)
    
    # Job status distribution
    # Note: Database uses 'state' column, not 'status'
    status_counts = db.execute(
        text("""
            SELECT state, COUNT(id) 
            FROM listing_jobs 
            WHERE created_at >= :since 
            GROUP BY state
        """),
        {"since": since}
    ).fetchall()
    
    status_distribution = {status: count for status, count in status_counts}
    
    # Retry distribution (database uses 'attempts' column)
    retry_counts = db.execute(
        text("""
            SELECT attempts, COUNT(id) 
            FROM listing_jobs 
            WHERE created_at >= :since 
            GROUP BY attempts
        """),
        {"since": since}
    ).fetchall()
    
    retry_distribution = {attempts: count for attempts, count in retry_counts}
    
    # Average processing time (completed jobs)
    # Note: Database doesn't have started_at/completed_at, so we'll skip this for now
    # Can be calculated from created_at to updated_at for done jobs
    avg_processing_time = db.execute(
        text("""
            SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)))
            FROM listing_jobs
            WHERE state = 'done'
              AND created_at >= :since
        """),
        {"since": since}
    ).scalar()
    
    # Error distribution
    error_counts = (
        db.query(ListingJob.error_code, func.count(ListingJob.id))
        .filter(
            and_(
                ListingJob.created_at >= since,
                ListingJob.error_code.isnot(None)
            )
        )
        .group_by(ListingJob.error_code)
        .all()
    )
    
    error_distribution = {error_code: count for error_code, count in error_counts}
    
    # API call latency (from audit logs)
    avg_latencies = (
        db.query(
            AuditLog.action,
            func.avg(AuditLog.latency_ms).label('avg_latency'),
            func.max(AuditLog.latency_ms).label('max_latency')
        )
        .filter(
            and_(
                AuditLog.created_at >= since,
                AuditLog.action.like('etsy.%'),
                AuditLog.latency_ms.isnot(None)
            )
        )
        .group_by(AuditLog.action)
        .all()
    )
    
    latency_stats = {
        action: {
            "avg_ms": round(avg, 2),
            "max_ms": max_val
        }
        for action, avg, max_val in avg_latencies
    }
    
    total_jobs = sum(status_distribution.values())
    # Database uses 'done' instead of 'completed'
    success_rate = (
        (status_distribution.get('done', 0) / total_jobs * 100)
        if total_jobs > 0 else 0
    )
    
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "time_window": "24h",
        "job_stats": {
            "total": total_jobs,
            "status_distribution": status_distribution,
            "success_rate": round(success_rate, 2),
            "retry_distribution": retry_distribution
        },
        "performance": {
            "avg_processing_time_seconds": round(avg_processing_time or 0, 2),
            "api_latencies": latency_stats
        },
        "errors": {
            "distribution": error_distribution,
            "total_errors": sum(error_distribution.values())
        }
    }


@router.get("/idempotency-stats")
def get_idempotency_stats() -> Dict:
    """
    Get idempotency cache statistics
    
    Returns:
    - Total cached results
    - Cache hit rate estimate
    """
    redis_client = get_redis_client()
    
    # Count idempotency keys
    idempotency_keys = redis_client.keys("idempotency:listing:*")
    
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "cached_results": len(idempotency_keys),
        "ttl_hours": 24,
        "cache_size_estimate_kb": len(idempotency_keys) * 0.5  # Rough estimate
    }

