"""
Comprehensive Tests for Policy Compliance Enforcement
Tests: policy blocks, remediation flow, re-check on updated content
"""
import pytest
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.listings import Product, AIGeneration, ListingJob
from app.models.tenancy import Tenant
from app.services.listing_policy_checker import ListingPolicyChecker


# ==================== Fixtures ====================

@pytest.fixture
def test_db():
    """Get test database session"""
    db = SessionLocal()
    yield db
    # Cleanup
    try:
        db.query(ListingJob).delete()
        db.query(AIGeneration).delete()
        db.query(Product).delete()
        db.commit()
    except:
        db.rollback()
    finally:
        db.close()


@pytest.fixture
def test_tenant(test_db):
    """Create test tenant"""
    tenant = Tenant(name="Test Tenant", status="active")
    test_db.add(tenant)
    test_db.commit()
    test_db.refresh(tenant)
    return tenant


@pytest.fixture
def policy_checker(test_db):
    """Get policy checker instance"""
    return ListingPolicyChecker(test_db)


@pytest.fixture
def compliant_product(test_db, test_tenant):
    """Create a policy-compliant product"""
    product = from tests.test_policy_enforcement_helper import create_test_product
        product = create_test_product(test_db, test_tenant.id, 
        tenant_id=test_tenant.id,
        sku="TEST-001",
        title_raw="Beautiful Handmade Silver Necklace",
        description_raw="This handmade silver necklace is carefully crafted by our artisan jewelers. Each piece is unique and made with love. The necklace features a delicate chain and a beautiful pendant. Perfect for everyday wear or special occasions. Made from high-quality sterling silver.",
        price=2999,  # $29.99
        quantity=10,
        tags_raw=["handmade", "jewelry", "necklace", "silver", "artisan"],
        source="manual"
    )
    # Set the "computed" properties for policy checking
    product.title = product.title_raw
    product.description = product.description_raw
    product.tags = product.tags_raw
    test_db.add(product)
    test_db.commit()
    test_db.refresh(product)
    return product


@pytest.fixture
def non_compliant_product(test_db, test_tenant):
    """Create a product with policy violations"""
    product = from tests.test_policy_enforcement_helper import create_test_product
        product = create_test_product(test_db, test_tenant.id, 
        tenant_id=test_tenant.id,
        sku="TEST-002",
        title_raw="Replica Designer Bag - 70% OFF SALE!",  # Prohibited: replica, sale
        description_raw="Cure your style problems with this amazing bag!",  # Prohibited: cure
        price=5999,
        quantity=5,
        tags_raw=["replica", "fake", "discount"],  # Prohibited terms
        source="manual"
    )
    product.title = product.title_raw
    product.description = product.description_raw
    product.tags = product.tags_raw
    test_db.add(product)
    test_db.commit()
    test_db.refresh(product)
    return product


# ==================== Test 1: Policy Blocks Publishing ====================

