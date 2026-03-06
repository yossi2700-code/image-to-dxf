# Image to DXF Converter - TODO

- [x] פורטרט: שינוי ל-1 תמונה בכל פעם (לא 3 במקביל), עם כפתור "צייר עוד" לסגנון אחר

- [x] Install image processing libraries (sharp) and DXF generation (custom)
- [x] Build server route: accept image upload, run edge detection, generate DXF
- [x] Build tRPC procedure: convertImage (upload → process → return DXF URL)
- [x] Build Hebrew UI: drag & drop upload zone
- [x] Build Hebrew UI: image preview panel
- [x] Build Hebrew UI: threshold / sensitivity slider
- [x] Build Hebrew UI: processing status indicators (loading, ready, error)
- [x] Build Hebrew UI: download DXF button
- [x] Write vitest tests for conversion logic (11 tests passing)
- [x] Final checkpoint and publish

## פיצ'רים חדשים

- [ ] SVG vector preview: render edge segments as SVG before download
- [ ] Server: /api/generate-images endpoint using AI image generation (3 variants)
- [ ] Server: convert AI image URL to B&W line-art style prompt
- [ ] UI: AI tab with Hebrew text prompt input
- [ ] UI: 3-image gallery grid with selection state
- [ ] UI: "בקש שינויים" (request changes) flow with modification prompt
- [ ] UI: Auto-convert selected AI image to DXF with preview
- [ ] Navigation: tabs between "העלאת תמונה" and "יצירת AI"
- [ ] Tests: vitest for generate endpoint and SVG preview logic

## פיצ'רים חדשים

- [x] SVG vector preview: render edge segments as SVG before download
- [x] Server: /api/generate-images endpoint using AI image generation (3 variants)
- [x] UI: AI tab with Hebrew text prompt input
- [x] UI: 3-image gallery grid with selection state
- [x] UI: "בקש שינויים" flow with modification prompt
- [x] UI: Auto-convert selected AI image to DXF with preview
- [x] Navigation: tabs between "העלאת תמונה" and "יצירת AI"
- [x] Tests: vitest for SVG preview (15 tests passing total)

## מעקב שימוש ודשבורד ניהול

- [x] DB schema: usage_events table (type, segmentCount, ip, createdAt)
- [x] Server: log event on every /api/convert call
- [x] Server: log event on every /api/generate-images call
- [x] tRPC: admin-only stats procedure (total, by type, by day)
- [x] Admin page /admin: total conversions + AI generations cards
- [x] Admin page /admin: activity chart (last 30 days)
- [x] Admin page /admin: recent events table
- [x] Route guard: /admin accessible only to owner
- [x] Tests: vitest for anonymizeIp (20 tests passing total)
- [x] Logo: robotics & technology classic logo added to header

## גישה פשוטה לדשבורד

- [x] Replace OAuth guard on /admin with simple PIN/password stored in env secret
- [x] Add tRPC public procedure: adminLogin (check PIN, set cookie)
- [x] Admin login page: simple PIN input form in Hebrew
- [x] Admin logout button
- [x] Tests for admin auth logic (25 tests passing total)

## CNC Double-Line Mode

- [x] Update AI image generation prompt: enforce double-line closed contours, 2mm gap, no fill, CNC-ready
- [x] Update imageProcessor: add contour offset (dilation) to produce double parallel lines in DXF output
- [x] Add "double line spacing" slider (0=off, 1-12px) in UI settings for upload tab
- [x] Tests for double-line offset logic (31 tests passing total)

## באגים לתיקון

- [x] דשבורד /admin לא מציג נתוני שימוש למרות שהיו שימושים בפועל
- [x] תיקון: הוספת cookie-parser middleware לשרת כדי ש-req.cookies יאוכלס נכון

## שיפורי קו כפול

- [x] שינוי slider קו כפול מ-px למ"מ (עם שדה DPI)
- [x] הוספת תצוגה מקדימה חיה של הקו הכפול

## שמירת תמונה בדשבורד

- [x] הוספת עמודת imageUrl לטבלת usage_events
- [x] שמירת thumbnail של התמונה המקורית ל-S3 בעת המרה
- [x] הצגת thumbnail בטבלת הפעולות האחרונות בדשבורד הניהול

## מערכת הרשמה ולוגין

- [x] הוספת טבלת app_users (אימייל, סיסמא מוצפנת, Google ID)
- [x] endpoint הרשמה עם אימייל + סיסמא
- [x] endpoint לוגין עם אימייל + סיסמא
- [ ] Google OAuth לוגין/הרשמה (לשלב הבא)
- [x] JWT session לאחר הרשמה/לוגין
- [x] מגבלת 3 המרות ביום לאנונימי (לפי IP)
- [x] מגבלת 5 המרות ביום לרשום (לפי userId)
- [x] popup הרשמה כשנגמרות ההמרות לאנונימי
- [x] הצגת רשימת משתמשים רשומים בדשבורד הניהול

## שיפורי מגבלות

- [x] העלאת מגבלת רשומים מ-5 ל-10 המרות ביום
- [x] הוספת לינק ישיר להרשמה בהודעת שגיאת מגבלה

## הסרת מגבלות

- [x] הסרת בדיקת מגבלת המרות יומית מהשרת
- [x] הסרת הלינק להרשמה מהודעת שגיאה

## תיקון קו כפול

- [x] תיקון אלגוריתם קו כפול - קווים רוחביים מחברים גורמים לתוצאה מבולגנת
- [x] קו כפול צריך להיות שני קווים מקבילים אחידים ללא חיבורים

## שיפורי ברירת מחדל

- [ ] שינוי ברירת מחדל של קו כפול CNC ל-0 (כבוי)

## שיפור קו כפול לכרסום CNC

- [x] שיפור אלגוריתם: חיבור קטעים לפוליליינים רציפים לפני הוספת offset
- [x] ברירת מחדל 1.5 מ"מ לקו כפול
- [x] עדכון טקסט הסבר ב-UI לכרסום CNC
- [x] שיפור פרומפטים ל-AI Generator לייצר תמונות מתאימות לכרסום CNC
- [x] תיקון באג offset שלילי ב-offsetPolyline
- [x] 45 בדיקות עוברות (כולל 14 בדיקות חדשות לפוליליינים)

## הסרת קו כפול ושיפור AI

- [ ] הסרת slider קו כפול מה-UI לחלוטין
- [ ] הסרת פרמטר doubleLineOffset מהשרת (או השארתו ב-0 קבוע)
- [ ] שיפור פרומפטים ל-AI: קווים דקים, חלקים, פשוטים — מתאים להמרה ל-DXF

## חיבור DALL-E 3

- [x] הוספת OPENAI_API_KEY כ-secret
- [x] עדכון generateRoute להשתמש ב-DALL-E 3 API
- [x] שיפור פרומפטים: קווים דקים, חלקים, פשוטים
- [x] הסרת UI קו כפול מ-Home.tsx
- [x] המרת כל המידות למ"מ בתצוגה

## מעבר ל-GPT-4o Image Generation

- [x] עדכון generateRoute.ts להשתמש ב-gpt-image-1 במקום DALL-E 3
- [x] הסרת preprocessForEdgeDetection (gpt-image-1 מייצר קווים דקים ישירות)

## שיפורי ביצועים וUX

- [x] הגדלת simplifyTolerance ל-4 ל-AI images לקווים חלקים יותר
- [x] אינדיקטור בחירה ברור בגלריה (border + ring + checkmark גדול + עיגול ריק לבחירה)

## עתידי - אחרי מערכת התחברות

- [ ] שמירת היסטוריית עיצובים לפי שם משתמש (DB + UI)

## צמצום קווים וזום

- [x] הגדלת simplifyTolerance ל-AI images לצמצום ל-2000-4000 קווים
- [x] סינון קטעים קצרים מדי (minSegmentLength)
- [x] הוספת זום אינטראקטיבי בתצוגת SVG (pinch + כפתורים)

## תיקון קווים מקוטעים

- [x] הפעלת chainSegmentsToPolylines בכל מצב (גם ללא קו כפול) לחיבור קטעים לקווים רציפים
- [x] שיפור SVG: שימוש ב-polyline/path במקום line נפרדים לקווים חלקים יותר

## תיקון קווים כפולים

- [ ] הוספת Zhang-Suen thinning לאחר edge detection — מצמצם כל קו לרוחב פיקסל אחד

## גישה חדשה: SVG ישיר מ-GPT-4o

- [x] שינוי generateRoute: GPT-4o מייצר SVG ישיר (לא תמונה) עם קווים נקיים
- [x] כתיבת svgToDxf: המרת SVG paths לקווי DXF
- [x] עדכון UI להציג SVG ישיר

## וקטוריזציה מקצועית עם potrace

- [x] התקנת potrace + node-potrace לוקטוריזציה מקצועית של תמונות AI
- [x] שינוי generateRoute: PNG → potrace → SVG paths חלקים → DXF

## תיקוני UI

- [ ] הודעת שגיאה (banner) מסתירה כפתור הרשמה — להזיז/לתקן מיקום
- [ ] לחיצה על "הורד DXF" תפתח תצוגה מקדימה של ה-SVG במקום להוריד ישירות

## ניהול משתמשים

- [x] תיקון JSX שגיאות ב-Home.tsx + הורדת כפתור הרשמה
- [x] טבלת user_actions בDB לשמירת פעולות (המרה, יצירת AI, הורדה)
- [x] עמוד /admin עם טבלת פעולות לכל משתמש (admin בלבד)

