

# 🔒 Security Hardening Guide

## 📋 Overview

This document describes the comprehensive security measures implemented in the Etsy Automation Platform.

## 🛡️ Security Features Implemented

### 1. Secrets Management ✅
**Never commit secrets to version control**

#### Features:
- ✅ Centralized secrets loading from environment or secrets vault
- ✅ Support for Docker secrets (`/run/secrets/`)
- ✅ Support for Kubernetes secrets
- ✅ AWS Secrets Manager compatible (optional)
- ✅ HashiCorp Vault compatible (optional)
- ✅ Required secrets validation on startup
- ✅ Secret masking for logging

#### Implementation:
**File**: `apps/api/app/core/secrets_manager.py`

```python
from app.core.secrets_manager import get_secrets_manager

secrets = get_secrets_manager()

# Get secrets (priority: env → file → cache)
database_url = secrets.get_database_url()
encryption_key = secrets.get_encryption_key()
etsy_secret = secrets.get_etsy_client_secret()

# Validate all required secrets
secrets.validate_required_secrets()

# Mask secrets for logging
masked = secrets.mask_secret(api_key, visible_chars=4)
logger.info(f"API Key: {masked}")  # Logs: "API Key: sk-1****"
```

#### Setup:

**Option 1: Environment Variables**
```bash
export DATABASE_URL="postgresql://..."
export ENCRYPTION_KEY="base64-encoded-key"
export JWT_PRIVATE_KEY="$(cat jwt-private.pem)"
export JWT_PUBLIC_KEY="$(cat jwt-public.pem)"
```

**Option 2: Docker Secrets**
```bash
echo "my-secret-value" | docker secret create DATABASE_URL -
```

**Option 3: Kubernetes Secrets**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: etsy-secrets
type: Opaque
data:
  DATABASE_URL: base64-encoded-value
  ENCRYPTION_KEY: base64-encoded-value
```

---

### 2. JWT with RS256 ✅
**Asymmetric signing with short-lived tokens**

#### Features:
- ✅ RS256 algorithm (RSA + SHA-256)
- ✅ Short-lived access tokens (15 minutes)
- ✅ Long-lived refresh tokens (7 days)
- ✅ Proper JWT claims (iss, aud, exp, iat, sub, nbf, jti)
- ✅ Token type enforcement (access, refresh, api_key)
- ✅ Key rotation support
- ✅ Token revocation via JWT ID (jti)

#### Implementation:
**File**: `apps/api/app/core/jwt_manager.py`

```python
from app.core.jwt_manager import get_jwt_manager, TokenType

jwt = get_jwt_manager()

# Create access token (15 min)
access_token = jwt.create_access_token(
    user_id=123,
    tenant_id=456,
    role="admin",
    shop_ids=[1, 2, 3]
)

# Create refresh token (7 days)
refresh_token = jwt.create_refresh_token(
    user_id=123,
    tenant_id=456
)

# Verify token
payload = jwt.verify_token(access_token, expected_type=TokenType.ACCESS)
user_id = int(payload["sub"])
tenant_id = payload["tenant_id"]
role = payload["role"]
```

#### JWT Claims:
| Claim | Description | Example |
|-------|-------------|---------|
| `iss` | Issuer | `"etsy-automation-api"` |
| `aud` | Audience | `"etsy-automation-platform"` |
| `sub` | Subject (user ID) | `"123"` |
| `iat` | Issued at | `1702345678` |
| `exp` | Expiration | `1702346578` (15 min later) |
| `nbf` | Not before | `1702345678` |
| `type` | Token type | `"access"` / `"refresh"` |
| `tenant_id` | Tenant ID | `456` |
| `role` | User role | `"admin"` |
| `shop_ids` | Accessible shops | `[1, 2, 3]` |
| `key_version` | Key version (rotation) | `"v1"` |

#### Generate RS256 Keys:
```bash
# Generate private key
openssl genrsa -out jwt-private.pem 2048

