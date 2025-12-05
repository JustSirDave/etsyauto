# 🚀 Build & Setup Guide

## Prerequisites

- Docker & Docker Compose (v2.0+)
- Node.js 20+ (for local frontend development)
- Python 3.11+ (for local backend development)
- Git

## Quick Start (Recommended)

### 1. Clone & Setup

```bash
git clone <your-repo-url>
cd etsy-automation-platform
cp .env.example .env
```

### 2. Generate JWT Keys

```bash
# Generate RS256 keypair
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# Copy to .env (remove newlines)
echo "JWT_PRIVATE_KEY=$(cat private.pem | tr -d '\n')" >> .env
echo "JWT_PUBLIC_KEY=$(cat public.pem | tr -d '\n')" >> .env
```

### 3. Configure Environment

Edit `.env` and set:

```bash
# Required for Phase 1
DB_PASSWORD=your_secure_password
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Add when ready (Phase 1-2)
ETSY_CLIENT_ID=your_etsy_app_key
ETSY_CLIENT_SECRET=your_etsy_app_secret
OPENAI_API_KEY=sk-...

# Add later (Phase 2-3)
PRINTFUL_API_KEY=your_printful_key
```

### 4. Start All Services

```bash
docker compose up -d
```

### 5. Access Application

- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8080/docs
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090

## Development Setup

### Backend Development

```bash
cd apps/api

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start development server
uvicorn main:app --reload --port 8080
```

### Frontend Development

```bash
cd apps/web

# Install dependencies
npm install

# Run development server
npm run dev
```

### Worker Development

```bash
cd apps/worker

# Install dependencies (same as API)
pip install -r requirements.txt

# Start Celery worker
celery -A tasks worker --loglevel=info --reload

# Start Celery beat (scheduler)
celery -A tasks beat --loglevel=info
```

## Phase-by-Phase Setup

### Phase 0: Foundation ✅

**Goal**: Get infrastructure running

```bash
# Start database and Redis only
docker compose up -d db redis

# Verify health
docker compose ps
curl http://localhost:5432  # Should timeout (DB is running)
redis-cli ping  # Should return PONG
```

### Phase 1: Auth & Tenancy (Weeks 1-5)

**Goal**: User login, tenant management, Etsy OAuth

#### Step 1: Get Etsy Developer Credentials

1. Go to https://www.etsy.com/developers/your-apps
2. Create new app
3. Set redirect URI: `http://localhost:3000/api/auth/callback/etsy`
4. Copy Client ID and Secret to `.env`

#### Step 2: Test OAuth Flow

```bash
# Start all services
docker compose up -d

# Open browser
open http://localhost:3000/settings

# Click "Connect Etsy Shop"
# Should redirect to Etsy authorization
```

#### Step 3: Verify Database

```bash
# Connect to database
docker exec -it etsy-db psql -U postgres -d etsy_platform

# Check tables
\dt

# Should see: tenants, users, memberships, shops, oauth_tokens
```

### Phase 2: Products & AI (Weeks 6-9)

**Goal**: Import products, generate AI content

#### Step 1: Get OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Create new key
3. Add to `.env`: `OPENAI_API_KEY=sk-...`

#### Step 2: Test Product Import

```bash
# Create sample CSV
cat > sample_products.csv << 'EOF'
title,description,tags,image_urls
"Custom T-Shirt","Handmade cotton tee","tshirt|custom|handmade","https://example.com/image.jpg"
"Art Print","Original watercolor print","art|print|watercolor","https://example.com/image2.jpg"
EOF

# Upload via UI at http://localhost:3000/products
# Or via API:
curl -X POST http://localhost:8080/api/products/import \
  -F "file=@sample_products.csv"
```

#### Step 3: Test AI Generation

```bash
# Generate titles/descriptions
curl -X POST http://localhost:8080/api/products/1/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","style":"friendly"}'
```

### Phase 3: Publishing & Automation (Weeks 10-14)

