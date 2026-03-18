/**
 * AiProcessingAnimation — Clean light-theme AI processing screen.
 *
 * Design: white/light-gray background, accent color per feature,
 * scan beam over image preview, elegant multi-ring spinner,
 * 4 progress steps, cancel+refund button, pleasant tones (off by default).
 *
 * v2: wider progress bar, synced seconds display, unique step icons per feature.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";

// ── Props ────────────────────────────────────────────────────────────────────

interface AiProcessingAnimationProps {
  elapsedSeconds: number;
  /** Percentage 0–100 (optional). If provided, used for the progress bar.
   *  If omitted, progress is derived from elapsedSeconds. */
  progressPct?: number;
  currentStep?: string;
  imagePreview?: string | null;
  jobId?: string | null;
  onCancel?: () => void;
  isRtl?: boolean;
  accentColor?: string;
  accentGradient?: string;
  featureLabel?: string;
}

// ── Step definitions per feature ─────────────────────────────────────────────

type FeatureKey = "trace" | "portrait" | "redraw" | "default";

function detectFeature(label: string): FeatureKey {
  const l = label.toLowerCase();
  if (l.includes("trace") || l.includes("טרייס")) return "trace";
  if (l.includes("portrait") || l.includes("פורטרט")) return "portrait";
  if (l.includes("redraw") || l.includes("שרטוט")) return "redraw";
  return "default";
}

