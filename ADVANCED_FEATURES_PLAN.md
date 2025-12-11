# Advanced Features Implementation Plan

## Overview
Implementation of AI Generation with Policy Guardrails, Scheduling/Quotas, Audit Logging, and Policy Compliance Enforcement.

---

## 1. AI Generation with Policy Guardrails

### Components to Build:
- [ ] Policy engine with banned terms and Etsy compliance rules
- [ ] Provider abstraction (OpenAI default, support Anthropic/Gemini)
- [ ] Pre/post policy checks
- [ ] Enhanced ai_generations table with policy_flags
- [ ] UI for review/accept/reject workflow
- [ ] Tests

### Files to Create/Modify:
- `apps/api/app/services/policy_engine.py` - Policy validation
- `apps/api/app/services/ai_providers/` - Provider abstraction
  - `base.py` - Base provider interface
  - `openai_provider.py` - OpenAI implementation
  - `anthropic_provider.py` - Anthropic stub
  - `gemini_provider.py` - Gemini stub
- `apps/api/app/models/listings.py` - Add policy_flags to AIGeneration
- `apps/api/app/api/endpoints/ai.py` - Add review/accept/reject endpoints
- `apps/web/app/ai/review/page.tsx` - Review UI
- `apps/api/tests/test_policy_engine.py` - Policy tests
- `apps/api/alembic/versions/add_policy_fields.py` - Migration

---

## 2. Scheduling / Quotas (Daily per Shop)

### Components to Build:
- [ ] Quota system (150 listings/day default)
- [ ] Premium override per shop
- [ ] Celery beat integration with quota checks
- [ ] Token bucket + daily quota enforcement
- [ ] Schedule status/errors UI
- [ ] Tests

### Files to Create/Modify:
- `apps/api/app/services/quota_manager.py` - Quota management
- `apps/api/app/models/tenancy.py` - Add quota fields to Shop
- `apps/api/app/worker/tasks/schedule_tasks.py` - Enhance with quota checks
- `apps/api/app/api/endpoints/schedules.py` - Add quota info endpoints
- `apps/web/app/schedules/page.tsx` - Show quota usage
- `apps/api/tests/test_quota_manager.py` - Quota tests
- `apps/api/alembic/versions/add_shop_quotas.py` - Migration

---

## 3. Audit Logging (30-day retention)

### Components to Build:
- [ ] Enhanced audit_logs table with all required fields
- [ ] Auto-logging middleware for all operations
- [ ] 30-day TTL cleanup job
- [ ] Tenant-scoped audit API
- [ ] Audit log viewer UI
- [ ] Tests

### Files to Create/Modify:
- `apps/api/app/models/audit.py` - Enhanced AuditLog model
- `apps/api/app/middleware/audit_middleware.py` - Auto-logging
- `apps/api/app/services/audit_service.py` - Audit operations
- `apps/api/app/worker/tasks/cleanup_tasks.py` - TTL cleanup
- `apps/api/app/api/endpoints/audit.py` - Enhance endpoints
- `apps/web/app/audit/page.tsx` - Audit viewer UI
- `apps/api/tests/test_audit_logging.py` - Audit tests
- `apps/api/alembic/versions/enhance_audit_logs.py` - Migration

---

## 4. Policy Compliance Enforcement (Pre-Publish)

### Components to Build:
- [ ] Pre-publish policy validation
- [ ] Policy flags on ListingJob
- [ ] Fail-closed enforcement
- [ ] Remediation workflow
- [ ] Re-check after edits
- [ ] Tests

### Files to Create/Modify:
- `apps/api/app/services/compliance_checker.py` - Pre-publish checks
- `apps/api/app/models/listings.py` - Add compliance_status to ListingJob
- `apps/api/app/worker/tasks/listing_tasks.py` - Add pre-publish check
- `apps/api/app/api/endpoints/listings.py` - Remediation endpoints
- `apps/web/app/listings/[id]/compliance.tsx` - Compliance UI
- `apps/api/tests/test_compliance.py` - Compliance tests
- `apps/api/alembic/versions/add_compliance_fields.py` - Migration

---

## Implementation Order

### Phase 1: Policy Foundation (2-3 hours)
1. Policy engine with banned terms and rules
2. Provider abstraction layer
3. Enhanced ai_generations table
4. Basic tests

### Phase 2: AI Generation with Policies (2-3 hours)
5. Integrate policy checks in AI generation
6. Review/accept/reject API endpoints
7. Review UI
8. Comprehensive tests

### Phase 3: Scheduling & Quotas (2-3 hours)
9. Quota manager service
10. Shop quota fields and migration
11. Celery beat quota integration
12. Schedule UI enhancements
13. Quota tests

### Phase 4: Audit Logging (1-2 hours)
14. Enhanced audit model
15. Auto-logging middleware
16. TTL cleanup job
17. Audit viewer UI
18. Audit tests

### Phase 5: Compliance Enforcement (2-3 hours)
19. Pre-publish compliance checker
20. Listing compliance fields
21. Remediation workflow
22. Compliance UI
23. Compliance tests

