"""
Anthropic Provider Implementation (Stub)
Placeholder for future Anthropic Claude integration
"""
import logging
from .base import AIProvider, AIProviderType, GenerationRequest, GenerationResponse

logger = logging.getLogger(__name__)


class AnthropicProvider(AIProvider):
    """
    Anthropic Claude provider (placeholder)
    
    TODO: Implement when Anthropic integration is needed
    """
    
    def __init__(self):
        """Initialize Anthropic client"""
        self.client = None
        # TODO: Initialize Anthropic client when API key is available
        # from anthropic import Anthropic
        # self.client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    
    def is_available(self) -> bool:
        """Check if Anthropic is configured"""
        return False  # Not implemented yet
    
    def get_default_model(self) -> str:
        """Get default Anthropic model"""
        return "claude-3-sonnet-20240229"
    
    def get_provider_type(self) -> AIProviderType:
        """Get provider type"""
        return AIProviderType.ANTHROPIC
    
    async def generate_content(self, request: GenerationRequest) -> GenerationResponse:
        """
        Generate content using Anthropic Claude
        
        TODO: Implement Anthropic API call
        
        Args:
            request: Generation request
            
        Returns:
            GenerationResponse with generated content
            
        Raises:
            NotImplementedError: Provider not yet implemented
        """
        raise NotImplementedError(
            "Anthropic provider not yet implemented. Use OpenAI provider instead."
        )