# Extract public key
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem

# Set as environment variables
export JWT_PRIVATE_KEY="$(cat jwt-private.pem)"
export JWT_PUBLIC_KEY="$(cat jwt-public.pem)"
```

---

### 3. Secure Cookies ✅
**HttpOnly, SameSite, Secure flags**

#### Features:
- ✅ HttpOnly flag (prevent XSS)
- ✅ SameSite=Lax for access tokens (allow top-level navigation)
- ✅ SameSite=Strict for refresh tokens (prevent CSRF)
- ✅ Secure flag in production (HTTPS only)
- ✅ Path restriction for refresh tokens
- ✅ Proper max-age and expiration
- ✅ CSRF token support

#### Implementation:
**File**: `apps/api/app/core/cookie_manager.py`

```python
from app.core.cookie_manager import get_cookie_manager
from starlette.responses import Response

cookies = get_cookie_manager()

# Set access token cookie
response = Response()
cookies.set_access_token_cookie(response, access_token)
# → HttpOnly, SameSite=Lax, Secure (prod), max-age=900

# Set refresh token cookie
cookies.set_refresh_token_cookie(response, refresh_token)
# → HttpOnly, SameSite=Strict, Secure (prod), max-age=604800, path=/api/auth/refresh

# Delete cookies (logout)
cookies.delete_all_auth_cookies(response)
```

#### Cookie Security Matrix:

| Cookie | HttpOnly | SameSite | Secure (Prod) | Path | Max-Age |
|--------|----------|----------|---------------|------|---------|
| `access_token` | ✅ Yes | Lax | ✅ Yes | `/` | 15 min |
| `refresh_token` | ✅ Yes | Strict | ✅ Yes | `/api/auth/refresh` | 7 days |
| `csrf_token` | ❌ No (JS needs it) | Strict | ✅ Yes | `/` | 15 min |

#### Security Headers:
```python
headers = cookies.get_cookie_security_headers()
# → X-Content-Type-Options: nosniff
# → X-XSS-Protection: 1; mode=block
# → X-Frame-Options: DENY
# → Referrer-Policy: strict-origin-when-cross-origin
# → Strict-Transport-Security: max-age=31536000 (prod only)
```

---

### 4. Token Encryption at Rest ✅
**AES encryption with key rotation**

#### Features:
- ✅ Fernet encryption (AES-128-CBC + HMAC-SHA256)
- ✅ OAuth tokens encrypted in database
- ✅ API keys hashed (SHA-256)
- ✅ Zero-downtime key rotation
- ✅ Multi-key support during rotation
- ✅ Automatic re-encryption

#### Implementation:
**File**: `apps/api/app/core/encryption_manager.py`

```python
from app.core.encryption_manager import get_encryption_manager

enc = get_encryption_manager()

# Encrypt sensitive data
access_token = "ya29.a0AfH6SMBx..."
encrypted = enc.encrypt(access_token)
# Store `encrypted` in database

# Decrypt when needed
decrypted = enc.decrypt(encrypted)

# Encrypt specific dictionary fields
data = {"username": "john", "password": "secret", "email": "john@example.com"}
encrypted_data = enc.encrypt_dict(data, fields_to_encrypt=["password"])
# → {"username": "john", "password": "gAAAABf...", "email": "john@example.com"}

# Decrypt
decrypted_data = enc.decrypt_dict(encrypted_data, fields_to_decrypt=["password"])
```

#### Generate Encryption Key:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# → ENCRYPTION_KEY=... (32-byte base64-encoded key)
```

#### Key Rotation (Zero-Downtime):
```python
# 1. Generate new key
new_key = EncryptionManager.generate_key()

# 2. Rotate (old key kept for decryption)
enc.rotate_key(new_key)

# 3. Re-encrypt all data (background job)
for token in db.query(OAuthToken).all():
    token.access_token = enc.re_encrypt(token.access_token)
    token.refresh_token = enc.re_encrypt(token.refresh_token)
db.commit()

# 4. Clean up old keys
enc.cleanup_old_keys(max_rotation_keys=1)
```