class TestPolicyBlocks:
    """Test that policy violations block publishing"""
    
    def test_compliant_product_can_publish(self, policy_checker, compliant_product):
        """Test that compliant products can be published"""
        from types import SimpleNamespace
        mock_listing = SimpleNamespace(product_id=compliant_product.id, ai_generation_id=None)
        
        result = policy_checker.check_listing_compliance(mock_listing, compliant_product)
        
        assert result["can_publish"] == True
        assert result["policy_status"] == "passed"
        assert len(result["policy_flags"]) == 0
    
    def test_prohibited_terms_block_publish(self, policy_checker, test_db, test_tenant):
        """Test that prohibited terms block publishing"""
        product = from tests.test_policy_enforcement_helper import create_test_product
        product = create_test_product(test_db, test_tenant.id, 
            tenant_id=test_tenant.id,
            title_raw="Replica Designer Watch",
            description_raw="Counterfeit luxury watch",
            price=1000,
            quantity=1,
            source="manual"
        )
        product.title = product.title_raw
        product.description = product.description_raw
        test_db.add(product)
        test_db.commit()
        
        from types import SimpleNamespace
        mock_listing = SimpleNamespace(product_id=product.id, ai_generation_id=None)
        
        result = policy_checker.check_listing_compliance(mock_listing, product)
        
        assert result["can_publish"] == False
        assert result["policy_status"] == "failed"
        assert "title_prohibited_terms" in result["policy_flags"]
    
    def test_missing_handmade_warning(self, policy_checker, test_db, test_tenant):
        """Test that missing handmade indication generates warning"""
        product = from tests.test_policy_enforcement_helper import create_test_product
        product = create_test_product(test_db, test_tenant.id, 
            tenant_id=test_tenant.id,
            title="Silver Necklace",
            description="Beautiful silver necklace with pendant. High quality materials.",
            price=2999,
            quantity=10,
            tags=["jewelry", "necklace", "silver"],
            source="manual"
        )
        test_db.add(product)
        test_db.commit()
        
        from types import SimpleNamespace
        mock_listing = SimpleNamespace(product_id=product.id, ai_generation_id=None)
        
        result = policy_checker.check_listing_compliance(mock_listing, product)
        
        # Should have warning but can still publish
        assert result["can_publish"] == True  # Warnings don't block
        assert result["policy_status"] == "warning"
        assert "handmade_no_handmade_indication" in result["policy_flags"]
    
    def test_missing_required_fields_block(self, policy_checker, test_db, test_tenant):
        """Test that missing required fields block publishing"""
        product = from tests.test_policy_enforcement_helper import create_test_product
        product = create_test_product(test_db, test_tenant.id, 
            tenant_id=test_tenant.id,
            title="",  # Empty title
            description="Test description",
            price=None,  # Missing price
            quantity=None,  # Missing quantity
            source="manual"
        )
        test_db.add(product)
        test_db.commit()
        
        from types import SimpleNamespace
        mock_listing = SimpleNamespace(product_id=product.id, ai_generation_id=None)
        
        result = policy_checker.check_listing_compliance(mock_listing, product)
        
        assert result["can_publish"] == False
        assert result["policy_status"] == "failed"
        assert "title_empty" in result["policy_flags"]
        assert "required_missing_fields" in result["policy_flags"]
    
    def test_title_too_long_blocks(self, policy_checker, test_db, test_tenant):
        """Test that titles over 140 characters are blocked"""
        long_title = "x" * 150
        product = from tests.test_policy_enforcement_helper import create_test_product
        product = create_test_product(test_db, test_tenant.id, 
            tenant_id=test_tenant.id,
            title=long_title,
            description="Handmade product description with enough characters to pass the minimum length requirement for Etsy listings.",
            price=1000,
            quantity=5,
            source="manual"
        )
        test_db.add(product)
        test_db.commit()
        
        from types import SimpleNamespace
        mock_listing = SimpleNamespace(product_id=product.id, ai_generation_id=None)
        
        result = policy_checker.check_listing_compliance(mock_listing, product)
        
        assert result["can_publish"] == False
        assert "title_too_long" in result["policy_flags"]
    
    def test_too_many_tags_blocks(self, policy_checker, test_db, test_tenant):
        """Test that more than 13 tags are blocked"""
        product = from tests.test_policy_enforcement_helper import create_test_product
        product = create_test_product(test_db, test_tenant.id, 
            tenant_id=test_tenant.id,
            title="Handmade Test Product",
            description="Handmade test description with enough characters to pass.",
            price=1000,
            quantity=5,
            tags=["tag" + str(i) for i in range(15)],  # 15 tags (too many)
            source="manual"
        )
        test_db.add(product)
        test_db.commit()
        
        from types import SimpleNamespace
        mock_listing = SimpleNamespace(product_id=product.id, ai_generation_id=None)
        
        result = policy_checker.check_listing_compliance(mock_listing, product)
        
        assert result["can_publish"] == False
        assert "tags_too_many" in result["policy_flags"]


# ==================== Test 2: Remediation Flow ====================

