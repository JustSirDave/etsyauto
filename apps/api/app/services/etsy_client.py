"""
Etsy API Client with OAuth 2.0 and Rate Limiting
Handles all interactions with Etsy Open API v3
"""
import httpx
from typing import Optional, Dict, Any, List
from urllib.parse import urlencode
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import redis
from app.core.config import settings
from app.models.tenancy import Shop, OAuthToken
from app.services.rate_limiter import RateLimiter
from app.services.token_manager import TokenManager
from app.core.redis import get_redis_client
import logging

logger = logging.getLogger(__name__)


# Standard Etsy OAuth 2.0 scopes for listings
ETSY_SCOPES = [
    "listings_r",      # Read listings
    "listings_w",      # Write/create listings
    "listings_d",      # Delete listings
    "transactions_r",  # Read orders/transactions
    "shops_r",         # Read shop information
    "profile_r",       # Read user profile
]


class EtsyAPIError(Exception):
    """Base exception for Etsy API errors"""
    def __init__(self, message: str, status_code: Optional[int] = None, response: Optional[Dict] = None):
        self.message = message
        self.status_code = status_code
        self.response = response
        super().__init__(self.message)


class EtsyRateLimitError(EtsyAPIError):
    """Raised when rate limit is exceeded"""
    pass


class EtsyClient:
    """
    Etsy Open API v3 Client with automatic token refresh, rate limiting, and retry logic.
    """

    def __init__(self, db: Session, rate_limiter: Optional[RateLimiter] = None):
        self.db = db
        self.base_url = settings.ETSY_API_BASE_URL
        self.client_id = settings.ETSY_CLIENT_ID
        self.client_secret = settings.ETSY_CLIENT_SECRET
        self.redirect_uri = settings.ETSY_REDIRECT_URI

        # Initialize rate limiter
        if rate_limiter is None:
            redis_client = get_redis_client()
            from app.services.rate_limiter import get_rate_limiter
            self.rate_limiter = get_rate_limiter(redis_client)
        else:
            self.rate_limiter = rate_limiter
        
        # Initialize token manager
        redis_client = get_redis_client()
        self.token_manager = TokenManager(db, redis_client)

    def get_authorization_url(self, state: str, code_challenge: str) -> str:
        """
        Generate OAuth authorization URL for PKCE flow.

        Args:
            state: Random state for CSRF protection
            code_challenge: SHA256 hash of code_verifier

        Returns:
            str: Authorization URL to redirect user to
        """
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(ETSY_SCOPES),
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }

        return f"https://www.etsy.com/oauth/connect?{urlencode(params)}"

    async def exchange_code_for_token(
        self,
        code: str,
        code_verifier: str
    ) -> Dict[str, Any]:
        """
        Exchange authorization code for access token.

        Args:
            code: Authorization code from callback
            code_verifier: Original PKCE verifier

        Returns:
            dict: Token response with access_token, refresh_token, etc.
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.etsy.com/v3/public/oauth/token",
                data={
                    "grant_type": "authorization_code",
                    "client_id": self.client_id,
                    "redirect_uri": self.redirect_uri,
                    "code": code,
                    "code_verifier": code_verifier,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            if response.status_code != 200:
                raise EtsyAPIError(
                    f"Token exchange failed: {response.text}",
                    status_code=response.status_code,
                    response=response.json() if response.text else None
                )

            return response.json()

    async def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Refresh an expired access token.

        Args:
            refresh_token: The refresh token

        Returns:
            dict: New token response
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.etsy.com/v3/public/oauth/token",
                data={
                    "grant_type": "refresh_token",
                    "client_id": self.client_id,
                    "refresh_token": refresh_token,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            if response.status_code != 200:
                raise EtsyAPIError(
                    f"Token refresh failed: {response.text}",
                    status_code=response.status_code,
                )

            return response.json()

    async def _get_access_token(self, shop_id: int, tenant_id: int) -> str:
        """
        Get valid access token for a shop, automatically refreshing if needed.
        
        Uses TokenManager for automatic refresh with single-flight pattern.
        
        Args:
            shop_id: Shop ID
            tenant_id: Tenant ID
        
        Returns:
            Valid access token
        
        Raises:
            EtsyAPIError: If token not found or refresh failed
        """
        try:
            token = await self.token_manager.get_token(
                tenant_id=tenant_id,
                shop_id=shop_id,
                provider='etsy',
                auto_refresh=True
            )
            
            if not token:
                raise EtsyAPIError("No valid OAuth token found. Please reconnect your shop.")
            
            return token
            
        except Exception as e:
            logger.error(f"Failed to get access token for shop {shop_id}: {e}")
            raise EtsyAPIError(f"Token retrieval failed: {str(e)}")

    async def _make_request(
        self,
        shop_id: int,
        method: str,
        endpoint: str,
        retry_on_401: bool = True,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Make rate-limited request to Etsy API with automatic token refresh on 401.

        Args:
            shop_id: Shop ID for rate limiting
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint path
            retry_on_401: Retry request after refreshing token on 401 (default: True)
            **kwargs: Additional arguments for httpx request

        Returns:
            dict: API response JSON
        """
        # Get shop to retrieve tenant_id
        shop = self.db.query(Shop).filter(Shop.id == shop_id).first()
        if not shop:
            raise EtsyAPIError("Shop not found")
        
        tenant_id = shop.tenant_id
        
        # Acquire rate limit token
        if not await self.rate_limiter.acquire(shop_id):
            wait_time = await self.rate_limiter.get_wait_time(shop_id)
            raise EtsyRateLimitError(
                f"Rate limit exceeded. Please wait {wait_time:.1f} seconds."
            )

        # Get access token (automatically refreshes if expired)
        access_token = await self._get_access_token(shop_id, tenant_id)

        # Make request
        headers = kwargs.pop("headers", {})
        headers["x-api-key"] = self.client_id
        headers["Authorization"] = f"Bearer {access_token}"

        url = f"{self.base_url}{endpoint}"

        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                **kwargs
            )

            # Handle 401 - token might have expired between check and request
            if response.status_code == 401 and retry_on_401:
                logger.warning(f"Got 401 from Etsy API, forcing token refresh for shop {shop_id}")
                
                # Force token refresh
                try:
                    new_token = await self.token_manager.refresh_token(tenant_id, shop_id, 'etsy')
                    
                    # Retry request with new token
                    headers["Authorization"] = f"Bearer {new_token}"
                    response = await client.request(
                        method=method,
                        url=url,
                        headers=headers,
                        **kwargs
                    )
                    
                    if response.status_code == 401:
                        # Still 401 after refresh - token is invalid
                        raise EtsyAPIError(
                            "Authentication failed. Please reconnect your Etsy shop.",
                            status_code=401
                        )
                        
                except Exception as e:
                    logger.error(f"Token refresh after 401 failed: {e}")
                    raise EtsyAPIError(
                        "Authentication failed. Please reconnect your Etsy shop.",
                        status_code=401
                    )

            if response.status_code == 429:
                raise EtsyRateLimitError("Etsy API rate limit exceeded")

            if response.status_code >= 400:
                raise EtsyAPIError(
                    f"Etsy API error: {response.text}",
                    status_code=response.status_code,
                    response=response.json() if response.text else None
                )

            return response.json()

    # ==================== Shop Methods ====================

    async def get_shop_info(self, shop_id: int, etsy_shop_id: str) -> Dict[str, Any]:
        """Get shop information from Etsy."""
        return await self._make_request(
            shop_id,
            "GET",
            f"/application/shops/{etsy_shop_id}"
        )

    # ==================== Listing Methods ====================

    async def create_draft_listing(
        self,
        shop_id: int,
        etsy_shop_id: str,
        listing_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create a draft listing on Etsy.

        Args:
            shop_id: Internal shop ID
            etsy_shop_id: Etsy shop ID
            listing_data: Listing details (title, description, price, etc.)

        Returns:
            dict: Created listing data
        """
        return await self._make_request(
            shop_id,
            "POST",
            f"/application/shops/{etsy_shop_id}/listings",
            json=listing_data
        )

    async def update_listing(
        self,
        shop_id: int,
        listing_id: str,
        listing_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update an existing listing."""
        return await self._make_request(
            shop_id,
            "PUT",
            f"/application/listings/{listing_id}",
            json=listing_data
        )

    async def upload_listing_image(
        self,
        shop_id: int,
        etsy_shop_id: str,
        listing_id: str,
        image_data: bytes,
        rank: int = 1
    ) -> Dict[str, Any]:
        """
        Upload an image to a listing.

        Args:
            shop_id: Internal shop ID
            etsy_shop_id: Etsy shop ID
            listing_id: Listing ID
            image_data: Image file bytes
            rank: Image position (1 = primary)

        Returns:
            dict: Uploaded image data
        """
        files = {"image": image_data}
        data = {"rank": rank}

        return await self._make_request(
            shop_id,
            "POST",
            f"/application/shops/{etsy_shop_id}/listings/{listing_id}/images",
            files=files,
            data=data
        )

    async def publish_listing(
        self,
        shop_id: int,
        listing_id: str
    ) -> Dict[str, Any]:
        """
        Activate/publish a draft listing.
        """
        return await self._make_request(
            shop_id,
            "PUT",
            f"/application/listings/{listing_id}",
            json={"state": "active"}
        )

    async def get_listing(
        self,
        shop_id: int,
        listing_id: str
    ) -> Dict[str, Any]:
        """Get listing details."""
        return await self._make_request(
            shop_id,
            "GET",
            f"/application/listings/{listing_id}"
        )

    async def delete_listing(
        self,
        shop_id: int,
        listing_id: str
    ) -> None:
        """Delete a listing."""
        await self._make_request(
            shop_id,
            "DELETE",
            f"/application/listings/{listing_id}"
        )

    # ==================== Transaction/Order Methods ====================

    async def get_shop_receipts(
        self,
        shop_id: int,
        etsy_shop_id: str,
        limit: int = 25,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Get shop receipts (orders).

        Args:
            shop_id: Internal shop ID
            etsy_shop_id: Etsy shop ID
            limit: Number of receipts to return
            offset: Pagination offset

        Returns:
            dict: Receipt data with results array
        """
        params = {
            "limit": limit,
            "offset": offset,
        }

        return await self._make_request(
            shop_id,
            "GET",
            f"/application/shops/{etsy_shop_id}/receipts",
            params=params
        )

    async def get_receipt(
        self,
        shop_id: int,
        etsy_shop_id: str,
        receipt_id: str
    ) -> Dict[str, Any]:
        """Get a specific receipt/order."""
        return await self._make_request(
            shop_id,
            "GET",
            f"/application/shops/{etsy_shop_id}/receipts/{receipt_id}"
        )