---

### 5. Key Rotation ✅
**Support for rotating signing and encryption keys**

#### JWT Key Rotation:
```python
from app.core.jwt_manager import get_jwt_manager

jwt = get_jwt_manager()

# Generate new RS256 key pair
# openssl genrsa -out jwt-private-v2.pem 2048
# openssl rsa -in jwt-private-v2.pem -pubout -out jwt-public-v2.pem

# Rotate keys
jwt.rotate_keys(new_private_key, new_public_key)
# → New tokens signed with v2
# → Old tokens (v1) still verified during grace period
```

#### Encryption Key Rotation:
```python
from app.core.encryption_manager import get_encryption_manager

enc = get_encryption_manager()

# Step 1: Add new key (old key still works)
new_key = EncryptionManager.generate_key()
enc.rotate_key(new_key)

# Step 2: Re-encrypt all data
# (Run as background Celery task)
from app.worker.tasks.key_rotation import re_encrypt_all_tokens
re_encrypt_all_tokens.delay()

# Step 3: Remove old keys
enc.cleanup_old_keys()
```

#### Rotation Schedule:
- **JWT Keys**: Rotate every 90 days
- **Encryption Keys**: Rotate every 180 days
- **API Keys**: Rotate per-key basis (90 day expiration)

---

### 6. Role-Based API Keys ✅
**Scoped keys for service-to-service auth**

#### Features:
- ✅ Service-specific API keys
- ✅ Scope-based permissions (minimal privilege)
- ✅ Tenant-scoped keys (multi-tenancy)
- ✅ Secure key hashing (SHA-256)
- ✅ Safe rotation and revocation
- ✅ Expiration tracking
- ✅ Last-used audit

#### Implementation:
**File**: `apps/api/app/core/api_key_manager.py`

```python
from app.core.api_key_manager import get_api_key_manager, APIKeyScope

api_keys = get_api_key_manager()

# Generate API key
key_data = api_keys.generate_api_key(
    service_name="data-sync-service",
    scopes=[
        APIKeyScope.READ_PRODUCTS,
        APIKeyScope.READ_LISTINGS,
    ],
    tenant_id=1,
    expires_days=90,
    description="Sync service for tenant 1"
)

# Save to database (NEVER log the key!)
db.add(APIKey(
    key_hash=key_data["key_hash"],
    service_name=key_data["service_name"],
    scopes=key_data["scopes"],
    tenant_id=key_data["tenant_id"],
    expires_at=key_data["expires_at"]
))
db.commit()

# Return key to user (ONLY ONCE)
print(f"Your API key: {key_data['api_key']}")
# → "etsy_data_sync_<random-64-chars>"
```

#### Available Scopes:
| Scope | Description | Level |
|-------|-------------|-------|
| `products:read` | Read products | Read-only |
| `listings:read` | Read listings | Read-only |
| `orders:read` | Read orders | Read-only |
| `audit:read` | Read audit logs | Read-only |
| `products:write` | Create/update products | Write |
| `listings:write` | Create/update listings | Write |
| `listings:publish` | Publish listings to Etsy | Write |
| `shops:manage` | Manage shops | Admin |
| `team:manage` | Manage team members | Admin |
| `system:admin` | Full system access | System |

#### Verify API Key:
```python
from fastapi import Header, HTTPException

async def verify_api_key_dependency(
    x_api_key: str = Header(...),
    db: Session = Depends(get_db)
):
    try:
        key_info = api_keys.verify_api_key(
            api_key=x_api_key,
            db=db,
            required_scopes=[APIKeyScope.READ_PRODUCTS]
        )
        return key_info
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
```