// SVG icon components for each step — unique per feature
function StepIconSVG({ feature, stepIdx, size = 18 }: { feature: FeatureKey; stepIdx: number; size?: number }) {
  const s = size;
  // Trace: Scan → Lines → Vector → Export
  if (feature === "trace") {
    if (stepIdx === 0) return (
      <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
        <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8"/>
        <line x1="13.5" y1="13.5" x2="17" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="6" y1="9" x2="12" y2="9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.6"/>
        <line x1="9" y1="6" x2="9" y2="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.6"/>
      </svg>
    );
    if (stepIdx === 1) return (
      <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
        <path d="M3 5 Q7 3 10 7 Q13 11 17 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
        <path d="M3 11 Q6 9 9 12 Q12 15 17 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" strokeOpacity="0.6"/>
        <circle cx="10" cy="7" r="1.5" fill="currentColor" fillOpacity="0.5"/>
      </svg>
    );
    if (stepIdx === 2) return (
      <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
        <polygon points="10,2 18,7 18,13 10,18 2,13 2,7" stroke="currentColor" strokeWidth="1.6" fill="none"/>
        <polygon points="10,6 14,8.5 14,11.5 10,14 6,11.5 6,8.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeOpacity="0.5"/>
        <circle cx="10" cy="10" r="1.5" fill="currentColor"/>
      </svg>
    );
    return (
      <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M7 10 L9.5 12.5 L13 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }

  // Portrait: Face Detect → Analyze → Draw Lines → Export
  if (feature === "portrait") {
    if (stepIdx === 0) return (
      <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="8" r="4" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M4 17 C4 13.5 7 11.5 10 11.5 C13 11.5 16 13.5 16 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <circle cx="8.5" cy="7.5" r="0.8" fill="currentColor"/>
        <circle cx="11.5" cy="7.5" r="0.8" fill="currentColor"/>
        <path d="M8.5 9.5 Q10 10.5 11.5 9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none"/>
      </svg>
    );
    if (stepIdx === 1) return (
      <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
        <rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 2"/>
        <line x1="2" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4"/>
        <line x1="2" y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4"/>
        <line x1="8" y1="2" x2="8" y2="18" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4"/>
        <line x1="12" y1="2" x2="12" y2="18" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4"/>
        <circle cx="10" cy="10" r="2.5" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    );
    if (stepIdx === 2) return (
      <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
        <path d="M4 16 L7 7 L10 12 L13 5 L16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <circle cx="7" cy="7" r="1.2" fill="currentColor" fillOpacity="0.5"/>
        <circle cx="13" cy="5" r="1.2" fill="currentColor" fillOpacity="0.5"/>
      </svg>
    );
    return (
      <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
        <path d="M5 3 L15 3 L17 7 L10 17 L3 7 Z" stroke="currentColor" strokeWidth="1.6" fill="none"/>
        <path d="M3 7 L17 7" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.5"/>
        <path d="M7 3 L5.5 7 L10 17" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4"/>
        <path d="M13 3 L14.5 7 L10 17" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4"/>
      </svg>
    );
  }

  // Redraw: Parse → Interpret → Redraw → Export
  if (feature === "redraw") {
    if (stepIdx === 0) return (
      <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
        <rect x="3" y="2" width="14" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
        <line x1="6" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="6" y1="9" x2="14" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="6" y1="12" x2="11" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="14" cy="15" r="2.5" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M13 15 L14 16 L15.5 13.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
    if (stepIdx === 1) return (
      <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
        <path d="M3 17 L8 5 L12 12 L15 8 L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <circle cx="8" cy="5" r="1.5" fill="currentColor" fillOpacity="0.4"/>
        <circle cx="15" cy="8" r="1.5" fill="currentColor" fillOpacity="0.4"/>
      </svg>
    );
    if (stepIdx === 2) return (
      <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
        <path d="M4 14 Q6 10 8 12 Q10 14 12 8 Q14 2 16 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
        <circle cx="16" cy="6" r="2" fill="currentColor" fillOpacity="0.3"/>
        <path d="M14 16 L16 14 L18 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
    return (
      <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
        <path d="M4 4 L16 4 L16 16 L4 16 Z" stroke="currentColor" strokeWidth="1.4" fill="none"/>
        <path d="M7 8 L13 8 M7 11 L11 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="15" cy="15" r="3.5" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M13.5 15 L14.5 16 L16.5 13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }

  // Default icons
  const defaultIcons = [
    // Analyze
    <svg key={0} width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8"/>
      <line x1="13.5" y1="13.5" x2="17" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>,
    // Detect
    <svg key={1} width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M3 6 L17 6 M3 10 L17 10 M3 14 L11 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>,
    // Vectorize
    <svg key={2} width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M3 15 Q7 5 10 10 Q13 15 17 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    </svg>,
    // Export
    <svg key={3} width={s} height={s} viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M7 10 L9.5 12.5 L13 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>,
  ];
  return defaultIcons[stepIdx] ?? defaultIcons[3];
}

// ── Step data ─────────────────────────────────────────────────────────────────

const STEPS_HE = [
  { until: 10,       label: "ניתוח תמונה",  desc: "AI סורק ומנתח את התמונה" },
  { until: 22,       label: "זיהוי קווים",  desc: "מזהה קווים, צורות ואובייקטים" },
  { until: 34,       label: "יצירת וקטור",  desc: "ממיר לנתיבים וקטוריים חדים" },
  { until: Infinity, label: "ייצוא DXF",    desc: "מכין את הקובץ להורדה" },
];
const STEPS_EN = [
  { until: 10,       label: "Analyzing",       desc: "AI scanning the image" },
  { until: 22,       label: "Detecting",        desc: "Finding lines, shapes & objects" },
  { until: 34,       label: "Vectorizing",      desc: "Converting to crisp vector paths" },
  { until: Infinity, label: "Exporting DXF",   desc: "Preparing your file for download" },
];

const TOTAL_SECONDS = 41;

// ── Per-feature music (Web Audio API) ────────────────────────────────────────

/** Trace: Calm ambient pads — soft sine chords, slow LFO */
function startTraceMusic(): () => void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 3);
    master.connect(ctx.destination);
    const oscs: OscillatorNode[] = [];
    // Soft Gmaj: G3 B3 D4 — very gentle sine waves, low octave
    [196.00, 246.94, 293.66].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      g.gain.value = 0.02;
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.1 + i * 0.025;
      lfoG.gain.value = freq * 0.003;
      lfo.connect(lfoG); lfoG.connect(osc.frequency); lfo.start();
      osc.connect(g); g.connect(master); osc.start();
      oscs.push(osc, lfo);
    });
    // Soft chime every 7s
    const pingTimer = setInterval(() => {
      if (ctx.state === "closed") return;
      const chimeNotes = [392.00, 493.88, 587.33, 783.99];
      const freq = chimeNotes[Math.floor(Math.random() * chimeNotes.length)];
      const p = ctx.createOscillator(); const pg = ctx.createGain();
      p.type = "sine"; p.frequency.value = freq;
      pg.gain.setValueAtTime(0, ctx.currentTime);
      pg.gain.linearRampToValueAtTime(0.022, ctx.currentTime + 0.04);
      pg.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 4);
      p.connect(pg); pg.connect(master); p.start(); p.stop(ctx.currentTime + 4);
    }, 7000);
    return () => {
      clearInterval(pingTimer);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
      setTimeout(() => { oscs.forEach(o => { try { o.stop(); } catch (_) {} }); try { ctx.close(); } catch (_) {} }, 2500);
    };
  } catch (_) { return () => {}; }
}

