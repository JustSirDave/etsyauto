# 🎯 Etsy Automation Platform

**AI-assisted, policy-compliant automation for Etsy sellers**

## 🚀 Quick Start

```bash
# Clone and setup
git clone <repo-url>
cd etsy-automation-platform
cp .env.example .env

# Start all services
docker compose up -d

# Access
# Frontend: http://localhost:3000
# API: http://localhost:8080
# API Docs: http://localhost:8080/docs
```

## 📦 Architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Next.js   │─────▶│   FastAPI   │─────▶│  PostgreSQL │
│  Dashboard  │      │     API     │      │   Database  │
└─────────────┘      └─────────────┘      └─────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │   Celery    │
                     │   Workers   │
                     └─────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │    Redis    │
                     │   Broker    │
                     └─────────────┘
```

## 🛠 Tech Stack

- **Frontend**: Next.js 14, Tailwind CSS, Auth.js
- **Backend**: FastAPI (Python 3.11), Pydantic v2
- **Database**: PostgreSQL 16
- **Queue**: Celery + Redis 7
- **Auth**: JWT (RS256), OAuth 2.0 (Etsy)
- **Monitoring**: Prometheus + Grafana + Sentry

## 📁 Project Structure

```
apps/
  web/          Next.js frontend
  api/          FastAPI backend
  worker/       Celery workers
packages/
  shared/       Shared types & utils
docs/           Documentation
```

## 🎯 Core Features (MVP v1)

✅ Multi-tenant dashboard with RBAC  
✅ CSV/JSON product ingestion  
✅ AI-powered title/description/tag generation  
✅ Policy compliance checker  
✅ Rate-limited Etsy publishing  
✅ Automated scheduling  
✅ Printful order sync  
✅ Usage tracking & audit logs  

## 🔐 Security

- JWT tokens (5min TTL, RS256)
- Encrypted OAuth tokens (AES-GCM)
- RBAC: Owner/Admin/Creator/Viewer
- Audit logs for all actions
- Data minimization (GDPR-friendly)

## 📊 Monitoring

- Health: `/healthz`
- Metrics: `/metrics` (Prometheus)
- Logs: Structured JSON
- Alerts: SLO-based thresholds

## 🧪 Testing

```bash
# Backend tests
cd apps/api
pytest

# Frontend tests
cd apps/web
npm test

# E2E tests
npm run test:e2e
```

## 📝 License

Proprietary - All rights reserved

## 🤝 Contributing

See [CONTRIBUTING.md](./docs/CONTRIBUTING.md)

---

**Built with ❤️ for Etsy creators**
