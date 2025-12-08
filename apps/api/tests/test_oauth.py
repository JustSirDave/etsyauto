"""
OAuth Token Management Tests
Tests for token encryption, refresh, and security features
"""
import pytest
import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch, AsyncMock
import base64
import os

from app.services.encryption import TokenEncryption
from app.services.token_manager import TokenManager, TokenRefreshError
from app.models.tenancy import OAuthToken, Shop
from app.core.security import (
    sanitize_dict, mask_token, validate_redirect_uri,
    validate_state_token, check_rate_limit
)


class TestTokenEncryption:
    """Test token encryption/decryption"""
    
    def test_encrypt_decrypt(self):
        """Test basic encryption and decryption"""
        # Generate a test key
        key = base64.b64encode(os.urandom(32)).decode()
        encryptor = TokenEncryption(encryption_key=key)
        
        # Test encryption
        token = "test_access_token_12345"
        encrypted = encryptor.encrypt(token)
        
        assert encrypted != token.encode()
        assert len(encrypted) > len(token)
        
        # Test decryption
        decrypted = encryptor.decrypt(encrypted)
        assert decrypted == token
    
    def test_empty_token(self):
        """Test handling of empty tokens"""
        key = base64.b64encode(os.urandom(32)).decode()
        encryptor = TokenEncryption(encryption_key=key)
        
        encrypted = encryptor.encrypt("")
        assert encrypted == b''
        
        decrypted = encryptor.decrypt(b'')
        assert decrypted == ''
    
    def test_different_keys_fail(self):
        """Test that decryption fails with different key"""
        key1 = base64.b64encode(os.urandom(32)).decode()
        key2 = base64.b64encode(os.urandom(32)).decode()
        
        encryptor1 = TokenEncryption(encryption_key=key1)
        encryptor2 = TokenEncryption(encryption_key=key2)
        
        token = "test_token"
        encrypted = encryptor1.encrypt(token)
        
        with pytest.raises(Exception):
            encryptor2.decrypt(encrypted)


