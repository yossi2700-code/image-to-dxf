/**
 * SmartTemplateTab.tsx
 * Engineering Templates feature — generates precise DXF files from text descriptions.
 * Examples: playing cards, chess board, puzzle, dice, frames.
 *
 * Flow: text prompt → GPT parses params → deterministic SVG/DXF generation → download
 * Cost: 2 tokens per generation (fast, no AI image processing)
 */
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTokenCost } from "@/hooks/useTokenCost";
import { trpc } from "@/lib/trpc";
import { DxfDownloadDialog } from "@/components/DxfDownloadDialog";
import {
  Download,
  Sparkles,
  CheckCircle2,
  Layers,
  LayoutGrid,
  Dices,
  Frame,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { saveFileAs } from "@/lib/saveFileAs";

interface SmartTemplateResult {
  dxfUrl: string;
  svgPreview: string;
  svgUrl: string;
  segmentCount: number;
  filename: string;
  templateType: string;
  description: string;
}

type Status = "idle" | "loading" | "success" | "error";

interface SmartTemplateTabProps {
  onOpenAuth: () => void;
  onInsufficientTokens?: () => void;
}

const EXAMPLE_PROMPTS_HE = [
  "חבילת קלפים מלאה 52 קלפים גודל סטנדרט",
  "לוח שחמט 40×40 ס\"מ עם 8×8 משבצות",
  "פאזל 30×20 ס\"מ עם 6×4 חתיכות",
  "קוביות משחק 4 ס\"מ × 6 קוביות",
  "מסגרת תמונה 20×15 ס\"מ עובי 2 ס\"מ",
];

const EXAMPLE_PROMPTS_EN = [
  "Full playing card deck 52 cards standard size",
  "Chess board 40×40 cm with 8×8 squares",
  "Puzzle 30×20 cm with 6×4 pieces",
  "Dice 4 cm × 6 dice",
  "Picture frame 20×15 cm thickness 2 cm",
];

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  playing_cards: <Layers className="w-4 h-4" />,
  chess_board: <LayoutGrid className="w-4 h-4" />,
  puzzle: <LayoutGrid className="w-4 h-4" />,
  dice: <Dices className="w-4 h-4" />,
  frame: <Frame className="w-4 h-4" />,
};