## אימות מייל + איפוס סיסמה

- [ ] טבלאות email_verifications ו-password_resets בDB
- [ ] שליחת מייל אימות בהרשמה דרך Gmail MCP
- [ ] שליחת מייל איפוס סיסמה דרך Gmail MCP
- [ ] עמוד /verify-email לאימות מייל
- [ ] עמוד /reset-password לאיפוס סיסמה
- [ ] כפתור "שכחתי סיסמה" ב-AuthDialog

## היסטוריית שימושים

- [x] עמוד /history עם תמונות ו-SVG preview לכל פעולה
- [x] כפתור "המר מחדש" שפותח את ה-SVG/DXF מחדש
- [x] קישור להיסטוריה בדף הראשי (למשתמשים מחוברים)

## תיקון SVG preview

- [x] הסרת fill שחור מ-potrace SVG — הצגת קווים בלבד (fill=none, stroke=black)

## שיפורי AI וקבצים

- [x] 3 וריאציות שונות מה-AI (style variation per image — minimal/detailed/geometric)
- [x] שם קובץ DXF לפי ה-prompt (חנוכיה.dxf במקום ai-design-xxx.dxf)
- [x] בחירה מהיסטוריה פותחת modal תצוגה מקדימה עם SVG + הורדה

## קישור שיתוף לוואטסאפ

- [x] עמוד /share/:id עם Open Graph tags (תמונה + כותרת) לתצוגה יפה בוואטסאפ
- [x] כפתור "שתף בוואטסאפ" בתצוגה מקדימה ובהיסטוריה
- [x] DB: שמירת share token לכל עיצוב

## כפתור איפוס הגדרות המרה

- [x] כפתור "איפוס להמלצה" בהגדרות ההמרה שמחזיר threshold=128 ו-simplifyTolerance=2

## מגבלות שימוש

- [x] הוספת maxActions ל-appUsers schema (ברירת מחדל 10)
- [x] חסימת אנונימים בהמרה ובAI — הצגת הודעה להרשמה
- [x] בדיקת מכסה לפני כל פעולה — הודעת "פנה למפתח" כשעוברים
- [x] דשבורד ניהול: שינוי maxActions לכל משתמש (הגדלה/הפחתה/הסרה)

## תיקון prompt וריאציות AI

- [x] תיקון prompt: כל 3 וריאציות עם outline נקי בלבד (ללא texture, ללא פרטים קטנים)
- [x] וריאציה 1: simple clean outline, וריאציה 2: medium detail outline, וריאציה 3: decorative outline

## תיקון הודעות שגיאה OpenAI

- [x] שיפור הודעות שגיאה: QUOTA_EXCEEDED / 429 / 402 → הודעה ידידותית בעברית

## תיקונים ושיפורים - פברואר 2026

- [x] תיקון תצוגת SVG בהיסטוריה — fit-to-view אוטומטי בפתיחת dialog
- [x] תיקון zoom בהיסטוריה — תמיכה ב-touch pinch-to-zoom במובייל
- [x] הוספת כפתור מחיקה בהיסטוריה (למשתמש, לא מניהול)
- [x] עדכון הודעת מכסה — הוספת פרטי קשר מקצועיים

## הסרת כפתורים מהיסטוריה

- [x] הסרת כפתור "צור שוב" מ-DetailDialog
- [x] הסרת כפתור "שתף בוואטסאפ" מ-DetailDialog

## שיפורים חדשים - פברואר 2026 (בקשה 2)

- [x] תיקון תצוגת SVG בהיסטוריה — שיפור איכות תצוגה
- [x] DXF: גודל ברירת מחדל 50x50 ס"מ, שינוי גודל לפי אחוזים (שמירת פרופורציה)
- [x] DXF: שם קובץ מותאם אישית + בחירת מיקום שמירה
- [x] מכסה יומית: 3 ביום למשך 5 ימים, לאחר מכן חסום עם הודעת פנייה למפתח

## תיקון גודל DXF

- [x] DXF: גודל ברירת מחדל יהיה הגודל האמיתי של העיצוב (לפי viewBox ה-SVG), לא ריבוע 50x50
- [x] הצגת הגודל האמיתי ב-mm/cm בדיאלוג ההורדה
- [x] slider אחוזים ישנה את הגודל האמיתי (לא ריבוע)

## תיקון גודל אמיתי - bounding box

- [x] svgToDxf: חישוב bounding box אמיתי של כל הקטעים (לא viewBox 1024x1024)
- [x] החזרת realWidth/realHeight (גודל האובייקט בלבד, ללא שוליים ריקים)
- [x] DxfDownloadDialog: שימוש ב-realWidth/realHeight לחישוב גודל אמיתי

## תמיכה רב-לשונית (i18n)

- [x] יצירת מערכת תרגום עם קבצי עברית ואנגלית
- [x] הוספת LanguageContext ו-useLanguage hook
- [x] רכיב בחירת שפה (LanguageSwitcher) בניווט
- [x] תמיכה ב-RTL (עברית) ו-LTR (אנגלית)
- [x] תרגום Home.tsx
- [x] תרגום History.tsx
- [x] תרגום DxfDownloadDialog.tsx
- [x] תרגום App.tsx / ניווט
- [x] שמירת העדפת שפה ב-localStorage

## AI Trace - תמונה לעיצוב חריטה

- [ ] Server: aiTraceRoute.ts — קבלת תמונה, שליחה ל-GPT-4o Vision, קבלת SVG נקי
- [ ] Server: prompt מותאם לחריטה — outline נקי, ללא רקע, ללא פרטים מיותרים
- [ ] Server: המרת SVG מ-Vision ל-DXF (שימוש ב-svgToDxf הקיים)
- [ ] tRPC: procedure aiTrace (protected, בדיקת מכסה)
- [ ] UI: Tab שלישי "AI Trace" ב-Home.tsx
- [ ] UI: העלאת תמונה + preview + כפתור "צור outline"
- [ ] UI: הצגת SVG תוצאה + כפתור הורדת DXF
- [ ] תרגומים: הוספת מפתחות עברית/אנגלית ל-AI Trace
- [ ] Tests: vitest לlogic של aiTrace

## עיצוב מחדש - רמה בינלאומית

- [ ] עיצוב מערכת: פלטת צבעים חדשה, טיפוגרפיה, CSS tokens
- [ ] עיצוב מחדש Home: header, hero, tabs - מראה premium
- [ ] הוספת AI Trace tab UI + חיבור לשרת
- [ ] עיצוב מחדש History: תואם לעיצוב החדש

## AI Refine - תיקון AI לתמונה קיימת

- [ ] שרת: aiRefineRoute.ts - קבלת imageUrl + הוראת תיקון, GPT-4o image edit, החזרת SVG+DXF חדש
- [ ] UI: כפתור "בקש תיקון AI" + textarea לתיאור התיקון - מופיע אחרי כל תוצאה
- [ ] תמיכה בתיקון מכל מקור: העלאת תמונה, AI generate, AI Trace
- [ ] תרגומים לעברית ואנגלית

## AI Trace - זיהוי תמונה וציור מחדש

- [ ] UI: Tab שלישי עם העלאת תמונה + AI שמצייר outline נקי
- [ ] חיבור ל-aiTraceRoute.ts (כבר קיים בשרת)
- [x] שיפור prompt של AI Trace - תוצאות נקיות ומדויקות יותר
- [x] היסטוריה: הצגת ווקטור בלבד (ללא תמונה מקורית)

## AI Trace - שיפור Pipeline

- [x] שינוי pipeline: SVG מ-GPT-4o → render ל-PNG → potrace → DXF (כמו המרת תמונה רגילה)
- [x] שימוש ב-sharp לrender SVG ל-PNG
- [x] הרצת potrace על ה-PNG לקבלת קווים נקיים
- [x] המרת תוצאת potrace ל-DXF עם svgToDxf

## AI Trace - תיקון Prompt

- [x] שינוי prompt: זיהוי האובייקט (בשקט) + עקיבה חזותית מדויקת של מה שרואים בתמונה

## AI Trace - עיבוד מקדים שחור-לבן

- [x] המרת התמונה לשחור-לבן עם ניגודיות גבוהה לפני שליחה ל-GPT-4o
- [x] שמירת גם התמונה המקורית וגם ה-B&W לתצוגה

## היסטוריה - מחיקה

- [ ] הוספת tRPC procedure למחיקת פריט מההיסטוריה
- [ ] כפתור מחיקה בכל כרטיס היסטוריה עם אישור

## תיקון AI Trace - SVG Parse Error
- [x] תיקון פרסינג SVG - טיפול בתגובות שמתחילות בטקסט לפני ה-SVG
- [x] תיקון חילוץ תוכן ממערך array (Gemini thinking blocks)
- [x] שיפור prompt כדי להבטיח SVG נקי ללא טקסט מסביב

## AI Trace - Edge Only Mode
- [x] הוספת edge detection (Sobel + thinning) על התמונה לפני שליחה ל-GPT-4o
- [x] שינוי prompt להסביר ל-AI שהוא רואה edge map

## SEO
- [x] הוספת meta tags (description, og:title, og:image, og:description, twitter card, structured data)
- [x] robots.txt ו-sitemap.xml
- [ ] favicon מותאם

## Terms of Service & Privacy Policy
- [x] דף Terms of Service
- [x] דף Privacy Policy
- [x] קישורים ב-footer

