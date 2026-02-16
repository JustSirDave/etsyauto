"""
Etsy Automation Platform - FastAPI Backend
Main application entry point
"""
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from prometheus_client import make_asgi_app
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse

from app.core.config import settings

logger = logging.getLogger(__name__)
from app.core.sentry_config import initialize_sentry
from app.core.logging_redaction import setup_log_redaction
from app.core.database import engine, Base
from app.api.endpoints import auth, shops, products, team, onboarding, dashboard, orders, notifications, ai, schedules, listings, audit, google_oauth, ingestion, audit_logs, policy, webhooks, listing_errors, suppliers, analytics, financials
from app.api.endpoints import metrics as metrics_endpoint
from app.middleware.tenant_context import TenantContextMiddleware
from app.middleware.metrics_middleware import MetricsMiddleware
from app.middleware.sentry_middleware import SentryContextMiddleware
from app.middleware.audit_middleware import AuditMiddleware
from app.middleware.idempotency import IdempotencyMiddleware
from app.middleware.content_length_fix import ContentLengthFixMiddleware

# Initialize logging redaction and Sentry
setup_log_redaction()
initialize_sentry()


def _validate_env() -> None:
    """
    Validate critical environment variables at startup.
    Raises RuntimeError with a clear message if anything is missing.
    """
    errors: list[str] = []

    if not settings.DATABASE_URL:
        errors.append("DATABASE_URL is not set")

    if not settings.JWT_PRIVATE_KEY:
        errors.append("JWT_PRIVATE_KEY is not set")
    if not settings.JWT_PUBLIC_KEY:
        errors.append("JWT_PUBLIC_KEY is not set")

    if not settings.REDIS_URL and not settings.CELERY_BROKER_URL:
        errors.append("Neither REDIS_URL nor CELERY_BROKER_URL is set")

    allowed_envs = {"development", "staging", "production"}
    if settings.ENVIRONMENT not in allowed_envs:
        errors.append(
            f"ENVIRONMENT must be one of {allowed_envs}, got '{settings.ENVIRONMENT}'"
        )

    # Stricter checks in production
    if settings.ENVIRONMENT == "production":
        if not settings.CORS_ORIGINS:
            errors.append("CORS_ORIGINS must not be empty in production")
        if not settings.ETSY_CLIENT_ID:
            errors.append("ETSY_CLIENT_ID is required in production")
        if not settings.ETSY_CLIENT_SECRET:
            errors.append("ETSY_CLIENT_SECRET is required in production")
        if not settings.ENCRYPTION_KEY:
            errors.append("ENCRYPTION_KEY is required in production (32-byte base64-encoded key for AES-GCM)")
        if settings.DEBUG:
            errors.append("DEBUG must be False in production")
        if not settings.COOKIE_SECURE:
            errors.append("COOKIE_SECURE must be True in production (requires HTTPS)")

    if errors:
        msg = "Startup ENV validation failed:\n  - " + "\n  - ".join(errors)
        logger.critical(msg)
        raise RuntimeError(msg)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup — validate environment first
    _validate_env()

    logger.info("Starting Etsy Automation Platform API...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"JWT Issuer: {settings.JWT_ISSUER}")

    # Create tables (for dev - use Alembic in prod)
    if settings.ENVIRONMENT == "development":
        Base.metadata.create_all(bind=engine)

    yield

    # Shutdown
    logger.info("Shutting down API...")


# Create FastAPI app — disable API docs in production
_is_production = settings.ENVIRONMENT == "production"
app = FastAPI(
    title="Etsy Automation Platform API",
    description="AI-assisted, policy-compliant automation for Etsy sellers",
    version="1.0.0",
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    lifespan=lifespan,
)

class CustomCORSMiddleware:
    """
    Pure-ASGI CORS middleware.  Avoids BaseHTTPMiddleware to prevent the
    'Response content longer than Content-Length' RuntimeError caused by
    body-re-streaming in stacked BaseHTTPMiddleware layers.
    """

    def __init__(self, app, allowed_origins: list[str] | None = None, allow_all: bool = False) -> None:
        self.app = app
        self.allowed_origins = allowed_origins or []
        self.allow_all = allow_all

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            return await self.app(scope, receive, send)

        headers_raw = scope.get("headers", [])
        origin = None
        method = scope.get("method", "")
        for k, v in headers_raw:
            if k == b"origin":
                origin = v.decode("latin-1")
                break

        origin_allowed = bool(origin) and (self.allow_all or origin in self.allowed_origins)

        # Fast-path for CORS preflight
        if method == "OPTIONS" and origin_allowed:
            cors_headers = [
                (b"access-control-allow-origin", origin.encode()),
                (b"vary", b"Origin"),
                (b"access-control-allow-methods", b"GET,POST,PUT,DELETE,PATCH,OPTIONS"),
                (b"access-control-allow-headers", b"Authorization,Content-Type,Idempotency-Key,X-Request-Id"),
                (b"access-control-allow-credentials", b"true"),
            ]
            await send({"type": "http.response.start", "status": 204, "headers": cors_headers})
            await send({"type": "http.response.body", "body": b""})
            return

        # Normal request – inject CORS headers into the response start message
        async def send_with_cors(message):
            if message.get("type") == "http.response.start" and origin_allowed:
                extra = [
                    (b"access-control-allow-origin", origin.encode()),
                    (b"vary", b"Origin"),
                    (b"access-control-allow-methods", b"GET,POST,PUT,DELETE,PATCH,OPTIONS"),
                    (b"access-control-allow-headers", b"Authorization,Content-Type,Idempotency-Key,X-Request-Id"),
                    (b"access-control-allow-credentials", b"true"),
                ]

                existing = list(message.get("headers", []))
                # Strip content-length to prevent mismatch from upstream BaseHTTPMiddleware layers
                existing = [(k, v) for k, v in existing if k.lower() not in (b"content-length",)]
                message = {**message, "headers": existing + extra}
            await send(message)

        await self.app(scope, receive, send_with_cors)

# CORS Middleware - Explicitly configured for all endpoints including OPTIONS
# Only allow all origins in development; staging and production use explicit allowlist
cors_allow_all = settings.ENVIRONMENT == "development"
cors_origins = list(dict.fromkeys(settings.CORS_ORIGINS + [settings.FRONTEND_URL]))
app.add_middleware(CustomCORSMiddleware, allowed_origins=cors_origins, allow_all=cors_allow_all)

# Middleware stack (order matters - last added = outermost layer)
app.add_middleware(MetricsMiddleware)  # Track all requests
app.add_middleware(SentryContextMiddleware)  # Sentry error tracking context
app.add_middleware(TenantContextMiddleware)  # Extract tenant context
app.add_middleware(AuditMiddleware)  # Audit logging
app.add_middleware(IdempotencyMiddleware)  # HTTP idempotency enforcement

# Content-Length fix MUST be outermost (added last) to strip Content-Length
# after all BaseHTTPMiddleware layers have re-added it.
app.add_middleware(ContentLengthFixMiddleware)

# Include API routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(google_oauth.router, prefix="/api/oauth", tags=["OAuth"])
app.include_router(onboarding.router, prefix="/api/onboarding", tags=["Onboarding"])
app.include_router(shops.router, prefix="/api/shops", tags=["Shops"])
app.include_router(products.router, prefix="/api/products", tags=["Products"])
app.include_router(team.router, prefix="/api/team", tags=["Team Management"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(orders.router, prefix="/api/orders", tags=["Orders"])
app.include_router(suppliers.router, prefix="/api/suppliers", tags=["Suppliers"])
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
app.include_router(financials.router, prefix="/api/financials", tags=["Financials"])

from app.api.endpoints import financial_invoices
app.include_router(financial_invoices.router, prefix="/api/financials/invoices", tags=["Invoices"])

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
