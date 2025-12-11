"""
Quota Manager
Tracks and enforces daily/weekly quotas for scheduled tasks
"""
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from typing import Tuple, Optional

from app.models.listings import Schedule

logger = logging.getLogger(__name__)


class QuotaManager:
    """Manages quota tracking and enforcement for schedules"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def check_and_reset_quotas(self, schedule: Schedule) -> None:
        """
        Check if quotas need to be reset based on time elapsed
        
        Args:
            schedule: Schedule object to check
        """
        now = datetime.now(timezone.utc)
        updated = False
        
        # Check daily reset (24 hours)
        if schedule.last_daily_reset:
            hours_since_daily_reset = (now - schedule.last_daily_reset.replace(tzinfo=timezone.utc)).total_seconds() / 3600
            if hours_since_daily_reset >= 24:
                logger.info(f"Resetting daily quota for schedule {schedule.id}")
                schedule.daily_used = 0
                schedule.last_daily_reset = now
                updated = True
        else:
            schedule.last_daily_reset = now
            updated = True
        
        # Check weekly reset (7 days)
        if schedule.weekly_quota and schedule.last_weekly_reset:
            days_since_weekly_reset = (now - schedule.last_weekly_reset.replace(tzinfo=timezone.utc)).total_seconds() / 86400
            if days_since_weekly_reset >= 7:
                logger.info(f"Resetting weekly quota for schedule {schedule.id}")
                schedule.weekly_used = 0
                schedule.last_weekly_reset = now
                updated = True
        elif schedule.weekly_quota and not schedule.last_weekly_reset:
            schedule.last_weekly_reset = now
            updated = True
        
        if updated:
            self.db.commit()
    
    def has_quota_available(self, schedule: Schedule) -> Tuple[bool, Optional[str]]:
        """
        Check if schedule has quota available
        
        Args:
            schedule: Schedule to check
            
        Returns:
            Tuple of (has_quota, reason_if_not)
        """
        # First, reset quotas if needed
        self.check_and_reset_quotas(schedule)
        
        # Check if schedule is enabled
        if not schedule.status == 'active':
            return False, f"Schedule is not active (status: {schedule.status})"
        
        # Check daily quota
        if schedule.daily_quota and schedule.daily_used >= schedule.daily_quota:
            return False, f"Daily quota exceeded ({schedule.daily_used}/{schedule.daily_quota})"
        
        # Check weekly quota
        if schedule.weekly_quota and schedule.weekly_used >= schedule.weekly_quota:
            return False, f"Weekly quota exceeded ({schedule.weekly_used}/{schedule.weekly_quota})"
        
        return True, None
    
    def consume_quota(self, schedule: Schedule, count: int = 1) -> bool:
        """
        Consume quota units for a schedule
        
        Args:
            schedule: Schedule to consume quota from
            count: Number of units to consume
            
        Returns:
            True if quota was consumed, False if not enough quota
        """
        # Check if we have enough quota
        has_quota, reason = self.has_quota_available(schedule)
        
        if not has_quota:
            logger.warning(f"Cannot consume quota for schedule {schedule.id}: {reason}")
            
            # Update schedule status if quota exceeded
            if "quota exceeded" in reason.lower():
                schedule.status = 'quota_exceeded'
                self.db.commit()
            
            return False
        
        # Consume the quota
        schedule.daily_used += count
        if schedule.weekly_quota:
            schedule.weekly_used += count
        
        logger.info(f"Consumed {count} quota units for schedule {schedule.id}. "
                   f"Daily: {schedule.daily_used}/{schedule.daily_quota}, "
                   f"Weekly: {schedule.weekly_used}/{schedule.weekly_quota or 'N/A'}")
        
        self.db.commit()
        return True
    
    def get_remaining_quota(self, schedule: Schedule) -> dict:
        """
        Get remaining quota information
        
        Args:
            schedule: Schedule to check
            
        Returns:
            Dictionary with quota information
        """
        self.check_and_reset_quotas(schedule)
        
        daily_remaining = schedule.daily_quota - schedule.daily_used if schedule.daily_quota else None
        weekly_remaining = (schedule.weekly_quota - schedule.weekly_used) if schedule.weekly_quota else None
        
        return {
            "daily_quota": schedule.daily_quota,
            "daily_used": schedule.daily_used,
            "daily_remaining": daily_remaining,
            "weekly_quota": schedule.weekly_quota,
            "weekly_used": schedule.weekly_used,
            "weekly_remaining": weekly_remaining,
            "last_daily_reset": schedule.last_daily_reset.isoformat() if schedule.last_daily_reset else None,
            "last_weekly_reset": schedule.last_weekly_reset.isoformat() if schedule.last_weekly_reset else None,
        }
    
    def reset_quota_status(self, schedule: Schedule) -> None:
        """
        Reset schedule status from quota_exceeded to active if quota is available
        
        Args:
            schedule: Schedule to reset
        """
        if schedule.status == 'quota_exceeded':
            has_quota, _ = self.has_quota_available(schedule)
            if has_quota:
                logger.info(f"Resetting quota_exceeded status for schedule {schedule.id}")
                schedule.status = 'active'
                self.db.commit()
    
    def increment_success(self, schedule: Schedule) -> None:
        """Increment success counter"""
        schedule.total_success = (schedule.total_success or 0) + 1
        self.db.commit()
    
    def increment_failure(self, schedule: Schedule, error_message: Optional[str] = None) -> None:
        """Increment failure counter and update error"""
        schedule.total_failed = (schedule.total_failed or 0) + 1
        if error_message:
            schedule.last_error = error_message
        self.db.commit()


def get_quota_manager(db: Session) -> QuotaManager:
    """Factory function to get QuotaManager instance"""
    return QuotaManager(db)

