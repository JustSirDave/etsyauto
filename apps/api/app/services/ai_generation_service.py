"""
AI Generation Service with Policy Integration
Orchestrates AI generation with automatic policy checking
"""
import logging
from datetime import datetime
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from app.models.listings import AIGeneration, Product
from app.services.policy_engine import get_policy_engine, PolicyStatus
from app.services.ai_providers import get_provider, GenerationRequest, AIProviderType
from app.core.config import settings

logger = logging.getLogger(__name__)

# Approximate cost per 1K tokens (input+output blended) in USD cents
# Updated for OpenAI pricing as of early 2025
MODEL_COST_PER_1K_TOKENS = {
    "gpt-4o-mini": 0.015,      # ~$0.00015 / 1K tokens blended
    "gpt-4o": 0.5,             # ~$0.005 / 1K tokens blended
    "gpt-4-turbo": 1.0,        # ~$0.01 / 1K tokens blended
    "gpt-4": 3.0,              # ~$0.03 / 1K tokens blended
    "gpt-3.5-turbo": 0.05,     # ~$0.0005 / 1K tokens blended
}


def _estimate_cost_usd_cents(model: str, tokens_used: Optional[int]) -> int:
    """Estimate cost in USD cents from model name and token count."""
    if not tokens_used or tokens_used <= 0:
        return 0
    rate = MODEL_COST_PER_1K_TOKENS.get(model, MODEL_COST_PER_1K_TOKENS.get("gpt-4o-mini", 0.015))
    cost_cents = (tokens_used / 1000.0) * rate
    return max(1, round(cost_cents))  # Minimum 1 cent if any tokens used


