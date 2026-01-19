# 🏗 Project Architecture Visualization

## System Overview

> **Etsy-Exclusive Platform**: This architecture is purpose-built for Etsy marketplace automation. All components are optimized for Etsy's API, policies, and seller workflows.

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ HTTP (Port 3000)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NEXT.JS FRONTEND                             │
│                                                                   │
│  • Dashboard (Connection Status + Recent Orders)                 │
│  • Products, AI Generation, Listings, Orders                     │
│  • Schedules, Usage, Settings                                    │
│  • Tailwind CSS + Blue-Green Theme                              │
│  • TypeScript + React Server Components                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ REST API (Port 8080)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FASTAPI BACKEND                             │
│                                                                   │
│  • /api/auth         - JWT token generation                      │
│  • /api/shops        - Etsy OAuth + Shop management             │
│  • /api/products     - CSV/JSON import, storage                 │
│  • /api/ai           - OpenAI/Anthropic integration             │
│  • /api/listings     - Job queue management                     │
│  • /api/orders       - Etsy + Printful sync                     │
│  • /api/schedules    - Cron job management                      │
│  • /api/usage        - Cost tracking                            │
│  • /api/audit        - Audit logs                               │
│  • /healthz, /metrics                                           │
└────────┬──────────────────┬──────────────────┬──────────────────┘
         │                  │                  │
         │                  │                  │
         ▼                  ▼                  ▼
┌────────────────┐  ┌──────────────┐  ┌──────────────────┐
│   POSTGRESQL   │  │    REDIS     │  │  CELERY WORKERS  │
│                │  │              │  │                  │
│ • tenants      │  │ • Rate limit │  │ • publish_listing│
│ • users        │  │   buckets    │  │ • sync_orders    │
│ • memberships  │  │ • Job queue  │  │ • schedule_runner│
│ • shops        │  │ • Cache      │  │ • Token bucket   │
│ • oauth_tokens │  │ • Sessions   │  │   enforcement    │
│ • products     │  │              │  │                  │
│ • ai_gens      │  └──────────────┘  └──────────────────┘
│ • listing_jobs │
│ • orders       │
│ • schedules    │
│ • usage_costs  │
│ • audit_logs   │
└────────────────┘


External Services:
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Etsy API    │  │ Printful API │  │  OpenAI API  │  │ Prometheus/  │
│              │  │              │  │              │  │   Grafana    │
│ • OAuth 2.0  │  │ • Orders     │  │ • GPT-4o-mini│  │              │
│ • Listings   │  │ • Tracking   │  │ • Embeddings │  │ • Metrics    │
│ • Orders     │  │              │  │              │  │ • Dashboards │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

## Data Flow Examples

### 1. User Login Flow
```
User → Next.js → POST /api/auth/token → Verify credentials
                                      → Generate JWT (RS256)
                                      → Return token
                                      → Store in cookie
```

### 2. Product Import Flow
```
User → Upload CSV → Next.js → POST /api/products/import
                            → Parse CSV
                            → Validate data
                            → Store in products table
                            → Store images in S3/R2
                            → Return batch_id
```

### 3. AI Generation Flow
```
User → Select product → POST /api/products/{id}/generate
                      → Load product data
                      → Build prompt
                      → Call OpenAI API
                      → Run policy checker
                      → Store ai_generations row
                      → Update usage_costs
                      → Return generated content
```

### 4. Listing Publish Flow
```
User → Click "Publish" → POST /api/shops/{id}/listings
                       → Create listing_job (queued)
                       → Enqueue Celery task
                       
Celery Worker → Pick job → Check rate limit (Redis)
                         → Create Etsy draft
                         → Upload images
                         → Publish listing
                         → Update job state (done)
                         → Log audit entry
```

### 5. Scheduled Publishing Flow
```
Celery Beat → Every 5 min → Check active schedules
                          → Calculate remaining quota
                          → Pick products
                          → Enqueue listing_jobs
                          → Respect rate limits
```

### 6. Order Sync Flow
```
Celery Worker → Fetch Etsy orders → Match products
                                  → Create Printful order
                                  → Poll tracking
                                  → Update Etsy with tracking
                                  → Update order status
```

## Tech Stack at a Glance

```
┌─────────────┬─────────────────────────────────────────────┐
│  Layer      │  Technology                                 │
├─────────────┼─────────────────────────────────────────────┤
│  Frontend   │  Next.js 14, React 18, TypeScript          │
│  Styling    │  Tailwind CSS, Custom Blue-Green Theme     │
│  Backend    │  FastAPI, Python 3.11, Pydantic v2         │
│  Database   │  PostgreSQL 16, SQLAlchemy 2.0             │
│  Cache      │  Redis 7                                    │
│  Queue      │  Celery 5.3 + Redis                        │
│  Auth       │  JWT (RS256), OAuth 2.0                    │
│  AI         │  OpenAI, Anthropic                         │
│  Monitoring │  Prometheus, Grafana, Sentry               │
│  Container  │  Docker, Docker Compose                    │
└─────────────┴─────────────────────────────────────────────┘
```

