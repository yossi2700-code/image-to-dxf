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
          {isRtl ? "עדכון אחרון: 10 במרץ 2026" : "Last updated: March 10, 2026"}
        </p>

        {isRtl ? (
          <>
            <h2>1. קבלת התנאים</h2>
            <p>
              בשימוש בשירות "AI DXF Converter" ("השירות", "האתר"), אתה ("המשתמש") מסכים לתנאי שימוש אלה ולמדיניות הפרטיות שלנו. אם אינך מסכים לתנאים אלה, אנא הפסק להשתמש בשירות לאלתר. שימוש מתמשך בשירות לאחר שינויים בתנאים מהווה הסכמה לתנאים המעודכנים.
            </p>

            <h2>2. תיאור השירות</h2>
            <p>
              השירות מאפשר המרת תמונות לקבצי DXF לשימוש בחיתוך לייזר ועיבוד CNC, כולל כלי בינה מלאכותית (AI) ליצירת קווי מתאר וקטוריים, יצירת עיצובים מטקסט, ועיבוד תמונות.
            </p>

            <h2>3. שימוש מותר ואסור</h2>
            <p>אתה רשאי להשתמש בשירות לצרכים אישיים ומסחריים חוקיים. <strong>אסור לך:</strong></p>
            <ul>
              <li>להעלות תמונות שאינן בבעלותך או שאין לך רשות מפורשת להשתמש בהן</li>
              <li>להעלות תמונות המכילות תוכן פוגעני, מיני, גזעני, או בלתי חוקי</li>
              <li>להשתמש בשירות לפעילות בלתי חוקית מכל סוג</li>
              <li>לנסות לפרוץ, לשבש, לגרום נזק, או להעמיס על השרתים</li>
              <li>לבצע הנדסה לאחור של הטכנולוגיה, הקוד, או האלגוריתמים</li>
              <li>להשתמש בבוטים, כלי אוטומציה, או scraping ללא אישור מפורש</li>
              <li>לשתף אישורי גישה עם אחרים</li>
            </ul>

            <h2>4. קניין רוחני וזכויות יוצרים</h2>
            <p>
              <strong>הקבצים שאתה מייצר:</strong> קבצי DXF ו-SVG שנוצרים מתמונות שלך שייכים לך, בכפוף לזכויות היוצרים של התמונות המקוריות.
            </p>
            <p>
              <strong>הטכנולוגיה שלנו:</strong> כל הקוד, האלגוריתמים, ממשק המשתמש, העיצוב, הלוגו, ושמות המוצרים של השירות הם קניין רוחני בלעדי שלנו ומוגנים בחוקי זכויות יוצרים ופטנטים. אין לשכפל, להפיץ, או להשתמש בהם ללא אישור בכתב.
            </p>
            <p>
              <strong>תמונות שמועלות:</strong> אתה מצהיר ומתחייב שיש לך את כל הזכויות הנדרשות לתמונות שאתה מעלה. אנו לא נושאים באחריות לכל הפרת זכויות יוצרים הנובעת מהעלאת תמונות על ידך.
            </p>

            <h2>5. הגבלת אחריות</h2>
            <p>
              השירות ניתן <strong>"כפי שהוא" (AS IS)</strong> ו-<strong>"כפי שזמין" (AS AVAILABLE)</strong> ללא כל אחריות מפורשת או משתמעת, לרבות אחריות לסחירות, התאמה למטרה מסוימת, ואי-הפרה.
            </p>
            <p>
              <strong>במידה המרבית המותרת בחוק:</strong> לא נהיה אחראים לכל נזק ישיר, עקיף, מקרי, מיוחד, עונשי, או תוצאתי, לרבות:
            </p>
            <ul>
              <li>נזק לציוד לייזר, CNC, או כל ציוד אחר הנגרם משימוש בקבצים שנוצרו</li>
              <li>אובדן נתונים, הפסד עסקי, או הפסד רווחים</li>
              <li>נזקים הנגרמים מהפסקת שירות, שגיאות, או אי-דיוקים בקבצים</li>
              <li>נזקים הנגרמים מגישה בלתי מורשית לחשבונך</li>
            </ul>
            <p>
              האחריות המצטברת המרבית שלנו כלפיך לא תעלה על הסכום ששילמת לנו ב-12 החודשים האחרונים, או 50 ₪ — הגבוה מביניהם.
            </p>

            <h2>6. שיפוי (Indemnification)</h2>
            <p>
              אתה מסכים לשפות, להגן, ולהחזיק אותנו ואת מנהלינו, עובדינו, שותפינו, ונציגינו חסרי נזק מכל תביעה, נזק, אובדן, אחריות, עלות, ו/או הוצאה (לרבות שכר טרחת עורכי דין) הנובעים מ:
            </p>
            <ul>
              <li>שימושך בשירות בניגוד לתנאים אלה</li>
              <li>הפרת זכויות יוצרים או קניין רוחני של צד שלישי</li>
              <li>כל תוכן שהעלית לשירות</li>
              <li>הפרת כל חוק או תקנה רלוונטית</li>
            </ul>

            <h2>7. פרטיות ו-GDPR</h2>
            <p>
              אנו מחויבים להגנה על פרטיותך בהתאם לתקנת הגנת המידע האירופאית (GDPR) ולחוקי הגנת הפרטיות הרלוונטיים. פרטים מלאים זמינים ב<a href="/privacy">מדיניות הפרטיות</a> שלנו.
            </p>

            <h2>8. תשלומים וקרדיטים</h2>
            <p>
              חלק מהתכונות דורשות קרדיטים בתשלום. כל הרכישות הן סופיות ואינן ניתנות להחזר, אלא אם נקבע אחרת בכתב. אנו שומרים את הזכות לשנות את מחירי הקרדיטים בכל עת עם הודעה מוקדמת.
            </p>

            <h2>9. שינויים בשירות ובתנאים</h2>
            <p>
              אנו שומרים את הזכות לשנות, להשעות, או להפסיק את השירות בכל עת, עם הודעה מוקדמת סבירה. שינויים מהותיים בתנאים יפורסמו באתר ויכנסו לתוקף 30 יום לאחר פרסומם.
            </p>

            <h2>10. ברירת דין וסמכות שיפוט</h2>
            <p>
              תנאים אלה יפורשו בהתאם לחוקי מדינת ישראל. כל סכסוך יוגש לבית המשפט המוסמך בתל אביב-יפו, ישראל.
            </p>

            <h2>11. יצירת קשר</h2>
            <p>לשאלות בנוגע לתנאי שימוש אלה, צור קשר דרך דף הבית.</p>
          </>
        ) : (
          <>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By using the "AI DXF Converter" service ("Service", "Website"), you ("User") agree to these Terms of Service and our Privacy Policy. If you do not agree to these terms, please stop using the Service immediately. Continued use of the Service after changes to the terms constitutes acceptance of the updated terms.
            </p>

            <h2>2. Description of Service</h2>
            <p>
              The Service allows conversion of images to DXF files for use in laser cutting and CNC machining, including AI tools for generating vector outlines, creating designs from text, and image processing.
            </p>

            <h2>3. Permitted and Prohibited Use</h2>
            <p>You may use the Service for lawful personal and commercial purposes. <strong>You may not:</strong></p>
            <ul>
              <li>Upload images you do not own or have explicit permission to use</li>
              <li>Upload images containing offensive, sexual, racist, or illegal content</li>
              <li>Use the Service for any illegal activity</li>
              <li>Attempt to hack, disrupt, damage, or overload the servers</li>
              <li>Reverse engineer the technology, code, or algorithms</li>
              <li>Use bots, automation tools, or scraping without explicit permission</li>
              <li>Share access credentials with others</li>
            </ul>

            <h2>4. Intellectual Property and Copyright</h2>
            <p>
              <strong>Files you generate:</strong> DXF and SVG files generated from your images belong to you, subject to the copyright of the original images.
            </p>
            <p>
              <strong>Our technology:</strong> All code, algorithms, user interface, design, logo, and product names of the Service are our exclusive intellectual property and are protected by copyright and patent laws. They may not be reproduced, distributed, or used without written permission.
            </p>
            <p>
              <strong>Uploaded images:</strong> You represent and warrant that you have all necessary rights to images you upload. We bear no responsibility for any copyright infringement arising from your image uploads.
            </p>

            <h2>5. Limitation of Liability</h2>
            <p>
              The Service is provided <strong>"AS IS"</strong> and <strong>"AS AVAILABLE"</strong> without any express or implied warranties, including warranties of merchantability, fitness for a particular purpose, and non-infringement.
            </p>
            <p>
              <strong>To the maximum extent permitted by law:</strong> We shall not be liable for any direct, indirect, incidental, special, punitive, or consequential damages, including:
            </p>
            <ul>
              <li>Damage to laser, CNC, or any other equipment caused by use of generated files</li>
              <li>Loss of data, business loss, or loss of profits</li>
              <li>Damages caused by service interruption, errors, or inaccuracies in files</li>
              <li>Damages caused by unauthorized access to your account</li>
            </ul>
            <p>
              Our maximum aggregate liability to you shall not exceed the amount you paid us in the last 12 months, or $15 USD — whichever is greater.
            </p>

            <h2>6. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless us and our directors, employees, partners, and representatives from any claim, damage, loss, liability, cost, and/or expense (including attorney's fees) arising from:
            </p>
            <ul>
              <li>Your use of the Service in violation of these terms</li>
              <li>Infringement of third-party copyright or intellectual property rights</li>
              <li>Any content you uploaded to the Service</li>
              <li>Violation of any applicable law or regulation</li>
            </ul>

            <h2>7. Privacy and GDPR</h2>
            <p>
              We are committed to protecting your privacy in accordance with the European General Data Protection Regulation (GDPR) and applicable privacy laws. Full details are available in our <a href="/privacy">Privacy Policy</a>.
            </p>

            <h2>8. Payments and Credits</h2>
            <p>
              Some features require paid credits. All purchases are final and non-refundable unless otherwise stated in writing. We reserve the right to change credit prices at any time with prior notice.
            </p>

            <h2>9. Changes to Service and Terms</h2>
            <p>
              We reserve the right to modify, suspend, or discontinue the Service at any time with reasonable prior notice. Material changes to the terms will be published on the website and will take effect 30 days after publication.
            </p>

            <h2>10. Governing Law and Jurisdiction</h2>
            <p>
              These terms shall be interpreted in accordance with the laws of the State of Israel. Any dispute shall be submitted to the competent court in Tel Aviv-Jaffa, Israel.
            </p>

            <h2>11. Contact</h2>
            <p>For questions about these Terms of Service, contact us through the homepage.</p>
          </>
        )}
      </main>
    </div>
  );
}
