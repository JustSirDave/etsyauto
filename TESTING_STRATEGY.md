# 🧪 Testing Strategy & Quality Gates

## 📋 Overview

Comprehensive testing and quality assurance strategy for the Etsy Automation Platform.

## ✅ Test Coverage Matrix

| Test Type | Coverage | Tools | CI Gate | Status |
|-----------|----------|-------|---------|--------|
| **Unit Tests** | Core logic, policies, rate limiting | Pytest | ✅ Required | ✅ Complete |
| **Contract Tests** | All API endpoints | Pytest + FastAPI TestClient | ✅ Required | ✅ Complete |
| **E2E Tests** | Complete user journeys | Pytest | ✅ Required | ✅ Complete |
| **Load Tests** | 1k listings, 10 shops | Locust | ⚠️ Manual | ✅ Complete |
| **Security Tests** | JWT, OAuth, CSV injection | Pytest + Bandit + Safety | ✅ Required | ✅ Complete |
| **Linting** | Code quality | Black, isort, Flake8 | ✅ Required | ✅ Complete |

---

## 1️⃣ Unit Tests

### **Purpose**: Test individual components in isolation

### **Test Files:**
- `tests/test_unit_policy.py` (18 tests)
- `tests/test_unit_rate_limiter.py` (15 tests)
- `tests/test_security.py` (30+ tests)
- `tests/test_sentry_scrubbing.py` (13 tests)

### **Coverage:**
✅ Policy engine (handmade requirement, prohibited terms, length limits)  
✅ Token bucket rate limiter (acquisition, refill, capacity, isolation)  
✅ JWT security (RS256, claims, expiration)  
✅ Encryption at rest (encrypt/decrypt, key rotation)  
✅ API key management (generation, hashing, scopes)  
✅ Cookie security (HttpOnly, SameSite, Secure)  
✅ Secrets management (loading, masking)  

### **Run Tests:**
```bash
docker exec etsy-api pytest tests/test_unit_*.py -v --cov=app
```

### **Expected Results:**
- ✅ 75+ tests passing
- ✅ >85% code coverage
- ✅ < 5 seconds execution time

---

## 2️⃣ Contract Tests

### **Purpose**: Validate API contracts (request/response schemas, status codes)

### **Test File:** `tests/test_contract_apis.py`

### **Coverage:**
✅ Authentication API (`/api/auth/*`)  
✅ Products API (`/api/products/*`)  
✅ Schedules API (`/api/schedules/*`)  
✅ Audit Logs API (`/api/audit-logs/*`)  
✅ Listings API (`/api/listings/*`)  
✅ Orders API (`/api/orders/*`)  

### **Validates:**
- HTTP status codes (200, 201, 400, 401, 403, 404, 409)
- Response schema (required fields, types)
- Request validation
- Error messages
- Content-Type headers

### **Run Tests:**
```bash
docker exec etsy-api pytest tests/test_contract_apis.py -v
```

### **Expected Results:**
- ✅ All endpoints return correct status codes
- ✅ All responses match expected schema
- ✅ Error responses include helpful messages

---

## 3️⃣ End-to-End Tests

### **Purpose**: Test complete user workflows from start to finish

### **Test File:** `tests/test_e2e_user_journey.py`

### **Complete User Journey:**
1. **Register** → Create new user account
2. **Login** → Authenticate and get access token
3. **Connect Shop** → Authorize Etsy OAuth
4. **Ingest Products** → Upload CSV with products
5. **Generate AI Content** → Create AI-powered titles/descriptions
6. **Create Schedule** → Setup automated publishing
7. **Publish Listing** → Publish to Etsy
8. **Sync Orders** → Fetch orders from Etsy

### **Run Tests:**
```bash
docker exec etsy-api pytest tests/test_e2e_user_journey.py -v -s
```

### **Expected Results:**
- ✅ Complete workflow succeeds end-to-end
- ✅ All steps execute in correct order
- ✅ Data persists correctly across steps
- ✅ < 30 seconds total execution time

---

## 4️⃣ Load Tests

### **Purpose**: Validate performance under load (1k listings across 10 shops)

### **Tool:** Locust  
### **File:** `load_tests/locustfile.py`

### **Test Scenarios:**
- **100 concurrent users**
- **1,000 listings** created
- **10 shops** (distributed load)
- **5-minute duration**

### **Simulated Operations:**
| Operation | Weight | Expected Rate |
|-----------|--------|---------------|
| List products | 5x | ~50/sec |
| Get product | 3x | ~30/sec |
| Create product | 2x | ~20/sec |
| Generate AI | 1x | ~10/sec |
| Publish listing | 1x | ~10/sec |
| List schedules | 4x | ~40/sec |
| Audit logs | 2x | ~20/sec |

