import { FeatureLandingPage, CDN } from "./FeatureLanding";

const config = {
  slug: "ai",
  color: "bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50",
  badge_he: "✨ AI Create",
  badge_en: "✨ AI Create",
  title_he: "צור קובץ DXF מטקסט",
  title_en: "Generate DXF from Text",
  subtitle_he: "תאר מה אתה רוצה בעברית או אנגלית — ה-AI יצייר קווים מדויקים לחריטה, לייזר ו-CNC",
  subtitle_en: "Describe what you want in any language — AI draws precise lines for engraving, laser and CNC",
  examples: [
    { label_he: "זאב גיאומטרי", label_en: "Geometric Wolf", after: `${CDN}/ai-geometric-wolf_11ff1166.webp` },
    { label_he: "מנדלה", label_en: "Mandala", after: `${CDN}/ai-mandala-v2_12f65a94.webp` },
    { label_he: "מזלג", label_en: "Fork", after: `${CDN}/ai-fork_b54da0cd.webp` },
    { label_he: "גיטרה", label_en: "Guitar", after: `${CDN}/ai-guitar_9e84fdc5.webp` },
    { label_he: "פרפר", label_en: "Butterfly", after: `${CDN}/ai-butterfly_d8bd12e4.webp` },
    { label_he: "בית", label_en: "House", after: `${CDN}/ai-house_892017a9.webp` },
    { label_he: "אופניים", label_en: "Bicycle", after: `${CDN}/ai-bicycle-clean_05166615.webp` },
    { label_he: "סקייטבורד", label_en: "Skateboard", after: `${CDN}/ai-skateboard_56ec679e.webp` },
    { label_he: "נעל ספורט", label_en: "Sneaker", after: `${CDN}/ai-sneaker_d3ad2ab7.webp` },
  ],
  benefits: [
    { icon: "⌨️", title_he: "רק טקסט", title_en: "Text only", desc_he: "אין צורך בתמונה — פשוט תאר מה אתה רוצה", desc_en: "No image needed — just describe what you want" },
    { icon: "⚡", title_he: "מהיר", title_en: "Fast", desc_he: "תוצאה תוך שניות ספורות", desc_en: "Results in seconds" },
    { icon: "🎯", title_he: "מדויק", title_en: "Precise", desc_he: "קווים נקיים מוכנים לחריטה ולייזר", desc_en: "Clean lines ready for engraving and laser" },
    { icon: "🌍", title_he: "כל שפה", title_en: "Any language", desc_he: "עברית, אנגלית, ערבית — הכל עובד", desc_en: "Hebrew, English, Arabic — all work" },
    { icon: "📐", title_he: "פורמטים", title_en: "Formats", desc_he: "DXF, PDF, SVG — לכל תוכנת CNC", desc_en: "DXF, PDF, SVG — for any CNC software" },
    { icon: "🔄", title_he: "וריאציות", title_en: "Variations", desc_he: "קבל מספר גרסאות לבחירה", desc_en: "Get multiple versions to choose from" },
  ],
  cta_he: "נסה AI Create חינם",
  cta_en: "Try AI Create Free",
};

export default function FeatureAiCreate() {
  return <FeatureLandingPage config={config} />;
}
