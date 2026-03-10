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
          {isRtl ? "עדכון אחרון: 10 במרץ 2026" : "Last updated: March 10, 2026"}
        </p>

        {isRtl ? (
          <>
            <p>
              מדיניות פרטיות זו מתארת כיצד AI DXF Converter ("אנחנו", "השירות") אוסף, משתמש, ומגן על המידע שלך בהתאם לתקנת הגנת המידע האירופאית (GDPR) ולחוקי הגנת הפרטיות הרלוונטיים.
            </p>

            <h2>1. מידע שאנו אוספים</h2>
            <p><strong>מידע שאתה מספק:</strong></p>
            <ul>
              <li><strong>כתובת אימייל ושם:</strong> בעת הרשמה לשירות</li>
              <li><strong>תמונות שמועלות:</strong> מעובדות בשרת לצורך ההמרה ומאוחסנות ב-S3 לצורך ההיסטוריה שלך</li>
              <li><strong>קבצי DXF שנוצרו:</strong> מאוחסנים בענן לצורך הורדה מחדש</li>
            </ul>
            <p><strong>מידע שנאסף אוטומטית:</strong></p>
            <ul>
              <li><strong>כתובת IP:</strong> מאונימיזציה (3 אוקטטים ראשונים בלבד) לניהול מכסות</li>
              <li><strong>נתוני שימוש:</strong> סוג הפעולה, תאריך, מספר קווים שנוצרו</li>
              <li><strong>עוגיות הכרחיות:</strong> לשמירת מצב ההתחברות</li>
              <li><strong>הסכמה לתנאים:</strong> תאריך ושעה של הסכמה לתנאי השימוש, כתובת IP</li>
            </ul>

            <h2>2. בסיס חוקי לעיבוד מידע (GDPR)</h2>
            <p>אנו מעבדים את מידעך על בסיס:</p>
            <ul>
              <li><strong>הסכמה (Art. 6(1)(a)):</strong> לשיווק ולשיפור השירות</li>
              <li><strong>ביצוע חוזה (Art. 6(1)(b)):</strong> לספק את שירות ההמרה</li>
              <li><strong>אינטרס לגיטימי (Art. 6(1)(f)):</strong> לאבטחה ומניעת הונאה</li>
              <li><strong>ציות לחוק (Art. 6(1)(c)):</strong> לעמידה בדרישות חוקיות</li>
            </ul>

            <h2>3. שימוש במידע</h2>
            <p>אנו משתמשים במידע כדי:</p>
            <ul>
              <li>לספק את שירות ההמרה ולשמור היסטוריית עיצובים</li>
              <li>לנהל חשבון המשתמש ומכסות שימוש</li>
              <li>לשלוח הודעות שירות חיוניות (אימות אימייל, איפוס סיסמה)</li>
              <li>לשפר את איכות השירות ולנתח שימוש</li>
              <li>לאבטח את השירות ולמנוע שימוש לרעה</li>
            </ul>

            <h2>4. שיתוף מידע עם צדדים שלישיים</h2>
            <p>איננו מוכרים מידע אישי. אנו משתפים מידע רק עם:</p>
            <ul>
              <li><strong>OpenAI (GPT-4o):</strong> תמונות נשלחות לעיבוד AI. OpenAI אינה שומרת תמונות לאחר העיבוד לפי מדיניותה.</li>
              <li><strong>Amazon S3:</strong> אחסון קבצים מוצפן בענן</li>
              <li><strong>ספקי תשלומים:</strong> לעיבוד תשלומי קרדיטים (מוצפן, PCI-DSS compliant)</li>
              <li><strong>רשויות חוק:</strong> רק בהתאם לדרישה חוקית</li>
            </ul>

            <h2>5. אבטחת מידע</h2>
            <p>
              כל הנתונים מועברים בהצפנת TLS. קבצים מאוחסנים בהצפנת AES-256. אנו מיישמים בקרות גישה קפדניות ומבצעים ביקורות אבטחה שוטפות.
            </p>

            <h2>6. שמירת מידע</h2>
            <ul>
              <li><strong>תמונות מועלות:</strong> נשמרות עד מחיקת ההיסטוריה על ידי המשתמש</li>
              <li><strong>קבצי DXF:</strong> נשמרים עד מחיקה על ידי המשתמש</li>
              <li><strong>נתוני חשבון:</strong> נשמרים עד מחיקת החשבון + 30 יום</li>
              <li><strong>לוגים ואנליטיקה:</strong> נשמרים עד 12 חודשים</li>
              <li><strong>רשומות הסכמה:</strong> נשמרות 7 שנים לצרכים משפטיים</li>
            </ul>

            <h2>7. זכויותיך לפי GDPR</h2>
            <p>אם אתה תושב האיחוד האירופאי, יש לך את הזכויות הבאות:</p>
            <ul>
              <li><strong>זכות גישה (Art. 15):</strong> לקבל עותק של המידע שלך</li>
              <li><strong>זכות תיקון (Art. 16):</strong> לתקן מידע שגוי</li>
              <li><strong>זכות מחיקה (Art. 17):</strong> "הזכות להישכח" — מחיקת כל המידע שלך</li>
              <li><strong>זכות הגבלת עיבוד (Art. 18):</strong> להגביל כיצד אנו משתמשים במידע</li>
              <li><strong>זכות ניידות נתונים (Art. 20):</strong> לקבל את המידע בפורמט מובנה</li>
              <li><strong>זכות התנגדות (Art. 21):</strong> להתנגד לעיבוד מסוים</li>
              <li><strong>זכות לביטול הסכמה:</strong> לבטל הסכמה בכל עת</li>
            </ul>
            <p>
              לממש זכויות אלה, צור קשר דרך דף הבית. נגיב תוך 30 יום. יש לך גם זכות להגיש תלונה לרשות הגנת המידע הרלוונטית.
            </p>

            <h2>8. העברת מידע בינלאומית</h2>
            <p>
              מידע עשוי להיות מועבר ומעובד בארה"ב (שרתי OpenAI ו-Amazon). העברות אלה מתבצעות בהתאם לסעיפים חוזיים סטנדרטיים (SCCs) של הנציבות האירופאית.
            </p>

            <h2>9. עוגיות (Cookies)</h2>
            <p>אנו משתמשים בעוגיות הכרחיות בלבד:</p>
            <ul>
              <li><strong>עוגיית session:</strong> לשמירת מצב ההתחברות (httpOnly, secure)</li>
              <li><strong>עוגיית admin:</strong> לגישת מנהל (httpOnly, secure)</li>
            </ul>
            <p>אין שימוש בעוגיות פרסומיות, ניתוח, או מעקב.</p>

            <h2>10. שינויים במדיניות</h2>
            <p>
              שינויים מהותיים יפורסמו באתר עם הודעה מוקדמת של 30 יום. שימוש מתמשך לאחר כניסת שינויים לתוקף מהווה הסכמה.
            </p>

            <h2>11. יצירת קשר ו-DPO</h2>
            <p>לשאלות בנוגע לפרטיות, מחיקת מידע, או מימוש זכויות GDPR, צור קשר דרך דף הבית.</p>
          </>
        ) : (
          <>
            <p>
              This Privacy Policy describes how AI DXF Converter ("we", "Service") collects, uses, and protects your information in accordance with the European General Data Protection Regulation (GDPR) and applicable privacy laws.
            </p>

            <h2>1. Information We Collect</h2>
            <p><strong>Information you provide:</strong></p>
            <ul>
              <li><strong>Email address and name:</strong> When registering for the service</li>
              <li><strong>Uploaded images:</strong> Processed on server for conversion and stored in S3 for your history</li>
              <li><strong>Generated DXF files:</strong> Stored in cloud for re-download</li>
            </ul>
            <p><strong>Automatically collected information:</strong></p>
            <ul>
              <li><strong>IP address:</strong> Anonymized (first 3 octets only) for quota management</li>
              <li><strong>Usage data:</strong> Action type, date, number of lines generated</li>
              <li><strong>Essential cookies:</strong> To maintain login state</li>
              <li><strong>Terms consent:</strong> Date and time of consent to terms of service, IP address</li>
            </ul>

            <h2>2. Legal Basis for Processing (GDPR)</h2>
            <p>We process your data on the basis of:</p>
            <ul>
              <li><strong>Consent (Art. 6(1)(a)):</strong> For marketing and service improvement</li>
              <li><strong>Contract performance (Art. 6(1)(b)):</strong> To provide the conversion service</li>
              <li><strong>Legitimate interest (Art. 6(1)(f)):</strong> For security and fraud prevention</li>
              <li><strong>Legal compliance (Art. 6(1)(c)):</strong> To meet legal requirements</li>
            </ul>

            <h2>3. Use of Information</h2>
            <p>We use the information to:</p>
            <ul>
              <li>Provide the conversion service and save design history</li>
              <li>Manage user account and usage quotas</li>
              <li>Send essential service notifications (email verification, password reset)</li>
              <li>Improve service quality and analyze usage</li>
              <li>Secure the service and prevent abuse</li>
            </ul>

            <h2>4. Sharing Information with Third Parties</h2>
            <p>We do not sell personal information. We share information only with:</p>
            <ul>
              <li><strong>OpenAI (GPT-4o):</strong> Images are sent for AI processing. OpenAI does not retain images after processing per their policy.</li>
              <li><strong>Amazon S3:</strong> Encrypted cloud file storage</li>
              <li><strong>Payment providers:</strong> For credit payment processing (encrypted, PCI-DSS compliant)</li>
              <li><strong>Law enforcement:</strong> Only as legally required</li>
            </ul>

            <h2>5. Data Security</h2>
            <p>
              All data is transmitted with TLS encryption. Files are stored with AES-256 encryption. We implement strict access controls and conduct regular security audits.
            </p>

            <h2>6. Data Retention</h2>
            <ul>
              <li><strong>Uploaded images:</strong> Retained until user deletes history</li>
              <li><strong>DXF files:</strong> Retained until deleted by user</li>
              <li><strong>Account data:</strong> Retained until account deletion + 30 days</li>
              <li><strong>Logs and analytics:</strong> Retained up to 12 months</li>
              <li><strong>Consent records:</strong> Retained 7 years for legal purposes</li>
            </ul>

            <h2>7. Your Rights Under GDPR</h2>
            <p>If you are an EU resident, you have the following rights:</p>
            <ul>
              <li><strong>Right of access (Art. 15):</strong> To receive a copy of your data</li>
              <li><strong>Right to rectification (Art. 16):</strong> To correct inaccurate data</li>
              <li><strong>Right to erasure (Art. 17):</strong> "Right to be forgotten" — deletion of all your data</li>
              <li><strong>Right to restriction (Art. 18):</strong> To restrict how we use your data</li>
              <li><strong>Right to data portability (Art. 20):</strong> To receive data in a structured format</li>
              <li><strong>Right to object (Art. 21):</strong> To object to certain processing</li>
              <li><strong>Right to withdraw consent:</strong> To withdraw consent at any time</li>
            </ul>
            <p>
              To exercise these rights, contact us through the homepage. We will respond within 30 days. You also have the right to lodge a complaint with the relevant data protection authority.
            </p>

            <h2>8. International Data Transfers</h2>
            <p>
              Data may be transferred and processed in the USA (OpenAI and Amazon servers). These transfers are conducted in accordance with the European Commission's Standard Contractual Clauses (SCCs).
            </p>

            <h2>9. Cookies</h2>
            <p>We use only essential cookies:</p>
            <ul>
              <li><strong>Session cookie:</strong> To maintain login state (httpOnly, secure)</li>
              <li><strong>Admin cookie:</strong> For administrator access (httpOnly, secure)</li>
            </ul>
            <p>No advertising, analytics, or tracking cookies are used.</p>

            <h2>10. Changes to Policy</h2>
            <p>
              Material changes will be published on the website with 30 days' advance notice. Continued use after changes take effect constitutes acceptance.
            </p>

            <h2>11. Contact and DPO</h2>
            <p>For privacy questions, data deletion, or exercising GDPR rights, contact us through the homepage.</p>
          </>
        )}
      </main>
    </div>
  );
}
