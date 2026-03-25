import { FeatureLandingPage } from "./FeatureLanding";

const CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw";

const config = {
  slug: "cnc-relief",
  color: "bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50",
  badge_he: "🪵 CNC Relief",
  badge_en: "🪵 CNC Relief",
  title_he: "המר תמונה לתבליט CNC תלת-ממדי",
  title_en: "Convert Image to 3D CNC Relief",
  subtitle_he: "שלח תמונה — ה-AI יצור Heightmap מדויק לחריטת תבליט תלת-ממדי על עץ, אבן, מתכת ועוד",
  subtitle_en: "Upload an image — AI creates a precise 16-bit Heightmap for 3D relief carving on wood, stone, metal and more",
  examples: [
    {
      label_he: "אופנוע", label_en: "Motorcycle",
      desc_he: "עץ אגוז", desc_en: "Walnut Wood",
      before: `${CDN}/orig-motorcycle_e4c4f289.webp`,
      after: `${CDN}/cnc-motorcycle-walnut_ec7213ae.webp`,
    },
    {
      label_he: "מכונית ספורט", label_en: "Sports Car",
      desc_he: "אלומיניום", desc_en: "Aluminum",
      before: `${CDN}/orig-sports-car_9f17f872.webp`,
      after: `${CDN}/cnc-sports-car-aluminum_ec7d9f80.webp`,
    },
    {
      label_he: "גיטרה", label_en: "Guitar",
      desc_he: "עץ אורן", desc_en: "Pine Wood",
      before: `${CDN}/orig-guitar_eabb9155.webp`,
      after: `${CDN}/cnc-guitar-pine_4ec8f124.webp`,
    },
    {
      label_he: "ורדים", label_en: "Roses",
      desc_he: "שיש", desc_en: "Marble",
      before: `${CDN}/orig-rose-bouquet_1c69bf7c.webp`,
      after: `${CDN}/cnc-roses-marble_c15f9585.webp`,
    },
    {
      label_he: "זאב", label_en: "Wolf",
      desc_he: "נחושת", desc_en: "Copper",
      before: `${CDN}/orig-wolf_8e9f6a50.webp`,
      after: `${CDN}/cnc-wolf-copper_83d08b9a.webp`,
    },
    {
      label_he: "מנדלה", label_en: "Mandala",
      desc_he: "עץ אגוז", desc_en: "Walnut Wood",
      before: `${CDN}/before-mandala_bb9b4278.webp`,
      after: `${CDN}/cnc-mandala-walnut_47f8d152.webp`,
    },
  ],
  benefits: [
    { icon: "🗺️", title_he: "Heightmap 16-bit", title_en: "16-bit Heightmap", desc_he: "רזולוציה גבוהה לפרטים עדינים", desc_en: "High resolution for fine details" },
    { icon: "⚙️", title_he: "תואם לכל CAM", title_en: "Works with any CAM", desc_he: "Artcam, Aspire, Fusion 360 ועוד", desc_en: "Artcam, Aspire, Fusion 360 and more" },
    { icon: "🪵", title_he: "כל חומר", title_en: "Any material", desc_he: "עץ, אבן, מתכת, שיש, גרניט", desc_en: "Wood, stone, metal, marble, granite" },
    { icon: "🎨", title_he: "כל תמונה", title_en: "Any image", desc_he: "תמונות, לוגואים, פורטרטים", desc_en: "Photos, logos, portraits" },
    { icon: "📏", title_he: "שליטה בעומק", title_en: "Depth control", desc_he: "כוונן את עומק החריטה לפי החומר", desc_en: "Adjust carving depth per material" },
    { icon: "💾", title_he: "PNG 16-bit", title_en: "PNG 16-bit", desc_he: "פורמט סטנדרטי לכל תוכנת CAM", desc_en: "Standard format for all CAM software" },
  ],
  cta_he: "נסה CNC Relief חינם",
  cta_en: "Try CNC Relief Free",
};

export default function FeatureCncRelief() {
  return <FeatureLandingPage config={config} />;
}
