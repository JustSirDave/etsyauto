# OAuth 2.0 Implementation Guide

## Overview

This document describes the production-ready Etsy OAuth 2.0 implementation with automatic token refresh, encryption, and security features.

## Features

### ✅ Implemented Features

1. **OAuth 2.0 Flow with PKCE**
   - Secure authorization code flow
   - State parameter for CSRF protection
   - Code challenge/verifier for added security

2. **Token Encryption at Rest**
   - AES-GCM encryption for access and refresh tokens
   - 256-bit encryption keys
   - Encrypted storage in PostgreSQL BYTEA columns

3. **Automatic Token Refresh**
   - Single-flight refresh pattern (prevents thundering herd)
   - Distributed locks using Redis
   - Automatic retry on 401 errors
   - Proactive refresh before expiry

4. **Scheduled Token Refresh**
   - Celery Beat task runs hourly
   - Refreshes tokens expiring within 24 hours
   - Prevents service disruptions

5. **Token Caching**
   - Redis cache for fast token access
   - Automatic cache invalidation
   - TTL-based expiry

6. **Security Features**
   - Rate limiting on OAuth operations
   - Sensitive data sanitization in logs
   - HTTPS-only redirects (configurable for dev)
   - Security headers on OAuth endpoints

7. **Middleware/Dependencies**
   - `ShopContext` for automatic token injection
   - `get_shop_context` dependency for FastAPI routes
   - Seamless integration with existing endpoints

## Architecture

```
┌─────────────────┐
│   Frontend      │
│  (React/Next)   │
└────────┬────────┘
         │
         │ 1. User clicks "Connect Shop"
         ▼
┌─────────────────┐
│  FastAPI API    │
│  /shops/etsy/   │
│    connect      │
└────────┬────────┘
         │
         │ 2. Generate auth URL with PKCE
         ▼
┌─────────────────┐
│   Etsy OAuth    │
│  Authorization  │
└────────┬────────┘
         │
         │ 3. User authorizes
         ▼
┌─────────────────┐
│  OAuth Callback │
│  /shops/etsy/   │
│    callback     │
└────────┬────────┘
         │
         │ 4. Exchange code for tokens
         ▼
┌─────────────────┐
│ Token Manager   │
│  - Encrypt      │
│  - Store in DB  │
│  - Cache Redis  │
└────────┬────────┘
         │
         │ 5. Token ready for API calls
         ▼
┌─────────────────┐
│ Etsy API Client │
│  - Auto refresh │
│  - Rate limit   │
│  - Retry 401    │
└─────────────────┘
```

## Database Schema

### `oauth_tokens` Table

```sql
CREATE TABLE oauth_tokens (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT NOT NULL REFERENCES shops(id),
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('etsy', 'printful')),
    
    -- Encrypted tokens
    access_token BYTEA NOT NULL,
    refresh_token BYTEA,
    
    -- Metadata
    expires_at TIMESTAMPTZ NOT NULL,
    scopes TEXT,
    
    -- Refresh tracking
    last_refreshed_at TIMESTAMPTZ,
    refresh_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    UNIQUE(shop_id, provider)
);

CREATE INDEX idx_oauth_tokens_tenant_shop ON oauth_tokens(tenant_id, shop_id);
CREATE INDEX idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);
```

## Configuration

### Required Environment Variables

```bash
# OAuth
ETSY_CLIENT_ID=your_client_id
ETSY_CLIENT_SECRET=your_client_secret
ETSY_REDIRECT_URI=https://yourdomain.com/api/auth/callback/etsy

# Encryption (REQUIRED for production)
# Generate with: python -c "import base64; import os; print(base64.b64encode(os.urandom(32)).decode())"
ENCRYPTION_KEY=base64_encoded_32_byte_key

# Redis (for caching and distributed locks)
REDIS_URL=redis://localhost:6379/0

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/etsy_platform

# Celery (for scheduled refresh)
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

### Generating Encryption Key

**Python:**
```python
import base64
import os

key = base64.b64encode(os.urandom(32)).decode()
print(f"ENCRYPTION_KEY={key}")
```

**OpenSSL:**
```bash
openssl rand -base64 32
```

## API Endpoints

### 1. Start OAuth Flow

```http
GET /api/shops/etsy/connect
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "authorization_url": "https://www.etsy.com/oauth/connect?..."
}
```

### 2. OAuth Callback

```http
POST /api/shops/etsy/callback
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "code": "authorization_code",
  "state": "state_from_step_1"
}
```

**Response:**
```json
{
  "message": "Shop connected successfully",
  "shop": {
    "id": 1,
    "etsy_shop_id": "12345678",
    "display_name": "My Shop",
    "status": "connected"
  }
}
```

### 3. Manual Token Refresh

```http
POST /api/shops/{shop_id}/refresh-token
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "message": "Token refreshed successfully",
  "expires_at": "2025-12-09T12:00:00Z",
  "refresh_count": 5
}
```

### 4. Disconnect Shop

```http
DELETE /api/shops/{shop_id}
Authorization: Bearer <jwt_token>
```

## Usage Examples

### Using ShopContext Dependency

```python
from fastapi import APIRouter, Depends
from app.api.dependencies.oauth import get_shop_context, ShopContext

