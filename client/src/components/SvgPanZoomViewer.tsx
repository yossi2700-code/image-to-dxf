/**
 * SvgPanZoomViewer — True vector pan/zoom SVG viewer.
 *
 * Rendering approach:
 *   Instead of CSS transform: scale() (which can rasterize the SVG),
 *   we manipulate the SVG's viewBox directly. This guarantees the browser
 *   always renders the SVG as a true vector at the display resolution.
 *
 *   viewBox = "x y w h" where:
 *     - (x, y) is the top-left corner of the visible area in SVG coordinates
 *     - (w, h) is the width/height of the visible area in SVG coordinates
 *   Zooming in = smaller w/h (we see less of the SVG, magnified)
 *   Panning = shift x, y
 *
 * Touch handling:
 *   Uses native addEventListener with { passive: false } on the container
 *   element to correctly handle iOS Safari's touch events without pointer
 *   capture issues that cause freeze/lock when switching between drag and pinch.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { ZoomIn, ZoomOut, Maximize2, X, Minimize2 } from "lucide-react";

interface Props {
  svgContent: string;
  height?: number | string;
  showFillToggle?: boolean;
  showFullscreen?: boolean;
  initialFillMode?: 'fill' | 'outline';
  onFillModeChange?: (mode: 'fill' | 'outline') => void;
  className?: string;
  isRtl?: boolean;
}

const MIN_ZOOM = 0.05;  // viewBox can be up to 20x the original
const MAX_ZOOM = 40;    // viewBox can be 1/40 of the original

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** Parse viewBox from SVG string. Returns null if not found. */
function parseViewBox(svg: string): { x: number; y: number; w: number; h: number } | null {
  const m = svg.match(/viewBox=["']\s*([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)\s*["']/i);
  if (!m) return null;
  const [, x, y, w, h] = m.map(Number);
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

/** Replace or insert viewBox in SVG string */
function setViewBox(svg: string, vb: { x: number; y: number; w: number; h: number }): string {
  const vbStr = `${vb.x.toFixed(3)} ${vb.y.toFixed(3)} ${vb.w.toFixed(3)} ${vb.h.toFixed(3)}`;
  if (/viewBox=/i.test(svg)) {
    return svg.replace(/viewBox=["'][^"']*["']/i, `viewBox="${vbStr}"`);
  }
  return svg.replace(/<svg/i, `<svg viewBox="${vbStr}"`);
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
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // The "original" viewBox from the SVG source — our reference for zoom level 1
  const originalVb = useMemo(() => parseViewBox(svgContent), [svgContent]);

  // Current viewBox state — this is what we manipulate for pan/zoom
  const [vb, setVb] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Reset viewBox when SVG content changes
  useEffect(() => {
    setVb(originalVb ? { ...originalVb } : null);
  }, [svgContent, originalVb]);

  // Derived zoom level (for display)
  const zoomLevel = useMemo(() => {
    if (!vb || !originalVb) return 1;
    return originalVb.w / vb.w;
  }, [vb, originalVb]);

  // The SVG to display — with current viewBox applied
  const displaySvg = useMemo(() => {
    if (!vb) return svgContent;
    return setViewBox(svgContent, vb);
  }, [svgContent, vb]);

  const defaultHeight = height ?? "clamp(300px, 60vh, 680px)";
  const svgViewerClass = fillMode === 'fill' ? 'svg-viewer-fill' : 'svg-viewer-outline';

  // ── ViewBox zoom helpers ─────────────────────────────────────────────────────

  /**
   * Zoom toward a point (cx, cy) in container coordinates.
   * cx, cy are in [0, containerWidth] x [0, containerHeight].
   */
  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    if (!originalVb) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    setVb((prev) => {
      const cur = prev ?? { ...originalVb };
      // Clamp the zoom factor so we don't exceed limits
      const newW = clamp(cur.w / factor, originalVb.w / MAX_ZOOM, originalVb.w / MIN_ZOOM);
      const newH = clamp(cur.h / factor, originalVb.h / MAX_ZOOM, originalVb.h / MIN_ZOOM);
      const actualFactor = cur.w / newW;

      // Convert container pixel coords to SVG coords
      const svgX = cur.x + (cx / rect.width) * cur.w;
      const svgY = cur.y + (cy / rect.height) * cur.h;

      // Keep the SVG point under the cursor fixed
      return {
        x: svgX - (cx / rect.width) * newW,
        y: svgY - (cy / rect.height) * newH,
        w: newW,
        h: newH,
      };
      void actualFactor;
    });
  }, [originalVb]);

  const zoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    zoomAt(1.5, rect ? rect.width / 2 : 0, rect ? rect.height / 2 : 0);
  };

  const zoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    zoomAt(1 / 1.5, rect ? rect.width / 2 : 0, rect ? rect.height / 2 : 0);
  };

  const resetView = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVb(originalVb ? { ...originalVb } : null);
  };

  // ── Wheel zoom ──────────────────────────────────────────────────────────────

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomAt(factor, cx, cy);
  }, [zoomAt]);

  // ── Touch/pointer handling (native, not React synthetic) ─────────────────────
  // We use native touch events to avoid iOS pointer capture issues.

  const touchState = useRef<{
    touches: Map<number, { x: number; y: number }>;
    lastDist: number | null;
    lastMid: { x: number; y: number } | null;
    // For single-finger pan: store SVG coords of the touch start point
    panStart: { touchX: number; touchY: number; vbX: number; vbY: number } | null;
    didMove: boolean;
    lastTapTime: number;
    lastTapPos: { x: number; y: number } | null;
  }>({
    touches: new Map(),
    lastDist: null,
    lastMid: null,
    panStart: null,
    didMove: false,
    lastTapTime: 0,
    lastTapPos: null,
  });

  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const ts = touchState.current;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    // Update touch map
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      ts.touches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    ts.didMove = false;

    // Always pan — use the FIRST touch finger regardless of how many fingers are down.
    // Pinch-to-zoom is disabled; zoom is only via buttons or scroll wheel.
    const [touch] = Array.from(ts.touches.values());
    const cx = touch.x - rect.left;
    const cy = touch.y - rect.top;
    setVb((cur) => {
      if (!cur) return cur;
      ts.panStart = {
        touchX: cx,
        touchY: cy,
        vbX: cur.x + (cx / rect.width) * cur.w,
        vbY: cur.y + (cy / rect.height) * cur.h,
      };
      return cur;
    });
    ts.lastDist = null;
    ts.lastMid = null;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const ts = touchState.current;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    // Update touch map
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (ts.touches.has(t.identifier)) {
        ts.touches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    }

    // Pan only — use the first tracked finger, ignore multi-touch pinch
    if (ts.panStart) {
      const [touch] = Array.from(ts.touches.values());
      const cx = touch.x - rect.left;
      const cy = touch.y - rect.top;
      const ps = ts.panStart;
      if (Math.abs(cx - ps.touchX) > 2 || Math.abs(cy - ps.touchY) > 2) ts.didMove = true;

      setVb((cur) => {
        if (!cur) return cur;
        return {
          ...cur,
          x: ps.vbX - (cx / rect.width) * cur.w,
          y: ps.vbY - (cy / rect.height) * cur.h,
        };
      });
    }
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const ts = touchState.current;
    const container = containerRef.current;

    for (let i = 0; i < e.changedTouches.length; i++) {
      ts.touches.delete(e.changedTouches[i].identifier);
    }

    if (ts.touches.size === 0) {
      // Double-tap detection (zoom in x2 or reset)
      if (!ts.didMove) {
        const rect = container?.getBoundingClientRect();
        const t = e.changedTouches[0];
        const tapX = rect ? t.clientX - rect.left : t.clientX;
        const tapY = rect ? t.clientY - rect.top : t.clientY;
        const now = Date.now();
        const timeDiff = now - ts.lastTapTime;
        const posDiff = ts.lastTapPos ? Math.hypot(tapX - ts.lastTapPos.x, tapY - ts.lastTapPos.y) : 999;

        if (timeDiff < 350 && posDiff < 40) {
          // Double tap — zoom in x2 or reset
          if (rect && originalVb) {
            setVb((cur) => {
              if (!cur) return cur;
              const isZoomed = cur.w < originalVb.w * 0.9;
              if (isZoomed) return { ...originalVb };
              const factor = 2;
              const newW = clamp(cur.w / factor, originalVb.w / MAX_ZOOM, originalVb.w / MIN_ZOOM);
              const newH = clamp(cur.h / factor, originalVb.h / MAX_ZOOM, originalVb.h / MIN_ZOOM);
              const svgX = cur.x + (tapX / rect.width) * cur.w;
              const svgY = cur.y + (tapY / rect.height) * cur.h;
              return {
                x: svgX - (tapX / rect.width) * newW,
                y: svgY - (tapY / rect.height) * newH,
                w: newW,
                h: newH,
              };
            });
          }
          ts.lastTapTime = 0;
          ts.lastTapPos = null;
        } else {
          ts.lastTapTime = now;
          ts.lastTapPos = { x: tapX, y: tapY };
        }
      }
      ts.panStart = null;
    } else {
      // Still have fingers down — re-anchor pan to remaining first finger
      const [touch] = Array.from(ts.touches.values());
      const rect = container?.getBoundingClientRect();
      if (rect) {
        const cx = touch.x - rect.left;
        const cy = touch.y - rect.top;
        setVb((cur) => {
          if (!cur) return cur;
          ts.panStart = {
            touchX: cx,
            touchY: cy,
            vbX: cur.x + (cx / rect.width) * cur.w,
            vbY: cur.y + (cy / rect.height) * cur.h,
          };
          return cur;
        });
      }
    }
  }, [originalVb]);

  // ── Mouse drag (desktop) ─────────────────────────────────────────────────────

  const mouseDrag = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    vbX: number;
    vbY: number;
  } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setVb((cur) => {
      if (!cur) return cur;
      mouseDrag.current = {
        active: true,
        startX: cx,
        startY: cy,
        vbX: cur.x + (cx / rect.width) * cur.w,
        vbY: cur.y + (cy / rect.height) * cur.h,
      };
      return cur;
    });
    e.preventDefault();
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!mouseDrag.current?.active) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const md = mouseDrag.current;
    setVb((cur) => {
      if (!cur) return cur;
      return {
        ...cur,
        x: md.vbX - (cx / rect.width) * cur.w,
        y: md.vbY - (cy / rect.height) * cur.h,
      };
    });
  }, []);

  const onMouseUp = useCallback(() => {
    if (mouseDrag.current) mouseDrag.current.active = false;
  }, []);

  // ── Attach native listeners ──────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // passive: false so we can call preventDefault() and block page scroll/zoom
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: false });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, onWheel]);

  // ── Fullscreen ───────────────────────────────────────────────────────────────

  const openFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFullscreen(true);
    setVb(originalVb ? { ...originalVb } : null);
  };

  const closeFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFullscreen(false);
    setVb(originalVb ? { ...originalVb } : null);
  };

  useEffect(() => {
    document.body.style.overflow = fullscreen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [fullscreen]);

  const handleFillToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = fillMode === 'fill' ? 'outline' : 'fill';
    setFillMode(next);
    onFillModeChange?.(next);
  };

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

      <span
        className="text-xs w-10 text-center tabular-nums select-none"
        style={{ color: isFullscreen ? 'rgba(255,255,255,0.5)' : 'var(--muted-foreground)' }}
      >
        {Math.round(zoomLevel * 100)}%
      </span>

      <div className="w-px h-5 mx-0.5" style={{ background: isFullscreen ? 'rgba(255,255,255,0.15)' : 'var(--border)' }} />

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

  const isAtReset = zoomLevel <= 1.02 && zoomLevel >= 0.98;

  const Canvas = ({ canvasHeight, isFullscreen = false }: { canvasHeight: number | string; isFullscreen?: boolean }) => (
    <div
      ref={(el) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      }}
      className={`relative overflow-hidden select-none ${svgViewerClass}`}
      style={{
        height: canvasHeight,
        background: isFullscreen ? '#111' : 'white',
        cursor: mouseDrag.current?.active ? 'grabbing' : 'grab',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        touchAction: 'none',
        WebkitTouchCallout: 'none',
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* The SVG fills the entire canvas — viewBox controls what's visible */}
      <div
        className="absolute inset-0 pointer-events-none"
        dangerouslySetInnerHTML={{ __html: displaySvg }}
      />

      {/* Hint overlay */}
      {isAtReset && (
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
      {fullscreen && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col"
          style={{ background: '#111' }}
        >
          <Toolbar isFullscreen />
          <div className="flex-1 overflow-hidden">
            <Canvas canvasHeight="100%" isFullscreen />
          </div>
        </div>
      )}

      <div className={`border rounded-xl overflow-hidden bg-white ${className}`} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div className="border-b bg-muted/30">
          <Toolbar />
        </div>
        <Canvas canvasHeight={defaultHeight} />
      </div>
    </>
  );
}
