"""
Rate Limiting Service using Redis Token Bucket Algorithm (Atomic Lua)
Implements per-shop rate limiting for Etsy API calls.

All bucket operations are performed via a single Redis Lua script
to guarantee atomicity under concurrency.
"""
import time
from typing import Optional
from redis import Redis
from app.core.config import settings


# ──────────────────────────────────────────────────────────────
# Lua script: atomic token-bucket acquire
#
# KEYS[1]  = bucket hash key
# ARGV[1]  = capacity           (float as string)
# ARGV[2]  = refill_rate        (tokens / second, float)
# ARGV[3]  = requested_tokens   (int)
# ARGV[4]  = now                (epoch seconds, float)
#
# Returns:
#   remaining tokens (>= 0) on success
#   -1 when rate-limited (not enough tokens)
# ──────────────────────────────────────────────────────────────
_LUA_ACQUIRE = """
local key       = KEYS[1]
local capacity  = tonumber(ARGV[1])
local rate      = tonumber(ARGV[2])
local requested = tonumber(ARGV[3])
local now       = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'last_update')
local tokens
local last_update

if data[1] == false or data[2] == false then
    tokens      = capacity
    last_update = now
else
    tokens      = tonumber(data[1])
    last_update = tonumber(data[2])
end

-- Refill
local elapsed = now - last_update
tokens = math.min(capacity, tokens + elapsed * rate)

-- Try to consume
if tokens >= requested then
    tokens = tokens - requested
    redis.call('HSET', key, 'tokens', tostring(tokens), 'last_update', tostring(now))
    return tostring(tokens)
end

-- Not enough tokens – still persist the refill so clock moves forward
redis.call('HSET', key, 'tokens', tostring(tokens), 'last_update', tostring(now))
return '-1'
"""

# ──────────────────────────────────────────────────────────────
# Lua script: read available tokens (non-destructive)
# ──────────────────────────────────────────────────────────────
_LUA_PEEK = """
local key      = KEYS[1]
local capacity = tonumber(ARGV[1])
local rate     = tonumber(ARGV[2])
local now      = tonumber(ARGV[3])

local data = redis.call('HMGET', key, 'tokens', 'last_update')
if data[1] == false or data[2] == false then
    return tostring(capacity)
end

local tokens      = tonumber(data[1])
local last_update = tonumber(data[2])
local elapsed     = now - last_update
tokens = math.min(capacity, tokens + elapsed * rate)
return tostring(tokens)
"""


class RateLimiter:
    """
    Token bucket rate limiter backed by Redis with atomic Lua operations.

    Etsy API limits:
    - Open API v3: ~10 000 requests / day (~7 req/min sustained)
    - Burst capacity: configurable (default 100 tokens)
    - Refill rate: configurable (default 0.5 tokens/sec = 30/min)
    """

    def __init__(self, redis_client: Redis):
        self.redis = redis_client
        self.capacity = settings.ETSY_RATE_LIMIT_CAPACITY   # 100 tokens
        self.refill_rate = settings.ETSY_RATE_LIMIT_REFILL_PER_SEC  # 0.5 tok/s

        # Register the Lua scripts once
        self._acquire_sha: Optional[str] = None
        self._peek_sha: Optional[str] = None

    # ------------------------------------------------------------------
    # Lazy script registration (safe if Redis restarts – falls back to EVAL)
    # ------------------------------------------------------------------
    def _ensure_scripts(self) -> None:
        if self._acquire_sha is None:
            self._acquire_sha = self.redis.script_load(_LUA_ACQUIRE)
        if self._peek_sha is None:
            self._peek_sha = self.redis.script_load(_LUA_PEEK)

    def _eval_acquire(self, key: str, tokens: int) -> float:
        """Run the acquire script. Returns remaining tokens or -1."""
        self._ensure_scripts()
        now = time.time()
        try:
            result = self.redis.evalsha(
                self._acquire_sha, 1, key,
                str(self.capacity), str(self.refill_rate), str(tokens), str(now),
            )
        except Exception:
            # Script may have been flushed – fall back to EVAL
            result = self.redis.eval(
                _LUA_ACQUIRE, 1, key,
                str(self.capacity), str(self.refill_rate), str(tokens), str(now),
            )
            self._acquire_sha = None  # re-register next time
        return float(result)

    def _eval_peek(self, key: str) -> float:
        """Run the peek script. Returns available tokens."""
        self._ensure_scripts()
        now = time.time()
        try:
            result = self.redis.evalsha(
                self._peek_sha, 1, key,
                str(self.capacity), str(self.refill_rate), str(now),
            )
        except Exception:
            result = self.redis.eval(
                _LUA_PEEK, 1, key,
                str(self.capacity), str(self.refill_rate), str(now),
            )
            self._peek_sha = None
        return float(result)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def _get_bucket_key(self, shop_id: int) -> str:
        """Generate Redis key for shop's token bucket."""
        return f"rate_limit:shop:{shop_id}"

    async def acquire(self, shop_id: int, tokens: int = 1) -> bool:
        """
        Try to acquire tokens from the bucket (atomic).
        Returns True if successful, False if rate limited.
        """
        key = self._get_bucket_key(shop_id)
        remaining = self._eval_acquire(key, tokens)
        return remaining >= 0

    async def wait_for_token(self, shop_id: int, tokens: int = 1, max_wait: float = 60.0) -> bool:
        """
        Wait until tokens are available (with timeout).
        """
        start_time = time.time()
        while time.time() - start_time < max_wait:
            if await self.acquire(shop_id, tokens):
                return True
            wait_time = min(tokens / self.refill_rate, 1.0)
            time.sleep(wait_time)
        return False

    async def get_available_tokens(self, shop_id: int) -> float:
        """Get the current number of available tokens for a shop."""
        key = self._get_bucket_key(shop_id)
        return self._eval_peek(key)

    async def reset_bucket(self, shop_id: int) -> None:
        """Reset the token bucket for a shop."""
        key = self._get_bucket_key(shop_id)
        self.redis.delete(key)

    async def get_wait_time(self, shop_id: int, tokens: int = 1) -> float:
        """
        Calculate how long to wait (seconds) before tokens are available.
        Returns 0 if tokens are immediately available.
        """
        available = await self.get_available_tokens(shop_id)
        if available >= tokens:
            return 0.0
        tokens_needed = tokens - available
        return tokens_needed / self.refill_rate


# Singleton instance
_rate_limiter: Optional[RateLimiter] = None


def get_rate_limiter(redis_client: Redis) -> RateLimiter:
    """Get or create the rate limiter singleton."""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter(redis_client)
    return _rate_limiter