#### Rotate API Key:
```python
# Rotate (creates new, revokes old)
new_key_data = api_keys.rotate_api_key(
    old_key_id=123,
    db=db,
    expires_days=90
)

# Return new key to service
print(f"New API key: {new_key_data['api_key']}")
```

---

## 🧪 Security Tests

### Run Security Tests:
```bash
docker exec etsy-api python -m pytest tests/test_security.py -v
```

### Test Coverage:
- ✅ JWT RS256 signing
- ✅ JWT required claims (iss, aud, sub, exp, iat, nbf)
- ✅ Short-lived access tokens (15 min)
- ✅ Token expiration verification
- ✅ Issuer/audience validation
- ✅ Encryption/decryption cycle
- ✅ Encryption key rotation
- ✅ API key generation & hashing
- ✅ API key scope validation
- ✅ Cookie HttpOnly flag
- ✅ Cookie SameSite settings
- ✅ Cookie Secure flag (production)
- ✅ Secrets loading from environment
- ✅ Secret masking for logging

---

## 🚀 Production Deployment Checklist

### 1. Secrets Setup
- [ ] Generate RS256 key pair for JWT
- [ ] Generate Fernet encryption key
- [ ] Store secrets in vault (AWS Secrets Manager, HashiCorp Vault, etc.)
- [ ] Configure secrets in environment or Docker/K8s secrets
- [ ] Verify no secrets in version control

### 2. HTTPS Configuration
- [ ] Obtain SSL certificate
- [ ] Configure reverse proxy (Nginx, Caddy, etc.)
- [ ] Enforce HTTPS redirects
- [ ] Enable HSTS headers

### 3. Environment Configuration
```bash
# Required
ENVIRONMENT=production
DATABASE_URL=...
REDIS_URL=...
ENCRYPTION_KEY=...
JWT_PRIVATE_KEY=...
JWT_PUBLIC_KEY=...
ETSY_CLIENT_SECRET=...

# Optional
COOKIE_DOMAIN=.yourdomain.com
SENTRY_DSN=...
```

### 4. Security Headers
Configure in reverse proxy:
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### 5. Rate Limiting
- [ ] Configure rate limiting in reverse proxy or API gateway
- [ ] Set appropriate limits per endpoint
- [ ] Monitor for abuse

### 6. Monitoring
- [ ] Setup Sentry for error tracking
- [ ] Monitor failed authentication attempts
- [ ] Alert on suspicious activity
- [ ] Track API key usage

---

## 📚 Best Practices

### Never Do:
❌ Commit secrets to Git  
❌ Log secrets (access tokens, API keys, passwords)  
❌ Store tokens in plaintext  
❌ Use HS256 for JWT (use RS256)  
❌ Create long-lived access tokens  
❌ Skip HTTPS in production  
❌ Ignore expired tokens  
❌ Grant excessive API key scopes  

### Always Do:
✅ Use environment variables or secrets vault  
✅ Encrypt sensitive data at rest  
✅ Use short-lived access tokens (15 min)  
✅ Set HttpOnly, SameSite, Secure on auth cookies  
✅ Verify JWT issuer, audience, expiration  
✅ Rotate keys regularly  
✅ Grant minimal API key scopes  
✅ Audit API key usage  

---

## 🔗 Related Documentation

- [Secrets Manager](./apps/api/app/core/secrets_manager.py)
- [JWT Manager](./apps/api/app/core/jwt_manager.py)
- [Encryption Manager](./apps/api/app/core/encryption_manager.py)
- [API Key Manager](./apps/api/app/core/api_key_manager.py)
- [Cookie Manager](./apps/api/app/core/cookie_manager.py)
- [Security Tests](./apps/api/tests/test_security.py)
- [Sentry Setup](./SENTRY_SETUP.md)

---

**Last Updated**: December 2025  
**Security Review Date**: December 2025  
**Next Review**: March 2026  
**Status**: ✅ Production-Ready

