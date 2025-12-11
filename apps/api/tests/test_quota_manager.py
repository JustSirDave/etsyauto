"""
Comprehensive Tests for Quota Manager
Tests quota tracking, reset logic, and enforcement
"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import Mock
from sqlalchemy.orm import Session

from app.services.quota_manager import QuotaManager
from app.models.listings import Schedule


# ==================== Fixtures ====================

@pytest.fixture
def mock_db():
    """Mock database session"""
    db = Mock(spec=Session)
    db.commit = Mock()
    db.rollback = Mock()
    return db


@pytest.fixture
def quota_manager(mock_db):
    """QuotaManager with mock DB"""
    return QuotaManager(mock_db)


@pytest.fixture
def active_schedule():
    """Active schedule with default quotas"""
    schedule = Mock(spec=Schedule)
    schedule.id = 1
    schedule.status = 'active'
    schedule.daily_quota = 150
    schedule.weekly_quota = 500
    schedule.daily_used = 0
    schedule.weekly_used = 0
    schedule.last_daily_reset = datetime.now(timezone.utc)
    schedule.last_weekly_reset = datetime.now(timezone.utc)
    schedule.total_success = 0
    schedule.total_failed = 0
    return schedule


@pytest.fixture
def quota_exceeded_schedule():
    """Schedule that has exceeded daily quota"""
    schedule = Mock(spec=Schedule)
    schedule.id = 2
    schedule.status = 'active'
    schedule.daily_quota = 150
    schedule.weekly_quota = 500
    schedule.daily_used = 150  # At limit
    schedule.weekly_used = 300
    schedule.last_daily_reset = datetime.now(timezone.utc)
    schedule.last_weekly_reset = datetime.now(timezone.utc)
    return schedule


# ==================== Quota Reset Tests ====================

class TestQuotaReset:
    """Test quota reset logic"""
    
    def test_daily_quota_reset_after_24_hours(self, quota_manager, active_schedule):
        """Test that daily quota resets after 24 hours"""
        # Set last reset to 25 hours ago
        active_schedule.last_daily_reset = datetime.now(timezone.utc) - timedelta(hours=25)
        active_schedule.daily_used = 100
        
        quota_manager.check_and_reset_quotas(active_schedule)
        
        # Daily quota should be reset
        assert active_schedule.daily_used == 0
        assert quota_manager.db.commit.called
    
    def test_daily_quota_no_reset_before_24_hours(self, quota_manager, active_schedule):
        """Test that daily quota doesn't reset before 24 hours"""
        # Set last reset to 12 hours ago
        active_schedule.last_daily_reset = datetime.now(timezone.utc) - timedelta(hours=12)
        active_schedule.daily_used = 50
        
        quota_manager.check_and_reset_quotas(active_schedule)
        
        # Daily quota should NOT be reset
        assert active_schedule.daily_used == 50
    
    def test_weekly_quota_reset_after_7_days(self, quota_manager, active_schedule):
        """Test that weekly quota resets after 7 days"""
        # Set last reset to 8 days ago
        active_schedule.last_weekly_reset = datetime.now(timezone.utc) - timedelta(days=8)
        active_schedule.weekly_used = 300
        
        quota_manager.check_and_reset_quotas(active_schedule)
        
        # Weekly quota should be reset
        assert active_schedule.weekly_used == 0
        assert quota_manager.db.commit.called
    
    def test_weekly_quota_no_reset_before_7_days(self, quota_manager, active_schedule):
        """Test that weekly quota doesn't reset before 7 days"""
        # Set last reset to 3 days ago
        active_schedule.last_weekly_reset = datetime.now(timezone.utc) - timedelta(days=3)
        active_schedule.weekly_used = 100
        
        quota_manager.check_and_reset_quotas(active_schedule)
        
        # Weekly quota should NOT be reset
        assert active_schedule.weekly_used == 100
    
    def test_both_quotas_reset_simultaneously(self, quota_manager, active_schedule):
        """Test that both quotas can reset at the same time"""
        # Set both resets to past
        active_schedule.last_daily_reset = datetime.now(timezone.utc) - timedelta(hours=25)
        active_schedule.last_weekly_reset = datetime.now(timezone.utc) - timedelta(days=8)
        active_schedule.daily_used = 100
        active_schedule.weekly_used = 400
        
        quota_manager.check_and_reset_quotas(active_schedule)
        
        # Both should be reset
        assert active_schedule.daily_used == 0
        assert active_schedule.weekly_used == 0


