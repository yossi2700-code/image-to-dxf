import { FeatureLandingPage } from "./FeatureLanding";

const CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw";

const config = {
  slug: "redraw",
  color: "bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50",
  badge_he: "📄 Document Redraw",
  badge_en: "📄 Document Redraw",
  title_he: "שרטוט מחדש של מסמכים טכניים",
  title_en: "Redraw Technical Documents",
  subtitle_he: "העלה תמונה של שרטוט, תוכנית או מסמך טכני — ה-AI ישרטט אותו מחדש כקובץ DXF נקי ומדויק",
  subtitle_en: "Upload a photo of a drawing, plan or technical document — AI redraws it as a clean, precise DXF file",
  examples: [
    {
      label_he: "מצלמה", label_en: "Camera",
      desc_he: "שרטוט טכני מחדש", desc_en: "Technical redraw",
      before: `${CDN}/before-camera_e61c19ce.webp`,
      after: `${CDN}/after-camera-opt_50154033.webp`,
    },
    {
      label_he: "אופניים", label_en: "Bicycle",
      desc_he: "שרטוט מפורט", desc_en: "Detailed drawing",
      before: `${CDN}/before-bicycle_ccd30311.webp`,
      after: `${CDN}/after-bicycle_f9116dba.webp`,
    },
    {
      label_he: "מפתח ברגים", label_en: "Wrench",
      desc_he: "כלי עבודה", desc_en: "Workshop tool",
      before: `${CDN}/before-wrench_2707cb1c.webp`,
      after: `${CDN}/after-wrench_8e8d740a.webp`,
    },
    {
      label_he: "מקדחה", label_en: "Drill",
      desc_he: "מקדחה חשמלית", desc_en: "Power drill",
      before: `${CDN}/before-drill_82980991.webp`,
      after: `${CDN}/after-drill_f1ef38e9.webp`,
    },
  ],
  benefits: [
    { icon: "📷", title_he: "מצלמה מספיקה", title_en: "Camera is enough", desc_he: "צלם שרטוט ישן עם הטלפון", desc_en: "Photograph an old drawing with your phone" },
    { icon: "🤖", title_he: "AI מבין שרטוטים", title_en: "AI understands drawings", desc_he: "מזהה קווים, מידות, סמלים", desc_en: "Recognizes lines, dimensions, symbols" },
    { icon: "📐", title_he: "DXF נקי", title_en: "Clean DXF", desc_he: "שרטוט מדויק ללא רעש", desc_en: "Precise drawing without noise" },
    { icon: "🔄", title_he: "שמור ישנים", title_en: "Preserve old drawings", desc_he: "הפוך שרטוטים ישנים לדיגיטליים", desc_en: "Convert old drawings to digital" },
    { icon: "⚡", title_he: "מהיר", title_en: "Fast", desc_he: "תוצאה תוך שניות", desc_en: "Results in seconds" },
    { icon: "💾", title_he: "DXF, PDF, SVG", title_en: "DXF, PDF, SVG", desc_he: "לכל תוכנת CAD ועיצוב", desc_en: "For any CAD and design software" },
  ],
  cta_he: "נסה Document Redraw חינם",
  cta_en: "Try Document Redraw Free",
};

export default function FeatureDocRedraw() {
  return <FeatureLandingPage config={config} />;
}
