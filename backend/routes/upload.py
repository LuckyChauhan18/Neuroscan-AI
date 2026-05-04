import os
import io
import numpy as np
import pandas as pd
from datetime import datetime
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from database import get_db
from auth import get_current_user
from models import serialize
from services.router import detect_input_type, ALL_ALLOWED
from services.r2_storage import upload_bytes, upload_key, spectrogram_key, public_url, CONTENT_TYPES
from logger import get_logger

logger = get_logger("routes.upload")

router = APIRouter(prefix="/api/upload", tags=["Upload & Analysis"])

ALLOWED_EXTENSIONS = ALL_ALLOWED  # single source of truth from router.py


def parse_csv_eeg(content: bytes) -> list:
    df = pd.read_csv(io.StringIO(content.decode("utf-8")))
    feature_cols = [c for c in df.columns if c.startswith("X") and c[1:].isdigit()]
    if len(feature_cols) >= 178:
        feature_cols = sorted(feature_cols, key=lambda c: int(c[1:]))[:178]
        return df[feature_cols].iloc[0].values.tolist()
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) >= 178:
        return df[numeric_cols[:178]].iloc[0].values.tolist()
    raise ValueError(
        f"CSV must have at least 178 numeric columns. Found {df.shape[1]}. "
        "Expected columns named X1–X178 or 178+ numeric columns."
    )


def _run_tabular(content: bytes):
    from services.tabular_model import predict_tabular
    eeg_values = parse_csv_eeg(content)
    return predict_tabular(eeg_values), eeg_values


def _run_image(content: bytes, filename: str = ""):
    """Returns (result_dict, eeg_values, spectrogram_png_bytes) using ensemble."""
    from services.image_model import predict_image_ensemble
    result, spec_png = predict_image_ensemble(content, filename)
    return result, [], spec_png


def _run_gemini(signal_stats: dict, file_type: str, reason: str) -> dict:
    from services.gemini_fallback import predict_gemini
    return predict_gemini(signal_stats, file_type, fallback_reason=reason)


def _run_gemini_vision(content: bytes, file_type: str) -> dict:
    from services.gemini_fallback import predict_gemini_vision
    return predict_gemini_vision(content, file_type)