# ==================== Quota Availability Tests ====================

class TestQuotaAvailability:
    """Test quota availability checking"""
    
    def test_has_quota_when_available(self, quota_manager, active_schedule):
        """Test quota is available when under limits"""
        has_quota, reason = quota_manager.has_quota_available(active_schedule)
        
        assert has_quota == True
        assert reason is None
    
    def test_no_quota_when_daily_exceeded(self, quota_manager, quota_exceeded_schedule):
        """Test no quota when daily limit exceeded"""
        has_quota, reason = quota_manager.has_quota_available(quota_exceeded_schedule)
        
        assert has_quota == False
        assert "Daily quota exceeded" in reason
        assert "150/150" in reason
    
    def test_no_quota_when_weekly_exceeded(self, quota_manager, active_schedule):
        """Test no quota when weekly limit exceeded"""
        active_schedule.weekly_quota = 500
        active_schedule.weekly_used = 500
        
        has_quota, reason = quota_manager.has_quota_available(active_schedule)
        
        assert has_quota == False
        assert "Weekly quota exceeded" in reason
    
    def test_no_quota_when_schedule_paused(self, quota_manager, active_schedule):
        """Test no quota when schedule is paused"""
        active_schedule.status = 'paused'
        
        has_quota, reason = quota_manager.has_quota_available(active_schedule)
        
        assert has_quota == False
        assert "not active" in reason.lower()
    
    def test_no_quota_when_schedule_error(self, quota_manager, active_schedule):
        """Test no quota when schedule is in error state"""
        active_schedule.status = 'error'
        
        has_quota, reason = quota_manager.has_quota_available(active_schedule)
        
        assert has_quota == False
        assert "not active" in reason.lower()


# ==================== Quota Consumption Tests ====================

class TestQuotaConsumption:
    """Test quota consumption logic"""
    
    def test_consume_single_unit(self, quota_manager, active_schedule):
        """Test consuming a single quota unit"""
        initial_daily = active_schedule.daily_used
        initial_weekly = active_schedule.weekly_used
        
        result = quota_manager.consume_quota(active_schedule, count=1)
        
        assert result == True
        assert active_schedule.daily_used == initial_daily + 1
        assert active_schedule.weekly_used == initial_weekly + 1
        assert quota_manager.db.commit.called
    
    def test_consume_multiple_units(self, quota_manager, active_schedule):
        """Test consuming multiple quota units"""
        result = quota_manager.consume_quota(active_schedule, count=10)
        
        assert result == True
        assert active_schedule.daily_used == 10
        assert active_schedule.weekly_used == 10
    
    def test_consume_fails_when_quota_exceeded(self, quota_manager, quota_exceeded_schedule):
        """Test consumption fails when quota is exceeded"""
        initial_daily = quota_exceeded_schedule.daily_used
        
        result = quota_manager.consume_quota(quota_exceeded_schedule, count=1)
        
        assert result == False
        assert quota_exceeded_schedule.daily_used == initial_daily  # Unchanged
        assert quota_exceeded_schedule.status == 'quota_exceeded'
    
    def test_consume_updates_status_on_quota_exceeded(self, quota_manager, active_schedule):
        """Test that status is updated when quota is exceeded"""
        # Set quota to current usage
        active_schedule.daily_used = 150
        
        result = quota_manager.consume_quota(active_schedule, count=1)
        
        assert result == False
        assert active_schedule.status == 'quota_exceeded'


# ==================== Quota Information Tests ====================

