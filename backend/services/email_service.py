"""
SMTP email service for NeuroScan AI.

Sends a formatted HTML report email to the user when their EEG analysis report
is first generated.  The email includes:
  - Personalised greeting
  - Full prediction summary (result, confidence, risk, model)
  - Clinical summary and top recommendations from the AI report
  - Attached waveform PNG (EEG chart for tabular data, spectrogram for image data)
  - AI disclaimer in a prominent warning box
  - NeuroScan AI Team sign-off

Required environment variables:
  SMTP_HOST       — e.g. smtp.gmail.com
  SMTP_PORT       — 587 (STARTTLS) or 465 (SSL)
  SMTP_USER       — sender email address
  SMTP_PASSWORD   — SMTP password or App Password (Gmail)
  SMTP_FROM_NAME  — display name (default: NeuroScan AI Team)

Gmail note: enable "App Passwords" under your Google Account → Security.
"""

import io
import os
import smtplib
import ssl
from email.mime.application import MIMEApplication
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone
from typing import Optional

import numpy as np
from PIL import Image, ImageDraw

from logger import get_logger

logger = get_logger("services.email_service")

_SMTP_HOST      = os.getenv("SMTP_HOST", "")
_SMTP_PORT      = int(os.getenv("SMTP_PORT", "587"))
_SMTP_USER      = os.getenv("SMTP_USER", "")
_SMTP_PASSWORD  = os.getenv("SMTP_PASSWORD", "")
# Support both EMAIL_FROM_NAME and SMTP_FROM_NAME
_FROM_NAME      = os.getenv("EMAIL_FROM_NAME") or os.getenv("SMTP_FROM_NAME", "NeuroScan AI Team")


# ── Waveform chart (PIL) ──────────────────────────────────────────────────────