router = APIRouter()

@router.get("/products")
async def list_products(
    shop_ctx: ShopContext = Depends(get_shop_context)
):
    """List products for a shop - token auto-refreshed if needed"""
    
    # Get access token (automatically refreshes if expired)
    token = await shop_ctx.get_access_token()
    
    # Use token to call Etsy API
    # The token is guaranteed to be valid
    ...
```

### Using EtsyClient (Token Auto-Refresh Built-In)

```python
from app.services.etsy_client import EtsyClient

@router.get("/listings")
async def get_listings(
    shop_id: int,
    db: Session = Depends(get_db)
):
    """Etsy client handles token refresh automatically"""
    
    client = EtsyClient(db)
    
    # Client will:
    # 1. Get token from TokenManager
    # 2. Check if expired, refresh if needed
    # 3. Make API call
    # 4. Retry with fresh token on 401
    listings = await client.get_shop_receipts(shop_id, etsy_shop_id)
    
    return listings
```

### Direct Token Manager Usage

```python
from app.services.token_manager import TokenManager
import redis

@router.get("/custom")
async def custom_endpoint(
    db: Session = Depends(get_db)
):
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    token_manager = TokenManager(db, redis_client)
    
    # Get token (auto-refresh)
    token = await token_manager.get_token(
        tenant_id=1,
        shop_id=1,
        provider='etsy',
        auto_refresh=True
    )
    
    # Force refresh
    new_token = await token_manager.refresh_token(
        tenant_id=1,
        shop_id=1,
        provider='etsy'
    )
```

## Celery Tasks

### Scheduled Tasks

**`refresh_expiring_tokens`** - Runs every hour
- Finds tokens expiring in next 24 hours
- Refreshes them proactively
- Logs success/failure

**`audit_token_health`** - Manual trigger
- Reports token statistics
- Identifies issues

### Manual Tasks

```python
from app.worker.tasks.token_tasks import refresh_single_token

# Trigger manual refresh
result = refresh_single_token.delay(
    tenant_id=1,
    shop_id=1,
    provider='etsy'
)
```

## Security Best Practices

### 1. Encryption at Rest ✅
- All tokens encrypted with AES-GCM
- Encryption key stored in environment variable
- Never commit encryption keys to git

### 2. Logging Sanitization ✅
- Sensitive data redacted from logs
- Use `SanitizingFormatter` for production logs
- Token values never logged

### 3. HTTPS Only
- Production must use HTTPS
- OAuth redirects validated against allowed domains
- Localhost allowed only in development

### 4. Rate Limiting ✅
- OAuth start: 10 attempts/hour per tenant
- Manual refresh: 5 attempts/10 minutes per shop
- Prevents abuse and brute force

### 5. State Validation ✅
- State parameter prevents CSRF
- Stored in Redis with 10-minute TTL
- Validated on callback

### 6. Token Minimization
- Tokens cached with TTL
- Cache cleared on disconnect
- Expired tokens cleaned periodically

## Monitoring & Observability

### Logging

```python
import logging
from app.core.security import SanitizingFormatter

# Configure sanitizing logger
handler = logging.StreamHandler()
handler.setFormatter(SanitizingFormatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))

logger = logging.getLogger('oauth')
logger.addHandler(handler)
```

### Metrics to Track

1. **Token Refresh Success Rate**
   - Track in `oauth_tokens.refresh_count`
   - Alert on high failure rate

2. **Token Age**
   - Monitor `oauth_tokens.last_refreshed_at`
   - Alert on stale tokens

3. **API Error Rates**
   - 401 errors (auth failures)
   - 429 errors (rate limit)

4. **Celery Task Health**
   - Task success/failure rates
   - Task duration

## Troubleshooting

### Token Refresh Fails

**Symptoms:**
- 401 errors from Etsy API
- "Token refresh failed" errors

**Solutions:**
1. Check if refresh token is valid (not revoked by user)
2. Verify ETSY_CLIENT_ID and ETSY_CLIENT_SECRET
3. Check network connectivity to api.etsy.com
4. Review Celery worker logs for detailed errors

### Tokens Not Refreshing Automatically

**Symptoms:**
- Tokens expire without refresh
- Scheduled task not running

**Solutions:**
1. Ensure Celery Beat is running: `celery -A app.worker.celery_app beat`
2. Check Redis connectivity
3. Verify `refresh_expiring_tokens` task is scheduled
4. Check Celery worker logs

### Encryption Errors

**Symptoms:**
- "Failed to decrypt token" errors
- Authentication failures after restart

**Solutions:**
1. Verify ENCRYPTION_KEY environment variable is set
2. Ensure key hasn't changed (would invalidate all tokens)
3. Check key is base64-encoded 32-byte value
4. Re-encrypt tokens if key changed

### Rate Limit Issues

**Symptoms:**
- "Too many OAuth attempts" errors
- Redis connection errors

**Solutions:**
1. Verify Redis is running and accessible
2. Check rate limit values in code
3. Clear rate limit keys manually if needed: `redis-cli DEL rate_limit:*`

## Testing

### Unit Tests

```python
import pytest
from app.services.token_manager import TokenManager