## Directory Structure

```
etsy-automation-platform/
│
├── apps/
│   ├── api/                    ← FastAPI Backend
│   │   ├── app/
│   │   │   ├── models/         ← SQLAlchemy models (10 tables)
│   │   │   ├── schemas/        ← Pydantic schemas
│   │   │   ├── services/       ← Business logic
│   │   │   ├── api/endpoints/  ← API routes (10 routers)
│   │   │   ├── core/           ← Config, database
│   │   │   └── utils/          ← Helpers
│   │   ├── tests/              ← Backend tests
│   │   ├── alembic/            ← DB migrations
│   │   ├── main.py             ← App entry point
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   ├── web/                    ← Next.js Frontend
│   │   ├── app/                ← App Router pages
│   │   │   ├── layout.tsx      ← Root layout
│   │   │   ├── page.tsx        ← Dashboard
│   │   │   └── globals.css     ← Global styles
│   │   ├── components/
│   │   │   ├── layout/         ← Sidebar, TopBar
│   │   │   ├── dashboard/      ← Dashboard widgets
│   │   │   └── ui/             ← Reusable components
│   │   ├── lib/                ← Utils, API client
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.js  ← Custom theme
│   │   └── Dockerfile
│   │
│   └── worker/                 ← Celery Workers
│       ├── tasks/              ← Task definitions
│       ├── requirements.txt
│       └── Dockerfile
│
├── monitoring/
│   ├── prometheus.yml          ← Prometheus config
│   └── grafana/
│       └── dashboards/         ← Pre-built dashboards
│
├── docs/                       ← Additional documentation
│
├── docker-compose.yml          ← Orchestration
├── Makefile                    ← Dev commands
├── .env.example                ← Config template
├── .gitignore
│
├── README.md                   ← Project overview
├── BUILD_GUIDE.md              ← Setup instructions
├── NEXT_STEPS.md               ← Implementation roadmap
└── DELIVERY_SUMMARY.md         ← This summary!
```

## Key Files & Their Purpose

```
File                                Purpose
────────────────────────────────────────────────────────────────
docker-compose.yml                  Defines all 8 services
Makefile                            25+ dev commands
.env.example                        Configuration template

apps/api/main.py                    FastAPI entry point
apps/api/app/core/config.py         Settings management
apps/api/app/core/database.py       DB connection
apps/api/app/models/tenancy.py      User/Tenant/Shop models
apps/api/app/models/listings.py     AI/Job/Order models

apps/web/app/layout.tsx             Root layout with sidebar
apps/web/app/page.tsx               Dashboard page
apps/web/components/layout/Sidebar  Navigation sidebar
apps/web/components/dashboard/*     Dashboard widgets
apps/web/tailwind.config.js         Blue-green theme

monitoring/prometheus.yml           Metrics scraping config
```

## Color Scheme Applied

```
Primary Colors (Blue to Green Gradient):
──────────────────────────────────────────
#3b82f6 → Blue (Primary)
#14b8a6 → Teal (Accent)
#10b981 → Green (Success)

Dark Theme:
──────────────────────────────────────────
#0f172a → Background
#1e293b → Cards/Surfaces
#334155 → Borders
#f1f5f9 → Text
#94a3b8 → Muted Text

Status Colors:
──────────────────────────────────────────
#3b82f6 → NEW (Blue)
#f59e0b → PROCESSING (Orange)
#a855f7 → SHIPPED (Purple)
#6b7280 → QUEUED (Gray)
#eab308 → DRAFTING (Yellow)
#10b981 → DONE (Green)
#ef4444 → FAILED (Red)
```

## Security Measures

```
Layer          Security Feature
────────────────────────────────────────────────────────────────
Auth           JWT (RS256) with 5-min TTL
               Password hashing (bcrypt)
               OAuth 2.0 (Etsy)

Database       SQL injection protection (ORM)
               Token encryption (AES-GCM)
               Soft delete patterns
               RBAC enforcement

API            CORS configuration
               Rate limiting (Redis)
               Request validation (Pydantic)
               Idempotency keys

Network        Docker internal networks
               No exposed ports except web/api
               Secrets via environment variables

Audit          All actions logged
               Request/Response tracking
               Error monitoring (Sentry)
```

## Performance Targets (SLOs)

```
Metric                     Target           Actual (TBD)
────────────────────────────────────────────────────────
API Response Time (p95)    < 500ms          ⏳
Listing Publish (p95)      < 10 min         ⏳
Task Failure Rate          < 2%             ⏳
Token Refresh MTTR         < 15 min         ⏳
Database Queries (p95)     < 100ms          ⏳
Queue Depth                < 5,000 jobs     ⏳
```

---

**This architecture is designed for:**
✅ Scale (10,000+ users)
✅ Reliability (99.9% uptime)
✅ Security (Industry standards)
✅ Maintainability (Clean code)
✅ Observability (Full monitoring)

**Ready to build on this solid foundation! 🚀**