### Phase 6: Integration & Testing (1-2 hours)
24. End-to-end integration tests
25. Documentation
26. Deployment checklist

---

## Database Schema Changes

### AIGeneration Table
```sql
ALTER TABLE ai_generations ADD COLUMN policy_flags JSONB;
ALTER TABLE ai_generations ADD COLUMN policy_status VARCHAR(20); -- passed, failed, needs_review
ALTER TABLE ai_generations ADD COLUMN reviewed_by BIGINT REFERENCES users(id);
ALTER TABLE ai_generations ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE ai_generations ADD COLUMN review_decision VARCHAR(20); -- accepted, rejected, modified
```

### Shop Table
```sql
ALTER TABLE shops ADD COLUMN daily_listing_quota INTEGER DEFAULT 150;
ALTER TABLE shops ADD COLUMN is_premium BOOLEAN DEFAULT FALSE;
ALTER TABLE shops ADD COLUMN quota_reset_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE shops ADD COLUMN quota_used_today INTEGER DEFAULT 0;
```

### AuditLog Table (Enhanced)
```sql
ALTER TABLE audit_logs ADD COLUMN request_id VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN actor_email VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN http_method VARCHAR(10);
ALTER TABLE audit_logs ADD COLUMN http_path VARCHAR(500);
ALTER TABLE audit_logs ADD COLUMN request_metadata JSONB;
ALTER TABLE audit_logs ADD COLUMN response_metadata JSONB;
ALTER TABLE audit_logs ADD COLUMN attempt_number INTEGER DEFAULT 1;
ALTER TABLE audit_logs ADD COLUMN latency_ms INTEGER;
ALTER TABLE audit_logs ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE; -- 30 days TTL
CREATE INDEX idx_audit_logs_expires_at ON audit_logs(expires_at);
```

### ListingJob Table
```sql
ALTER TABLE listing_jobs ADD COLUMN compliance_status VARCHAR(20); -- pending, passed, failed
ALTER TABLE listing_jobs ADD COLUMN compliance_flags JSONB;
ALTER TABLE listing_jobs ADD COLUMN compliance_checked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE listing_jobs ADD COLUMN remediation_required BOOLEAN DEFAULT FALSE;
```

---

## Policy Rules Configuration

### Banned Terms (Etsy Compliance)
```python
BANNED_TERMS = [
    "replica", "inspired by", "knockoff", "fake",
    "bootleg", "unauthorized", "counterfeit",
    "drop ship", "dropship", "resell", "wholesale"
]
```

### Required Terms
```python
REQUIRED_TERMS = [
    "handmade", "handcrafted", "custom made", "artisan"
]
```

### Etsy Character Limits
```python
ETSY_LIMITS = {
    "title": 140,
    "description": 1000,
    "tags": 13,
    "tag_length": 20
}
```

---

## API Endpoints to Add

### AI Generation
- POST `/api/ai/generate` - Generate with policy check
- GET `/api/ai/generations/pending-review` - Get generations needing review
- POST `/api/ai/generations/{id}/accept` - Accept generated content
- POST `/api/ai/generations/{id}/reject` - Reject generated content
- POST `/api/ai/generations/{id}/modify` - Modify and re-check

### Quotas
- GET `/api/shops/{shop_id}/quota` - Get current quota status
- POST `/api/shops/{shop_id}/quota` - Update quota (admin only)
- GET `/api/schedules/{id}/quota-status` - Schedule quota info

### Audit
- GET `/api/audit/logs` - List audit logs (tenant-scoped, paginated)
- GET `/api/audit/logs/{id}` - Get audit log details
- GET `/api/audit/stats` - Audit statistics

### Compliance
- POST `/api/listings/{id}/check-compliance` - Run compliance check
- POST `/api/listings/{id}/remediate` - Submit remediation
- GET `/api/listings/compliance-pending` - List non-compliant listings

---

## Testing Strategy

### Unit Tests
- Policy engine rules
- Provider abstraction
- Quota calculations
- Audit log creation
- Compliance checks

### Integration Tests
- End-to-end AI generation with policy
- Quota enforcement in scheduling
- Audit logging across operations
- Compliance blocking publish

### Contract Tests
- Policy rules enforcement
- Quota boundaries
- Audit log retention
- Compliance remediation flow

---

## Success Criteria

### AI Generation
- ✅ Generated content blocked if contains banned terms
- ✅ Content requires "handmade" or similar term
- ✅ Multiple providers supported (abstraction works)
- ✅ Review UI functional
- ✅ All tests passing

### Quotas
- ✅ Default 150/day enforced
- ✅ Premium override works
- ✅ Quota resets daily
- ✅ Schedule respects quota
- ✅ All tests passing

### Audit Logging
- ✅ All operations logged
- ✅ 30-day retention enforced
- ✅ Tenant isolation maintained
- ✅ Audit viewer functional
- ✅ All tests passing

### Compliance
- ✅ Non-compliant listings blocked
- ✅ Remediation workflow works
- ✅ Re-check after edits
- ✅ Compliance UI functional
- ✅ All tests passing

---

## Estimated Time: 10-14 hours total

Ready to proceed with implementation?

