"""
Tabular EEG inference — auto-adapts to the loaded model's input/output shape.

Supported architectures (detected from model.input_shape):
  (None, 178)      → Dense/MLP, flat input, no reshape
  (None, 178, 1)   → LSTM/1D-CNN, full sequence, reshape to (1, 178, 1)
  (None, N, 1)     → LSTM/1D-CNN, subsampled, subsample 178 → N then reshape

Supported output shapes:
  (None, 5)  → 5-class softmax; class index 0 (argmax) = seizure
  (None, 2)  → binary softmax; index 1 = seizure probability
  (None, 1)  → binary sigmoid; value = seizure probability
"""

import numpy as np
import os
from logger import get_logger

logger = get_logger("services.tabular_model")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "ml_models", "Epilepsy.h5")

_model = None
_input_mode = None   # "flat" | "sequence_full" | "sequence_sub"
_output_mode = None  # "5class" | "binary_softmax" | "binary_sigmoid"


def _detect_modes(model):
    global _input_mode, _output_mode

    in_shape = model.input_shape   # e.g. (None, 178) or (None, 178, 1)
    out_shape = model.output_shape # e.g. (None, 5) or (None, 1)

    # Input mode
    if len(in_shape) == 2:
        # (None, N) → flat Dense input
        _input_mode = "flat"
    elif len(in_shape) == 3:
        n_steps = in_shape[1]
        if n_steps == 178:
            _input_mode = "sequence_full"
        else:
            _input_mode = "sequence_sub"
            globals()["_sub_steps"] = n_steps
    else:
        _input_mode = "flat"

    # Output mode
    n_out = out_shape[-1]
    if n_out == 5:
        _output_mode = "5class"
    elif n_out == 2:
        _output_mode = "binary_softmax"
    else:
        _output_mode = "binary_sigmoid"

    logger.info(
        f"Model shape detected: input_mode={_input_mode} {in_shape} output_mode={_output_mode} {out_shape}",
        extra={"model": "tabular"},
    )


def get_model():
    global _model
    if _model is None:
        try:
            from tensorflow.keras.models import load_model
            _model = load_model(MODEL_PATH)
            logger.info("Tabular model loaded", extra={"model": MODEL_PATH})
            _detect_modes(_model)
        except Exception as e:
            logger.error(f"Could not load tabular model from {MODEL_PATH}: {e}", exc_info=True)
            _model = "demo"
    return _model


def _preprocess(raw_data: list) -> np.ndarray:
    data = np.array(raw_data, dtype=np.float64)

    if data.shape[0] != 178:
        raise ValueError(f"Expected 178 EEG values, got {data.shape[0]}")

    # Normalize (zero mean, unit variance)
    mean, std = data.mean(), data.std()
    if std == 0:
        std = 1.0
    data = (data - mean) / std

    if _input_mode == "flat":
        return data.reshape(1, 178)

    if _input_mode == "sequence_full":
        return data.reshape(1, 178, 1)

    # sequence_sub — subsample to match model's expected timesteps
    n_steps = globals().get("_sub_steps", 45)
    step = max(1, 178 // n_steps)
    subsampled = data[::step][:n_steps]
    return subsampled.reshape(1, n_steps, 1)


def _parse_output(raw_pred: np.ndarray) -> tuple[bool, float, dict]:
    """Return (is_seizure, confidence, class_probabilities)."""
    probs = raw_pred[0]

    if _output_mode == "5class":
        # class index 0 = seizure (label 1 in UCI dataset)
        predicted_idx = int(np.argmax(probs))
        is_seizure = (predicted_idx == 0)
        confidence = float(probs[predicted_idx])
        seizure_prob = float(probs[0])
        return is_seizure, confidence, {
            "seizure": round(seizure_prob, 4),
            "non_seizure": round(1.0 - seizure_prob, 4),
        }

    if _output_mode == "binary_softmax":
        # index 1 = seizure probability
        seizure_prob = float(probs[1])
        is_seizure = seizure_prob >= 0.5
        confidence = seizure_prob if is_seizure else (1.0 - seizure_prob)
        return is_seizure, float(confidence), {
            "seizure": round(seizure_prob, 4),
            "non_seizure": round(float(probs[0]), 4),
        }

    # binary_sigmoid — single value
    seizure_prob = float(probs[0]) if hasattr(probs, "__len__") else float(probs)
    is_seizure = seizure_prob >= 0.5
    confidence = seizure_prob if is_seizure else (1.0 - seizure_prob)
    return is_seizure, float(confidence), {
        "seizure": round(seizure_prob, 4),
        "non_seizure": round(1.0 - seizure_prob, 4),
    }


def predict_tabular(eeg_values: list) -> dict:
    """Run seizure prediction on a list of 178 EEG values from a CSV row."""
    model = get_model()
    raw = np.array(eeg_values, dtype=np.float64)

    signal_stats = {
        "mean": float(np.mean(raw)),
        "std": float(np.std(raw)),
        "min": float(np.min(raw)),
        "max": float(np.max(raw)),
        "range": float(np.max(raw) - np.min(raw)),
        "median": float(np.median(raw)),
        "num_points": int(len(eeg_values)),
    }

    if model == "demo":
        is_seizure = bool(np.random.random() > 0.5)
        confidence = float(np.random.uniform(0.75, 0.99))
        return {
            "prediction": "Seizure" if is_seizure else "Non-Seizure",
            "confidence": round(confidence, 4),
            "class_probabilities": {
                "seizure": round(confidence if is_seizure else 1 - confidence, 4),
                "non_seizure": round(1 - confidence if is_seizure else confidence, 4),
            },
            "signal_stats": signal_stats,
            "model_used": "tabular",
            "demo_mode": True,
        }

    try:
        preprocessed = _preprocess(eeg_values)
        raw_pred = model.predict(preprocessed, verbose=0)
        is_seizure, confidence, class_probs = _parse_output(raw_pred)

        return {
            "prediction": "Seizure" if is_seizure else "Non-Seizure",
            "confidence": round(confidence, 4),
            "class_probabilities": class_probs,
            "signal_stats": signal_stats,
            "model_used": "tabular",
            "demo_mode": False,
        }
    except Exception as e:
        return {
            "prediction": "Error",
            "confidence": 0.0,
            "error": str(e),
            "signal_stats": signal_stats,
            "model_used": "tabular",
            "demo_mode": False,
        }


predict_seizure = predict_tabular
