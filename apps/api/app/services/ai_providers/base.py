"""
Base AI Provider Interface
Defines common interface for all AI providers
"""
from abc import ABC, abstractmethod
from enum import Enum
from typing import Optional, List, Dict
from pydantic import BaseModel, Field


class AIProviderType(str, Enum):
    """Supported AI providers"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"


class GenerationRequest(BaseModel):
    """Request for AI content generation"""
    product_info: str = Field(..., description="Raw product information to enhance")
    title_raw: Optional[str] = None
    description_raw: Optional[str] = None
    tags_raw: Optional[List[str]] = None
    
    # Generation parameters
    style: str = Field(default="friendly", description="Writing style")
    tone: str = Field(default="professional", description="Tone of voice")
    include_handmade: bool = Field(default=True, description="Ensure handmade terminology")
    
    # AI model settings
    model: Optional[str] = None
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=500, ge=50, le=2000)


class GenerationResponse(BaseModel):
    """Response from AI generation"""
    title: str
    description: str
    tags: List[str]
    
    # Metadata
    provider: AIProviderType
    model_used: str
    tokens_used: Optional[int] = None
    generation_time_ms: Optional[int] = None
    
    # Policy check results (filled by caller)
    policy_status: Optional[str] = None
    policy_flags: Optional[Dict] = None


class AIProvider(ABC):
    """
    Abstract base class for AI providers
    
    All providers must implement:
    - generate_content(): Generate titles, descriptions, tags
    - is_available(): Check if provider is configured and available
    - get_default_model(): Get default model name
    """
    
    @abstractmethod
    async def generate_content(self, request: GenerationRequest) -> GenerationResponse:
        """
        Generate enhanced product content
        
        Args:
            request: Generation request with product info and parameters
            
        Returns:
            GenerationResponse with title, description, and tags
            
        Raises:
            Exception: If generation fails
        """
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """
        Check if provider is properly configured and available
        
        Returns:
            True if provider can be used, False otherwise
        """
        pass
    
    @abstractmethod
    def get_default_model(self) -> str:
        """
        Get the default model name for this provider
        
        Returns:
            Model name string
        """
        pass
    
    @abstractmethod
    def get_provider_type(self) -> AIProviderType:
        """
        Get the provider type
        
        Returns:
            AIProviderType enum value
        """
        pass
    
    def _build_prompt(self, request: GenerationRequest) -> str:
        """
        Build a prompt for content generation
        
        Can be overridden by providers for custom prompt engineering
        
        Args:
            request: Generation request
            
        Returns:
            Formatted prompt string
        """
        handmade_instruction = ""
        if request.include_handmade:
            handmade_instruction = "\n- IMPORTANT: The title MUST include one of these terms: 'handmade', 'handcrafted', 'artisan', 'custom made', or 'hand-made'"
        
        prompt = f"""Generate compelling Etsy product listing content based on this information:

{request.product_info}

Requirements:
- Style: {request.style}
- Tone: {request.tone}
- Title: Max 140 characters, attention-grabbing, SEO-optimized{handmade_instruction}
- Description: 2-3 paragraphs, highlight features and benefits
- Tags: Exactly 13 relevant tags, each max 20 characters

Generate content in this JSON format:
{{
  "title": "your generated title here",
  "description": "your generated description here",
  "tags": ["tag1", "tag2", ..., "tag13"]
}}

Focus on:
1. Unique selling points
2. Materials and craftsmanship
3. Use cases and benefits
4. Target audience appeal
5. Etsy marketplace best practices

DO NOT include:
- Banned terms (replica, knockoff, dropship, etc.)
- Unverifiable claims (guaranteed, proven, etc.)
- Medical or health claims

Generate the listing content now:"""
        
        return prompt

