#!/usr/bin/env python3
"""
Diamond needle engraving image processor — High Accuracy Edition.
Converts an image to BMP 8-bit grayscale optimized for black granite engraving.

Improvements over v1:
  - Multi-stage CLAHE for better local contrast without washing out
  - Adaptive unsharp mask that preserves fine details
  - Edge-aware sharpening using Laplacian
  - Gamma correction optimized for granite engraving (dark areas preserved)
  - Noise reduction before sharpening to avoid amplifying artifacts
  - Better black-point handling: gradual falloff instead of hard cutoff

Usage:
  python3 process_engraving.py <input_path> <output_bmp_path> [width_cm] [height_cm] [dpi]

Output:
  - BMP 8-bit grayscale file ready for engraving machine
  - Prints JSON result to stdout: {"width": N, "height": N, "bitDepth": N, "fileSizeKB": N}
"""

import sys
import os
import json
import numpy as np

try:
    import cv2
    from PIL import Image
except ImportError as e:
    print(json.dumps({"error": f"Missing dependency: {e}"}))
    sys.exit(1)


def process_for_granite_engraving(
    input_path,
    output_bmp_path,
    width_cm=None,
    height_cm=None,
    dpi=180
):
    # ── 1. Load image ──────────────────────────────────────────────────────────
    img = cv2.imread(input_path, cv2.IMREAD_COLOR)
    if img is None:
        # Try with PIL as fallback (handles more formats)
        try:
            pil_fallback = Image.open(input_path).convert("RGB")
            img = cv2.cvtColor(np.array(pil_fallback), cv2.COLOR_RGB2BGR)
        except Exception:
            raise ValueError(f"Cannot read image: {input_path}")

    # ── 2. Convert to grayscale ────────────────────────────────────────────────
    # Use luminosity weights (better perceptual grayscale than simple average)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # ── 3. Gentle noise reduction (preserve edges) ────────────────────────────
    # Bilateral filter: smooths flat areas, keeps edges sharp
    gray = cv2.bilateralFilter(gray, d=5, sigmaColor=20, sigmaSpace=20)

    # ── 4. Multi-stage CLAHE for local contrast enhancement ───────────────────
    # Stage 1: coarse grid — global tonal balance
    clahe_coarse = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
    gray = clahe_coarse.apply(gray)

    # Stage 2: fine grid — local micro-contrast (detail recovery)
    clahe_fine = cv2.createCLAHE(clipLimit=1.0, tileGridSize=(32, 32))
    gray = clahe_fine.apply(gray)

    # ── 5. Gamma correction — optimize tonal range for granite ────────────────
    # Granite engraving: mid-tones need to be slightly brighter to engrave well
    # Gamma < 1.0 brightens midtones; 0.85 is a good starting point
    gamma = 0.88
    lut = np.array([
        min(255, int(((i / 255.0) ** gamma) * 255))
        for i in range(256)
    ], dtype=np.uint8)
    gray = cv2.LUT(gray, lut)

    # ── 6. Edge-aware sharpening ───────────────────────────────────────────────
    # Unsharp mask: enhances fine details without halos
    blur_sigma = 1.0
    blurred = cv2.GaussianBlur(gray, (0, 0), blur_sigma)
    # Strength 1.5 = moderate sharpening (1.0 = no change, 2.0 = strong)
    sharpened = cv2.addWeighted(gray, 1.5, blurred, -0.5, 0)

    # Laplacian edge boost: add fine edge detail back
    laplacian = cv2.Laplacian(gray, cv2.CV_64F, ksize=3)
    laplacian_norm = np.clip(laplacian * 0.15, -30, 30).astype(np.int16)
    sharpened = np.clip(sharpened.astype(np.int16) + laplacian_norm, 0, 255).astype(np.uint8)

    gray = sharpened

    # ── 7. Black-point: gradual falloff for deep blacks ───────────────────────
    # Pixels below 12 → pure black (removes noise in dark areas)
    # Pixels 12–30 → smooth ramp to avoid hard edge
    black_threshold = 12
    ramp_end = 30
    mask_hard = gray < black_threshold
    mask_ramp = (gray >= black_threshold) & (gray < ramp_end)
    ramp_factor = ((gray[mask_ramp].astype(np.float32) - black_threshold) / (ramp_end - black_threshold))
    gray[mask_hard] = 0
    gray[mask_ramp] = (gray[mask_ramp] * ramp_factor).astype(np.uint8)

    # ── 8. Stretch contrast to use full 0–255 range ───────────────────────────
    p_low, p_high = np.percentile(gray[gray > 0], [1, 99]) if np.any(gray > 0) else (0, 255)
    if p_high > p_low:
        gray = np.clip((gray.astype(np.float32) - p_low) / (p_high - p_low) * 255, 0, 255).astype(np.uint8)

    # ── 9. Build PIL image ─────────────────────────────────────────────────────
    pil_img = Image.fromarray(gray, mode='L')

    # ── 10. Resize by cm + DPI if provided ────────────────────────────────────
    if width_cm and height_cm:
        w_px = round((float(width_cm) / 2.54) * float(dpi))
        h_px = round((float(height_cm) / 2.54) * float(dpi))
        # Use LANCZOS for downscale, BICUBIC for upscale
        orig_w, orig_h = pil_img.size
        resample = Image.LANCZOS if (w_px * h_px) < (orig_w * orig_h) else Image.BICUBIC
        pil_img = pil_img.resize((w_px, h_px), resample)
    elif width_cm:
        # Maintain aspect ratio if only width given
        w_px = round((float(width_cm) / 2.54) * float(dpi))
        orig_w, orig_h = pil_img.size
        h_px = round(orig_h * w_px / orig_w)
        pil_img = pil_img.resize((w_px, h_px), Image.LANCZOS)
    elif height_cm:
        # Maintain aspect ratio if only height given
        h_px = round((float(height_cm) / 2.54) * float(dpi))
        orig_w, orig_h = pil_img.size
        w_px = round(orig_w * h_px / orig_h)
        pil_img = pil_img.resize((w_px, h_px), Image.LANCZOS)

    # ── 11. Save as BMP 8-bit grayscale ───────────────────────────────────────
    # IMPORTANT: Machine requires 8-bit (256-color palette), NOT 24-bit!
    img_p = pil_img.convert('P')
    # Build a proper grayscale palette
    palette = []
    for i in range(256):
        palette.extend([i, i, i])
    img_p.putpalette(palette)
    img_p.save(output_bmp_path, format='BMP', dpi=(dpi, dpi))

    # ── 12. Verify output ──────────────────────────────────────────────────────
    with open(output_bmp_path, 'rb') as f:
        header = f.read(54)
    bit_depth = int.from_bytes(header[28:30], 'little')
    file_size_kb = os.path.getsize(output_bmp_path) / 1024

    return {
        "width": pil_img.size[0],
        "height": pil_img.size[1],
        "bitDepth": bit_depth,
        "fileSizeKB": round(file_size_kb, 1)
    }


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: process_engraving.py <input> <output_bmp> [width_cm] [height_cm] [dpi]"}))
        sys.exit(1)

    input_path = sys.argv[1]
    output_bmp_path = sys.argv[2]
    width_cm = float(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3] != "null" else None
    height_cm = float(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4] != "null" else None
    dpi = int(sys.argv[5]) if len(sys.argv) > 5 else 180

    try:
        result = process_for_granite_engraving(
            input_path, output_bmp_path, width_cm, height_cm, dpi
        )
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
