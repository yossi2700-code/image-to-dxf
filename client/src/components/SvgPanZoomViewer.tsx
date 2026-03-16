/**
 * SvgPanZoomViewer — Shared pan/zoom SVG viewer component.
 *
 * Features:
 * - Mouse: scroll to zoom (zoom-to-cursor), drag to pan
 * - Touch: pinch-to-zoom (zoom-to-midpoint), single-finger drag to pan
 * - Pointer Events API for unified mouse/touch handling
 * - Fill / Outline toggle
 * - Zoom in/out/reset toolbar buttons
 * - Fullscreen mode (covers entire screen on mobile)
 * - No style injection into SVG (uses scoped CSS classes in index.css)
 *
 * Coordinate model:
 *   The content div is centered in the container via CSS (top:50%, left:50%, translate(-50%,-50%)).
 *   We then apply an additional screen-space translation (tx, ty) and a scale.
 *   transform = translate(-50% + tx, -50% + ty) scale(s)
 *
 *   When dragging: delta in screen pixels maps 1:1 to (tx, ty) — no division by scale needed
 *   because the scale origin is the center of the content, not the container.
 *
 *   When zooming toward point (cx, cy) in container coords:
 *     new_tx = cx_from_center + (tx - cx_from_center) * factor
 *   where cx_from_center = cx - containerWidth/2
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize2, X, Minimize2 } from "lucide-react";

interface Props {
  svgContent: string;
  /** Fixed height in px or CSS string like "60vh", or "auto" to compute from SVG aspect ratio */
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