class AIGenerationService:
    """
    Service for generating AI content with policy compliance
    
    Workflow:
    1. Generate content with AI provider
    2. Run policy checks
    3. Store generation with policy flags
    4. Return for review if needed
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.policy_engine = get_policy_engine(strict_mode=True)
    
    async def generate_with_policy_check(
        self,
        product_id: int,
        tenant_id: int,
        product_info: str,
        title_raw: Optional[str] = None,
        description_raw: Optional[str] = None,
        tags_raw: Optional[list] = None,
        style: str = "friendly",
        tone: str = "professional",
        provider_type: AIProviderType = AIProviderType.OPENAI,
        model: Optional[str] = None,
        generate_type: str = "all"
    ) -> Tuple[AIGeneration, bool]:
        """
        Generate AI content and run policy checks
        
        Args:
            product_id: Product ID
            tenant_id: Tenant ID
            product_info: Raw product information
            title_raw: Optional existing title
            description_raw: Optional existing description
            tags_raw: Optional existing tags
            style: Writing style
            tone: Tone of voice
            provider_type: AI provider to use
            model: Model name (optional)
            generate_type: What to generate — "all", "title", "description", or "tags"
            
        Returns:
            Tuple of (AIGeneration object, needs_review boolean)
        """
        # Use fewer tokens for single-field generation
        max_tokens = 500
        if generate_type == "title":
            max_tokens = 150
        elif generate_type == "tags":
            max_tokens = 200
        elif generate_type == "description":
            max_tokens = 400

        # Build generation request
        request = GenerationRequest(
            product_info=product_info,
            title_raw=title_raw,
            description_raw=description_raw,
            tags_raw=tags_raw,
            style=style,
            tone=tone,
            include_handmade=True if generate_type in ("all", "title") else False,
            generate_type=generate_type,
            model=model,
            max_tokens=max_tokens
        )
        
        # Get provider and generate
        provider = get_provider(provider_type)
        
        if not provider.is_available():
            raise ValueError(f"{provider_type} provider not available")
        
        logger.info(f"Generating content for product {product_id} using {provider_type}")
        
        try:
            # Generate content
            response = await provider.generate_content(request)
            
            # Run policy checks (only on fields that were generated)
            policy_title = response.title if generate_type in ("all", "title") else ""
            policy_desc = response.description if generate_type in ("all", "description") else ""
            policy_tags = response.tags if generate_type in ("all", "tags") else []
            policy_status, violations = self.policy_engine.check_content(
                title=policy_title,
                description=policy_desc,
                tags=policy_tags
            )
            
            logger.info(f"Policy check result: {policy_status}, violations: {len(violations)}")
            
            # Build policy flags
            policy_flags = {
                "violations": [v for v in violations],
                "suggestions": self.policy_engine.suggest_fixes(violations) if violations else []
            }
            
            # Calculate cost
            cost_cents = _estimate_cost_usd_cents(response.model_used, response.tokens_used)

            # Create AIGeneration record
            ai_generation = AIGeneration(
                tenant_id=tenant_id,
                product_id=product_id,
                model=response.model_used,
                title=response.title,
                description=response.description,
                tags=response.tags,
                # Policy fields
                policy_status=policy_status.value,
                policy_flags=policy_flags if violations else None,
                policy_checked_at=datetime.utcnow(),
                # Provider fields
                provider=response.provider.value,
                tokens_used=response.tokens_used,
                generation_time_ms=response.generation_time_ms,
                # Cost tracking
                cost_tokens=response.tokens_used or 0,
                cost_usd_cents=cost_cents,
                # Legacy fields
                status='flagged' if policy_status == PolicyStatus.FAILED else 'ok'
            )
            
            # Save to database
            self.db.add(ai_generation)
            self.db.commit()
            self.db.refresh(ai_generation)
            
            # Determine if review is needed
            needs_review = policy_status in [PolicyStatus.FAILED, PolicyStatus.NEEDS_REVIEW]
            
            logger.info(f"AI generation saved: id={ai_generation.id}, needs_review={needs_review}")
            
            return ai_generation, needs_review
            
        except Exception as e:
            logger.error(f"AI generation failed: {str(e)}", exc_info=True)
            self.db.rollback()
            raise
    
    def review_generation(
        self,
        generation_id: int,
        user_id: int,
        decision: str,
        modified_content: Optional[dict] = None
    ) -> AIGeneration:
        """
        Review and accept/reject/modify generated content
        
        Args:
            generation_id: AIGeneration ID
            user_id: Reviewing user ID
            decision: 'accepted', 'rejected', or 'modified'
            modified_content: If modified, new content (title, description, tags)
            
        Returns:
            Updated AIGeneration object
        """
        generation = self.db.query(AIGeneration).filter(
            AIGeneration.id == generation_id
        ).first()
        
        if not generation:
            raise ValueError(f"Generation {generation_id} not found")
        
        # Update review fields
        generation.reviewed_by = user_id
        generation.reviewed_at = datetime.utcnow()
        generation.review_decision = decision
        
        # If modified, update content and re-check policy
        if decision == 'modified' and modified_content:
            generation.title = modified_content.get('title', generation.title)
            generation.description = modified_content.get('description', generation.description)
            generation.tags = modified_content.get('tags', generation.tags)
            
            # Re-run policy check
            policy_status, violations = self.policy_engine.check_content(
                title=generation.title,
                description=generation.description,
                tags=generation.tags
            )
            
            generation.policy_status = policy_status.value
            generation.policy_flags = {
                "violations": violations,
                "suggestions": self.policy_engine.suggest_fixes(violations) if violations else [],
                "modified_by_user": True
            } if violations else None
            generation.policy_checked_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(generation)
        
        logger.info(f"Generation {generation_id} reviewed by user {user_id}: {decision}")
        
        return generation
    
    def get_pending_reviews(self, tenant_id: int, limit: int = 50) -> list:
        """
        Get generations that need review
        
        Args:
            tenant_id: Tenant ID for scoping
            limit: Max number to return
            
        Returns:
            List of AIGeneration objects needing review
        """
        return self.db.query(AIGeneration).filter(
            AIGeneration.tenant_id == tenant_id,
            AIGeneration.policy_status.in_(['failed', 'needs_review']),
            AIGeneration.reviewed_at == None
        ).order_by(AIGeneration.created_at.desc()).limit(limit).all()

