#!/usr/bin/env python3
"""
Diamond needle engraving image processor.
Converts an image to BMP 8-bit grayscale optimized for black granite engraving.

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
    # Load and convert to grayscale
    img = cv2.imread(input_path)
    if img is None:
        raise ValueError(f"Cannot read image: {input_path}")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # CLAHE - local exposure balancing (gentle)
    clahe = cv2.createCLAHE(clipLimit=1.2, tileGridSize=(16, 16))
    gray = clahe.apply(gray)

    # Unsharp mask - detail preservation (gentle)
    blurred = cv2.GaussianBlur(gray, (0, 0), 0.8)
    gray = cv2.addWeighted(gray, 1.25, blurred, -0.25, 0)

    # Force absolute black background
    gray = np.where(gray < 15, 0, gray).astype(np.uint8)

    pil_img = Image.fromarray(gray)

    # Resize by cm + DPI if provided
    if width_cm and height_cm:
        w_px = round((float(width_cm) / 2.54) * float(dpi))
        h_px = round((float(height_cm) / 2.54) * float(dpi))
        pil_img = pil_img.resize((w_px, h_px), Image.LANCZOS)

    # Save as BMP 8-bit (NOT 24-bit — machine won't read 24-bit!)
    img_p = pil_img.convert('P')
    palette = []
    for i in range(256):
        palette.extend([i, i, i])
    img_p.putpalette(palette)
    img_p.save(output_bmp_path, format='BMP', dpi=(dpi, dpi))

    # Verify bit depth
    with open(output_bmp_path, 'rb') as f:
        data = f.read(54)
    bit_depth = int.from_bytes(data[28:30], 'little')
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