## AI Trace - עיצוב מחדש של ה-Flow (PNG Preview + Convert to DXF)

- [x] Backend: AI רואה תמונה מקורית ומחזיר PNG שחור-לבן (ציור פיקסל, לא SVG)
- [x] Backend: endpoint נפרד להמרת PNG ל-DXF (potrace pipeline)
- [x] Frontend: הצגת PNG preview אחרי AI
- [x] Frontend: כפתור "המר ל-DXF" נפרד אחרי אישור המשתמש

## AI Trace - תיקון PNG corrupt header

- [x] תיקון: שינוי מ-invokeLLM (לא יכול לייצר תמונות) ל-generateImage API שמחזיר PNG אמיתי

## AI Trace - שיפור איכות DXF

- [x] הגדלת רזולוציה לפני potrace (upscale ל-2048px עם lanczos3)
- [x] Gaussian blur קל (0.5) + threshold 210 לפני potrace
- [x] simplifyTolerance 0.8 + minSegmentLength 1.5 לקווים חלקים יותר
- [x] הגדלת תצוגה מקדימה של ציור ה-AI ב-AiTraceTab (רוחב מלא + גובה 500px)

## AI Trace - מעבר ל-SVG pipeline (כמו יצירת AI)

- [ ] בדיקת aiRefineRoute.ts להבנת pipeline ה-SVG
- [x] עדכון prompt לקווים עבים (4-6px) לשיפור potrace

## תיקון AI Trace - קווים חלקים עם potrace

- [x] זיהוי הבעיה: convertImageToDxf משתמש ב-Sobel edge detection שמייצר קווים כפולים
- [x] תיקון: שינוי Step 2 ב-aiTraceRoute להשתמש ב-potrace ישירות (כמו generateRoute)
- [x] pipeline חדש: PNG → threshold(200) → potrace → SVG Bezier curves → svgToDxf → DXF
- [x] עדכון prompt: קווים עבים ונקיים (3-5px) לתוצאות potrace טובות יותר
- [x] 52 בדיקות עוברות

## תיקון קו יחיד - centerline tracing

- [x] אבחון: potrace מייצר קווים כפולים (filled outlines) — לא מתאים לחריטה
- [x] הוספת douglasPeucker() לimageProcessor.ts — חלקות קווים
- [x] הוספת traceCenterlines() — 8-connectivity tracing עם momentum + Douglas-Peucker
- [x] עדכון convertImageToDxf להשתמש ב-traceCenterlines במקום edgesToSegments (H/V בלבד)
- [x] עדכון aiTraceRoute Step 2 להשתמש ב-convertImageToDxf (centerline) במקום potrace
- [x] עדכון prompt: קווים דקים 1-2px (לא 3-5px) לתוצאות centerline טובות יותר
- [x] תיקון שגיאות TypeScript (הסרת potrace/svgToDxf שלא בשימוש)
- [x] 59 בדיקות עוברות (7 בדיקות חדשות לdouglasPeucker ו-traceCenterlines)

## תיקון איכות קו - potrace + centerline מ-SVG

- [x] אבחון: Sobel על קו שחור מייצר שני קווים מקבילים (שני קצות) — הבעיה האמיתית
- [x] הוספת thinBinary() — Zhang-Suen ישירות על binary (לא על Sobel output)
- [x] הוספת aiTracePipeline() — blur(1.5) + threshold(220) + thinBinary + traceCenterlines
- [x] עדכון aiTraceRoute Step 2 להשתמש ב-aiTracePipeline
- [x] 62 בדיקות עוברות (3 בדיקות חדשות ל-thinBinary)

## שיפור איכות תמונת AI

- [ ] בדיקת ה-prompt הנוכחי ב-aiTraceRoute
- [ ] עדכון prompt לתמונות נקיות יותר (קווים דקים, ללא מילוי, ללא הצללה)
- [ ] הגדלת רזולוציה של תמונת ה-AI (1024x1024 → 1792x1024 או גדול יותר)

## שיפור רזולוציה תמונת AI

- [x] הגדלת resize מ-1024 ל-2048px לפני שליחה ל-AI (API מחזיר גודל קבוע)
- [x] הגדלת preview PNG (ללא threshold שמקטין פרטים) לתצוגה ברורה — שמירת grayscale מלא לpreview
- [x] threshold מוחל רק בשלב ה-DXF conversion (Step 2), לא בתצוגה

## שיפור prompt - יותר פרטים בציור

- [x] עדכון prompt לבקש יותר קווים ופרטים (קפלים, תפרים, עומק, מרקם)

## עיצוב מחדש של AI Trace

- [x] קריאת generateRoute.ts להבנת ה-pipeline המוצלח
- [x] שינוי AI Trace: LLM (GPT-4o vision) מנתח תמונה → מייצר תיאור → gpt-image-1 מצייר 3 ווריאציות
- [x] אותו pipeline כמו Tab יצירת AI (potrace → svgToDxf)
- [x] עדכון UI ל-AiTraceTab להציג 3 ווריאציות כמו Tab יצירת AI

## תיקון תמונה חתוכה + zoom

- [x] תיקון overflow בתמונות בכרטיסי תוצאה (object-contain + aspect-ratio)
- [x] הוספת zoom/fullscreen על תמונות AI בלחיצה (modal עם ZoomIn/ZoomOut/pan)

## תיקון תצוגת וקטור

- [x] תיקון zoom בתצוגת וקטור — כפתורים גדולים (44px), SVG כ-data URL, pan תקין
- [x] הגדלת גובה תצוגת וקטור ל-450px + כפתור fullscreen

## תיקון תצוגת SVG + כפתור הצג וקטור

- [x] תיקון SVG לא מוצג ב-iOS/Safari — חזרה ל-dangerouslySetInnerHTML בשני ה-viewers
- [x] שיפור כפתור "הצג וקטור" — כפתור בולט עם border + toggle הצג/הסתר

## תיקון כפתור הצג וקטור + גובה תצוגה

- [x] כפתור "הצג/הסתר וקטור" בולט ב-Upload Tab עם border + toggle
- [x] הגבלת גובה תצוגת וקטור ל-350px, התחלה מסוגרת (false)

## תיקון SvgZoomViewer + תמונות חתוכות

- [x] כפתור "הצג/הסתר וקטור" גדול ובולט בשלושתי ה-tabs
- [x] תיקון חיתוך תמונות בכרטיסי גלריה AI — הסרת overflow-hidden מהכרטיס החיצוני

## שינויים חדשים - פברואר 2026

- [x] AI Generate tab: show AI image first by default (with fill/color), vector (lines only) shown only after clicking Show Vector button
- [x] AI Trace tab: add focus text field to specify which object to draw (default: dominant object, user can type "only chairs" etc.)

## הצעות שיפור אוטומטיות ב-AI Trace

- [x] Backend: לאחר זיהוי האובייקט, LLM מייצר 4-5 הצעות שיפור רלוונטיות (לפי סוג האובייקט)
- [x] Frontend: הצגת chips של הצעות שיפור מתחת לתוצאות ב-AI Trace
- [x] Frontend: לחיצה על chip ממלאת את שדה focusText ומפעילה trace מחדש

## תיקון הצעות שיפור AI Trace

- [x] Frontend: שליחת שפת הממשק (he/en) לשרת עם הבקשה
- [x] Backend: ייצור הצעות בשפת הממשק (עברית/אנגלית)
- [x] Backend: הצעות יכללו אובייקטים נוספים שזוהו בתמונה

## Rollback + Landscape Mode - פברואר 2026

- [x] Rollback STYLE_VARIATIONS and buildLineArtPrompt to previous working version (before "architectural" upgrade)
- [x] Add Landscape mode toggle in AI Trace tab (separate button/toggle)
- [x] Backend: landscapeMode flag in aiTraceRoute — different prompt focusing on full scene (sky, trees, buildings, foreground)
- [x] Backend: landscapeMode flag in generateRoute — same landscape-aware prompt
- [x] UI: Landscape toggle button in AI Trace and AI Generate tabs
- [x] Tests: 19 new landscape mode tests (81 total passing)

## תיקוני אבטחה - פברואר 2026

