import { FeatureLandingPage } from "./FeatureLanding";

const CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw";

const config = {
  slug: "face",
  color: "bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50",
  badge_he: "🧑 Portrait DXF",
  badge_en: "🧑 Portrait DXF",
  title_he: "המר פורטרט לקובץ DXF לחריטה",
  title_en: "Convert Portrait to DXF for Engraving",
  subtitle_he: "שלח תמונת פנים — ה-AI מזהה את הפנים ומצייר 3 גרסאות קווים מדויקות לחריטה על עץ, מתכת וזכוכית",
  subtitle_en: "Upload a face photo — AI detects faces and draws 3 precise line art variations for engraving on wood, metal and glass",
  examples: [
    {
      label_he: "ילדה מתבגרת", label_en: "Teen girl",
      desc_he: "שיער מתולתל, קווים עדינים", desc_en: "Curly hair, delicate lines",
      before: `${CDN}/portrait2-teen_bb1048a7.webp`,
      after: `${CDN}/portrait-dxf-teen-v4-PXoePry5PzKQwr84US3zye_27ae1fc3.webp`,
    },
    {
      label_he: "אישה", label_en: "Woman",
      desc_he: "שיער קצר, ביטחון", desc_en: "Short hair, confidence",
      before: `${CDN}/portrait2-midwoman_0639eabc.webp`,
      after: `${CDN}/portrait-dxf-woman-v4-mfy3rkFb6YewV7z5whRfFN_ff06288f.webp`,
    },
    {
      label_he: "גבר עם זקן", label_en: "Bearded man",
      desc_he: "זקן, מבנה פנים חזק", desc_en: "Beard, strong face structure",
      before: `${CDN}/portrait2-beardman_8845c11b.webp`,
      after: `${CDN}/portrait-dxf-man-v4-WKVfnHTho32roe24MBhsh8_000b3881.webp`,
    },
    {
      label_he: "אישה מבוגרת", label_en: "Elder woman",
      desc_he: "קמטים, ביטוי עשיר", desc_en: "Wrinkles, rich expression",
      before: `${CDN}/portrait2-eldwoman_63c4142b.webp`,
      after: `${CDN}/portrait-dxf-elder-v4-UaPqSPFfVh3J3GmiFEBbF3_82a4d53f.webp`,
    },
  ],
  benefits: [
    { icon: "🤖", title_he: "זיהוי פנים אוטומטי", title_en: "Auto face detection", desc_he: "ה-AI מזהה פנים ומתאים את הציור", desc_en: "AI detects faces and adapts the drawing" },
    { icon: "3️⃣", title_he: "3 גרסאות", title_en: "3 variations", desc_he: "קבל 3 גרסאות שונות לבחירה", desc_en: "Get 3 different versions to choose from" },
    { icon: "🪵", title_he: "לחריטה על כל חומר", title_en: "Any material", desc_he: "עץ, מתכת, זכוכית, אבן", desc_en: "Wood, metal, glass, stone" },
    { icon: "🎁", title_he: "מתנה מושלמת", title_en: "Perfect gift", desc_he: "פורטרט מחורט הוא מתנה ייחודית", desc_en: "An engraved portrait is a unique gift" },
    { icon: "📐", title_he: "DXF מדויק", title_en: "Precise DXF", desc_he: "קווים נקיים לכל מכונת לייזר", desc_en: "Clean lines for any laser machine" },
    { icon: "⚡", title_he: "מהיר", title_en: "Fast", desc_he: "תוצאה תוך דקה", desc_en: "Results in under a minute" },
  ],
  cta_he: "נסה Portrait חינם",
  cta_en: "Try Portrait Free",
  imageFit: "contain" as const,
};

export default function FeaturePortrait() {
  return <FeatureLandingPage config={config} />;
}
