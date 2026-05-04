from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from auth import get_current_user
from models import serialize, to_object_id
from services.r2_storage import public_url, presigned_url, key_exists

router = APIRouter(prefix="/api/history", tags=["History"])


@router.get("/")
def get_history(current_user: dict = Depends(get_current_user)):
    db = get_db()
    docs = (
        db["predictions"]
        .find({"user_id": current_user["id"]})
        .sort("created_at", -1)
    )
    results = []
    for doc in docs:
        p = serialize(doc)
        results.append({
            "id": p["id"],
            "filename": p["filename"],
            "file_type": p["file_type"],
            "prediction": p["prediction"],
            "confidence": p["confidence"],
            "model_used": p.get("model_used"),
            "created_at": p["created_at"].isoformat()
            if hasattr(p.get("created_at"), "isoformat") else str(p.get("created_at", "")),
        })
    return results


@router.get("/{prediction_id}")
def get_prediction_detail(
    prediction_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    oid = to_object_id(prediction_id)
    if not oid:
        raise HTTPException(404, "Invalid prediction ID")

    doc = db["predictions"].find_one({"_id": oid, "user_id": current_user["id"]})
    if not doc:
        raise HTTPException(404, "Prediction not found")

    p = serialize(doc)
    created = p.get("created_at")

    def _resolve_url(key):
        if not key:
            return None
        url = public_url(key)
        if url:
            return url
        try:
            if key_exists(key):
                return presigned_url(key, expiry_seconds=3600)
        except Exception:
            pass
        return None

    is_image_pred = p.get("model_used") in ("image", "gemini-vision", "gemini-fallback", "unavailable")
    spectrogram_url  = _resolve_url(p.get("r2_spectrogram_key")) if is_image_pred else None
    original_img_url = _resolve_url(p.get("r2_input_key"))       if is_image_pred else None

    return {
        "id": p["id"],
        "filename": p["filename"],
        "file_type": p["file_type"],
        "prediction": p["prediction"],
        "confidence": p["confidence"],
        "model_used": p.get("model_used"),
        "fallback_reason": p.get("fallback_reason"),
        "eeg_data": p.get("eeg_data"),
        "signal_stats": p.get("signal_stats"),
        "spectrogram_url": spectrogram_url,
        "original_img_url": original_img_url,
        "created_at": created.isoformat() if hasattr(created, "isoformat") else str(created or ""),
    }
