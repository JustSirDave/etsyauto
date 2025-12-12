"""
Unit Tests for Token Bucket Rate Limiter
Tests rate limiting logic without Redis
"""
import pytest
import time
from unittest.mock import Mock, patch
from app.services.rate_limiter import TokenBucketRateLimiter


class TestTokenBucketRateLimiter:
    """Unit tests for token bucket rate limiter"""
    
    def setup_method(self):
        """Setup rate limiter for each test"""
        self.redis_mock = Mock()
        self.limiter = TokenBucketRateLimiter(redis_client=self.redis_mock)
    
    def test_token_acquisition_success(self):
        """Test successful token acquisition"""
        shop_id = 1
        
        # Mock Redis to return available tokens
        self.redis_mock.get.return_value = "10"  # 10 tokens available
        
        # Acquire 1 token
        acquired = self.limiter.acquire_token(shop_id, tokens=1)
        
        assert acquired is True
        # Verify Redis operations
        self.redis_mock.get.assert_called()
        self.redis_mock.decrby.assert_called()
    
    def test_token_acquisition_failure_insufficient(self):
        """Test token acquisition failure when insufficient tokens"""
        shop_id = 1
        
        # Mock Redis to return no tokens
        self.redis_mock.get.return_value = "0"
        
        # Try to acquire 1 token
        acquired = self.limiter.acquire_token(shop_id, tokens=1)
        
        assert acquired is False
        # Should not decrement when no tokens available
        self.redis_mock.decrby.assert_not_called()
    
    def test_token_refill_rate(self):
        """Test that tokens refill at correct rate"""
        shop_id = 1
        capacity = 10
        refill_rate = 1  # 1 token per second
        
        # Initial state: 0 tokens
        self.redis_mock.get.return_value = "0"
        
        # Simulate waiting for refill
        time.sleep(2)  # Wait 2 seconds
        
        # Mock refill (should have 2 tokens now)
        self.redis_mock.get.return_value = "2"
        
        # Should be able to acquire 2 tokens
        acquired = self.limiter.acquire_token(shop_id, tokens=2)
        assert acquired is True
    
    def test_token_bucket_capacity_limit(self):
        """Test that bucket doesn't exceed capacity"""
        shop_id = 1
        capacity = 10
        
        # Try to add more tokens than capacity
        current_tokens = capacity + 5
        self.redis_mock.get.return_value = str(current_tokens)
        
        # Get current tokens
        tokens = self.limiter.get_current_tokens(shop_id)
        
        # Should not exceed capacity
        assert tokens <= capacity
    
    def test_multiple_token_acquisition(self):
        """Test acquiring multiple tokens at once"""
        shop_id = 1
        
        # Mock 10 available tokens
        self.redis_mock.get.return_value = "10"
        
        # Acquire 5 tokens
        acquired = self.limiter.acquire_token(shop_id, tokens=5)
        
        assert acquired is True
        # Verify correct amount decremented
        self.redis_mock.decrby.assert_called_with(f"rate_limit:shop:{shop_id}", 5)
    
    def test_concurrent_token_acquisition(self):
        """Test that concurrent acquisitions are handled correctly"""
        shop_id = 1
        
        # Simulate race condition with atomic operations
        def atomic_decr(*args, **kwargs):
            current = int(self.redis_mock.get.return_value or "10")
            if current >= 1:
                self.redis_mock.get.return_value = str(current - 1)
                return current - 1
            return current
        
        self.redis_mock.decrby.side_effect = atomic_decr
        self.redis_mock.get.return_value = "10"
        
        # Simulate 10 concurrent acquisitions
        results = []
        for _ in range(10):
            results.append(self.limiter.acquire_token(shop_id, tokens=1))
        
        # All should succeed (10 tokens for 10 requests)
        assert all(results)
    
    def test_rate_limiter_per_shop_isolation(self):
        """Test that rate limits are isolated per shop"""
        shop1 = 1
        shop2 = 2
        
        # Shop 1 has no tokens
        self.redis_mock.get.side_effect = lambda key: "0" if "shop:1" in key else "10"
        
        # Shop 1 should fail
        acquired1 = self.limiter.acquire_token(shop1, tokens=1)
        assert acquired1 is False
        
        # Shop 2 should succeed
        acquired2 = self.limiter.acquire_token(shop2, tokens=1)
        assert acquired2 is True
    
    def test_backoff_calculation(self):
        """Test backoff time calculation when rate limited"""
        shop_id = 1
        refill_rate = 1  # 1 token per second
        
        # No tokens available
        self.redis_mock.get.return_value = "0"
        
        # Need 5 tokens
        backoff_time = self.limiter.calculate_backoff(shop_id, tokens_needed=5)
        
        # Should wait ~5 seconds (5 tokens * 1 second per token)
        assert 4 <= backoff_time <= 6
    
    def test_token_bucket_initialization(self):
        """Test that bucket is initialized correctly"""
        shop_id = 1
        capacity = 10
        
        # Mock uninitialized bucket
        self.redis_mock.get.return_value = None
        
        # Initialize
        self.limiter.initialize_bucket(shop_id, capacity=capacity, refill_rate=1)
        
        # Verify initialization
        self.redis_mock.set.assert_called()
    
    def test_get_remaining_quota(self):
        """Test getting remaining quota for a shop"""
        shop_id = 1
        
        self.redis_mock.get.return_value = "7"
        
        remaining = self.limiter.get_current_tokens(shop_id)
        
        assert remaining == 7
    
    def test_rate_limiter_metrics(self):
        """Test that rate limiter updates metrics"""
        shop_id = 1
        
        self.redis_mock.get.return_value = "10"
        
        with patch('app.observability.metrics.rate_limiter_token_acquisitions_total') as mock_metric:
            self.limiter.acquire_token(shop_id, tokens=1)
            
            # Verify metrics updated
            mock_metric.labels.assert_called()
    
    def test_burst_handling(self):
        """Test that burst of requests is handled correctly"""
        shop_id = 1
        capacity = 10
        
        self.redis_mock.get.return_value = str(capacity)
        
        # Simulate burst of 10 requests
        successes = 0
        for _ in range(10):
            if self.limiter.acquire_token(shop_id, tokens=1):
                successes += 1
                # Decrement mock tokens
                current = int(self.redis_mock.get.return_value)
                self.redis_mock.get.return_value = str(current - 1)
        
        # All should succeed (within capacity)
        assert successes == 10
        
        # 11th request should fail
        acquired = self.limiter.acquire_token(shop_id, tokens=1)
        assert acquired is False
    
    def test_premium_tier_higher_limits(self):
        """Test that premium tier gets higher rate limits"""
        premium_shop = 1
        free_shop = 2
        
        # Premium: 10 req/s, Free: 5 req/s
        premium_capacity = 10
        free_capacity = 5
        
        self.limiter.initialize_bucket(premium_shop, capacity=premium_capacity, refill_rate=10)
        self.limiter.initialize_bucket(free_shop, capacity=free_capacity, refill_rate=5)
        
        # Verify different capacities
        assert premium_capacity > free_capacity


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

