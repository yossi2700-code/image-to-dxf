/**
 * SvgPanZoomViewer — True vector pan/zoom SVG viewer.
 *
 * Rendering approach:
 *   Manipulates the SVG viewBox directly (not CSS scale) for crisp vector rendering.
 *
 * Touch handling:
 *   Native addEventListener with { passive: false } for iOS Safari.
 *   Single finger = pan. Zoom via buttons or scroll wheel only.
 *
 * Key fix: Canvas is inlined JSX (not a nested function component) so the
 *   containerRef always points to the active DOM element. Each mode
 *   (normal / fullscreen) has its own ref; we swap which one is "active".
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

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 40;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function parseViewBox(svg: string): { x: number; y: number; w: number; h: number } | null {
  const m = svg.match(/viewBox=["']\s*([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)\s*["']/i);
  if (!m) return null;
  const [, x, y, w, h] = m.map(Number);
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

function applyViewBox(svg: string, vb: { x: number; y: number; w: number; h: number }): string {
  const vbStr = `${vb.x.toFixed(3)} ${vb.y.toFixed(3)} ${vb.w.toFixed(3)} ${vb.h.toFixed(3)}`;
  let s = svg;
  if (/viewBox=/i.test(s)) {
    s = s.replace(/viewBox=["'][^"']*["']/i, `viewBox="${vbStr}"`);
  } else {
    s = s.replace(/<svg/i, `<svg viewBox="${vbStr}"`);
  }
  s = s.replace(/(<svg[^>]*)\s+width=["'][^"']*["']/i, '$1');
  s = s.replace(/(<svg[^>]*)\s+height=["'][^"']*["']/i, '$1');
  s = s.replace(/<svg/i, '<svg width="100%" height="100%"');
  return s;
}

function ensureFullSize(svg: string): string {
  let s = svg;
  s = s.replace(/(<svg[^>]*)\s+width=["'][^"']*["']/i, '$1');
  s = s.replace(/(<svg[^>]*)\s+height=["'][^"']*["']/i, '$1');
  s = s.replace(/<svg/i, '<svg width="100%" height="100%"');
  return s;
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

  // Two separate container refs — one for normal, one for fullscreen
  const normalRef = useRef<HTMLDivElement>(null);
  const fsRef = useRef<HTMLDivElement>(null);

  // Active container = whichever is currently visible
  const containerRef = useCallback((): HTMLDivElement | null => {
    return fullscreen ? fsRef.current : normalRef.current;
  }, [fullscreen]);

  const originalVb = useMemo(() => parseViewBox(svgContent), [svgContent]);

  const [vb, setVb] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const vbRef = useRef(vb);
  const setVbBoth = useCallback((next: { x: number; y: number; w: number; h: number } | null) => {
    vbRef.current = next;
    setVb(next);
  }, []);

  useEffect(() => {
    const newVb = originalVb ? { ...originalVb } : null;
    setVbBoth(newVb);
  }, [svgContent, originalVb, setVbBoth]);

  const zoomLevel = useMemo(() => {
    if (!vb || !originalVb) return 1;
    return originalVb.w / vb.w;
  }, [vb, originalVb]);

  const displaySvg = useMemo(() => {
    if (!vb) return ensureFullSize(svgContent);
    return applyViewBox(svgContent, vb);
  }, [svgContent, vb]);

  const defaultHeight = height ?? "clamp(300px, 60vh, 680px)";
  const svgViewerClass = fillMode === 'fill' ? 'svg-viewer-fill' : 'svg-viewer-outline';

  // ── Zoom helpers ─────────────────────────────────────────────────────────────

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    const origVb = originalVb;
    if (!origVb) return;
    const el = containerRef();
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cur = vbRef.current ?? { ...origVb };
    const newW = clamp(cur.w / factor, origVb.w / MAX_ZOOM, origVb.w / MIN_ZOOM);
    const newH = clamp(cur.h / factor, origVb.h / MAX_ZOOM, origVb.h / MIN_ZOOM);
    const svgX = cur.x + (cx / rect.width) * cur.w;
    const svgY = cur.y + (cy / rect.height) * cur.h;
    const next = {
      x: svgX - (cx / rect.width) * newW,
      y: svgY - (cy / rect.height) * newH,
      w: newW,
      h: newH,
    };
    setVbBoth(next);
  }, [originalVb, containerRef, setVbBoth]);

  const zoomIn = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const el = containerRef();
    const rect = el?.getBoundingClientRect();
    zoomAt(1.5, rect ? rect.width / 2 : 0, rect ? rect.height / 2 : 0);
  }, [containerRef, zoomAt]);

  const zoomOut = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const el = containerRef();
    const rect = el?.getBoundingClientRect();
    zoomAt(1 / 1.5, rect ? rect.width / 2 : 0, rect ? rect.height / 2 : 0);
  }, [containerRef, zoomAt]);

  const resetView = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setVbBoth(originalVb ? { ...originalVb } : null);
  }, [originalVb, setVbBoth]);

  // ── Wheel zoom ───────────────────────────────────────────────────────────────

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const el = containerRef();
    const rect = el?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, cx, cy);
  }, [containerRef, zoomAt]);

  // ── Touch pan (single finger only) ──────────────────────────────────────────

  const touchState = useRef<{
    touches: Map<number, { x: number; y: number }>;
    panStart: { touchX: number; touchY: number; vbX: number; vbY: number } | null;
    didMove: boolean;
    lastTapTime: number;
    lastTapPos: { x: number; y: number } | null;
  }>({
    touches: new Map(),
    panStart: null,
    didMove: false,
    lastTapTime: 0,
    lastTapPos: null,
  });

  const anchorPan = useCallback((x: number, y: number, rect: DOMRect) => {
    const cur = vbRef.current;
    if (!cur) return;
    const cx = x - rect.left;
    const cy = y - rect.top;
    touchState.current.panStart = {
      touchX: cx,
      touchY: cy,
      vbX: cur.x + (cx / rect.width) * cur.w,
      vbY: cur.y + (cy / rect.height) * cur.h,
    };
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const ts = touchState.current;
    const el = containerRef();
    if (!el) return;
    const rect = el.getBoundingClientRect();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      ts.touches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    ts.didMove = false;
    const [first] = Array.from(ts.touches.values());
    if (first) anchorPan(first.x, first.y, rect);
  }, [containerRef, anchorPan]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const ts = touchState.current;
    const el = containerRef();
    if (!el || !ts.panStart) return;
    const rect = el.getBoundingClientRect();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (ts.touches.has(t.identifier)) {
        ts.touches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    }

    const [first] = Array.from(ts.touches.values());
    if (!first) return;
    const cx = first.x - rect.left;
    const cy = first.y - rect.top;
    const ps = ts.panStart;

    if (Math.abs(cx - ps.touchX) > 2 || Math.abs(cy - ps.touchY) > 2) ts.didMove = true;

    const cur = vbRef.current;
    if (!cur) return;
    setVbBoth({
      ...cur,
      x: ps.vbX - (cx / rect.width) * cur.w,
      y: ps.vbY - (cy / rect.height) * cur.h,
    });
  }, [containerRef, setVbBoth]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const ts = touchState.current;
    const el = containerRef();

    for (let i = 0; i < e.changedTouches.length; i++) {
      ts.touches.delete(e.changedTouches[i].identifier);
    }

    if (ts.touches.size === 0) {
      if (!ts.didMove) {
        const rect = el?.getBoundingClientRect();
        const t = e.changedTouches[0];
        const tapX = rect ? t.clientX - rect.left : t.clientX;
        const tapY = rect ? t.clientY - rect.top : t.clientY;
        const now = Date.now();
        const timeDiff = now - ts.lastTapTime;
        const posDiff = ts.lastTapPos ? Math.hypot(tapX - ts.lastTapPos.x, tapY - ts.lastTapPos.y) : 999;

        if (timeDiff < 350 && posDiff < 40 && rect && originalVb) {
          // Double-tap: toggle zoom
          const cur = vbRef.current;
          if (cur) {
            const isZoomed = cur.w < originalVb.w * 0.9;
            if (isZoomed) {
              setVbBoth({ ...originalVb });
            } else {
              const factor = 2;
              const newW = clamp(cur.w / factor, originalVb.w / MAX_ZOOM, originalVb.w / MIN_ZOOM);
              const newH = clamp(cur.h / factor, originalVb.h / MAX_ZOOM, originalVb.h / MIN_ZOOM);
              const svgX = cur.x + (tapX / rect.width) * cur.w;
              const svgY = cur.y + (tapY / rect.height) * cur.h;
              setVbBoth({
                x: svgX - (tapX / rect.width) * newW,
                y: svgY - (tapY / rect.height) * newH,
                w: newW, h: newH,
              });
            }
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
      // Re-anchor to remaining finger
      const [remaining] = Array.from(ts.touches.values());
      const rect = el?.getBoundingClientRect();
      if (remaining && rect) anchorPan(remaining.x, remaining.y, rect);
    }
  }, [containerRef, originalVb, setVbBoth, anchorPan]);

  // ── Mouse drag (desktop) ─────────────────────────────────────────────────────

  const mouseDrag = useRef<{
    active: boolean;
    vbX: number; vbY: number;
    startX: number; startY: number;
  } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const el = containerRef();
    const rect = el?.getBoundingClientRect();
    if (!rect) return;
    const cur = vbRef.current;
    if (!cur) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    mouseDrag.current = {
      active: true,
      startX: cx, startY: cy,
      vbX: cur.x + (cx / rect.width) * cur.w,
      vbY: cur.y + (cy / rect.height) * cur.h,
    };
    e.preventDefault();
  }, [containerRef]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const md = mouseDrag.current;
    if (!md?.active) return;
    const el = containerRef();
    const rect = el?.getBoundingClientRect();
    if (!rect) return;
    const cur = vbRef.current;
    if (!cur) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setVbBoth({
      ...cur,
      x: md.vbX - (cx / rect.width) * cur.w,
      y: md.vbY - (cy / rect.height) * cur.h,
    });
  }, [containerRef, setVbBoth]);

  const onMouseUp = useCallback(() => {
    if (mouseDrag.current) mouseDrag.current.active = false;
  }, []);

  // ── Attach native listeners to whichever container is active ─────────────────

  const attachListeners = useCallback((el: HTMLDivElement | null) => {
    if (!el) return () => {};
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

  // Attach to normal container
  useEffect(() => attachListeners(normalRef.current), [attachListeners]);

  // Attach to fullscreen container when it mounts
  useEffect(() => {
    if (!fullscreen) return;
    // Small delay to ensure fsRef is mounted
    const t = setTimeout(() => attachListeners(fsRef.current), 50);
    return () => clearTimeout(t);
  }, [fullscreen, attachListeners]);

  // ── Fullscreen ───────────────────────────────────────────────────────────────

  const openFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFullscreen(true);
    setVbBoth(originalVb ? { ...originalVb } : null);
  };

  const closeFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFullscreen(false);
    setVbBoth(originalVb ? { ...originalVb } : null);
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

  // ── Toolbar ──────────────────────────────────────────────────────────────────

  const renderToolbar = (isFs = false) => (
    <div
      className="flex items-center gap-1 px-2 shrink-0"
      style={{
        minHeight: 52,
        background: isFs ? 'rgba(0,0,0,0.85)' : undefined,
        borderBottom: isFs ? '1px solid rgba(255,255,255,0.1)' : undefined,
      }}
    >
      {showFillToggle && (
        <button
          onClick={handleFillToggle}
          className="flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold transition-all select-none shrink-0"
          style={{
            background: fillMode === 'fill'
              ? (isFs ? '#fff' : '#1e1e1e')
              : (isFs ? 'rgba(255,255,255,0.15)' : '#f3f4f6'),
            color: fillMode === 'fill'
              ? (isFs ? '#1e1e1e' : 'white')
              : (isFs ? 'rgba(255,255,255,0.8)' : '#374151'),
            border: fillMode === 'fill'
              ? (isFs ? '1.5px solid rgba(255,255,255,0.3)' : '1.5px solid #1e1e1e')
              : (isFs ? '1.5px solid rgba(255,255,255,0.2)' : '1.5px solid #d1d5db'),
            minWidth: 76,
          }}
        >
          <span style={{ fontSize: 11 }}>{fillMode === 'fill' ? '◼' : '◻'}</span>
          <span>{fillMode === 'fill' ? (isRtl ? 'מילוי' : 'Fill') : (isRtl ? 'קווים' : 'Outline')}</span>
        </button>
      )}

      <span className="flex-1" />

      <span
        className="text-xs w-10 text-center tabular-nums select-none"
        style={{ color: isFs ? 'rgba(255,255,255,0.5)' : 'var(--muted-foreground)' }}
      >
        {Math.round(zoomLevel * 100)}%
      </span>

      <div className="w-px h-5 mx-0.5" style={{ background: isFs ? 'rgba(255,255,255,0.15)' : 'var(--border)' }} />

      <div className="flex items-center gap-0.5">
        <button onClick={zoomOut} className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors active:scale-95"
          style={{ color: isFs ? 'white' : 'var(--foreground)' }}
          onMouseEnter={e => (e.currentTarget.style.background = isFs ? 'rgba(255,255,255,0.12)' : '')}
          onMouseLeave={e => (e.currentTarget.style.background = '')}
          title={isRtl ? 'הקטן' : 'Zoom out'}>
          <ZoomOut className="w-5 h-5" />
        </button>
        <button onClick={zoomIn} className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors active:scale-95"
          style={{ color: isFs ? 'white' : 'var(--foreground)' }}
          onMouseEnter={e => (e.currentTarget.style.background = isFs ? 'rgba(255,255,255,0.12)' : '')}
          onMouseLeave={e => (e.currentTarget.style.background = '')}
          title={isRtl ? 'הגדל' : 'Zoom in'}>
          <ZoomIn className="w-5 h-5" />
        </button>
        <button onClick={resetView} className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors active:scale-95"
          style={{ color: isFs ? 'rgba(255,255,255,0.6)' : 'var(--muted-foreground)' }}
          onMouseEnter={e => (e.currentTarget.style.background = isFs ? 'rgba(255,255,255,0.12)' : '')}
          onMouseLeave={e => (e.currentTarget.style.background = '')}
          title={isRtl ? 'אפס תצוגה' : 'Reset view'}>
          <Minimize2 className="w-4 h-4" />
        </button>
      </div>

      {showFullscreen && (
        <>
          <div className="w-px h-5 mx-0.5" style={{ background: isFs ? 'rgba(255,255,255,0.15)' : 'var(--border)' }} />
          {isFs ? (
            <button onClick={closeFullscreen} className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors active:scale-95"
              style={{ color: 'white' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
              title={isRtl ? 'סגור מסך מלא' : 'Close fullscreen'}>
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={openFullscreen} className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-muted active:bg-muted/80 transition-colors active:scale-95"
              style={{ color: 'var(--primary)' }}
              title={isRtl ? 'פתח מסך מלא' : 'Open fullscreen'}>
              <Maximize2 className="w-5 h-5" />
            </button>
          )}
        </>
      )}
    </div>
  );

  // ── Canvas JSX (inlined — not a nested component) ────────────────────────────

  const isAtReset = zoomLevel <= 1.02 && zoomLevel >= 0.98;

  const renderCanvas = (ref: React.RefObject<HTMLDivElement | null>, canvasHeight: number | string, isFs = false) => (
    <div
      ref={ref}
      className={`relative overflow-hidden select-none ${svgViewerClass}`}
      style={{
        height: canvasHeight,
        background: isFs ? '#111' : 'white',
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
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%' }}
        dangerouslySetInnerHTML={{ __html: displaySvg }}
      />
      {isAtReset && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs pointer-events-none select-none"
          style={{
            background: isFs ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)',
            color: isFs ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(4px)',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: 13 }}>👆</span>
          <span>{isRtl ? 'גרור להזזה' : 'Drag to pan'}</span>
        </div>
      )}
    </div>
  );

  return (
    <>
      {fullscreen && (
        <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: '#111' }}>
          {renderToolbar(true)}
          <div className="flex-1 overflow-hidden">
            {renderCanvas(fsRef, '100%', true)}
          </div>
        </div>
      )}

      <div className={`border rounded-xl overflow-hidden bg-white ${className}`} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div className="border-b bg-muted/30">
          {renderToolbar(false)}
        </div>
        {renderCanvas(normalRef, defaultHeight, false)}
      </div>
    </>
  );
}