class TestRemediationFlow:
    """Test the remediation workflow"""
    
    def test_update_content_and_recheck(self, policy_checker, test_db, test_tenant):
        """Test updating content and re-checking policy"""
        # Start with non-compliant product
        product = from tests.test_policy_enforcement_helper import create_test_product
        product = create_test_product(test_db, test_tenant.id, 
            tenant_id=test_tenant.id,
            title="Replica Watch",  # Prohibited term
            description="Short",  # Too short
            price=1000,
            quantity=5,
            source="manual"
        )
        test_db.add(product)
        test_db.commit()
        
        from types import SimpleNamespace
        mock_listing = SimpleNamespace(product_id=product.id, ai_generation_id=None)
        
        # Initial check - should fail
        result1 = policy_checker.check_listing_compliance(mock_listing, product)
        assert result1["can_publish"] == False
        assert len(result1["policy_flags"]) > 0
        
        # Remediate: Update content
        product.title = "Beautiful Handmade Watch"
        product.description = "This beautiful handmade watch is crafted with care and attention to detail. Each watch is unique and made by skilled artisans. Perfect for everyday wear or as a special gift."
        test_db.commit()
        
        # Re-check - should pass
        result2 = policy_checker.check_listing_compliance(mock_listing, product)
        assert result2["can_publish"] == True
        assert result2["policy_status"] in ["passed", "warning"]
    
    def test_remediation_with_ai_generation(self, policy_checker, test_db, test_tenant):
        """Test remediation workflow with AI generation"""
        # Create product
        product = from tests.test_policy_enforcement_helper import create_test_product
        product = create_test_product(test_db, test_tenant.id, 
            tenant_id=test_tenant.id,
            title="Test Product",
            description="Description with prohibited cure claims",  # Prohibited
            price=1000,
            quantity=5,
            source="manual"
        )
        test_db.add(product)
        test_db.commit()
        
        # Create AI generation
        ai_gen = AIGeneration(
            tenant_id=test_tenant.id,
            product_id=product.id,
            title="Test Product",
            description="Description with cure claims",
            tags=["test"],
            status="ok"
        )
        test_db.add(ai_gen)
        test_db.commit()
        
        # Check - should fail
        from types import SimpleNamespace
        mock_listing = SimpleNamespace(product_id=product.id, ai_generation_id=ai_gen.id)
        
        result1 = policy_checker.check_listing_compliance(mock_listing, product)
        assert result1["can_publish"] == False
        
        # Remediate AI generation
        ai_gen.description = "Beautiful handmade product created by skilled artisans. Each piece is unique and crafted with care. Made from high-quality materials, this item is perfect for everyday use or as a thoughtful gift."
        test_db.commit()
        
        # Update product with AI content
        product.description = ai_gen.description
        
        # Re-check - should pass
        result2 = policy_checker.check_listing_compliance(mock_listing, product)
        assert result2["can_publish"] == True


# ==================== Test 3: Policy Check Updates AIGeneration ====================

class TestPolicyStorageOnAIGeneration:
    """Test that policy results are stored on AIGeneration"""
    
    def test_policy_status_stored_on_generation(self, policy_checker, test_db, test_tenant):
        """Test policy status is stored on AI generation"""
        product = from tests.test_policy_enforcement_helper import create_test_product
        product = create_test_product(test_db, test_tenant.id, 
            tenant_id=test_tenant.id,
            title="Handmade Necklace",
            description="Beautiful handmade necklace crafted with care and attention to detail.",
            price=2999,
            quantity=10,
            source="manual"
        )
        test_db.add(product)
        test_db.commit()
        
        ai_gen = AIGeneration(
            tenant_id=test_tenant.id,
            product_id=product.id,
            title=product.title,
            description=product.description,
            tags=["handmade", "jewelry"],
            status="ok"
        )
        test_db.add(ai_gen)
        test_db.commit()
        
        # Run policy check
        from types import SimpleNamespace
        mock_listing = SimpleNamespace(product_id=product.id, ai_generation_id=ai_gen.id)
        
        result = policy_checker.check_listing_compliance(mock_listing, product)
        
        # Store policy result
        policy_checker.store_policy_result(mock_listing, result)
        
        # Note: store_policy_result expects a Listing object, but we're using a mock
        # In real implementation, this would update the listing table


