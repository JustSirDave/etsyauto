"""
Idempotency Middleware
Enforces Idempotency-Key on mutating HTTP requests and caches responses.
"""
import base64
import hashlib
import json
import time
from typing import Iterable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

from app.core.redis import get_redis_client


IDEMPOTENCY_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Paths that don't require idempotency key (e.g., auth endpoints where frontend may not have token yet)
EXEMPT_PATHS = {
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/google",
    "/api/auth/token",
    "/api/auth/refresh",
}


class IdempotencyMiddleware(BaseHTTPMiddleware):
    """
    Enforce Idempotency-Key header for mutating endpoints and cache responses.
    Skips OPTIONS requests and certain auth endpoints.
    """

    def __init__(self, app, ttl_seconds: int = 86400) -> None:
        super().__init__(app)
        self.ttl_seconds = ttl_seconds

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # Skip non-mutating methods
        if request.method not in IDEMPOTENCY_METHODS:
            return await call_next(request)
        
        # Skip exempt paths (e.g., auth endpoints)
        if request.url.path in EXEMPT_PATHS:
            return await call_next(request)

        idempotency_key = request.headers.get("Idempotency-Key")
        if not idempotency_key:
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "IDEMPOTENCY_KEY_REQUIRED",
                        "message": "Idempotency-Key header is required for mutating requests.",
                        "request_id": request.headers.get("X-Request-Id", "unknown"),
                    }
                },
            )

        body = await request.body()
        request._body = body
        body_hash = hashlib.sha256(body).hexdigest()

        cache_key = f"idempotency:{request.method}:{request.url.path}:{idempotency_key}:{body_hash}"
        redis_client = get_redis_client()

        cached = redis_client.get(cache_key)
        if cached:
            cached_payload = json.loads(cached)
            cached_body = base64.b64decode(cached_payload["body"])
            cached_headers = {
                k: v for k, v in cached_payload.get("headers", {}).items()
                if k.lower() not in ("content-length", "transfer-encoding")
            }
            return Response(
                content=cached_body,
                status_code=cached_payload["status"],
                media_type=cached_payload.get("content_type", "application/json"),
                headers=cached_headers,
            )

        response = await call_next(request)

        # Read the response body (consume iterator) and rebuild response
        response_body = b""
        async for chunk in response.body_iterator:
            response_body += chunk

        # Cache only if not a server error
        if response.status_code < 500:
            payload = {
                "status": response.status_code,
                "body": base64.b64encode(response_body).decode("utf-8"),
                "content_type": response.media_type,
                "headers": _filter_headers(response.headers),
                "created_at": int(time.time()),
            }
            redis_client.setex(cache_key, self.ttl_seconds, json.dumps(payload))

        # Filter out Content-Length as it will be recalculated
        filtered_headers = {
            k: v for k, v in response.headers.items() 
            if k.lower() not in ("content-length", "transfer-encoding")
        }
        
        return Response(
            content=response_body,
            status_code=response.status_code,
            media_type=response.media_type,
            headers=filtered_headers,
        )


def _filter_headers(headers: Iterable) -> dict:
    """
    Keep safe headers that help clients parse cached responses.
    """
    allowed = {"content-type", "cache-control"}
    return {k: v for k, v in headers.items() if k.lower() in allowed}
