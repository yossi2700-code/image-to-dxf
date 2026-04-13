/**
 * ReliefTest.tsx — דף ניסויים לפיצ'ר CNC Relief
 * נגיש בכתובת /relief-test
 * הפיצ'ר פעיל לחלוטין ללא Coming Soon
 */

import { CncReliefTab } from "@/components/CncReliefTab";
import { Mountain } from "lucide-react";

export default function ReliefTest() {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #7c3aed)" }}>
          <Mountain className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-gray-900">CNC תבליט — דף ניסויים</h1>
          <p className="text-xs text-gray-500">Relief Test Page — /relief-test</p>
        </div>
        <span className="ml-auto text-xs bg-amber-100 text-amber-700 font-bold px-2 py-1 rounded-full">
          🧪 TEST
        </span>
      </div>

      {/* Demo images */}
      <div className="max-w-xl mx-auto px-4 pt-5">
        <div className="mb-5 rounded-2xl overflow-hidden p-4 bg-white border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #7c3aed)" }}>
              <Mountain className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-800">CNC Relief — Heightmap + Simulation</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Heightmap (מפת גובה)</p>
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/cnc-daisy-heightmap-clean-5Z5GHGqUN3iKLn7TMwDSE5.webp"
                alt="CNC Heightmap example"
                className="w-full rounded-lg object-cover bg-gray-900"
                style={{ aspectRatio: "1", maxHeight: "140px", objectFit: "cover" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Simulation (הדמיית חריטה)</p>
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/cnc-daisy-wood_b87724cc.webp"
                alt="CNC Wood simulation example"
                className="w-full rounded-lg object-cover"
                style={{ aspectRatio: "1", maxHeight: "140px", objectFit: "cover" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          </div>
        </div>

        {/* The actual CncReliefTab component — testMode bypasses login requirement */}
        <CncReliefTab onInsufficientTokens={() => {}} testMode={true} />
      </div>
    </div>
  );
}