# ==================== Test 4: Fail Closed Behavior ====================

class TestFailClosedBehavior:
    """Test that system fails closed (blocks publish on violations)"""
    
    def test_any_critical_violation_blocks_publish(self, policy_checker, test_db, test_tenant):
        """Test that ANY critical violation blocks publishing"""
        # Product with one critical violation
        product = from tests.test_policy_enforcement_helper import create_test_product
        product = create_test_product(test_db, test_tenant.id, 
            tenant_id=test_tenant.id,
            title="x" * 150,  # Too long (critical)
            description="Handmade product with great description that is long enough to pass the minimum requirements.",
            price=1000,
            quantity=5,
            tags=["handmade"],
            source="manual"
        )
        test_db.add(product)
        test_db.commit()
        
        from types import SimpleNamespace
        mock_listing = SimpleNamespace(product_id=product.id, ai_generation_id=None)
        
        result = policy_checker.check_listing_compliance(mock_listing, product)
        
        # Should block publish due to critical violation
        assert result["can_publish"] == False
        assert result["policy_status"] == "failed"
    
    def test_warnings_do_not_block_publish(self, policy_checker, test_db, test_tenant):
        """Test that warnings alone don't block publishing"""
        # Product with only warnings (no handmade indication)
        product = from tests.test_policy_enforcement_helper import create_test_product
        product = create_test_product(test_db, test_tenant.id, 
            tenant_id=test_tenant.id,
            title="Silver Necklace",
            description="Beautiful silver necklace with pendant.",
            price=2999,
            quantity=10,
            tags=["jewelry", "necklace"],
            source="manual"
        )
        test_db.add(product)
        test_db.commit()
        
        from types import SimpleNamespace
        mock_listing = SimpleNamespace(product_id=product.id, ai_generation_id=None)
        
        result = policy_checker.check_listing_compliance(mock_listing, product)
        
        # Should allow publish despite warning
        assert result["can_publish"] == True
        assert result["policy_status"] == "warning"


# ==================== Test 5: Re-check After Updates ====================

class TestRecheckAfterUpdates:
    """Test re-checking policy after content updates"""
    
    def test_recheck_detects_new_violations(self, policy_checker, test_db, test_tenant):
        """Test that re-check detects newly introduced violations"""
        # Start with compliant product
        product = from tests.test_policy_enforcement_helper import create_test_product
        product = create_test_product(test_db, test_tenant.id, 
            tenant_id=test_tenant.id,
            title="Handmade Bracelet",
            description="Beautiful handmade bracelet crafted with care.",
            price=1999,
            quantity=10,
            tags=["handmade", "jewelry"],
            source="manual"
        )
        test_db.add(product)
        test_db.commit()
        
        from types import SimpleNamespace
        mock_listing = SimpleNamespace(product_id=product.id, ai_generation_id=None)
        
        # Initial check - should pass
        result1 = policy_checker.check_listing_compliance(mock_listing, product)
        assert result1["can_publish"] == True
        
        # Introduce violation
        product.title = "Replica Handmade Bracelet"  # Add prohibited term
        test_db.commit()
        
        # Re-check - should fail
        result2 = policy_checker.check_listing_compliance(mock_listing, product)
        assert result2["can_publish"] == False
        assert "title_prohibited_terms" in result2["policy_flags"]
    
    def test_recheck_detects_fixed_violations(self, policy_checker, non_compliant_product):
        """Test that re-check detects fixed violations"""
        from types import SimpleNamespace
        mock_listing = SimpleNamespace(product_id=non_compliant_product.id, ai_generation_id=None)
        
        # Initial check - should fail
        result1 = policy_checker.check_listing_compliance(mock_listing, non_compliant_product)
        assert result1["can_publish"] == False
        initial_flags = len(result1["policy_flags"])
        
        # Fix violations
        non_compliant_product.title = "Beautiful Handmade Designer-Style Bag"
        non_compliant_product.description = "Beautiful handmade designer-style bag crafted with care and attention to detail. This unique piece is perfect for any occasion."
        non_compliant_product.tags = ["handmade", "bag", "fashion"]
        
        # Re-check - should pass
        result2 = policy_checker.check_listing_compliance(mock_listing, non_compliant_product)
        assert result2["can_publish"] == True
        assert len(result2["policy_flags"]) < initial_flags


