"""
Basic Policy Enforcement Tests
Tests: policy blocks, remediation flow, re-check
"""
import pytest
from datetime import datetime, timezone

from app.core.database import SessionLocal
from app.models.listings import Product, ListingJob
from app.models.tenancy import Tenant
from app.services.listing_policy_checker import ListingPolicyChecker


# ==================== Test Policy Checker ====================

def test_compliant_product_passes():
    """Test that a compliant product passes policy check"""
    db = SessionLocal()
    
    try:
        # Create tenant
        tenant = Tenant(name="Test", status="active")
        db.add(tenant)
        db.commit()
        
        # Create compliant product
        product = Product(
            tenant_id=tenant.id,
            title_raw="Beautiful Handmade Necklace",
            description_raw="This handmade necklace is crafted with care and attention to detail by skilled artisans.",
            price=2999,
            quantity=10,
            tags_raw=["handmade", "jewelry"],
            source="manual"
        )
        product.title = product.title_raw
        product.description = product.description_raw
        product.tags = product.tags_raw
        db.add(product)
        db.commit()
        
        # Check policy
        checker = ListingPolicyChecker(db)
        from types import SimpleNamespace
        mock_listing = SimpleNamespace(product_id=product.id, ai_generation_id=None)
        result = checker.check_listing_compliance(mock_listing, product)
        
        assert result["can_publish"] == True
        assert result["policy_status"] in ["passed", "warning"]
        
    finally:
        # Cleanup
        db.query(Product).filter(Product.tenant_id == tenant.id).delete()
        db.query(Tenant).filter(Tenant.id == tenant.id).delete()
        db.commit()
        db.close()


def test_prohibited_terms_block():
    """Test that prohibited terms block publishing"""
    db = SessionLocal()
    
    try:
        tenant = Tenant(name="Test", status="active")
        db.add(tenant)
        db.commit()
        
        # Product with prohibited terms
        product = Product(
            tenant_id=tenant.id,
            title_raw="Replica Designer Watch",
            description_raw="Counterfeit luxury item",
            price=1000,
            quantity=1,
            source="manual"
        )
        product.title = product.title_raw
        product.description = product.description_raw
        db.add(product)
        db.commit()
        
        checker = ListingPolicyChecker(db)
        from types import SimpleNamespace
        mock_listing = SimpleNamespace(product_id=product.id, ai_generation_id=None)
        result = checker.check_listing_compliance(mock_listing, product)
        
        assert result["can_publish"] == False
        assert result["policy_status"] == "failed"
        assert len(result["policy_flags"]) > 0
        
    finally:
        db.query(Product).filter(Product.tenant_id == tenant.id).delete()
        db.query(Tenant).filter(Tenant.id == tenant.id).delete()
        db.commit()
        db.close()


def test_remediation_flow():
    """Test content update and re-check"""
    db = SessionLocal()
    
    try:
        tenant = Tenant(name="Test", status="active")
        db.add(tenant)
        db.commit()
        
        # Start with non-compliant
        product = Product(
            tenant_id=tenant.id,
            title_raw="Replica Watch",
            description_raw="Short desc",
            price=1000,
            quantity=5,
            source="manual"
        )
        product.title = product.title_raw
        product.description = product.description_raw
        db.add(product)
        db.commit()
        
        checker = ListingPolicyChecker(db)
        from types import SimpleNamespace
        mock_listing = SimpleNamespace(product_id=product.id, ai_generation_id=None)
        
        # Check - should fail
        result1 = checker.check_listing_compliance(mock_listing, product)
        assert result1["can_publish"] == False
        
        # Remediate
        product.title_raw = "Handmade Watch"
        product.description_raw = "Beautiful handmade watch crafted with care by skilled artisans. Each piece is unique."
        product.title = product.title_raw
        product.description = product.description_raw
        db.commit()
        
        # Re-check - should pass
        result2 = checker.check_listing_compliance(mock_listing, product)
        assert result2["can_publish"] == True
        
    finally:
        db.query(Product).filter(Product.tenant_id == tenant.id).delete()
        db.query(Tenant).filter(Tenant.id == tenant.id).delete()
        db.commit()
        db.close()


def test_missing_required_fields():
    """Test that missing required fields block publish"""
    db = SessionLocal()
    
    try:
        tenant = Tenant(name="Test", status="active")
        db.add(tenant)
        db.commit()
        
        # Product missing required fields
        product = Product(
            tenant_id=tenant.id,
            title_raw="",  # Empty
            description_raw="Test",
            price=None,  # Missing
            quantity=None,  # Missing
            source="manual"
        )
        product.title = product.title_raw
        product.description = product.description_raw
        db.add(product)
        db.commit()
        
        checker = ListingPolicyChecker(db)
        from types import SimpleNamespace
        mock_listing = SimpleNamespace(product_id=product.id, ai_generation_id=None)
        result = checker.check_listing_compliance(mock_listing, product)
        
        assert result["can_publish"] == False
        assert "title_empty" in result["policy_flags"]
        assert "required_missing_fields" in result["policy_flags"]
        
    finally:
        db.query(Product).filter(Product.tenant_id == tenant.id).delete()
        db.query(Tenant).filter(Tenant.id == tenant.id).delete()
        db.commit()
        db.close()


def test_title_too_long():
    """Test that titles > 140 chars are blocked"""
    db = SessionLocal()
    
    try:
        tenant = Tenant(name="Test", status="active")
        db.add(tenant)
        db.commit()
        
        long_title = "x" * 150
        product = Product(
            tenant_id=tenant.id,
            title_raw=long_title,
            description_raw="Handmade product with enough description text to pass minimum requirements.",
            price=1000,
            quantity=5,
            source="manual"
        )
        product.title = product.title_raw
        product.description = product.description_raw
        db.add(product)
        db.commit()
        
        checker = ListingPolicyChecker(db)
        from types import SimpleNamespace
        mock_listing = SimpleNamespace(product_id=product.id, ai_generation_id=None)
        result = checker.check_listing_compliance(mock_listing, product)
        
        assert result["can_publish"] == False
        assert "title_too_long" in result["policy_flags"]
        
    finally:
        db.query(Product).filter(Product.tenant_id == tenant.id).delete()
        db.query(Tenant).filter(Tenant.id == tenant.id).delete()
        db.commit()
        db.close()


def test_policy_status_on_listing_job():
    """Test ListingJob policy fields"""
    db = SessionLocal()
    
    try:
        tenant = Tenant(name="Test", status="active")
        db.add(tenant)
        db.commit()
        
        product = Product(
            tenant_id=tenant.id,
            title_raw="Test",
            description_raw="Test desc",
            price=1000,
            quantity=5,
            source="manual"
        )
        db.add(product)
        db.commit()
        
        job = ListingJob(
            tenant_id=tenant.id,
            shop_id=1,
            product_id=product.id,
            policy_status="failed",
            policy_flags=["test_flag"],
            policy_checked_at=datetime.now(timezone.utc),
            policy_block_reason="Test block",
            status="policy_blocked"
        )
        db.add(job)
        db.commit()
        
        assert job.policy_status == "failed"
        assert job.status == "policy_blocked"
        assert job.policy_block_reason is not None
        
    finally:
        db.query(ListingJob).filter(ListingJob.tenant_id == tenant.id).delete()
        db.query(Product).filter(Product.tenant_id == tenant.id).delete()
        db.query(Tenant).filter(Tenant.id == tenant.id).delete()
        db.commit()
        db.close()


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

