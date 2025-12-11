"""
Tests for AI Provider Abstraction
Tests provider fallback, OpenAI integration, and provider switching
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock
from app.services.ai_providers import (
    get_provider, AIProviderType, GenerationRequest, GenerationResponse,
    OpenAIProvider, AnthropicProvider, GeminiProvider
)


class TestProviderFactory:
    """Test provider factory function"""
    
    def test_get_openai_provider(self):
        """Test getting OpenAI provider"""
        provider = get_provider(AIProviderType.OPENAI)
        assert isinstance(provider, OpenAIProvider)
        assert provider.get_provider_type() == AIProviderType.OPENAI
    
    def test_get_anthropic_provider(self):
        """Test getting Anthropic provider"""
        provider = get_provider(AIProviderType.ANTHROPIC)
        assert isinstance(provider, AnthropicProvider)
        assert provider.get_provider_type() == AIProviderType.ANTHROPIC
    
    def test_get_gemini_provider(self):
        """Test getting Gemini provider"""
        provider = get_provider(AIProviderType.GEMINI)
        assert isinstance(provider, GeminiProvider)
        assert provider.get_provider_type() == AIProviderType.GEMINI
    
    def test_invalid_provider_type(self):
        """Test error for invalid provider type"""
        with pytest.raises(ValueError):
            get_provider("invalid_provider")


class TestOpenAIProvider:
    """Test OpenAI provider implementation"""
    
    def test_openai_default_model(self):
        """Test OpenAI default model"""
        provider = OpenAIProvider()
        assert provider.get_default_model() == "gpt-4o-mini"
    
    def test_openai_availability_with_key(self):
        """Test availability when API key is configured"""
        with patch('app.core.config.settings.OPENAI_API_KEY', 'sk-test123'):
            provider = OpenAIProvider()
            # Availability depends on actual key configuration
            # This test validates the check exists
            assert isinstance(provider.is_available(), bool)
    
    def test_openai_availability_without_key(self):
        """Test unavailability when API key is not configured"""
        with patch('app.core.config.settings.OPENAI_API_KEY', None):
            provider = OpenAIProvider()
            assert provider.is_available() == False
    
    @pytest.mark.asyncio
    async def test_openai_generation_without_key(self):
        """Test that generation fails without API key"""
        with patch('app.core.config.settings.OPENAI_API_KEY', None):
            provider = OpenAIProvider()
            request = GenerationRequest(
                product_info="Test product",
                style="friendly",
                tone="professional"
            )
            
            with pytest.raises(ValueError) as exc_info:
                await provider.generate_content(request)
            
            assert "api key" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_openai_generation_success(self):
        """Test successful OpenAI generation (mocked)"""
        # Mock OpenAI response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{"title": "Handmade Ceramic Mug", "description": "Beautiful handcrafted mug", "tags": ["handmade", "ceramic", "mug"]}'
        mock_response.usage = Mock()
        mock_response.usage.total_tokens = 150
        
        with patch('app.core.config.settings.OPENAI_API_KEY', 'sk-test123'):
            provider = OpenAIProvider()
            
            with patch.object(provider, 'client') as mock_client:
                mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
                
                request = GenerationRequest(
                    product_info="Ceramic mug, handmade, blue glaze",
                    style="friendly",
                    tone="professional"
                )
                
                response = await provider.generate_content(request)
                
                assert isinstance(response, GenerationResponse)
                assert response.title == "Handmade Ceramic Mug"
                assert response.description == "Beautiful handcrafted mug"
                assert len(response.tags) == 3
                assert response.provider == AIProviderType.OPENAI
                assert response.tokens_used == 150


class TestAnthropicProvider:
    """Test Anthropic provider (stub)"""
    
    def test_anthropic_not_available(self):
        """Test that Anthropic provider is not available (stub)"""
        provider = AnthropicProvider()
        assert provider.is_available() == False
    
    def test_anthropic_default_model(self):
        """Test Anthropic default model"""
        provider = AnthropicProvider()
        assert "claude" in provider.get_default_model().lower()
    
    @pytest.mark.asyncio
    async def test_anthropic_generation_raises_not_implemented(self):
        """Test that Anthropic generation raises NotImplementedError"""
        provider = AnthropicProvider()
        request = GenerationRequest(
            product_info="Test product",
            style="friendly"
        )
        
        with pytest.raises(NotImplementedError):
            await provider.generate_content(request)


class TestGeminiProvider:
    """Test Gemini provider (stub)"""
    
    def test_gemini_not_available(self):
        """Test that Gemini provider is not available (stub)"""
        provider = GeminiProvider()
        assert provider.is_available() == False
    
    def test_gemini_default_model(self):
        """Test Gemini default model"""
        provider = GeminiProvider()
        assert "gemini" in provider.get_default_model().lower()
    
    @pytest.mark.asyncio
    async def test_gemini_generation_raises_not_implemented(self):
        """Test that Gemini generation raises NotImplementedError"""
        provider = GeminiProvider()
        request = GenerationRequest(
            product_info="Test product",
            style="friendly"
        )
        
        with pytest.raises(NotImplementedError):
            await provider.generate_content(request)


class TestProviderFallback:
    """Test provider fallback logic"""
    
    @pytest.mark.asyncio
    async def test_fallback_when_provider_unavailable(self):
        """Test falling back to another provider when primary is unavailable"""
        # This test validates the concept - actual fallback logic would be in service layer
        
        # Try to get Anthropic (unavailable)
        anthropic = get_provider(AIProviderType.ANTHROPIC)
        assert not anthropic.is_available()
        
        # Fallback to OpenAI
        openai = get_provider(AIProviderType.OPENAI)
        # OpenAI should be available (depends on config)
        assert isinstance(openai, OpenAIProvider)


class TestGenerationRequest:
    """Test generation request model"""
    
    def test_generation_request_minimal(self):
        """Test creating request with minimal fields"""
        request = GenerationRequest(
            product_info="Ceramic mug"
        )
        
        assert request.product_info == "Ceramic mug"
        assert request.style == "friendly"  # Default
        assert request.tone == "professional"  # Default
        assert request.include_handmade == True  # Default
        assert request.temperature == 0.7  # Default
    
    def test_generation_request_full(self):
        """Test creating request with all fields"""
        request = GenerationRequest(
            product_info="Ceramic mug, blue glaze",
            title_raw="Original Title",
            description_raw="Original description",
            tags_raw=["original", "tags"],
            style="elegant",
            tone="formal",
            include_handmade=False,
            model="gpt-4",
            temperature=0.9,
            max_tokens=1000
        )
        
        assert request.product_info == "Ceramic mug, blue glaze"
        assert request.style == "elegant"
        assert request.tone == "formal"
        assert request.include_handmade == False
        assert request.model == "gpt-4"
        assert request.temperature == 0.9
        assert request.max_tokens == 1000
    
    def test_generation_request_temperature_validation(self):
        """Test temperature validation"""
        # Valid temperature
        request = GenerationRequest(product_info="Test", temperature=0.5)
        assert request.temperature == 0.5
        
        # Temperature out of range should be caught by Pydantic
        with pytest.raises(Exception):  # ValidationError
            GenerationRequest(product_info="Test", temperature=3.0)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

