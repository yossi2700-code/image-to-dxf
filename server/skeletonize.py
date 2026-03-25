#!/usr/bin/env python3
"""
Centerline / skeleton extraction for line-art images.

Usage:
  python3 skeletonize.py <input_png> <output_png>

The script:
1. Reads a black-on-white (or white-on-black) line-art PNG
2. Binarises it (Otsu threshold)
3. Runs Zhang-Suen skeletonization (scikit-image)
4. Writes a clean black-on-white PNG where every stroke is 1 pixel wide

This is used by aiTraceRoute when singleLine=true to produce a centerline
image that potrace then traces into clean single-path vectors.
"""

import sys
import numpy as np
from PIL import Image
from skimage.morphology import skeletonize as sk_skeletonize
from skimage.filters import threshold_otsu

def main():
    if len(sys.argv) != 3:
        print("Usage: skeletonize.py <input_png> <output_png>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    # Load image as grayscale
    img = Image.open(input_path).convert("L")
    arr = np.array(img)

    # Binarise: True = foreground (ink/line), False = background
    thresh = threshold_otsu(arr)
    # Determine if image is dark-on-light or light-on-dark
    # If median is > 128, background is white → lines are dark
    if np.median(arr) > 128:
        binary = arr < thresh  # dark pixels = foreground
    else:
        binary = arr > thresh  # light pixels = foreground

    # Run skeletonization (Zhang-Suen thinning)
    skeleton = sk_skeletonize(binary)

    # Convert back to uint8: skeleton pixels → black (0), background → white (255)
    out_arr = np.where(skeleton, 0, 255).astype(np.uint8)

    # Save as PNG
    out_img = Image.fromarray(out_arr)
    out_img.save(output_path)

    print(f"Skeletonized: {input_path} → {output_path}", file=sys.stderr)

if __name__ == "__main__":
    main()
