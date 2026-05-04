"""
EfficientNetB0 inference service for spectrogram images.

Model: EpilepsyImage.h5
Architecture: EfficientNetB0 → GlobalAveragePooling → Dense(256) → Dense(128) → Dense(1, sigmoid)
Output: single float in [0, 1] — seizure probability
Classes: 0 = non_seizure, 1 = seizure  (binary_crossentropy training)

CLASS IMBALANCE NOTE
The model was trained with ~75 % Non-Seizure / ~25 % Seizure samples.
This biases the sigmoid output downward — the raw probability for a true
seizure case typically lands around 0.25–0.35, well below the naive 0.5
threshold.  We correct for this by:

  1. Lowering the decision threshold to SEIZURE_THRESHOLD (default 0.25,
     matching the seizure class prior from training).
  2. Re-calibrating the confidence score relative to the adjusted threshold
     so the reported number reflects how far the prediction is from the
     decision boundary, not the raw sigmoid value.

Set SEIZURE_THRESHOLD in the environment to override (e.g. 0.30).
"""

import os
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
import numpy as np
from services.spectrogram import eeg_image_to_spectrogram, image_stats
from logger import get_logger

logger = get_logger("services.image_model")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGE_MODEL_PATH = os.path.join(BASE_DIR, "ml_models", "EpilepsyImage.h5")

# Training class ratio: ~75 % non-seizure, ~25 % seizure
# Threshold = seizure_prior = 0.25  (overridable via env var)
SEIZURE_THRESHOLD = float(os.getenv("SEIZURE_THRESHOLD", "0.25"))

# Ensemble weights: Gemini Vision sees the real image; EfficientNetB0 adds
# spectrogram-domain knowledge.  Gemini gets the larger share because it is
# not limited by the training-data imbalance.
ENSEMBLE_WEIGHT_EFF    = float(os.getenv("ENSEMBLE_WEIGHT_EFF",    "0.35"))
ENSEMBLE_WEIGHT_GEMINI = float(os.getenv("ENSEMBLE_WEIGHT_GEMINI", "0.65"))
ENSEMBLE_THRESHOLD     = float(os.getenv("ENSEMBLE_THRESHOLD",     "0.35"))

_image_model = None


def get_image_model():
    global _image_model
    if _image_model is None:
        try:
            from tensorflow.keras.models import load_model
            _image_model = load_model(IMAGE_MODEL_PATH)
            logger.info("EfficientNetB0 image model loaded", extra={"model": IMAGE_MODEL_PATH})
        except Exception as e:
            logger.error(f"Could not load image model from {IMAGE_MODEL_PATH}: {e}", exc_info=True)
            _image_model = "unavailable"
    return _image_model


def predict_image(content: bytes, filename: str = "") -> tuple:
    """
    Convert the uploaded EEG image → STFT spectrogram → EfficientNetB0 prediction.

    Returns
    -------
    (result_dict, spectrogram_png_bytes)
      result_dict          : standard prediction schema
      spectrogram_png_bytes: PNG bytes of the generated spectrogram (for display/storage)

    Raises RuntimeError if the model file is missing.
    """
    stats = image_stats(content, filename)
    model = get_image_model()

    if model == "unavailable":
        raise RuntimeError("ml_models/EpilepsyImage.h5 could not be loaded — Gemini fallback required.")

    # Convert uploaded image → spectrogram array (what the model expects)
    arr, spec_png = eeg_image_to_spectrogram(content, filename)

    raw_pred     = model.predict(arr, verbose=0)  # shape (1, 1)
    seizure_prob = float(raw_pred[0][0])

    # ── Class-imbalance corrected decision ────────────────────────────────────
    # The model was trained on ~75 % Non-Seizure data so its sigmoid output is
    # systematically low.  We use SEIZURE_THRESHOLD (default 0.25) instead of
    # the naive 0.5.
    is_seizure = seizure_prob >= SEIZURE_THRESHOLD

    # Re-calibrate confidence: how far is the raw prob from the decision
    # boundary, rescaled to [0, 1]?
    #   Seizure   side: (prob - threshold) / (1 - threshold)
    #   No-Seizure side: (threshold - prob) / threshold
    if is_seizure:
        confidence = (seizure_prob - SEIZURE_THRESHOLD) / max(1.0 - SEIZURE_THRESHOLD, 1e-6)
    else:
        confidence = (SEIZURE_THRESHOLD - seizure_prob) / max(SEIZURE_THRESHOLD, 1e-6)

    confidence = float(np.clip(confidence, 0.05, 0.99))

    result = {
        "prediction": "Seizure" if is_seizure else "Non-Seizure",
        "confidence": round(confidence, 4),
        "seizure_probability": round(seizure_prob, 4),
        "class_probabilities": {
            "seizure": round(seizure_prob, 4),
            "non_seizure": round(1.0 - seizure_prob, 4),
        },
        "signal_stats": stats,
        "model_used": "image",
        "demo_mode": False,
    }
    return result, spec_png