### **Run Load Tests:**
```bash
# Install Locust
pip install locust

# Run load test
cd load_tests
locust -f locustfile.py --host=http://localhost:8080 --users=100 --spawn-rate=10 --run-time=5m --headless
```

### **Success Criteria:**
- ✅ Failure rate < 1%
- ✅ Median response time < 500ms
- ✅ 95th percentile < 2000ms
- ✅ Throughput > 100 req/sec
- ✅ No memory leaks
- ✅ No database connection exhaustion

---

## 5️⃣ Security Tests

### **Purpose**: Validate security controls and prevent vulnerabilities

### **Test Files:**
- `tests/test_security.py` (30+ tests)
- `tests/test_security_advanced.py` (15+ tests)

### **Coverage:**

#### **JWT Security:**
✅ Expired tokens rejected  
✅ Invalid tokens rejected  
✅ Missing tokens rejected  
✅ Wrong audience rejected  
✅ Proper claims validated (iss, aud, exp, iat, sub, nbf)  

#### **OAuth Security:**
✅ Code replay protection  
✅ State parameter validation  
✅ Token refresh security  
✅ Cross-tenant isolation  

#### **CSV Injection:**
✅ Formula injection blocked (`=1+1`, `@SUM()`, `+cmd`)  
✅ Command injection blocked  
✅ Data sanitized before storage  

#### **RBAC Enforcement:**
✅ Viewer cannot write  
✅ Creator can create  
✅ Cross-tenant access blocked  
✅ Shop-level isolation  

### **Additional Security Scanning:**
```bash
# Bandit (static security analysis)
cd apps/api
bandit -r app/ -f json -o bandit-report.json

# Safety (dependency vulnerabilities)
safety check --json

# OWASP ZAP (optional, manual)
docker run -t owasp/zap2docker-stable zap-baseline.py -t http://localhost:8080
```

### **Run Security Tests:**
```bash
docker exec etsy-api pytest tests/test_security*.py -v
```

### **Expected Results:**
- ✅ All security controls enforced
- ✅ No high/critical vulnerabilities
- ✅ Zero SQL injection vectors
- ✅ Zero XSS vectors
- ✅ No secrets in code

---

## 6️⃣ Data Integrity & Idempotency

### **Database Constraints Added:**

#### **Idempotency Keys:**
```sql
-- Ingestion: batch_id + row_index unique
ALTER TABLE ingestion_batches 
ADD CONSTRAINT uq_ingestion_batch_row 
UNIQUE (batch_id, row_index);

-- Listing: shop_id + product_id + idempotency_key unique
ALTER TABLE listing_jobs 
ADD CONSTRAINT uq_listing_job_idempotency 
UNIQUE (shop_id, product_id, idempotency_key);
```

#### **Uniqueness Constraints:**
```sql
-- Products: SKU unique per tenant + shop
ALTER TABLE products 
ADD CONSTRAINT uq_product_tenant_shop_sku 
UNIQUE (tenant_id, shop_id, sku);

-- OAuth: One token per tenant + shop
ALTER TABLE oauth_tokens 
ADD CONSTRAINT uq_oauth_token_tenant_shop 
UNIQUE (tenant_id, shop_id);

-- Orders: External order ID unique per shop
ALTER TABLE orders 
ADD CONSTRAINT uq_order_shop_external_id 
UNIQUE (shop_id, external_order_id);
```

#### **Deduplication Indexes:**
```sql
-- AI Generation: product_id + version unique
ALTER TABLE ai_generations 
ADD CONSTRAINT uq_ai_generation_product_version 
UNIQUE (product_id, generation_version);

-- Audit Logs: request_id + action + tenant_id indexed
CREATE INDEX ix_audit_logs_dedup 
ON audit_logs (request_id, action, tenant_id);
```

### **Compensating Actions:**
- **Failed ingestion**: Mark batch as failed, allow retry
- **Failed publish**: Revert listing_job status, keep product
- **Failed sync**: Log error, retry with backoff
- **Partial batch**: Continue processing, report errors

### **Apply Migration:**
```bash
docker exec etsy-api alembic upgrade head
```

---

## 7️⃣ CI/CD Quality Gates

### **GitHub Actions Workflow:** `.github/workflows/ci.yml`

### **Pipeline Stages:**

```
┌─────────────┐
│ Unit Tests  │──┐
└─────────────┘  │
                 ├──> ┌──────────────────┐
┌─────────────┐  │    │ Contract Tests   │──┐
│ Lint        │──┘    └──────────────────┘  │
└─────────────┘                              ├──> ┌──────────────┐
                                             │    │  E2E Tests   │──> ✅ Quality Gate
┌─────────────┐                              │    └──────────────┘
│ Security    │──────────────────────────────┘
└─────────────┘
```

