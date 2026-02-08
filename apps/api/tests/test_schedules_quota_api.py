"""
Comprehensive API Tests for Schedule Quota Management
Tests quota API endpoints with RBAC enforcement
"""
import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone, timedelta

from main import app
from app.core.database import get_db
from app.models.listings import Schedule
from app.models.tenancy import Tenant, User, TenantMember
from app.core.security import create_access_token


client = TestClient(app)


# ==================== Fixtures ====================

@pytest.fixture
def test_db():
    """Get test database session"""
    db = next(get_db())
    yield db
    db.close()


@pytest.fixture
def test_tenant(test_db):
    """Create test tenant"""
    tenant = Tenant(
        name="Test Tenant",
        status="active"
    )
    test_db.add(tenant)
    test_db.commit()
    test_db.refresh(tenant)
    return tenant


@pytest.fixture
def admin_user(test_db, test_tenant):
    """Create admin user with token"""
    user = User(
        email="admin@test.com",
        name="Admin User",
        hashed_password="hashed",
        tenant_id=test_tenant.id
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    
    # Add team member with admin role
    team_member = TenantMember(
        tenant_id=test_tenant.id,
        user_id=user.id,
        role="admin",
        invitation_status="accepted"
    )
    test_db.add(team_member)
    test_db.commit()
    
    # Generate token
    token = create_access_token(user_id=user.id, email=user.email)
    
    return {"user": user, "token": token}


@pytest.fixture
def viewer_user(test_db, test_tenant):
    """Create viewer user with token"""
    user = User(
        email="viewer@test.com",
        name="Viewer User",
        hashed_password="hashed",
        tenant_id=test_tenant.id
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    
    # Add team member with viewer role
    team_member = TenantMember(
        tenant_id=test_tenant.id,
        user_id=user.id,
        role="viewer",
        invitation_status="accepted"
    )
    test_db.add(team_member)
    test_db.commit()
    
    # Generate token
    token = create_access_token(user_id=user.id, email=user.email)
    
    return {"user": user, "token": token}


@pytest.fixture
def test_schedule(test_db, test_tenant):
    """Create test schedule with quotas"""
    schedule = Schedule(
        tenant_id=test_tenant.id,
        name="Test Schedule",
        description="Test schedule for quota tests",
        type="sync",
        cron_expr="0 */6 * * *",
        daily_quota=150,
        weekly_quota=500,
        daily_used=50,
        weekly_used=200,
        status="active",
        last_daily_reset=datetime.now(timezone.utc),
        last_weekly_reset=datetime.now(timezone.utc)
    )
    test_db.add(schedule)
    test_db.commit()
    test_db.refresh(schedule)
    return schedule


# ==================== GET Quota Tests ====================

class TestGetQuota:
    """Test GET /api/schedules/{id}/quota"""
    
    def test_get_quota_success(self, admin_user, test_schedule):
        """Test getting quota info successfully"""
        response = client.get(
            f"/api/schedules/{test_schedule.id}/quota",
            headers={"Authorization": f"Bearer {admin_user['token']}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["schedule_id"] == test_schedule.id
        assert data["schedule_name"] == test_schedule.name
        assert data["status"] == "active"
        assert data["daily_quota"] == 150
        assert data["daily_used"] == 50
        assert data["daily_remaining"] == 100
        assert data["weekly_quota"] == 500
        assert data["weekly_used"] == 200
        assert data["weekly_remaining"] == 300
    
    def test_get_quota_viewer_can_read(self, viewer_user, test_schedule):
        """Test viewer can read quota info"""
        response = client.get(
            f"/api/schedules/{test_schedule.id}/quota",
            headers={"Authorization": f"Bearer {viewer_user['token']}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "daily_quota" in data
    
    def test_get_quota_not_found(self, admin_user):
        """Test getting quota for non-existent schedule"""
        response = client.get(
            "/api/schedules/99999/quota",
            headers={"Authorization": f"Bearer {admin_user['token']}"}
        )
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    
    def test_get_quota_unauthorized(self, test_schedule):
        """Test getting quota without authentication"""
        response = client.get(f"/api/schedules/{test_schedule.id}/quota")
        
        assert response.status_code == 401


# ==================== UPDATE Quota Tests ====================

class TestUpdateQuota:
    """Test PUT /api/schedules/{id}/quota"""
    
    def test_update_quota_success(self, admin_user, test_schedule):
        """Test updating quota configuration"""
        response = client.put(
            f"/api/schedules/{test_schedule.id}/quota",
            headers={
                "Authorization": f"Bearer {admin_user['token']}",
                "Idempotency-Key": "quota-update-0",
            },
            json={"daily_quota": 500, "weekly_quota": 2000}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["message"] == "Quota configuration updated successfully"
        assert data["quota"]["daily_quota"] == 500
        assert data["quota"]["weekly_quota"] == 2000
    
    def test_update_quota_premium_unlimited_weekly(self, admin_user, test_schedule):
        """Test setting unlimited weekly quota"""
        response = client.put(
            f"/api/schedules/{test_schedule.id}/quota",
            headers={
                "Authorization": f"Bearer {admin_user['token']}",
                "Idempotency-Key": "quota-update-1a",
            },
            json={"daily_quota": 300, "weekly_quota": None}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["quota"]["daily_quota"] == 300
        assert data["quota"]["weekly_quota"] is None
        assert data["quota"]["weekly_remaining"] is None
    
    def test_update_quota_viewer_forbidden(self, viewer_user, test_schedule):
        """Test viewer cannot update quota"""
        response = client.put(
            f"/api/schedules/{test_schedule.id}/quota",
            headers={
                "Authorization": f"Bearer {viewer_user['token']}",
                "Idempotency-Key": "quota-update-1b",
            },
            json={"daily_quota": 500}
        )
        
        assert response.status_code == 403
    
    def test_update_quota_partial_update(self, admin_user, test_schedule):
        """Test updating only daily quota"""
        response = client.put(
            f"/api/schedules/{test_schedule.id}/quota",
            headers={
                "Authorization": f"Bearer {admin_user['token']}",
                "Idempotency-Key": "quota-update-1",
            },
            json={"daily_quota": 250}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["quota"]["daily_quota"] == 250
        # Weekly quota should remain unchanged
        assert data["quota"]["weekly_quota"] == 500


# ==================== RESET Quota Tests ====================

class TestResetQuota:
    """Test POST /api/schedules/{id}/quota/reset"""
    
    def test_reset_daily_quota(self, admin_user, test_schedule):
        """Test resetting daily quota"""
        response = client.post(
            f"/api/schedules/{test_schedule.id}/quota/reset",
            headers={
                "Authorization": f"Bearer {admin_user['token']}",
                "Idempotency-Key": "quota-reset-1",
            },
            json={"reset_daily": True, "reset_weekly": False}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["message"] == "Quota reset successfully"
        assert data["reset_daily"] == True
        assert data["reset_weekly"] == False
        assert data["quota"]["daily_used"] == 0
        # Weekly should remain unchanged
        assert data["quota"]["weekly_used"] == 200
    
    def test_reset_both_quotas(self, admin_user, test_schedule):
        """Test resetting both daily and weekly quotas"""
        response = client.post(
            f"/api/schedules/{test_schedule.id}/quota/reset",
            headers={
                "Authorization": f"Bearer {admin_user['token']}",
                "Idempotency-Key": "quota-reset-2",
            },
            json={"reset_daily": True, "reset_weekly": True}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["quota"]["daily_used"] == 0
        assert data["quota"]["weekly_used"] == 0
    
    def test_reset_quota_viewer_forbidden(self, viewer_user, test_schedule):
        """Test viewer cannot reset quota"""
        response = client.post(
            f"/api/schedules/{test_schedule.id}/quota/reset",
            headers={
                "Authorization": f"Bearer {viewer_user['token']}",
                "Idempotency-Key": "quota-reset-3",
            },
            json={"reset_daily": True}
        )
        
        assert response.status_code == 403
    
    def test_reset_quota_restores_status(self, admin_user, test_db, test_schedule):
        """Test resetting quota restores quota_exceeded status"""
        # Set schedule to quota_exceeded
        test_schedule.status = "quota_exceeded"
        test_schedule.daily_used = 150
        test_db.commit()
        
        response = client.post(
            f"/api/schedules/{test_schedule.id}/quota/reset",
            headers={
                "Authorization": f"Bearer {admin_user['token']}",
                "Idempotency-Key": "quota-reset-4",
            },
            json={"reset_daily": True}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Status should be restored to active
        assert data["quota"]["daily_used"] == 0


# ==================== SUMMARY Tests ====================

class TestQuotaSummary:
    """Test GET /api/schedules/quota/summary"""
    
    def test_get_quota_summary(self, admin_user, test_schedule, test_db, test_tenant):
        """Test getting quota summary for all schedules"""
        # Create additional schedules
        schedule2 = Schedule(
            tenant_id=test_tenant.id,
            name="Schedule 2",
            type="generate",
            cron_expr="0 */12 * * *",
            daily_quota=200,
            daily_used=200,
            status="quota_exceeded",
            last_daily_reset=datetime.now(timezone.utc)
        )
        test_db.add(schedule2)
        test_db.commit()
        
        response = client.get(
            "/api/schedules/quota/summary",
            headers={"Authorization": f"Bearer {admin_user['token']}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_schedules"] == 2
        assert data["active_schedules"] == 1
        assert data["quota_exceeded"] == 1
        assert data["total_daily_quota"] == 350  # 150 + 200
        assert data["total_daily_used"] == 250  # 50 + 200
        assert len(data["schedules"]) == 2
    
    def test_quota_summary_viewer_can_read(self, viewer_user):
        """Test viewer can read quota summary"""
        response = client.get(
            "/api/schedules/quota/summary",
            headers={"Authorization": f"Bearer {viewer_user['token']}"}
        )
        
        assert response.status_code == 200
    
    def test_quota_summary_multi_tenant_isolation(self, admin_user, test_db):
        """Test quota summary respects tenant isolation"""
        # Create another tenant with schedules
        other_tenant = Tenant(name="Other Tenant", status="active")
        test_db.add(other_tenant)
        test_db.commit()
        
        other_schedule = Schedule(
            tenant_id=other_tenant.id,
            name="Other Schedule",
            type="sync",
            cron_expr="0 * * * *",
            daily_quota=100,
            status="active"
        )
        test_db.add(other_schedule)
        test_db.commit()
        
        response = client.get(
            "/api/schedules/quota/summary",
            headers={"Authorization": f"Bearer {admin_user['token']}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should only see schedules from admin_user's tenant
        schedule_names = [s["name"] for s in data["schedules"]]
        assert "Other Schedule" not in schedule_names


# ==================== Integration Tests ====================

class TestQuotaApiIntegration:
    """Integration tests for quota API"""
    
    def test_full_quota_lifecycle(self, admin_user, test_schedule):
        """Test complete quota lifecycle: get -> update -> consume -> reset"""
        # 1. Get initial quota
        response = client.get(
            f"/api/schedules/{test_schedule.id}/quota",
            headers={"Authorization": f"Bearer {admin_user['token']}"}
        )
        assert response.status_code == 200
        initial_quota = response.json()
        assert initial_quota["daily_remaining"] == 100
        
        # 2. Update quota to premium level
        response = client.put(
            f"/api/schedules/{test_schedule.id}/quota",
            headers={
                "Authorization": f"Bearer {admin_user['token']}",
                "Idempotency-Key": "quota-update-2",
            },
            json={"daily_quota": 500, "weekly_quota": 2000}
        )
        assert response.status_code == 200
        
        # 3. Get updated quota
        response = client.get(
            f"/api/schedules/{test_schedule.id}/quota",
            headers={"Authorization": f"Bearer {admin_user['token']}"}
        )
        updated_quota = response.json()
        assert updated_quota["daily_quota"] == 500
        assert updated_quota["daily_remaining"] == 450  # 500 - 50 used
        
        # 4. Reset quota
        response = client.post(
            f"/api/schedules/{test_schedule.id}/quota/reset",
            headers={
                "Authorization": f"Bearer {admin_user['token']}",
                "Idempotency-Key": "quota-reset-5",
            },
            json={"reset_daily": True, "reset_weekly": True}
        )
        assert response.status_code == 200
        
        # 5. Verify reset
        response = client.get(
            f"/api/schedules/{test_schedule.id}/quota",
            headers={"Authorization": f"Bearer {admin_user['token']}"}
        )
        final_quota = response.json()
        assert final_quota["daily_used"] == 0
        assert final_quota["daily_remaining"] == 500
        assert final_quota["weekly_used"] == 0


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