def predict_image_ensemble(content: bytes, filename: str = "") -> tuple:
    """
    Ensemble: EfficientNetB0 (spectrogram) + Gemini Vision (original image).

    Both models run independently.  Their seizure probabilities are combined
    with weighted averaging:
        final_prob = ENSEMBLE_WEIGHT_EFF * eff_prob + ENSEMBLE_WEIGHT_GEMINI * gemini_prob

    This corrects for:
      - EfficientNetB0's class-imbalance bias (systematically low sigmoid)
      - Input-format mismatch (any EEG image style → Gemini handles it)
      - OOD generalisation (Gemini has broad medical visual knowledge)

    Returns
    -------
    (result_dict, spectrogram_png_bytes)
    """
    from services.gemini_fallback import predict_gemini_vision

    stats = image_stats(content, filename)

    # ── Run EfficientNetB0 on generated spectrogram ───────────────────────────
    eff_prob  = None
    spec_png  = None
    model     = get_image_model()
    if model != "unavailable":
        try:
            arr, spec_png = eeg_image_to_spectrogram(content, filename)
            raw_pred = model.predict(arr, verbose=0)
            eff_prob = float(raw_pred[0][0])
            logger.debug(
                f"EfficientNetB0 raw sigmoid: {eff_prob:.4f} (threshold={SEIZURE_THRESHOLD})",
                extra={"model": "EfficientNetB0"},
            )
        except Exception as e:
            logger.error(f"EfficientNetB0 ensemble step failed: {e}", exc_info=True)
    else:
        logger.warning("EfficientNetB0 model unavailable — skipping", extra={"model": "EfficientNetB0"})

    # ── Run Gemini Vision on original image ───────────────────────────────────
    gemini_prob = None
    gemini_reasoning = ""
    try:
        g = predict_gemini_vision(content, filename.rsplit(".", 1)[-1])
        # Convert Gemini prediction to a seizure probability
        if g["prediction"] == "Seizure":
            gemini_prob = g["confidence"]
        else:
            gemini_prob = 1.0 - g["confidence"]
        gemini_reasoning = g.get("gemini_reasoning", "")
        logger.debug(
            f"Gemini Vision: {g['prediction']} (confidence={g['confidence']:.4f}, seizure_prob={gemini_prob:.4f})",
            extra={"model": "gemini-vision"},
        )
    except Exception as e:
        logger.error(f"Gemini Vision ensemble step failed: {e}", exc_info=True, extra={"model": "gemini-vision"})

    # ── Combine ───────────────────────────────────────────────────────────────
    if eff_prob is not None and gemini_prob is not None:
        final_prob = ENSEMBLE_WEIGHT_EFF * eff_prob + ENSEMBLE_WEIGHT_GEMINI * gemini_prob
        model_used = "ensemble"
        logger.info(
            f"Ensemble result: {ENSEMBLE_WEIGHT_EFF}×{eff_prob:.4f} + {ENSEMBLE_WEIGHT_GEMINI}×{gemini_prob:.4f} = {final_prob:.4f}",
            extra={"model": "ensemble"},
        )
    elif gemini_prob is not None:
        final_prob = gemini_prob
        model_used = "gemini-vision"
        logger.info(f"Using Gemini Vision only: final_prob={final_prob:.4f}", extra={"model": "gemini-vision"})
    elif eff_prob is not None:
        final_prob = eff_prob
        model_used = "image"
        logger.info(f"Using EfficientNetB0 only: final_prob={final_prob:.4f}", extra={"model": "EfficientNetB0"})
    else:
        logger.error("Both EfficientNetB0 and Gemini Vision failed — no prediction possible")
        raise RuntimeError("Both EfficientNetB0 and Gemini Vision failed.")

    is_seizure = final_prob >= ENSEMBLE_THRESHOLD
    confidence = float(np.clip(
        (final_prob - ENSEMBLE_THRESHOLD) / max(1.0 - ENSEMBLE_THRESHOLD, 1e-6)
        if is_seizure else
        (ENSEMBLE_THRESHOLD - final_prob) / max(ENSEMBLE_THRESHOLD, 1e-6),
        0.05, 0.99
    ))

    result = {
        "prediction": "Seizure" if is_seizure else "Non-Seizure",
        "confidence": round(confidence, 4),
        "seizure_probability": round(final_prob, 4),
        "class_probabilities": {
            "seizure": round(final_prob, 4),
            "non_seizure": round(1.0 - final_prob, 4),
        },
        "signal_stats": stats,
        "model_used": model_used,
        "gemini_reasoning": gemini_reasoning,
        "eff_raw_prob": round(eff_prob, 4) if eff_prob is not None else None,
        "demo_mode": False,
    }
    return result, spec_png
