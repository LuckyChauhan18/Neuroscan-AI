"""
Preprocess an uploaded image for EfficientNetB0 inference.

Supported formats:  PNG, JPG, JPEG, BMP, TIFF  →  PIL decode
                    SVG                          →  cairosvg rasterise → PIL

Training normalization: divide by 255 (ImageDataGenerator rescale=1/255).
Do NOT use EfficientNetB0's own preprocess_input — it would shift the distribution.

eeg_image_to_spectrogram() converts any uploaded EEG waveform image into a
proper STFT spectrogram image before feeding to the model.  The model was
trained on spectrogram images, so this step is required for time-domain plots.
"""

import io
import numpy as np
from PIL import Image

IMG_SIZE = 224


def _svg_to_pil(content: bytes) -> Image.Image:
    """Rasterise an SVG to a PIL Image at IMG_SIZE × IMG_SIZE."""
    try:
        import cairosvg
        png_bytes = cairosvg.svg2png(
            bytestring=content,
            output_width=IMG_SIZE,
            output_height=IMG_SIZE,
        )
        return Image.open(io.BytesIO(png_bytes))
    except ImportError:
        raise RuntimeError(
            "cairosvg is required to process SVG files. "
            "Install it: pip install cairosvg"
        )


def _open_image(content: bytes, filename: str = "") -> Image.Image:
    """Open any supported image format and return a PIL Image."""
    if filename.lower().endswith(".svg") or content[:5] in (b"<?xml", b"<svg "):
        return _svg_to_pil(content)
    return Image.open(io.BytesIO(content))


def _to_rgb(img: Image.Image) -> Image.Image:
    if img.mode == "RGBA":
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3])
        return bg
    if img.mode != "RGB":
        return img.convert("RGB")
    return img


def image_bytes_to_array(content: bytes, filename: str = "") -> np.ndarray:
    """
    Convert raw image bytes → (1, 224, 224, 3) float32 array in [0, 1].
    Accepts PNG, JPG, JPEG, BMP, TIFF, SVG.
    """
    img = _to_rgb(_open_image(content, filename))
    img = img.resize((IMG_SIZE, IMG_SIZE), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / 255.0
    return arr.reshape(1, IMG_SIZE, IMG_SIZE, 3)


def image_stats(content: bytes, filename: str = "") -> dict:
    """Return basic pixel statistics (stored in signal_stats field)."""
    img = _to_rgb(_open_image(content, filename))
    arr = np.array(img, dtype=np.float32)
    return {
        "mean_pixel": round(float(arr.mean()), 4),
        "std_pixel": round(float(arr.std()), 4),
        "min_pixel": round(float(arr.min()), 4),
        "max_pixel": round(float(arr.max()), 4),
        "width": img.width,
        "height": img.height,
        "num_points": img.width * img.height,
    }


def eeg_image_to_spectrogram(content: bytes, filename: str = "") -> tuple:
    """
    Convert an uploaded EEG waveform image into a spectrogram image that
    matches what EfficientNetB0 was trained on.

    Handles any image style automatically:
      - Black line on white background  (dark signal, light bg)
      - Green / colored line on black   (bright signal, dark bg)
      - Any other color scheme          (uses highest-variance channel)

    Steps:
      1. Pick the most informative color channel (highest variance)
      2. Auto-detect dark vs light background; normalise so signal = bright
      3. Crop central 84 % to strip axis labels / borders
      4. Per-column weighted centroid → 1-D signal proxy
      5. scipy STFT → frequency-time spectrogram
      6. Viridis colormap → 224×224 RGB PNG

    Returns
    -------
    (model_array, spectrogram_png_bytes)
    """
    from scipy import signal as scipy_signal

    from scipy import signal as scipy_signal

    # ── 1. open RGB; pick the channel with the highest variance ───────────────
    rgb_img = _to_rgb(_open_image(content, filename))
    rgb_arr = np.array(rgb_img, dtype=np.float32)           # (H, W, 3)

    best_c = int(np.argmax([rgb_arr[:, :, c].var() for c in range(3)]))
    arr    = rgb_arr[:, :, best_c]                           # (H, W) float32
    H, W   = arr.shape

    # ── 2. auto-detect background; make signal pixels BRIGHT ─────────────────
    dark_bg = float(np.median(arr)) < 128.0
    if not dark_bg:
        arr = 255.0 - arr          # invert: dark waveform → bright

    # ── 3. crop central 84 % — removes axis labels / borders ─────────────────
    r0, r1 = int(H * 0.08), int(H * 0.92)
    c0, c1 = int(W * 0.08), int(W * 0.92)
    plot   = arr[r0:r1, c0:c1]                               # (pH, pW) bright=signal

    # ── 4. isolate signal pixels then compute column energy ───────────────────
    # Threshold at the 70th percentile so only the brightest (signal) pixels
    # contribute.  This removes background noise from column sums and works for
    # both single-channel (thin line) and multi-channel (stacked waveforms).
    thr    = np.percentile(plot, 70)
    masked = np.maximum(plot - thr, 0.0)                     # background → 0
    signal_raw = masked.sum(axis=0).astype(np.float32)       # (pW,)

    # ── 5. detrend + z-normalise ──────────────────────────────────────────────
    signal_1d = scipy_signal.detrend(signal_raw)             # remove DC / trend
    std = float(signal_1d.std())
    if std > 1e-6:
        signal_1d = signal_1d / std
    else:
        # Flat signal — return a blank spectrogram rather than all-blue
        signal_1d = np.random.randn(len(signal_raw)).astype(np.float32) * 0.01

    # ── 6. STFT — adaptive window, NO upsampling ─────────────────────────────
    N        = len(signal_1d)
    nperseg  = int(np.clip(N // 8, 32, 256))
    noverlap = nperseg * 3 // 4
    fs       = 256
    _, _, Sxx = scipy_signal.spectrogram(
        signal_1d, fs=fs, nperseg=nperseg, noverlap=noverlap,
        window='hann', scaling='density'
    )

    # ── 7. log-power + robust percentile normalisation ────────────────────────
    Sxx_db   = 10.0 * np.log10(Sxx + 1e-12)                 # dB scale
    lo       = np.percentile(Sxx_db, 10)
    hi       = np.percentile(Sxx_db, 98)
    if hi > lo:
        Sxx_norm = np.clip((Sxx_db - lo) / (hi - lo), 0.0, 1.0)
    else:
        Sxx_norm = np.zeros_like(Sxx_db)

    # ── 8. viridis colormap → 224×224 RGB PNG ────────────────────────────────
    v    = np.flipud(Sxx_norm)                               # low freq at bottom
    r_ch = np.clip(1.76 * v - 0.76,                      0, 1)
    g_ch = np.clip(np.where(v < 0.5, 2.0*v, 2.0-2.0*v),  0, 1)
    b_ch = np.clip(1.0 - 1.5 * v,                        0, 1)

    rgb_out  = (np.stack([r_ch, g_ch, b_ch], axis=-1) * 255).astype(np.uint8)
    spec_img = Image.fromarray(rgb_out, mode="RGB").resize(
        (IMG_SIZE, IMG_SIZE), Image.LANCZOS
    )

    buf = io.BytesIO()
    spec_img.save(buf, format="PNG")
    spec_png = buf.getvalue()

    model_array = (np.array(spec_img, dtype=np.float32) / 255.0).reshape(
        1, IMG_SIZE, IMG_SIZE, 3
    )
    return model_array, spec_png
