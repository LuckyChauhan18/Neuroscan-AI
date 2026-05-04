"""
Gemini fallback for seizure prediction.

Triggered when:
  - Primary model (tabular or image) fails to load / raises, OR
  - Prediction confidence < FALLBACK_CONFIDENCE_THRESHOLD, OR
  - Image model returns suspiciously high confidence (≥ SUSPICIOUS_HIGH_CONFIDENCE)
    — in that case predict_gemini_vision is used to actually look at the image.

For image inputs, Gemini Vision sends the actual image bytes so Gemini can
visually inspect the EEG waveform/spectrogram rather than relying on pixel stats.
"""

import os
import io
import json
from logger import get_logger

logger = get_logger("services.gemini_fallback")

FALLBACK_CONFIDENCE_THRESHOLD = float(os.getenv("FALLBACK_CONFIDENCE_THRESHOLD", "0.55"))
SUSPICIOUS_HIGH_CONFIDENCE    = float(os.getenv("SUSPICIOUS_HIGH_CONFIDENCE", "0.95"))
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

_SYSTEM_PROMPT = """You are a medical AI assistant specialized in EEG signal analysis for
epileptic seizure detection. You will receive statistical features of an EEG signal or
image and must classify it as either Seizure or Non-Seizure.

Respond ONLY with a valid JSON object in this exact format:
{
  "prediction": "Seizure" or "Non-Seizure",
  "confidence": <float 0.0-1.0>,
  "reasoning": "<one sentence clinical reasoning>"
}"""

_VISION_PROMPT = """You are an expert neurologist analysing an EEG (electroencephalogram) recording image.

Examine this EEG image carefully and classify it as Seizure or Non-Seizure.

Key seizure indicators to look for:
- High-amplitude rhythmic spike-and-wave discharges
- Sudden large-amplitude bursts or paroxysmal activity
- Abrupt changes in frequency or amplitude compared to background
- Repetitive sharp waves or polyspike complexes
- Loss of normal background rhythm with chaotic high-voltage activity

Respond ONLY with a valid JSON object in this exact format (no markdown fences):
{
  "prediction": "Seizure" or "Non-Seizure",
  "confidence": <float 0.55-0.95>,
  "reasoning": "<one sentence clinical reasoning referencing what you see in the image>"
}"""


def _build_prompt(signal_stats: dict, file_type: str) -> str:
    stats_str = json.dumps(signal_stats, indent=2)
    return (
        f"Analyze the following EEG signal statistics from a {file_type} file "
        f"and classify as Seizure or Non-Seizure:\n\n{stats_str}"
    )


