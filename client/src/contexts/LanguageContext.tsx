import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Language, LANGUAGES, translations, TranslationKey, detectLanguage } from "@/lib/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  dir: "rtl" | "ltr";
  isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => detectLanguage());

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("app-language", lang);
  };

  const t = (key: TranslationKey): string => {
    const langTranslations = translations[language] as Record<string, string>;
    const fallback = translations["en"] as Record<string, string>;
    return langTranslations[key] ?? fallback[key] ?? key;
  };

  const langConfig = LANGUAGES.find((l) => l.code === language);
  const dir = langConfig?.dir ?? "ltr";
  const isRtl = dir === "rtl";

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language, dir]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir, isRtl }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
