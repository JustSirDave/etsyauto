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
    generate_type: str = Field(default="all", description="What to generate: all, title, description, tags")
    
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
        Build a prompt for content generation.
        Supports generating all content or a single field (title / description / tags).
        """
        gen_type = request.generate_type or "all"
        handmade_note = ""
        if request.include_handmade:
            handmade_note = " MUST include one of: 'handmade', 'handcrafted', 'artisan', 'custom made', or 'hand-made'."

        common_header = f"Based on this Etsy product information:\n\n{request.product_info}\n\nStyle: {request.style} | Tone: {request.tone}\n"

        common_rules = """
DO NOT include:
- Banned terms per Etsy policy (replica, knockoff, dropship, resale, wholesale, bulk order, alibaba, aliexpress, etc.)
- Unverifiable claims (guaranteed, proven, etc.)
- Medical or health claims
- Mass-produced or commercial language
"""

        if gen_type == "title":
            return f"""{common_header}
Generate ONLY an Etsy product title.
Requirements:
- Max 140 characters, attention-grabbing, Etsy SEO-optimized.{handmade_note}
{common_rules}
Return JSON: {{ "title": "your title here" }}"""

        if gen_type == "description":
            return f"""{common_header}
Generate ONLY an Etsy product description.
Requirements:
- 2-3 paragraphs highlighting features and benefits for Etsy buyers.
- Focus on materials, craftsmanship, use cases, and target audience.
{common_rules}
Return JSON: {{ "description": "your description here" }}"""

        if gen_type == "tags":
            return f"""{common_header}
Generate ONLY Etsy search tags for this product.
Requirements:
- Exactly 13 relevant Etsy search tags, each max 20 characters.
- Optimized for Etsy search/SEO.
{common_rules}
Return JSON: {{ "tags": ["tag1", "tag2", ..., "tag13"] }}"""

        # Default: generate all
        return f"""{common_header}
Generate compelling Etsy product listing content.

Requirements:
- Title: Max 140 characters, attention-grabbing, Etsy SEO-optimized.{handmade_note}
- Description: 2-3 paragraphs, highlight features and benefits for Etsy buyers.
- Tags: Exactly 13 relevant Etsy search tags, each max 20 characters.
{common_rules}
Focus on unique selling points, materials, craftsmanship, use cases, and Etsy marketplace best practices.

Return JSON:
{{
  "title": "your generated title here",
  "description": "your generated description here",
  "tags": ["tag1", "tag2", ..., "tag13"]
}}"""