- [x] Rate Limiting על פאנל הניהול — חסימה לאחר 5 ניסיונות כושלים (15 דקות)
- [x] S3 keys — nanoid() כבר מייצר 21 תווים (126 ביט אנטרופיה), בלתי ניתן לניחוש — אין צורך בשינוי
- [x] בדיקות Rate Limiting — 9 בדיקות חדשות (90 סה"כ עוברות)

## שיפורים גדולים - מרץ 2026

- [ ] AI יצירה: תצוגת 3 תמונות לרוחב (grid), ללא פתיחת modal, ברירת מחדל
- [ ] AI יצירה: עיצוב מחדש — בהיר, קלאסי, ידידותי
- [ ] AI יצירה: שיפור פרומפט — לבקש ציור תלת-מימדי מקצועי עם עומק
- [ ] AI מתמונה: שיפור פרומפט — ציור מקצועי ואמיתי (לא ילדותי)
- [ ] הודעות שגיאה: תרגום לעברית + קישור לדף אסימונים
- [ ] דף אסימונים: מצב נוכחי, היסטוריה, כפתור הוספה עם הודעה "לדבר עם רובוטיקה וטכנולוגיה"
- [ ] היסטוריה: כפתור X גדול יותר לסגירה
- [ ] היסטוריה: כפתור "ערוך מחדש" בכרטיס
- [ ] כפתור נוף: עיצוב מחדש — ברור ונוח יותר
- [ ] דף ניהול: הצגת שם משתמש + מייל של כל רשום בטבלת המשתמשים
- [ ] תצוגה כללית: לוודא שלא נחתך תוכן ב-AI יצירה וב-AI מתמונה

## תיקוני UI דחופים - מרץ 2026

- [ ] גלריית 3 תמונות ב-AI יצירה — תצוגה מלאה במובייל, קשה לגלול. שנה ל-grid 3 עמודות קטנות
- [ ] כפתור נוף — עיצוב מסורבל, לסדר להיות toggle פשוט ונקי
- [ ] הודעות שגיאה — להציג בעברית עם קישור לדף אסימונים
- [ ] דף אסימונים — מצב נוכחי + היסטוריה + "לרכישה פנה לרובוטיקה"
- [ ] היסטוריה — כפתור X קטן מדי, להגדיל; להוסיף כפתור "ערוך מחדש"
- [ ] ניהול — להציג שם + מייל בטבלת משתמשים
- [ ] פרומפטים — לבקש מ-AI ציור יותר תלת-ממדי ומקצועי
- [ ] AI מתמונה — ציורים יוצאים ילדותיים, לשפר לסגנון מקצועי

## שיפורים שבוצעו - מרץ 2026

- [x] דף אסימונים /tokens — יתרה, היסטוריית עסקאות, כפתור "פנה לרובוטיקה וטכנולוגיה" בוואטסאפ
- [x] ניווט לדף אסימונים מהכותרת
- [x] הודעות שגיאה INSUFFICIENT_TOKENS — כפתור "רכוש אסימונים" + toast עם action
- [x] היסטוריה — כפתור X גדול יותר (w-10 h-10) בדיאלוג
- [x] היסטוריה — כפתור "ערוך מחדש" בכרטיס ובדיאלוג (טוען עיצוב לעריכה ב-AI Generate)
- [x] כפתור נוף — עיצוב מחדש כ-segmented control (Object | Landscape) בשני הטאבים
- [x] פרומפטים AI — שיפור לסגנון מקצועי תלת-ממדי (perspective, depth, volume)
- [x] AI מתמונה — שיפור פרומפטים לסגנון מקצועי (technical illustration style)
- [x] בחירת תמונה במובייל — כפתור "בחר תמונה" גדול ובולט בשני הטאבים (Upload + AI Trace)
- [x] input type="file" accept="image/*" (ללא capture) לבחירה מהגלריה

## תיקון גלריה AI יצירה - מרץ 2026

- [x] תמונות גלריה נחתכות בצד ימין במובייל — תיקון grid/overflow + תיקון פרומפט (הסרת 3/4 angle שגרם לחיתוך)

## תיקונים נוספים - מרץ 2026 (סבב 2)

- [x] קווים חתוכים בנוף — תיקון פרומפט landscape (הוספת padding/margin מפורש)
- [x] כפתור "הצג וקטור" — עיצוב בולט ויפה יותר (gradient + filled when active)
- [x] שמירת PDF — הוספה לכל הפיצרים (AI יצירה, AI מתמונה, העלאה, היסטוריה)
- [x] דיאלוג הורדה — סקאלה 10%-100% בלבד, רק מ"מ, תצוגה ברורה

## תיקון דיאלוג הורדה - מרץ 2026 (סבב 3)

- [x] היסטוריה — DxfDownloadDialog הועלה לרמה עליונה (לא בתוך דיאלוג פנימי)
- [x] AI יצירה — כפתור PDF קיים בדיאלוג (jspdf + svg2pdf)
- [x] אחידות — כל הפיצרים משתמשים באותו DxfDownloadDialog עם PDF

## תיקון העלאת תמונה AI מתמונה - מרץ 2026

- [ ] AiTraceTab — drop zone לא עובד באייפון, הוסף כפתור "בחר תמונה" ברור

## תיקון דיאלוג היסטוריה - מרץ 2026 (סבב 4)

- [x] היסטוריה — דיאלוג שמירת קובץ תוקן: כפתור ישיר בכרטיסיה + תיקון race condition ב-state

## תיקון גלריה AI יצירה - מרץ 2026 (סבב 5)

- [x] לחיצה על כרטיסיה פותחת תצוגה מקדימה במקום לסמן — תוקן: כפתור ZoomIn נפרד בפינה, לחיצה על הכרטיסיה=בחירה בלבד

## תיקון PDF - מרץ 2026 (סבב 6)

- [x] PDF ריק— תוקן: הוחלף svg2pdf ב-SVG→Canvas→PNG→jsPDF (עובד בכל דפדפן כולל iOS)
- [x] blob URL בוואצאפ — זו התנהגות סטנדרטית של הדפדפן, לא ניתן לשנות

## תיקון PDF iOS - מרץ 2026 (סבב 7)

- [x] PDF שגיאה ב-iOS — תוקן: הוחלף blob URL ב-base64 data URL (עובד ב-iOS Safari)

## תיקון PDF - מרץ 2026 (סבב 8)

- [x] PDF שגיאה ב-iOS — תוקן: חזרה ל-window.print() ב-iframe נסתר עם CSS מותאם (עובד בכל מכשיר)

## עדכון וריאציות AI יצירה - מרץ 2026

- [x] וריאציה 1 — קווים פשוטים ונקיים
- [x] וריאציה 2 — מדויק וחד עם פרטים
- [x] וריאציה 3 — קווים פרטניים ומילוי (hatching) מתאים לחריטת לייזר

## תיקון PDF - מרץ 2026 (סבב 9)

- [x] PDF לא מייצא בכלל — תוקן: הוחלף iframe ב-window.open() + קריאה סינכרונית מ-click handler

## עדכון וריאציות + פיצר חדש - מרץ 2026

- [ ] וריאציה 1 — פשוט אבל אמנותי/מקצועי (לא ילדותי)
- [ ] וריאציה 2 — טוב אבל פחות קווים
- [ ] וריאציה 3 — קצת יותר מורכב מ-2, לא מוגזם
- [ ] פיצר חדש: AI חריטה לייזר (עיבוד תמונה לחריטת לייזר)
- [ ] PDF — תיקון: לפתוח נכון ולא לשלוח רק לינק

## פיצר חדש: עריכת AI מצילום/מסמך - מרץ 2026
- [x] שרת: endpoint /api/ai-document-redraw — מקבל תמונה, מנתח עם GPT-4o Vision, מצייר מחדש כקווים נקיים
- [x] שרת: prompt מיוחד — שמירת נאמנות מקסימלית לציור המקורי (טקסט, צורות, פרטים)
- [x] שרת: גרסה אחת בלבד + אפשרות תיקון
- [x] UI: AiDocumentRedrawTab — העלאת תמונה, תצוגת תוצאה, כפתור "בקש תיקון"
- [x] UI: אפשרות "בקש תיקון" עם textarea לתיאור השינוי הרצוי
- [x] אינטגרציה: הוספת טאב חדש ל-Home.tsx
- [x] בדיקות Vitest: 9 בדיקות עוברות לשני ה-endpoints

## הסרת טאב העלאה ללא AI
- [x] הסרת TabsTrigger "upload" מ-Home.tsx
- [x] הסרת TabsContent "upload" מ-Home.tsx

## תיקון בעיית חיתוך/ריבוי קווים - מרץ 2026
- [ ] תיקון prompt וריאציה 3 — ללא hatching/texture/crosshatch, קווים נקיים בלבד
- [ ] תיקון כל 3 וריאציות — הגבלת מספר קווים מקסימלי
- [ ] שיפור preprocessing ב-sharp לפני potrace — סף threshold גבוה יותר לדחיית אפור
- [ ] הגדלת simplifyTolerance ל-AI images לצמצום קווים
- [ ] הוספת מגבלת maxSegments לאחר potrace

## תיקון חיתוך תמונות AI - מרץ 2026
- [x] חיזוק אילוץ "fit inside frame" בכל ה-prompts (generateRoute + aiDocumentRedrawRoute)
- [x] הוספת padding ב-sharp לאחר יצירת התמונה (8% שוליים) לפני potrace
- [x] בדיקה: כל הוריאציות + landscape mode

## שיפור היסטוריה - קיבוץ וריאציות + חיפוש + עריכה מחדש
- [ ] הוספת עמודת groupId לטבלת user_actions בDB
- [ ] עדכון generateRoute: שמירת כל 3 וריאציות עם אותו groupId
- [ ] עדכון History.tsx: קיבוץ לפי groupId (כרטיס אחד עם 3 תמונות)
- [ ] הוספת שורת חיפוש בהיסטוריה (לפי תיאור/prompt)
- [ ] כפתור "ערוך מחדש" שפותח את הבקשה חזרה בטאב AI יצירה

## שינוי צבע טאב AI מתמונה
- [x] שינוי צבע טאב "AI מתמונה" לירוק-טיל (teal-emerald) — שונה מהכתום של "AI מסמך" ומהסגול של "AI יצירה"

## עיצוב פנים טאב AI מתמונה + תיקון ניהול
- [x] צביעת כפתורים/גבולות/drop zone ב-AiTraceTab בירוק-טיל (teal-emerald) — 23 שינויים
- [ ] תיקון מסך ניהול — הגדרות לא נראות בדסקטופ (פאנל Management UI של Manus — לא קשור לקוד)

## תיקון שם קובץ DXF ארוך מדי
- [x] קיצור שם קובץ DXF — מקסימום 15 תווים, נלקח 1-2 מילים ראשונות בלבד

## שיפור AI מסמך — חילוץ איורים בלבד
- [ ] שינוי prompt ב-aiDocumentRedrawRoute: לזהות ולחלץ רק איורים/פרחים/עיטורים, לא טקסט ולא רקע
- [ ] הוספת שלב זיהוי "האם יש איורים?" לפני הציור מחדש
- [ ] UI: הסבר למשתמש שה-AI מחפש איורים/עיטורים בלבד

## תמונות הדגמה מעל כל טאב
- [x] יצירת 3 תמונות הדגמה (AI יצירה, AI מתמונה עם LV לפני/אחרי, AI מסמך)
- [x] העלאה ל-CDN
- [x] הוספת תמונות מעל כל טאב ב-Home.tsx

## יישום הצעות - מרץ 2026
- [x] תמונת הדגמה מציאותית לטאב AI מסמך — מצבה עם פרחים → קווי עיטור מחולצים
- [x] הצגת "לפני/אחרי" בתוצאת AI מסמך — כפתור toggle + תצוגה צד בצד
- [x] שמירת תוצאות AI מסמך להיסטוריה — groupId + variationLabel: document-redraw

## הסרת מילה "מצבה" + תמונת הדגמה חדשה
- [x] הסרת המילה "מצבה" מכל הטקסטים ב-AiDocumentRedrawTab ו-Home.tsx
- [x] תמונת הדגמה חדשה: תעודה עם טקסט אנגלי + ורד → AI מחלץ רק את הורד כקווים נקיים

## שדרוג עיצוב כללי + תמונת הדגמה מקצועית
- [ ] תמונת הדגמה חדשה ברמה גבוהה לטאב AI מסמך
- [ ] שדרוג עיצוב כללי של האפליקציה — מראה פרימיום ומקצועי

## תיקון לוגיקת AI מסמך + שדרוג עיצוב
- [ ] תיקון prompt — חלץ את כל האיורים/עיטורים (לא רק אחד), אם פרח אחד — חלץ רק אותו
- [ ] שדרוג עיצוב כללי — dark premium theme עם glassmorphism
- [ ] תמונת הדגמה חדשה ומקצועית יותר

## שדרוג עיצוב ותיקון AI - מרץ 2026

- [x] שדרוג עיצוב כללי לממשק כהה פרימיום עם glassmorphism
- [x] שדרוג AiTraceTab לעיצוב כהה (כרטיסי תוצאות, כפתורים, הצעות)
- [x] שדרוג AiDocumentRedrawTab לעיצוב כהה (העלאה, תוצאות, תיקון)
- [x] שדרוג AiGeneratorTab לעיצוב כהה
- [x] תיקון פרומפט LLM לזיהוי כל האלמנטים בתמונה (עיטורים, פרחים, מסגרות)
- [x] תיקון פרומפט יצירת תמונה לשמירת כל הרכב העיטורים
- [x] יצירת תמונת דמו חדשה ומשופרת לכרטיסיית AI מסמך (לפני/אחרי)

## תיקון חיתוך שוליים ב-AI יצירה

- [x] תיקון: עיצוב AI נחתך בשוליים למעלה/למטה — הדמות לא נכנסת בשלמותה לתמונה
- [x] שיפור פרומפטים: הוסף הוראה מפורשת שהדמות חייבת להיות שלמה עם שוליים גדולים (17% מכל צד)
- [x] שיפור imageProcessor: padding 140px למעלה/למטה ו-100px לצדדים לפני המרה ל-DXF

## עיצוב קלאסי בהיר + דוגמאות AI - מרץ 2026

- [x] שינוי עיצוב מכהה לקלאסי בהיר (לבן/אפור בהיר, גבולות עדינים)
- [x] יצירת 2 תמונות דמו AI נוספות לגלריה (מנורה + אריה)
- [x] הוספת הדוגמאות החדשות לגלריית הדמו ב-UI (3 דוגמאות: מגן דוד, מנורה, אריה)
- [x] יצירת תמונת דמו "פרח ממסמך" לכרטיסיית AI מסמך (לפני: צילום מסמך עם פרח, אחרי: קו נקי)
- [x] הוספת הדוגמה לגלריית AI מסמך ב-UI

## תיקון כתיב עברי ב-AI יצירה - מרץ 2026
- [x] עדכון פרומפט generateRoute: הוסף הוראה מפורשת לכתיבת טקסט עברי מדויק ללא שגיאות כתיב (זיהוי אוטומטי של עברית + הוראת letter-by-letter)

## תיקון שיתוף קובץ DXF - מרץ 2026
- [x] תיקון שיתוף: שליחת הקובץ עצמו (DXF) ולא קישור לאתר
- [x] שימוש ב-Web Share API עם File object (navigator.share עם files[]) — פותח native share sheet ב-iOS
- [x] fallback: SVG אם DXF לא נתמך, ו-URL אם גם SVG לא נתמך

## תיקון PDF - מרץ 2026
- [x] החלפת "ייצא PDF" מחלון הדפסה לקובץ PDF אמיתי (jsPDF + svg2pdf.js)
- [x] הוספת כפתור "שתף PDF (WhatsApp / AirDrop)" עם Web Share API

## תיקון עיצוב דסקטופ - מרץ 2026
- [x] תיקון header חופף תוכן
- [x] תיקון כרטיסיות לא נראות/לא עובדות — נראות ועובדות
- [x] תיקון layout שבור במסכים רחבים — תוכן מרוכז ב-780px max-width
- [x] תיקון צבעי כהים שנשארו בפאנל השינויים ובסטטיסטיקות
## אנימציית סורק + תיקון פרופורציות - מרץ 2026
- [x] הוספת אנימציית סורק (קו עובר על התמונה) בזמן עיבוד AI מסמך
- [x] תיקון פרופורציות: שמירה על יחס גובה/רוחב מקורי (לא תמיד מרובע)
- [x] שיפור פרומפט לדיוק מקסימלי: שמירת זוויות, גדלים, ופרטי הציור בלי טקסט

## עיבוד ברקע + ביטול + החזר אסימונים - מרץ 2026
- [x] עיבוד job-based בשרת: העיבוד ממשיך גם אם המשתמש יוצא מהאפליקציה
- [x] כפתור ביטול עיבוד שמחזיר אסימונים
- [x] polling מהלקוח לבדיקת סטאטוס ה-job

## עיבוד ברקע + ביטול בכל הפיצ'רים - מרץ 2026
- [ ] AI יצירה: job-based background processing + כפתור ביטול + החזר אסימונים
- [ ] AI מתמונה: job-based background processing + כפתור ביטול + החזר אסימונים
- [ ] עדכון UI: polling + כפתור ביטול + אנימציית סורק ב-AI יצירה ו-AI מתמונה

## שיפור דיוק AI מסמך - תיאור צורה + מיקום מדויק - מרץ 2026
- [ ] עדכון פרומפט LLM: תיאור צורת האובייקט הכוללת (מצבה, קשת, מסגרת) + מיקום מדויק של כל אלמנט
- [ ] עדכון פרומפט ציור: שמירה על צורת האובייקט + מיקום מדויק של כל אלמנט ללא טקסט

## Background Job Processing - כל הטאבים

- [x] AI יצירה (generateRoute): background job + polling + cancel + refund
- [x] AI מתמונה (aiTraceRoute): background job + polling + cancel + refund
- [x] AI מסמך (aiDocumentRedrawRoute): background job + polling + cancel + refund
- [x] UI: כפתור ביטול + החזר אסימונים בכל 3 הטאבים
- [x] UI: הודעה "תוכל לעבור לטאב אחר — ה-AI ימשיך לעבד ברקע"

## שיפור פרומפט AI מסמך

- [x] שיפור פרומפט ניתוח LLM: תיאור מדויק יותר של מיקומים, מידות, ויחסי גודל
- [x] שיפור פרומפט יצירת תמונה: הנחיות ספציפיות יותר לשחזור מדויק של הציור

## תיקון AI מסמך + polling persistence

- [x] AI מסמך: שליחת תמונה מקורית ישירות ל-gpt-image-1 (image editing) במקום רק תיאור טקסטואלי
- [x] תיקון: jobId נשמר ב-localStorage — polling ממשיך גם אחרי מעבר טאב וחזרה

## תיקון: חזרה לטאב באמצע עיבוד

- [x] AI מסמך: שמירת תמונת קלט ב-localStorage כדי שתוצג כשחוזרים לטאב
- [x] AI מתמונה: שמירת תמונת קלט ב-localStorage כדי שתוצג כשחוזרים לטאב
- [x] AI יצירה: שמירת הפרומפט ב-localStorage כדי שיוצג כשחוזרים לטאב באמצע עיבוד
- [x] וידוא שה-polling מסיים ומציג תוצאה בכל הטאבים

## תיקון פרומפט AI מסמך — קווים נקיים לחריטת CNC

- [x] שכתוב פרומפט יצירת תמונה: קו יחיד נקי, ללא קווים כפולים, ללא shading, ללא fill
- [x] הנחיה מפורשת: "single stroke outline only, no double lines, no cross-hatching, no shading"
- [x] הנחיה לתאימות: "faithful to original layout and proportions"
- [x] שיפור הגדרות potrace: threshold=128, alphaMax=0.5, optTolerance=0.1
- [x] שיפור עיבוד sharp: הגברת קונטרסט + threshold=160 לפני potrace

## תיקון: AI מסמך תקוע + הוספת "ללא טקסט" ל-AI יצירה ו-AI מתמונה

- [x] בדיקת לוגים ל-AI מסמך — מה גורם לתקיעה/timeout
- [x] תיקון timeout: OpenAI client עם timeout=3min, jobStore מסמן jobs תקועים אחרי 5 דקות
- [x] הוספת הנחיה "ללא טקסט" ל-AI יצירה (generateRoute)
- [x] הוספת הנחיה "ללא טקסט" ל-AI מתמונה (aiTraceRoute)

## איפוס מלא של AI מסמך — גישה חדשה

- [x] מחיקת לוגיקת images.edit הנוכחית — עבר ל-images.generate
- [x] שלב A: LLM מנתח את התמונה ומתאר כל אלמנט בפירוט (צורה, מיקום, גודל יחסי)
- [x] שלב B: gpt-image-1 מצייר מחדש כ-clean line art outline בלי טקסט
- [x] פרומפט מכוון לתוצאה כמו ChatGPT: outline נקי, קו יחיד, ללא שרטוטים כפולים

## פישוט AI מסמך — שליחה ישירה של תמונה

- [x] הסרת שלב LLM — שליחת תמונה ישירות ל-gpt-image-1 עם images.edit
- [x] פרומפט פשוט: "צייר את כל מה שרואים כ-outline נקי, ללא טקסט"

## שיפור סגנון AI מסמך — אומנותי יותר

- [x] עדכון פרומפט: engraving style, fine details, artistic line weight variation, not childish coloring book

## AI מתמונה — החלפת מצב נוף

- [ ] הסרת מצב "נוף" והחלפה ב-"כל הפריטים" (trace all elements in the image)
- [ ] עדכון פרומפט ב-aiTraceRoute לפי המצב החדש
- [ ] שני המצבים יצייר בדיוק מה שרואים בתמונה (לא אלמנטים גנריים)

## AI מתמונה — החלפת מצב נוף

- [x] הסרת מצב "נוף" והחלפה ב-"כל הפריטים" (trace all elements in the image)
- [x] עדכון פרומפט buildFullImagePrompt ב-aiTraceRoute לציור מדויק של כל הפריטים
- [x] שני המצבים מציירים בדיוק מה שרואים בתמונה (לא אלמנטים גנריים)

## חיווי ויזואלי על טאב עם עיבוד פעיל

- [x] polling localStorage כל 2 שניות לזיהוי jobs פעילים
- [x] הצגת badge כתום עם animate-ping על כל טאב כשיש job פעיל

## תיקונים - מרץ 2026

- [x] AI מתמונה: שיפור דיוק — LLM מתאר תנוחה/כיוון מדויק, ו-gpt-image-1 מצייר לפי התיאור (חזר ל-openai.images.generate שעובד)
- [x] AI מתמונה: הצגת preview של התמונה שהועלתה עם אנימציית סריקה ויזואלית
- [x] AI מסמך: תיקון — החלפת openai.images.edit (404) ב-Forge API עם originalImages

## באג - חיתוך תמונה ב-AI מתמונה

- [x] תמונה שמועלת נחתכת לריבוע לפני שנשלחת ל-AI — הווקטור יוצא חתוך
- [x] תיקון: שינוי resize ל-fit:inside (1400x1400) בשני הנתיבים — שמירת פרופורציות מלאה

## באג - זווית שגויה ב-AI מתמונה

- [x] LLM לא מתאר נכון את זווית הצילום (side view vs 3/4) — gpt-image-1 מצייר מזווית שונה
- [x] תיקון: שיפור system prompt של LLM לתאר זווית מצלמה מפורשת + כפיית exact view בפרומפט הגנרציה

## פיצ'רים חדשים

- [x] שמירת תמונת מקור בהיסטוריה לצד התוצאה (AI מתמונה) — כפתור Source/Vector להחלפה בהיסטוריה
- [x] כפתור "נסה שוב" ב-AI מתמונה — בהיסטוריה וב-tab עצמו, שולח מחדש עם אותה תמונה

## בקשות חדשות - מרץ 2026

- [x] תיקון PDF ריק בייצוא — הוחלף ל-canvg
- [x] הסרת כפתורי שיתוף מדיאלוג שמירה בשם
- [x] סידור מחדש של דף ניהול — sidebar navigation
- [x] הדמיות עיצוב בהשראת אדובי — 3 סגנונות
- [x] שינוי שם: AI מסמך → AI סקיצה
- [x] שינוי שם: AI מתמונה → AI Outline

## בקשות חדשות - מרץ 2026 (2)

- [x] תיקון שגיאת PDF — canvg לצייר SVG על canvas
- [x] כפתורי DXF/PDF/ווקטור ישירות מתחת לתמונה ב-AI Outline
- [x] AI סקיצה — מעבר ל-LLM ניתוח + openai.images.generate (תיקון timeout)

## בקשות חדשות - מרץ 2026 (3)

- [ ] AI יצירה: שיפור חווית המתנה עם progress steps מפורטים
- [ ] AI סקיצה: הוספת סורק תמונה ותצוגת preview של התמונה שהועלתה

## AI Sketch - השלמת פיצ'רים (מרץ 2026)

- [x] הוספת quick action buttons (DXF/PDF/Vector) ל-ResultCard ב-AI Sketch
- [x] תיקון כפתור submit — מאפשר שליחה גם כשיש imagePreview בלבד (אחרי reload)
- [x] תמיכה ב-imagePreview-only ב-handleRedraw (המרת base64 ל-blob)
- [x] עדכון טסטים ל-aiDocumentRedraw לשקף job-based API (מחזיר jobId ולא תוצאה ישירה)

## תיקוני AI Outline (מרץ 2026)

- [ ] איפוס פרומפט AI Outline — הגדרה מחדש לדיוק מקסימלי (זוויות, פוזה, פרטים)
- [ ] הצגת תמונה שהועלתה + אנימציית סורק בזמן עיבוד
- [ ] הוספת הודעות שלבי עיבוד בזמן אמת (כמו AI יצירה)

## תיקוני AI Outline - מרץ 2026

- [x] איפוס פרומפט LLM לדיוק מקסימלי (זווית, פוזה, כיוון) - system prompt חדש
- [x] איפוס buildLineArtPrompt לשמירה קפדנית על תיאור LLM
- [x] תיקון כפתור submit — פעיל גם כשיש imagePreview בלבד (אחרי reload)
- [x] הוספת step field ל-jobStore לתמיכה בהודעות שלבים
- [x] עדכון server: step messages (מנתח → מייצר → ממיר) בזמן אמת
- [x] עדכון UI: progress bar + הודעת שלב נוכחי בזמן עיבוד

## הודעת הרשמה ללקוחות חדשים - מרץ 2026

- [x] בניית modal/banner ברור עם קישור הרשמה חינם
- [x] חיבור ל-AI יצירה (AiDocumentRedrawTab)
- [x] חיבור ל-AI Outline (AiTraceTab)
- [x] חיבור ל-AI סקיצה (AiGenerateTab)
- [x] חיבור להמרת תמונה רגילה (ConvertTab)

## תיקון AI Outline - שגיאה ואיטיות - מרץ 2026

- [x] הגדלת timeout ל-10 דקות (מ-5) ב-jobStore
- [x] הוספת heartbeat updates כל 30 שניות ב-runTraceJob
- [x] שינוי LLM analysis ל-detail: "low" (מהיר יותר)
- [x] הוספת heartbeat גם ב-runDocumentRedrawJob
- [x] שיפור הודעת שגיאה timeout - מציג הסבר ידידותי

## תיקון דף ניהול + תצוגה אייפון - מרץ 2026

- [x] תיקון דף ניהול — תוקן cookie ל-Safari/אייפון + פירסום מובייל
- [x] תיקון בעיות תצוגה באייפון — tabs קטנים יותר, auth bar לא גולש
- [x] תיקון תצוגת תמונה ב-AI Outline — upload area מוסתר בזמן loading
- [x] תיקון תצוגת תמונה ב-AI סקיצה — upload area מוסתר בזמן loading
- [x] הוספת step messages ל-AI סקיצה כמו ב-AI Outline

## תיקון AI יצירה - אין טקסט על האיור - מרץ 2026

- [x] הוספת ABSOLUTE RULE לתחילת הפרומפט ו-FINAL REMINDER בסוף — איסור מוחלט על כל טקסט/כיתוב באיור

## תיקון דיוק AI Outline - מרץ 2026

- [x] שימוש ב-images.edit() עם התמונה המקורית כ-reference ישיר — ה-AI רואה את התמונה בזמן הציירה

## שיפורי UX AI Outline - מרץ 2026

- [ ] כפתור "החלף תמונה" / "נקה" אחרי עיבוד
- [ ] progress bar ויזואלי עם אחוזים ושלבים בזמן יצירה

## שיפורי UX AI Outline - מרץ 2026

- [x] תיקון כפתור "החלף תמונה" ב-success state — פותח fileInput ישיר ומנקה localStorage
- [x] progress bar ויזואלי עם שלבים מסומנים (ניתוח / יצירה / וקטור) עם צבע פעיל לפי שלב

## תיקון תצוגת תמונה + דיוק AI Outline - מרץ 2026

- [x] תיקון תמונה לא מוצגת בזמן עיבוד — FileReader אסינכרוני, מוודאים preview לפני loading
- [x] שיפור דיוק פרומפט — detail:high ל-LLM, הוראות שמירה על צורה/לוגו/פרטים

## תיקון קריטי AI Outline - מרץ 2026

- [x] תיקון Maximum call stack size exceeded — שימוש ב-previewRef במקום state ב-handleTrace
- [x] תיקון כפתור "החלף תמונה" ב-Safari iOS — שימוש ב-label htmlFor במקום programmatic click

## תיקון החלף תמונה + מהירות AI Outline - מרץ 2026

- [x] תיקון כפתור "החלף תמונה" - הסרת onClick מ-label, כל איפוס state ב-handleFile בלבד (Safari iOS)
- [x] דחיסת תמונות גדולות לפני העלאה — canvas compression max 1024px, fallback ל-FileReader
- [x] תיקון handleFile — איפוס focusText/customImprovement/currentStep + reset file input value

## עיבוד ברקע + כפתור היסטוריה - מרץ 2026

- [x] תיקון חזרה לדף אחרי יציאה — Tab פעיל נשמר ב-localStorage, בטעינה חוזר ל-tab עם job פעיל אוטומטית
- [x] תיקון כפתור היסטוריה באייפון — טקסט נראה תמיד, כפתור גדול יותר עם רקע בולט

## Push Notifications + Result Caching - מרץ 2026

- [x] שמירת תוצאה ב-localStorage לכל 3 tabs (AiTrace, AiGenerator, AiDocumentRedraw) — מציג מיד בטעינה הבאה
- [x] התראת Push לדפדפן כשעיבוד מסתיים ב-background — בקשת הרשאה בעת הגשה + Notification API בסיום
- [x] תיקון שגיאת "Maximum call stack size exceeded" ב-AI Outline — החלפת spread push ב-for-loop ב-svgToDxf.ts

## תיקון סיבוב EXIF + שיפור דמיון פנים - מרץ 2026

- [x] תיקון סיבוב תמונה — הוסף sharp().rotate() לתיקון EXIF orientation אוטומטי לפני כל עיבוד
- [x] שיפור דמיון פנים ב-AI Outline — זיהוי אוטומטי פורטרט + prompt מיוחד לשמירת מאפייני פנים ספציפיים

## שיפור מהירות AI Outline - מרץ 2026

- [x] קיצור זמן עיבוד AI Outline: LLM detail=low, editSource 512px, potrace 1024px, streaming partial results

## תיקון PDF באייפון - מרץ 2026

- [x] תיקון שגיאת PDF באייפון — הוחלף Canvg ב-endpoint שרתי /api/svg-to-png (sharp), עובד בכל דפדפן
- [x] מצב תחזוקה ל-AI סקיצה — כפתור מבוטל + badge “תחזוק” + הראת הערה בצבע כתום

## כפתור הגדרות בדשבורד - מרץ 2026

- [ ] הוספת כפתור "הגדרות" לדשבורד הניהול — שינוי סיסמה, פרטי משתמש וכו'

## הגדרות + קווים כפולים - מרץ 2026

- [x] הוספת tab "הגדרות" לדשבורד ניהול — שינוי סיסמה, עדכון שם + endpoints בשרת
- [x] תיקון קווים כפולים — החלפת Sobel ב-thinBinary (Zhang-Suen) לקו יחיד במרכז כל קו

## AI Outline - קווים + בנאדם - מרץ 2026

- [x] תיקון קווים כפולים ב-AI Outline SVG→DXF pipeline — potrace turdSize+optTolerance
- [x] תיקון prompt AI Outline — ABSOLUTE RULE #3: אל תוסיף אנשים/גוף שלא היו בתמונה המקורית

## חיזוק prompt - אין אנשים - מרץ 2026

- [x] חיזוק ה-prompt של AI Outline — הוסף CRITICAL RULE #0 בתחילת ה-prompt + בסוף, כולל פרח, צעצוע, מוצר

## תיקון AI יצירה — שילוב אובייקט + סצנה — מרץ 2026

- [x] כשמחפשים "בלואי נוף" — לייצר את האובייקט בתוך הסצנה, לא סצנה בלבד

## תיקון באג פנים על צעצועים — מרץ 2026

- [x] חזק prompt: בובות/צעצועים/דמויות קריקטורה לא יקבלו פנים אנושיות

## בחירת וריאציה ב-AI Outline — מרץ 2026

- [x] הוסף בורר וריאציה (1/2/3) לפני עיבוד AI Outline, ברירת מחדל על 2 עם תווית "מומלץ"
- [x] עדכן backend לייצר רק את הוריאציה הנבחרת (במקום 3 מקביל)

## שיפורים מרץ 2026 — סבב 2

- [x] כפתור מצב תחזוקה בהגדרות ניהול
- [x] מניעת הרשמה עם מייל כפול + איחוד כפילויות קיימות
- [x] כפתור איפוס סיסמא ב-admin
- [x] ריענון אוטומטי בכניסה מחדש כשאין עבודה פעילה

## תיקון הודעת שגיאה אימייל — מרץ 2026

- [x] הודעת "אימייל כבר רשום" תופיע בתוך הדיאלוג, לא כ-toast בצד

## שכחתי סיסמה — מרץ 2026

- [x] כפתור "שכחתי סיסמה" בדיאלוג הכניסה — שליחת מייל איפוס ללקוח
- [x] עמוד /reset-password לאיפוס סיסמה עם טוקן

## תיקון מצב לא מחובר — מרץ 2026

- [ ] ריענון ללא משתמש מחובר — נקה תוצאה אחרונה וחזור למצב ריק

## תיקון מייל איפוס סיסמא — מרץ 2026

- [x] מייל איפוס סיסמא לא נשלח — חסר RESEND_API_KEY (נוסף)
- [x] ריענון ללא משתמש מחובר — נקה תוצאה אחרונה וחזור למצב ריק

## תיקון הצגת תוצאות ישנות ללא כניסה — מרץ 2026

- [x] נקה localStorage לפני שהרכיב נטען כשאין סשן פעיל

## תיקון עמוד איפוס סיסמא — מרץ 2026

- [ ] עמוד /reset-password מציג דף ריק — לתקן

## שיפורים — מרץ 2026
- [x] תיקון קווים כפולים בסריקה מתמונה — שיפור thinning/threshold
- [x] קיצור שם קובץ DXF — buildFilename מסנן מילות AI כמו Camera_angle
- [x] הוספת אפשרות קו דק (hairline) בהמרה ובAI Outline
- [x] Fix double lines in scanned images (improve thinning algorithm)
- [x] Add minimum 0.8mm gap enforcement between DXF lines (auto-scale)
- [x] Scale DXF output to default 100mm width for proper CNC spacing
- [x] Fix AI Outline generating unrelated faces instead of tracing uploaded image
- [x] Fix Windows 7 Chrome display issues (icons not rendering)

## תיקון תאימות Windows 7 Chrome 109 — מרץ 2026
- [x] Fix oklch() colors in Tailwind CSS 4 output — added @csstools/postcss-oklab-function to vite.config.ts to convert all oklch() to rgb() at build time

## פיצ'ר זיהוי פנים — מרץ 2026
- [ ] Server: faceDetectRoute.ts — קבלת תמונה, GPT-4o Vision מזהה פנים, gpt-image-1 מצייר פנים כ-line art, potrace → DXF
- [ ] Server: הוספת face_detect ל-TOKEN_COSTS (4 אסימונים)
- [ ] Server: רישום ב-_core/index.ts
- [ ] UI: FaceDetectTab.tsx — העלאת תמונה עם פנים, תצוגה מקדימה, תוצאה + DXF
- [ ] UI: הוספת Tab 'זיהוי פנים' ב-Home.tsx
- [ ] Tests: vitest לlogic

## פיצ'ר זיהוי פנים
- [x] faceDetectRoute.ts — backend pipeline (GPT-4o Vision + gpt-image-1 + potrace + DXF)
- [x] FaceDetectTab.tsx — UI component with upload, polling, result grid, DXF download
- [x] Home.tsx — הוספת tab "פנים / Faces" (סגול) עם job tracking
- [x] tokenService.ts — face_detect: 4 tokens
- [x] server/_core/index.ts — רישום faceDetectRoute

## אופטימיזציית פנים (מהירות)
- [x] faceDetectRoute.ts — הסר GPT-4o Vision step, שלח תמונה ישירות ל-gpt-image-1
- [x] faceDetectRoute.ts — הפחת מ-3 וריאציות ל-1 תמונה בלבד
- [x] FaceDetectTab.tsx — עדכן UI לתמונה אחת

## אופטימיזציית פנים (מהירות)
- [x] faceDetectRoute.ts — הסר GPT-4o Vision step
- [x] faceDetectRoute.ts — הפחת מ-3 ל-1 תמונה
- [x] FaceDetectTab.tsx — עדכן UI לתמונה אחת

## שינויים מבוקשים — מרץ 2026
- [x] פנים: הוסף בחירת סגנון (נקי, מפורט, אמנותי, סטנסיל)
- [x] פנים: הצג וקטור SVG בתוצאה (לא רק תמונה)
- [x] פנים: הסר מצב פירוט התקדמות GPT4 — הצג סריקה כמו AI מתמונה
- [x] פנים: הוסף תיקון עם AI (כמו modify ב-AI יצירה)
- [x] תיקון: PDF לא נפתח — תוקן (SVG viewBox ללא width/height)
- [x] כל הפיצ'רים: דיאלוג שמירה בדפדפן iOS ו-Galaxy — נוסף כפתור שיתוף
- [x] AI יצירה: הוסף שדה מרווח בין קווים (0.2-3 מ"מ, ברירת מחדל 1.5)
- [x] תשובה: איפה לשמור? — ראה תשובה למשתמש

## שינויים — פורטרט ו-PDF (מרץ 2026 v2)
- [ ] שנה שם "פנים" ל"פורטרט" בכל המקומות
- [ ] הצג וקטור SVG בתוצאת הפורטרט (לא רק תמונה)
- [ ] הוסף 3 וריאציות פורטרט — אחרי בחירה הצג 1-3 כולן
- [ ] תקן שגיאת PDF חוזרת — לבדוק לעומק
- [ ] הוסף הצעות שינוי AI אוטומטיות אחרי תוצאה (2-3 הצעות ללחיצה)
- [x] תיקון PDF: שגיאת "Attribute stroke redefined" - SVG עם stroke כפול גורם לsharp להיכשל

## היסטוריה (מרץ 2026)
- [x] הוסף דף היסטוריה עם קטגוריות (ממיר, AI Outline, AI יצירה, פורטרט, מסמך)
- [x] וודא שכל הפיצ'רים שומרים היסטוריה עם קטגוריה ומטא-דאטה
- [x] הצג SVG preview, DXF download, תאריך ושם בכל כרטיס היסטוריה
- [x] Tabs לפי קטגוריה: הכל / המרה / AI קווים / AI יצירה / פורטרט / מסמך
- [x] ספירת פריטים לכל tab, הסתרת tabs ריקים

## תיקוני פורטרט — מרץ 2026 v3
- [x] תקן PDF נחתך — SVG לא מתאים לגודל דף A4 (הפורטרט חצוי)
- [x] הוסף כפתור PDF לכל וריאציה בנפרד בתצוגת הפורטרט
- [x] שיפור כפתור "הצג וקטור" — בולט יותר עם pill style ותווית ברורה

## אחידות ייצוא + עיבוד ברקע — מרץ 2026 v4
- [x] בנה קומפוננט ExportButtons אחיד (DXF + PDF + Vector toggle + More options)
- [x] תקן PDF בכל 4 פיצ'רים (חילוץ viewBox, הגבלה A4, שמירת פרופורציות)
- [x] כפתור Vector toggle אחיד בכל 4 פיצ'רים (pill style סגול)
- [x] ניקוי localStorage בכניסה חדשה (sessionStorage flag) אלא אם יש עבודה פעילה ברקע
- [x] כל 4 פיצ'רים משתמשים ב-ExportButtons אחיד
- [ ] עיבוד ברקע — jobs נשמרים ב-DB, שורדים reload דף (שלב בא)
- [ ] job פעיל מוצג עם אינדיקטור כתום מהבהב → ירוק כשמוכן (שלב בא)

## זכור אותי — מרץ 2026 v5
- [x] הוסף checkbox "זכור אותי" בדיאלוג הכניסה (מוצג לצד "שכחתי סיסמא")
- [x] כשמסומן — cookie ל-30 יום; כשלא — session cookie (נמחק בסגירת דפדפן)
- [x] שמור העדפה ב-localStorage (ברירת מחדל: מסומן)

## תיקון ביצועים — המרת תמונה איטית (מרץ 2026 v6)
- [x] הפחת רזולוציה מקסימלית לסריקה מ-2000px ל-1200px (Zhang-Suen מהיר פי 2.7)
- [x] הוסף timeout של 45 שניות לעיבוד עם הודעת שגיאה ברורה בעברית
- [x] הוסף הגבלת איטרציות ל-thinBinary (מקסימום 120 איטרציות)

## דחיסת תמונה בצד לקוח (מרץ 2026 v7)
- [x] הוסף resize אוטומטי ב-canvas לפני העלאה (מקסימום 1200px) — מפחית מ-20MB ל-300KB
- [ ] הצג גודל לפני/אחרי דחיסה בממשק (אופציונלי)

## קיצור שמות קבצים (מרץ 2026 v8)
- [x] הגבל שמות קבצים ל-30 תווים מקסימום בכל הפיצ'רים (ExportButtons + DxfDownloadDialog + כל שרתי השר)

## עיצוב חדש - מרץ 2026

- [x] לוגו AiDXF חדש עם gradient סגול ואייקון bezier
- [x] טאבים עם gradient צבעוני (AI Create סגול, AI Outline טורקיז, Portrait סגול כהה)
- [x] כפתורים ראשיים עם gradient ו-shadow בכל הטאבים
- [x] תמונות דמו חדשות: AI Create (מכונת כתיבה, אופנוע, משקפיים), AI Outline (אופניים, נעל, כלי עבודה), Portrait (אישה, גבר, ילד)
- [x] פוטר מעודכן עם לוגו AiDXF ומידע קצר
- [x] כפתור התחברות עם gradient

## Hero Section - מרץ 2026

- [ ] Hero section עם badge pill "AI-POWERED VECTOR CONVERSION"
- [ ] כותרת ענקית "From photo to vector. Instantly." + עברית
- [ ] תמונת נעל before/after עם AI badge
- [ ] 4 feature highlights (Scan, AI Outline, AI Generate, Portrait)
- [ ] Dark CTA section בתחתית עם "Start converting for free today"

## עיצוב כפתורים - מרץ 2026

- [x] כפתורי תוצאה (וקטור, PDF, DXF) — עיצוב gradient אחיד בכל הטאבים
- [x] כפתור "תיקון עם AI" — עיצוב gradient סגול
- [x] כפתור "אפשרויות נוספות" — עיצוב נקי ומודרני
- [x] כל הכפתורים בכל הקומפוננטות — AiTraceTab, FaceDetectTab, AiGeneratorTab

## שיפורי Layout וכפתורים - מרץ 2026

- [ ] שורת שם משתמש — להעביר לתוך ה-header הכי למעלה, פרופורציונלי
- [ ] כרטיסי דמו → כפתורי פיצ'ר אמיתיים עם תמונות (כולל קסדה)
- [ ] פינוי מקום — הסרת section כרטיסי דמו מיותר
- [ ] כפתורים פנימיים (DXF, הצג וקטור, PDF) — עיצוב מודרני gradient

## שיפורי Layout וכפתורים - מרץ 2026

- [x] שורת משתמש להכי למעלה בheader
- [x] כרטיסי דמו → כפתורים אמיתיים עם תמונות שמפעילים טאב
- [x] הוסף קסדה לכפתורי הפיצ'ר
- [x] כפתורים פנימיים (DXF, וקטור, PDF) — עיצוב מודרני גדול יותר

## כפתורים פנימיים חיים - מרץ 2026

- [ ] AiTraceTab: כפתורי מצב (אובייקט/כל הפריטים) — gradient חזק
- [ ] AiTraceTab: כפתורי סגנון (1/2/3) — עיצוב מרשים
- [ ] AiTraceTab: כפתור ראשי "צור AI Outline" — gradient חזק
- [ ] FaceDetectTab: כפתורים פנימיים — עיצוב אחיד
- [ ] AiGeneratorTab: כפתורים פנימיים — עיצוב אחיד

## Desktop Layout Fix - מרץ 2026

- [ ] הרחב container לכל רוחב המסך במחשב
- [ ] שפר גודל כרטיסי דמו ב-desktop — 3 עמודות, תמונות גדולות
- [ ] תיקון max-width constraints

## Desktop UX Fixes - מרץ 2026 (v2)

- [ ] תמונת hero חדשה — AI themed, מגניב וצעיר (במקום הנעל)
- [ ] שפר איכות תמונות דמו — גדולות יותר, object-contain
- [ ] הגדל טקסט בטאבים — קשה לקרוא
- [ ] אייקונים יפים לאובייקט/נוף
- [ ] הדגש textarea "תאר את העיצוב" — בולט יותר

## בנר "What's New" - מרץ 2026
- [x] tRPC procedures: announcement.get (public) + announcement.set (admin PIN)
- [x] DB: systemSettings table used for storing banner JSON (text + enabled)
- [x] Admin page /admin/announcement — editor with PIN auth, toggle, preview
- [x] AnnouncementBanner component above hero carousel in Home.tsx
- [x] Route /admin/announcement registered in App.tsx
- [x] Tests: 10 vitest tests for announcement logic (121 total passing)

## תיקון איכות תמונות גלריה - מרץ 2026
- [x] AI יצירה: החלף 3 כרטיסים קטנים ב-slider גדול (תמונה אחת בכל פעם)
- [x] AI Outline: החלף 3 כרטיסים קטנים ב-slider גדול (before/after זה לצד זה)
- [x] פורטרט: החלף 3 כרטיסים קטנים ב-slider גדול (before/after זה לצד זה)
- [x] וודא שאין חיתוך — object-contain בכל התמונות
- [x] תמונות גדולות מספיק לקריאה ממחשב

## כפתור היסטוריה ופורטרט - מרץ 2026
- [x] פורטרט: החלף 3 כרטיסים קטנים ב-DemoSlider גדול
- [x] כפתור היסטוריה: עיצוב בולט יותר בheader (צבע, גודל, אייקון ברור)
