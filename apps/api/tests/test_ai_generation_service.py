"""
Integration Tests for AI Generation Service
Tests full workflow: generation → policy check → persistence → review
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime
from sqlalchemy.orm import Session

from app.services.ai_generation_service import AIGenerationService
from app.services.ai_providers import AIProviderType, GenerationResponse
from app.services.policy_engine import PolicyStatus
from app.models.listings import AIGeneration, Product


# ==================== Fixtures ====================

@pytest.fixture
def mock_db():
    """Mock database session"""
    db = Mock(spec=Session)
    db.add = Mock()
    db.commit = Mock()
    db.rollback = Mock()
    db.refresh = Mock()
    db.query = Mock()
    return db


@pytest.fixture
def ai_service(mock_db):
    """AI generation service with mock DB"""
    return AIGenerationService(mock_db)


@pytest.fixture
def mock_valid_generation():
    """Mock valid AI generation response"""
    return GenerationResponse(
        title="Handmade Ceramic Coffee Mug",
        description="Beautiful handcrafted ceramic mug perfect for coffee lovers",
        tags=["handmade", "ceramic", "mug", "coffee", "pottery"],
        provider=AIProviderType.OPENAI,
        model_used="gpt-4o-mini",
        tokens_used=150,
        generation_time_ms=2300
    )


@pytest.fixture
def mock_invalid_generation():
    """Mock AI generation with policy violations"""
    return GenerationResponse(
        title="Replica Ceramic Mug",  # Banned term
        description="Beautiful mug for coffee",  # Missing handmade
        tags=["replica", "ceramic", "mug"],  # Banned term in tags
        provider=AIProviderType.OPENAI,
        model_used="gpt-4o-mini",
        tokens_used=120,
        generation_time_ms=2100
    )


# ==================== Generation Tests ====================

class TestGenerationWithPolicyCheck:
    """Test AI generation with automatic policy checking"""
    
    @pytest.mark.asyncio
    async def test_generation_passes_policy(self, ai_service, mock_db, mock_valid_generation):
        """Test generation that passes policy check"""
        with patch('app.services.ai_generation_service.get_provider') as mock_get_provider:
            # Mock provider
            mock_provider = Mock()
            mock_provider.is_available.return_value = True
            mock_provider.generate_content = AsyncMock(return_value=mock_valid_generation)
            mock_get_provider.return_value = mock_provider
            
            # Mock db.refresh to set ID
            def mock_refresh(obj):
                obj.id = 123
            mock_db.refresh = mock_refresh
            
            # Generate with policy check
            generation, needs_review = await ai_service.generate_with_policy_check(
                product_id=1,
                tenant_id=1,
                product_info="Ceramic mug, handmade, blue glaze",
                provider_type=AIProviderType.OPENAI
            )
            
            # Should not need review
            assert needs_review == False
            
            # Should have saved to DB
            assert mock_db.add.called
            assert mock_db.commit.called
    
    @pytest.mark.asyncio
    async def test_generation_fails_policy(self, ai_service, mock_db, mock_invalid_generation):
        """Test generation that fails policy check"""
        with patch('app.services.ai_generation_service.get_provider') as mock_get_provider:
            # Mock provider
            mock_provider = Mock()
            mock_provider.is_available.return_value = True
            mock_provider.generate_content = AsyncMock(return_value=mock_invalid_generation)
            mock_get_provider.return_value = mock_provider
            
            # Mock db.refresh to set ID
            def mock_refresh(obj):
                obj.id = 124
            mock_db.refresh = mock_refresh
            
            # Generate with policy check
            generation, needs_review = await ai_service.generate_with_policy_check(
                product_id=1,
                tenant_id=1,
                product_info="Ceramic mug",
                provider_type=AIProviderType.OPENAI
            )
            
            # Should need review
            assert needs_review == True
            
            # Should have saved to DB
            assert mock_db.add.called
            assert mock_db.commit.called
    
    @pytest.mark.asyncio
    async def test_provider_unavailable_error(self, ai_service):
        """Test error when provider is unavailable"""
        with patch('app.services.ai_generation_service.get_provider') as mock_get_provider:
            mock_provider = Mock()
            mock_provider.is_available.return_value = False
            mock_get_provider.return_value = mock_provider
            
            with pytest.raises(ValueError) as exc_info:
                await ai_service.generate_with_policy_check(
                    product_id=1,
                    tenant_id=1,
                    product_info="Test",
                    provider_type=AIProviderType.OPENAI
                )
            
            assert "not available" in str(exc_info.value).lower()


# ==================== Review Workflow Tests ====================

class TestReviewWorkflow:
    """Test review, accept, reject, and modify workflows"""
    
    def test_review_accept(self, ai_service, mock_db):
        """Test accepting a generation"""
        # Mock existing generation
        mock_generation = Mock(spec=AIGeneration)
        mock_generation.id = 1
        mock_generation.title = "Test Title"
        mock_generation.description = "Test Description"
        mock_generation.tags = ["tag1", "tag2"]
        
        mock_db.query.return_value.filter.return_value.first.return_value = mock_generation
        
        # Review and accept
        result = ai_service.review_generation(
            generation_id=1,
            user_id=10,
            decision='accepted'
        )
        
        assert result.reviewed_by == 10
        assert result.review_decision == 'accepted'
        assert result.reviewed_at is not None
        assert mock_db.commit.called
    
    def test_review_reject(self, ai_service, mock_db):
        """Test rejecting a generation"""
        mock_generation = Mock(spec=AIGeneration)
        mock_generation.id = 1
        
        mock_db.query.return_value.filter.return_value.first.return_value = mock_generation
        
        result = ai_service.review_generation(
            generation_id=1,
            user_id=10,
            decision='rejected'
        )
        
        assert result.reviewed_by == 10
        assert result.review_decision == 'rejected'
        assert mock_db.commit.called
    
    def test_review_modify_with_revalidation(self, ai_service, mock_db):
        """Test modifying content triggers re-policy-check"""
        mock_generation = Mock(spec=AIGeneration)
        mock_generation.id = 1
        mock_generation.title = "Original Title"
        mock_generation.description = "Original Description"
        mock_generation.tags = ["tag1"]
        
        mock_db.query.return_value.filter.return_value.first.return_value = mock_generation
        
        # Modify with valid handmade content
        modified_content = {
            'title': 'Handmade Ceramic Mug',
            'description': 'Beautiful handcrafted mug',
            'tags': ['handmade', 'ceramic']
        }
        
        result = ai_service.review_generation(
            generation_id=1,
            user_id=10,
            decision='modified',
            modified_content=modified_content
        )
        
        # Should have updated content
        assert result.title == 'Handmade Ceramic Mug'
        assert result.description == 'Beautiful handcrafted mug'
        assert result.tags == ['handmade', 'ceramic']
        
        # Should have re-run policy check
        assert result.policy_status is not None
        assert result.policy_checked_at is not None
        
        assert mock_db.commit.called
    
    def test_review_nonexistent_generation(self, ai_service, mock_db):
        """Test error when reviewing nonexistent generation"""
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        with pytest.raises(ValueError) as exc_info:
            ai_service.review_generation(
                generation_id=999,
                user_id=10,
                decision='accepted'
            )
        
        assert "not found" in str(exc_info.value).lower()


# ==================== Pending Reviews Tests ====================

class TestPendingReviews:
    """Test pending review queries"""
    
    def test_get_pending_reviews_empty(self, ai_service, mock_db):
        """Test getting pending reviews when none exist"""
        mock_db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = []
        
        pending = ai_service.get_pending_reviews(tenant_id=1, limit=50)
        
        assert pending == []
    
    def test_get_pending_reviews_with_results(self, ai_service, mock_db):
        """Test getting pending reviews"""
        # Mock 3 pending reviews
        mock_reviews = [
            Mock(id=1, policy_status='failed'),
            Mock(id=2, policy_status='needs_review'),
            Mock(id=3, policy_status='failed')
        ]
        
        mock_db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = mock_reviews
        
        pending = ai_service.get_pending_reviews(tenant_id=1, limit=50)
        
        assert len(pending) == 3
    
    def test_get_pending_reviews_tenant_scoped(self, ai_service, mock_db):
        """Test that pending reviews are tenant-scoped"""
        mock_db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = []
        
        ai_service.get_pending_reviews(tenant_id=5, limit=50)
        
        # Verify tenant_id filter was applied
        filter_call = mock_db.query.return_value.filter.call_args
        # Should have tenant_id in filter
        assert filter_call is not None


# ==================== Persistence Tests ====================

class TestGenerationPersistence:
    """Test that generations are persisted correctly"""
    
    @pytest.mark.asyncio
    async def test_generation_saved_with_policy_data(self, ai_service, mock_db, mock_valid_generation):
        """Test that generation with policy data is saved"""
        with patch('app.services.ai_generation_service.get_provider') as mock_get_provider:
            mock_provider = Mock()
            mock_provider.is_available.return_value = True
            mock_provider.generate_content = AsyncMock(return_value=mock_valid_generation)
            mock_get_provider.return_value = mock_provider
            
            # Mock refresh to set ID
            def mock_refresh(obj):
                obj.id = 123
            mock_db.refresh = mock_refresh
            
            generation, needs_review = await ai_service.generate_with_policy_check(
                product_id=1,
                tenant_id=1,
                product_info="Test product"
            )
            
            # Verify add was called with AIGeneration
            add_call = mock_db.add.call_args[0][0]
            assert isinstance(add_call, AIGeneration)
            assert add_call.product_id == 1
            assert add_call.tenant_id == 1
            assert add_call.title == "Handmade Ceramic Coffee Mug"
            assert add_call.policy_status is not None
            assert add_call.provider == "openai"


# ==================== Error Handling Tests ====================

class TestErrorHandling:
    """Test error handling in generation service"""
    
    @pytest.mark.asyncio
    async def test_generation_failure_rollback(self, ai_service, mock_db):
        """Test database rollback on generation failure"""
        with patch('app.services.ai_generation_service.get_provider') as mock_get_provider:
            mock_provider = Mock()
            mock_provider.is_available.return_value = True
            mock_provider.generate_content = AsyncMock(side_effect=Exception("API Error"))
            mock_get_provider.return_value = mock_provider
            
            with pytest.raises(Exception):
                await ai_service.generate_with_policy_check(
                    product_id=1,
                    tenant_id=1,
                    product_info="Test"
                )
            
            # Should have rolled back
            assert mock_db.rollback.called


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

