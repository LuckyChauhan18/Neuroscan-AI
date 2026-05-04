"""
AI-generated detailed medical report via OpenRouter (GPT-4o JSON mode).

Returns a structured dict with 9 clinical sections:
  summary, eeg_characteristics, clinical_interpretation, risk_assessment,
  differential_diagnosis, immediate_actions, recommendations,
  follow_up_plan, lifestyle_guidance

Result is cached on Prediction.report_narrative (serialised as JSON string)
to avoid re-billing on every page load.
"""

import os
import json
import httpx
from logger import get_logger

logger = get_logger("services.openrouter_report")

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o")

_SYSTEM_PROMPT = """\
You are an AI-assisted EEG analysis system writing a formal clinical report.
Given EEG analysis results, produce a comprehensive report as a single
JSON object with EXACTLY these keys (no extras, no markdown fences):

{
  "executive_summary": "<1-2 sentence neutral AI-assistive summary: state the prediction, confidence level (Low/Moderate/High), and that clinical correlation is required>",
  "confidence_level": "<Low | Moderate | High — derive from the confidence score: 0-30%=Low, 30-70%=Moderate, 70%+=High>",
  "summary": "<One concise sentence in neutral, non-diagnostic language capturing the key finding>",
  "eeg_characteristics": "<2-3 sentences describing signal morphology, amplitude range, dominant frequency bands, and notable waveform features observed in the statistics>",
  "clinical_interpretation": "<3-4 sentences of clinical meaning using hedged language ('may indicate', 'possibly consistent with', 'warrants evaluation') — NOT diagnostic assertions>",
  "risk_assessment": {
    "level": "<MUST align with BOTH prediction AND confidence score: Seizure+0-30%=Moderate, Seizure+30-70%=Moderate, Seizure+70-85%=High, Seizure+85%+=Critical, Non-Seizure+>=50%=Low, Non-Seizure+<50%=Moderate>",
    "rationale": "<1-2 sentences explicitly referencing the confidence score and confidence level to justify the risk level>",
    "factors": ["<risk factor 1>", "<risk factor 2>", "<risk factor 3>"]
  },
  "differential_diagnosis": ["<condition 1>", "<condition 2>", "<always include: Non-epileptic artifact or signal noise as one option>"],
  "immediate_actions": ["<action 1>", "<action 2>", "<action 3>"],
  "recommendations": ["<rec 1>", "<rec 2>", "<rec 3>", "<rec 4>", "<rec 5>"],
  "follow_up_plan": "<2-3 sentences with concrete follow-up timeline, specialist type, and next tests>",
  "lifestyle_guidance": ["<tip 1>", "<tip 2>", "<tip 3>", "<tip 4>"]
}

Critical rules:
- Use assistive, not authoritative tone: 'may indicate', 'possibly consistent with', 'warrants clinical evaluation'.
- Never write definitive assertions ('confirms', 'is consistent with seizure', 'shows ictal activity') without qualification.
- Risk level MUST match confidence: a confidence of 41% can NEVER yield a High or Critical risk level.
- Always explicitly reference the confidence score and its level (Low/Moderate/High) in executive_summary and risk rationale.
- Always include a non-epileptic artifact or variant as one differential diagnosis option.
- Note in clinical_interpretation that confidence score reflects model certainty, not clinical certainty.
- Be specific — reference the actual confidence score and signal statistics.
- Return ONLY the JSON object — no preamble, no explanation, no markdown code fences.
"""


def _build_prompt(prediction: str, confidence: float, signal_stats: dict,
                  model_used: str, file_type: str) -> str:
    stats_str = json.dumps(signal_stats or {}, indent=2)
    return (
        f"EEG Analysis Results:\n"
        f"  Prediction:   {prediction}\n"
        f"  Confidence:   {confidence * 100:.1f}%\n"
        f"  AI Model:     {model_used}\n"
        f"  File Type:    {file_type}\n"
        f"  Signal Stats:\n{stats_str}\n\n"
        f"Generate the comprehensive clinical report JSON."
    )


