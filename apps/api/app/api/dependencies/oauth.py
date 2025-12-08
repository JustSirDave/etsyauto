"""
OAuth Dependency Injection for FastAPI
Provides shop context and tokens to route handlers
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
import redis

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.tenancy import Shop
from app.services.token_manager import TokenManager
from app.core.config import settings


# Redis client for token manager
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)


class ShopContext:
    """
    Shop context with automatic token management
    
    Use this in route handlers to get shop details and access tokens
    """
    
    def __init__(
        self, 
        shop: Shop, 
        tenant_id: int,
        token_manager: TokenManager
    ):
        self.shop = shop
        self.tenant_id = tenant_id
        self._token_manager = token_manager
        self._access_token: Optional[str] = None
    
    async def get_access_token(self, provider: str = 'etsy', auto_refresh: bool = True) -> str:
        """
        Get access token for this shop
        
        Automatically refreshes if expired
        
        Args:
            provider: OAuth provider (default: 'etsy')
            auto_refresh: Automatically refresh if expired
        
        Returns:
            Valid access token
        
        Raises:
            HTTPException: If no token found or refresh failed
        """
        if not self._access_token:
            self._access_token = await self._token_manager.get_token(
                tenant_id=self.tenant_id,
                shop_id=self.shop.id,
                provider=provider,
                auto_refresh=auto_refresh
            )
        
        if not self._access_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"No valid OAuth token for shop {self.shop.id}. Please reconnect your shop."
            )
        
        return self._access_token
    
    async def refresh_token(self, provider: str = 'etsy') -> str:
        """
        Force token refresh
        
        Args:
            provider: OAuth provider
        
        Returns:
            New access token
        """
        self._access_token = await self._token_manager.refresh_token(
            tenant_id=self.tenant_id,
            shop_id=self.shop.id,
            provider=provider
        )
        
        if not self._access_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Failed to refresh token for shop {self.shop.id}"
            )
        
        return self._access_token


async def get_shop_context(
    shop_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
) -> ShopContext:
    """
    Dependency to get shop context with token management
    
    Usage:
        @router.get("/products")
        async def list_products(shop_ctx: ShopContext = Depends(get_shop_context)):
            token = await shop_ctx.get_access_token()
            # Use token to call Etsy API
    
    Args:
        shop_id: Shop ID from path or query parameter
        current_user: Current authenticated user
        db: Database session
    
    Returns:
        ShopContext with token management
    
    Raises:
        HTTPException: If shop not found or not owned by tenant
    """
    tenant_id = int(current_user["tenant_id"])
    
    # Get shop and verify ownership
    shop = db.query(Shop).filter(
        Shop.id == shop_id,
        Shop.tenant_id == tenant_id,
        Shop.status == 'connected'
    ).first()
    
    if not shop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shop {shop_id} not found or not connected"
        )
    
    # Create token manager
    token_manager = TokenManager(db, redis_client)
    
    return ShopContext(
        shop=shop,
        tenant_id=tenant_id,
        token_manager=token_manager
    )


async def get_default_shop_context(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
) -> ShopContext:
    """
    Get the first connected shop for the tenant
    
    Useful for endpoints that don't specify a shop_id
    
    Args:
        current_user: Current authenticated user
        db: Database session
    
    Returns:
        ShopContext for first connected shop
    
    Raises:
        HTTPException: If no connected shops found
    """
    tenant_id = int(current_user["tenant_id"])
    
    shop = db.query(Shop).filter(
        Shop.tenant_id == tenant_id,
        Shop.status == 'connected'
    ).first()
    
    if not shop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No connected shops found. Please connect an Etsy shop first."
        )
    
    # Create token manager
    token_manager = TokenManager(db, redis_client)
    
    return ShopContext(
        shop=shop,
        tenant_id=tenant_id,
        token_manager=token_manager
    )


async def require_etsy_token(
    shop_ctx: ShopContext = Depends(get_default_shop_context)
) -> tuple[ShopContext, str]:
    """
    Dependency that requires a valid Etsy token
    
    Returns both shop context and the access token
    
    Usage:
        @router.get("/products")
        async def list_products(
            shop_and_token: tuple[ShopContext, str] = Depends(require_etsy_token)
        ):
            shop_ctx, token = shop_and_token
            # Use token directly
    
    Args:
        shop_ctx: Shop context from dependency
    
    Returns:
        Tuple of (ShopContext, access_token)
    """
    token = await shop_ctx.get_access_token()
    return shop_ctx, token

