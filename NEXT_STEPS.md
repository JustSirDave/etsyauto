# 📋 Next Steps - Phase Implementation Guide

## 🎯 Current Status: Phase 0 Complete ✅

You now have:
- ✅ Complete project structure
- ✅ Docker Compose configuration
- ✅ Database schema (SQLAlchemy models)
- ✅ FastAPI backend skeleton
- ✅ Next.js frontend with your UI design
- ✅ Dashboard matching your reference image
- ✅ Monitoring stack (Prometheus + Grafana)
- ✅ Build and deployment tools

## 🚀 What Works Right Now

1. **Start the project**: `make init`
2. **View the dashboard**: http://localhost:3000
3. **Check API docs**: http://localhost:8080/docs
4. **Mock UI**: Dashboard with sample orders and connection status

## 📅 Phase 1: Authentication & Tenancy (Weeks 1-5)

### Week 1-2: Core Authentication

**Tasks:**
1. Implement JWT token generation (RS256)
2. Create password hashing utilities
3. Build user registration endpoint
4. Build login endpoint
5. Add JWT middleware for protected routes

**Files to create/edit:**
- `apps/api/app/core/security.py` - JWT and password utilities
- `apps/api/app/api/endpoints/auth.py` - Complete auth endpoints
- `apps/api/app/api/dependencies.py` - JWT verification dependency
- `apps/web/app/login/page.tsx` - Login page
- `apps/web/app/register/page.tsx` - Registration page

**Test it:**
```bash
# Register user
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secure123","name":"Test User"}'

# Login
curl -X POST http://localhost:8080/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secure123"}'
```

### Week 3-4: Etsy OAuth Integration

**Prerequisites:**
- Get Etsy API credentials from https://www.etsy.com/developers/

**Tasks:**
1. Implement Etsy OAuth 2.0 flow
2. Store encrypted tokens in database
3. Build token refresh mechanism
4. Create shop connection UI

**Files to create:**
- `apps/api/app/services/etsy_oauth.py` - OAuth implementation
- `apps/api/app/services/encryption.py` - Token encryption
- `apps/api/app/api/endpoints/shops.py` - Shop endpoints
- `apps/web/app/settings/shops/page.tsx` - Shop connection UI

**Test it:**
```bash
# Get OAuth URL
curl http://localhost:8080/api/shops/etsy/connect

# After authorization, callback will save tokens
# Then test token refresh
curl -X POST http://localhost:8080/api/shops/1/refresh-token
```

### Week 5: RBAC & Multi-Tenancy

**Tasks:**
1. Implement role-based access control
2. Create tenant management endpoints
3. Add user invitation system
4. Build team management UI

**Files to create:**
- `apps/api/app/core/rbac.py` - RBAC utilities
- `apps/api/app/api/endpoints/tenants.py` - Tenant management
- `apps/web/app/settings/team/page.tsx` - Team management UI

**Exit Criteria:**
- [ ] Users can register and login
- [ ] JWT tokens work correctly
- [ ] Etsy shops can be connected
- [ ] Token refresh works automatically
- [ ] RBAC enforced on all endpoints
- [ ] Audit logs capture all actions

---

## 📦 Phase 2: Products & AI (Weeks 6-9)

### Week 6-7: Product Ingestion

**Prerequisites:**
- Decide on storage: Local disk or S3/R2

**Tasks:**
1. Implement CSV/JSON parser
2. Handle product images
3. Store in database
4. Build product management UI

**Files to create:**
- `apps/api/app/services/product_importer.py`
- `apps/api/app/services/storage.py` - Image storage
- `apps/api/app/api/endpoints/products.py` - Complete implementation
- `apps/web/app/products/page.tsx` - Product list page
- `apps/web/app/products/import/page.tsx` - Import UI

**Test it:**
```bash
# Import products
curl -X POST http://localhost:8080/api/products/import \
  -F "file=@products.csv"

# Get products
curl http://localhost:8080/api/products?page=1&limit=20
```

### Week 8: AI Integration

**Prerequisites:**
- Get OpenAI or Anthropic API key

**Tasks:**
1. Create AI provider abstraction
2. Implement OpenAI adapter
3. Build policy compliance checker
4. Create prompt templates