export function SmartTemplateTab({ onOpenAuth, onInsufficientTokens }: SmartTemplateTabProps) {
  const { isRtl } = useLanguage();
  const { getCost } = useTokenCost();
  const cost = getCost("smart_template");
  const { refetch: refetchTokens } = trpc.tokens.balance.useQuery(undefined, { enabled: false });
  const { data: me } = trpc.auth.me.useQuery();

  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<SmartTemplateResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  const examples = isRtl ? EXAMPLE_PROMPTS_HE : EXAMPLE_PROMPTS_EN;

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error(isRtl ? "יש להזין תיאור" : "Please enter a description");
      return;
    }

    // Auth check
    if (!me) {
      onOpenAuth();
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    setResult(null);

    try {
      const res = await fetch("/api/smart-template/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "INSUFFICIENT_TOKENS") {
          setStatus("idle");
          onInsufficientTokens?.();
          return;
        }
        if (data.error === "UNSUPPORTED_TEMPLATE") {
          setStatus("error");
          setErrorMsg(
            isRtl
              ? `סוג לא נתמך: ${data.supportedTypes ?? ""}. נסה: קלפים, שחמט, פאזל, קוביות, מסגרת`
              : `Unsupported type: ${data.supportedTypes ?? ""}. Try: cards, chess, puzzle, dice, frame`
          );
          return;
        }
        throw new Error(data.message ?? "Generation failed");
      }

      setResult(data);
      setStatus("success");
      refetchTokens();
      toast.success(isRtl ? "הקובץ מוכן להורדה!" : "File ready to download!");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : isRtl ? "שגיאה ביצירה" : "Generation failed");
    }
  }, [prompt, me, isRtl, onOpenAuth, onInsufficientTokens, refetchTokens]);

  const handleQuickDownload = useCallback(async () => {
    if (!result) return;
    try {
      const res = await fetch(result.dxfUrl);
      const blob = await res.blob();
      await saveFileAs({ blob, filename: result.filename, mimeType: "application/dxf" });
    } catch {
      toast.error(isRtl ? "שגיאה בהורדה" : "Download failed");
    }
  }, [result, isRtl]);

  return (
    <div className="flex flex-col gap-4">
      {/* Prompt input */}
      <div
        className="rounded-2xl p-4"
        style={{ background: "#ffffff", border: "1px solid #e8eaf0", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
      >
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {isRtl ? "תאר מה אתה רוצה לחרוט / לחתוך" : "Describe what you want to engrave / cut"}
        </label>
        <textarea
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={isRtl ? "לדוגמה: חבילת קלפים מלאה 52 קלפים גודל סטנדרט" : "e.g. Full playing card deck 52 cards standard size"}
          dir={isRtl ? "rtl" : "ltr"}
          disabled={status === "loading"}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleGenerate();
          }}
        />

        {/* Examples toggle */}
        <button
          type="button"
          className="mt-2 flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
          onClick={() => setShowExamples((v) => !v)}
        >
          {showExamples ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {isRtl ? "דוגמאות" : "Examples"}
        </button>

        {showExamples && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                className="text-xs px-2.5 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                onClick={() => {
                  setPrompt(ex);
                  setShowExamples(false);
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {/* Generate button */}
        <Button
          className="w-full mt-3 font-bold text-sm py-5 rounded-xl"
          style={{
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff",
            boxShadow: "0 2px 12px rgba(99,102,241,0.3)",
          }}
          disabled={status === "loading" || !prompt.trim()}
          onClick={handleGenerate}
        >
          <Sparkles className="w-4 h-4 mr-1.5" />
          {isRtl
            ? `צור קובץ DXF הנדסי (${cost} 🪙)`
            : `Generate Engineering DXF (${cost} 🪙)`}
        </Button>
      </div>

      {/* Loading */}
      {status === "loading" && (
        <div
          className="rounded-2xl p-6 flex flex-col items-center gap-4"
          style={{ background: "#ffffff", border: "1px solid #e8eaf0", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
        >
          <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#6366f1" }} />
          <p className="text-sm font-semibold text-gray-700">
            {isRtl ? "מייצר קובץ הנדסי מדויק..." : "Generating precise engineering file..."}
          </p>
          <p className="text-xs text-gray-400">
            {isRtl ? "בדרך כלל לוקח 5-10 שניות" : "Usually takes 5-10 seconds"}
          </p>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div
          className="rounded-xl p-4 flex flex-col gap-2"
          style={{ background: "#fff5f5", border: "1px solid #fecaca" }}
        >
          <p className="text-sm font-semibold text-red-600">
            {isRtl ? "שגיאה ביצירה" : "Generation error"}
          </p>
          <p className="text-xs text-red-500">{errorMsg}</p>
          <button
            type="button"
            className="self-start text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
            onClick={() => setStatus("idle")}
          >
            {isRtl ? "נסה שוב" : "Try again"}
          </button>
        </div>
      )}

      {/* Success result */}
      {status === "success" && result && (
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: "#ffffff", border: "1px solid #e0e7ff", boxShadow: "0 1px 4px rgba(79,70,229,0.08)" }}
        >
          {/* Header */}
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
            >
              {TEMPLATE_ICONS[result.templateType] ?? <Layers className="w-4 h-4" />}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">{result.description}</p>
              <p className="text-xs text-gray-400">
                {result.segmentCount.toLocaleString()} {isRtl ? "קווים" : "lines"} · {result.filename}
              </p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />
          </div>

          {/* SVG Preview */}
          <div
            className="rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center"
            style={{ minHeight: 200, maxHeight: 320 }}
          >
            <div
              className="w-full h-full flex items-center justify-center p-3"
              dangerouslySetInnerHTML={{ __html: result.svgPreview }}
              style={{ maxHeight: 320, overflow: "hidden" }}
            />
          </div>

          {/* Download buttons */}
          <div className="flex gap-2">
            <Button
              className="flex-1 font-bold text-sm py-4 rounded-xl"
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff",
                boxShadow: "0 2px 8px rgba(99,102,241,0.25)",
              }}
              onClick={() => setDownloadOpen(true)}
            >
              <Download className="w-4 h-4 mr-1.5" />
              {isRtl ? "הורד DXF" : "Download DXF"}
            </Button>
            <Button
              variant="outline"
              className="px-4 py-4 rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50"
              onClick={() => {
                setStatus("idle");
                setResult(null);
                setPrompt("");
              }}
            >
              {isRtl ? "חדש" : "New"}
            </Button>
          </div>
        </div>
      )}

      {/* Download dialog */}
      {downloadOpen && result && (
        <DxfDownloadDialog
          open={downloadOpen}
          onClose={() => setDownloadOpen(false)}
          svgContent={result.svgPreview}
          dxfUrl={result.dxfUrl}
          svgUrl={result.svgUrl}
          defaultFilename={result.filename.replace(".dxf", "")}
          segmentCount={result.segmentCount}
        />
      )}
    </div>
  );
}
