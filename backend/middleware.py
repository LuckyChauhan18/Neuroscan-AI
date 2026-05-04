"""
HTTP middleware for NeuroScan AI.

RequestLoggingMiddleware
  - Assigns a short request_id (UUID prefix) to every request.
  - Logs method, path, status code, and wall-clock duration.
  - Attaches X-Request-ID response header so clients can correlate logs.
  - Catches unhandled exceptions and returns a consistent JSON 500 response
    instead of letting FastAPI return its default HTML error page.
"""

import time
import uuid

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from logger import get_logger

_log = get_logger("middleware")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id

        start = time.perf_counter()

        _log.info(
            f"{request.method} {request.url.path}",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
            },
        )

        try:
            response = await call_next(request)
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            _log.critical(
                f"Unhandled exception on {request.method} {request.url.path}: {exc}",
                exc_info=True,
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": duration_ms,
                },
            )
            return JSONResponse(
                status_code=500,
                content={
                    "detail": "An unexpected server error occurred. Please try again.",
                    "request_id": request_id,
                },
                headers={"X-Request-ID": request_id},
            )

        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        level = _log.warning if response.status_code >= 400 else _log.info
        level(
            f"{request.method} {request.url.path} → {response.status_code} ({duration_ms} ms)",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            },
        )

        response.headers["X-Request-ID"] = request_id
        return response