/** Portrait: Soft dreamy — gentle sine pads, slow breathing chord */
function startPortraitMusic(): () => void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 3);
    master.connect(ctx.destination);
    const oscs: OscillatorNode[] = [];
    // Soft Cmaj7 chord: C3 E3 G3 B3 — very low volume, sine waves only
    [130.81, 164.81, 196.00, 246.94].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = freq; g.gain.value = 0.022;
      // Very slow breathing LFO
      const lfo = ctx.createOscillator(); const lfoG = ctx.createGain();
      lfo.frequency.value = 0.08 + i * 0.02; lfoG.gain.value = freq * 0.004;
      lfo.connect(lfoG); lfoG.connect(osc.frequency); lfo.start();
      osc.connect(g); g.connect(master); osc.start();
      oscs.push(osc, lfo);
    });
    // Gentle soft bell every 6s
    const bellTimer = setInterval(() => {
      if (ctx.state === "closed") return;
      const bellNotes = [523.25, 659.25, 783.99, 1046.5];
      const freq = bellNotes[Math.floor(Math.random() * bellNotes.length)];
      const p = ctx.createOscillator(); const pg = ctx.createGain();
      p.type = "sine"; p.frequency.value = freq;
      pg.gain.setValueAtTime(0, ctx.currentTime);
      pg.gain.linearRampToValueAtTime(0.025, ctx.currentTime + 0.05);
      pg.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3.5);
      p.connect(pg); pg.connect(master); p.start(); p.stop(ctx.currentTime + 3.5);
    }, 6000);
    return () => {
      clearInterval(bellTimer);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
      setTimeout(() => { oscs.forEach(o => { try { o.stop(); } catch (_) {} }); try { ctx.close(); } catch (_) {} }, 2500);
    };
  } catch (_) { return () => {}; }
}

/** Redraw: Calm focus — soft pulsing pad with gentle harmonic movement */
function startRedrawMusic(): () => void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 2.5);
    master.connect(ctx.destination);
    const oscs: OscillatorNode[] = [];
    // Soft Fmaj chord: F3 A3 C4 — triangle waves for warmth
    [174.61, 220.00, 261.63].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = "triangle"; osc.frequency.value = freq; g.gain.value = 0.02;
      const lfo = ctx.createOscillator(); const lfoG = ctx.createGain();
      lfo.frequency.value = 0.12 + i * 0.03; lfoG.gain.value = freq * 0.003;
      lfo.connect(lfoG); lfoG.connect(osc.frequency); lfo.start();
      osc.connect(g); g.connect(master); osc.start();
      oscs.push(osc, lfo);
    });
    // Soft high note every 5s
    const noteTimer = setInterval(() => {
      if (ctx.state === "closed") return;
      const notes = [523.25, 587.33, 659.25, 698.46];
      const freq = notes[Math.floor(Math.random() * notes.length)];
      const p = ctx.createOscillator(); const pg = ctx.createGain();
      p.type = "sine"; p.frequency.value = freq;
      pg.gain.setValueAtTime(0, ctx.currentTime);
      pg.gain.linearRampToValueAtTime(0.018, ctx.currentTime + 0.1);
      pg.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 4);
      p.connect(pg); pg.connect(master); p.start(); p.stop(ctx.currentTime + 4);
    }, 5000);
    return () => {
      clearInterval(noteTimer);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
      setTimeout(() => { oscs.forEach(o => { try { o.stop(); } catch (_) {} }); try { ctx.close(); } catch (_) {} }, 2500);
    };
  } catch (_) { return () => {}; }
}