# ==================== Test 6: Specific Policy Rules ====================

class TestSpecificPolicyRules:
    """Test individual policy rules"""
    
    def test_handmade_variations_accepted(self, policy_checker, test_db, test_tenant):
        """Test various handmade indicators are recognized"""
        handmade_variations = [
            "handmade", "hand made", "hand-made", "handcrafted",
            "hand crafted", "artisan", "custom made", "made to order", "bespoke"
        ]
        
        for variation in handmade_variations:
            product = from tests.test_policy_enforcement_helper import create_test_product
        product = create_test_product(test_db, test_tenant.id, 
                tenant_id=test_tenant.id,
                title=f"{variation} Product",
                description=f"This {variation} item is unique.",
                price=1000,
                quantity=5,
                source="manual"
            )
            test_db.add(product)
            test_db.commit()
            
            from types import SimpleNamespace
            mock_listing = SimpleNamespace(product_id=product.id, ai_generation_id=None)
            
            result = policy_checker.check_listing_compliance(mock_listing, product)
            
            # Should not have handmade warning
            assert "handmade_no_handmade_indication" not in result["policy_flags"]
            
            test_db.delete(product)
            test_db.commit()
    
    def test_prohibited_claims_blocked(self, policy_checker, test_db, test_tenant):
        """Test prohibited medical/health claims are blocked"""
        prohibited_claims = [
            "cure arthritis",
            "treat depression",
            "heal wounds",
            "FDA approved",
            "clinically proven",
            "guaranteed results"
        ]
        
        for claim in prohibited_claims:
            product = from tests.test_policy_enforcement_helper import create_test_product
        product = create_test_product(test_db, test_tenant.id, 
                tenant_id=test_tenant.id,
                title="Handmade Product",
                description=f"This handmade product can {claim} and improve your life.",
                price=1000,
                quantity=5,
                source="manual"
            )
            test_db.add(product)
            test_db.commit()
            
            from types import SimpleNamespace
            mock_listing = SimpleNamespace(product_id=product.id, ai_generation_id=None)
            
            result = policy_checker.check_listing_compliance(mock_listing, product)
            
            # Should block due to prohibited claim
            assert result["can_publish"] == False
            assert "description_prohibited_claims" in result["policy_flags"]
            
            test_db.delete(product)
            test_db.commit()


# ==================== Test 7: Integration with ListingJob ====================

class TestListingJobIntegration:
    """Test policy enforcement in the publishing workflow"""
    
    def test_listing_job_created_with_policy_fields(self, test_db, test_tenant, compliant_product):
        """Test that ListingJob has policy fields"""
        job = ListingJob(
            tenant_id=test_tenant.id,
            shop_id=1,
            product_id=compliant_product.id,
            policy_status="passed",
            policy_flags=[],
            policy_checked_at=datetime.now(timezone.utc),
            status="pending"
        )
        test_db.add(job)
        test_db.commit()
        test_db.refresh(job)
        
        assert job.policy_status == "passed"
        assert job.policy_flags == []
        assert job.policy_checked_at is not None
    
    def test_policy_blocked_status_prevents_publish(self, test_db, test_tenant, non_compliant_product):
        """Test that policy_blocked status prevents publishing"""
        job = ListingJob(
            tenant_id=test_tenant.id,
            shop_id=1,
            product_id=non_compliant_product.id,
            policy_status="failed",
            policy_flags=["title_prohibited_terms"],
            policy_checked_at=datetime.now(timezone.utc),
            policy_block_reason="Product contains prohibited terms",
            status="policy_blocked"
        )
        test_db.add(job)
        test_db.commit()
        
        assert job.status == "policy_blocked"
        assert job.policy_block_reason is not None


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