**Goal**: Publish to Etsy, schedule jobs

#### Step 1: Test Rate Limiting

```bash
# Check Redis token bucket
redis-cli
> GET bucket:1
> TTL bucket:1
```

#### Step 2: Create Schedule

```bash
# Schedule 5 listings per day at 9am
curl -X POST http://localhost:8080/api/shops/1/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "cron_expr":"0 9 * * *",
    "daily_quota":5
  }'
```

#### Step 3: Monitor Jobs

```bash
# Check Celery worker logs
docker compose logs -f worker

# Check job status
curl http://localhost:8080/api/listing-jobs/123
```

## Database Migrations

### Create New Migration

```bash
cd apps/api
alembic revision -m "add_new_column"
# Edit generated file in alembic/versions/
alembic upgrade head
```

### Rollback Migration

```bash
alembic downgrade -1
```

### Reset Database

```bash
docker compose down -v
docker compose up -d db
alembic upgrade head
```

## Testing

### Backend Tests

```bash
cd apps/api
pytest
pytest tests/test_auth.py -v
pytest --cov=app tests/
```

### Frontend Tests

```bash
cd apps/web
npm test
npm run test:e2e
```

### Integration Tests

```bash
# Start all services
docker compose up -d

# Run E2E tests
cd apps/web
npm run test:e2e
```

## Monitoring

### Prometheus Metrics

```bash
# Check API metrics
curl http://localhost:8080/metrics

# Key metrics:
# - http_requests_total
# - http_request_duration_seconds
# - celery_tasks_total
# - etsy_api_calls_total
```

### Grafana Dashboards

1. Open http://localhost:3001
2. Login (admin/admin)
3. Import dashboards from `monitoring/grafana/dashboards/`

### Sentry Error Tracking

1. Create account at https://sentry.io
2. Get DSN
3. Add to `.env`: `SENTRY_DSN=https://...`
4. Restart services

## Troubleshooting

### API Won't Start

```bash
# Check database connection
docker compose logs db

# Check if port is in use
lsof -i :8080

# Restart API
docker compose restart api
```

### Frontend Build Errors

```bash
# Clear cache
rm -rf apps/web/.next
rm -rf apps/web/node_modules
npm install
```

### Worker Not Processing Jobs

```bash
# Check Redis connection
docker compose logs redis

# Check worker logs
docker compose logs worker

# Restart worker
docker compose restart worker beat
```

### Database Connection Issues

```bash
# Check if database is running
docker compose ps db

# Check connection from API
docker compose exec api python -c "from app.core.database import engine; print(engine.url)"
```

## Production Deployment

### Prerequisites

- VPS with 4 CPU, 8GB RAM minimum
- Docker & Docker Compose installed
- Domain name with DNS configured
- SSL certificate (Let's Encrypt)

### Deploy Steps

```bash
# 1. Clone repository
git clone <repo-url>
cd etsy-automation-platform

# 2. Configure production environment
cp .env.example .env.production
# Edit with production values

# 3. Update docker-compose.yml for production
# - Remove `build` sections
# - Use pre-built images
# - Add restart: always
# - Configure proper networks

# 4. Start services
docker compose -f docker-compose.prod.yml up -d

# 5. Run migrations
docker compose exec api alembic upgrade head

# 6. Setup nginx reverse proxy
# See docs/nginx.conf.example

# 7. Configure SSL with certbot
# certbot --nginx -d yourdomain.com
```

## Next Steps

1. ✅ **Phase 0**: Infrastructure is ready
2. 🔄 **Phase 1**: Implement authentication (see `docs/phase1.md`)
3. ⏳ **Phase 2**: Build product ingestion
4. ⏳ **Phase 3**: Complete listing automation

## Support

- **Documentation**: `docs/`
- **API Reference**: http://localhost:8080/docs
- **Issues**: GitHub Issues
- **Slack**: #etsy-automation