const MIN_SCALE = 0.1;
const MAX_SCALE = 20;

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

  // Keep a ref copy of scale/offset so pointer handlers always see latest values
  // without needing them in their dependency arrays (avoids stale closures).
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { offsetRef.current = offset; }, [offset]);

  // Pointer tracking for pan + pinch
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDist = useRef<number | null>(null);
  const lastPinchMid = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  // dragStart stores the pointer start position and the offset at that moment
  const dragStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  // Track if a significant drag happened (to suppress tap-as-click)
  const didDrag = useRef(false);
  // Double-tap detection
  const lastTapTime = useRef<number>(0);
  const lastTapPos = useRef<{ x: number; y: number } | null>(null);

  // Default height: 60vh on mobile (min 300px)
  const defaultHeight = height ?? "clamp(300px, 60vh, 680px)";

  const svgViewerClass = fillMode === 'fill' ? 'svg-viewer-fill' : 'svg-viewer-outline';

  // ── Zoom helpers ────────────────────────────────────────────────────────────

  /**
   * Zoom toward a point (cx, cy) in container coordinates.
   * The offset is a screen-space translation applied on top of the CSS centering.
   * To keep the point under the cursor fixed:
   *   new_offset = zoom_point + (old_offset - zoom_point) * factor
   * where zoom_point is measured from the container center.
   */
  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Convert container-relative coords to center-relative coords
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const zpx = cx - centerX; // zoom point relative to container center
    const zpy = cy - centerY;

    setScale((prevScale) => {
      const newScale = clampScale(prevScale * factor);
      const actualFactor = newScale / prevScale;
      setOffset((prev) => ({
        x: zpx + (prev.x - zpx) * actualFactor,
        y: zpy + (prev.y - zpy) * actualFactor,
      }));
      return newScale;
    });
  }, []);

  const zoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 0;
    const cy = rect ? rect.height / 2 : 0;
    zoomAt(1.5, cx, cy);
  };

  const zoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 0;
    const cy = rect ? rect.height / 2 : 0;
    zoomAt(1 / 1.5, cx, cy);
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
    // Only primary button for mouse; all touch pointers
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    didDrag.current = false;

    if (activePointers.current.size === 1) {
      // Single pointer — start drag
      isDragging.current = true;
      // Capture current offset at drag start
      dragStart.current = {
        px: e.clientX,
        py: e.clientY,
        ox: offsetRef.current.x,
        oy: offsetRef.current.y,
      };
      lastPinchDist.current = null;
      lastPinchMid.current = null;
    } else if (activePointers.current.size === 2) {
      // Two pointers — start pinch; cancel any ongoing single-finger drag
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
      // Pan: delta in screen pixels maps directly to offset (no scale division needed)
      const ds = dragStart.current;
      const dx = e.clientX - ds.px;
      const dy = e.clientY - ds.py;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
      setOffset({
        x: ds.ox + dx,
        y: ds.oy + dy,
      });
    } else if (activePointers.current.size === 2 && lastPinchDist.current !== null) {
      // Pinch zoom + pan
      const pts = Array.from(activePointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      const factor = dist / lastPinchDist.current;
      lastPinchDist.current = dist;
      didDrag.current = true;

      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
        const midY = (pts[0].y + pts[1].y) / 2 - rect.top;

        // Zoom toward pinch midpoint
        zoomAt(factor, midX, midY);

        // Also pan by midpoint movement
        if (lastPinchMid.current) {
          const dmx = midX - lastPinchMid.current.x;
          const dmy = midY - lastPinchMid.current.y;
          if (Math.abs(dmx) > 0.5 || Math.abs(dmy) > 0.5) {
            setOffset((prev) => ({ x: prev.x + dmx, y: prev.y + dmy }));
          }
        }
        lastPinchMid.current = { x: midX, y: midY };
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

      // Double-tap detection: only for touch/pen, not mouse
      if (!didDrag.current && e.pointerType !== 'mouse') {
        const now = Date.now();
        const rect = containerRef.current?.getBoundingClientRect();
        const tapX = rect ? e.clientX - rect.left : e.clientX;
        const tapY = rect ? e.clientY - rect.top : e.clientY;
        const timeDiff = now - lastTapTime.current;
        const lastPos = lastTapPos.current;
        const posDiff = lastPos ? Math.hypot(tapX - lastPos.x, tapY - lastPos.y) : 999;

        if (timeDiff < 350 && posDiff < 40) {
          // Double tap! Toggle between zoom x2.5 and reset
          setScale((prevScale) => {
            if (prevScale > 1.5) {
              // Already zoomed — reset
              setOffset({ x: 0, y: 0 });
              return 1;
            } else {
              // Zoom x2.5 toward tap point (relative to container center)
              const factor = 2.5;
              const rect2 = containerRef.current?.getBoundingClientRect();
              const centerX = rect2 ? rect2.width / 2 : 0;
              const centerY = rect2 ? rect2.height / 2 : 0;
              const zpx = tapX - centerX;
              const zpy = tapY - centerY;
              setOffset((prev) => ({
                x: zpx + (prev.x - zpx) * factor,
                y: zpy + (prev.y - zpy) * factor,
              }));
              return clampScale(prevScale * factor);
            }
          });
          lastTapTime.current = 0;
          lastTapPos.current = null;
        } else {
          lastTapTime.current = now;
          lastTapPos.current = { x: tapX, y: tapY };
        }
      }
    } else if (activePointers.current.size === 1) {
      // Transition from pinch back to single-finger drag
      // Re-start drag from current finger position with current offset
      isDragging.current = true;
      const [ptr] = Array.from(activePointers.current.values());
      dragStart.current = {
        px: ptr.x,
        py: ptr.y,
        ox: offsetRef.current.x,
        oy: offsetRef.current.y,
      };
    }
  }, []);

  const handleFillToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = fillMode === 'fill' ? 'outline' : 'fill';
    setFillMode(next);
    onFillModeChange?.(next);
  };

  const openFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFullscreen(true);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const closeFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFullscreen(false);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  // Lock body scroll when fullscreen is open
  useEffect(() => {
    if (fullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [fullscreen]);

  // ── Toolbar ─────────────────────────────────────────────────────────────────

  const Toolbar = ({ isFullscreen = false }: { isFullscreen?: boolean }) => (
    <div
      className="flex items-center gap-1 px-2 shrink-0"
      style={{
        minHeight: 52,
        background: isFullscreen ? 'rgba(0,0,0,0.85)' : undefined,
        borderBottom: isFullscreen ? '1px solid rgba(255,255,255,0.1)' : undefined,
      }}
    >
      {showFillToggle && (
        <button
          onClick={handleFillToggle}
          className="flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold transition-all select-none shrink-0"
          style={{
            background: fillMode === 'fill'
              ? (isFullscreen ? '#fff' : '#1e1e1e')
              : (isFullscreen ? 'rgba(255,255,255,0.15)' : '#f3f4f6'),
            color: fillMode === 'fill'
              ? (isFullscreen ? '#1e1e1e' : 'white')
              : (isFullscreen ? 'rgba(255,255,255,0.8)' : '#374151'),
            border: fillMode === 'fill'
              ? (isFullscreen ? '1.5px solid rgba(255,255,255,0.3)' : '1.5px solid #1e1e1e')
              : (isFullscreen ? '1.5px solid rgba(255,255,255,0.2)' : '1.5px solid #d1d5db'),
            minWidth: 76,
          }}
          title={fillMode === 'fill' ? 'Switch to outline' : 'Switch to fill'}
        >
          <span style={{ fontSize: 11 }}>{fillMode === 'fill' ? '◼' : '◻'}</span>
          <span>{fillMode === 'fill' ? (isRtl ? 'מילוי' : 'Fill') : (isRtl ? 'קווים' : 'Outline')}</span>
        </button>
      )}

      <span className="flex-1" />

      {/* Zoom % */}
      <span
        className="text-xs w-10 text-center tabular-nums select-none"
        style={{ color: isFullscreen ? 'rgba(255,255,255,0.5)' : 'var(--muted-foreground)' }}
      >
        {Math.round(scale * 100)}%
      </span>

      <div className="w-px h-5 mx-0.5" style={{ background: isFullscreen ? 'rgba(255,255,255,0.15)' : 'var(--border)' }} />

      {/* Zoom controls */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={zoomOut}
          className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors active:scale-95"
          style={{ color: isFullscreen ? 'white' : 'var(--foreground)' }}
          onMouseEnter={e => (e.currentTarget.style.background = isFullscreen ? 'rgba(255,255,255,0.12)' : '')}
          onMouseLeave={e => (e.currentTarget.style.background = '')}
          title={isRtl ? 'הקטן' : 'Zoom out'}
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={zoomIn}
          className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors active:scale-95"
          style={{ color: isFullscreen ? 'white' : 'var(--foreground)' }}
          onMouseEnter={e => (e.currentTarget.style.background = isFullscreen ? 'rgba(255,255,255,0.12)' : '')}
          onMouseLeave={e => (e.currentTarget.style.background = '')}
          title={isRtl ? 'הגדל' : 'Zoom in'}
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={resetView}
          className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors active:scale-95"
          style={{ color: isFullscreen ? 'rgba(255,255,255,0.6)' : 'var(--muted-foreground)' }}
          onMouseEnter={e => (e.currentTarget.style.background = isFullscreen ? 'rgba(255,255,255,0.12)' : '')}
          onMouseLeave={e => (e.currentTarget.style.background = '')}
          title={isRtl ? 'אפס תצוגה' : 'Reset view'}
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      </div>

      {showFullscreen && (
        <>
          <div className="w-px h-5 mx-0.5" style={{ background: isFullscreen ? 'rgba(255,255,255,0.15)' : 'var(--border)' }} />
          {isFullscreen ? (
            <button
              onClick={closeFullscreen}
              className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors active:scale-95"
              style={{ color: 'white' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
              title={isRtl ? 'סגור מסך מלא' : 'Close fullscreen'}
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={openFullscreen}
              className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-muted active:bg-muted/80 transition-colors active:scale-95"
              style={{ color: 'var(--primary)' }}
              title={isRtl ? 'פתח מסך מלא' : 'Open fullscreen'}
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          )}
        </>
      )}
    </div>
  );

  // ── Canvas ───────────────────────────────────────────────────────────────────

  const Canvas = ({ canvasHeight, isFullscreen = false }: { canvasHeight: number | string; isFullscreen?: boolean }) => (
    <div
      ref={(el) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      }}
      className={`relative overflow-hidden select-none touch-none ${svgViewerClass}`}
      style={{
        height: canvasHeight,
        background: isFullscreen ? '#111' : 'white',
        cursor: isDragging.current ? 'grabbing' : 'grab',
        WebkitUserSelect: 'none',
        userSelect: 'none',
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
          position: 'absolute',
          top: '50%',
          left: '50%',
          /**
           * Coordinate model:
           * - CSS centers the div at (50%, 50%) of the container
           * - We add (offset.x, offset.y) as a screen-space translation
           * - Then scale from the content center
           * - Dragging: delta px → delta offset (1:1, no scale division)
           * - Zooming: offset adjusted so the zoom point stays fixed
           */
          transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
          transformOrigin: 'center center',
          width: '90%',
          height: '90%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          willChange: 'transform',
        }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />

      {/* Hint overlay — shown only at scale=1, offset=0 */}
      {scale === 1 && offset.x === 0 && offset.y === 0 && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs pointer-events-none select-none"
          style={{
            background: isFullscreen ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)',
            color: isFullscreen ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(4px)',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: 13 }}>👆</span>
          <span>{isRtl ? 'גרור להזזה · צבט להגדלה' : 'Drag to pan · Pinch to zoom'}</span>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ── Fullscreen overlay ── */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col"
          style={{ background: '#111', touchAction: 'none' }}
        >
          <Toolbar isFullscreen />
          <div className="flex-1 overflow-hidden">
            <Canvas canvasHeight="100%" isFullscreen />
          </div>
        </div>
      )}

      {/* ── Inline viewer ── */}
      <div className={`border rounded-xl overflow-hidden bg-white ${className}`} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div className="border-b bg-muted/30">
          <Toolbar />
        </div>
        <Canvas canvasHeight={defaultHeight} />
      </div>
    </>
  );
}
