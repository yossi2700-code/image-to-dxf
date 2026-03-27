import { FeatureLandingPage, CDN } from "./FeatureLanding";

const config = {
  slug: "trace",
  color: "bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50",
  badge_he: "🖼️ תמונה לקווים",
  badge_en: "🖼️ Image to Lines",
  title_he: "המר תמונה לקובץ DXF",
  title_en: "Convert Image to DXF",
  subtitle_he: "העלה תמונה — ה-AI יחלץ את הקווים ויצור קובץ וקטורי מדויק לחריטה ולייזר",
  subtitle_en: "Upload any image — AI extracts the lines and creates a precise vector file for engraving and laser",
  examples: [
    {
      label_he: "מצלמה", label_en: "Camera",
      desc_he: "מצלמת SLR קלאסית", desc_en: "Classic SLR camera",
      before: `${CDN}/before-camera_e61c19ce.webp`,
      after: `${CDN}/after-camera-opt_50154033.webp`,
    },
    {
      label_he: "אופניים", label_en: "Bicycle",
      desc_he: "שלדה, גלגלים, שרשרת", desc_en: "Frame, wheels, chain",
      before: `${CDN}/before-bicycle_ccd30311.webp`,
      after: `${CDN}/after-bicycle_f9116dba.webp`,
    },
    {
      label_he: "אריה", label_en: "Lion",
      desc_he: "ראש אריה עם רעמה", desc_en: "Lion head with mane",
      before: `${CDN}/before-lion_3fc83f14.webp`,
      after: `${CDN}/after-lion_9061a0f9.webp`,
    },
    {
      label_he: "מפתח ברגים", label_en: "Wrench",
      desc_he: "כלי עבודה מתכתי", desc_en: "Metal workshop tool",
      before: `${CDN}/before-wrench_2707cb1c.webp`,
      after: `${CDN}/after-wrench_8e8d740a.webp`,
    },
    {
      label_he: "מקדחה", label_en: "Drill",
      desc_he: "מקדחה חשמלית", desc_en: "Power drill",
      before: `${CDN}/before-drill_82980991.webp`,
      after: `${CDN}/after-drill_f1ef38e9.webp`,
    },
    {
      label_he: "חתול", label_en: "Cat",
      desc_he: "חתול יושב", desc_en: "Sitting cat",
      before: `${CDN}/before-cat_d5e4497a.webp`,
      after: `${CDN}/after-cat_552cb407.webp`,
    },
  ],
  benefits: [
    { icon: "📷", title_he: "כל תמונה", title_en: "Any image", desc_he: "JPG, PNG, WebP, PDF — הכל עובד", desc_en: "JPG, PNG, WebP, PDF — all work" },
    { icon: "🤖", title_he: "AI חכם", title_en: "Smart AI", desc_he: "מזהה קווים, מסיר רעש, שומר פרטים", desc_en: "Detects lines, removes noise, preserves details" },
    { icon: "📐", title_he: "DXF מדויק", title_en: "Precise DXF", desc_he: "תואם לכל תוכנת CNC ולייזר", desc_en: "Compatible with all CNC and laser software" },
    { icon: "⚙️", title_he: "שליטה מלאה", title_en: "Full control", desc_he: "כוונן רמת פירוט, עובי קו, גודל", desc_en: "Adjust detail level, line thickness, size" },
    { icon: "🎨", title_he: "מצבים שונים", title_en: "Multiple modes", desc_he: "רגיל, מפורט, סקיצה — לכל סגנון", desc_en: "Normal, detailed, sketch — for every style" },
    { icon: "💾", title_he: "שמור היסטוריה", title_en: "Save history", desc_he: "כל הקבצים שלך נשמרים בחשבון", desc_en: "All your files are saved in your account" },
  ],
  cta_he: "נסה תמונה לקווים חינם",
  cta_en: "Try Image to Lines Free",
};

export default function FeatureAiOutline() {
  return <FeatureLandingPage config={config} />;
}