/** Default: Original ambient tones */
function startAmbientTones(accentHex: string): () => void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1.5);
    master.connect(ctx.destination);

    const r = parseInt(accentHex.slice(1, 3), 16);
    const noteFreqs = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88];
    const baseFreq = noteFreqs[r % noteFreqs.length];

    const oscs: OscillatorNode[] = [];
    [1, 1.25, 1.5].forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = baseFreq * ratio;
      g.gain.value = 0.04;
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.2 + i * 0.05;
      lfoG.gain.value = baseFreq * ratio * 0.002;
      lfo.connect(lfoG);
      lfoG.connect(osc.frequency);
      lfo.start();
      osc.connect(g);
      g.connect(master);
      osc.start();
      oscs.push(osc, lfo);
    });

    const pingTimer = setInterval(() => {
      if (ctx.state === "closed") return;
      const p = ctx.createOscillator();
      const pg = ctx.createGain();
      p.type = "sine";
      p.frequency.value = baseFreq * 2;
      pg.gain.setValueAtTime(0, ctx.currentTime);
      pg.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 0.02);
      pg.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.6);
      p.connect(pg);
      pg.connect(master);
      p.start();
      p.stop(ctx.currentTime + 1.6);
    }, 6000);

    return () => {
      clearInterval(pingTimer);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
      setTimeout(() => {
        oscs.forEach(o => { try { o.stop(); } catch (_) {} });
        try { ctx.close(); } catch (_) {}
      }, 1000);
    };
  } catch (_) {
    return () => {};
  }
}

// ── Elegant multi-ring spinner ────────────────────────────────────────────────

function ElegantSpinner({ accent, size = 120 }: { accent: string; size?: number }) {
  const c = size / 2;
  const r1 = c - 8;
  const r2 = c - 20;
  const r3 = c - 32;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="sg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.9"/>
          <stop offset="100%" stopColor={accent} stopOpacity="0.1"/>
        </linearGradient>
        <linearGradient id="sg2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.6"/>
          <stop offset="100%" stopColor={accent} stopOpacity="0.05"/>
        </linearGradient>
        <filter id="sf">
          <feGaussianBlur stdDeviation="1.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <circle cx={c} cy={c} r={r1} fill="none" stroke={accent} strokeWidth="2" strokeOpacity="0.08"/>
      <circle cx={c} cy={c} r={r2} fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.06"/>
      <circle cx={c} cy={c} r={r3} fill="none" stroke={accent} strokeWidth="1" strokeOpacity="0.06"/>
      <circle cx={c} cy={c} r={r1} fill="none" stroke="url(#sg1)" strokeWidth="3" strokeLinecap="round"
        strokeDasharray={`${r1 * 1.4} ${r1 * 5}`} filter="url(#sf)"
        style={{ animation: "spinCW 1.6s linear infinite", transformOrigin: `${c}px ${c}px` }}/>
      <circle cx={c} cy={c} r={r2} fill="none" stroke="url(#sg2)" strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray={`${r2 * 1.0} ${r2 * 5}`} filter="url(#sf)"
        style={{ animation: "spinCCW 2.4s linear infinite", transformOrigin: `${c}px ${c}px` }}/>
      <circle cx={c} cy={c} r={r3} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round"
        strokeDasharray={`${r3 * 0.7} ${r3 * 5}`} strokeOpacity="0.5"
        style={{ animation: "spinCW 3.6s linear infinite", transformOrigin: `${c}px ${c}px` }}/>
      <circle cx={c} cy={c} r="5" fill={accent} opacity="0.85"
        style={{ animation: "pulseDot 2s ease-in-out infinite", transformOrigin: `${c}px ${c}px` }}/>
      <circle cx={c} cy={c} r="10" fill={accent} opacity="0.12"
        style={{ animation: "pulseDot 2s ease-in-out infinite 0.3s", transformOrigin: `${c}px ${c}px` }}/>
    </svg>
  );
}