def predict_gemini(signal_stats: dict, file_type: str, fallback_reason: str = "") -> dict:
    """
    Call Gemini to classify EEG signal from its statistics.

    Returns a dict matching the standard prediction schema.
    Raises RuntimeError if GEMINI_API_KEY is not set or API call fails.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY not set — cannot run Gemini fallback")
        raise RuntimeError("GEMINI_API_KEY environment variable not set.")

    try:
        import google.generativeai as genai
    except ImportError:
        logger.error("google-generativeai package not installed")
        raise RuntimeError("google-generativeai package not installed.")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        system_instruction=_SYSTEM_PROMPT,
    )

    logger.info(
        f"Calling Gemini text fallback (reason={fallback_reason!r})",
        extra={"service": "gemini", "model": GEMINI_MODEL},
    )
    prompt = _build_prompt(signal_stats, file_type)
    try:
        response = model.generate_content(prompt)
    except Exception as e:
        logger.error(f"Gemini API call failed: {e}", exc_info=True, extra={"service": "gemini"})
        raise
    raw_text = response.text.strip()

    # Strip markdown code fences if present
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError as e:
        logger.error(f"Gemini text response JSON parse error: {e} | raw={raw_text[:200]!r}")
        raise RuntimeError(f"Gemini returned non-JSON response: {e}") from e

    prediction = parsed.get("prediction", "Non-Seizure")
    confidence = float(parsed.get("confidence", 0.7))
    reasoning = parsed.get("reasoning", "")

    logger.info(
        f"Gemini fallback result: {prediction} (confidence={confidence:.4f})",
        extra={"service": "gemini"},
    )
    is_seizure = prediction == "Seizure"

    return {
        "prediction": prediction,
        "confidence": round(confidence, 4),
        "class_probabilities": {
            "seizure": round(confidence if is_seizure else 1 - confidence, 4),
            "non_seizure": round(1 - confidence if is_seizure else confidence, 4),
        },
        "signal_stats": signal_stats,
        "model_used": "gemini-fallback",
        "fallback_reason": fallback_reason or "low_confidence_or_model_error",
        "gemini_reasoning": reasoning,
        "demo_mode": False,
    }


def predict_gemini_vision(image_bytes: bytes, file_type: str) -> dict:
    """
    Send the actual image to Gemini Vision for visual EEG analysis.
    Used when the primary image model gives a suspiciously high-confidence result
    or fails entirely — Gemini can read EEG waveform patterns directly.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY not set — cannot run Gemini Vision")
        raise RuntimeError("GEMINI_API_KEY environment variable not set.")

    try:
        import google.generativeai as genai
    except ImportError:
        logger.error("google-generativeai package not installed")
        raise RuntimeError("google-generativeai package not installed.")

    from PIL import Image

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name=GEMINI_MODEL)

    logger.info("Calling Gemini Vision", extra={"service": "gemini-vision", "model": GEMINI_MODEL})
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    try:
        response = model.generate_content([_VISION_PROMPT, img])
    except Exception as e:
        logger.error(f"Gemini Vision API call failed: {e}", exc_info=True, extra={"service": "gemini-vision"})
        raise
    raw_text = response.text.strip()

    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]

    try:
        parsed = json.loads(raw_text.strip())
    except json.JSONDecodeError as e:
        logger.error(f"Gemini Vision response JSON parse error: {e} | raw={raw_text[:200]!r}")
        raise RuntimeError(f"Gemini Vision returned non-JSON response: {e}") from e

    prediction = parsed.get("prediction", "Non-Seizure")
    confidence = max(0.0, min(1.0, float(parsed.get("confidence", 0.7))))
    reasoning = parsed.get("reasoning", "")
    logger.info(
        f"Gemini Vision result: {prediction} (confidence={confidence:.4f})",
        extra={"service": "gemini-vision"},
    )

    is_seizure = prediction == "Seizure"
    return {
        "prediction": prediction,
        "confidence": round(confidence, 4),
        "class_probabilities": {
            "seizure": round(confidence if is_seizure else 1 - confidence, 4),
            "non_seizure": round(1 - confidence if is_seizure else confidence, 4),
        },
        "signal_stats": {},
        "model_used": "gemini-vision",
        "fallback_reason": "vision_override",
        "gemini_reasoning": reasoning,
        "demo_mode": False,
    }


def should_fallback(result: dict) -> bool:
    """Return True if confidence is too low to trust the primary model result."""
    return result.get("confidence", 1.0) < FALLBACK_CONFIDENCE_THRESHOLD


def should_use_vision_override(result: dict) -> bool:
    """
    Return True when EfficientNetB0's raw sigmoid output is suspiciously extreme
    (≤ 0.03 or ≥ 0.97), which indicates the model saw an out-of-distribution
    image and saturated — Gemini Vision should make the final call instead.

    We check `seizure_probability` (raw sigmoid) NOT the calibrated confidence,
    because calibrated confidence is now a boundary-distance score and a high
    value simply means a clear prediction, not a broken one.
    """
    if result.get("model_used") != "image":
        return False
    raw = result.get("seizure_probability", 0.5)
    return raw <= 0.03 or raw >= 0.97


def should_use_vision_for_low_confidence(result: dict) -> bool:
    """
    Return True when the image model result has low calibrated confidence
    (prediction near the decision boundary).  For image inputs, Gemini Vision
    is more useful than text-based Gemini in this case.
    """
    return (
        result.get("model_used") == "image"
        and result.get("confidence", 1.0) < FALLBACK_CONFIDENCE_THRESHOLD
    )