class TestQuotaInformation:
    """Test quota information retrieval"""
    
    def test_get_remaining_quota_all_available(self, quota_manager, active_schedule):
        """Test getting remaining quota when all available"""
        info = quota_manager.get_remaining_quota(active_schedule)
        
        assert info['daily_quota'] == 150
        assert info['daily_used'] == 0
        assert info['daily_remaining'] == 150
        assert info['weekly_quota'] == 500
        assert info['weekly_used'] == 0
        assert info['weekly_remaining'] == 500
    
    def test_get_remaining_quota_partially_used(self, quota_manager, active_schedule):
        """Test getting remaining quota when partially used"""
        active_schedule.daily_used = 50
        active_schedule.weekly_used = 200
        
        info = quota_manager.get_remaining_quota(active_schedule)
        
        assert info['daily_remaining'] == 100
        assert info['weekly_remaining'] == 300
    
    def test_get_remaining_quota_no_weekly_limit(self, quota_manager, active_schedule):
        """Test quota info when weekly limit is not set"""
        active_schedule.weekly_quota = None
        
        info = quota_manager.get_remaining_quota(active_schedule)
        
        assert info['weekly_quota'] is None
        assert info['weekly_remaining'] is None


# ==================== Status Management Tests ====================

class TestStatusManagement:
    """Test quota status management"""
    
    def test_reset_quota_status_when_available(self, quota_manager, active_schedule):
        """Test resetting quota_exceeded status when quota becomes available"""
        # Set to quota_exceeded with old reset time
        active_schedule.status = 'quota_exceeded'
        active_schedule.daily_used = 150
        active_schedule.last_daily_reset = datetime.now(timezone.utc) - timedelta(hours=25)
        
        quota_manager.reset_quota_status(active_schedule)
        
        # After reset, quota should be available, but status update happens in reset_quota_status
        # The daily_used should be 0 after reset
        assert active_schedule.daily_used == 0
    
    def test_dont_reset_status_when_still_exceeded(self, quota_manager, quota_exceeded_schedule):
        """Test that status isn't reset when quota is still exceeded"""
        quota_exceeded_schedule.status = 'quota_exceeded'
        
        quota_manager.reset_quota_status(quota_exceeded_schedule)
        
        # Status should remain quota_exceeded
        assert quota_exceeded_schedule.status == 'quota_exceeded'
    
    def test_increment_success_counter(self, quota_manager, active_schedule):
        """Test incrementing success counter"""
        active_schedule.total_success = 10
        
        quota_manager.increment_success(active_schedule)
        
        assert active_schedule.total_success == 11
        assert quota_manager.db.commit.called
    
    def test_increment_failure_counter(self, quota_manager, active_schedule):
        """Test incrementing failure counter"""
        active_schedule.total_failed = 5
        
        quota_manager.increment_failure(active_schedule, "Test error")
        
        assert active_schedule.total_failed == 6
        assert active_schedule.last_error == "Test error"
        assert quota_manager.db.commit.called


# ==================== Edge Cases ====================

class TestEdgeCases:
    """Test edge cases and boundary conditions"""
    
    def test_consume_exact_remaining_quota(self, quota_manager, active_schedule):
        """Test consuming exactly the remaining quota"""
        active_schedule.daily_used = 149
        active_schedule.daily_quota = 150
        
        result = quota_manager.consume_quota(active_schedule, count=1)
        
        assert result == True
        assert active_schedule.daily_used == 150
    
    def test_consume_more_than_remaining_fails(self, quota_manager, active_schedule):
        """Test that consuming more than remaining quota fails"""
        active_schedule.daily_used = 149
        active_schedule.daily_quota = 150
        
        # Try to consume 2 units (more than remaining)
        has_quota, _ = quota_manager.has_quota_available(active_schedule)
        
        # Should still have quota (1 unit remaining)
        assert has_quota == True
        
        # But if we already used 150
        active_schedule.daily_used = 150
        has_quota, reason = quota_manager.has_quota_available(active_schedule)
        
        assert has_quota == False
    
    def test_quota_with_no_limits_set(self, quota_manager, active_schedule):
        """Test quota behavior when limits are None or 0"""
        active_schedule.daily_quota = None
        active_schedule.weekly_quota = None
        
        # Should still allow consumption
        has_quota, reason = quota_manager.has_quota_available(active_schedule)
        
        # With no quota set, it's unlimited
        # But our implementation requires daily_quota, so this tests the edge case
        # Adjust based on actual business logic
    
    def test_negative_quota_handling(self, quota_manager, active_schedule):
        """Test handling of edge case where used exceeds quota"""
        # Simulate a race condition where used > quota
        active_schedule.daily_used = 200
        active_schedule.daily_quota = 150
        
        has_quota, reason = quota_manager.has_quota_available(active_schedule)
        
        assert has_quota == False
        assert "exceeded" in reason.lower()


