/**
 * SketchTest.tsx
 * Standalone test page for the Architectural Sketch → DXF feature.
 * Route: /sketch-test
 * Remove this page once the feature is merged into the main Home tabs.
 */
import { ArchitecturalSketchTab } from "@/components/ArchitecturalSketchTab";
import { useLanguage } from "@/contexts/LanguageContext";
import { Building2 } from "lucide-react";

export default function SketchTest() {
  const { isRtl } = useLanguage();

  return (
    <div
      className="min-h-screen"
      style={{ background: "#f8fafc" }}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b"
        style={{ background: "white", borderColor: "#e2e8f0" }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #0369a1, #0ea5e9)" }}
        >
          <Building2 className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm text-gray-800">
            {isRtl ? "בדיקת פיצ'ר — שרטוט אדריכלי → DXF" : "Feature Test — Architectural Sketch → DXF"}
          </p>
          <p className="text-xs text-gray-400">
            {isRtl ? "דף בדיקה זמני לפני שילוב בדף הראשי" : "Temporary test page before merging to main"}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-4 py-6">
        <ArchitecturalSketchTab
          onOpenAuth={() => {
            alert(isRtl ? "נדרשת התחברות" : "Login required");
          }}
          onInsufficientTokens={() => {
            alert(isRtl ? "אין מספיק קרדיטים" : "Insufficient credits");
          }}
        />
      </div>
    </div>
  );
}
