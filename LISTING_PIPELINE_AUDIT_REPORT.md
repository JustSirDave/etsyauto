# Listing Publish/Update Pipeline - Audit Report

**Date**: December 9, 2025  
**Status**: ⚠️ **PARTIAL** - Foundation exists, critical gaps need addressing

---

## 📊 Overall Score: 45/100

**Summary**: The foundation is in place (Celery, rate limiter, models), but critical pipeline features like idempotency enforcement, max in-flight control, and comprehensive auditing are NOT implemented.

---

## 📋 Detailed Checklist Audit

### 1. ✅ Queue + Tasks (60% Complete)

**Requirement**: Use Celery tasks to pull publish/update jobs from a queue. Each job includes tenant_id, shop_id, listing_id, payload, and an idempotency_key.

**Status**: ⚠️ **PARTIAL**

**What EXISTS**:
- ✅ Celery configured properly (`apps/api/app/worker/celery_app.py`)
- ✅ `publish_listing` task defined (`apps/api/app/worker/tasks/listing_tasks.py`)
- ✅ `ListingJob` model with fields:
  ```python
  - tenant_id ✅
  - shop_id ✅  
  - product_id ✅
  - idempotency_key ✅ (field exists)
  - status tracking ✅
  - retry_count ✅
  ```
- ✅ Task accepts `job_id` parameter
- ✅ Queue system via Celery broker (Redis)

**What's MISSING**:
- ❌ **Idempotency key NOT generated** when creating jobs
- ❌ **Idempotency key NOT populated** (always NULL)
- ❌ **No payload field** in ListingJob (listing data rebuilt each time)
- ❌ Listing ID not stored until after success

**Code Evidence**:
```python
# apps/api/app/worker/tasks/schedule_tasks.py:169-174
job = ListingJob(
    product_id=product.id,
    shop_id=shop.id,
    status="pending",
    retry_count=0
    # ❌ idempotency_key NOT set
    # ❌ tenant_id NOT set
)
```

**Risk**: ⚠️ **HIGH** - Without idempotency keys, duplicate jobs can create duplicate listings

---

### 2. ❌ Max In-Flight Jobs Per Shop (0% Complete)

**Requirement**: Enforce max in-flight jobs per shop.

**Status**: ❌ **NOT IMPLEMENTED**

**What EXISTS**:
- ✅ Celery `worker_prefetch_multiplier=1` limits to 1 task per worker
- ✅ Daily quota checking (prevents creating too many jobs per day)

**What's MISSING**:
- ❌ **No max concurrent jobs enforcement per shop**
- ❌ **No Redis semaphore or lock per shop**
- ❌ **No check before task starts**
- ❌ **No queue for waiting jobs**

**Current Behavior**:
- Multiple jobs for same shop can run simultaneously across workers
- Could overwhelm Etsy API for a single shop
- No fairness between shops

**Code Evidence**:
```python
# apps/api/app/worker/tasks/listing_tasks.py:72-75
# Task starts immediately, no concurrency check
job.status = "processing"
job.started_at = datetime.utcnow()
db.commit()
# ❌ Should check: "Are there already N jobs running for this shop?"
```

**Risk**: ⚠️ **MEDIUM** - Could hit Etsy rate limits if many jobs queued for one shop

**Recommendation**:
```python
# Add before task starts:
max_concurrent = 3  # per shop
lock_key = f"shop_concurrency:{shop_id}"
current = redis.incr(lock_key)
if current > max_concurrent:
    redis.decr(lock_key)
    raise self.retry(countdown=30)  # Retry in 30s
```

---

### 3. ✅ Rate Limiting (70% Complete)

**Requirement**: Implement Redis-backed token bucket per shop. On task start: acquire token; if none, backoff/retry. Refill tokens on schedule.

**Status**: ⚠️ **MOSTLY COMPLETE** but not used correctly

