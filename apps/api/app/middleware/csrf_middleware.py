"""
CSRF protection middleware based on trusted request origins.
"""
from urllib.parse import urlparse

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class CSRFMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, allowed_origins: list[str]):
        super().__init__(app)
        self.allowed_origins = [o.rstrip("/") for o in allowed_origins if o]

    @staticmethod
    def _normalized_origin(value: str | None) -> str | None:
        if not value:
            return None
        parsed = urlparse(value)
        if not parsed.scheme or not parsed.netloc:
            return None
        return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")

    def _is_allowed(self, origin_or_referrer: str | None) -> bool:
        normalized = self._normalized_origin(origin_or_referrer)
        if not normalized:
            return False
        return normalized in self.allowed_origins

    async def dispatch(self, request: Request, call_next):
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            return await call_next(request)

        path = request.url.path
        if (
            path.startswith("/api/messages/internal/")
            or path.startswith("/healthz")
            or path.startswith("/metrics")
        ):
            return await call_next(request)

        origin = request.headers.get("origin")
        referer = request.headers.get("referer")

        if not origin and not referer:
            return JSONResponse(
                status_code=403,
                content={
                    "error": {
                        "code": "CSRF_VALIDATION_FAILED",
                        "message": "Request origin not allowed",
                    }
                },
            )

        if not self._is_allowed(origin or referer):
            return JSONResponse(
                status_code=403,
                content={
                    "error": {
                        "code": "CSRF_VALIDATION_FAILED",
                        "message": "Request origin not allowed",
                    }
                },
            )

        return await call_next(request)
