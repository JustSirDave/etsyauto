"""
Google Gemini Provider Implementation (Stub)
Placeholder for future Gemini integration
"""
import logging
from .base import AIProvider, AIProviderType, GenerationRequest, GenerationResponse

logger = logging.getLogger(__name__)


class GeminiProvider(AIProvider):
    """
    Google Gemini provider (placeholder)
    
    TODO: Implement when Gemini integration is needed
    """
    
    def __init__(self):
        """Initialize Gemini client"""
        self.client = None
        # TODO: Initialize Gemini client when API key is available
        # import google.generativeai as genai
        # genai.configure(api_key=settings.GEMINI_API_KEY)
        # self.client = genai.GenerativeModel('gemini-pro')
    
    def is_available(self) -> bool:
        """Check if Gemini is configured"""
        return False  # Not implemented yet
    
    def get_default_model(self) -> str:
        """Get default Gemini model"""
        return "gemini-pro"
    
    def get_provider_type(self) -> AIProviderType:
        """Get provider type"""
        return AIProviderType.GEMINI
    
    async def generate_content(self, request: GenerationRequest) -> GenerationResponse:
        """
        Generate content using Google Gemini
        
        TODO: Implement Gemini API call
        
        Args:
            request: Generation request
            
        Returns:
            GenerationResponse with generated content
            
        Raises:
            NotImplementedError: Provider not yet implemented
        """
        raise NotImplementedError(
            "Gemini provider not yet implemented. Use OpenAI provider instead."
        )