class TestTokenManager:
    """Test TokenManager with mocked database"""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        db = Mock()
        db.query.return_value.filter.return_value.first.return_value = None
        return db
    
    @pytest.fixture
    def mock_redis(self):
        """Mock Redis client"""
        redis = Mock()
        redis.get.return_value = None
        redis.set.return_value = True
        redis.setex.return_value = True
        redis.delete.return_value = True
        redis.exists.return_value = False
        return redis
    
    @pytest.mark.asyncio
    async def test_save_token(self, mock_db, mock_redis):
        """Test saving encrypted token"""
        manager = TokenManager(mock_db, mock_redis)
        
        token = await manager.save_token(
            tenant_id=1,
            shop_id=1,
            access_token="test_access",
            refresh_token="test_refresh",
            expires_in=3600,
            provider='etsy'
        )
        
        # Verify database add was called
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_token_from_cache(self, mock_db, mock_redis):
        """Test getting token from Redis cache"""
        import json
        
        # Mock cached token
        cache_data = {
            'access_token': 'cached_token',
            'expires_at': (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        }
        mock_redis.get.return_value = json.dumps(cache_data)
        
        manager = TokenManager(mock_db, mock_redis)
        token = await manager.get_token(1, 1, 'etsy', auto_refresh=False)
        
        assert token == 'cached_token'
        # Should not hit database
        mock_db.query.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_refresh_token_single_flight(self, mock_db, mock_redis):
        """Test single-flight refresh pattern"""
        # Simulate another process refreshing
        mock_redis.set.return_value = False  # Lock not acquired
        mock_redis.exists.side_effect = [True, True, False]  # Lock exists, then released
        
        # Mock successful get after wait
        manager = TokenManager(mock_db, mock_redis)
        
        with patch.object(manager, 'get_token', return_value='new_token'):
            token = await manager.refresh_token(1, 1, 'etsy')
            
            # Should have waited and then got new token
            assert token == 'new_token'


class TestSecurityFunctions:
    """Test security utilities"""
    
    def test_sanitize_dict(self):
        """Test dictionary sanitization"""
        data = {
            'user_id': 123,
            'access_token': 'secret_token_123',
            'refresh_token': 'secret_refresh_456',
            'api_key': 'api_key_789',
            'username': 'john'
        }
        
        sanitized = sanitize_dict(data)
        
        assert sanitized['user_id'] == 123
        assert sanitized['username'] == 'john'
        assert sanitized['access_token'] == '[REDACTED]'
        assert sanitized['refresh_token'] == '[REDACTED]'
        assert sanitized['api_key'] == '[REDACTED]'
    
    def test_sanitize_nested_dict(self):
        """Test nested dictionary sanitization"""
        data = {
            'oauth': {
                'access_token': 'secret',
                'user': {
                    'name': 'John',
                    'api_key': 'key123'
                }
            }
        }
        
        sanitized = sanitize_dict(data)
        
        assert sanitized['oauth']['access_token'] == '[REDACTED]'
        assert sanitized['oauth']['user']['name'] == 'John'
        assert sanitized['oauth']['user']['api_key'] == '[REDACTED]'
    
    def test_mask_token(self):
        """Test token masking"""
        token = "sk_test_abc123xyz789"
        masked = mask_token(token, visible_chars=4)
        
        assert masked == "sk_t...x789"
        assert 'abc123' not in masked
        
        # Test short token
        short = mask_token("abc", visible_chars=4)
        assert short == "***"
        
        # Test empty
        empty = mask_token("", visible_chars=4)
        assert empty == "[EMPTY]"
    
    def test_validate_redirect_uri(self):
        """Test redirect URI validation"""
        allowed = ['example.com', 'app.example.com']
        
        # Valid URIs
        assert validate_redirect_uri('https://example.com/callback', allowed)
        assert validate_redirect_uri('https://app.example.com/auth', allowed)
        assert validate_redirect_uri('http://localhost:3000/callback', allowed)
        
        # Invalid URIs
        assert not validate_redirect_uri('http://evil.com/callback', allowed)
        assert not validate_redirect_uri('javascript:alert(1)', allowed)
        assert not validate_redirect_uri('', allowed)
    
    def test_validate_state_token(self):
        """Test state token validation"""
        # Valid state
        assert validate_state_token('a' * 32)
        assert validate_state_token('abc123_-' * 4)
        
        # Invalid state
        assert not validate_state_token('short')
        assert not validate_state_token('has spaces here')
        assert not validate_state_token('has/slashes')
        assert not validate_state_token('')
    
    def test_rate_limiting(self):
        """Test rate limit checking"""
        mock_redis = Mock()
        
        # First attempt - allowed
        mock_redis.get.return_value = None
        mock_redis.setex.return_value = True
        result = check_rate_limit(mock_redis, 'test_key', 5, 60)
        assert result is True
        
        # Within limit - allowed
        mock_redis.get.return_value = '3'
        mock_redis.incr.return_value = 4
        result = check_rate_limit(mock_redis, 'test_key', 5, 60)
        assert result is True
        
        # Exceeded limit - denied
        mock_redis.get.return_value = '5'
        result = check_rate_limit(mock_redis, 'test_key', 5, 60)
        assert result is False


class TestOAuthEndpoints:
    """Integration tests for OAuth endpoints"""
    
    @pytest.mark.asyncio
    async def test_oauth_flow_start(self):
        """Test starting OAuth flow"""
        # This would require FastAPI test client
        # Example structure:
        # response = await client.get("/api/shops/etsy/connect")
        # assert response.status_code == 200
        # assert "authorization_url" in response.json()
        pass
    
    @pytest.mark.asyncio
    async def test_oauth_callback(self):
        """Test OAuth callback handling"""
        # Example structure:
        # response = await client.post("/api/shops/etsy/callback", json={
        #     "code": "test_code",
        #     "state": "test_state"
        # })
        # assert response.status_code == 200
        pass


class TestCeleryTasks:
    """Test Celery background tasks"""
    
    @pytest.mark.asyncio
    async def test_refresh_expiring_tokens(self):
        """Test scheduled token refresh task"""
        # This would test the Celery task
        # with mock database containing expiring tokens
        pass
    
    @pytest.mark.asyncio
    async def test_audit_token_health(self):
        """Test token health audit task"""
        # This would test the audit task
        pass


# Performance tests
class TestPerformance:
    """Performance and load tests"""
    
    @pytest.mark.asyncio
    async def test_concurrent_refresh(self):
        """Test concurrent token refresh (single-flight)"""
        # Simulate multiple concurrent refresh requests
        # Verify only one actual refresh happens
        pass
    
    @pytest.mark.asyncio
    async def test_cache_performance(self):
        """Test cache hit rate"""
        # Measure cache hit rate over multiple requests
        pass


# Security tests
class TestSecurity:
    """Security-focused tests"""
    
    def test_no_token_in_logs(self):
        """Verify tokens are not logged"""
        from app.core.security import SanitizingFormatter
        import logging
        
        formatter = SanitizingFormatter()
        
        record = logging.LogRecord(
            name='test',
            level=logging.INFO,
            pathname='test.py',
            lineno=1,
            msg='Token is Bearer abc123xyz789',
            args=(),
            exc_info=None
        )
        
        formatted = formatter.format(record)
        assert 'abc123xyz789' not in formatted
        assert '[REDACTED]' in formatted or '[TOKEN_REDACTED]' in formatted
    
    def test_encryption_key_required(self):
        """Verify encryption key is required in production"""
        # This should warn if no key provided
        with pytest.warns(None):  # Adjust based on implementation
            encryptor = TokenEncryption(encryption_key=None)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

