# Troubleshooting Guide

Solutions to common issues with the Etsy Automation Platform.

## 🔧 Quick Diagnostics

Before diving into specific issues, run these quick checks:

```bash
# Check all services are running
docker compose ps

# Check logs for errors
docker compose logs --tail=50

# Restart all services
docker compose restart

# Full reset (if needed)
docker compose down && docker compose up -d
```

---

## 📑 Table of Contents

- [Authentication Issues](#authentication-issues)
- [Product Import Problems](#product-import-problems)
- [Etsy Connection Issues](#etsy-connection-issues)
- [Listing Publication Failures](#listing-publication-failures)
- [AI Generation Errors](#ai-generation-errors)
- [Order Sync Problems](#order-sync-problems)
- [Schedule Not Running](#schedule-not-running)
- [Performance Issues](#performance-issues)
- [Database Errors](#database-errors)
- [Docker Problems](#docker-problems)

---

## Authentication Issues

### Cannot Login - "Invalid Credentials"

**Symptoms**:
- Error message: "Invalid email or password"
- Login form returns to same page

**Solutions**:

1. **Verify Email/Password**:
   ```
   - Check for typos
   - Email is case-insensitive
   - Password is case-sensitive
   - No extra spaces
   ```

2. **Reset Password**:
   - Click "Forgot Password"
   - Check email for reset link
   - Create new password

3. **Check Browser**:
   - Clear cache: Ctrl+Shift+Delete
   - Try incognito mode
   - Try different browser

4. **Verify API is Running**:
   ```bash
   docker compose ps api
   # Should show "Up" status

   curl http://localhost:8080/health
   # Should return {"status":"ok"}
   ```

### Token Expired Error

**Symptoms**:
- Suddenly logged out
- "Token expired" message
- 401 Unauthorized errors

**Solutions**:

1. **Log in again** - Tokens expire after 5 minutes of inactivity
2. **Check JWT keys exist**:
   ```bash
   ls apps/api/private.pem apps/api/public.pem
   ```
3. **Regenerate JWT keys if missing**:
   ```bash
   cd apps/api
   openssl genrsa -out private.pem 2048
   openssl rsa -in private.pem -pubout -out public.pem
   docker compose restart api
   ```

### Redirected to Login After Logging In

**Symptoms**:
- Login appears successful
- Immediately redirected back to login
- Cannot access any page

**Solutions**:

1. **Check Browser Cookies**:
   - Enable cookies in browser settings
   - Check for cookie blocking extensions
   - Allow localhost in cookie settings

2. **Check Auth Context**:
   ```bash
   # Check web container logs
   docker compose logs web | grep -i auth
   ```

3. **Hard Refresh**:
   - Ctrl+Shift+R (Windows/Linux)
   - Cmd+Shift+R (Mac)

---

## Product Import Problems

### CSV Import Fails with "Invalid Format"

**Symptoms**:
- Upload button does nothing
- Error: "Invalid CSV format"

**Solutions**:

1. **Verify CSV Headers**:
   ```csv
   sku,title,description,price,quantity
   ```
   - Must be exactly these names
   - Lowercase
   - Comma-separated
   - No spaces around commas

2. **Check for Special Characters**:
   - Remove smart quotes (" " instead of " ")
   - Remove line breaks in descriptions
   - Ensure UTF-8 encoding

3. **Validate Data**:
   - SKU: Unique, no duplicates
   - Price: Numeric only (29.99, not $29.99)
   - Quantity: Integer (10, not 10.5)

4. **Test with Sample**:
   ```csv
   sku,title,description,price,quantity
   TEST-001,Test Product,Test description,19.99,10
   ```

### "Duplicate SKU" Error

**Symptoms**:
- Import partially succeeds
- Some products rejected
- Error mentions duplicate SKU

**Solutions**:

1. **Check Existing Products**:
   - Go to Products page
   - Search for SKU
   - Delete or update existing product

2. **Check CSV for Duplicates**:
   ```bash
   # Find duplicate SKUs in CSV
   cut -d',' -f1 products.csv | sort | uniq -d
   ```

3. **Update Instead of Import**:
   - Use bulk update feature (coming soon)
   - Or delete existing products first

### Import Shows Success But No Products

**Symptoms**:
- "Import successful" message
- Product list still empty
- No errors shown

**Solutions**:

1. **Refresh Page**:
   - Hard refresh (Ctrl+Shift+R)
   - Clear browser cache

2. **Check API Logs**:
   ```bash
   docker compose logs api | grep -i import
   ```

3. **Verify Database**:
   ```bash
   docker compose exec db psql -U postgres -d etsy_platform -c "SELECT COUNT(*) FROM products;"
   ```

---

## Etsy Connection Issues

### "Failed to Connect Shop" Error

**Symptoms**:
- Error during OAuth flow
- Redirected back without connection
- Shop status shows "Not Connected"

**Solutions**:

1. **Verify API Credentials**:
   ```bash
   # Check .env file
   cat apps/api/.env | grep ETSY

   # Should have:
   ETSY_CLIENT_ID=your_keystring
   ETSY_CLIENT_SECRET=your_shared_secret
   ```

2. **Check Redirect URI**:
   - In Etsy app settings: `http://localhost:3000/api/auth/callback/etsy`
   - Must match exactly (including http vs https)

3. **Verify Etsy API Approval**:
   - Check Etsy developer dashboard
   - App should show "Approved" status

4. **Check Browser**:
   - Allow popups from localhost
   - Disable popup blockers
   - Try different browser

5. **API Logs**:
   ```bash
   docker compose logs api | grep -i etsy
   ```

### Shop Shows "Connected" But Can't Create Listings

**Symptoms**:
- Shop appears connected
- Listings fail with auth error
- Error: "Invalid OAuth token"

**Solutions**:

1. **Check Token Expiry**:
   ```bash
   docker compose exec db psql -U postgres -d etsy_platform -c \
     "SELECT expires_at FROM oauth_tokens WHERE provider='etsy';"
   ```

2. **Force Token Refresh**:
   - Disconnect shop
   - Wait 30 seconds
   - Reconnect shop

3. **Verify Scopes**:
   - Check OAuth token has all required scopes:
     - listings_r
     - listings_w
     - listings_d
     - transactions_r
     - shops_r
     - profile_r

### OAuth Callback Gets 404 Error

**Symptoms**:
- Redirected to Etsy successfully
- After authorization, get 404 error
- URL shows `/api/auth/callback/etsy?code=...`

**Solutions**:

1. **Check API Route**:
   ```bash
   # API should be running on port 8080
   curl http://localhost:8080/api/shops/etsy/callback
   ```

2. **Verify Nginx/Proxy**:
   - If using reverse proxy, check routing
   - Callback must route to API, not web

3. **Check Redirect URI**:
   - Must exactly match Etsy app settings
   - Including protocol (http/https)
   - Including port (if used)

---

## Listing Publication Failures

### Jobs Stuck in "Pending" Status

**Symptoms**:
- Jobs created but never start
- Status stays "Pending"
- No error messages

**Solutions**:

1. **Check Celery Worker**:
   ```bash
   docker compose ps worker
   # Should show "Up" status

   docker compose logs worker | tail -20
   ```

2. **Restart Worker**:
   ```bash
   docker compose restart worker
   ```

3. **Check Redis**:
   ```bash
   docker compose exec redis redis-cli ping
   # Should return "PONG"
   ```

4. **Manual Trigger**:
   ```bash
   # Trigger job manually via API
   curl -X POST http://localhost:8080/api/listings/{job_id}/retry \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

### Jobs Fail with "Rate Limit Exceeded"

**Symptoms**:
- Error: "Rate limit exceeded"
- Multiple jobs failing at once
- Error mentions waiting time

**Solutions**:

1. **Wait for Rate Limit Reset**:
   - Etsy: ~1 minute
   - Will automatically retry

2. **Check Rate Limiter**:
   ```bash
   docker compose exec redis redis-cli
   > KEYS rate_limit:*
   > HGETALL rate_limit:shop:1
   ```

3. **Reduce Publishing Speed**:
   - Lower daily quota in schedules
   - Add more time slots (spread out)
   - Publish fewer listings at once

4. **Check Shop Status**:
   - Ensure only one shop connected
   - Multiple apps using same shop can hit limits

### "Failed to Create Listing" Error

**Symptoms**:
- Job status: "Failed"
- Error message about Etsy API
- Specific error from Etsy

**Solutions**:

1. **Check Error Message**:
   - Click on job to see full error
   - Common errors:
     - Missing required field
     - Invalid price format
     - Invalid category
     - Image too large

2. **Verify Product Data**:
   - Title under 140 characters
   - Price is valid decimal
   - Quantity is positive integer
   - Description present

3. **Check Etsy Requirements**:
   - Some fields required by Etsy:
     - who_made (set to "i_did")
     - when_made (set to "made_to_order")
     - taxonomy_id (product category)

4. **Retry Job**:
   - Fix product data
   - Click retry button
   - Job will attempt again

---

## AI Generation Errors

### "AI Generation Failed" Message

**Symptoms**:
- Error during generation
- No content produced
- Error message shown

**Solutions**:

1. **Check API Keys**:
   ```bash
   cat apps/api/.env | grep API_KEY

   # Should have either:
   OPENAI_API_KEY=sk-...
   # or
   ANTHROPIC_API_KEY=sk-ant-...
   ```

2. **Verify API Key**:
   ```bash
   # Test OpenAI key
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_KEY"

   # Test Anthropic key
   curl https://api.anthropic.com/v1/models \
     -H "x-api-key: YOUR_KEY"
   ```

3. **Check Credits/Balance**:
   - Log into AI provider dashboard
   - Verify sufficient credits
   - Check for rate limits

4. **Try Different Provider**:
   - Switch from OpenAI to Anthropic (or vice versa)
   - Update .env and restart API

### Generated Content is Empty or Gibberish

**Symptoms**:
- Content generates but looks wrong
- Empty fields
- Nonsensical text

**Solutions**:

1. **Check Product Data**:
   - Product needs title at minimum
   - Description helps AI understand context
   - More data = better generation

2. **Regenerate**:
   - Click "Regenerate" button
   - AI uses different random seed
   - May produce better result

3. **Check Model Settings**:
   ```python
   # In apps/api/.env
   AI_DEFAULT_MODEL=gpt-4o-mini  # or claude-3-sonnet
   AI_MAX_TOKENS=1000
   AI_TEMPERATURE=0.7
   ```

4. **Review Prompts**:
   - Check AI generation service code
   - Prompts may need adjustment for your products

### Policy Violation Warnings Not Showing

**Symptoms**:
- Content generated successfully
- No policy checks shown
- Concerned about compliance

**Solutions**:

1. **Check Policy Guardrails**:
   - Feature should be automatic
   - May need to enable in settings

2. **Manual Review**:
   - Always review content before publishing
   - Check for:
     - Trademark mentions
     - Medical claims
     - Guarantee language
     - Prohibited items

3. **Update Guardrails** (advanced):
   - Edit policy check rules
   - Add custom keywords
   - Adjust sensitivity

---

## Order Sync Problems

### Orders Not Syncing

**Symptoms**:
- Orders page empty
- "Sync Orders" button does nothing
- No new orders appearing

**Solutions**:

1. **Check Shop Connection**:
   - Settings → Connections
   - Shop must show "Connected"
   - Token must be valid

2. **Manual Sync**:
   ```bash
   # Trigger sync via API
   curl -X POST http://localhost:8080/api/orders/sync \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Check Celery Worker**:
   ```bash
   docker compose logs worker | grep sync_orders
   ```

4. **Verify Etsy Has Orders**:
   - Log into Etsy seller dashboard
   - Check if orders exist
   - New shops may have no orders yet

### Duplicate Orders Appearing

**Symptoms**:
- Same order listed multiple times
- Order ID duplicated

**Solutions**:

1. **Check Database Constraints**:
   ```bash
   docker compose exec db psql -U postgres -d etsy_platform -c \
     "SELECT COUNT(*), etsy_order_id FROM orders GROUP BY etsy_order_id HAVING COUNT(*) > 1;"
   ```

2. **Clear Duplicates**:
   ```bash
   # Delete duplicate orders (keep latest)
   docker compose exec db psql -U postgres -d etsy_platform -c \
     "DELETE FROM orders WHERE id NOT IN (SELECT MAX(id) FROM orders GROUP BY etsy_order_id);"
   ```

3. **Check Sync Logic**:
   - May be bug in sync task
   - Report issue with logs

---

## Schedule Not Running

### Schedule Shows "Active" But Not Publishing

**Symptoms**:
- Schedule is active
- Daily quota not reached
- No jobs being created

**Solutions**:

1. **Check Schedule Times**:
   - Current time must match time slot
   - Consider timezone differences
   - Check next_run field

2. **Verify Products are Ready**:
   - Products must have status "ready"
   - Must have approved AI generation
   - Check Products page

3. **Check Celery Beat**:
   ```bash
   docker compose logs worker | grep beat
   docker compose logs worker | grep schedule
   ```

4. **Manual Trigger**:
   ```bash
   curl -X POST http://localhost:8080/api/schedules/{id}/trigger \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

### Schedule Running But No Jobs Created

**Symptoms**:
- Schedule logs show it ran
- No listing jobs appear
- No errors shown

**Solutions**:

1. **Check Daily Quota**:
   - May have already hit quota for today
   - Resets at midnight UTC

2. **Check Product Status**:
   - Products must be "ready"
   - Filter products list by status

3. **Check Shop Connection**:
   - Shop must be connected
   - Token must be valid

4. **Review Schedule Logs**:
   ```bash
   docker compose logs worker | grep "schedule_id:{your_schedule_id}"
   ```

---

## Performance Issues

### Slow Page Load Times

**Symptoms**:
- Pages take >5 seconds to load
- Dashboard sluggish
- API responses slow

**Solutions**:

1. **Check Resource Usage**:
   ```bash
   docker stats
   # Look for high CPU/Memory usage
   ```

2. **Restart Services**:
   ```bash
   docker compose restart
   ```

3. **Check Database**:
   ```bash
   # Check database size
   docker compose exec db psql -U postgres -d etsy_platform -c \
     "SELECT pg_size_pretty(pg_database_size('etsy_platform'));"

   # Check slow queries
   docker compose logs db | grep "duration:"
   ```

4. **Clear Redis Cache**:
   ```bash
   docker compose exec redis redis-cli FLUSHALL
   ```

5. **Optimize Queries** (if many products):
   - Add pagination
   - Use filters
   - Limit results

### High Memory Usage

**Symptoms**:
- Docker containers using lots of RAM
- System slowdown
- Out of memory errors

**Solutions**:

1. **Check Container Limits**:
   ```bash
   docker stats
   ```

2. **Increase Docker Resources**:
   - Docker Desktop → Settings → Resources
   - Increase RAM allocation
   - Increase CPU cores

3. **Reduce Worker Concurrency**:
   ```yaml
   # In docker-compose.yml
   worker:
     command: celery -A app.worker.celery_app worker --concurrency=2
   ```

4. **Clean Up**:
   ```bash
   docker system prune -a
   docker volume prune
   ```

---

## Database Errors

### "Database Connection Failed"

**Symptoms**:
- Error on any page
- "Cannot connect to database"
- 500 errors

**Solutions**:

1. **Check Database Container**:
   ```bash
   docker compose ps db
   # Should show "Up" status
   ```

2. **Restart Database**:
   ```bash
   docker compose restart db
   ```

3. **Check Database Logs**:
   ```bash
   docker compose logs db | tail -50
   ```

4. **Verify Connection String**:
   ```bash
   # In apps/api/.env
   DATABASE_URL=postgresql://postgres:postgres@db:5432/etsy_platform
   ```

5. **Recreate Database** (last resort):
   ```bash
   docker compose down -v
   docker compose up -d
   # Warning: This deletes all data!
   ```

### Migration Errors

**Symptoms**:
- Error: "Alembic migration failed"
- Database schema issues
- Table not found errors

**Solutions**:

1. **Check Migration Status**:
   ```bash
   docker compose exec api alembic current
   docker compose exec api alembic history
   ```

2. **Run Migrations**:
   ```bash
   docker compose exec api alembic upgrade head
   ```

3. **Reset Migrations** (development only):
   ```bash
   docker compose exec api alembic downgrade base
   docker compose exec api alembic upgrade head
   ```

4. **Check for Conflicts**:
   ```bash
   docker compose exec api alembic branches
   ```

---

## Docker Problems

### Services Won't Start

**Symptoms**:
- `docker compose up` fails
- Containers exit immediately
- Port conflict errors

**Solutions**:

1. **Check Port Conflicts**:
   ```bash
   # Check what's using port 3000 (web)
   netstat -ano | findstr :3000  # Windows
   lsof -i :3000  # Mac/Linux

   # Check port 8080 (API)
   netstat -ano | findstr :8080  # Windows
   lsof -i :8080  # Mac/Linux
   ```

2. **View Logs**:
   ```bash
   docker compose logs
   ```

3. **Rebuild Containers**:
   ```bash
   docker compose down
   docker compose build --no-cache
   docker compose up -d
   ```

4. **Clean Docker**:
   ```bash
   docker system prune -a
   docker volume prune
   ```

### Container Keeps Restarting

**Symptoms**:
- Container shows "Restarting"
- Logs show crash loop
- Services unavailable

**Solutions**:

1. **Check Logs**:
   ```bash
   docker compose logs {service_name}
   ```

2. **Common Causes**:
   - **API**: Missing environment variables
   - **Web**: Build errors, missing dependencies
   - **Worker**: Celery configuration issues
   - **DB**: Corrupted data, out of disk space

3. **Fix and Restart**:
   ```bash
   # After fixing issue
   docker compose restart {service_name}
   ```

---

## Still Having Issues?

### Collect Diagnostic Information

```bash
# Save all logs
docker compose logs > logs.txt

# Save system info
docker compose ps > status.txt
docker stats --no-stream > stats.txt

# Save configuration
cat apps/api/.env > config.txt  # Remove sensitive data first!
```

### Contact Support

**Email**: support@example.com

**Include**:
- Description of issue
- Steps to reproduce
- Error messages
- Log files (attach logs.txt)
- System information
- Screenshots (if applicable)

**Response Time**:
- Critical: 1 hour
- High: 4 hours
- Normal: 24 hours

---

**Last Updated**: 2025
**Version**: 1.0.0 (Beta)
