import { Wrench } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function MaintenancePage() {
  const { language } = useLanguage();
  const isHe = language === "he";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center space-y-6 border border-slate-200">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
            <Wrench className="w-8 h-8 text-orange-500" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-800">
            {isHe ? "האתר בתחזוקה" : "Site Under Maintenance"}
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            {isHe
              ? "אנחנו משפרים את השירות עבורך. נחזור בקרוב!"
              : "We're improving the service for you. We'll be back soon!"}
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