def _static_report(prediction: str, confidence: float = 0.85) -> dict:
    """Fallback structured report used when OpenRouter is unavailable."""
    is_seizure = prediction == "Seizure"
    conf_pct = f"{confidence * 100:.1f}%"

    if confidence < 0.30:
        conf_level = "Low"
    elif confidence < 0.70:
        conf_level = "Moderate"
    else:
        conf_level = "High"

    # Risk level aligned with BOTH prediction and confidence
    if is_seizure:
        if confidence < 0.70:
            risk_level = "Moderate"
        elif confidence < 0.85:
            risk_level = "High"
        else:
            risk_level = "Critical"
    else:
        risk_level = "Low" if confidence >= 0.50 else "Moderate"

    if is_seizure:
        return {
            "executive_summary": (
                f"The AI model detected patterns possibly consistent with epileptiform activity "
                f"with a confidence score of {conf_pct} ({conf_level} certainty). "
                "Clinical correlation by a qualified neurologist is required before any conclusions are drawn."
            ),
            "confidence_level": conf_level,
            "summary": (
                f"EEG analysis indicates possible epileptiform-like patterns with {conf_level.lower()} "
                f"AI confidence ({conf_pct}); neurological evaluation is recommended."
            ),
            "eeg_characteristics": (
                "The recorded EEG signal exhibits elevated-amplitude, rhythmic patterns that may be "
                "consistent with ictal-like activity. Dominant frequency components appear within the 1–30 Hz range "
                "with notable amplitude elevations. Inter-electrode synchrony may be increased."
            ),
            "clinical_interpretation": (
                f"The identified patterns may be associated with epileptiform discharges; however, the "
                f"{conf_level.lower()} confidence score ({conf_pct}) indicates these findings should be "
                "interpreted cautiously and cannot be treated as diagnostic. The rhythmic nature and amplitude "
                "profile may suggest peri-ictal brain states, but non-epileptic causes should be carefully "
                "considered. Clinical evaluation by a neurologist is essential before drawing any conclusions."
            ),
            "risk_assessment": {
                "level": risk_level,
                "rationale": (
                    f"AI confidence of {conf_pct} ({conf_level} certainty) with a seizure prediction yields "
                    f"a {risk_level.lower()} risk classification. Clinical validation is required to confirm "
                    "or exclude this finding."
                ),
                "factors": [
                    "Possible presence of epileptiform-like signal patterns",
                    f"Model confidence: {conf_pct} ({conf_level} certainty)",
                    "Clinical correlation and neurological review required",
                ],
            },
            "differential_diagnosis": [
                "Focal epilepsy with possible secondary generalisation",
                "Generalised seizure-like pattern",
                "Non-epileptic artifact or muscle/electrode interference",
            ],
            "immediate_actions": [
                "Consult a qualified neurologist for clinical evaluation",
                "Avoid driving or operating heavy machinery until cleared by a physician",
                "Seek emergency care if seizure-like symptoms occur or last >5 minutes",
            ],
            "recommendations": [
                "This is an AI-assisted analysis — consult a qualified neurologist for diagnosis.",
                "Schedule a full clinical EEG monitoring session for confirmation.",
                "Undergo MRI brain imaging to rule out structural causes.",
                "Discuss anti-epileptic medication evaluation with your neurologist if clinically indicated.",
                "Keep a symptom diary recording frequency, duration, and any potential triggers.",
            ],
            "follow_up_plan": (
                f"Given the {conf_level.lower()} confidence finding, a neurology outpatient appointment should "
                "be arranged within 3–7 days to correlate these AI findings with clinical history and examination. "
                "A prolonged ambulatory EEG or video-EEG study within two weeks is recommended for confirmation. "
                "Metabolic workup and brain imaging should be completed before the neurology review."
            ),
            "lifestyle_guidance": [
                "Ensure 7–9 hours of uninterrupted sleep per night — sleep deprivation can lower seizure threshold.",
                "Avoid alcohol and recreational drugs which may precipitate neurological events.",
                "Inform close contacts of this finding and discuss basic first-aid awareness.",
                "Wear medical alert identification if seizure activity is subsequently confirmed by a clinician.",
            ],
        }
    return {
        "executive_summary": (
            f"The AI model found no significant epileptiform patterns with a confidence score of {conf_pct} "
            f"({conf_level} certainty). Clinical correlation is still recommended as a single normal AI "
            "analysis does not exclude epilepsy."
        ),
        "confidence_level": conf_level,
        "summary": (
            f"EEG analysis shows no significant epileptiform patterns with {conf_level.lower()} AI confidence "
            f"({conf_pct}); routine clinical follow-up is advised."
        ),
        "eeg_characteristics": (
            "The EEG signal demonstrates relatively organised background activity with amplitude "
            "values within physiological limits. No obvious abnormal sharp waves, spikes, or slow-wave "
            "complexes are identified in the analysed segment. Dominant frequency components appear "
            "within a physiologically normal range."
        ),
        "clinical_interpretation": (
            f"The AI-analysed recording does not reveal significant epileptiform patterns ({conf_pct} confidence). "
            "This finding may be reassuring and may not suggest active seizure disorder, though clinical "
            "correlation remains important. A single normal AI analysis does not entirely exclude epilepsy, "
            "as inter-ictal recordings can appear normal. Clinical history and examination are essential "
            "for a complete assessment."
        ),
        "risk_assessment": {
            "level": risk_level,
            "rationale": (
                f"No significant epileptiform activity detected with {conf_pct} ({conf_level} certainty). "
                f"Risk is classified as {risk_level.lower()} pending clinical correlation."
            ),
            "factors": [
                "Single-session recording — inter-ictal EEGs can appear normal in epilepsy",
                f"Model confidence: {conf_pct} ({conf_level} certainty)",
                "Clinical symptoms not captured during recording window",
            ],
        },
        "differential_diagnosis": [
            "Normal EEG variant",
            "Inter-ictal recording in known epilepsy",
            "Non-epileptic artifact or functional neurological disorder",
        ],
        "immediate_actions": [
            "Consult a neurologist to correlate AI findings with clinical history",
            "Report any new neurological symptoms promptly to a healthcare provider",
            "Continue any prescribed medications without interruption",
        ],
        "recommendations": [
            "This is an AI-assisted analysis — consult a qualified neurologist for confirmation.",
            "Continue regular health checkups as scheduled.",
            "Maintain a consistent and healthy sleep schedule.",
            "Report any unusual neurological symptoms to your healthcare provider.",
            "Consider repeat EEG or clinical review if symptoms persist or worsen.",
        ],
        "follow_up_plan": (
            "A routine neurology review within 4–6 weeks is advisable to correlate these AI findings "
            "with the full clinical picture. If new or worsening neurological symptoms arise, an earlier "
            "appointment and repeat EEG should be arranged. No urgent intervention appears necessary at this stage."
        ),
        "lifestyle_guidance": [
            "Maintain a regular sleep schedule with 7–9 hours of sleep per night.",
            "Manage stress through mindfulness, exercise, or relaxation techniques.",
            "Limit caffeine intake and avoid sustained sleep deprivation.",
            "Stay well-hydrated and maintain a balanced diet.",
        ],
    }


