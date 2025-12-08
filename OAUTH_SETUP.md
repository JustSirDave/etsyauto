# OAuth Setup Guide

Quick guide to set up the full OAuth 2.0 implementation.

## Prerequisites

- Python 3.10+
- PostgreSQL 13+
- Redis 6+
- Etsy Developer Account

## Step-by-Step Setup

### 1. Generate Encryption Key

```bash
# Generate a secure 32-byte encryption key
python3 -c "import base64; import os; print(base64.b64encode(os.urandom(32)).decode())"

# Save the output - you'll need it for .env
```

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# OAuth Configuration
ETSY_CLIENT_ID=your_etsy_client_id
ETSY_CLIENT_SECRET=your_etsy_client_secret
ETSY_REDIRECT_URI=http://localhost:3000/api/auth/callback/etsy

# Encryption (CRITICAL - use output from step 1)
ENCRYPTION_KEY=your_generated_base64_key

# Redis (for caching and locks)
REDIS_URL=redis://localhost:6379/0

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/etsy_platform

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

### 3. Install Python Dependencies

```bash
cd apps/api

# Ensure these packages are in requirements.txt
pip install cryptography redis celery
```

### 4. Run Database Migration

```bash
cd apps/api

# Create migration (if needed)
alembic revision --autogenerate -m "add oauth enhancements"

# Apply migration
alembic upgrade head
```

The migration adds:
- `tenant_id` column to `oauth_tokens`
- `scopes`, `last_refreshed_at`, `refresh_count` columns
- Performance indexes

### 5. Start Services

**Terminal 1 - API Server:**
```bash
cd apps/api
uvicorn main:app --reload --port 8000
```

**Terminal 2 - Celery Worker:**
```bash
cd apps/api
celery -A app.worker.celery_app worker --loglevel=info
```

**Terminal 3 - Celery Beat (Scheduled Tasks):**
```bash
cd apps/api
celery -A app.worker.celery_app beat --loglevel=info
```

**Terminal 4 - Frontend (if applicable):**
```bash
cd apps/web
npm run dev
```

### 6. Verify Setup

**Check API Health:**
```bash
curl http://localhost:8000/health
```

**Check Redis Connection:**
```bash
redis-cli ping
# Should return: PONG
```

**Check Celery:**
```bash
celery -A app.worker.celery_app inspect active
```

### 7. Test OAuth Flow

1. **Start OAuth:**
   ```bash
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
        http://localhost:8000/api/shops/etsy/connect
   ```

2. **You'll get back:**
   ```json
   {
     "authorization_url": "https://www.etsy.com/oauth/connect?..."
   }
   ```

3. **Open the URL in browser** - Authorize your Etsy shop

4. **Complete callback** - Frontend handles this automatically

5. **Verify token stored:**
   ```sql
   SELECT id, shop_id, provider, expires_at, refresh_count 
   FROM oauth_tokens;
   ```

### 8. Test Token Refresh

**Manual refresh:**
```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:8000/api/shops/1/refresh-token
```

**Check scheduled refresh:**
```bash
# Trigger manually (normally runs hourly)
celery -A app.worker.celery_app call \
  app.worker.tasks.token_tasks.refresh_expiring_tokens
```

## Troubleshooting

### "ENCRYPTION_KEY not set" Error

**Solution:**
```bash
# Generate key
python3 -c "import base64; import os; print(base64.b64encode(os.urandom(32)).decode())"

# Add to .env
echo "ENCRYPTION_KEY=<your_key_here>" >> .env

# Restart API server
```

### "Redis connection failed" Error

**Solution:**
```bash
# Install Redis (Ubuntu/Debian)
sudo apt install redis-server

# Or (macOS)
brew install redis

# Start Redis
redis-server

# Verify
redis-cli ping
```

### "Celery worker not found" Error

**Solution:**
```bash
# Install Celery
pip install celery[redis]

# Check it's installed
celery --version

# Start worker
celery -A app.worker.celery_app worker --loglevel=info
```

### "Token refresh failed" Error

**Possible causes:**
1. Invalid Etsy credentials
2. Network connectivity issues
3. Token revoked by user

