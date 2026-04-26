/**
 * FeatureLanding — reusable landing page template for each feature.
 * Publicly accessible (no login required).
 * Shows: hero, before/after examples, benefits, and CTA.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { AuthDialog } from "@/components/AuthDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Check, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";

// ─── CDN ─────────────────────────────────────────────────────────────────────
const CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface FeatureExample {
  label_he: string;
  label_en: string;
  before?: string;
  after: string;
  desc_he?: string;
  desc_en?: string;
}

export interface FeatureBenefit {
  icon: string;
  title_he: string;
  title_en: string;
  desc_he: string;
  desc_en: string;
}

export interface FeatureLandingConfig {
  slug: string; // tab value to open on home page
  color: string; // tailwind gradient classes for hero
  badge_he: string;
  badge_en: string;
  title_he: string;
  title_en: string;
  subtitle_he: string;
  subtitle_en: string;
  examples: FeatureExample[];
  benefits: FeatureBenefit[];
  cta_he?: string;
  cta_en?: string;
  imageFit?: "cover" | "contain"; // default: "cover"; use "contain" for portrait/face images
}

// ─── Before/After Slider ─────────────────────────────────────────────────────
function BeforeAfterCard({ example, isRtl, imageFit = "cover" }: { example: FeatureExample; isRtl: boolean; imageFit?: "cover" | "contain" }) {
  // Start with "Before" (original image) so visitors immediately see the source material
  const [showAfter, setShowAfter] = useState(false);
  const imgClass = `w-full h-full transition-opacity duration-300 ${imageFit === "contain" ? "object-contain" : "object-cover"}`;
  const aspectClass = imageFit === "contain" ? "relative aspect-[3/4] bg-muted" : "relative aspect-square bg-muted";
  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-sm">
      <div className={aspectClass}>
        {example.before ? (
          <>
            {/* Preload the after image so switching is instant */}
            <link rel="preload" as="image" href={example.after} />
            <img
              src={showAfter ? example.after : example.before}
              alt={isRtl ? example.label_he : example.label_en}
              className={imgClass}
            />
            <div className="absolute bottom-3 left-3 right-3 flex gap-2">
              <button
                onClick={() => setShowAfter(false)}
                className={`flex-1 text-sm py-2 px-3 rounded-xl font-bold transition-all duration-200 border-2 ${
                  !showAfter
                    ? "bg-white text-gray-900 border-white shadow-lg scale-105"
                    : "bg-black/50 text-white/80 border-white/30 hover:bg-black/60"
                }`}
              >
                {isRtl ? "📷 לפני" : "📷 Before"}
              </button>
              <button
                onClick={() => setShowAfter(true)}
                className={`flex-1 text-sm py-2 px-3 rounded-xl font-bold transition-all duration-200 border-2 ${
                  showAfter
                    ? "bg-white text-gray-900 border-white shadow-lg scale-105"
                    : "bg-black/50 text-white/80 border-white/30 hover:bg-black/60"
                }`}
              >
                {isRtl ? "✨ אחרי" : "✨ After"}
              </button>
            </div>
          </>
        ) : (
          <img
            src={example.after}
            alt={isRtl ? example.label_he : example.label_en}
            className={imgClass}
          />
        )}
      </div>
      <div className="px-3 py-2">
        <p className="text-sm font-semibold">{isRtl ? example.label_he : example.label_en}</p>
        {(example.desc_he || example.desc_en) && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {isRtl ? example.desc_he : example.desc_en}
          </p>
        )}
      </div>
    </div>
  );
}

const LOGO_BLACK = "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/logo-dxfai_99079d72.webp";

// ─── Main Component ───────────────────────────────────────────────────────────
export function FeatureLandingPage({ config }: { config: FeatureLandingConfig }) {
  const { isRtl } = useLanguage();
  const [, navigate] = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const [examplePage, setExamplePage] = useState(0);

  const { data: me } = trpc.auth.me.useQuery();
  const isLoggedIn = !!me;

  const COLS = 3;
  const totalPages = Math.ceil(config.examples.length / COLS);
  const visibleExamples = config.examples.slice(examplePage * COLS, examplePage * COLS + COLS);

  const handleCta = () => {
    if (isLoggedIn) {
      navigate(`/?tab=${config.slug}`);
    } else {
      // Send non-logged-in users to the landing page where they can sign up / log in
      navigate("/landing");
    }
  };

  const ctaText = isRtl
    ? (config.cta_he ?? "התחל עכשיו בחינם")
    : (config.cta_en ?? "Start for Free");

  return (
    <div className="min-h-screen bg-background text-foreground" dir={isRtl ? "rtl" : "ltr"}>
      {/* ── Nav ── */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate("/landing")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {isRtl ? "חזרה" : "Back"}
          </button>
          <a href="/landing" className="flex items-center gap-2">
            <img
              src={LOGO_BLACK}
              alt="dxfai logo"
              className="h-9 w-9 rounded-xl object-cover"
            />
          </a>
          <Button size="sm" onClick={handleCta}>
            {isRtl ? "התחל" : "Start"}
          </Button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className={`${config.color} py-16 px-4`}>
        <div className="max-w-3xl mx-auto text-center">
          <Badge className="mb-4 text-sm px-3 py-1">
            {isRtl ? config.badge_he : config.badge_en}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
            {isRtl ? config.title_he : config.title_en}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto">
            {isRtl ? config.subtitle_he : config.subtitle_en}
          </p>
          <Button size="lg" onClick={handleCta} className="gap-2 text-base px-8 py-6">
            <Sparkles className="w-5 h-5" />
            {ctaText}
          </Button>
        </div>
      </section>

      {/* ── Examples ── */}
      <section className="py-14 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">
            {isRtl ? "דוגמאות" : "Examples"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {visibleExamples.map((ex, i) => (
              <BeforeAfterCard key={i} example={ex} isRtl={isRtl} imageFit={config.imageFit ?? "cover"} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-3 mt-6">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setExamplePage(p => Math.max(0, p - 1))}
                disabled={examplePage === 0}
              >
                {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </Button>
              <span className="text-sm text-muted-foreground self-center">
                {examplePage + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setExamplePage(p => Math.min(totalPages - 1, p + 1))}
                disabled={examplePage === totalPages - 1}
              >
                {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="py-14 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">
            {isRtl ? "למה להשתמש בפיצ'ר זה?" : "Why use this feature?"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {config.benefits.map((b, i) => (
              <div key={i} className="flex gap-3 items-start p-4 rounded-xl border border-border bg-card">
                <span className="text-2xl">{b.icon}</span>
                <div>
                  <p className="font-semibold text-sm">{isRtl ? b.title_he : b.title_en}</p>
                  <p className="text-xs text-muted-foreground mt-1">{isRtl ? b.desc_he : b.desc_en}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Bottom ── */}
      <section className={`${config.color} py-16 px-4 text-center`}>
        <h2 className="text-2xl font-bold mb-4">
          {isRtl ? "מוכן להתחיל?" : "Ready to start?"}
        </h2>
        <p className="text-muted-foreground mb-6">
          {isRtl ? "10 קרדיטים חינם עם הרשמה" : "10 free credits on signup"}
        </p>
        <Button size="lg" onClick={handleCta} className="gap-2 text-base px-8 py-6">
          <Sparkles className="w-5 h-5" />
          {ctaText}
        </Button>
      </section>

      {/* Auth dialog kept for logged-in flow edge cases */}
      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        onSuccess={() => { setAuthOpen(false); navigate(`/?tab=${config.slug}`); }}
      />
    </div>
  );
}

export { CDN };
