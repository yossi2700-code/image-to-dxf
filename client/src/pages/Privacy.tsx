import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowRight, ArrowLeft } from "lucide-react";

export default function Privacy() {
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
        <h1>{isRtl ? "מדיניות פרטיות" : "Privacy Policy"}</h1>
        <p className="text-muted-foreground text-sm">
          {isRtl ? "עדכון אחרון: 28 בפברואר 2026" : "Last updated: February 28, 2026"}
        </p>

        {isRtl ? (
          <>
            <h2>1. מידע שאנו אוספים</h2>
            <p>אנו אוספים:</p>
            <ul>
              <li><strong>תמונות שמועלות:</strong> מעובדות בשרת ומאוחסנות זמנית לצורך ההמרה. נמחקות לאחר עיבוד.</li>
              <li><strong>קבצי DXF שנוצרו:</strong> מאוחסנים בענן לצורך הורדה מחדש מההיסטוריה.</li>
              <li><strong>נתוני שימוש:</strong> כמות המרות, סוג הפעולה, תאריך — ללא מידע מזהה אישי.</li>
              <li><strong>כתובת IP:</strong> מאונימיזציה ומשמשת לניהול מכסות שימוש.</li>
            </ul>

            <h2>2. שימוש במידע</h2>
            <p>אנו משתמשים במידע כדי:</p>
            <ul>
              <li>לספק את שירות ההמרה</li>
              <li>לשמור היסטוריית המרות (למשתמשים מחוברים)</li>
              <li>לנהל מכסות שימוש חינמי</li>
              <li>לשפר את איכות השירות</li>
            </ul>

            <h2>3. שיתוף מידע</h2>
            <p>
              איננו מוכרים או משתפים מידע אישי עם צדדים שלישיים, למעט:
            </p>
            <ul>
              <li>ספקי שירותי ענן לאחסון קבצים (מוצפן)</li>
              <li>שירות AI לעיבוד תמונות (Gemini/GPT-4o) — תמונות נשלחות לעיבוד ואינן נשמרות על ידם</li>
            </ul>

            <h2>4. אבטחת מידע</h2>
            <p>
              כל הנתונים מועברים ומאוחסנים בצורה מוצפנת. קבצים מאוחסנים בשרתי ענן מאובטחים.
            </p>

            <h2>5. זכויותיך</h2>
            <p>יש לך זכות:</p>
            <ul>
              <li>למחוק את היסטוריית ההמרות שלך</li>
              <li>לבקש מחיקת כל הנתונים הקשורים אליך</li>
            </ul>

            <h2>6. עוגיות (Cookies)</h2>
            <p>
              אנו משתמשים בעוגיות הכרחיות בלבד לשמירת מצב ההתחברות. אין שימוש בעוגיות פרסומיות.
            </p>

            <h2>7. יצירת קשר</h2>
            <p>לשאלות בנוגע לפרטיות, צור קשר דרך דף הבית.</p>
          </>
        ) : (
          <>
            <h2>1. Information We Collect</h2>
            <p>We collect:</p>
            <ul>
              <li><strong>Uploaded images:</strong> Processed on server and stored temporarily for conversion. Deleted after processing.</li>
              <li><strong>Generated DXF files:</strong> Stored in cloud for re-download from history.</li>
              <li><strong>Usage data:</strong> Number of conversions, action type, date — no personally identifiable information.</li>
              <li><strong>IP address:</strong> Anonymized and used for usage quota management.</li>
            </ul>

            <h2>2. Use of Information</h2>
            <p>We use the information to:</p>
            <ul>
              <li>Provide the conversion service</li>
              <li>Save conversion history (for logged-in users)</li>
              <li>Manage free usage quotas</li>
              <li>Improve service quality</li>
            </ul>

            <h2>3. Information Sharing</h2>
            <p>
              We do not sell or share personal information with third parties, except:
            </p>
            <ul>
              <li>Cloud storage providers for file storage (encrypted)</li>
              <li>AI service for image processing (Gemini/GPT-4o) — images are sent for processing and not stored by them</li>
            </ul>

            <h2>4. Data Security</h2>
            <p>
              All data is transmitted and stored in encrypted form. Files are stored on secure cloud servers.
            </p>

            <h2>5. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Delete your conversion history</li>
              <li>Request deletion of all data related to you</li>
            </ul>

            <h2>6. Cookies</h2>
            <p>
              We use only essential cookies to maintain login state. No advertising cookies are used.
            </p>

            <h2>7. Contact</h2>
            <p>For privacy questions, contact us through the homepage.</p>
          </>
        )}
      </main>
    </div>
  );
}