// ── Scan beam over image ──────────────────────────────────────────────────────

function ImageWithScan({ src, accent }: { src: string; accent: string }) {
  return (
    <div className="relative rounded-xl overflow-hidden" style={{
      width: 60, height: 60,
      border: `2px solid ${accent}30`,
      boxShadow: `0 4px 20px ${accent}20`,
      background: "#f8f9fa",
    }}>
      <img src={src} alt="" className="w-full h-full object-cover" style={{ opacity: 0.85 }}/>
      <div className="absolute left-0 right-0 pointer-events-none" style={{
        height: 3,
        background: `linear-gradient(90deg, transparent 0%, ${accent}cc 40%, ${accent} 50%, ${accent}cc 60%, transparent 100%)`,
        boxShadow: `0 0 8px ${accent}80, 0 0 16px ${accent}40`,
        animation: "scanBeam 1.8s ease-in-out infinite",
      }}/>
      {[
        { top: 4, left: 4, borderTop: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` },
        { top: 4, right: 4, borderTop: `2px solid ${accent}`, borderRight: `2px solid ${accent}` },
        { bottom: 4, left: 4, borderBottom: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` },
        { bottom: 4, right: 4, borderBottom: `2px solid ${accent}`, borderRight: `2px solid ${accent}` },
      ].map((s, i) => (
        <div key={i} className="absolute" style={{ ...s, width: 10, height: 10 }}/>
      ))}
    </div>
  );
}

// ── Music bars ────────────────────────────────────────────────────────────────

