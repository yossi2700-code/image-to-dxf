import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowRight, ArrowLeft } from "lucide-react";

export default function Terms() {
  const { isRtl } = useLanguage();
  const [, navigate] = useLocation();
  const BackIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen bg-background text-foreground" dir={isRtl ? "rtl" : "ltr"}>
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2">
            <BackIcon className="w-4 h-4" />
            {isRtl ? "חזרה לדף הבית" : "Back to Home"}
          </Button>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 prose prose-sm dark:prose-invert">
        <h1>{isRtl ? "תנאי שימוש" : "Terms of Service"}</h1>
        <p className="text-muted-foreground text-sm">
          {isRtl ? "עדכון אחרון: 28 בפברואר 2026" : "Last updated: February 28, 2026"}
        </p>

        {isRtl ? (
          <>
            <h2>1. קבלת התנאים</h2>
            <p>
              בשימוש בשירות "ממיר תמונה ל-DXF" ("השירות"), אתה מסכים לתנאי שימוש אלה. אם אינך מסכים, אנא הפסק להשתמש בשירות.
            </p>

            <h2>2. תיאור השירות</h2>
            <p>
              השירות מאפשר המרת תמונות לקבצי DXF לשימוש בחיתוך לייזר ועיבוד CNC, כולל כלי AI ליצירת קווי מתאר וקטוריים.
            </p>

            <h2>3. שימוש מותר</h2>
            <p>אתה רשאי להשתמש בשירות לצרכים אישיים ומסחריים חוקיים. אסור:</p>
            <ul>
              <li>להעלות תמונות שאינן בבעלותך או שאין לך רשות להשתמש בהן</li>
              <li>להשתמש בשירות לפעילות בלתי חוקית</li>
              <li>לנסות לפרוץ, לשבש, או לגרום נזק לשירות</li>
              <li>לבצע הנדסה לאחור של הטכנולוגיה</li>
            </ul>

            <h2>4. קניין רוחני</h2>
            <p>
              הקבצים שאתה מייצר שייכים לך. הטכנולוגיה, הקוד, ועיצוב השירות שייכים לנו ומוגנים בזכויות יוצרים.
            </p>

            <h2>5. הגבלת אחריות</h2>
            <p>
              השירות ניתן "כפי שהוא" ללא אחריות. איננו אחראים לנזקים שנגרמו משימוש בקבצים המיוצרים, לרבות נזקים לציוד לייזר או CNC.
            </p>

            <h2>6. שינויים בשירות</h2>
            <p>
              אנו שומרים את הזכות לשנות, להשעות, או להפסיק את השירות בכל עת, עם הודעה מוקדמת סבירה.
            </p>

            <h2>7. יצירת קשר</h2>
            <p>לשאלות בנוגע לתנאי שימוש אלה, צור קשר דרך דף הבית.</p>
          </>
        ) : (
          <>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By using the "Image to DXF Converter" service ("Service"), you agree to these Terms of Service. If you do not agree, please stop using the Service.
            </p>

            <h2>2. Description of Service</h2>
            <p>
              The Service allows conversion of images to DXF files for use in laser cutting and CNC machining, including AI tools for generating vector outlines.
            </p>

            <h2>3. Permitted Use</h2>
            <p>You may use the Service for lawful personal and commercial purposes. You may not:</p>
            <ul>
              <li>Upload images you do not own or have permission to use</li>
              <li>Use the Service for illegal activities</li>
              <li>Attempt to hack, disrupt, or damage the Service</li>
              <li>Reverse engineer the technology</li>
            </ul>

            <h2>4. Intellectual Property</h2>
            <p>
              Files you generate belong to you. The technology, code, and design of the Service belong to us and are protected by copyright.
            </p>

            <h2>5. Limitation of Liability</h2>
            <p>
              The Service is provided "as is" without warranty. We are not liable for damages caused by use of generated files, including damage to laser or CNC equipment.
            </p>

            <h2>6. Changes to Service</h2>
            <p>
              We reserve the right to modify, suspend, or discontinue the Service at any time with reasonable prior notice.
            </p>

            <h2>7. Contact</h2>
            <p>For questions about these Terms of Service, contact us through the homepage.</p>
          </>
        )}
      </main>
    </div>
  );
}
