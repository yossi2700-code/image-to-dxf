/**
 * SvgPanZoomViewer — Shared pan/zoom SVG viewer component.
 *
 * Features:
 * - Mouse: scroll to zoom (zoom-to-cursor), drag to pan
 * - Touch: pinch-to-zoom (zoom-to-midpoint), single-finger drag to pan
 * - Pointer Events API for unified mouse/touch handling
 * - Fill / Outline toggle
 * - Zoom in/out/reset toolbar buttons
 * - Fullscreen mode
 * - No style injection into SVG (uses scoped CSS classes in index.css)
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize2, X } from "lucide-react";

interface Props {
  svgContent: string;
  /** Fixed height in px, or "auto" to compute from SVG aspect ratio */
  height?: number | string;
  /** Show fill/outline toggle (default: true) */
  showFillToggle?: boolean;
  /** Show fullscreen button (default: true) */
  showFullscreen?: boolean;
  /** Initial fill mode */
  initialFillMode?: 'fill' | 'outline';
  /** Called when fill mode changes */
  onFillModeChange?: (mode: 'fill' | 'outline') => void;
  /** Additional className for the outer wrapper */
  className?: string;
  isRtl?: boolean;
}

const MIN_SCALE = 0.15;
const MAX_SCALE = 12;

function clampScale(s: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

export function SvgPanZoomViewer({
  svgContent,
  height,
  showFillToggle = true,
  showFullscreen = true,
  initialFillMode = 'fill',
  onFillModeChange,
  className = "",
  isRtl = false,
}: Props) {
  const [fillMode, setFillMode] = useState<'fill' | 'outline'>(initialFillMode);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Pointer tracking for pan
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDist = useRef<number | null>(null);
  const lastPinchMid = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const dragStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Compute SVG aspect ratio from viewBox
  const svgAspect = (() => {
    const m = svgContent.match(/viewBox=["']([^"']+)["']/);
    if (m) {
      const parts = m[1].trim().split(/[\s,]+/);
      if (parts.length === 4) {
        const w = parseFloat(parts[2]);
        const h = parseFloat(parts[3]);
        if (w > 0 && h > 0) return h / w;
      }
    }
    return 1;
  })();

  // Compute container height from aspect ratio if not provided
  const computedHeight = (() => {
    if (height !== undefined) return height;
    return "auto"; // will be set via ref
  })();

  const setContainerHeight = useCallback((el: HTMLDivElement | null) => {
    if (!el || height !== undefined) return;
    const w = el.getBoundingClientRect().width;
    el.style.height = Math.min(Math.max(w * svgAspect, 180), 520) + 'px';
  }, [svgAspect, height]);

  const svgViewerClass = fillMode === 'fill' ? 'svg-viewer-fill' : 'svg-viewer-outline';

  // ── Zoom helpers ────────────────────────────────────────────────────────────

  /** Zoom toward a point (cx, cy) in container coordinates */
  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setScale((prevScale) => {
      const newScale = clampScale(prevScale * factor);
      const actualFactor = newScale / prevScale;
      setOffset((prev) => ({
        x: cx + (prev.x - cx) * actualFactor,
        y: cy + (prev.y - cy) * actualFactor,
      }));
      return newScale;
    });
  }, []);

  const zoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 0;
    const cy = rect ? rect.height / 2 : 0;
    zoomAt(1.4, cx, cy);
  };

  const zoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 0;
    const cy = rect ? rect.height / 2 : 0;
    zoomAt(1 / 1.4, cx, cy);
  };

  const resetView = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  // ── Wheel zoom ──────────────────────────────────────────────────────────────

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomAt(factor, cx, cy);
  }, [zoomAt]);

  // ── Pointer events (unified mouse + touch) ──────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return; // only primary button
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 1) {
      // Single pointer — start drag
      isDragging.current = true;
      dragStart.current = { px: e.clientX, py: e.clientY, ox: 0, oy: 0 };
      // Capture current offset at drag start
      setOffset((prev) => {
        dragStart.current = { px: e.clientX, py: e.clientY, ox: prev.x, oy: prev.y };
        return prev;
      });
      lastPinchDist.current = null;
      lastPinchMid.current = null;
    } else if (activePointers.current.size === 2) {
      // Two pointers — start pinch
      isDragging.current = false;
      dragStart.current = null;
      const pts = Array.from(activePointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      lastPinchDist.current = Math.hypot(dx, dy);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        lastPinchMid.current = {
          x: (pts[0].x + pts[1].x) / 2 - rect.left,
          y: (pts[0].y + pts[1].y) / 2 - rect.top,
        };
      }
    }
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 1 && isDragging.current && dragStart.current) {
      // Pan
      const ds = dragStart.current;
      setOffset({
        x: ds.ox + e.clientX - ds.px,
        y: ds.oy + e.clientY - ds.py,
      });
    } else if (activePointers.current.size === 2 && lastPinchDist.current !== null) {
      // Pinch zoom
      const pts = Array.from(activePointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      const factor = dist / lastPinchDist.current;
      lastPinchDist.current = dist;

      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
        const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
        zoomAt(factor, midX, midY);

        // Also pan by midpoint movement
        if (lastPinchMid.current) {
          const dmx = midX - lastPinchMid.current.x;
          const dmy = midY - lastPinchMid.current.y;
          if (Math.abs(dmx) > 0.5 || Math.abs(dmy) > 0.5) {
            setOffset((prev) => ({ x: prev.x + dmx, y: prev.y + dmy }));
          }
          lastPinchMid.current = { x: midX, y: midY };
        }
      }
    }
  }, [zoomAt]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) {
      lastPinchDist.current = null;
      lastPinchMid.current = null;
    }
    if (activePointers.current.size === 0) {
      isDragging.current = false;
      dragStart.current = null;
    } else if (activePointers.current.size === 1) {
      // Transition from pinch back to single-finger drag
      isDragging.current = true;
      const [ptr] = Array.from(activePointers.current.values());
      setOffset((prev) => {
        dragStart.current = { px: ptr.x, py: ptr.y, ox: prev.x, oy: prev.y };
        return prev;
      });
    }
  }, []);

  const handleFillToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = fillMode === 'fill' ? 'outline' : 'fill';
    setFillMode(next);
    onFillModeChange?.(next);
  };

  // ── Toolbar ─────────────────────────────────────────────────────────────────

  const Toolbar = ({ onClose }: { onClose?: (e: React.MouseEvent) => void }) => (
    <div className="flex items-center gap-1 px-2 border-b bg-muted/30 shrink-0" style={{ minHeight: 48 }}>
      {showFillToggle && (
        <button
          onClick={handleFillToggle}
          className="flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold transition-all select-none shrink-0"
          style={{
            background: fillMode === 'fill' ? '#1e1e1e' : '#f3f4f6',
            color: fillMode === 'fill' ? 'white' : '#374151',
            border: fillMode === 'fill' ? '1.5px solid #1e1e1e' : '1.5px solid #d1d5db',
            minWidth: 72,
          }}
          title={fillMode === 'fill' ? 'Switch to outline' : 'Switch to fill'}
        >
          <span style={{ fontSize: 11 }}>{fillMode === 'fill' ? '◼' : '◻'}</span>
          <span>{fillMode === 'fill' ? (isRtl ? 'מילוי' : 'Fill') : (isRtl ? 'קווים' : 'Outline')}</span>
        </button>
      )}

      <span className="flex-1" />

      {/* Zoom % */}
      <span className="text-xs text-muted-foreground/60 w-9 text-center tabular-nums select-none">{Math.round(scale * 100)}%</span>

      <div className="w-px h-5 bg-border mx-0.5" />

      {/* Zoom controls */}
      <div className="flex items-center gap-0.5">
        <button onClick={zoomOut} className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-muted active:bg-muted/80 transition-colors" title="Zoom out">
          <ZoomOut className="w-5 h-5 text-foreground" />
        </button>
        <button onClick={zoomIn} className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-muted active:bg-muted/80 transition-colors" title="Zoom in">
          <ZoomIn className="w-5 h-5 text-foreground" />
        </button>
        <button onClick={resetView} className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-muted active:bg-muted/80 transition-colors" title="Reset zoom">
          <Maximize2 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {showFullscreen && (
        <>
          <div className="w-px h-5 bg-border mx-0.5" />
          <button
            onClick={onClose ?? ((e) => { e.stopPropagation(); setFullscreen(true); setScale(1); setOffset({ x: 0, y: 0 }); })}
            className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-muted active:bg-muted/80 transition-colors"
            title={onClose ? 'Close' : 'Fullscreen'}
          >
            {onClose
              ? <X className="w-5 h-5 text-foreground" />
              : <Maximize2 className="w-5 h-5 text-primary" />}
          </button>
        </>
      )}
    </div>
  );

  // ── Canvas ───────────────────────────────────────────────────────────────────

  const Canvas = ({ canvasHeight }: { canvasHeight: number | string }) => (
    <div
      ref={(el) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        setContainerHeight(el);
      }}
      className={`relative overflow-hidden bg-white select-none touch-none ${svgViewerClass}`}
      style={{
        height: canvasHeight,
        cursor: isDragging.current ? "grabbing" : "grab",
      }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        ref={contentRef}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
          transformOrigin: "center center",
          width: "90%",
          height: "90%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          willChange: "transform",
        }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );

  return (
    <>
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ touchAction: 'none' }}>
          <Toolbar onClose={(e) => { e.stopPropagation(); setFullscreen(false); setScale(1); setOffset({ x: 0, y: 0 }); }} />
          <div className="flex-1 overflow-hidden">
            <Canvas canvasHeight="100%" />
          </div>
        </div>
      )}
      <div className={`border rounded-lg overflow-hidden bg-white ${className}`}>
        <Toolbar />
        <Canvas canvasHeight={computedHeight} />
      </div>
    </>
  );
}
