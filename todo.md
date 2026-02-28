# Image to DXF Converter - TODO

- [x] Install image processing libraries (sharp) and DXF generation (custom)
- [x] Build server route: accept image upload, run edge detection, generate DXF
- [x] Build tRPC procedure: convertImage (upload → process → return DXF URL)
- [x] Build Hebrew UI: drag & drop upload zone
- [x] Build Hebrew UI: image preview panel
- [x] Build Hebrew UI: threshold / sensitivity slider
- [x] Build Hebrew UI: processing status indicators (loading, ready, error)
- [x] Build Hebrew UI: download DXF button
- [x] Write vitest tests for conversion logic (11 tests passing)
- [ ] Final checkpoint and publish

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