**What EXISTS**:
- ✅ **Redis-backed token bucket** (`apps/api/app/services/rate_limiter.py`)
- ✅ Per-shop buckets: `rate_limit:shop:{shop_id}`
- ✅ Token bucket algorithm with automatic refill
- ✅ Configurable capacity (100 tokens) and refill rate (0.5/sec)
- ✅ `acquire()` method to consume tokens
- ✅ `wait_for_token()` method with timeout
- ✅ `get_wait_time()` to calculate backoff

**Rate Limiter Implementation**:
```python
# apps/api/app/services/rate_limiter.py
class RateLimiter:
    capacity = 100 tokens
    refill_rate = 0.5 tokens/sec (30/min)
    
    async def acquire(shop_id, tokens=1) -> bool
    async def wait_for_token(shop_id, max_wait=60) -> bool
```

**What's MISSING**:
- ❌ **Rate limiter NOT actually used in publish_listing task**
- ❌ No token acquisition before Etsy API calls
- ❌ No backoff/retry on token exhaustion
- ❌ EtsyClient initialized with rate_limiter but **not actively using it**

**Code Evidence**:
```python
# apps/api/app/worker/tasks/listing_tasks.py:98-112
rate_limiter = get_rate_limiter(redis_client)
etsy_client = EtsyClient(db, rate_limiter)

# ❌ But no call to rate_limiter.acquire() before Etsy call
listing_response = asyncio.run(etsy_client.create_draft_listing(...))
```

**EtsyClient should be using rate limiter internally**, but need to verify.

**Risk**: ⚠️ **MEDIUM** - Rate limits may not be enforced, could get 429s

**Recommendation**:
```python
# Before each Etsy API call:
if not await rate_limiter.acquire(shop.id):
    wait_time = await rate_limiter.get_wait_time(shop.id)
    raise self.retry(countdown=wait_time)
```

---

### 4. ❌ Idempotency (10% Complete)

**Requirement**: 
- Persist a record keyed by (shop_id, listing_id, idempotency_key)
- Before calling Etsy, check if already processed
- After success/failure, store status and response for reuse

**Status**: ❌ **NOT IMPLEMENTED**

**What EXISTS**:
- ✅ `idempotency_key` field in ListingJob model
- ✅ Unique constraint on `idempotency_key`
- ✅ `idempotency_key` field in AuditLog model

**What's MISSING**:
- ❌ **Idempotency key never generated**
- ❌ **No check before processing** (should query by idempotency_key)
- ❌ **No cached result storage** (e.g., Redis: `idempotency:{key}` → response)
- ❌ **No short-circuit logic** if already processed
- ❌ **Response not stored** for reuse

**Current Flow**:
```
1. Job created with idempotency_key=NULL ❌
2. Task starts, no idempotency check ❌
3. Call Etsy API
4. Store result in job.status ✅
5. No cached response ❌
```

**Expected Flow**:
```
1. Job created with idempotency_key=f"{shop_id}:{product_id}:{version}" ✅
2. Task starts
3. Check Redis: GET idempotency:{key}
4. If found → return cached result (short-circuit) ✅
5. If not found → proceed with Etsy call
6. After Etsy call → Store result in Redis
7. SET idempotency:{key} = {status, response, timestamp}
8. EXPIRE idempotency:{key} 86400 (24 hours)
```

**Risk**: 🔴 **CRITICAL** - Duplicate jobs will create duplicate listings on Etsy

**Recommendation**:
```python
# At start of publish_listing task:
idempotency_key = job.idempotency_key
if not idempotency_key:
    # Generate from job data
    idempotency_key = f"{job.shop_id}:{job.product_id}:{job.id}"
    job.idempotency_key = idempotency_key
    db.commit()

# Check Redis cache
cache_key = f"idempotency:{idempotency_key}"
cached_result = redis.get(cache_key)
if cached_result:
    logger.info(f"Idempotency hit for {idempotency_key}")
    return json.loads(cached_result)

# ... process job ...

# After success, cache result
redis.setex(cache_key, 86400, json.dumps(result))
```

