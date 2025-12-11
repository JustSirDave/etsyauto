"""
AI Provider Abstraction Layer
Supports multiple AI providers: OpenAI, Anthropic, Gemini
"""
from .base import AIProvider, AIProviderType, GenerationRequest, GenerationResponse
from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider
from .gemini_provider import GeminiProvider

__all__ = [
    "AIProvider",
    "AIProviderType",
    "GenerationRequest",
    "GenerationResponse",
    "OpenAIProvider",
    "AnthropicProvider",
    "GeminiProvider",
    "get_provider",
]


def get_provider(provider_type: AIProviderType = AIProviderType.OPENAI) -> AIProvider:
    """
    Factory function to get AI provider instance
    
    Args:
        provider_type: Type of AI provider to use
        
    Returns:
        AIProvider instance
    """
    if provider_type == AIProviderType.OPENAI:
        return OpenAIProvider()
    elif provider_type == AIProviderType.ANTHROPIC:
        return AnthropicProvider()
    elif provider_type == AIProviderType.GEMINI:
        return GeminiProvider()
    else:
        raise ValueError(f"Unsupported provider type: {provider_type}")

