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
        model: Optional[str] = None
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
            
        Returns:
            Tuple of (AIGeneration object, needs_review boolean)
        """
        # Build generation request
        request = GenerationRequest(
            product_info=product_info,
            title_raw=title_raw,
            description_raw=description_raw,
            tags_raw=tags_raw,
            style=style,
            tone=tone,
            include_handmade=True,  # Always enforce for Etsy
            model=model
        )
        
        # Get provider and generate
        provider = get_provider(provider_type)
        
        if not provider.is_available():
            raise ValueError(f"{provider_type} provider not available")
        
        logger.info(f"Generating content for product {product_id} using {provider_type}")
        
        try:
            # Generate content
            response = await provider.generate_content(request)
            
            # Run policy checks
            policy_status, violations = self.policy_engine.check_content(
                title=response.title,
                description=response.description,
                tags=response.tags
            )
            
            logger.info(f"Policy check result: {policy_status}, violations: {len(violations)}")
            
            # Build policy flags
            policy_flags = {
                "violations": [v for v in violations],
                "suggestions": self.policy_engine.suggest_fixes(violations) if violations else []
            }
            
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

