import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Wand2, Loader2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export interface RefineResult {
  imageUrl: string;
  svgPreview: string;
  dxfUrl: string;
  dxfFilename?: string;
  segmentCount: number;
  width: number;
  height: number;
  realWidth?: number;
  realHeight?: number;
}

interface AiRefinePanelProps {
  /** The current image URL to refine */
  imageUrl: string;
  /** Optional original prompt for context */
  originalPrompt?: string;
  /** Called when refinement is complete */
  onRefined: (result: RefineResult) => void;
}

export function AiRefinePanel({ imageUrl, originalPrompt, onRefined }: AiRefinePanelProps) {
  const { t, isRtl } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Dynamic suggestions state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const fetchedPromptRef = useRef<string | null>(null);

  // Fetch dynamic suggestions when panel opens (only once per prompt)
  useEffect(() => {
    if (!isOpen) return;
    if (!originalPrompt || originalPrompt.trim().length < 2) return;
    if (fetchedPromptRef.current === originalPrompt) return; // already fetched

    fetchedPromptRef.current = originalPrompt;
    setSuggestionsLoading(true);

    const lang = isRtl ? "he" : "en";
    fetch("/api/ai-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ originalPrompt: originalPrompt.trim(), lang }),
    })
      .then((r) => r.json())
      .then((data: { suggestions?: string[] }) => {
        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
        } else {
          setSuggestions([t("refineExample1"), t("refineExample2"), t("refineExample3")]);
        }
      })
      .catch(() => {
        setSuggestions([t("refineExample1"), t("refineExample2"), t("refineExample3")]);
      })
      .finally(() => setSuggestionsLoading(false));
  }, [isOpen, originalPrompt, isRtl, t]);

  const displaySuggestions =
    suggestions.length > 0
      ? suggestions
      : [t("refineExample1"), t("refineExample2"), t("refineExample3")];

  const handleRefine = async () => {
    if (!instruction.trim() || instruction.trim().length < 3) {
      toast.error(t("refineInstructionRequired"));
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/ai-refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          instruction: instruction.trim(),
          originalPrompt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === "REGISTRATION_REQUIRED") {
          toast.error(t("registrationRequired"));
        } else if (data.error === "QUOTA_EXCEEDED" || data.error === "INSUFFICIENT_TOKENS") {
          const msg = isRtl ? (data.message || t("quotaExceeded")) : (data.messageEn || data.message || t("quotaExceeded"));
          toast.error(msg, {
            action: { label: isRtl ? "רכוש אסימונים" : "Buy Tokens", onClick: () => { window.location.href = "/tokens"; } },
            duration: 6000,
          });
        } else {
          toast.error(data.error || t("refineError"));
        }
        return;
      }

      toast.success(t("refineSuccess"));
      setInstruction("");
      setIsOpen(false);
      onRefined(data as RefineResult);
    } catch {
      toast.error(t("refineError"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="mt-3 rounded-xl border border-primary/20 bg-accent/30 overflow-hidden"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-primary hover:bg-accent/50 transition-colors"
      >
        <Sparkles className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-start">{t("refineWithAi")}</span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Refinement form */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-3 animate-slide-up">
          <p className="text-xs text-muted-foreground">{t("refineDescription")}</p>

          {/* Dynamic suggestion chips */}
          <div className="flex flex-wrap gap-1.5 min-h-[28px]">
            {suggestionsLoading ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                {isRtl ? "טוען הצעות..." : "Loading suggestions..."}
              </span>
            ) : (
              displaySuggestions.map((example) => (
                <button
                  type="button"
                  key={example}
                  onClick={() => setInstruction(example)}
                  className="text-xs px-2.5 py-1 rounded-full bg-background border border-border hover:border-primary/40 hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {example}
                </button>
              ))
            )}
          </div>

          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={t("refineInstructionPlaceholder")}
            className="min-h-[80px] text-sm resize-none"
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleRefine();
              }
            }}
          />

          <Button
            onClick={handleRefine}
            disabled={isLoading || !instruction.trim()}
            className="w-full btn-brand h-9 text-sm gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("refineProcessing")}
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                {t("refineApply")}
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            {t("refineTip")}
          </p>
        </div>
      )}
    </div>
  );
}