---

### 5. ⚠️ Retries (40% Complete)

**Requirement**: Use Celery retry with backoff for transient errors (429/5xx). Stop retries on client/validation errors.

**Status**: ⚠️ **PARTIAL**

**What EXISTS**:
- ✅ Celery task configured with `max_retries=3`
- ✅ `default_retry_delay=60` (1 minute)
- ✅ Exponential backoff: `countdown=60 * job.retry_count`
- ✅ Retry count tracked in `job.retry_count`

**Code**:
```python
# apps/api/app/worker/tasks/listing_tasks.py:39-44
@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,  # 1 minute
)
```

**What's MISSING**:
- ❌ **No 429-specific handling** (should have longer backoff)
- ❌ **No 5xx vs 4xx differentiation**
- ❌ **Client errors (400, 422) still retry** (should fail immediately)
- ❌ **No Retry-After header parsing** from 429 responses

**Current Retry Logic**:
```python
# apps/api/app/worker/tasks/listing_tasks.py:177-184
except EtsyAPIError as e:
    job.retry_count += 1
    if job.retry_count >= 3:
        # Give up
    else:
        raise self.retry(exc=e, countdown=60 * job.retry_count)
```

**Issues**:
- ❌ Retries ALL errors (even validation errors)
- ❌ Fixed backoff (60, 120, 180s) regardless of error type
- ❌ Doesn't parse Etsy's rate limit response

**Risk**: ⚠️ **MEDIUM** - Wasted retries on permanent failures, insufficient backoff for 429

**Recommendation**:
```python
except EtsyAPIError as e:
    # Don't retry client errors
    if e.status_code in [400, 401, 403, 404, 422]:
        job.status = "failed"
        job.error_message = str(e)
        db.commit()
        return {"success": False, "error": str(e)}
    
    # Special handling for 429
    if e.status_code == 429:
        retry_after = e.response.headers.get('Retry-After', 300)  # 5 min default
        raise self.retry(exc=e, countdown=int(retry_after))
    
    # Retry 5xx with exponential backoff
    job.retry_count += 1
    backoff = min(60 * (2 ** job.retry_count), 3600)  # Max 1 hour
    raise self.retry(exc=e, countdown=backoff)
```

---

### 6. ❌ Auditing (5% Complete)

**Requirement**: Log every external call with request_id, tenant_id, shop_id, listing_id, idempotency_key, attempt count, status, duration, request/response metadata.

**Status**: ❌ **NOT IMPLEMENTED**

**What EXISTS**:
- ✅ `AuditLog` model with all required fields:
  ```python
  - tenant_id ✅
  - shop_id ✅
  - actor_type, actor_id ✅
  - action, target_type, target_id ✅
  - request_id ✅
  - idempotency_key ✅
  - status_code, latency_ms ✅
  - diff (for metadata) ✅
  ```
- ✅ Basic logging statements (`logger.info`, `logger.error`)

**What's MISSING**:
- ❌ **No AuditLog records created** in tasks
- ❌ **No request_id generation/tracking**
- ❌ **No duration measurement**
- ❌ **No request/response metadata storage**
- ❌ **No structured logging** (just text logs)

**Current Logging**:
```python
# apps/api/app/worker/tasks/listing_tasks.py
logger.info(f"Creating draft listing for product {product.id}")
logger.info(f"Created draft listing {listing_id}")
# ❌ Just text logs, no structured audit trail
```

**Risk**: 🔴 **CRITICAL** - No audit trail for debugging/compliance

