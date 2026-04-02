/**
 * ReportIssueButton
 * A small button that opens a dialog for users to report a problem with an AI result.
 * After submission, explains that tokens will be refunded after review.
 * If sourceImageUrl is a base64 data URL, it is uploaded to S3 first.
 */
import { useState } from "react";
import { Flag, CheckCircle, X, AlertCircle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

interface ReportIssueButtonProps {
  /** URL of the original source image (can be base64 data URL or S3 URL) */
  sourceImageUrl?: string;
  /** URL of the generated result image */
  resultImageUrl?: string;
  /** Feature name: portrait | ai_trace | ai_generate | convert */
  feature?: string;
  /** User action ID from the database */
  userActionId?: number;
  /** Size variant */
  size?: "sm" | "md";
}

export function ReportIssueButton({
  sourceImageUrl,
  resultImageUrl,
  feature,
  userActionId,
  size = "sm",
}: ReportIssueButtonProps) {
  const { isRtl } = useLanguage();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadSourceMutation = trpc.issueReports.uploadSourceImage.useMutation();

  const submitMutation = trpc.issueReports.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = async () => {
    if (description.trim().length < 5) return;

    let finalSourceUrl = sourceImageUrl;

    // If sourceImageUrl is a base64 data URL, upload it to S3 first
    if (sourceImageUrl && sourceImageUrl.startsWith("data:")) {
      try {
        setUploading(true);
        const result = await uploadSourceMutation.mutateAsync({ base64: sourceImageUrl });
        finalSourceUrl = result.url;
      } catch {
        // If upload fails, proceed without source image
        finalSourceUrl = undefined;
      } finally {
        setUploading(false);
      }
    }

    submitMutation.mutate({
      sourceImageUrl: finalSourceUrl,
      resultImageUrl,
      feature,
      userActionId,
      description: description.trim(),
    });
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setSubmitted(false);
      setDescription("");
      submitMutation.reset();
    }, 300);
  };

  const featureLabel = (() => {
    if (!feature) return "";
    const map: Record<string, string> = {
      portrait: isRtl ? "פורטרט AI" : "AI Portrait",
      ai_trace: isRtl ? "מעקב AI" : "AI Trace",
      ai_generate: isRtl ? "יצירת AI" : "AI Generate",
      convert: isRtl ? "המרה" : "Convert",
    };
    return map[feature] ?? feature;
  })();

  const isPending = uploading || submitMutation.isPending;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 rounded-lg transition-all hover:opacity-80 active:scale-95 ${
          size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
        }`}
        style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.2)",
          color: "#ef4444",
        }}
        title={isRtl ? "דווח על בעיה" : "Report an issue"}
      >
        <Flag className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
        <span>{isRtl ? "דווח על בעיה" : "Report issue"}</span>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
          dir={isRtl ? "rtl" : "ltr"}
        >
          <div
            className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: "#fff" }}
          >
            {/* Header */}
            <div
              className="px-5 py-4 flex items-center gap-3"
              style={{ background: "linear-gradient(135deg, #dc2626, #ef4444)", borderBottom: "none" }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "rgba(255,255,255,0.2)" }}
              >
                <Flag className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-white text-base">
                  {isRtl ? "דיווח על בעיה" : "Report an Issue"}
                </h3>
                {featureLabel && (
                  <p className="text-xs text-red-100">{featureLabel}</p>
                )}
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                style={{ color: "white", background: "none", border: "none", cursor: "pointer" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5">
              {submitted ? (
                /* Success state */
                <div className="flex flex-col items-center text-center gap-3 py-4">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ background: "#dcfce7" }}
                  >
                    <CheckCircle className="w-7 h-7" style={{ color: "#16a34a" }} />
                  </div>
                  <h4 className="font-bold text-lg" style={{ color: "#15803d" }}>
                    {isRtl ? "הדיווח נשלח!" : "Report Submitted!"}
                  </h4>
                  <p className="text-sm leading-relaxed" style={{ color: "#4b5563" }}>
                    {isRtl
                      ? "תודה על הדיווח. נבדוק את הבעיה ואם הדיווח יאושר — תקבל זיכוי אסימונים לחשבונך."
                      : "Thank you for reporting. We'll review the issue and if approved, you'll receive a token refund to your account."}
                  </p>
                  <button
                    onClick={handleClose}
                    className="mt-2 px-5 py-2 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
                    style={{ background: "#16a34a", color: "white", border: "none", cursor: "pointer" }}
                  >
                    {isRtl ? "סגור" : "Close"}
                  </button>
                </div>
              ) : (
                /* Form state */
                <div className="flex flex-col gap-4">
                  {/* Images preview */}
                  {(sourceImageUrl || resultImageUrl) && (
                    <div className="flex gap-3">
                      {sourceImageUrl && (
                        <div className="flex-1">
                          <p className="text-xs font-medium mb-1.5" style={{ color: "#6b7280" }}>
                            {isRtl ? "תמונה מקורית" : "Original Image"}
                          </p>
                          <img
                            src={sourceImageUrl}
                            alt="original"
                            className="w-full h-28 object-cover rounded-lg"
                            style={{ border: "1px solid #e5e7eb" }}
                          />
                        </div>
                      )}
                      {resultImageUrl && (
                        <div className="flex-1">
                          <p className="text-xs font-medium mb-1.5" style={{ color: "#6b7280" }}>
                            {isRtl ? "תוצאה" : "Result"}
                          </p>
                          <img
                            src={resultImageUrl}
                            alt="result"
                            className="w-full h-28 object-cover rounded-lg"
                            style={{ border: "1px solid #e5e7eb", background: "#f9fafb" }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>
                      {isRtl ? "תאר את הבעיה" : "Describe the issue"}
                      <span style={{ color: "#ef4444" }}> *</span>
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={isRtl
                        ? "לדוגמה: ה-AI הוסיף חפץ שלא קיים בתמונה המקורית..."
                        : "e.g. The AI added an object that doesn't exist in the original image..."}
                      rows={4}
                      className="w-full rounded-xl text-sm resize-none outline-none transition-all"
                      style={{
                        border: "1.5px solid #e5e7eb",
                        padding: "10px 12px",
                        color: "#111827",
                        background: "#f9fafb",
                        fontFamily: "inherit",
                      }}
                      onFocus={(e) => { e.target.style.borderColor = "#ef4444"; e.target.style.background = "#fff"; }}
                      onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#f9fafb"; }}
                    />
                    <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>
                      {description.length}/500
                    </p>
                  </div>

                  {/* Refund notice */}
                  <div
                    className="rounded-xl px-4 py-3 flex items-start gap-2.5"
                    style={{ background: "#fef3c7", border: "1px solid #fde68a" }}
                  >
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#d97706" }} />
                    <p className="text-xs leading-snug" style={{ color: "#92400e" }}>
                      {isRtl
                        ? "לאחר בדיקת הדיווח על ידי הצוות, תקבל זיכוי אסימונים אם הבעיה תאושר."
                        : "After our team reviews the report, you'll receive a token refund if the issue is approved."}
                    </p>
                  </div>

                  {/* Error */}
                  {submitMutation.error && (
                    <p className="text-sm" style={{ color: "#ef4444" }}>
                      {submitMutation.error.message}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleClose}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                      style={{ background: "#f3f4f6", color: "#374151", border: "none", cursor: "pointer" }}
                    >
                      {isRtl ? "ביטול" : "Cancel"}
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={description.trim().length < 5 || isPending}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      style={{
                        background: "linear-gradient(135deg, #dc2626, #ef4444)",
                        color: "white",
                        border: "none",
                        cursor: description.trim().length < 5 ? "not-allowed" : "pointer",
                      }}
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{isRtl ? "מעלה..." : "Uploading..."}</span>
                        </>
                      ) : (
                        <>
                          <Flag className="w-4 h-4" />
                          <span>{isRtl ? "שלח דיווח" : "Submit Report"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
