#!/usr/bin/env python3
"""
Outline extraction for pencil drawings and shaded images.

Usage:
  python3 outline_extract.py <input_png> <output_png>

The script:
1. Reads any image (pencil drawing, shaded sketch, photo)
2. Applies multiple bilateral filter passes to smooth shading while preserving edges
3. Runs Canny edge detection to extract only the outline contours
4. Writes a clean black-on-white PNG with single-line outlines (coloring-page style)

This is used by aiTraceRoute when outlineMode=true to produce a clean outline
image that potrace then traces into single-line vector paths — without any AI.
"""

import sys
import numpy as np
import cv2
from PIL import Image

def main():
    if len(sys.argv) < 3:
        print("Usage: outline_extract.py <input_png> <output_png> [low_thresh] [high_thresh] [bilateral_passes]", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    # Optional tuning parameters (defaults work well for pencil drawings)
    low_thresh = int(sys.argv[3]) if len(sys.argv) > 3 else 15
    high_thresh = int(sys.argv[4]) if len(sys.argv) > 4 else 50
    bilateral_passes = int(sys.argv[5]) if len(sys.argv) > 5 else 3

    # Load and convert to grayscale
    img = cv2.imread(input_path)
    if img is None:
        # Try PIL fallback
        pil_img = Image.open(input_path).convert("RGB")
        img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Resize to 2000px on longer side for consistent quality
    h, w = gray.shape
    max_dim = max(h, w)
    if max_dim > 2000:
        scale = 2000 / max_dim
        gray = cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_LANCZOS4)

    # Multiple bilateral filter passes:
    # - Smooths shading/texture/gradients (removes pencil fill areas)
    # - Preserves hard edges (the actual drawn lines/outlines)
    smooth = gray.copy()
    for _ in range(bilateral_passes):
        smooth = cv2.bilateralFilter(smooth, 9, 50, 50)

    # Canny edge detection on the smoothed image
    # Low threshold: 15 catches faint pencil lines
    # High threshold: 50 keeps only strong edges
    edges = cv2.Canny(smooth, low_thresh, high_thresh)

    # Dilate edges slightly to make lines 2px wide (potrace traces better on slightly thicker lines)
    kernel = np.ones((2, 2), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=1)

    # Invert: Canny gives white-on-black, we need black-on-white for potrace
    result = cv2.bitwise_not(edges)

    # Save as PNG
    cv2.imwrite(output_path, result)
    print(f"Outline extracted: {input_path} → {output_path}", file=sys.stderr)

if __name__ == "__main__":
    main()