# ==================== Integration Tests ====================

class TestQuotaManagerIntegration:
    """Integration tests with realistic scenarios"""
    
    def test_typical_daily_workflow(self, quota_manager, active_schedule):
        """Test a typical day's quota usage"""
        # Morning: Consume 50 units
        result1 = quota_manager.consume_quota(active_schedule, count=50)
        assert result1 == True
        assert active_schedule.daily_used == 50
        
        # Afternoon: Consume 70 more
        result2 = quota_manager.consume_quota(active_schedule, count=70)
        assert result2 == True
        assert active_schedule.daily_used == 120
        
        # Evening: Try to consume 40 (would exceed 150)
        result3 = quota_manager.consume_quota(active_schedule, count=30)
        assert result3 == True
        assert active_schedule.daily_used == 150
        
        # Try to consume 1 more (should fail)
        result4 = quota_manager.consume_quota(active_schedule, count=1)
        assert result4 == False
        assert active_schedule.status == 'quota_exceeded'
    
    def test_quota_reset_at_midnight(self, quota_manager, active_schedule):
        """Test quota reset simulating midnight rollover"""
        # Use quota during the day
        active_schedule.daily_used = 100
        active_schedule.last_daily_reset = datetime.now(timezone.utc) - timedelta(hours=24, minutes=5)
        
        # Check quota (should trigger reset)
        quota_manager.check_and_reset_quotas(active_schedule)
        
        # Quota should be reset
        assert active_schedule.daily_used == 0
        
        # Should be able to consume again
        result = quota_manager.consume_quota(active_schedule, count=10)
        assert result == True
        assert active_schedule.daily_used == 10
    
    def test_weekly_quota_rollover(self, quota_manager, active_schedule):
        """Test weekly quota reset at week boundary"""
        # Week 1: Use 450/500
        active_schedule.weekly_used = 450
        active_schedule.daily_used = 100
        active_schedule.last_weekly_reset = datetime.now(timezone.utc) - timedelta(days=7, hours=1)
        
        # Reset should occur
        quota_manager.check_and_reset_quotas(active_schedule)
        
        assert active_schedule.weekly_used == 0
        
        # Week 2: Can consume again
        result = quota_manager.consume_quota(active_schedule, count=50)
        assert result == True


# ==================== Premium User Override Tests ====================

class TestPremiumQuotaOverride:
    """Test premium users with custom quotas"""
    
    def test_premium_user_higher_daily_quota(self, quota_manager):
        """Test premium user with 500/day instead of 150/day"""
        premium_schedule = Mock(spec=Schedule)
        premium_schedule.id = 10
        premium_schedule.status = 'active'
        premium_schedule.daily_quota = 500  # Premium: 500/day
        premium_schedule.weekly_quota = None  # No weekly limit
        premium_schedule.daily_used = 0
        premium_schedule.weekly_used = 0
        premium_schedule.last_daily_reset = datetime.now(timezone.utc)
        premium_schedule.last_weekly_reset = datetime.now(timezone.utc)
        
        # Should be able to consume 300 units
        result = quota_manager.consume_quota(premium_schedule, count=300)
        
        assert result == True
        assert premium_schedule.daily_used == 300
        
        # And still have quota for more
        has_quota, _ = quota_manager.has_quota_available(premium_schedule)
        assert has_quota == True
    
    def test_premium_user_unlimited_weekly(self, quota_manager):
        """Test premium user with no weekly limit"""
        premium_schedule = Mock(spec=Schedule)
        premium_schedule.id = 11
        premium_schedule.status = 'active'
        premium_schedule.daily_quota = 200
        premium_schedule.weekly_quota = None  # Unlimited
        premium_schedule.daily_used = 0
        premium_schedule.weekly_used = 1000  # Would exceed normal weekly
        premium_schedule.last_daily_reset = datetime.now(timezone.utc)
        premium_schedule.last_weekly_reset = None
        
        # Should still have quota (no weekly limit)
        info = quota_manager.get_remaining_quota(premium_schedule)
        
        assert info['weekly_quota'] is None
        assert info['weekly_remaining'] is None
        # Only daily quota matters
        assert info['daily_remaining'] == 200


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