**Files to create:**
- `apps/api/app/services/ai/provider.py` - Abstract provider
- `apps/api/app/services/ai/openai_adapter.py`
- `apps/api/app/services/ai/anthropic_adapter.py`
- `apps/api/app/services/policy_checker.py`
- `apps/api/app/api/endpoints/ai.py` - Complete implementation
- `apps/web/app/ai/page.tsx` - AI generation UI

**Test it:**
```bash
# Generate AI content
curl -X POST http://localhost:8080/api/products/1/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model":"gpt-4o-mini",
    "style":"friendly",
    "tone":"professional"
  }'
```

### Week 9: Policy Compliance

**Tasks:**
1. Implement comprehensive policy rules
2. Create allow/block lists
3. Build regeneration flow
4. Add manual review queue

**Files to create:**
- `apps/api/app/services/policy_rules.py`
- `apps/web/app/ai/review/page.tsx` - Manual review UI

**Exit Criteria:**
- [ ] CSV/JSON import works flawlessly
- [ ] AI generates compliant content
- [ ] Policy checker catches violations
- [ ] Users can review and regenerate
- [ ] Cost tracking is accurate

---

## 🚀 Phase 3: Publishing & Automation (Weeks 10-14)

### Week 10-11: Listing Jobs & Rate Limiting

**Tasks:**
1. Implement token bucket in Redis
2. Create Celery worker tasks
3. Build job state machine
4. Handle retries and errors

**Files to create:**
- `apps/worker/tasks/publish_listing.py`
- `apps/worker/tasks/rate_limiter.py`
- `apps/api/app/services/etsy_api.py` - Etsy API client
- `apps/api/app/api/endpoints/listings.py` - Complete implementation
- `apps/web/app/listings/page.tsx` - Job queue UI

**Test it:**
```bash
# Enqueue listing
curl -X POST http://localhost:8080/api/shops/1/listings \
  -H "Content-Type: application/json" \
  -d '{
    "product_id":1,
    "ai_generation_id":5,
    "publish":true
  }'

# Check job status
curl http://localhost:8080/api/listing-jobs/123
```

### Week 12: Scheduling

**Tasks:**
1. Implement cron schedule parser
2. Create schedule runner
3. Build quota management
4. Add schedule UI

**Files to create:**
- `apps/worker/tasks/schedule_runner.py`
- `apps/api/app/api/endpoints/schedules.py` - Complete implementation
- `apps/web/app/schedules/page.tsx` - Schedule management UI

**Test it:**
```bash
# Create schedule
curl -X POST http://localhost:8080/api/shops/1/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "cron_expr":"0 9 * * *",
    "daily_quota":10
  }'
```

### Week 13: Order Sync (Happy Path)

**Prerequisites:**
- Get Printful API key (when ready)

**Tasks:**
1. Implement Etsy order polling
2. Create Printful adapter
3. Build order mapping logic
4. Add tracking sync

**Files to create:**
- `apps/worker/tasks/sync_orders.py`
- `apps/api/app/services/printful.py`
- `apps/api/app/api/endpoints/orders.py` - Complete implementation
- `apps/web/app/orders/page.tsx` - Order management UI

**Test it:**
```bash
# Sync orders
curl -X POST http://localhost:8080/api/orders/sync

# Submit to Printful
curl -X POST http://localhost:8080/api/orders/123/submit-printful
```

### Week 14: Polish & Testing

**Tasks:**
1. Load testing (1000 listings)
2. Security audit
3. Bug fixes
4. Documentation

**Exit Criteria:**
- [ ] 1000 listings published successfully
- [ ] Rate limiting works correctly
- [ ] Schedules execute on time
- [ ] Order sync completes
- [ ] SLOs met (p95 < 10min)
- [ ] All tests passing

---

## 🎨 Additional UI Pages to Build

### Products Page
**Location**: `apps/web/app/products/page.tsx`

Features:
- Product list with search/filter
- Import button
- Bulk actions (delete, generate AI)
- Pagination

### AI Generation Page
**Location**: `apps/web/app/ai/page.tsx`

Features:
- Select products
- Choose AI model/style
- Preview generated content
- Compliance badges
- Regenerate button

### Listings Page
**Location**: `apps/web/app/listings/page.tsx`

