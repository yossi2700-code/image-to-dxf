import { useState } from "react";
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
        } else if (data.error === "QUOTA_EXCEEDED") {
          toast.error(data.message || t("quotaExceeded"));
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

          {/* Example hints */}
          <div className="flex flex-wrap gap-1.5">
            {[
              t("refineExample1"),
              t("refineExample2"),
              t("refineExample3"),
            ].map((example) => (
              <button
                key={example}
                onClick={() => setInstruction(example)}
                className="text-xs px-2.5 py-1 rounded-full bg-background border border-border hover:border-primary/40 hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
              >
                {example}
              </button>
            ))}
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
