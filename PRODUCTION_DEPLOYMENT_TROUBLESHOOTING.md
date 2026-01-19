# Production Deployment Troubleshooting

## After Deploying Updates

If you're seeing errors after deploying updates, follow these steps:

### 1. Check API Container Status

```bash
# On production server
docker ps | grep etsy-api
```

Should show: `Up X minutes (healthy)`

If it shows `(unhealthy)` or `(restarting)`, check logs:
```bash
docker logs etsy-api --tail 100
```

### 2. Check for Import Errors

The same import error we fixed locally might exist in production:

```bash
# Check if dashboard.py has the wrong import
grep "from app.models.tenancy import Product" apps/api/app/api/endpoints/dashboard.py
```

If it finds a match, fix it:
```bash
# On production server
cd /path/to/etsy-automation-platform
sed -i 's/from app.models.tenancy import Product, ListingJob, Order/from app.models.listings import Product, ListingJob, Order/' apps/api/app/api/endpoints/dashboard.py
docker compose -f docker-compose.prod.yml restart api
```

### 3. Check API Logs for Errors

```bash
# Check recent errors
docker logs etsy-api --tail 200 | grep -i "error\|exception\|traceback" -A 10 -B 5

# Check products endpoint specifically
docker logs etsy-api --tail 500 | grep -i "/api/products" -A 15
```

### 4. Verify Database Connection

```bash
docker exec etsy-api python -c "from app.core.database import engine; from sqlalchemy import inspect; inspector = inspect(engine); print('Tables:', len(inspector.get_table_names()))"
```

Should show: `Tables: 15` (or similar number)

### 5. Test Products Endpoint Directly

```bash
# Get your auth token first (from browser localStorage or login)
TOKEN="your_auth_token_here"

# Test products endpoint
curl -H "Authorization: Bearer $TOKEN" https://etsyauto.bigbotdrivers.com/api/products/
```

### 6. Check Frontend Console Errors

Open browser DevTools (F12) and check:
- **Console tab**: Look for JavaScript errors
- **Network tab**: Check if `/api/products/` request is failing
  - Status code (should be 200)
  - Response body (should be JSON with products array)

### 7. Verify Environment Variables

```bash
# Check if JWT keys are loaded
docker exec etsy-api python -c "from app.core.config import settings; print('Private key length:', len(settings.JWT_PRIVATE_KEY)); print('Public key length:', len(settings.JWT_PUBLIC_KEY))"
```

Should show:
- Private key length: ~1700
- Public key length: ~450

### 8. Check Database Migrations

```bash
# Check if migrations are up to date
docker exec etsy-api alembic current
docker exec etsy-api alembic heads
```

If they don't match, run migrations:
```bash
docker exec etsy-api alembic upgrade head
```

### 9. Restart All Services

If everything looks correct but still having issues:

```bash
docker compose -f docker-compose.prod.yml restart
```

### 10. Common Issues After Git Pull

#### Issue: Import Errors
**Symptom**: Container won't start, shows `ImportError`
**Fix**: Check for wrong imports (like the dashboard.py issue we fixed)

#### Issue: Missing Environment Variables
**Symptom**: 500 errors, authentication failures
**Fix**: Ensure `.env` file has all required variables

#### Issue: Database Schema Mismatch
**Symptom**: SQL errors, "relation does not exist"
**Fix**: Run migrations: `docker exec etsy-api alembic upgrade head`

#### Issue: Frontend/Backend Mismatch
**Symptom**: API calls fail, CORS errors
**Fix**: Ensure frontend is rebuilt and both are using same API URL

## Quick Fix Script

Run this on your production server to diagnose common issues:

```bash
#!/bin/bash
echo "=== Container Status ==="
docker ps | grep etsy

echo ""
echo "=== API Health ==="
docker exec etsy-api curl -s http://localhost:8080/healthz || echo "API not responding"

echo ""
echo "=== Recent API Errors ==="
docker logs etsy-api --tail 100 | grep -i "error\|exception" | tail -10

echo ""
echo "=== Import Check ==="
docker exec etsy-api grep -r "from app.models.tenancy import Product" /app/app/api/endpoints/ || echo "No import errors found"

echo ""
echo "=== Database Connection ==="
docker exec etsy-api python -c "from app.core.database import engine; from sqlalchemy import inspect; print('Connected:', len(inspect(engine).get_table_names()), 'tables')" 2>&1

echo ""
echo "=== JWT Keys ==="
docker exec etsy-api python -c "from app.core.config import settings; print('Private:', len(settings.JWT_PRIVATE_KEY), 'Public:', len(settings.JWT_PUBLIC_KEY))" 2>&1
```

Save as `check_production.sh`, make executable (`chmod +x check_production.sh`), and run it.