### **Gate Requirements:**
- ✅ All unit tests pass (75+ tests)
- ✅ All contract tests pass
- ✅ All security tests pass
- ✅ Code coverage ≥ 85%
- ✅ No linting errors
- ✅ No high/critical security issues
- ✅ E2E tests pass
- ✅ Frontend builds successfully

### **Trigger:**
- Push to `main` or `develop`
- Pull request creation
- Manual workflow dispatch (for load tests)

### **Artifacts:**
- Test reports (JUnit XML)
- Coverage reports (Codecov)
- Security scan results (Bandit, Safety)
- Load test results (HTML report)

---

## 8️⃣ Test Fixtures

### **Available Fixtures:**

| Fixture | Description | Usage |
|---------|-------------|-------|
| `db` | Clean database session | `def test(db: Session)` |
| `client` | FastAPI test client | `def test(client: TestClient)` |
| `tenant` | Test tenant (premium) | `def test(tenant: Tenant)` |
| `tenant_free` | Free-tier tenant | `def test(tenant_free: Tenant)` |
| `owner_user` | Owner role user | `def test(owner_user: User)` |
| `admin_user` | Admin role user | `def test(admin_user: User)` |
| `creator_user` | Creator role user | `def test(creator_user: User)` |
| `viewer_user` | Viewer role user | `def test(viewer_user: User)` |
| `shop` | Test shop | `def test(shop: Shop)` |
| `shop_with_oauth` | Shop with OAuth tokens | `def test(shop_with_oauth: Shop)` |
| `multiple_shops` | 10 test shops | `def test(multiple_shops: list[Shop])` |
| `product` | Test product | `def test(product: Product)` |
| `product_with_variants` | Product with size variants | `def test(product_with_variants: Product)` |
| `bulk_products` | 100+ products (load testing) | `def test(bulk_products: list[Product])` |
| `access_token` | Valid JWT access token | `def test(access_token: str)` |
| `expired_access_token` | Expired JWT token | `def test(expired_access_token: str)` |
| `schedule` | Test schedule | `def test(schedule: Schedule)` |

### **Helper Functions:**
```python
from tests.conftest import create_auth_headers, create_test_csv_data, create_malicious_csv_data

# Create auth headers
headers = create_auth_headers(access_token)

# Create test CSV
csv_data = create_test_csv_data()

# Create malicious CSV (for security testing)
malicious_csv = create_malicious_csv_data()
```

---

## 9️⃣ Running Tests Locally

### **Setup Test Environment:**
```bash
# Start services
docker-compose up -d postgres redis

# Install test dependencies
cd apps/api
pip install -r requirements.txt
pip install pytest pytest-cov pytest-asyncio locust
```

### **Run All Tests:**
```bash
# All tests
pytest -v

# With coverage
pytest --cov=app --cov-report=html

# Specific test file
pytest tests/test_unit_policy.py -v

# Specific test
pytest tests/test_unit_policy.py::TestPolicyEngine::test_handmade_requirement_pass -v

# Verbose output
pytest -v -s

# Stop on first failure
pytest -x
```

### **Run Load Tests:**
```bash
cd load_tests

# Interactive (with web UI)
locust -f locustfile.py --host=http://localhost:8080

# Headless
locust -f locustfile.py --host=http://localhost:8080 --users=100 --spawn-rate=10 --run-time=5m --headless
```

---

## 🔟 Test Metrics & KPIs

### **Current Metrics:**
- **Total Tests**: 150+ tests
- **Unit Tests**: 75+ tests
- **Contract Tests**: 20+ tests
- **E2E Tests**: 5+ scenarios
- **Security Tests**: 45+ tests
- **Code Coverage**: ~85%
- **Execution Time**: < 60 seconds (all tests)

### **Quality Goals:**
- ✅ Test coverage ≥ 85%
- ✅ All critical paths tested
- ✅ Zero high/critical security issues
- ✅ Load test success rate > 99%
- ✅ CI pipeline < 10 minutes
- ✅ All PRs pass quality gates

---

## 📚 References

- [Pytest Documentation](https://docs.pytest.org/)
- [Locust Documentation](https://docs.locust.io/)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [Test Fixtures](./apps/api/tests/conftest.py)
- [CI Configuration](./.github/workflows/ci.yml)
- [Security Hardening](./SECURITY_HARDENING.md)

---

**Last Updated**: December 2025  
**Test Coverage**: 85%+  
**Status**: ✅ Production-Ready  
**Next Review**: March 2026

