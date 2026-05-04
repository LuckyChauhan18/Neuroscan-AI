"""
Centralized structured logging for NeuroScan AI.

Usage:
    from logger import get_logger
    logger = get_logger(__name__)
    logger.info("Model loaded", extra={"model": "EfficientNetB0"})

Log format is controlled by the LOG_FORMAT env var:
  - "json"  → JSON (production default when LOG_FORMAT=json)
  - "text"  → human-readable (development default)

Log level is controlled by LOG_LEVEL (default: INFO).
Log files are written to LOG_DIR (default: logs/).
"""

import json
import logging
import os
import sys
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_FORMAT = os.getenv("LOG_FORMAT", "text")   # "json" or "text"
LOG_DIR = os.getenv("LOG_DIR", "logs")

_EXTRA_FIELDS = (
    "request_id", "user_id", "path", "method",
    "status_code", "duration_ms", "model", "service",
)


class _JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "module": record.module,
            "fn": record.funcName,
            "line": record.lineno,
        }
        for field in _EXTRA_FIELDS:
            val = getattr(record, field, None)
            if val is not None:
                payload[field] = val
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


_TEXT_FMT = "%(asctime)s [%(levelname)-8s] %(name)s — %(message)s"
_DATE_FMT = "%Y-%m-%dT%H:%M:%S"


def _make_console_handler() -> logging.Handler:
    handler = logging.StreamHandler(sys.stdout)
    if LOG_FORMAT == "json":
        handler.setFormatter(_JSONFormatter())
    else:
        handler.setFormatter(logging.Formatter(_TEXT_FMT, datefmt=_DATE_FMT))
    return handler


def _make_file_handler() -> logging.Handler | None:
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        handler = RotatingFileHandler(
            os.path.join(LOG_DIR, "neuroscan.log"),
            maxBytes=10 * 1024 * 1024,
            backupCount=5,
            encoding="utf-8",
        )
        handler.setFormatter(_JSONFormatter())
        return handler
    except OSError:
        return None


def get_logger(name: str) -> logging.Logger:
    qualified = f"neuroscan.{name}" if not name.startswith("neuroscan") else name
    logger = logging.getLogger(qualified)
    if logger.handlers:
        return logger

    level = getattr(logging, LOG_LEVEL, logging.INFO)
    logger.setLevel(level)
    logger.addHandler(_make_console_handler())

    file_handler = _make_file_handler()
    if file_handler:
        logger.addHandler(file_handler)

    logger.propagate = False
    return logger