**Solutions:**
```bash
# Check Etsy credentials
echo $ETSY_CLIENT_ID
echo $ETSY_CLIENT_SECRET

# Test connectivity
curl https://api.etsy.com/v3/public/ping

# Check logs
tail -f logs/api.log

# Reconnect shop if needed
# User will need to re-authorize via OAuth flow
```

### Database Migration Issues

**Solution:**
```bash
# Check current revision
alembic current

# Check pending migrations
alembic heads

# Force to latest (BE CAREFUL - backup first!)
alembic upgrade head

# Rollback if needed
alembic downgrade -1
```

## Production Deployment

### Security Checklist

- [ ] Use strong ENCRYPTION_KEY (generated randomly)
- [ ] Set HTTPS-only redirect URIs
- [ ] Enable SSL for PostgreSQL connection
- [ ] Enable SSL/TLS for Redis connection
- [ ] Set strong database password
- [ ] Use environment variables (never hardcode)
- [ ] Enable log sanitization in production
- [ ] Configure firewall rules
- [ ] Set up monitoring/alerting

### Production Environment Variables

```bash
# Use production values
ETSY_REDIRECT_URI=https://yourdomain.com/api/auth/callback/etsy
DATABASE_URL=postgresql://user:strong_password@prod-db:5432/etsy_platform?sslmode=require
REDIS_URL=rediss://prod-redis:6379/0  # Note: rediss for SSL
ENCRYPTION_KEY=<production_key_different_from_dev>
DEBUG=False
ENVIRONMENT=production
```

### Deployment Checklist

1. **Database Migration:**
   ```bash
   alembic upgrade head
   ```

2. **Start API (with Gunicorn):**
   ```bash
   gunicorn main:app \
     --workers 4 \
     --worker-class uvicorn.workers.UvicornWorker \
     --bind 0.0.0.0:8000
   ```

3. **Start Celery Worker:**
   ```bash
   celery -A app.worker.celery_app worker \
     --loglevel=info \
     --concurrency=4
   ```

4. **Start Celery Beat:**
   ```bash
   celery -A app.worker.celery_app beat \
     --loglevel=info
   ```

5. **Configure Supervisor (optional):**
   ```ini
   [program:celery-worker]
   command=celery -A app.worker.celery_app worker --loglevel=info
   directory=/path/to/apps/api
   user=appuser
   autostart=true
   autorestart=true
   
   [program:celery-beat]
   command=celery -A app.worker.celery_app beat --loglevel=info
   directory=/path/to/apps/api
   user=appuser
   autostart=true
   autorestart=true
   ```

## Monitoring

### Key Metrics to Track

1. **Token Health:**
   ```sql
   -- Tokens expiring soon
   SELECT COUNT(*) 
   FROM oauth_tokens 
   WHERE expires_at < NOW() + INTERVAL '24 hours';
   
   -- Recently refreshed
   SELECT COUNT(*) 
   FROM oauth_tokens 
   WHERE last_refreshed_at > NOW() - INTERVAL '1 hour';
   
   -- Average refresh count
   SELECT AVG(refresh_count) FROM oauth_tokens;
   ```

2. **Celery Task Status:**
   ```bash
   celery -A app.worker.celery_app inspect stats
   ```

3. **Redis Cache Hit Rate:**
   ```bash
   redis-cli INFO stats | grep keyspace
   ```

### Alerts to Configure

- Token refresh failure rate > 5%
- No tokens refreshed in last 2 hours (if tokens exist)
- Celery worker down
- Redis connection failures
- API 401 error spike

## Support

For questions or issues:
- Review documentation: `OAUTH_IMPLEMENTATION.md`
- Check logs: `tail -f logs/api.log`
- Test manually: `curl` commands above
- Contact development team

## Next Steps

After setup:
1. Test OAuth flow end-to-end
2. Monitor scheduled refresh task
3. Review security settings
4. Configure monitoring/alerting
5. Test token expiry and refresh
6. Document any custom configurations

---

**Note:** This OAuth implementation is production-ready and includes:
- Encryption at rest
- Automatic token refresh
- Single-flight refresh pattern
- Distributed locking
- Security best practices
- Comprehensive error handling

