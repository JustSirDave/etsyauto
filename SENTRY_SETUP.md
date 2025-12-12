# Sentry Setup Guide

## 🎯 Overview

This document describes the Sentry error tracking setup for the Etsy Automation Platform.

## 📦 What's Included

### 1. SDK Integration
- ✅ FastAPI (Python backend)
- ✅ Celery workers
- ✅ Next.js frontend

### 2. Features
- ✅ Automatic error capture
- ✅ Context tagging (tenant_id, shop_id, request_id, job_id)
- ✅ PII scrubbing (no emails, passwords, tokens)
- ✅ Secret redaction (no API keys, tokens)
- ✅ Breadcrumb tracking
- ✅ Performance monitoring
- ✅ Release tracking

### 3. Runbooks
- ✅ [OAuth Failure](./runbooks/OAUTH_FAILURE.md)
- ✅ [Rate Limit 429 Storm](./runbooks/RATE_LIMIT_429_STORM.md)
- ✅ [Queue Saturation](./runbooks/QUEUE_SATURATION.md)

### 4. Issue Templates
- ✅ OAuth errors
- ✅ Rate limit errors
- ✅ Worker/queue errors
- ✅ Auto-linked to runbooks

## 🚀 Setup Instructions

### 1. Create Sentry Project

1. Go to [sentry.io](https://sentry.io)
2. Create a new organization (or use existing)
3. Create three projects:
   - **etsy-automation-api** (Python/FastAPI)
   - **etsy-automation-worker** (Python/Celery)
   - **etsy-automation-web** (JavaScript/Next.js)

### 2. Get DSN Keys

For each project, get the DSN:
- Navigate to: Settings → Projects → [Your Project] → Client Keys (DSN)
- Copy the DSN URL

### 3. Configure Environment Variables

Update `.env` file:

```bash
# Backend DSN (API + Worker use same)
SENTRY_DSN=https://xxxx@o000000.ingest.sentry.io/1111111

# Frontend DSN (separate project)
NEXT_PUBLIC_SENTRY_DSN=https://yyyy@o000000.ingest.sentry.io/2222222

# Environment
ENVIRONMENT=production  # or development, staging

# Release version
RELEASE_VERSION=1.0.0  # Update on each deploy
```

### 4. Test Integration

#### Backend Test:
```bash
docker exec etsy-api python -c "
from app.core.sentry_config import initialize_sentry, capture_exception_with_context
initialize_sentry()
try:
    raise Exception('Test Sentry Backend')
except Exception as e:
    capture_exception_with_context(e, tenant_id=1, shop_id=1)
print('✅ Sentry backend test sent')
"
```

#### Worker Test:
```bash
docker exec etsy-worker python -c "
from app.core.sentry_config import initialize_sentry
import sentry_sdk
initialize_sentry()
sentry_sdk.capture_message('Test Sentry Worker', level='info')
print('✅ Sentry worker test sent')
"
```

#### Frontend Test:
Open browser console on http://localhost:3000:
```javascript
import { captureSentryException } from '@/lib/sentry';
captureSentryException(new Error('Test Sentry Frontend'), { tenantId: '1' });
console.log('✅ Sentry frontend test sent');
```

Check Sentry dashboard - you should see the test errors.

## 🔒 PII & Secret Protection

### Automatically Scrubbed Fields

**Secrets:**
- password, token, secret, api_key, access_token, refresh_token
- authorization, cookie, csrf, jwt, key, apikey, auth
- client_secret, private_key, encryption_key, bearer, credentials

**PII:**
- email, phone, ssn, credit_card, card_number, cvv
- address, first_name, last_name, full_name, name
- ip_address, user_agent, location, zip, postal_code

### Verification

After integration, check a Sentry issue:
1. Go to issue → "Additional Data"
2. Verify sensitive fields show `[REDACTED]` or `[PII]`
3. Check breadcrumbs don't contain passwords/tokens

## 🏷️ Context Tags

Every error is tagged with:

| Tag | Description | Example |
|-----|-------------|---------|
| `tenant_id` | Which tenant | `"123"` |
| `shop_id` | Which Etsy shop | `"456"` |
| `request_id` | Request correlation ID | `"uuid..."` |
| `job_id` | Celery job ID | `"789"` |
| `environment` | Environment | `"production"` |
| `release` | Software version | `"1.0.0"` |

Use these tags to filter issues:
```
tenant_id:123 environment:production
```

## 📊 Issue Templates

### Linking Runbooks to Issues

Sentry will automatically link issues to runbooks based on error patterns:

| Error Pattern | Template | Runbook |
|---------------|----------|---------|
| OAuth errors | [OAUTH_ERROR.md](./.sentry/issue-templates/OAUTH_ERROR.md) | [OAuth Failure](./runbooks/OAUTH_FAILURE.md) |
| 429 / RateLimitError | [RATE_LIMIT_ERROR.md](./.sentry/issue-templates/RATE_LIMIT_ERROR.md) | [Rate Limit Storm](./runbooks/RATE_LIMIT_429_STORM.md) |
| Celery / Queue errors | [WORKER_ERROR.md](./.sentry/issue-templates/WORKER_ERROR.md) | [Queue Saturation](./runbooks/QUEUE_SATURATION.md) |

### Customizing Templates

Edit files in `.sentry/issue-templates/` and update `.sentry/config.yml`.

## 🔔 Alert Configuration

### 1. Create Alert Rules in Sentry

Navigate to: Alerts → Create Alert Rule

**Example: OAuth Failures**
```yaml
Conditions:
  - Event count > 10
  - Time window: 5 minutes
  - Filter: error.type:OAuthError

Actions:
  - Send notification to #alerts-critical (Slack)
  - Assign to: backend-team
```

**Example: Rate Limit Storm**
```yaml
Conditions:
  - Event count > 50
  - Time window: 5 minutes
  - Filter: http.status_code:429

Actions:
  - Send notification to #alerts-critical (Slack)
  - Trigger PagerDuty
```

### 2. Integrate with Slack

1. Sentry → Settings → Integrations → Slack
2. Connect workspace
3. Configure notification rules:
   - Critical alerts → #alerts-critical
   - Warning alerts → #alerts-warning

### 3. Integrate with GitHub

1. Sentry → Settings → Integrations → GitHub
2. Connect repository
3. Enable:
   - ✅ Suspect commits
   - ✅ Stack trace linking
   - ✅ Release tracking

## 📈 Performance Monitoring

Sentry tracks:
- API endpoint latency
- Database query performance
- External API call duration (Etsy, OpenAI)
- Celery task execution time

View in Sentry → Performance.

### Sample Rates

Configured in `.env`:
```bash
SENTRY_TRACES_SAMPLE_RATE=0.1  # 10% of transactions
SENTRY_PROFILES_SAMPLE_RATE=0.1  # 10% of profiles
```

Adjust based on traffic and Sentry quota.

## 🚀 Release Tracking

### On Deployment

Update release version:
```bash
# In .env
RELEASE_VERSION=1.2.3

# Or via CI/CD
export RELEASE_VERSION=$(git describe --tags)
docker-compose up -d --build
```

Sentry will:
- Track which errors are in which release
- Show if error rate increased after deployment
- Link commits to releases

### Manual Release Creation

```bash
# Using Sentry CLI
sentry-cli releases new 1.2.3
sentry-cli releases set-commits 1.2.3 --auto
sentry-cli releases finalize 1.2.3
sentry-cli releases deploys 1.2.3 new -e production
```

## 🔍 Debugging with Sentry

### Find Issues by Context

```
# All errors for a specific tenant
tenant_id:123

# Rate limit errors
http.status_code:429

# OAuth failures for a shop
error.type:OAuthError shop_id:456

# Recent critical errors
is:unresolved level:error environment:production
```

### View Breadcrumbs

Each issue shows breadcrumbs (sequence of events):
1. Request received
2. Database query executed
3. External API called
4. Error occurred

Use breadcrumbs to understand what led to the error.

### Stack Trace Linking

Sentry links stack traces to your GitHub repo:
- Click on a frame in the stack trace
- View the exact code line in GitHub
- See recent commits affecting that code

## 📝 Best Practices

### 1. Don't Over-Alert
- Start with high thresholds
- Tune based on baseline noise
- Use proper severity levels

### 2. Add Context
```python
# In your code
from app.core.sentry_config import set_sentry_context

set_sentry_context(
    tenant_id=tenant.id,
    shop_id=shop.id,
    operation="publish_listing"
)
```

### 3. Use Breadcrumbs
```python
from app.core.sentry_config import add_breadcrumb

add_breadcrumb(
    message="Starting listing publication",
    category="listing",
    level="info",
    data={"listing_id": listing.id}
)
```

### 4. Capture Non-Errors
```python
from app.core.sentry_config import capture_message_with_context

capture_message_with_context(
    "Unusual activity detected",
    level="warning",
    tenant_id=tenant.id
)
```

### 5. Respect PII
- Never log full emails/names/addresses
- Use IDs instead of personal data
- Let Sentry's scrubbing catch sensitive fields

## 🔗 Links

- [Sentry Dashboard](https://sentry.io)
- [Sentry Python Docs](https://docs.sentry.io/platforms/python/)
- [Sentry JavaScript Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Runbooks](./runbooks/README.md)
- [Observability Stack](./observability/README.md)

---

**Last Updated**: December 2025  
**Maintained by**: DevOps & Backend Teams

