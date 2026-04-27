#!/usr/bin/env python3
"""
portrait_to_dxf.py — Convert a portrait line-art PNG to DXF using centerline extraction.

Usage:
  python3 portrait_to_dxf.py <input.png> <output.dxf> [min_gap_mm]

Algorithm:
  1. Load PNG as grayscale
  2. Threshold to binary (black lines on white)
  3. Skeletonize — reduces thick lines to 1-pixel centerlines
  4. Trace connected components into polylines
  5. Simplify polylines with Douglas-Peucker
  6. Output as DXF R2000 LWPOLYLINE (200mm wide)

This avoids potrace's outline-fill approach which creates double lines.
"""

import sys
import numpy as np
import cv2
from skimage.morphology import skeletonize
from skimage.measure import label, regionprops
import json

def trace_skeleton_to_polylines(skeleton: np.ndarray, min_length: int = 3) -> list:
    """
    Trace a binary skeleton image into a list of polylines.
    Each polyline is a list of (x, y) tuples.
    Uses a DFS approach to follow connected pixels.
    """
    # Find all skeleton pixels
    ys, xs = np.where(skeleton > 0)
    if len(xs) == 0:
        return []
    
    # Build adjacency: for each pixel, find its 8-connected skeleton neighbors
    pixel_set = set(zip(xs.tolist(), ys.tolist()))
    
    # Mark visited
    visited = set()
    polylines = []
    
    def get_neighbors(x, y):
        neighbors = []
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                if dx == 0 and dy == 0:
                    continue
                nx, ny = x + dx, y + dy
                if (nx, ny) in pixel_set and (nx, ny) not in visited:
                    neighbors.append((nx, ny))
        return neighbors
    
    def find_endpoints():
        """Find pixels with exactly 1 neighbor (endpoints) or 0 neighbors (isolated)."""
        endpoints = []
        for (x, y) in pixel_set:
            if (x, y) in visited:
                continue
            n = sum(1 for dx in [-1,0,1] for dy in [-1,0,1] 
                   if not (dx==0 and dy==0) and (x+dx, y+dy) in pixel_set)
            if n <= 1:
                endpoints.append((x, y))
        return endpoints
    
    def trace_from(start_x, start_y):
        """Trace a polyline starting from a given pixel."""
        line = [(start_x, start_y)]
        visited.add((start_x, start_y))
        
        prev = None
        cx, cy = start_x, start_y
        
        while True:
            neighbors = get_neighbors(cx, cy)
            if not neighbors:
                break
            
            # Prefer to continue in same direction (avoid zigzag)
            if prev is not None and len(neighbors) > 1:
                dx = cx - prev[0]
                dy = cy - prev[1]
                # Score by direction continuity
                def score(n):
                    ndx = n[0] - cx
                    ndy = n[1] - cy
                    return ndx * dx + ndy * dy
                neighbors.sort(key=score, reverse=True)
            
            # If junction (>1 neighbor), stop this polyline
            if len(neighbors) > 1:
                # Pick the best one and stop
                nx, ny = neighbors[0]
                line.append((nx, ny))
                visited.add((nx, ny))
                break
            
            nx, ny = neighbors[0]
            prev = (cx, cy)
            cx, cy = nx, ny
            line.append((cx, cy))
            visited.add((cx, cy))
        
        return line
    
    # First pass: trace from endpoints
    endpoints = find_endpoints()
    for ep in endpoints:
        if ep not in visited:
            line = trace_from(ep[0], ep[1])
            if len(line) >= min_length:
                polylines.append(line)
    
    # Second pass: trace remaining (loops)
    for (x, y) in list(pixel_set):
        if (x, y) not in visited:
            line = trace_from(x, y)
            if len(line) >= min_length:
                polylines.append(line)
    
    return polylines