def generate_narrative(prediction: str, confidence: float, signal_stats: dict,
                       model_used: str, file_type: str) -> str:
    """
    Call OpenRouter to generate a structured clinical report JSON.

    Returns a JSON *string* (so it can be stored verbatim in MongoDB).
    Falls back to the static report on API failure.
    """
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        logger.warning("OPENROUTER_API_KEY not set — using static fallback report")
        return json.dumps(_static_report(prediction, confidence))

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": _build_prompt(
                prediction, confidence, signal_stats, model_used, file_type
            )},
        ],
        "max_tokens": 1600,
        "temperature": 0.25,
        "response_format": {"type": "json_object"},
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://neuroscan-ai.app",
        "X-Title": "NeuroScan AI",
    }

    logger.info(
        f"Generating OpenRouter structured report (prediction={prediction})",
        extra={"service": "openrouter", "model": OPENROUTER_MODEL},
    )
    try:
        response = httpx.post(
            f"{OPENROUTER_BASE_URL}/chat/completions",
            json=payload,
            headers=headers,
            timeout=45.0,
        )
        response.raise_for_status()
        raw = response.json()["choices"][0]["message"]["content"].strip()
        parsed = json.loads(raw)
        logger.info("OpenRouter report generated successfully", extra={"service": "openrouter"})
        return json.dumps(parsed)
    except httpx.HTTPStatusError as e:
        logger.error(
            f"OpenRouter HTTP error {e.response.status_code}: {e.response.text[:200]}",
            extra={"service": "openrouter"},
        )
        return json.dumps(_static_report(prediction, confidence))
    except json.JSONDecodeError as e:
        logger.error(f"OpenRouter response JSON parse error: {e}", extra={"service": "openrouter"})
        return json.dumps(_static_report(prediction, confidence))
    except Exception as e:
        logger.error(
            f"OpenRouter structured report failed: {e}",
            exc_info=True,
            extra={"service": "openrouter"},
        )
        return json.dumps(_static_report(prediction, confidence))


def parse_narrative(narrative_str: str) -> dict:
    """
    Parse a stored narrative string back into a structured dict.
    Handles both the new JSON format and the legacy plain-text format.
    """
    if not narrative_str:
        return {}
    try:
        data = json.loads(narrative_str)
        if isinstance(data, dict) and "summary" in data:
            return data
    except (json.JSONDecodeError, TypeError):
        pass

    # Legacy plain-text format — convert to minimal structured dict
    lines = narrative_str.strip().splitlines()
    interp_lines, recs = [], []
    for line in lines:
        s = line.strip()
        if s.startswith("•") or s.startswith("-"):
            recs.append(s.lstrip("•-").strip())
        elif s:
            interp_lines.append(s)

    return {
        "summary": interp_lines[0] if interp_lines else "EEG analysis complete.",
        "eeg_characteristics": "",
        "clinical_interpretation": " ".join(interp_lines),
        "risk_assessment": {"level": "Unknown", "rationale": "", "factors": []},
        "differential_diagnosis": [],
        "immediate_actions": [],
        "recommendations": recs or ["Consult a qualified neurologist."],
        "follow_up_plan": "",
        "lifestyle_guidance": [],
    }