Features:
- Job queue status
- Filter by state
- Retry failed jobs
- View Etsy listing link

### Orders Page
**Location**: `apps/web/app/orders/page.tsx`

Features:
- Order list (enhanced version of your reference)
- Sync status
- Printful integration status
- Tracking numbers

### Schedules Page
**Location**: `apps/web/app/schedules/page.tsx`

Features:
- Schedule list
- Create/edit/delete
- Enable/disable toggle
- Daily quota visualization

### Usage & Costs Page
**Location**: `apps/web/app/usage/page.tsx`

Features:
- AI token usage chart
- Cost breakdown
- API call metrics
- Storage usage

### Settings Page
**Location**: `apps/web/app/settings/page.tsx`

Features:
- OAuth connections
- Team members
- Billing tier
- API keys

---

## 🛠 Development Workflow

### Daily Development Loop

```bash
# 1. Start services
make start

# 2. Watch logs
make logs

# 3. Make changes to code

# 4. Test changes
make test

# 5. Restart if needed
make restart
```

### Code Quality Checks

```bash
# Python linting
cd apps/api
black .
ruff check .
mypy app/

# TypeScript checks
cd apps/web
npm run lint
npm run type-check
```

### Database Changes

```bash
# Create migration
make db-create-migration msg="add_new_field"

# Edit migration file
# Then apply
make db-migrate
```

---

## 📊 Monitoring & Observability

### Key Metrics to Track

1. **API Metrics**
   - Request rate (RPS)
   - Latency (p50, p95, p99)
   - Error rate (4xx, 5xx)
   - Active users

2. **Worker Metrics**
   - Queue depth
   - Task success rate
   - Retry count
   - Time in state

3. **Business Metrics**
   - Listings published/day
   - AI generation success rate
   - Cost per tenant
   - Order sync rate

### Alerts to Configure

```yaml
# High queue depth
- alert: HighQueueDepth
  expr: celery_queue_depth > 5000
  for: 10m

# High error rate
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
  for: 5m

# Rate limit breach
- alert: RateLimitBreach
  expr: rate(etsy_rate_limit_hits[10m]) > 10
```

---

## 🎯 Success Criteria

### Phase 1 (Auth & Tenancy)
- [ ] 100% test coverage on auth endpoints
- [ ] OAuth flow works end-to-end
- [ ] Token refresh automatic
- [ ] RBAC enforced everywhere
- [ ] Audit logs complete

### Phase 2 (Products & AI)
- [ ] 1000 products imported successfully
- [ ] 95% AI compliance rate
- [ ] <5% manual review needed
- [ ] Cost tracking within 5% accuracy

### Phase 3 (Publishing)
- [ ] 1000 listings published
- [ ] <2% task failure rate
- [ ] p95 publish time < 10 min
- [ ] Zero rate limit violations
- [ ] Order sync working

### Beta Launch
- [ ] 10-15 shops onboarded
- [ ] 2 weeks stable operation
- [ ] <5 critical bugs
- [ ] Documentation complete
- [ ] Monitoring dashboards live

---

## 💡 Tips & Best Practices

1. **Start Small**: Don't try to build everything at once
2. **Test Early**: Write tests as you build features
3. **Monitor Always**: Keep Grafana open during development
4. **Log Everything**: Use structured logging
5. **Version Control**: Commit small, meaningful changes
6. **Document Decisions**: Update docs as you go
7. **Ask for Help**: Review code with team members

---

## 📚 Resources

- **Etsy API Docs**: https://developers.etsy.com/documentation
- **Printful API**: https://developers.printful.com/docs/
- **OpenAI API**: https://platform.openai.com/docs
- **FastAPI Docs**: https://fastapi.tiangolo.com
- **Next.js Docs**: https://nextjs.org/docs
- **Celery Docs**: https://docs.celeryproject.org

---

## ❓ Need Help?

**Common Issues:**
- Check `BUILD_GUIDE.md` for troubleshooting
- Look at `docker compose logs` for errors
- Review API docs at `/docs`
- Search GitHub issues

**Got Questions?**
Feel free to ask for clarification on any step!

---

**Ready to build? Start with Phase 1, Week 1: Core Authentication! 🚀**