def douglas_peucker(points, epsilon):
    """Simplify a polyline using Douglas-Peucker algorithm."""
    if len(points) <= 2:
        return points
    
    # Find the point with max distance from line between first and last
    start = np.array(points[0])
    end = np.array(points[-1])
    
    if np.allclose(start, end):
        # Closed loop — find max distance from start
        dists = [np.linalg.norm(np.array(p) - start) for p in points[1:-1]]
        if not dists:
            return [points[0], points[-1]]
        max_idx = np.argmax(dists) + 1
        max_dist = dists[max_idx - 1]
    else:
        # Line direction
        line_vec = end - start
        line_len = np.linalg.norm(line_vec)
        line_unit = line_vec / line_len
        
        dists = []
        for p in points[1:-1]:
            pt = np.array(p)
            proj = np.dot(pt - start, line_unit)
            proj_pt = start + proj * line_unit
            dist = np.linalg.norm(pt - proj_pt)
            dists.append(dist)
        
        if not dists:
            return [points[0], points[-1]]
        
        max_idx = np.argmax(dists) + 1
        max_dist = dists[max_idx - 1]
    
    if max_dist > epsilon:
        left = douglas_peucker(points[:max_idx + 1], epsilon)
        right = douglas_peucker(points[max_idx:], epsilon)
        return left[:-1] + right
    else:
        return [points[0], points[-1]]


def polylines_to_dxf(polylines, img_width, img_height, output_width_mm=200.0):
    """Convert pixel polylines to DXF R2000 format scaled to output_width_mm."""
    scale = output_width_mm / img_width
    output_height_mm = img_height * scale
    
    lines = []
    lines.append("0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n9\n$INSUNITS\n70\n4\n0\nENDSEC")
    lines.append("0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n1\n0\nLAYER\n2\n0\n70\n0\n6\nContinuous\n62\n7\n0\nENDTAB\n0\nENDSEC")
    lines.append("0\nSECTION\n2\nENTITIES")
    
    seg_count = 0
    for poly in polylines:
        if len(poly) < 2:
            continue
        
        lines.append("0\nLWPOLYLINE")
        lines.append("8\n0")          # layer
        lines.append("62\n256")       # color by layer
        lines.append("370\n0")        # lineweight: 0 = hairline
        lines.append(f"90\n{len(poly)}")  # vertex count
        lines.append("70\n0")         # open polyline
        
        for (px, py) in poly:
            x_mm = px * scale
            y_mm = output_height_mm - (py * scale)  # flip Y
            lines.append(f"10\n{x_mm:.4f}\n20\n{y_mm:.4f}")
        
        seg_count += 1
    
    lines.append("0\nENDSEC\n0\nEOF")
    
    return "\n".join(lines), seg_count


def png_to_dxf(input_path: str, output_path: str, min_gap_mm: float = 0.0, output_width_mm: float = 200.0):
    """Main conversion function."""
    # Load image
    img = cv2.imread(input_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError(f"Cannot read image: {input_path}")
    
    h, w = img.shape
    
    # Normalize: ensure black lines on white background
    # If image is mostly dark, invert it
    if np.mean(img) < 128:
        img = 255 - img
    
    # Threshold: lines are dark (< 128), background is white (>= 128)
    _, binary = cv2.threshold(img, 200, 255, cv2.THRESH_BINARY_INV)
    
    # Optional: apply gap expansion (dilate lines to ensure min spacing)
    if min_gap_mm > 0:
        pixels_per_mm = w / output_width_mm
        gap_px = int(min_gap_mm * pixels_per_mm / 2)
        if gap_px > 0:
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (gap_px*2+1, gap_px*2+1))
            binary = cv2.dilate(binary, kernel, iterations=1)
    
    # Skeletonize: reduce thick lines to 1-pixel centerlines
    binary_bool = binary > 0
    skeleton = skeletonize(binary_bool)
    skeleton_uint8 = (skeleton * 255).astype(np.uint8)
    
    # Trace skeleton to polylines
    polylines = trace_skeleton_to_polylines(skeleton_uint8, min_length=4)
    
    # Simplify polylines (Douglas-Peucker, epsilon = 0.5 pixels)
    simplified = []
    for poly in polylines:
        s = douglas_peucker(poly, epsilon=0.8)
        if len(s) >= 2:
            simplified.append(s)
    
    # Convert to DXF
    dxf_content, seg_count = polylines_to_dxf(simplified, w, h, output_width_mm)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(dxf_content)
    
    # Output stats as JSON to stdout
    result = {
        "segmentCount": seg_count,
        "width": w,
        "height": h,
        "realWidth": output_width_mm,
        "realHeight": h * output_width_mm / w
    }
    print(json.dumps(result))


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: portrait_to_dxf.py <input.png> <output.dxf> [min_gap_mm]", file=sys.stderr)
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    min_gap = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
    
    png_to_dxf(input_path, output_path, min_gap)
