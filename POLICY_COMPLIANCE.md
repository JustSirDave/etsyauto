# Policy Compliance Enforcement System

## Overview

The Policy Compliance Enforcement system ensures all Etsy listings meet platform policies **before publication**. The system follows a "fail closed" approach: non-compliant listings are blocked from publishing until violations are resolved.

## Features

### ✅ Pre-Publish Checks
- **Handmade Requirement**: Detects if listing indicates item is handmade
- **Prohibited Terms**: Blocks terms like "replica", "counterfeit", "fake"
- **Prohibited Claims**: Prevents medical/health claims ("cure", "treat", "FDA approved")
- **Required Fields**: Validates title, description, price, quantity
- **Character Limits**: Title (1-140 chars), Description (50+ recommended)
- **Tag Limits**: Max 13 tags, 20 characters each
- **Promotional Language**: Warns about "sale", "discount" in titles

### 🔒 Fail Closed Enforcement
- Listings with **critical violations** cannot be published
- Listings with **warnings** can publish (but review recommended)
- Policy status stored on `listing_jobs` and `ai_generations`
- Celery tasks check policy before calling Etsy API

### 🔧 Remediation Workflow
1. Run policy check → Get violation details
2. Update content (title/description/tags)
3. Re-check policy → Verify compliance
4. Retry publish if compliant

## Database Schema

### AIGeneration Table
```sql
-- Policy fields on AI generations
policy_status VARCHAR(20)  -- 'passed', 'failed', 'warning', 'pending'
policy_flags JSONB         -- List of violations
policy_checked_at TIMESTAMP
can_publish INTEGER        -- 0=blocked, 1=allowed
```

### ListingJob Table
```sql
-- Policy fields on listing jobs
policy_status VARCHAR(20)  -- 'passed', 'failed', 'warning', 'pending'
policy_flags JSONB         -- List of violations
policy_checked_at TIMESTAMP
policy_block_reason TEXT   -- Human-readable reason
status VARCHAR(20)         -- Includes 'policy_blocked' state
```

## API Endpoints

### Policy Compliance API (`/api/policy`)

#### 1. Check Product Policy
```http
GET /api/policy/product/{product_id}/check
Authorization: Bearer {token}
```

**Response:**
```json
{
  "compliant": true,
  "policy_status": "passed",
  "policy_flags": [],
  "can_publish": true,
  "remediation_required": false,
  "checks": {
    "title": {"passed": true, "severity": "passed"},
    "description": {"passed": true, "severity": "passed"},
    "tags": {"passed": true, "severity": "passed"},
    "required_fields": {"passed": true, "severity": "passed"},
    "handmade": {"passed": true, "severity": "passed"}
  }
}
```

#### 2. Re-check After Updates
```http
POST /api/policy/product/{product_id}/recheck
Authorization: Bearer {token}
```

Updates AIGeneration policy status and returns fresh compliance results.

#### 3. Remediate AI Generation
```http
POST /api/policy/generation/{generation_id}/remediate
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Updated title",
  "description": "Updated description",
  "tags": ["tag1", "tag2"]
}
```

Updates content and automatically re-checks policy.

#### 4. Get Job Policy Status
```http
GET /api/policy/job/{job_id}/policy-status
Authorization: Bearer {token}
```

Returns policy status for a specific listing job.

#### 5. Retry After Remediation
```http
POST /api/policy/job/{job_id}/retry-after-remediation
Authorization: Bearer {token}
```

Re-checks policy and retries publishing if compliant.

## Policy Rules

### Critical Violations (Block Publish)

| Rule | Description | Flag |
|------|-------------|------|
| **Prohibited Terms** | replica, counterfeit, fake, knockoff | `title_prohibited_terms`, `description_prohibited_terms` |
| **Prohibited Claims** | cure, treat, heal, FDA approved | `description_prohibited_claims` |
| **Title Too Long** | >140 characters | `title_too_long` |
| **Missing Title** | Empty or missing | `title_empty` |
| **Missing Description** | Empty or missing | `description_empty` |
| **Too Many Tags** | >13 tags | `tags_too_many` |
| **Tag Too Long** | >20 characters | `tags_too_long` |
| **Missing Required Fields** | price, quantity missing | `required_missing_fields` |

### Warnings (Allow Publish)

| Rule | Description | Flag |
|------|-------------|------|
| **No Handmade Indication** | Missing "handmade" or similar | `handmade_no_handmade_indication` |
| **Promotional Language** | "sale", "discount" in title | `title_promotional_language` |
| **Short Description** | <50 characters | `description_too_short` |

## Frontend UI Components

### 1. PolicyStatusBanner
Displays policy compliance status with violations and actions.

**Features:**
- Color-coded status (green/yellow/red)
- Expandable violation details
- "Fix Issues" and "Re-check" buttons

**Usage:**
```tsx
import { PolicyStatusBanner } from '@/components/products/PolicyStatusBanner';

<PolicyStatusBanner
  policyCheck={policyCheck}
  onRemediate={() => setShowRemediationModal(true)}
  onRecheck={handleRecheck}
/>
```