def _make_waveform_png(eeg_data: list, is_seizure: bool) -> Optional[bytes]:
    """Render a clean EEG waveform PNG using PIL.  Returns None on failure."""
    try:
        W, H = 600, 200
        PAD_X, PAD_Y = 40, 24
        BG    = (13, 14, 20)
        GRID  = (30, 36, 58)
        LINE  = (220, 60, 60) if is_seizure else (0, 210, 255)
        AXIS  = (80, 90, 120)

        img  = Image.new("RGB", (W, H), color=BG)
        draw = ImageDraw.Draw(img)

        plot_w = W - 2 * PAD_X
        plot_h = H - 2 * PAD_Y

        # Horizontal grid lines (5 lines)
        for i in range(5):
            y = PAD_Y + plot_h * i // 4
            draw.line([(PAD_X, y), (W - PAD_X, y)], fill=GRID, width=1)

        # Vertical grid lines (8 lines)
        for i in range(9):
            x = PAD_X + plot_w * i // 8
            draw.line([(x, PAD_Y), (x, H - PAD_Y)], fill=GRID, width=1)

        # Axis border
        draw.rectangle([PAD_X, PAD_Y, W - PAD_X, H - PAD_Y], outline=AXIS, width=1)

        data = np.array(eeg_data, dtype=np.float64)
        if data.size == 0:
            return None

        mn, mx = data.min(), data.max()
        rng = mx - mn if (mx - mn) > 1e-9 else 1.0
        norm = (data - mn) / rng   # [0, 1]

        # Subsample so we have at most plot_w points
        step     = max(1, len(norm) // plot_w)
        sampled  = norm[::step][:plot_w]
        n        = len(sampled)
        if n < 2:
            return None

        # Build polyline
        pts = [
            (
                PAD_X + int(i * plot_w / (n - 1)),
                PAD_Y + int((1.0 - v) * plot_h),
            )
            for i, v in enumerate(sampled)
        ]
        draw.line(pts, fill=LINE, width=2)

        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        return buf.getvalue()
    except Exception as exc:
        logger.warning(f"Waveform PNG generation failed: {exc}")
        return None


def _fetch_r2_image(key: str) -> Optional[bytes]:
    """Try to download an image from R2; return None if unavailable."""
    if not key:
        return None
    try:
        from services.r2_storage import download_bytes, key_exists
        if key_exists(key):
            return download_bytes(key)
    except Exception as exc:
        logger.warning(f"R2 image fetch failed for key={key!r}: {exc}")
    return None


def _resize_image(img_bytes: bytes, max_width: int = 800) -> bytes:
    """Resize image to max_width if wider; return original bytes on failure."""
    try:
        pil = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        if pil.width > max_width:
            ratio = max_width / pil.width
            pil = pil.resize((max_width, int(pil.height * ratio)), Image.LANCZOS)
        buf = io.BytesIO()
        pil.save(buf, format="PNG", optimize=True)
        return buf.getvalue()
    except Exception:
        return img_bytes


# ── HTML template ─────────────────────────────────────────────────────────────

_PRED_BG    = {"Seizure": "#fff0f0", "Non-Seizure": "#f0fff4"}
_PRED_BORDER= {"Seizure": "#ff4444", "Non-Seizure": "#22c55e"}
_PRED_COLOR = {"Seizure": "#cc0000", "Non-Seizure": "#166534"}
_RISK_COLOR = {"Low": "#166534", "Moderate": "#92400e", "High": "#9a3412", "Critical": "#7f1d1d",
               "Unknown": "#374151"}
_RISK_BG    = {"Low": "#f0fdf4", "Moderate": "#fffbeb", "High": "#fff7ed", "Critical": "#fef2f2",
               "Unknown": "#f9fafb"}


def _build_html(
    full_name: str,
    prediction: str,
    confidence: float,
    model_used: str,
    filename: str,
    generated_at: str,
    risk_level: str,
    risk_rationale: str,
    summary: str,
    recommendations: list,
    attachment_names: list,
) -> str:
    pred_bg     = _PRED_BG.get(prediction, "#f9fafb")
    pred_border = _PRED_BORDER.get(prediction, "#6b7280")
    pred_color  = _PRED_COLOR.get(prediction, "#374151")
    risk_color  = _RISK_COLOR.get(risk_level, _RISK_COLOR["Unknown"])
    risk_bg     = _RISK_BG.get(risk_level, _RISK_BG["Unknown"])
    conf_pct    = f"{confidence * 100:.1f}%"
    model_label = (
        model_used.replace("-", " ").replace("_", " ").title()
        if model_used else "AI Model"
    )

    recs_html = "".join(
        f'<li style="margin:6px 0;color:#374151;font-size:14px;">{r}</li>'
        for r in (recommendations or [])[:5]
    )
    if attachment_names:
        files_html = "".join(
            f'<span style="display:inline-block;background:#f3f4f8;border:1px solid #e5e7eb;'
            f'border-radius:6px;padding:3px 10px;margin:3px 4px 3px 0;font-size:12px;'
            f'color:#374151;font-family:monospace;">{n}</span>'
            for n in attachment_names
        )
        attachment_note = (
            f'<p style="color:#6b7280;font-size:13px;margin-top:16px;">'
            f'📎 <em>The following files are attached to this email:</em></p>'
            f'<p style="margin:6px 0 0;">{files_html}</p>'
        )
    else:
        attachment_note = ''

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NeuroScan AI Report</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f8;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">

        <!-- ── HEADER ── -->
        <tr>
          <td style="background:linear-gradient(135deg,#0077b6 0%,#00b4d8 100%);
                     padding:32px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:700;
                        letter-spacing:-0.5px;">🧠 NeuroScan AI</h1>
            <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">
              Epileptic Seizure Detection Report
            </p>
          </td>
        </tr>

        <!-- ── GREETING ── -->
        <tr>
          <td style="padding:36px 40px 0;">
            <p style="font-size:16px;color:#111827;margin:0 0 8px;">
              Dear <strong>{full_name}</strong>,
            </p>
            <p style="font-size:14px;color:#4b5563;margin:0;line-height:1.6;">
              Your EEG analysis has been completed by NeuroScan AI.
              Below is a summary of the AI-generated report for the file
              <strong>{filename}</strong>, processed on {generated_at}.
            </p>
          </td>
        </tr>

        <!-- ── PREDICTION CARD ── -->
        <tr>
          <td style="padding:24px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:{pred_bg};border:2px solid {pred_border};
                          border-radius:10px;overflow:hidden;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 4px;font-size:11px;color:#6b7280;
                             text-transform:uppercase;letter-spacing:0.08em;">AI Prediction</p>
                  <p style="margin:0;font-size:22px;font-weight:700;color:{pred_color};">
                    {'⚠️ Seizure Detected' if prediction == 'Seizure' else '✅ No Seizure Detected'}
                  </p>
                </td>
                <td style="padding:20px 24px;text-align:right;">
                  <p style="margin:0 0 2px;font-size:11px;color:#6b7280;
                             text-transform:uppercase;letter-spacing:0.08em;">Confidence</p>
                  <p style="margin:0;font-size:28px;font-weight:700;color:{pred_color};">
                    {conf_pct}
                  </p>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding:0 24px 16px;">
                  <p style="margin:0;font-size:13px;color:#6b7280;">
                    Model: <strong style="color:#374151;">{model_label}</strong>
                    &nbsp;&nbsp;|&nbsp;&nbsp;
                    File: <strong style="color:#374151;">{filename}</strong>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── RISK ASSESSMENT ── -->
        <tr>
          <td style="padding:20px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:{risk_bg};border-left:4px solid {risk_color};
                          border-radius:0 8px 8px 0;padding:16px 20px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;
                             letter-spacing:0.08em;color:#6b7280;">Risk Assessment</p>
                  <p style="margin:0 0 6px;font-size:17px;font-weight:700;color:{risk_color};">
                    {risk_level} Risk
                  </p>
                  <p style="margin:0;font-size:13px;color:#4b5563;line-height:1.5;">
                    {risk_rationale}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── CLINICAL SUMMARY ── -->
        <tr>
          <td style="padding:24px 40px 0;">
            <h2 style="font-size:16px;color:#111827;margin:0 0 10px;font-weight:700;">
              Clinical Summary
            </h2>
            <p style="font-size:14px;color:#374151;line-height:1.7;margin:0;
                      padding:16px;background:#f9fafb;border-radius:8px;
                      border:1px solid #e5e7eb;">
              {summary}
            </p>
          </td>
        </tr>

        <!-- ── RECOMMENDATIONS ── -->
        <tr>
          <td style="padding:24px 40px 0;">
            <h2 style="font-size:16px;color:#111827;margin:0 0 10px;font-weight:700;">
              Recommendations
            </h2>
            <ul style="margin:0;padding:0 0 0 20px;list-style:disc;">
              {recs_html}
            </ul>
          </td>
        </tr>

        <!-- ── WAVEFORM NOTE ── -->
        <tr>
          <td style="padding:16px 40px 0;">
            {attachment_note}
          </td>
        </tr>

        <!-- ── DISCLAIMER ── -->
        <tr>
          <td style="padding:28px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#fffbeb;border:1px solid #f59e0b;border-radius:10px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 8px;font-size:13px;font-weight:700;
                             color:#92400e;text-transform:uppercase;letter-spacing:0.06em;">
                    ⚠️ Important Disclaimer
                  </p>
                  <p style="margin:0;font-size:13px;color:#78350f;line-height:1.65;">
                    This report is generated by an <strong>AI model</strong> and is
                    intended for <strong>informational purposes only</strong>.
                    <strong>Doctor confirmation is the first priority</strong> — always
                    consult a qualified neurologist or physician before making any medical
                    decisions. AI predictions may be incorrect. This report does
                    <em>not</em> constitute a medical diagnosis and should never replace
                    professional clinical evaluation.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── FOOTER ── -->
        <tr>
          <td style="padding:32px 40px 36px;">
            <p style="font-size:14px;color:#374151;margin:0 0 4px;">Warm regards,</p>
            <p style="font-size:15px;font-weight:700;color:#0077b6;margin:0 0 16px;">
              The NeuroScan AI Team
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px;">
            <p style="font-size:11px;color:#9ca3af;margin:0;line-height:1.6;">
              This is an automated email from NeuroScan AI. Please do not reply directly
              to this message. For support, contact your healthcare provider.
              <br>
              © {datetime.now(timezone.utc).year} NeuroScan AI. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


# ── Core send function ────────────────────────────────────────────────────────

def send_report_email(
    prediction: dict,
    report_data: dict,
    user: dict,
    report_pdf_bytes: Optional[bytes] = None,
) -> None:
    """
    Build and send the HTML report email.
    Called as a FastAPI background task — all exceptions are caught so
    a mail failure never affects the HTTP response.

    Attachments sent:
      - EEG waveform PNG  (tabular) or spectrogram PNG (image prediction)
      - Original uploaded waveform/image (image predictions only)
      - PDF medical report (when report_pdf_bytes provided)
    """
    if not all([_SMTP_HOST, _SMTP_USER, _SMTP_PASSWORD]):
        logger.warning("SMTP not configured — skipping report email (set SMTP_HOST, SMTP_USER, SMTP_PASSWORD)")
        return

    to_email  = user.get("email", "")
    full_name = user.get("full_name") or user.get("username", "User")

    if not to_email:
        logger.warning("No email address for user — skipping report email", extra={"user_id": user.get("id")})
        return

    try:
        _send(prediction, report_data, full_name, to_email, report_pdf_bytes)
        logger.info(
            f"Report email sent to {to_email}",
            extra={"user_id": user.get("id"), "prediction_id": prediction.get("id")},
        )
    except Exception as exc:
        logger.error(
            f"Failed to send report email to {to_email}: {exc}",
            exc_info=True,
            extra={"user_id": user.get("id")},
        )


def _send(
    prediction: dict,
    report_data: dict,
    full_name: str,
    to_email: str,
    report_pdf_bytes: Optional[bytes] = None,
) -> None:
    dr          = report_data.get("detailed_report", {})
    ai_pred     = report_data.get("ai_prediction", {})
    risk        = dr.get("risk_assessment", {})
    pred_result = ai_pred.get("result", prediction.get("prediction", "Unknown"))
    confidence  = prediction.get("confidence", 0.0)
    model_used  = prediction.get("model_used", "")
    filename    = prediction.get("filename", "unknown")
    summary     = dr.get("summary") or dr.get("clinical_interpretation", "No summary available.")
    recs        = report_data.get("recommendations") or dr.get("recommendations") or []
    risk_level  = risk.get("level", "Unknown")
    risk_rat    = risk.get("rationale", "")
    gen_at      = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")

    # ── Collect image attachments ─────────────────────────────────────────────
    # List of (bytes, filename) tuples — all non-None entries are attached.
    image_attachments: list[tuple[bytes, str]] = []

    eeg_data = prediction.get("eeg_data")
    if eeg_data and len(eeg_data) >= 2:
        # Tabular / CSV prediction — generate EEG waveform chart from raw signal
        waveform_bytes = _make_waveform_png(eeg_data, pred_result == "Seizure")
        if waveform_bytes:
            image_attachments.append((waveform_bytes, "eeg_waveform.png"))
    else:
        # Image prediction — attach spectrogram AND original uploaded waveform
        spec_bytes = _fetch_r2_image(prediction.get("r2_spectrogram_key", ""))
        if spec_bytes:
            image_attachments.append((_resize_image(spec_bytes), "spectrogram.png"))

        orig_bytes = _fetch_r2_image(prediction.get("r2_input_key", ""))
        if orig_bytes:
            image_attachments.append((_resize_image(orig_bytes), "original_waveform.png"))

    # ── Build full attachment name list for the HTML note ─────────────────────
    attachment_names = [name for _, name in image_attachments]
    if report_pdf_bytes:
        attachment_names.append("neuroscan_report.pdf")

    # ── Build MIME message (mixed = body + detached file attachments) ─────────
    msg = MIMEMultipart("mixed")
    msg["Subject"] = f"NeuroScan AI Report — {pred_result} | {gen_at}"
    msg["From"]    = f"{_FROM_NAME} <{_SMTP_USER}>"
    msg["To"]      = to_email

    html_body = _build_html(
        full_name       = full_name,
        prediction      = pred_result,
        confidence      = confidence,
        model_used      = model_used,
        filename        = filename,
        generated_at    = gen_at,
        risk_level      = risk_level,
        risk_rationale  = risk_rat,
        summary         = summary,
        recommendations = recs,
        attachment_names = attachment_names,
    )
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    # Attach all images
    for img_bytes, img_name in image_attachments:
        img_part = MIMEImage(img_bytes, name=img_name)
        img_part.add_header("Content-Disposition", "attachment", filename=img_name)
        msg.attach(img_part)

    # Attach PDF report
    if report_pdf_bytes:
        pdf_part = MIMEApplication(report_pdf_bytes, Name="neuroscan_report.pdf")
        pdf_part.add_header("Content-Disposition", "attachment", filename="neuroscan_report.pdf")
        msg.attach(pdf_part)

    # ── Send via SMTP ─────────────────────────────────────────────────────────
    if _SMTP_PORT == 465:
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(_SMTP_HOST, _SMTP_PORT, context=ctx) as smtp:
            smtp.login(_SMTP_USER, _SMTP_PASSWORD)
            smtp.sendmail(_SMTP_USER, to_email, msg.as_bytes())
    else:
        with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT, timeout=30) as smtp:
            smtp.ehlo()
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
            smtp.login(_SMTP_USER, _SMTP_PASSWORD)
            smtp.sendmail(_SMTP_USER, to_email, msg.as_bytes())
