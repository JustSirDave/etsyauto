"""
OpenAI Provider Implementation
Uses OpenAI API for content generation (default provider)
"""
import json
import time
import logging
from typing import Optional
from openai import AsyncOpenAI

from app.core.config import settings
from .base import AIProvider, AIProviderType, GenerationRequest, GenerationResponse

logger = logging.getLogger(__name__)


class OpenAIProvider(AIProvider):
    """OpenAI provider for content generation"""
    
    def __init__(self):
        """Initialize OpenAI client"""
        self.client = None
        if settings.OPENAI_API_KEY:
            self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    
    def is_available(self) -> bool:
        """Check if OpenAI is configured"""
        return self.client is not None and settings.OPENAI_API_KEY is not None
    
    def get_default_model(self) -> str:
        """Get default OpenAI model"""
        return "gpt-4o-mini"  # Cost-effective, fast
    
    def get_provider_type(self) -> AIProviderType:
        """Get provider type"""
        return AIProviderType.OPENAI
    
    async def generate_content(self, request: GenerationRequest) -> GenerationResponse:
        """
        Generate content using OpenAI
        
        Args:
            request: Generation request
            
        Returns:
            GenerationResponse with generated content
            
        Raises:
            Exception: If generation fails or API key not configured
        """
        if not self.is_available():
            raise ValueError("OpenAI API key not configured")
        
        start_time = time.time()
        
        # Use provided model or default
        model = request.model or self.get_default_model()
        
        # Build prompt
        prompt = self._build_prompt(request)
        
        try:
            # Call OpenAI API
            response = await self.client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert Etsy listing copywriter. You generate compelling, SEO-optimized product listings that comply with Etsy policies. Always respond with valid JSON."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=request.temperature,
                max_tokens=request.max_tokens,
                response_format={"type": "json_object"}  # Ensure JSON response
            )
            
            # Extract content
            content = response.choices[0].message.content
            
            # Parse JSON response
            try:
                data = json.loads(content)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse OpenAI response: {content}")
                raise ValueError(f"Invalid JSON response from OpenAI: {e}")
            
            # Extract fields
            title = data.get("title", "").strip()
            description = data.get("description", "").strip()
            tags = data.get("tags", [])
            
            # Validate we got content
            if not title:
                raise ValueError("OpenAI did not generate a title")
            if not description:
                raise ValueError("OpenAI did not generate a description")
            if not tags or len(tags) == 0:
                raise ValueError("OpenAI did not generate tags")
            
            # Ensure tags is a list of strings
            if not isinstance(tags, list):
                tags = [str(tags)]
            tags = [str(tag).strip() for tag in tags if tag]
            
            # Limit to 13 tags
            if len(tags) > 13:
                tags = tags[:13]
            
            # Calculate generation time
            generation_time_ms = int((time.time() - start_time) * 1000)
            
            # Get token usage
            tokens_used = None
            if hasattr(response, 'usage') and response.usage:
                tokens_used = response.usage.total_tokens
            
            return GenerationResponse(
                title=title,
                description=description,
                tags=tags,
                provider=AIProviderType.OPENAI,
                model_used=model,
                tokens_used=tokens_used,
                generation_time_ms=generation_time_ms
            )
            
        except Exception as e:
            logger.error(f"OpenAI generation failed: {str(e)}", exc_info=True)
            raise Exception(f"OpenAI generation failed: {str(e)}")