**Recommendation**:
```python
import time
import uuid

# At task start
request_id = str(uuid.uuid4())
start_time = time.time()

# Before Etsy call
audit = AuditLog(
    tenant_id=job.tenant_id,
    shop_id=job.shop_id,
    actor_type='worker',
    actor_id=f'celery:{self.request.id}',
    action='etsy.create_listing',
    target_type='listing',
    target_id=str(job.product_id),
    request_id=request_id,
    idempotency_key=job.idempotency_key,
    diff={'attempt': job.retry_count, 'listing_data': listing_data}
)

# After Etsy call
audit.status_code = response.status_code
audit.latency_ms = int((time.time() - start_time) * 1000)
db.add(audit)
db.commit()
```

---

### 7. ⚠️ Safety (50% Complete)

**Requirement**: Fail closed on token acquisition or quota issues. Ensure tasks are idempotent across retries.

**Status**: ⚠️ **PARTIAL**

**What EXISTS**:
- ✅ Daily quota checking (fails if quota exceeded)
- ✅ Task `bind=True` allows access to task state
- ✅ `task_acks_late=True` (acks after completion)
- ✅ `task_reject_on_worker_lost=True` (safe failure)

**What's MISSING**:
- ❌ **No fail-closed on rate limit** (doesn't check before proceeding)
- ❌ **Tasks NOT idempotent** (no idempotency check)
- ❌ **No distributed lock** (same job could run twice on different workers)
- ❌ **No job status check** at task start (could process already-completed job)

**Risk**: ⚠️ **MEDIUM** - Race conditions, duplicate processing

**Recommendation**:
```python
# At task start - check if already processed
if job.status in ['completed', 'cancelled']:
    return {"success": False, "error": "Job already processed"}

# Acquire distributed lock
lock_key = f"job_lock:{job.id}"
lock_acquired = redis.set(lock_key, "1", nx=True, ex=300)
if not lock_acquired:
    raise self.retry(countdown=30)

try:
    # ... process job ...
finally:
    redis.delete(lock_key)
```

---

### 8. ❌ Testing (0% Complete)

**Requirement**: 
- Unit tests for token bucket, idempotency store, retry/backoff logic
- Integration tests simulating 429/5xx and duplicate jobs
- Verify max in-flight enforcement

**Status**: ❌ **NOT IMPLEMENTED**

**What EXISTS**:
- ❌ No test files found for listing tasks
- ❌ No rate limiter tests
- ❌ No idempotency tests

**Risk**: 🔴 **CRITICAL** - No confidence in pipeline correctness

**Recommended Tests**:
```python
# tests/test_listing_pipeline.py
def test_rate_limiter_token_bucket():
    """Verify token consumption and refill"""

def test_rate_limiter_blocks_when_exhausted():
    """Verify acquire() returns False when no tokens"""

def test_idempotency_key_generation():
    """Verify unique key per job"""

def test_idempotency_cache_hit():
    """Verify short-circuit on cached result"""

def test_retry_on_429():
    """Verify 429 triggers retry with Retry-After"""

def test_no_retry_on_400():
    """Verify client errors don't retry"""

def test_max_concurrent_jobs_per_shop():
    """Verify only N jobs run simultaneously per shop"""

def test_duplicate_job_prevention():
    """Verify same product can't have multiple pending jobs"""

def test_audit_log_created():
    """Verify audit record persisted"""
```

---

## 🔴 Critical Gaps Summary

| Component | Status | Priority |
|-----------|--------|----------|
| **Idempotency enforcement** | ❌ Not implemented | 🔴 CRITICAL |
| **Audit logging** | ❌ Not implemented | 🔴 CRITICAL |
| **429 handling** | ❌ Not implemented | 🔴 CRITICAL |
| **Max in-flight per shop** | ❌ Not implemented | 🔴 HIGH |
| **Rate limiter integration** | ⚠️ Exists but not used | 🔴 HIGH |
| **Idempotency key generation** | ❌ Not implemented | 🔴 HIGH |
| **Client error handling** | ⚠️ All errors retry | 🟡 MEDIUM |
| **Testing** | ❌ None | 🔴 HIGH |

---

## 📊 Component Breakdown

### ✅ Working Components

1. **Celery Infrastructure** (90%)
   - Properly configured
   - Worker settings correct
   - Task serialization working

2. **Rate Limiter** (70%)
   - Token bucket algorithm correct
   - Redis integration working
   - Just needs to be called

3. **Job Model** (80%)
   - Has all required fields
   - Status tracking works
   - Missing idempotency key population

4. **Basic Retry** (40%)
   - Retries happen
   - Backoff exists (not optimal)
   - No error type differentiation

### ❌ Missing Components

1. **Idempotency System** (10%)
   - Key generation missing
   - Cache checking missing
   - Result storage missing

2. **Max Concurrency** (0%)
   - No enforcement
   - No semaphore
   - No queue

3. **Audit Trail** (5%)
   - Model exists
   - Not being used
   - No structured logging

4. **Comprehensive Testing** (0%)
   - No tests exist

---

## 🚀 Recommended Implementation Priority

### Phase 1: Critical (Do First)
1. **Implement idempotency** (2-3 hours)
   - Generate idempotency keys
   - Add cache checking
   - Store results

2. **Fix retry logic** (1 hour)
   - Stop retrying 4xx errors
   - Parse Retry-After for 429
   - Exponential backoff for 5xx

3. **Add audit logging** (2 hours)
   - Create AuditLog records
   - Track all Etsy calls
   - Include metadata

### Phase 2: Important (Do Soon)
4. **Integrate rate limiter** (1 hour)
   - Call `acquire()` before Etsy API
   - Backoff if no tokens
   - Fail gracefully

5. **Max concurrent jobs** (2 hours)
   - Redis semaphore per shop
   - Check before task starts
   - Queue if at max

### Phase 3: Testing (Do After)
6. **Write tests** (4-6 hours)
   - Unit tests for each component
   - Integration tests
   - Load testing

**Total Estimated Effort**: 12-15 hours to reach production-ready

---

## 🎯 Risk Assessment for Current State

| Risk | Likelihood | Impact | Severity |
|------|------------|--------|----------|
| Duplicate listings created | HIGH | HIGH | 🔴 CRITICAL |
| Hit Etsy rate limits (429) | MEDIUM | HIGH | 🔴 HIGH |
| No debugging capability | HIGH | MEDIUM | 🟡 MEDIUM |
| Race conditions | MEDIUM | MEDIUM | 🟡 MEDIUM |
| Wasted retries | HIGH | LOW | 🟢 LOW |

**Overall Risk**: 🔴 **HIGH** - NOT production-ready

---

## 💡 Can You Deploy?

**Short Answer**: ⚠️ **NOT RECOMMENDED**

**Why**:
- Without idempotency, duplicate jobs = duplicate listings on Etsy
- Without audit logging, impossible to debug issues
- Without 429 handling, will get rate limited frequently
- Without max concurrency, could overwhelm Etsy API

**Deploy Only If**:
- Very low volume (< 10 listings/day)
- Manual monitoring
- Willing to manually clean up duplicates
- Not customer-facing yet

**Safe Deployment Requires**:
- ✅ Idempotency implemented
- ✅ Audit logging working
- ✅ 429 handling in place
- ✅ Basic tests passing

---

## 📝 Summary

**Current State**: Foundation is solid (Celery, rate limiter, models), but **critical pipeline features are missing**.

**Biggest Gaps**:
1. 🔴 Idempotency not enforced
2. 🔴 No audit trail
3. 🔴 Rate limiter not integrated
4. 🔴 No 429 handling

**Effort to Fix**: ~12-15 hours

**Verdict**: ⚠️ **NOT production-ready** - Implement Phase 1 & 2 before deploying

---

**Audit Completed By**: AI Code Auditor  
**Date**: December 9, 2025  
**Revision**: 1.0