@router.post("/analyze")
async def upload_and_analyze(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    filename = file.filename or "unknown"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            400,
            f"Unsupported file type: {ext}. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    user_id = current_user["id"]
    content = await file.read()
    input_type = detect_input_type(filename, content)
    logger.info(
        f"Upload received: '{filename}'",
        extra={
            "user_id": user_id,
            "path": f"ext={ext} input_type={input_type} size={len(content)}B",
        },
    )
    if input_type == "unsupported":
        raise HTTPException(400, f"Cannot determine how to process '{filename}'.")

    result = None
    eeg_values = []
    spec_png = None      # spectrogram PNG bytes (image uploads only)
    fallback_reason = None

    # Tabular path
    if input_type == "tabular":
        try:
            result, eeg_values = _run_tabular(content)
        except ValueError as e:
            raise HTTPException(400, f"Error parsing CSV: {str(e)}")
        except Exception as e:
            fallback_reason = f"tabular_model_error: {str(e)}"
            logger.error(f"Tabular model failed for '{filename}': {e}", exc_info=True)

    # Image path — convert to spectrogram first, then run EfficientNetB0
    elif input_type == "image":
        try:
            result, eeg_values, spec_png = _run_image(content, filename)
        except RuntimeError as e:
            fallback_reason = f"image_model_unavailable: {str(e)}"
            logger.warning(f"Image model unavailable for '{filename}': {e}")
        except Exception as e:
            fallback_reason = f"image_processing_error: {str(e)}"
            logger.error(f"Image processing failed for '{filename}': {e}", exc_info=True)

    # Gemini fallback (model failed)
    if result is None and fallback_reason:
        # For image inputs try Gemini Vision first (it can see the spectrogram)
        if input_type == "image":
            try:
                result = _run_gemini_vision(content, ext.replace(".", ""))
            except Exception:
                pass
        if result is None:
            try:
                dummy_stats = {"num_points": 0, "file_type": ext, "input_type": input_type}
                result = _run_gemini(dummy_stats, ext.replace(".", ""), fallback_reason)
            except Exception as e:
                logger.error(f"All models failed for '{filename}': {e}", exc_info=True)
                result = {
                    "prediction": "Non-Seizure",
                    "confidence": 0.5,
                    "class_probabilities": {"seizure": 0.5, "non_seizure": 0.5},
                    "signal_stats": {},
                    "model_used": "unavailable",
                    "fallback_reason": f"all_models_failed: {str(e)[:120]}",
                    "demo_mode": True,
                }

    # Tabular low-confidence fallback → text Gemini with signal stats
    if result is not None and input_type == "tabular":
        from services.gemini_fallback import should_fallback
        if should_fallback(result):
            try:
                result = _run_gemini(
                    result.get("signal_stats") or {},
                    ext.replace(".", ""),
                    f"low_confidence_tabular_{result['confidence']:.2f}",
                )
            except Exception:
                pass

    if result is None:
        raise HTTPException(500, "All models failed to produce a result.")

    fallback_reason = result.get("fallback_reason")
    logger.info(
        f"Analysis complete: {result['prediction']} ({result['confidence']:.4f})",
        extra={
            "user_id": user_id,
            "model": result.get("model_used"),
            "path": f"demo={result.get('demo_mode', False)} fallback={bool(fallback_reason)}",
        },
    )

    # Save prediction metadata to MongoDB first to get the prediction_id
    db = get_db()
    prediction_doc = {
        "user_id": user_id,
        "filename": filename,
        "file_type": ext.replace(".", "") or input_type,
        "prediction": result["prediction"],
        "confidence": result["confidence"],
        "model_used": result.get("model_used", input_type),
        "fallback_reason": fallback_reason,
        "report_narrative": None,
        "signal_stats": result.get("signal_stats"),
        "eeg_data": eeg_values[:178] if eeg_values else None,
        "r2_input_key": None,
        "r2_reports": {},
        "created_at": datetime.utcnow(),
    }
    inserted = db["predictions"].insert_one(prediction_doc)
    prediction_id = str(inserted.inserted_id)

    # Upload raw file to R2
    r2_key = None
    try:
        content_type = CONTENT_TYPES.get(ext.lstrip("."), "application/octet-stream")
        r2_key = upload_key(user_id, prediction_id, filename)
        upload_bytes(r2_key, content, content_type)
        db["predictions"].update_one(
            {"_id": inserted.inserted_id},
            {"$set": {"r2_input_key": r2_key}},
        )
    except Exception as e:
        logger.warning(f"R2 upload failed for prediction {prediction_id} (result still saved): {e}")

    # Upload generated spectrogram PNG to R2 (shown on Results page)
    r2_spec_key = None
    if spec_png and input_type == "image":
        try:
            r2_spec_key = spectrogram_key(user_id, prediction_id)
            upload_bytes(r2_spec_key, spec_png, "image/png")
            db["predictions"].update_one(
                {"_id": inserted.inserted_id},
                {"$set": {"r2_spectrogram_key": r2_spec_key}},
            )
        except Exception as e:
            logger.warning(f"Spectrogram R2 upload failed for prediction {prediction_id}: {e}")

    spectrogram_url  = None
    original_img_url = None
    if input_type == "image":
        spectrogram_url  = public_url(r2_spec_key or "")
        original_img_url = public_url(r2_key or "")

    return {
        "id": prediction_id,
        "filename": filename,
        "file_type": prediction_doc["file_type"],
        "prediction": result["prediction"],
        "confidence": result["confidence"],
        "class_probabilities": result.get("class_probabilities"),
        "signal_stats": result.get("signal_stats"),
        "eeg_data": eeg_values[:178] if eeg_values else None,
        "model_used": prediction_doc["model_used"],
        "fallback_reason": fallback_reason,
        "demo_mode": result.get("demo_mode", False),
        "spectrogram_url": spectrogram_url,
        "original_img_url": original_img_url,
        "created_at": prediction_doc["created_at"].isoformat(),
    }
