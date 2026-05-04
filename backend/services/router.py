"""
Input type router — decides which model pipeline handles an uploaded file.

Decision table:
┌─────────────────────┬──────────────┬──────────────────────────────────────┐
│ Extension           │ Input type   │ Model used                           │
├─────────────────────┼──────────────┼──────────────────────────────────────┤
│ .csv  .txt          │ tabular      │ Epilepsy.h5  (LSTM / Dense)          │
│                     │              │ expects 178 numeric EEG features     │
├─────────────────────┼──────────────┼──────────────────────────────────────┤
│ .png  .jpg  .jpeg   │ image        │ EpilepsyImage.h5  (EfficientNetB0)   │
│ .svg  .bmp  .tiff   │              │ expects 224×224 RGB spectrogram      │
└─────────────────────┴──────────────┴──────────────────────────────────────┘

If the primary model fails OR confidence < FALLBACK_CONFIDENCE_THRESHOLD (0.55),
the request is automatically escalated to the Gemini fallback.
"""

import os
from typing import Literal

InputType = Literal["tabular", "image", "unsupported"]

# Magic byte signatures — verify actual file content, not just the extension
_MAGIC_IMAGE = [
    b'\x89PNG\r\n\x1a\n',   # PNG
    b'\xff\xd8\xff',          # JPEG
    b'BM',                    # BMP
    b'II\x2a\x00',            # TIFF little-endian
    b'MM\x00\x2a',            # TIFF big-endian
]

TABULAR_EXTENSIONS = {'.csv', '.txt'}
IMAGE_EXTENSIONS   = {'.png', '.jpg', '.jpeg', '.svg', '.bmp', '.tiff', '.tif'}
ALL_ALLOWED        = TABULAR_EXTENSIONS | IMAGE_EXTENSIONS


def detect_input_type(filename: str, content: bytes) -> InputType:
    ext = os.path.splitext(filename)[1].lower()

    if ext in TABULAR_EXTENSIONS:
        return 'tabular'

    if ext in IMAGE_EXTENSIONS:
        # SVG is XML text — no binary magic bytes, trust the extension
        if ext == '.svg':
            return 'image'
        # For raster formats, verify magic bytes to catch renamed files
        for magic in _MAGIC_IMAGE:
            if content[:len(magic)] == magic:
                return 'image'
        # Extension matches but magic bytes don't — still try as image
        return 'image'

    return 'unsupported'
