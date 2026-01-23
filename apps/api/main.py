"""
Etsy Automation Platform - FastAPI Backend
Main application entry point
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from prometheus_client import make_asgi_app
import os

from app.core.config import settings
from app.core.sentry_config import initialize_sentry
from app.core.logging_redaction import setup_log_redaction
from app.core.database import engine, Base
from app.api.endpoints import auth, shops, products, team, onboarding, dashboard, orders, notifications, ai, schedules, listings, audit, google_oauth, ingestion, audit_logs, policy, webhooks, listing_errors
from app.api.endpoints import metrics as metrics_endpoint
from app.middleware.tenant_context import TenantContextMiddleware
from app.middleware.metrics_middleware import MetricsMiddleware
from app.middleware.sentry_middleware import SentryContextMiddleware
from app.middleware.audit_middleware import AuditMiddleware

# Initialize logging redaction and Sentry
setup_log_redaction()
initialize_sentry()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    print("🚀 Starting Etsy Automation Platform API...")
    print(f"📊 Environment: {settings.ENVIRONMENT}")
    print(f"🔐 JWT Issuer: {settings.JWT_ISSUER}")
    
    # Create tables (for dev - use Alembic in prod)
    if settings.ENVIRONMENT == "development":
        Base.metadata.create_all(bind=engine)
    
    yield
    
    # Shutdown
    print("🛑 Shutting down API...")


# Create FastAPI app
app = FastAPI(
    title="Etsy Automation Platform API",
    description="AI-assisted, policy-compliant automation for Etsy sellers",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware - Explicitly configured for all endpoints including OPTIONS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Middleware stack (order matters - first added = outermost layer)
app.add_middleware(MetricsMiddleware)  # Track all requests
app.add_middleware(SentryContextMiddleware)  # Sentry error tracking context
app.add_middleware(TenantContextMiddleware)  # Extract tenant context
app.add_middleware(AuditMiddleware)  # Audit logging

# Include API routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(google_oauth.router, prefix="/api/oauth", tags=["OAuth"])
app.include_router(onboarding.router, prefix="/api/onboarding", tags=["Onboarding"])
app.include_router(shops.router, prefix="/api/shops", tags=["Shops"])
app.include_router(products.router, prefix="/api/products", tags=["Products"])
app.include_router(team.router, prefix="/api/team", tags=["Team Management"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(orders.router, prefix="/api/orders", tags=["Orders"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI Generation"])
app.include_router(schedules.router, prefix="/api/schedules", tags=["Schedules"])
app.include_router(listings.router, prefix="/api/listings", tags=["Listings"])
app.include_router(listing_errors.router, prefix="/api/listings", tags=["Listing Errors"])
app.include_router(audit.router, prefix="/api/audit", tags=["Audit Logs"])
app.include_router(audit_logs.router, prefix="/api/audit/logs", tags=["Audit Logs"])
app.include_router(policy.router, prefix="/api/policy", tags=["Policy Compliance"])
app.include_router(metrics_endpoint.router, prefix="/api", tags=["Observability"])
app.include_router(ingestion.router, prefix="/api/products/ingestion", tags=["Product Ingestion"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["Webhooks"])

# Mount Prometheus metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# Serve static files (profile pictures, etc.)
uploads_dir = "uploads"
if not os.path.exists(uploads_dir):
    os.makedirs(uploads_dir, exist_ok=True)
    
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


@app.get("/healthz", tags=["Health"])
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "service": "etsy-automation-api",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
    }


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint"""
    return {
        "message": "Etsy Automation Platform API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/healthz",
        "metrics": "/metrics",
    }


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "request_id": request.headers.get("X-Request-Id", "unknown"),
            }
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8080,
        reload=True,
        log_level="info",
    )