@pytest.mark.asyncio
async def test_token_refresh():
    """Test token refresh with single-flight pattern"""
    # Setup
    token_manager = TokenManager(db, redis_client)
    
    # Test refresh
    token = await token_manager.refresh_token(1, 1, 'etsy')
    
    assert token is not None
    assert len(token) > 0
```

### Integration Tests

```python
@pytest.mark.asyncio
async def test_oauth_flow():
    """Test end-to-end OAuth flow"""
    
    # 1. Get auth URL
    response = await client.get("/api/shops/etsy/connect")
    assert "authorization_url" in response.json()
    
    # 2. Simulate callback
    response = await client.post("/api/shops/etsy/callback", json={
        "code": "test_code",
        "state": "test_state"
    })
    assert response.status_code == 200
    
    # 3. Verify token stored
    token = await token_manager.get_token(1, 1, 'etsy')
    assert token is not None
```

### Manual Testing

1. **Test OAuth Flow:**
   ```bash
   # 1. Start API server
   make dev-api
   
   # 2. Get auth URL
   curl -H "Authorization: Bearer $JWT" \
        http://localhost:8000/api/shops/etsy/connect
   
   # 3. Open URL in browser, authorize
   
   # 4. Complete callback (automatically handled by frontend)
   ```

2. **Test Token Refresh:**
   ```bash
   # Force refresh
   curl -X POST -H "Authorization: Bearer $JWT" \
        http://localhost:8000/api/shops/1/refresh-token
   ```

3. **Test Scheduled Refresh:**
   ```bash
   # Trigger manually
   celery -A app.worker.celery_app call app.worker.tasks.token_tasks.refresh_expiring_tokens
   ```

## Migration Guide

### Step 1: Run Database Migration

```bash
cd apps/api
alembic upgrade head
```

This adds:
- `tenant_id` column to `oauth_tokens`
- `scopes`, `last_refreshed_at`, `refresh_count` columns
- Performance indexes

### Step 2: Set Encryption Key

```bash
# Generate key
python -c "import base64; import os; print(base64.b64encode(os.urandom(32)).decode())"

# Add to .env
echo "ENCRYPTION_KEY=<generated_key>" >> .env
```

### Step 3: Re-encrypt Existing Tokens (if any)

If you have existing tokens stored as plain text, run this migration:

```python
# migration script
from app.services.encryption import token_encryptor
from app.models.tenancy import OAuthToken

tokens = db.query(OAuthToken).all()
for token in tokens:
    if isinstance(token.access_token, str):
        token.access_token = token_encryptor.encrypt(token.access_token)
        token.refresh_token = token_encryptor.encrypt(token.refresh_token)
db.commit()
```

### Step 4: Start Celery Worker & Beat

```bash
# Worker
celery -A app.worker.celery_app worker -l info

# Beat (scheduled tasks)
celery -A app.worker.celery_app beat -l info
```

### Step 5: Update Frontend (if needed)

No frontend changes required - OAuth flow is backward compatible.

## Performance Considerations

### Redis Caching
- **Hit rate:** ~95% (tokens cached until near-expiry)
- **Memory:** ~1KB per cached token
- **TTL:** Expires 5 minutes before token expiry

### Database Queries
- **Indexed lookups:** Fast via `(tenant_id, shop_id)` index
- **Token refresh query:** O(1) with shop_id lookup

### Concurrency
- **Single-flight refresh:** Only one refresh per shop at a time
- **Distributed locks:** 30-second timeout
- **Wait time:** Other requests wait up to 25s for refresh to complete

### Rate Limiting
- **OAuth starts:** 10/hour per tenant (prevents abuse)
- **Manual refresh:** 5/10min per shop (prevents excessive refreshes)
- **Etsy API:** Handled by separate rate limiter

## Production Checklist

- [ ] ENCRYPTION_KEY set in production environment
- [ ] HTTPS enabled for all OAuth redirects
- [ ] Celery worker and beat processes running
- [ ] Redis available and persistent
- [ ] Database backups enabled
- [ ] Monitoring/alerting configured
- [ ] Log sanitization enabled
- [ ] Rate limiting configured
- [ ] Security headers applied
- [ ] Token cleanup scheduled (optional)

## Support

For issues or questions:
1. Check logs: `/var/log/etsy-automation/api.log`
2. Check Celery logs: `/var/log/etsy-automation/celery.log`
3. Review this documentation
4. Contact the development team

## License

Internal use only - Etsy Automation Platform

