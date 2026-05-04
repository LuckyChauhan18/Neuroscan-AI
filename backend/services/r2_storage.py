"""
Cloudflare R2 storage service (S3-compatible).

R2 bucket layout:
  uploads/{user_id}/{prediction_id}/{filename}   — raw user uploads (CSV/PNG/JPG)
  reports/{user_id}/{prediction_id}/report.pdf
  reports/{user_id}/{prediction_id}/report.docx
  reports/{user_id}/{prediction_id}/report.json
"""

import os
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from logger import get_logger

logger = get_logger("services.r2_storage")

_client = None


def _get_client():
    global _client
    if _client is None:
        account_id = os.getenv("R2_ACCOUNT_ID")
        if not account_id:
            logger.error("R2_ACCOUNT_ID not set — R2 storage unavailable")
            raise RuntimeError("R2_ACCOUNT_ID environment variable not set.")
        _client = boto3.client(
            "s3",
            endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
            config=Config(
                signature_version="s3v4",
                retries={"max_attempts": 3, "mode": "adaptive"},
            ),
        )
    return _client


def _bucket() -> str:
    return os.getenv("R2_BUCKET_NAME", "neuroscan")


def upload_bytes(key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    """Upload bytes to R2 and return the key."""
    _get_client().put_object(
        Bucket=_bucket(),
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return key


def download_bytes(key: str) -> bytes:
    """Download an object from R2 and return its bytes."""
    response = _get_client().get_object(Bucket=_bucket(), Key=key)
    return response["Body"].read()


def key_exists(key: str) -> bool:
    try:
        _get_client().head_object(Bucket=_bucket(), Key=key)
        return True
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code not in ("404", "NoSuchKey"):
            logger.warning(f"R2 head_object unexpected error for key={key!r}: {code}")
        return False


def presigned_url(key: str, expiry_seconds: int = 3600) -> str:
    """Generate a time-limited presigned GET URL for a key."""
    return _get_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": _bucket(), "Key": key},
        ExpiresIn=expiry_seconds,
    )


def public_url(key: str) -> str | None:
    """Return a permanent public URL if R2_PUBLIC_URL_PREFIX is configured."""
    prefix = os.getenv("R2_PUBLIC_URL_PREFIX", "").rstrip("/")
    if not prefix:
        return None
    return f"{prefix}/{key}"


# ── Key builders ────────────────────────────────────────────────────────────

def upload_key(user_id: str, prediction_id: str, filename: str) -> str:
    return f"uploads/{user_id}/{prediction_id}/{filename}"


def spectrogram_key(user_id: str, prediction_id: str) -> str:
    return f"uploads/{user_id}/{prediction_id}/spectrogram.png"


def report_key(user_id: str, prediction_id: str, fmt: str) -> str:
    return f"reports/{user_id}/{prediction_id}/report.{fmt}"


CONTENT_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "json": "application/json",
    "csv": "text/csv",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "txt": "text/plain",
}
