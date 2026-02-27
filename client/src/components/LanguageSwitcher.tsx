import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
      <Button
        variant={language === "he" ? "default" : "ghost"}
        size="sm"
        className="h-7 px-2.5 text-xs font-medium"
        onClick={() => setLanguage("he")}
      >
        עב
      </Button>
      <Button
        variant={language === "en" ? "default" : "ghost"}
        size="sm"
        className="h-7 px-2.5 text-xs font-medium"
        onClick={() => setLanguage("en")}
      >
        EN
      </Button>
    </div>
  );
}
