"""
Rate Limiting Service using Redis Token Bucket Algorithm
Implements per-shop rate limiting for Etsy API calls
"""
import time
from typing import Optional
from redis import Redis
from app.core.config import settings


class RateLimiter:
    """
    Token bucket rate limiter using Redis.

    Etsy API limits:
    - Open API v3: 10,000 requests per day (approximately 7 requests per minute sustained)
    - Burst capacity: We'll use 100 tokens to allow bursts
    - Refill rate: 0.5 tokens per second (30 per minute)
    """

    def __init__(self, redis_client: Redis):
        self.redis = redis_client
        self.capacity = settings.ETSY_RATE_LIMIT_CAPACITY  # 100 tokens
        self.refill_rate = settings.ETSY_RATE_LIMIT_REFILL_PER_SEC  # 0.5 tokens/sec

    def _get_bucket_key(self, shop_id: int) -> str:
        """Generate Redis key for shop's token bucket"""
        return f"rate_limit:shop:{shop_id}"

    def _get_bucket_data(self, key: str) -> tuple[float, float]:
        """
        Get current tokens and last refill time from Redis.
        Returns (tokens, last_update_time)
        """
        data = self.redis.hmget(key, "tokens", "last_update")

        if data[0] is None or data[1] is None:
            # Initialize bucket
            current_time = time.time()
            self.redis.hset(
                key,
                mapping={
                    "tokens": str(self.capacity),
                    "last_update": str(current_time)
                }
            )
            return (float(self.capacity), current_time)

        return (float(data[0]), float(data[1]))

    def _refill_tokens(self, current_tokens: float, last_update: float) -> float:
        """
        Calculate tokens after refill based on elapsed time.
        """
        now = time.time()
        elapsed = now - last_update

        # Calculate new tokens based on refill rate
        new_tokens = min(
            self.capacity,
            current_tokens + (elapsed * self.refill_rate)
        )

        return new_tokens

    async def acquire(self, shop_id: int, tokens: int = 1) -> bool:
        """
        Try to acquire tokens from the bucket.
        Returns True if successful, False if rate limited.

        Args:
            shop_id: The shop ID to rate limit
            tokens: Number of tokens to consume (default 1)

        Returns:
            bool: True if tokens acquired, False if rate limited
        """
        key = self._get_bucket_key(shop_id)

        # Get current bucket state
        current_tokens, last_update = self._get_bucket_data(key)

        # Refill tokens based on elapsed time
        available_tokens = self._refill_tokens(current_tokens, last_update)

        # Check if we have enough tokens
        if available_tokens >= tokens:
            # Consume tokens
            new_tokens = available_tokens - tokens
            now = time.time()

            self.redis.hset(
                key,
                mapping={
                    "tokens": str(new_tokens),
                    "last_update": str(now)
                }
            )

            return True

        return False

    async def wait_for_token(self, shop_id: int, tokens: int = 1, max_wait: float = 60.0) -> bool:
        """
        Wait until tokens are available (with timeout).

        Args:
            shop_id: The shop ID to rate limit
            tokens: Number of tokens needed
            max_wait: Maximum seconds to wait (default 60)

        Returns:
            bool: True if tokens acquired, False if timeout
        """
        start_time = time.time()

        while time.time() - start_time < max_wait:
            if await self.acquire(shop_id, tokens):
                return True

            # Calculate wait time based on refill rate
            wait_time = min(tokens / self.refill_rate, 1.0)
            time.sleep(wait_time)

        return False

    async def get_available_tokens(self, shop_id: int) -> float:
        """
        Get the current number of available tokens for a shop.
        """
        key = self._get_bucket_key(shop_id)
        current_tokens, last_update = self._get_bucket_data(key)
        return self._refill_tokens(current_tokens, last_update)

    async def reset_bucket(self, shop_id: int) -> None:
        """
        Reset the token bucket for a shop (useful for testing).
        """
        key = self._get_bucket_key(shop_id)
        self.redis.delete(key)

    async def get_wait_time(self, shop_id: int, tokens: int = 1) -> float:
        """
        Calculate how long to wait (in seconds) before tokens are available.

        Returns:
            float: Seconds to wait, or 0 if tokens are immediately available
        """
        available = await self.get_available_tokens(shop_id)

        if available >= tokens:
            return 0.0

        # Calculate time needed to accumulate required tokens
        tokens_needed = tokens - available
        wait_time = tokens_needed / self.refill_rate

        return wait_time


# Singleton instance
_rate_limiter: Optional[RateLimiter] = None


def get_rate_limiter(redis_client: Redis) -> RateLimiter:
    """
    Get or create the rate limiter singleton.
    """
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter(redis_client)
    return _rate_limiter
