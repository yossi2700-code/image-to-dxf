import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LANGUAGES } from "@/lib/translations";
import { ChevronDown, Globe } from "lucide-react";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe className="w-3.5 h-3.5 opacity-60" />
        <span>{current.label}</span>
        <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-40 rounded-md border border-border bg-popover text-popover-foreground shadow-md py-1"
          style={{ [(language === "he" || language === "ar") ? "right" : "left"]: 0 }}
          role="listbox"
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              role="option"
              aria-selected={language === lang.code}
              onClick={() => {
                setLanguage(lang.code);
                setOpen(false);
              }}
              className={`w-full text-start px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2 ${
                language === lang.code ? "bg-accent/50 font-medium" : ""
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                language === lang.code ? "bg-primary" : "opacity-0"
              }`} />
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