### 2. RemediationModal
Modal for fixing policy violations.

**Features:**
- Shows violation guidance
- Editable title/description/tags
- Character counters
- Policy guidelines
- Auto re-check on save

**Usage:**
```tsx
import { RemediationModal } from '@/components/products/RemediationModal';

<RemediationModal
  productId={product.id}
  generationId={generation.id}
  currentTitle={generation.title}
  currentDescription={generation.description}
  currentTags={generation.tags}
  policyFlags={policyCheck.policy_flags}
  onClose={() => setShowModal(false)}
  onSave={handleRemediation}
/>
```

## Celery Integration

### Publish Task Flow

```python
# apps/api/app/worker/tasks/listing_tasks.py

def publish_listing(self, job_id: int):
    # ... load job, product, shop ...
    
    # ==== POLICY CHECK (PRE-PUBLISH) ====
    policy_checker = ListingPolicyChecker(db)
    compliance_result = policy_checker.check_listing_compliance(mock_listing, product)
    
    # Store policy results
    job.policy_status = compliance_result["policy_status"]
    job.policy_flags = compliance_result["policy_flags"]
    job.policy_checked_at = datetime.utcnow()
    
    # FAIL CLOSED: Block if non-compliant
    if not compliance_result["can_publish"]:
        job.status = "policy_blocked"
        job.policy_block_reason = f"Policy violations: {', '.join(compliance_result['policy_flags'])}"
        db.commit()
        return {"success": False, "error": "policy_blocked", ...}
    
    # Proceed with publish...
    etsy_client.create_listing(...)
```

## Testing

### Test Coverage

- ✅ Compliant products can publish
- ✅ Prohibited terms block publishing
- ✅ Missing handmade shows warning (doesn't block)
- ✅ Missing required fields block publishing
- ✅ Title >140 chars blocks
- ✅ >13 tags block
- ✅ Remediation flow (update → re-check → pass)
- ✅ Policy status stored on ListingJob
- ✅ Fail closed behavior (any critical → block)
- ✅ Warnings don't block

### Run Tests

```bash
docker exec etsy-api python -m pytest tests/test_policy_basic.py -v
```

## RBAC Permissions

| Permission | Required For |
|-----------|-------------|
| `READ_PRODUCT` | Check product policy |
| `UPDATE_PRODUCT` | Re-check, remediate |
| `PUBLISH_LISTING` | Retry after remediation |

## Audit Logging

All policy actions are logged:
- `policy.check` - Policy check performed
- `policy.recheck` - Policy re-check after update
- `policy.remediate` - Content updated for compliance
- `policy.retry_after_remediation` - Job retried after fix

## Configuration

### Prohibited Terms
Configured in `apps/api/app/services/policy_engine.py`:

```python
BANNED_TERMS = [
    "replica", "counterfeit", "fake", "knockoff",
    "copyright", "trademark", ...
]
```

### Handmade Indicators
```python
HANDMADE_TERMS = [
    "handmade", "hand made", "hand-made", "handcrafted",
    "artisan", "custom made", "made to order", "bespoke"
]
```

## Example: Complete Workflow

### 1. Generate AI Content
```http
POST /api/products/123/generate
```

### 2. Check Policy
```http
GET /api/policy/product/123/check

Response: {
  "can_publish": false,
  "policy_flags": ["title_prohibited_terms", "description_too_short"],
  "checks": {
    "title": {
      "violations": ["prohibited_terms"],
      "details": {"prohibited_terms_found": ["replica"]}
    }
  }
}
```

### 3. Remediate
```http
POST /api/policy/generation/456/remediate
{
  "title": "Handmade Silver Necklace",
  "description": "Beautiful handmade necklace crafted with care..."
}

Response: {
  "policy_check": {
    "can_publish": true,
    "policy_status": "passed"
  }
}
```

### 4. Publish
```http
POST /api/listings/publish
{
  "product_id": 123,
  "shop_id": 1
}
```

Celery task automatically re-checks policy before calling Etsy API.

## Troubleshooting

### Issue: Listing stuck in `policy_blocked`
**Solution:** Use retry endpoint after fixing content:
```http
POST /api/policy/job/{job_id}/retry-after-remediation
```

### Issue: Policy check passes but still can't publish
**Check:**
1. Verify `ai_generation.can_publish = 1`
2. Check `listing_job.policy_status != 'failed'`
3. Review audit logs for policy actions

### Issue: Policy flags not clearing after update
**Solution:** Always call `/recheck` after content updates to refresh policy status.

## Future Enhancements

- [ ] Machine learning for policy prediction
- [ ] Bulk policy checks
- [ ] Policy violation analytics dashboard
- [ ] Custom policy rules per tenant
- [ ] Policy violation trends over time

---

**Created:** December 2025  
**Status:** ✅ Production Ready  
**Compliance:** Etsy Marketplace Policies v2025