function MusicBars({ color }: { color: string }) {
  return (
    <span className="flex items-end gap-0.5" style={{ height: 12 }}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} style={{
          display: "inline-block", width: 3,
          background: color, borderRadius: 2,
          transformOrigin: "bottom",
          animation: `musicBar ${0.38 + i * 0.09}s ease-in-out infinite`,
          animationDelay: `${i * 0.07}s`,
          height: "100%",
        }}/>
      ))}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AiProcessingAnimation({
  elapsedSeconds,
  progressPct: progressPctProp,
  currentStep,
  imagePreview,
  jobId,
  onCancel,
  isRtl = false,
  accentColor = "#0d9488",
  accentGradient = "linear-gradient(135deg, #0d9488, #5eead4)",
  featureLabel = "AI",
}: AiProcessingAnimationProps) {

  const steps = isRtl ? STEPS_HE : STEPS_EN;
  const stepIndex = steps.findIndex(s => elapsedSeconds < s.until);
  const activeStep = stepIndex === -1 ? steps.length - 1 : stepIndex;
  const feature = detectFeature(featureLabel);

  // Entrance animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  // Progress: use provided pct or derive from elapsed
  const progress = progressPctProp !== undefined
    ? Math.min(99, progressPctProp)
    : Math.min(95, Math.round((elapsedSeconds / TOTAL_SECONDS) * 95));

  // Display seconds — always real elapsed, never derived from pct
  const mm = Math.floor(elapsedSeconds / 60).toString().padStart(2, "0");
  const ss = (elapsedSeconds % 60).toString().padStart(2, "0");

  // Music
  const stopMusicRef = useRef<(() => void) | null>(null);
  const [musicOn, setMusicOn] = useState(false);

  const startFeatureMusic = useCallback(() => {
    if (feature === "trace") return startTraceMusic();
    if (feature === "portrait") return startPortraitMusic();
    if (feature === "redraw") return startRedrawMusic();
    return startAmbientTones(accentColor);
  }, [feature, accentColor]);

  // Auto-start music on first user interaction after component mounts
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!stopMusicRef.current) {
        stopMusicRef.current = startFeatureMusic();
        setMusicOn(true);
      }
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
    // Try to auto-start immediately (works if user already interacted with page)
    try {
      stopMusicRef.current = startFeatureMusic();
      setMusicOn(true);
    } catch (_) {
      // Browser blocked autoplay — wait for interaction
      window.addEventListener('click', handleFirstInteraction);
      window.addEventListener('keydown', handleFirstInteraction);
      window.addEventListener('touchstart', handleFirstInteraction);
    }
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [startFeatureMusic]);

  const toggleMusic = useCallback(() => {
    if (musicOn) {
      stopMusicRef.current?.();
      stopMusicRef.current = null;
      setMusicOn(false);
    } else {
      stopMusicRef.current = startFeatureMusic();
      setMusicOn(true);
    }
  }, [musicOn, startFeatureMusic]);

  useEffect(() => () => { stopMusicRef.current?.(); }, []);

  return (
    <div
      className="relative overflow-hidden rounded-2xl flex flex-col"
      style={{
        background: "linear-gradient(145deg, #ffffff 0%, #f8faff 50%, #f0f4ff 100%)",
        minHeight: 340,
        border: `1.5px solid ${accentColor}22`,
        boxShadow: `0 8px 40px ${accentColor}12, 0 2px 8px rgba(0,0,0,0.06)`,
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0) scale(1)" : "translateY(24px) scale(0.97)",
        transition: "opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1), transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* Subtle background accent glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${accentColor}08 0%, transparent 70%)`,
      }}/>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6 pt-7 pb-6 gap-5">

        {/* Feature badge */}
        <div className="text-xs font-bold tracking-widest uppercase px-3.5 py-1 rounded-full" style={{
          color: accentColor,
          background: `${accentColor}12`,
          border: `1px solid ${accentColor}30`,
          letterSpacing: "0.12em",
        }}>
          ✦ {featureLabel} ✦
        </div>

        {/* Central visual: spinner + image preview */}
        <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
          <ElegantSpinner accent={accentColor} size={120}/>
          {imagePreview && (
            <div
              className="absolute inset-0 flex items-center justify-center"
            >
              <ImageWithScan src={imagePreview} accent={accentColor}/>
            </div>
          )}
        </div>

        {/* Current step label */}
        <div className="text-center">
          <p className="text-base font-bold" style={{ color: accentColor }}>
            {currentStep || steps[activeStep].label}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
            {steps[activeStep].desc}
          </p>
        </div>

        {/* 4-step progress track — wider nodes, unique SVG icons */}
        <div className="w-full" style={{ maxWidth: 360 }}>
          <div className="flex items-center gap-0">
            {steps.map((step, i) => {
              const isDone = i < activeStep;
              const isActive = i === activeStep;
              return (
                <div key={i} className="flex items-center" style={{ flex: i < steps.length - 1 ? 1 : "none" }}>
                  {/* Step node */}
                  <div className="flex flex-col items-center" style={{ minWidth: 50 }}>
                    <div
                      className="flex items-center justify-center rounded-full transition-all duration-500"
                      style={{
                        width: isActive ? 44 : 34,
                        height: isActive ? 44 : 34,
                        background: isDone
                          ? accentColor
                          : isActive
                            ? `${accentColor}18`
                            : "#f3f4f6",
                        border: isActive
                          ? `2.5px solid ${accentColor}`
                          : isDone
                            ? "none"
                            : "2px solid #e5e7eb",
                        boxShadow: isActive
                          ? `0 0 18px ${accentColor}50, 0 0 6px ${accentColor}30`
                          : "none",
                        color: isDone ? "white" : isActive ? accentColor : "#d1d5db",
                        transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      }}
                    >
                      {isDone ? (
                        // Checkmark for completed steps
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8L6.5 11.5L13 4.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        // Unique SVG icon per feature and step
                        <StepIconSVG feature={feature} stepIdx={i} size={isActive ? 20 : 16}/>
                      )}
                    </div>
                    <span
                      className="text-center font-medium transition-all duration-500"
                      style={{
                        color: isActive ? accentColor : isDone ? "#9ca3af" : "#d1d5db",
                        fontSize: 10,
                        maxWidth: 52,
                        lineHeight: 1.2,
                        marginTop: 5,
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                  {/* Connector line */}
                  {i < steps.length - 1 && (
                    <div className="flex-1 relative" style={{ marginBottom: 20 }}>
                      {/* Background track */}
                      <div style={{ height: 3, background: "#e5e7eb", borderRadius: 2 }}/>
                      {/* Animated fill */}
                      {isDone && (
                        <div className="absolute inset-0" style={{
                          height: 3, background: accentColor, borderRadius: 2,
                          transition: "width 0.7s ease",
                        }}/>
                      )}
                      {isActive && (
                        <div className="absolute inset-0 overflow-hidden" style={{ height: 3, borderRadius: 2 }}>
                          <div style={{
                            height: "100%", width: "40%",
                            background: `linear-gradient(90deg, transparent, ${accentColor}60)`,
                            animation: "slideRight 1.5s ease-in-out infinite",
                          }}/>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress bar — wider and more prominent */}
        <div className="w-full" style={{ maxWidth: 360 }}>
          {/* Track */}
          <div className="w-full rounded-full overflow-hidden relative" style={{ height: 10, background: "#e5e7eb" }}>
            {/* Fill */}
            <div
              className="h-full rounded-full relative overflow-hidden transition-all duration-1000 ease-out"
              style={{
                width: `${progress}%`,
                background: accentGradient,
                boxShadow: `0 0 10px ${accentColor}60, 0 2px 4px ${accentColor}30`,
              }}
            >
              {/* Shimmer */}
              <div className="absolute inset-0" style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.6s ease-in-out infinite",
              }}/>
            </div>
            {/* Glow dot at progress head */}
            <div className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out" style={{
              left: `calc(${progress}% - 6px)`,
              width: 12, height: 12,
              borderRadius: "50%",
              background: accentColor,
              boxShadow: `0 0 8px ${accentColor}, 0 0 16px ${accentColor}60`,
              opacity: progress > 2 && progress < 99 ? 1 : 0,
            }}/>
          </div>

          {/* Stats row: percentage left, time right */}
          <div className="flex justify-between mt-2 items-center">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tabular-nums" style={{ color: accentColor }}>{progress}%</span>
              <div className="h-3 w-px bg-gray-200"/>
              <span className="text-xs text-gray-400">{isRtl ? "הושלם" : "complete"}</span>
            </div>
            <div className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5" stroke="#9ca3af" strokeWidth="1.2"/>
                <path d="M6 3.5 L6 6 L8 7.5" stroke="#9ca3af" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span className="text-sm tabular-nums font-mono font-semibold" style={{ color: "#6b7280" }}>{mm}:{ss}</span>
            </div>
          </div>
        </div>

        {/* Bottom row: music + cancel */}
        <div className="flex items-center gap-2.5">
          {/* Music toggle */}
          <button
            onClick={toggleMusic}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: musicOn ? `${accentColor}15` : "#f3f4f6",
              border: `1px solid ${musicOn ? accentColor + "40" : "#e5e7eb"}`,
              color: musicOn ? accentColor : "#9ca3af",
            }}
          >
            {musicOn ? (
              <><span>🔊</span><MusicBars color={accentColor}/></>
            ) : (
              <><span>🎵</span><span>{isRtl ? "מוזיקה" : "Music"}</span></>
            )}
          </button>

          {/* Cancel + refund */}
          {jobId && onCancel && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#ef4444",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "#fee2e2";
                el.style.borderColor = "#f87171";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "#fef2f2";
                el.style.borderColor = "#fecaca";
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>{isRtl ? "בטל והחזר אסימונים" : "Cancel & refund"}</span>
            </button>
          )}
        </div>
      </div>

      {/* CSS keyframes */}
      <style>{`
        @keyframes spinCW  { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes spinCCW { from { transform: rotate(0deg); }   to { transform: rotate(-360deg); } }
        @keyframes pulseDot {
          0%, 100% { transform: scale(1);   opacity: 0.85; }
          50%       { transform: scale(1.3); opacity: 1;    }
        }
        @keyframes scanBeam {
          0%   { top: -3px;   opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: calc(100% + 3px); opacity: 0; }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        @keyframes musicBar {
          0%, 100% { transform: scaleY(0.25); }
          50%       { transform: scaleY(1);    }
        }
        @keyframes slideRight {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}
