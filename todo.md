# Image to DXF Converter - TODO

## עדכונים - מרץ 2026

- [x] עיצוב מחדש של תפריט המשתמש — עיצוב כהה ומודרני עם gradient סגול/כחול, אייקונים עם רקע, hover effects
- [x] יצירת 3 תמונות דמו חדשות לקטגוריית AI Create: אופנוע, דרקון, נעל ספורט
- [x] הוספת 3 תמונות דמו חדשות ל-DemoSlider בטאב AI Create (5 תמונות סה"כ)


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

## עמוד אזור אישי (/account) - מרץ 2026
- [x] עמוד /account עם layout מסודר (tabs/sections)
- [x] סעיף 1: החלפת סיסמא (טופס ישן+חדש+אישור)
- [x] סעיף 2: אמצעי תשלום (placeholder) + היסטוריית אסימונים מתקפלת
- [x] סעיף 3: עדכון פרטים (שם, אימייל)
- [x] סעיף 4: המנוי שלי (placeholder - "בקרוב")
- [x] סעיף 5: פנייה לתמיכה (קישור מייל)
- [x] כפתור "האזור האישי" בולט ב-header
- [x] Route /account ב-App.tsx
- [x] tRPC: changePassword procedure (קיים ב-appAuth.ts)
- [x] tRPC: updateProfile procedure (קיים ב-appAuth.ts)

## AI Outline - רמת פירוט - מרץ 2026
- [x] הוסף toggle "רמת פירוט" ל-AI Outline: מצב 1 (מומלץ, נקי) / מצב 2 (מפורט)
- [x] עדכן prompt בשרת בהתאם למצב שנבחר
- [x] ברירת מחדל: מצב 1

## AI Outline - תמונות דוגמה למצבים - מרץ 2026
- [x] הוסף תמונות before/after לכל מצב ב-toggle (נקי / מפורט)

## שיפור prompt מצב נקי - מרץ 2026
- [x] שפר prompt של מצב 1 (נקי/פשוט) לקווים אחידים וחלקים ללא קווים בודדים

## תיקון AI Outline מצב נקי - ניתוח תמונה - מרץ 2026
- [ ] תקן prompt ניתוח תמונה (שלב 1) - תאר רק צורה כללית במצב פשוט, לא פרטים
- [ ] תקן חיתוך - הרכב חתוך בתמונה, צריך שייכנס במסגרת

## תיקון היסטוריה - מרץ 2026
- [ ] תקן דף היסטוריה לא נטען/נכנסים
- [ ] תקן כותרות פריטים בהיסטוריה - שיתאים לשם הפיצ'ר (AI Outline / AI יצירה / פורטרט)
- [ ] תקן AI Outline מצב נקי - עדיין יותר מדי פרטים + חיתוך
## Share Sheet ב-iOS/Android - מרץ 2026
- [x] כפתורי הורדת DXF ב-iOS/Android יפתחו Share Sheet נייטיב (כולל: AI Outline, AI יצירה, פורטרט, המרה, היסטוריה)
- [x] כפתורי הורדת PDF ב-iOS/Android יפתחו Share Sheet נייטיב
- [x] ב-desktop: ההתנהגות הרגילה (הורדה ישירה) נשמרת
## AI Outline - מצב יחיד (מרץ 2026)
- [x] הסר בחירת וריאציות מ-AI Outline - תמיד השתמש ב-Mode 1 (נקי/פשוט)
- [x] הקטן תמונת מקור מ-512 ל-384px לעיבוד מהיר יותר
- [x] עדכן ממשק המשתמש - הסר כפתורי בחירת מצב

## AI Outline - מצב יחיד + הקטנת תמונה (מרץ 2026)
- [x] הסר בחירת וריאציות מ-AI Outline - תמיד השתמש ב-Mode 1 (נקי/פשוט)
- [x] הקטן תמונת מקור מ-512 ל-384px לעיבוד מהיר יותר
- [x] עדכן ממשק המשתמש - הסר כפתורי בחירת מצב

## AI Outline - חיזוק prompt מצב פשוט (מרץ 2026)
- [x] חזק את ה-prompt של מצב פשוט - הוסף הוראות FORBIDDEN מפורשות לאיסור פרטים
- [x] הוסף הוראות לאיסור נקודות, גרילים, שרוכים מפורטים, צללים

## תרגום מלא + זיהוי שפה אוטומטי (מרץ 2026)
- [ ] בדיקת כל הדפים לטקסטים בעברית בלבד
- [ ] תיקון כל הטקסטים הקשיחים שחסרים תרגום
- [ ] הוספת זיהוי שפת דפדפן אוטומטי (navigator.language)

## קווים דקים יותר בתצוגת וקטור (מרץ 2026)
- [x] הורד stroke-width ב-SVG preview מ-1.5/0.8 ל-0.5/0.4 — קווים דקים יותר בכל הפיצ'רים

## תיקון AI Hallucination - אל תוסיף אלמנטים (מרץ 2026)
- [ ] עדכן prompt - הוסף FORBIDDEN מפורש: אל תוסיף בני אדם, תווים, רקע, או כל דבר שלא קיים בתמונה המקורית

## AI Outline - תיקון איכות (מרץ 2026)
- [x] הוסף FORBIDDEN מפורש: אל תוסיף בני אדם, תווים, רקע, או כל דבר שלא קיים בתמונה
- [x] החזר גודל תמונה ל-512px לאיכות טובה יותר
- [x] שפר את prompt ניתוח השלב הראשון - תאר רק מה שקיים בתמונה

## AI Outline - תיקון אריזות ורקע (מרץ 2026)
- [x] אל תצייר תמונות מודפסות על אריזות (תינוקות, פנים, דמויות על מוצרים)
- [x] אל תצייר אובייקטים מהרקע - רק האובייקט הראשי
- [x] הוסף קצת יותר פרטים תוך שמירה על קווים חלקים

## AI Outline - ציור הנושא הבולט (מרץ 2026)
- [x] עדכן prompt: צייר את הנושא הויזואלי הבולט ביותר בתמונה — גם אם הוא מודפס על אריזה (כמו תינוק על מגבונים)

## AI Outline - הסרת רקע לפני עיבוד (מרץ 2026)
- [ ] הוסף שלב הסרת רקע לפני שליחת התמונה ל-gpt-image-1 כדי למנוע hallucinations

## AI Outline - אל תוסיף בן אדם לכלי נגינה (מרץ 2026)
- [ ] חזק כלל: אל תוסיף בן אדם גם כשיש כלי נגינה + תווים - צייר רק את הכלי והתווים

## Flux Kontext Pro Integration (מרץ 2026)
- [ ] הוסף REPLICATE_API_TOKEN secret
- [ ] התקן replicate npm package
- [ ] שכתב AI Outline להשתמש ב-Flux Kontext Pro במקום gpt-image-1

## אינטגרציית Flux Kontext Pro - מרץ 2026

- [x] תיקון nanoid symlink שבור (שגרם לקריסת השרת)
- [x] וידוא שהשרת עולה ורץ תקין
- [x] עדכון REPLICATE_API_TOKEN לטוקן תקין
- [x] בדיקת חיבור ל-Replicate API (חשבון: yossi2700-code)
- [x] שיפור פרומפטים ל-Flux Kontext Pro (פרומפטים קצרים וממוקדים לעריכת תמונות)
- [x] עדכון זמן המתנה בממשק מ-30-90 שניות ל-15-30 שניות
- [x] כתיבת טסט לוידוא טוקן Replicate
- [x] הרצת כל 122 הטסטים - כולם עוברים

## שיפור Flux Kontext Pro - מרץ 2026

- [x] שיפור פרומפט Flux: ללא הצללות, קווים נקיים בלבד, פרופורציות נאמנות לתמונה המקורית

## שיפור UX - AI יצירה

- [ ] שיפור UX שדה הקלדה בטאב AI יצירה — label, placeholder ברור, אייקון מקלדת
- [ ] שיפור UX שדה הקלדה בטאב AI יצירה — label, placeholder ברור, אייקון מקלדת
- [ ] החלפת תמונת הנעל בקרוסל דוגמאות ב-AI יצירה — תמונה שמראה טקסט → ציור
- [ ] תיקון פרומפט Flux: הסרת רקע לחלוטין — רק הנושא הראשי על רקע לבן נקי (ללא קיר, אספלט, עשבים, לוגו)
- [ ] תיקון קווים מזוגזגים ב-AI Outline: שיפור פרמטרי potrace (alphaMax, optCurve, optTolerance) לקווים חלקים
- [ ] החזרת AI Outline ל-gpt-image-1 (Flux Kontext Pro לא מתאים לline art)
- [ ] החלפת תמונת קרוסל AI סקיצה — מסמך/טקסט עם AI במקום קסדה
- [ ] עדכון תמונת קרוסל AI סקיצה לתמונת סריקת טקסט חדשה
- [ ] בדיקת כפתורי הורדה DXF/PDF - האם פותחים דיאלוג שיתוף כמו ב-iOS
- [ ] עדכון זמן המתנה ב-AI Outline מ-15-30 שניות ל-30-90 שניות
- [ ] פישוט עיצוב מצבי עיבוד - מצב אחד ברירת מחדל במקום 3 כפתורים

## תיקונים - מרץ 2026

- [ ] תיקון כפתורי הצעות AI לא עובדים ב-AI Outline
- [ ] הצגת עיצוב אחד ברירת מחדל במקום 3 עיצובים
- [ ] תיקון שגיאות כתיב בעברית

## תיקונים - מרץ 2026 (המשך)
- [ ] תיקון הצעות שיפור ב-AI יצירה — הצעות גנריות, לא ספציפיות לפי ה-prompt שהוזן

## שפות נוספות וזיהוי אוטומטי לפי אזור
- [ ] תיקון כפתורי AiRefinePanel שלא עובדים
- [ ] הוספת שפות: סינית (zh), ספרדית (es), צרפתית (fr), ערבית (ar), רוסית (ru)
- [ ] זיהוי שפה אוטומטי לפי browser locale (navigator.language)
- [ ] שמירת העדפת שפה ב-localStorage (עוקפת זיהוי אוטומטי)
- [ ] הגדרות שפה אישיות (dropdown בניווט)

## תיקוני באגים - מרץ 2026

- [x] תיקון React crash ב-ImageCard component (useLanguage hook חסר)
- [x] תיקון מפתחות כפולים ב-translations.ts (processingError בכל 7 שפות)

## PayPal Integration

- [x] הכנת server-side: products.ts, paypal.ts, paypalRoute.ts
- [x] יצירת paypal order endpoint בשרת
- [x] יצירת paypal capture endpoint בשרת
- [x] UI: עמוד /buy עם 2 חבילות + modal תנאים חובה
- [x] גילוי מטבע לפי מדינה (USD/EUR/ILS/GBP/AUD/CAD/JPY)
- [x] הוספת תרגומים לרכישת קרדיטים ב-7 שפות
- [x] עמוד /buy/success עם אנימציה וסיכום הזמנה
- [x] הוספת admin panel לצפייה בהזמנות PayPal
- [x] עמוד /purchase-terms עם תנאי רכישה משפטיים

## Terms of Service & Privacy Policy

- [x] יצירת עמוד /terms עם תנאי שימוש (כולל copyright, liability, indemnification, GDPR)
- [x] יצירת עמוד /privacy עם מדיניות פרטיות (GDPR compliant)
- [x] הוספת checkbox הסכמה בהרשמה עם timestamp ו-IP
- [x] שמירת consent records בDB
- [x] הצגת consent records בפאנל הניהול

## ניהול מחירי חבילות PayPal

- [x] הוספת טבלת package_prices ל-DB (packageId, basePrice, currency, isActive)
- [x] tRPC admin procedures: getPackagePrices, updatePackagePrice
- [x] UI ניהול מחירים ב-Admin panel (עריכה ישירה מהממשק)
- [x] עמוד /buy קורא מחירים דינמיים מה-DB

## ניווט ומטבעות - מרץ 2026

- [ ] הוספת כפתור 'קנה קרדיטים' בניווט הראשי
- [ ] המרת מטבע אוטומטית ב-Admin panel (שינוי ILS → מחשב שאר המטבעות)
- [ ] toggle להפעלה/כיבוי מטבעות בפאנל הניהול
- [ ] עמוד /buy מציג רק מטבעות פעילים

## חיבור PayPal Live - מרץ 2026

- [x] הגדרת PAYPAL_CLIENT_ID ו-PAYPAL_CLIENT_SECRET כ-secrets
- [x] עדכון paypal.ts ל-Live mode (api.paypal.com במקום api.sandbox.paypal.com)
- [x] בדיקת /api/paypal/status
- [x] vitest לאימות החיבור

- [x] ניהול מחירון (TOKEN_COSTS) בפאנל הניהול — עלות טוקנים לכל פעולה
- [x] תיקון כפתורי ניווט עליון במובייל (overflow, גודל, ריווח)

- [x] תיקון שגיאת יצירת הזמנה PayPal
- [x] הוספת תשלום בכרטיס אשראי ישיר (ללא חשבון PayPal)

## שמירת כרטיס אשראי (PayPal Vault)

- [ ] הוספת vault_id לטבלת app_users ב-DB
- [ ] עדכון paypalRoute - create-order עם vault + charge עם vault token
- [ ] עדכון Buy.tsx - checkbox "שמור כרטיס" + כפתור "שלם עם הכרטיס השמור"
- [ ] עמוד פרופיל - ניהול כרטיסים שמורים (הצגה + מחיקה)

## תרגום תנאי שימוש לפי שפה

- [x] תרגום תנאי שימוש (AuthDialog) לעברית ואנגלית
- [x] תרגום תנאי רכישה (Buy.tsx) לעברית ואנגלית

## באנר אסימונים אזלים
- [ ] באנר עם הודעה וקישור לרכישה כשנגמרים האסימונים תוך כדי ניסיון ייצור

## שיפור ניווט עליון במובייל
- [x] עיצוב מחדש של שורת הניווט — האזור האישי נגיש וברור, ללא עומס

## מייל ברוכים הבאים
- [x] שליחת מייל ברוכים הבאים אוטומטי לאחר הרשמה עם פרטי הטוקנים החינמיים

## מייל אישור רכישה
- [x] שליחת מייל אישור רכישה אוטומטי לאחר תשלום PayPal מוצלח

## ולידציה תנאי שימוש בהרשמה
- [x] צ'קבוקס תנאי שימוש אדום + הודעת שגיאה אם לא סומן לפני הרשמה
- [x] תיקון כרטיס אשראי ישיר — החלפת Hosted Fields ב-PayPal Checkout עם כרטיס
- [x] הגדלת כפתור אזור אישי בניווט — ברור יותר שיש תפריט נפתח
- [x] הוספת באנר "אזלו הטוקנים" עם קישור לדף רכישה כשמשתמש מנסה להמיר ואין מספיק טוקנים
- [x] השלמת אינטגרציית באנר אסימונים בכל טאבי ההמרה
- [ ] יצירת 3 תמונות דוגמה חדשות בסגנון מודרני/צעיר
- [x] העלאת התמונות ל-CDN ושילובן בקרוסלה
- [x] תיקון כפתור תחזוקה בניהול — נוסף MaintenanceGuard ב-App.tsx שמציג מסך תחזוקה לכל המשתמשים (חוץ מאדמין)
- [x] תיקון היסטוריית PayPal — נוסף פילטר סטטוס (הושלמו/ממתין/הכל), ברירת מחדל רק הושלמו, ניקוי רשומות pending מה-DB
- [x] הסרת סטטיסטיקת "סה"כ קווים שנוצרו" מדשבורד הניהול
- [x] ניהול חבילות: הוספת עמודה חדשה עם שדות אסימונים+מחיר, מחיקת עמודה, ניהול מטבעות
- [x] ניהול משתמשים: עיצוב מחדש עם קיפול, פעולה אחרונה (מתי+מה), תצוגת קובץ DXF + הורדה
- [x] הצגת מידע מלא על כל משתמש: פעולה אחרונה, רכישת אסימונים אחרונה
- [x] הגדרות: הוספת שדות עדכון מייל ומספר וואטסאפ לשירות לקוחות
- [x] כפתורי פנייה (מייל/וואטסאפ) בדף הבית לשירות לקוחות- [x] שיפור מקצועי של היסטוריית PayPal בניהול
- [x] כפתור "כרטיס אשראי" בדף הרכישה — להפוך לאפור עם "בקרוב"

## עדכון מצבי AI Portrait
- [x] מצב 1 (פשוט): קו נקי, דומה מקסימלית לפנים — פרומפט מעודכן
- [x] מצב 2 (מפורט): פרטים עשירים, דומה לפנים — פרומפט מעודכן
- [x] צמצום מ 4 סגנונות ל-2 בלבד
- [x] עדכון שאלות נפוצות 1+2 בדף הרכישה — שאלה 1: כמה אסימונים עולה כל פעולה, שאלה 2: האסימונים פגים

## שיפורי UX מצב פורטרט
- [x] שלבי התקדמות ברורים בזמן עיבוד (ניתוח → ציור → המרה)
- [x] תצוגת לפני/אחרי (slider) עם תמונה מקורית לצד תוצאה
- [x] פאנל תיקון AI לאחר תוצאה: כפתורי פשוט/מפורט + שדה טקסט חופשי

## שיפור דמיון פורטרט
- [x] שיפור פרומפטים לדמיון מקסימלי לפנים — forensic portrait artist, identity preservation #1 priority, זקן/סטאבל, קו לסת ואינו גנרי

## עיצוב אזור אישי והיסטוריה
- [ ] עיצוב מחדש של כפתור אזור אישי בניווט
- [ ] עיצוב מחדש של עמוד היסטוריה

## שיפורי UI - מרץ 2026 (סשן 3)

- [x] הוספת אייקונים וצבעים לכפתורי "אזור אישי" ו"היסטוריה" בתפריט המשתמש
- [x] בדיקה וזיהוי סיבת האיטיות בעיבוד AI Portrait
- [x] שיפור מהירות AI Portrait - פרומפט קצר יותר + AI suggestions במקביל לעיבוד DXF
- [x] שיפור מהירות פורטרט: quality=low + קלט 256px (חיסכון 30-50% בזמן)
- [x] תיקון בעיית הוספת חבילה - הגדלת packageId ל-32 תווים
- [x] הוספת שדה הנחה באחוזים לחבילות + תצוגת הנחה בדף הרכישה
- [x] תיקון כפתור "הוסף חבילה" - יצירת מזהה אוטומטי מכמות אסימונים
- [x] מעבר ל-DALL-E 2 עם 512x512 לפורטרט מהיר (בוטל - איכות גרועה)
- [x] חזרה ל-gpt-image-1 quality:low (איכות טובה ל-line art)
- [x] הוספת תגיות לחבילות: "מומלץ", "הכי משתלם", "במבצע", "התנסות" - ניתן לסמן בניהול ומוצג בדף רכישה
- [x] הוספת צור קשר לתמיכה טכנית בדף רכישות (אימייל + WhatsApp)
- [x] הוספת תגית "התנסות" לרשימת תגיות החבילות
- [x] הוספת בנר מבצע דינמי בראש הדף הראשי (מוצג כשיש חבילה עם badge=sale או הנחה פעילה)
- [x] מעקב תשלומי PayPal בניהול: ירוק=הושלם, כתום=לא הושלם, שם+אימייל משתמש, איפה עצר
- [x] תיקון מזהה חבילה אוטומטי: עכשיו מעדכן בכל הקלדה כל עוד לא שונה ידניתן)
- [x] הוספת ציור/איירור לכל כרטיס חבילה בדף הרכישה (שדה imageUrl בניהול, מוצג בכרטיס)
- [ ] תיקון בנר מבצע - לא מוצג בדף הבית
- [ ] יצירת 4 ציורים AI לחבילות: התנסות, מומלץ, הכי משתלם, לעסקים
- [x] תיקון כפתור "התחל להמיר עכשיו" במייל אישור רכישה — קישור לאזור האישי
- [ ] הדרכת אימות דומיין ב-Resend למניעת ספאם
- [x] הוספת tRPC procedure להיסטוריית רכישות (purchases.list)
- [ ] התראת אדמין בכל רכישה מוצלחת (notifyOwner)
- [x] רכיב היסטוריית רכישות באזור האישי (Account.tsx)
- [x] שדות כרטיס ישירות בדף הרכישה (PayPal Hosted Fields + fallback לחשבונות לא נתמכות)
## תיקון שדות כרטיס אשראי - מרץ 2026
- [x] תיקון: שדות כרטיס מוצגים לשנייה ואז נעלמים ומפנים ל-PayPal login — עכשיו מוצג spinner עד שידוע eligibility, ורק אז מוצג הבקרה הנכונה
## תיקון בנר מבצע - מרץ 2026
- [ ] תיקון בנר מבצע בדף הבית — לא מוצג למרות שיש חבילה עם badge=sale או הנחה
## תיקון תשלום כרטיס אשראי ב-PayPal - מרץ 2026
- [x] תיקון: PayPal מבקש התחברות לחשבון — שונה landing_page ל-BILLING והוסף shipping_preference=NO_SHIPPING
## חקירה מעמיקה - PayPal guest checkout - מרץ 2026
- [x] תיקון: שונה ל-payment_source.paypal.experience_context עם landing_page: GUEST_CHECKOUT (בדל application_context שהוא deprecated)
## דיבוג PayPal guest checkout - מרץ 2026
- [x] תיקון: שינה ל-getAppUserFromRequest שתומך גם Manus OAuth בנתיבי PayPal
## שגיאה ביצירת הזמנה - חקירה עמוקה - מרץ 2026
- [ ] הוספת לוגים מפורטים לנתיב create-order לאיתור הסיבה המדויקת
- [x] הוספת לוגים — גילוי: Manus OAuth cookie לא נשלח ל-Express routes
- [x] פתרון: המרת create-order ו-capture-order ל-tRPC procedures (תמיכה מלאה ב-Manus OAuth)
- [x] עדכון BuySuccess.tsx להשתמש ב-tRPC captureOrder mutation
## תיקון PayPal על dxfai.net - מרץ 2026
- [ ] תיקון: דרך dxfai.net PayPal מציג רק התחברות (לא אפשרות כרטיס) — Manus OAuth cookie לא עובד על custom domain
## תיקון בדיקת הרשמה ב-AI Create - מרץ 2026
- [x] תיקון: משתמש רשום ומחובר מקבל הודעה "צריך להירשם" כשמנסה להשתמש ב-AI Create — תוקן: credentials:include בכל fetch calls + HTTPS redirect + tokens.balance תומך ב-Manus OAuth

## שיפור מיילים - מרץ 2026

- [x] שכתוב HTML של מייל קמפיין לגרסה ידידותית לפילטרי ספאם (HTML נקי, ללא gradients מורכבים)
- [x] הוספת גרסת טקסט רגיל (plain text) לכל מייל המוני
- [x] הוספת headers: List-Unsubscribe, Precedence: bulk
- [x] עדכון ממשק ניהול עם תוכן מייל קמפיין מוכן מראש
- [x] שליחת מייל בדיקה עם הגרסה החדשה

## באגים - מרץ 2026

- [x] DXF מגיע קטוע — 222 אובייקטים נפרדים במקום polylines מחוברות. תוקן: כל path הפך ל-LWPOLYLINE אחת רציפה (R2000).

## באנר ברוכים הבאים - מרץ 2026

- [ ] עדכון באנר הרשמה: טקסט חדש עם 10 אסימונים + עידוד לפתוח מייל לקבלת 20 נוספים

## באנר ברוכים הבאים + מייל קבלת פנים - מרץ 2026

- [ ] באנר ברוכים הבאים לאחר הרשמה: 10 אסימונים + עידוד לפתוח מייל לקבלת 20 נוספים
- [ ] מייל HTML מקצועי מעוצב: הסבר על האתר, אופציות, יתרונות, 20 אסימונים בונוס
- [ ] הוספת מייל ברוכים הבאים לתהליך ההרשמה (שליחה אוטומטית)

## תיקונים - מרץ 2026 (3)

- [x] מייל ברוכים הבאים: תקן 15→20 אסימוני בונוס בטקסט
- [x] קישור בונוס במייל לא עובד — תוקן: awardCampaignBonus שונה ל-20, frontend מזהה ?campaign= ושולח לשרת
- [x] באנר ברוכים הבאים: הוסף אנימציה (slide-in, bounce icon, shimmer, float) + כפתור X עם fade-out

## תיקונים - מרץ 2026 (4)

- [x] שינוי ברירת מחדל אסימונים מ-20 ל-10 בסכמה ובמייל
- [x] עדכון באנר: "קיבלת 10 אסימונים" (נכון) + "עוד 20 במייל"

## באגים - מרץ 2026 (2)

- [x] לינק בונוס במייל לא מוביל לשום מקום — תוקן: siteUrl עכשיו משתמש ב-origin מה-request או fallback ל-dxfai.net

## באגים - מרץ 2026 (3)

- [x] אימות מייל לא עובד — תוקן: URL קבוע ל-dxfai.net, נוסף דף /verify-email עם הודעה בעברית להצלחה/שגיאה

## פיצ'רים - מרץ 2026 (2)

- [ ] אימות מייל בהרשמה — אחרי הרשמה מציג מסך "בדוק את המייל שלך", חוסם שימוש עד לאימות

## תיקונים - מרץ 2026 (5)

- [ ] אימות מייל לא עובד — לתקן end-to-end (שליחה, טוקן, endpoint, דף frontend)

## פרויקט גדול - מרץ 2026

### דף ניהול מחודש
- [ ] רשימת משתמשים: שם, מייל, אסימונים, כניסה אחרונה, פעולה אחרונה, תאריך הרשמה
- [ ] נקודה ירוקה (פעיל ב-12 שעות אחרונות) / צהובה (לא פעיל)
- [ ] אפשרות להוסיף אסימונים לכל משתמש
- [ ] שליחת מייל לפי לקוח ספציפי או לכולם
- [ ] היסטוריית תשלומים (PayPal) לכל משתמש
- [ ] כתובת IP בלשונית מתקפלת
- [ ] שליחת מייל איפוס סיסמה מהניהול
- [ ] לשונית באגים: כל כשלון המרה נרשם עם פרטים
- [ ] סטטיסטיקות: הורדות, המרות, משתמשים חדשים
- [ ] ניהול קמפיינים עם הסברים

### מערכת מנויים
- [ ] DB: טבלת subscription_plans, user_subscriptions, daily_usage
- [ ] לוגיקה: X המרות ביום, אם עבר מכסה → אסימונים
- [ ] ממשק ניהול: הוספה/הסרה/עריכה של תוכניות מנוי
- [ ] תג מיוחד למנויים במקום מצב אסימונים
- [ ] אפשרות הנחה/מבצע לתוכניות

### UI שיפורים
- [ ] מצב פורטרט עם לפני/אחרי
- [ ] תמונות המחשה קטנות לכל פיצ'ר (פשוט/מפורט)
- [ ] עלות אסימונים ליד כל פיצ'ר
- [ ] חלון "מה חדש" בדף הראשי (עריכה מהניהול)

## עדכונים - מרץ 2026 (6)

### דף ניהול מחודש
- [x] רשימת משתמשים: שם, מייל, אסימונים, כניסה אחרונה, פעולה אחרונה, תאריך הרשמה
- [x] נקודה ירוקה (פעיל ב-24 שעות אחרונות) / צהובה (פעיל ב-7 ימים) / אפורה (לא פעיל)
- [x] אפשרות להוסיף אסימונים לכל משתמש
- [x] לשונית באגים: כל כשלון המרה נרשם עם פרטים + ניהול סטטוס
- [x] לשונית מנויים: ניהול תוכניות + הקצאת מנויים למשתמשים
- [x] לשונית חדשות: ניהול פריטי "מה חדש" שמוצגים בדף הראשי

### מערכת מנויים
- [x] DB: טבלת subscription_plans, user_subscriptions, daily_usage
- [x] לוגיקה: X המרות ביום, אם עבר מכסה → אסימונים
- [x] ממשק ניהול: הוספה/הסרה/עריכה של תוכניות מנוי
- [x] תג מיוחד למנויים בתצוגת משתמשים
- [x] אפשרות הנחה/מבצע לתוכניות

### UI שיפורים
- [x] חלון "מה חדש" בדף הראשי (עריכה מהניהול, ניתן לסגור)

### אבטחה
- [x] helmet middleware (HTTP security headers)
- [x] rate limiting על API endpoints
- [x] input validation עם zod
- [x] IP anonymization בדוחות באגים

## בונוס מייל - מרץ 2026 (7)
- [x] לוגיקה: לחיצה על קישור בונוס במייל → אם מחובר → מקבל בונוס מיד + אנימציה
- [x] לוגיקה: לחיצה על קישור בונוס במייל → אם לא מחובר → פותח דיאלוג התחברות אוטומטית ואחרי כן ממש את הבונוס
- [x] תזכורת: אם המשתמש לא מימש את בונוס המייל → נקודה צהובה מפצפצת ליד יתרת אסימונים
- [x] תזכורת: אותה ההודעה גם בבאנר "אסימונים לא מספיקים"

## עיצוב מחדש דשבורד ניהול - מרץ 2026 (8)

- [ ] כותרת "משרד ניהול המערכת" בראש הדשבורד
- [ ] עיצוב מקצועי ויפה לכל הדשבורד
- [ ] לחצנים ברורים ומעוצבים
- [ ] רספונסיביות מלאה לאייפון - ללא חפיפת לחצנים

## תיקונים - מרץ 2026 (9)
- [ ] תיקון: face_detect לא שומר user_actions — הוסף שמירה אחרי ניכוי אסימונים
- [ ] תיקון: הודעת "מחכים לך 20 בונוס" — רק למי שקיבל מייל ולא אסף
- [ ] תיקון: "פנה לרובוטיקה וטכנולוגיה" → "יש לטעון אסימונים" + לינק לרכישה
- [ ] תיקון: הודעת ספאם — "אם לא קיבלת מייל בדוק בספאם" בקטן בלי אמוג'י

## תיקונים - מרץ 2026 (9)
- [x] תיקון face_detect: החזר אסימונים בשגיאה (לא רק בביטול)
- [x] תיקון hasPendingWelcomeBonus: מוצג רק למשתמשים שנרשמו עם מייל ועדיין לא מימשו
- [x] תיקון הודעות שגיאה: הסרת "פנה לרובוטיקה וטכנולוגיה" — הוחלף ב"יש לטעון אסימונים"
- [x] תיקון טקסט ספאם: "אם לא קיבלת מייל בדוק בספאם" — קטן ועדין
- [x] תיקון עמוד Tokens.tsx: לחצן WhatsApp הוחלף בלינק /buy

## תיקונים ופיצ'רים - מרץ 2026 (10)
- [ ] כפתור מחיקת משתמש בדשבורד ניהול (עם אישור)
- [ ] תיקון מייל ברוכים הבאים — טקסט כהה על רקע לבן (קריא)
- [ ] מייל תזכורת אוטומטי אחרי 48 שעות למי שלא מימש בונוס

## תיקונים ופיצ'רים - מרץ 2026 (10)
- [x] כפתור מחיקת משתמש בדשבורד ניהול (עם אישור)
- [x] תיקון מייל ברוכים הבאים — רקע לבן, טקסט כהה וברור
- [x] מייל תזכורת אוטומטי אחרי 48 שעות למי שלא מימש בונוס
- [x] באנר בונוס בדף הראשי לכל מי שלא מימש עדיין
- [x] עמודות reminderSentAt ו-language ב-app_users

## דף מחירים - מרץ 2026
- [x] בניית דף /pricing בעברית עם חבילות אסימונים
- [x] הוספת נתיב ב-App.tsx
- [x] קישור לדף מהדף הראשי ומהכותרת
- [x] תיקון: אחרי אימות מייל המשתמש לא נשאר מחובר

## שיפורי דף מחירים - מרץ 2026
- [x] הוספת ביקורות משתמשים (testimonials)
- [x] הוספת social proof (מספר משתמשים, המרות)
- [x] טבלת השוואה: ללא חבילה vs חבילה
- [x] שיפורי עיצוב ויזואלי
- [x] אנימציות ו-micro-interactions

## תיקוני דף מחירים - מרץ 2026 (סבב 2)
- [x] הוספת הערה לפני תנאי שימוש: זכות לסגור אתר, להחזיר אסימונים ולתת זיכוי כספי על האסימונים הנותרים
- [x] עדכון מחירים: מחיר לפעולה (לא לאסימון)
- [x] הוספת "חשבונית מס" לרשימת הכלולים בחבילות הנוכחיות
- [x] עדכון הצעת הערך: "שלם לפי שימוש או מנוי" (לא "ללא מנוי")
- [x] הסרת סטטיסטיקות לא מדויקות
## עיצוב מחדש דף מחירים - מרץ 2026 (סבב 3)
- [ ] עיצוב נקי ומינימלי — ללא hero גדול מדי
- [ ] שני מסלולים ברורים: לפי שימוש (אסימונים) + מנוי חודשי (בקרוב)
- [ ] תג "רכישה מאובטחת PayPal" בולט
- [ ] הסרת ביקורות מזויפות / סטטיסטיקות לא מדויקות
- [ ] הערה משפטית בפוטר (זכות סגירה + זיכוי)

## דף נחיתה - מרץ 2026
- [ ] בניית דף /landing בעברית
- [ ] Hero עם כותרת חזקה + CTA
- [ ] גלריית לפני/אחרי (5 זוגות)
- [ ] דוגמאות AI Create (קורטינה, מנדלה, נשר)
- [ ] איך זה עובד (3 שלבים)
- [ ] יתרונות (4-5 עם אייקונים)
- [ ] ביקורות
- [ ] מחירים inline (אסימונים + מנוי בקרוב)
- [ ] CTA סופי
- [ ] הוספת נתיב /landing ב-App.tsx

## עדכון דף Landing - מרץ 2026

- [x] הוספת 3 תמונות לפני/אחרי חדשות: חתול, אופנוע, טוקן (8 סה"כ)
- [x] העלאת כל תמונות ה-AI Create (15 דוגמאות) ל-CDN
- [x] שינוי קטע AI Create מ-carousel ל-grid של 15 דוגמאות
- [x] עדכון כל כרטיסי AI Create עם טקסט עברי "נכתב: ..."
- [x] עדכון Benefits: הסרת "מהיר כברק", הוספת "עיבוד מקצועי ומדויק"
- [x] עדכון Benefits: הוספת "שיטת תמחור גמישה" במקום "אסימונים לא פגים"
- [x] עדכון Pricing: הסרת "אסימונים לא פגים" מרשימת הכוללים
- [x] עדכון Pricing subtitle: "שיטת תמחור גמישה — לפי המרה בודדת או מנוי חודשי"
- [x] הוספת קטע Contact CTAs: כפתור "השאר פרטים" + כפתור WhatsApp דינמי
- [x] חיבור WhatsApp ואימייל לנתוני הגדרות ניהול (trpc.contact.info)
- [x] הוספת WhatsApp button לניווט העליון

## עדכון גלריה ו-AI Create - מרץ 2026 (בקשה 2)

- [x] הוספת כיתוב מתאים לכל תמונה בגלריה לפני/אחרי (שם + תיאור)
- [x] יצירת תמונת AI Create חדשה: "סגר מקצועי" (16 דוגמאות סה"כ)
- [x] העלאת תמונת הסגר ל-CDN
- [x] הוספת כרטיס 16 לגריד AI Create

## תיקונים - מרץ 2026 (המשך)

- [x] הסתרת כפתור מצב מפורט מה-UI (מצב פשוט בלבד)
- [x] תיקון פרומפט חיות: לשמור על פרצוף/פרופורציות אמיתיות, לא לסגנן לקריקטורה

## תיקונים - מרץ 2026 (גרסה ומחיקה)

- [x] הצגת מספר גרסה נוכחית בדף הניהול (/admin)
- [x] תיקון DXF לא נפתח בקורל דרו — בדיקת תאימות פורמט

## תיקונים - מרץ 2026 (היסטוריית פעולות)

- [x] תיקון: פעולת ai_trace לא נרשמת בהיסטוריה כשמשתמש מנתק לפני סיום ה-job — רשום פעולה מיד אחרי ניכוי טוקנים

## תיקונים - מרץ 2026 (פעולות + ספירה לאחור)

- [ ] תיקון: רשום פעולה מיד אחרי ניכוי טוקנים בכל הפיצרים (generateRoute, uploadRoute, faceDetectRoute, aiDocumentRedrawRoute, aiRefineRoute)
- [ ] הוספת ספירה לאחור אנימטיבית (ללא טקסט שניות) במהלך עיבוד AI (~40 שניות)

## תיקונים - מרץ 2026 (ניכוי + כשלונות)

- [x] ניכוי אסימונים רק אחרי job מוצלח — aiTraceRoute, faceDetectRoute, aiDocumentRedrawRoute
- [x] טבלת failed_jobs בDB: userId, feature, duration, error, imageUrl, createdAt
- [x] רישום כשלונות ב-failed_jobs בכל route אסינכרוני
- [x] פאנל "כשלונות" בדף ניהול: מי, כמה זמן, למה נכשל, תמונה

## תיקונים - מרץ 2026 (תמונת מקור בכשלונות)

- [x] הוספת sourceImageUrl לכשלונות ב-faceDetectRoute ו-aiDocumentRedrawRoute
- [x] הצגת תאריך ושעה של הגרסה הנוכחית בדף הניהול
- [x] בדיקת באנר אסימונים במייל — לוודא שמוצג ללקוחות שלא מימשו
- [x] הצגת תאריך ושעה של גרסה בדף ניהול

## תיקונים - מרץ 2026 (היסטוריה)

- [x] תמונת מקור לא מוצגת בחלק מכרטיסיות ההיסטוריה (אייקון שבור)
- [x] טקסט "dxfai.net" מופיע בתוך כרטיסיית היסטוריה — להסיר
- [x] בדיקה: bayazi@walla.com לא קיבל מייל איפוס סיסמא — לאתר סיבה ולתקן

## תיקון היסטוריית AI Create - מרץ 2026

- [x] תיקון כפילויות: preliminary action ללא groupId יוצרת כרטיסייה ריקה נפרדת — לאחד עם 3 הוריאציות לכרטיסייה אחת

## חיבור דיווח באגים אוטומטי - מרץ 2026

- [ ] יצירת hook useBugReport לדיווח אוטומטי
- [ ] חיבור לכשל המרה (convert/upload)
- [ ] חיבור לכשל AI jobs (ai_generate, ai_trace, portrait, document_redraw)
- [ ] חיבור לכשל הורדת DXF

## מחירון דינמי - מרץ 2026

- [x] הוספת טבלת token_pricing ל-DB עם שם פעולה, עלות, תיאור עברית/אנגלית
- [x] נוהל admin לניהול מחירון (קריאה + עדכון)
- [x] נוהל public לקריאת מחירון
- [x] לשונית "מחירון" בתפריט הראשי
- [ ] חיבור עלות דינמית לכפתורי הפעולות בכל הטאבים
- [x] עדכון עמוד המחירים להציג עלויות דינמיות

## תיקון מחירון - מרץ 2026

- [x] הסר "המרת תמונה ל-DXF" (חינם) מהמחירון
- [x] שנה שם "AI מתמונה לעיצוב" ל-"AI Outline"
- [x] שנה שם "עידון עיצוב AI" ל-"תיקון עיצוב עם AI"

## עיצוב מחדש פעולות אחרונות בניהול - מרץ 2026

- [x] הוסף עמודות שם משתמש ומייל לפעולות אחרונות
- [x] IP מוסתר כברירת מחדל עם כפתור הצגה
- [x] כל שורה בקיפול (accordion) - פותחים ורואים פרטים

## תיקון פעולות אחרונות - מרץ 2026 (2)- [x] החלף usageEvents ב-userActions כדי שמשתמשים לא יופיעו כו-"אורח"
- [x] הוסף כפתור קיפול/פתיחה לסקשן הפעולות כולו

## שם חובה בהרשמה - מרץ 2026

- [x] שדה שם חובה בהרשמה - לא ניתן להמשיך ללא שם

## תיקון ניהול - מרץ 2026 (3)

- [x] הסר טבלת פעילות אחרונה מהסקירה הכללית
- [x] תקן הצגת זמן יחסי - "לפני 1903 דקות" → "לפני 32 שעות" / "לפני 2 ימים"

## תיקון סקירה כללית - מרץ 2026 (4)

- [x] הסר גרף פעילות 30 ימים מהסקירה הכללית
- [x] בדוק מדוע IP נעלם בכרטיסיית הפעילות

## חיבור IP לפעולות - מרץ 2026

- [x] חבר ipAnon לכל ה-routes (convert, AI trace, AI generate, AI refine, face detect, AI document redraw)
- [x] ודא כפתור הצגה/הסתרה IP בכרטיסיית הפעילות

## תיקון הצגת IP - מרץ 2026

- [x] הצג שורת IP תמיד בפעילות אחרונה (גם כשריק) כדי שכפתור הצגה יהיה גלוי

## תיקונים - מרץ 2026 (המשך)

- [x] תיקון תאריך/שעה קשיחים בכותרת ניהול — הזרקת git hash + build time דרך vite.config define
- [x] הוספת legend לנקודות צבעוניות בסקשן משתמשים (ירוק/צהוב/כחול/אפור) עם הסבר
- [x] הוספת נקודה כחולה למשתמשים חדשים (נרשמו ב-48 שעות האחרונות)

## הסרת מחירים ומנויים מהדפים הציבוריים

- [x] הסרת כפתור "💎 מחירון" מ-header ב-Home.tsx
- [x] הסרת SaleBanner (באנר מבצע) מ-Home.tsx
- [x] הסרת TokenPricingModal מ-Home.tsx (import + render)
- [x] הסרת pricingModalOpen state מ-Home.tsx
- [x] הסרת סקשן "המנוי שלי" מ-Account.tsx
- [x] הסרת pricing section ו-subscription teaser מ-Landing.tsx

## ניסוי - מצב מפורט עם קווים פתוחים

- [x] הוסף פרמטר `forceOpenPaths` ל-svgToDxf שמאלץ closed=false על כל הנתיבים
- [x] הוסף פרמטר `openLinesMode` ל-aiTraceRoute שמופעל כשvariationIndex=1 (מפורט)
- [x] שלח `openLinesMode=true` מ-AiTraceTab כשdetailLevel=1 (אין צורך בשינוי פרונטאנד — isDetailedMode מוגדר סרברית)

## הוספת כפתור מצב מפורט מחדש

- [x] הצג שני כפתורים (פשוט + מפורט) ב-AiTraceTab במקום כפתור אחד בלבד

## ביטול ניסוי קווים פתוחים במצב מפורט

- [ ] בטל forceOpenPaths בsvgToDxf ובaiTraceRoute — קווים סגורים עדיפים

## שיפור איכות מצב מפורט

- [x] חידוד (sharpen) ושיפור ניגודיות התמונה הבינארית לפני potrace במצב מפורט
- [x] כוונון פרמטרי potrace במצב מפורט (alphamax, opttolerance) לקווים חלקים יותר

## שחזור מחירון בתוך האתר (לא בדף נחיתה)

- [x] החזר כפתור "💎 מחירון" להדר ב-Home.tsx
- [x] החזר סקשן "המנוי שלי" ל-Account.tsx
- [x] השאר Landing.tsx ללא מחירים (כמו שהוסר)

## תיקון לוג פעולות חסר

- [x] בדוק למה user_actions לא נרשמות כשאסימונים מנוכים
- [x] תקן את הרישום כך שכל ניכוי אסימונים ישמור גם פעולה ב-user_actions

## ניכוי אסימונים רק אחרי הצלחה

- [x] בדק כל route ומצא היכן deductTokens נקרא לפני התוצאה
- [x] generateRoute: העבר deductTokens לאחר שה-job הצליח (בתוך runGenerateJob) + הסרת refund מה-cancel
- [x] faceDetectRoute: כבר תקין (checkOnly לפני, ניכוי אחרי הצלחה)
- [x] uploadRoute: לא מנכה טוקנים (משתמש במכסה יומית בלבד)
- [x] aiTraceRoute: כבר תקין (checkOnly לפני, ניכוי אחרי הצלחה)
- [x] aiRefineRoute: תוקן — checkOnly לפני, ניכוי אחרי הצלחה
- [x] aiDocumentRedrawRoute (refine): תוקן — checkOnly לפני, ניכוי אחרי הצלחה
- [x] הסרת refund מה-cancel endpoints (לא צריך כי לא ניכו טוקנים עד הצלחה)
- [x] 148 בדיקות עוברות כולל 8 בדיקות חדשות לאימות היגיון

## תצוגת לפני/אחרי בפורטרט

- [x] מצא את קומפוננט תצוגת תוצאת הפורטרט
- [x] בנה קומפוננט BeforeAfterSlider עם divider גרירה (מקור מימין, וקטור משמאל)
- [x] שלב את ה-slider בתצוגת תוצאת הפורטרט (ברירת מחדל כשיש תמונה מקורית)
- [x] תמיכה ב-touch (מובייל) וב-mouse (דסקטופ)

## בדיקת אסימונים לפני עיבוד + באגים

- [ ] בדוק את זרימת checkOnly בכל route — האם הבדיקה קורית לפני שמתחיל עיבוד כלשהו
- [ ] תקן race condition: checkOnly חייב להיות synchronous לפני כל עיבוד
- [ ] בדוק מנגנון שליחת באגים — מתי נשלח, איך מחובר

## הוספת bug reporting לפיצ'רים חסרים

- [x] הוסף reportBug ל-FaceDetectTab על שגיאות עיבוד (לא שגיאות אסימונים)
- [x] הוסף reportBug ל-AiDocumentRedrawTab על שגיאות עיבוד (לא שגיאות אסימונים)
- [x] הוסף reportBug ל-CorrectionPanel (תיקון AI בסקיצה) על שגיאות עיבוד

## עיצוב מחדש תצוגת פורטרט — 3 כרטיסים כמו AI מתמונה

- [x] הצג 3 כרטיסי תמונה (פשוט/מפורט/אמנותי) כמו AiTraceTab
- [x] כרטיס לפני/אחרי בראש (תמונה מקורית vs וקטור)
- [x] לחיצה על "וקטור" פותחת SVG viewer inline למטה הכרטיס
- [x] כל כרטיס מציג מספר קווים ותג סגנון

## תג "מומלץ" ואנימציה מדורגת בפורטרט

- [x] הוסף תג "מומלץ" לכרטיס הראשון (פשוט) בפורטרט
- [x] הוסף אנימציית fade+slide מדורגת לכרטיסי תוצאה (delay 0/120/240ms)
- [x] SVG viewer: ברירת מחדל מילוי שחור, כפתור "◻ קווים" למעבר לתצוגת קווים בלבד

## באגים לתיקון

- [x] היסטוריה לא שומרת תמונות — תוקן: svgPreview שונה ל-MEDIUMTEXT (16MB)
- [x] היסטוריה לא שומרת תמונות ממצב תמונה (AI Outline) — אותה תיקון
- [x] שגיאה בייצוא PDF — תוקן: SVG sanitization בשרת + בלקוח
- [x] הוסף כפתורי DXF ו-PDF ברורים לכל פריט בהיסטוריה
- [x] תקן שגיאת PDF export (SVG corrupt header) — sanitization בשרת ובלקוח

## תיקונים - מרץ 2026 (3)

- [x] פורטרט: שיפור prompt לנאמנות גבוהה לפנים אמיתיות + quality medium
- [x] שגיאת PDF ייצוא — תוקן: Safari-safe regex sanitization
- [x] מילוי שחור בוקטור — תוקן: הזרקת CSS style tag במקום regex

## תיקון PDF ייצוא — שגיאת XML corrupt header (מרץ 2026)

- [x] תקן SVG sanitization בשרת — regex לתיקון תגיות לא סגורות + svgo לניקוי XML מלא

## בוחר צבע מילוי ב-SVG viewer

- [x] צבע שחור בלבד (ללא בוחר צבעות)
- [x] כפתור ◼ מילוי / ◻ קווים בכל 3 הטאבים (AI Outline, Portrait, AI Document Redraw)

## תיקון PDF ומילוי שחור בהיסטוריה (מרץ 2026)

- [x] תקן handlePdf בהיסטוריה — עכשיו משתמש ב-generateAndDownloadPdf (jsPDF) במקום לשמור PNG כ-PDF
- [x] הוסף מילוי שחור לתצוגת SVG בכרטיסי ההיסטוריה (GroupCard + SvgViewer)
- [x] תקן lookbehind regex ב-ExportButtons ו-DxfDownloadDialog להיות Safari-compatible

## תיקון PDF - שגיאת XML parse "Couldn't find end of Start Tag path" (מרץ 2026)

- [ ] תקן סניטיזציה בשרת - הרגקס הנוכחי לא תופס את כל המקרים של path לא סגור
- [ ] השתמש ב-DOMParser/xmldom בשרת לתיקון XML אמיתי במקום regex

## תיקון PDF - שגיאת XML parse (root cause נמצא)
- [x] גילוי: inputSanitizer חותך strings ל-10,000 תווים — SVG של 420k תווים נחתך
- [x] פתרון: פטור /api/svg-to-png מ-inputSanitizer (SVG יכול להיות 500k+ תווים)
- [x] פתרון: state-machine parser לתיקון void elements לא סגורים (path, circle וכו')
- [x] הסרת תלות ב-xmldom (גרמה לבעיות depth/self-closing)

## תיקון כפתורי זום ומילוי ב-SVG Viewer
- [x] הפרדת כפתורי זום ממתג המילוי — כרגע מתג המילוי צובע גם כפתורי זום
- [x] עיצוב מחדש של כפתורי הזום ומילוי — נוח לאייפון (גדול יותר, ברור יותר)
- [x] שיפור כל ה-SVG viewers בכל הפיצ'רים (Home, History, AiTraceTab, AiDocumentRedrawTab, FaceDetectTab)

## תיקון CSS bleeding - כפתורי זום נצבעים שחור
- [x] CSS fill:black מחיל על כל ה-paths בדף כולל Lucide icons
- [x] פתרון: scoped CSS classes (svg-viewer-fill / svg-viewer-outline) ב-index.css - חל רק על SVG בתוך wrapper div

## תיקון זום + גרירה ב-SVG Viewers
- [ ] תיקון גרירה בזמן זום — כרגע אי אפשר להזיז אובייקט בזמן זום
- [ ] שיפור חוויית הזום — pinch-to-zoom + drag נוח ב-iOS
- [ ] מחקר שיפור מהירות OpenAI API

## תיקון גרירה ב-SVG Viewer — מרץ 2026

- [x] תיקון גרירה בזמן זום — pan עובד תקין בכל מצבי זום
- [x] שיפור pinch-to-zoom ב-iOS — גרירה ו-zoom עובדים יחד

## תיקון טשטוש SVG בזום — מרץ 2026

- [x] תיקון: SVG מתטשטש בזום כי מוצג כביטמאפ — לוודא שה-SVG מרונדר כ-vector אמיתי

## תיקון iOS touch + vector rendering — מרץ 2026
- [x] תיקון נעילת גרירה ב-iOS — אצבע נתקעת בזמן מעבר בין drag ל-pinch
- [x] וידאור זום vector אמיתי — לא CSS scale על bitmap

## גרירה = הזזה בלבד — מרץ 2026

- [x] נגיעה/גרירה = הזזה בלבד (ללא pinch-to-zoom) — זום רק עם כפתורים ו-scroll

## תיקונים מרץ 2026 — סבב חדש

- [x] 1. DXF קווים סגורים לקורל דרו — סגור paths כדי שצביעה תעבוד ב-CorelDRAW/Flexi
- [x] 2. שחזור זום טוב — ראה היסטוריה של היום (viewBox approach + כפתורים בלבד)
- [x] 3. AI מתמונה — לצייר מה שרואים בלבד, לא לפרש. אם מבולבל — שגיאה + בקשת הסבר
- [x] 4. timeout 5 דקות מקס לעיבוד AI
- [x] 5. עיבוד ברקע — Job ממשיך גם כשסוגרים דפדפן, חוזרים ורואים תוצאה

## PDF vector + אנימציית עיבוד — מרץ 2026

- [x] PDF יוצא כ-vector אמיתי (לא תמונה rasterized) — paths אמיתיים ב-PDF
- [x] אנימציה יפה ומעניינת בזמן עיבוד AI — בכל הפיצרים (AI Outline, AI Create, Portrait)

## שיפורי אנימציית עיבוד — מרץ 2026 (סבב 2)

- [ ] שגיאת UNCLEAR_IMAGE — דיאלוג עם שדה טקסט לתיאור ידני
- [ ] אנימציה מסתובבת יפה עם שלבי התקדמות ברורים
- [ ] תיקון ספירת דקות — הזמן לא מתאפס בחזרה לדף

## תיקון SVG Viewer קריטי — מרץ 2026

- [x] גרירה לא עובדת — אובייקט לא זז בגרירה
- [x] מסך שחור — SVG לא מוצג (רקע שחור ללא תוכן)

## דיאלוג "תמונה לא ברורה" — מרץ 2026

- [x] הוסף דיאלוג עם שדה טקסט כשה-AI מחזיר UNCLEAR_IMAGE — משתמש מסביר מה לצייר ומנסה שוב

## תיקון גרירה iOS — מרץ 2026

- [x] גרירה לא עובדת ב-iPhone — זום עובד אבל אובייקט לא זז

## אנימציית עיבוד מרשימה — מרץ 2026

- [x] עיצוב מחדש AiProcessingAnimation — ויזואלים מגניבים, מוזיקת רקע, שלבי התקדמות, סקאלה 41 שניות

## תיקון גרירה SVG viewer — מרץ 2026 (סבב 2)

- [x] אובייקט לא זז בגרירה ב-iPhone (ובדסקטופ?)

## עיצוב מחדש אנימציית עיבוד — מרץ 2026 (סבב 2)

- [x] רקע בהיר, נקי, קלאסי AI — לא כהה
- [x] סריקה על התמונה (scan beam)
- [x] ספינר מעוצב יפה ומגניב
- [x] 4 שלבי התקדמות ברורים
- [x] כפתור "בטל והחזר אסימונים"
- [x] צלילים עדינים ומסקרנים (ברירת מחדל כבוי)

## תיקון DXF לקורל דרו — מרץ 2026

- [x] קובץ DXF לא נפתח בקורל דרו — לתקן פורמט DXF לתאימות מלאה

## בדיקת מערכת תרגום — מרץ 2026

- [ ] בדיקה: למה תרגום לא משתנה לפי אזור/משתמש

## תיקוני ממשק ניהול - מרץ 2026

- [x] תיקון: היסטוריית פעולות למשתמש לא מוצגת בטאב "פעולות" (userActionsData מוגבל ל-500 הפעולות האחרונות בלבד — לא מסונן לפי משתמש בנפרד)
- [x] הוספת שעה לתאריך הרשמה ולתאריך כניסה אחרונה בכרטיס משתמש
- [ ] הוספת "לקוח אחרון נרשם" עם תאריך + שעה בסקירה הכללית
- [x] בדיקה ותיקון: פעולות מסוימות לא נרשמות בטבלת user_actions (ניכוי אסימונים מופיע אבל אין רשומה בהיסטוריית פעולות)
- [x] וידוא ותיקון: כל הפעולות בכל הפיצ'רים נרשמות בהיסטוריה (כולל כישלונות/ביטולים)
- - [x] רישום פעולות כושלות/מבוטלות בטאב "פעולות" של המשתמש (status=failed/cancelled))
- [x] הצגת פעולות כושלות גם בטאב "באגים" בניהול
- [x] תיקון באג: ניכוי אסימונים לא נרשם ב-token_transactions כשפעולה מבוטלת/נכשלת (רק ההחזר נרשם)
- [x] תיקון: משתמשי Google/Manus OAuth מקבלים 20 אסימונים במקום 10 — לאחד ל-10 לכולם

## תיקוני ניהול - מרץ 2026 (סבב 2)
- [ ] תיקון שגיאה: מחיקת חבילות מחירון אסימונים לא עובדת
- [ ] הוספת באנר מבצע בניהול כשחבילה מסומנת כ"מבצע"
- [ ] הצגת ביקורי אורחים (ללא הרשמה) בניהול — כמה ביקרו ומאיזו מדינה
- [ ] תיקון: אין כפתור "סגור/בטל" בעריכת עלות טוקנים לפעולה (מחירון מרות)
- [ ] הוספת כפתור מחיקה לפעולות בסעיף "עלות טוקנים לפעולה (מחירון מרות)" בניהול
- [ ] הוספת כפתור "הוסף פעולה" לסעיף "עלות טוקנים לפעולה (מחירון המרות)" בניהול
- [ ] בדיקה ותיקון: מחירון עלות טוקנים מחובר נכון לגביית אסימונים בכל הפעולות (convert, ai_trace, ai_generate, face_detect, document_redraw)

## שיפורי פאנל ניהול - מרץ 2026 (המשך)

- [x] כפתור מחיקה לכל פעולה בקטע "עלות טוקנים לפעולה"
- [x] כפתור "הוסף פעולה חדשה" בקטע עלות טוקנים
- [x] הצגת badge/הנחה/תמונה בכרטיסי חבילות (אינדיקטור ויזואלי)
- [x] מערכת אנליטיקת מבקרים: טבלת visitor_events בDB
- [x] Backend: procedure לרישום ביקורים (trackVisit) עם זיהוי מדינה מ-Cloudflare header
- [x] Frontend: VisitorTracker component ב-App.tsx שמרשם כל ניווט
- [x] Admin: כרטיס "אנליטיקת מבקרים" בסקירה הכללית — ביקורים היום, סשנות ייחודיות, לפי מדינה, לפי עמוד

## תיקון קישור בונוס ממייל

- [x] כשמגיעים לאתר עם ?campaign=welcome_bonus_2026 ולא מחוברים — לפתוח אוטומטית חלון כניסה

## Session 3 - Portrait & Video Fixes

- [x] Generate 4 new DXF portrait line art images in correct style (thin lines, face+shoulders, white bg, like IMG_3911 example)
- [x] Fix portrait card image proportions to match drill card format (square crop, consistent aspect ratio)
- [x] Upload new portrait images to CDN and update Landing.tsx URLs
- [x] Create new demo video: 2 examples per feature, iPhone typing sounds, magic sound, pleasant modern music
- [x] Upload new video to CDN and update landing page video reference

## Session 5 - Multi-object handling
- [ ] Replace "unclear image" dialog with multi-object flow: crop tool + "Draw all" button
- [ ] Built-in crop tool: user drags rectangle to select specific object, then traces only that crop
- [ ] "Draw all" button: traces the full image with all objects (fullImageMode)

## תיקון כלי חיתוך - מרץ 2026

- [x] תיקון באג: מלבן הבחירה מופיע במקום הלא נכון בכלי הגרירה (MultiObjectDialog)

## תיקונים נוספים לכלי חיתוך ודיאלוג - מרץ 2026

- [x] תיקון כלי חיתוך: הסלקציה עדיין מוסטת/מוגדלת לא נכון
- [x] דיאלוג ריבוי אובייקטים: להציג כ-modal צף מעל התמונה (לא מתחתיה)
- [x] דיאלוג ריבוי אובייקטים: עיצוב משופר יותר
- [x] תיקון: AI נותן שוב שגיאת ריבוי אובייקטים אחרי שהמשתמש כבר בחר אפשרות

## תיקון כלי חיתוך - offset עדיין קיים

- [x] תיקון סופי: הסלקציה מוסטת כי הקנבס נמדד לפני שה-modal מסיים להיטען - להשתמש ב-ResizeObserver

## תיקון offset קנבס - ניסיון נוסף

- [x] תיקון סופי: הקנבס מוצג בגודל שונה ממה שמחושב - להשתמש ב-w-full על הקנבס ולמדוד את ה-getBoundingClientRect שלו ישירות

## תיקון כלי חיתוך - גישה חדשה לגמרי

- [x] החלפת canvas בגישת img + div overlay - ללא חישובי קואורדינטות

## באג: שגיאת ריבוי אובייקטים חוזרת אחרי גזירה ספציפית

- [x] תיקון: אחרי שמשתמש בוחר "גזור אובייקט ספציפי" ומאשר, ה-AI עדיין מחזיר שגיאת UNCLEAR_IMAGE

## מניעת ניצול לרעה של מחיר תיקון

- [x] מניעת שימוש ב-ai_refine (2 אסימונים) ליצירת תמונה חדשה לגמרי במקום תיקון

## בדיקה מוקדמת לתיקון AI

- [x] הוספת בדיקת AI לפני עיבוד תיקון - אם הבקשה היא ליצירה חדשה לגמרי, להחזיר שגיאה ברורה ללא גביית אסימונים

## באג: גזירה לא נשלחת לשרת

- [x] תיקון: אחרי גזירה, התמונה הגזורה לא נשלחת לשרת - השרת מקבל את התמונה המקורית ורק focusText
- [x] בדיקת איכות גזירה - לוודא שהגזירה שומרת על רזולוציה גבוהה

## באג: אחרי גזירה AI מצייר הכל

- [x] תיקון: אחרי גזירה ה-AI מצייר את כל האובייקטים ולא רק את הנבחר - צריך לחזק את ה-prompt

## הגבלת timeout לכל הפיצ'רים

- [x] ביקורת ותיקון: לוודא שכל פיצ'ר מוגבל ל-5 דקות עיבוד ברקע

## שדרוג timeout

- [ ] שדרוג timeout של Convert מ-45 שניות ל-5 דקות
- [ ] הוספת timeout של 5 דקות ל-aiRefineRoute (סינכרוני)

## כלי חיתוך זמין תמיד - מרץ 2026

- [x] הוספת כפתור "חתוך אזור" ליד תמונה שהועלתה ב-AiTraceTab (לא רק כשה-AI מזהה בעיה)
- [x] פתיחת מסך חיתוך inline (לא modal) כשלוחצים על הכפתור
- [x] שליחת האזור המסומן בדיוק לשרת עם CROPPED_SELECTION flag (דילוג על multi-object detection)
- [x] תמיכה בחיתוך שמכיל מספר דמויות (המשתמש מחליט מה לכלול בחיתוך)
## באגים - מרץ 2026 (חיתוך)

- [x] תיקון: לאחר חיתוך, עיבוד תקוע ב-95% ולא מסיים (CROPPED_SELECTION גורם ל-hang)
- [x] שיפור: כפתור חיתוך בולט יותר בממשק

## הודעות UX - מרץ 2026

- [x] Add multi-face processing time warning in portrait tab (more faces = longer processing)
- [x] Add 50-second patience message in AI trace/outline tab ("עוד רגע זה מוכן...")
- [x] Fix multi-face bug: only 1 face returned when 2 faces in image (adult + baby/child)
- [x] AI Trace tab: detect faces on image upload, ask user if they want portrait mode (yes=portrait, no=continue trace)
- [ ] Fix announcement banner mixed Hebrew/English text when language is English
- [x] Fix face detection dialog not showing (quick-check endpoint required auth, Manus OAuth users got 401)
- [ ] Fix face detection dialog Yes/No flow - Yes should switch to portrait tab with image, No should trace normally
- [x] Add brand name detection in AI Create - block trademarked brands with clear error message
- [x] Add progress bar with percentage and elapsed time to AI Create tab (like AI Trace)
- [x] Fix AI Create error message - show friendly Hebrew/English message instead of raw OpenAI error
- [x] Add Hebrew brand names to block list (דיסני, נייקי, אפל, etc.)

## CNC 3D Relief Feature
- [x] Backend: POST /api/cnc-relief/from-image — upload image → generate heightmap PNG + engraving simulation
- [x] Backend: POST /api/cnc-relief/from-prompt — text prompt → generate heightmap PNG + engraving simulation
- [x] Backend: Support material parameter (wood, aluminum, mdf, stone, brass) for simulation style
- [x] Backend: Job polling endpoint GET /api/cnc-relief/job/:jobId
- [x] Backend: Add token cost for cnc_relief action in token_costs table (4 tokens)
- [x] Frontend: CncReliefTab component with two sub-modes (from image / from prompt)
- [x] Frontend: Material selector buttons (Wood, Aluminum, MDF, Stone, Brass)
- [x] Frontend: Show heightmap + simulation side by side with download buttons
- [x] Frontend: Progress animation during generation
- [x] Frontend: Add CNC Relief tab to Home.tsx navigation
- [x] Frontend: Add translations (he/en/zh/es/fr/ar/ru) for all new strings
- [x] Frontend: Add CNC Relief demo banner with horse examples

## CNC Relief - Coming Soon Mode
- [x] Set CNC Relief tab to disabled/coming soon state like AI Sketch tab

## שינויים - מרץ 2026 (בקשה נוכחית)

- [x] סדר כרטיסיות: AI יצירה → AI Outline → פורטרט → AI סקיצה (תחזוק) → CNC תבליט (בקרוב)
- [x] החלפת Hero Section (כותרת + קרוסלה) ב-placeholder אפור
- [x] שמירת תמונות קרוסלה להורדה

## CNC Relief Tab Updates (מרץ 2026)
- [ ] Generate matching horse heightmap + wood carving simulation pair
- [ ] Fix CNC Relief before/after images to use matching horse pair
- [ ] Add size/DPI/aspect-ratio parameters to CNC Relief tab
- [ ] Update CNC Relief feature card color to match site palette (purple/blue)

## תיקון גריד גלריית CNC Relief - מרץ 2026

- [x] תיקון גריד גלריית CNC Relief לתמיד 2 עמודות על כל גודל מסך (שינוי מ-auto-fill minmax(180px) ל-repeat(2,1fr))

## תיקוני מובייל - מרץ 2026

- [x] תיקון גלריית DXF demo — 2 עמודות על מסך צר (BEFORE_AFTER + AI_EXAMPLES)
- [x] תיקון כפתור שפה ב-navbar — קומפקטי עם Globe + קוד קצר (EN/HE/RU...)
- [x] העלאת 22 תמונות WebP דחוסות ל-CDN (50-200KB במקום 4-7MB) ועדכון URLs ב-Landing.tsx
- [x] הוספת lightbox popup לגלריית BeforeAfterCard — לחיצה פותחת תמונה בגדול לתצוגה ברורה של DXF
- [x] כיווץ כל תמונות PNG כבדות ל-WebP והעלאה ל-CDN (לייזר, פורטרטים, דמו, לוגו) — דף ירד מ-87MB ל-~3MB
- [x] תיקון תמונות וקטור נעלמות בגלריית BeforeAfterCard — כיווץ עם רקע לבן (RGBA→RGB) ועדכון URLs
- [x] כיווץ תמונות before-JPG (8 תמונות 4-8MB) ו-AI Examples PNG (14 תמונות 1.5-5.6MB) ל-WebP
- [x] תיקון גריד גלריה בדסקטופ — auto-fill minmax(220px) = 2 עמודות במובייל, 4+ בדסקטופ
- [x] תיקון גלריית CNC Relief — minmax(160px) = 2 עמודות על כל אייפון (375px+)
- [ ] הוספת סימן Google בדף ניהול משתמשים — אייקון G ליד משתמשים שהתחברו דרך Google OAuth

## מערכת דיווח בעיות - מרץ 2026

- [x] טבלת issue_reports ב-DB (sourceImageUrl, resultImageUrl, feature, description, status, tokensRefunded)
- [x] tRPC procedure: issueReports.submit (משתמש מחובר שולח דיווח)
- [x] tRPC procedure: issueReports.list (ניהול — רשימת דיווחים לפי סטטוס)
- [x] tRPC procedure: issueReports.counts (ניהול — ספירת דיווחים לפי סטטוס)
- [x] tRPC procedure: issueReports.approve (ניהול — אישור + זיכוי אסימונים)
- [x] tRPC procedure: issueReports.reject (ניהול — דחיית דיווח)
- [x] רכיב ReportIssueButton — כפתור קטן + dialog עם תמונות + הסבר על זיכוי
- [x] הוספת ReportIssueButton לכל הפיצ'רים: AiTraceTab, AiGeneratorTab, FaceDetectTab, CncReliefTab, Convert
- [x] דף ניהול "דיווחי בעיות" ב-Admin.tsx עם פילטר סטטוס, תמונות, אישור/דחייה
- [x] Badge אדום על כפתור הניהול כשיש דיווחים ממתינים

## תיקון לולאת כניסה - מרץ 2026

- [x] תיקון: שינוי redirect מ-301 (cached) ל-302 (לא cached) כדי למנוע לולאת ניתוק לאחר כניסה מ-dxfai.net

## דיאלוג הורדה (Save As) - מרץ 2026

- [x] יצירת פונקציית עזר saveFileAs - פותחת דיאלוג "שמור בשם" במחשב ואנדרואיד, ב-iOS ישאר כרגיל
- [x] החלפת כל הורדות DXF/PDF בכל הפיצ'רים לשימוש בפונקציה החדשה (ExportButtons, DxfDownloadDialog, CncReliefTab, Share.tsx)

## פילטר זמן בפעולות אחרונות - מרץ 2026

- [x] הוספת כרטיסיות זמן (יום/שבוע/חודש/הכל) בניהול - פעולות אחרונות, ברירת מחדל יום אחרון
- [x] עדכון server query לקבל פרמטר timeRange

## הסרת וידאו מדף נחיתה - מרץ 2026

- [x] הסרת demo-video מ-Landing.tsx לשיפור ביצועים

## דחיסת סרטון דמו - מרץ 2026

- [x] דחיסת demo-video מ-2.6MB ל-998KB WebM (CRF42 720p) - חיסכון 62%
- [x] החזרת הסרטון לדף הנחיתה עם lazy load (IntersectionObserver)

## Security Headers - מרץ 2026

- [x] הוספת CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy לשרת

## שיפור UX העלאת תמונה - מרץ 2026

- [x] שיפור אזורי העלאת תמונה - badge "העלה תמונה" על AI Outline ו-Portrait
- [x] הוספת טקסט הנחיה "בחר פיצ'ר להתחיל" מעל הכרטיסיות

## סרטון Click-to-Play - מרץ 2026

- [x] שינוי סרטון הדמו ל-click-to-play — נטען ומתנגן רק לאחר לחיצה, thumbnail מוצג בינתיים

## אופטימיזציית ביצועים — מרץ 2026

- [x] המרת 4 תמונות PNG של פורטרטים ל-WebP (חיסכון ~3.5MB: 1.2MB+944KB+870KB+837KB → 257KB+183KB+155KB+128KB)
- [x] הוספת Cache-Control headers לנכסים סטטיים (JS/CSS hashed: 1 שנה, תמונות: שבוע, HTML: no-cache)
- [x] הוספת lazy loading + decoding=async לכל תמונות הגלריה בדף הנחיתה

## שיפורי ביצועים מתקדמים — מרץ 2026 (סבב 2)

- [x] Code splitting: lazy loading לכל דפי App.tsx (Admin, History, Buy, Pricing וכו') — נטענים רק כשמנווטים אליהם
- [x] Manual chunks ב-vite.config.ts: pdf-export (jsPDF+svg2pdf+html2canvas) בחבילה נפרדת — bundle ראשי ירד מ-2.1MB ל-885KB
- [x] Preconnect ל-CDN (d2xsxph8kpxj0f.cloudfront.net) ב-index.html
- [x] Fonts non-blocking: Google Fonts נטען עם media=print → onload='all' (לא חוסם render)
- [x] הסרת Google GSI script מה-head וטעינה דינמית בלבד כש-AuthDialog נפתח — חיסכון 600ms render-blocking

## תיקון שגיאות content policy — מרץ 2026

- [x] תיקון טיפול בשגיאת content policy של AI — הצגת הודעה ברורה למשתמש במקום שהדף יתקע
  - aiTraceRoute: זיהוי CONTENT_POLICY errorCode + הודעה ידידותית בפולינג
  - aiRefineRoute: זיהוי content policy + החזרת 422 עם הודעה ברורה
  - aiDocumentRedrawRoute: הוספת זיהוי content policy בפולינג
  - cncReliefRoute: הוספת זיהוי content policy בפולינג
  - generateRoute: כבר היה מטופל נכון
  - AiTraceTab: הוספת isContentPolicy + שימוש ב-data.message
  - AiRefinePanel: הוספת טיפול ב-CONTENT_POLICY error

## תמיכה ב-CAS WIN — מרץ 2026

- [ ] הוספת endpoint /api/dxf-convert?url=... שממיר DXF ל-LINE entities (תואם CAS WIN / AutoCAD ישן)
- [ ] עדכון DxfDownloadDialog — הוספת בחירת פורמט: "DXF רגיל" / "DXF תואם CAS WIN"

## עיצוב מחדש דיאלוג הורדה — מרץ 2026

- [x] הוספת translations לכפתור CAS WIN בכל 7 שפות
- [x] endpoint /api/dxf-legacy בשרת (כבר נוצר)
- [x] עיצוב מחדש DxfDownloadDialog: תצוגה מקדימה + שם קובץ + גודל + בחירת פורמט בכרטיסיות (DXF / CAS WIN / PDF)

## Onboarding Spotlight Tour — מרץ 2026

- [x] הוספת translations לטיור (עברית + אנגלית)
- [x] בניית OnboardingTour component עם Spotlight ואנימציות
- [x] שילוב הטיור ב-App.tsx + הוספת id לכפתורי הfeatures
- [x] כרגע מופיע לכולם (לבדיקות) — בעתיד רק למשתמשים חדשים עד שישלימו feature אחד

## עדכון עיצוב טיור — מרץ 2026

- [x] הפיכת חלון הטיור לשקוף יותר (backdrop + רקע החלון)

## פילטר תקופה בהיסטוריה — מרץ 2026

- [x] עדכון server: הוספת period (day/week/month/all) ו-pagination לפרוצדורת history
- [x] עדכון History.tsx: כפתורי פילטר תקופה + pagination (עמוד הבא/הקודם)

## איחוד כפתורי הורדה — מרץ 2026

- [ ] עמוד ראשי: החלפת כפתורי PDF + DXF בכפתור "הורד קובץ" אחד שפותח DxfDownloadDialog
- [ ] היסטוריה: החלפת כפתורי PDF + DXF בכפתור "הורד קובץ" אחד שפותח DxfDownloadDialog

## עיצוב מחדש טיור onboarding — מרץ 2026

- [ ] חלון לבן בצד (לא שקוף/סגול) ללא רקע מאפיל
- [ ] הפיצר הרלוונטי מהבהב (pulse) בכל שלב

## תיקון 3 בעיות — מרץ 2026

- [ ] איחוד כפתורי PDF+DXF לכפתור "הורד קובץ" אחד שפותח DxfDownloadDialog (ExportButtons + History)
- [ ] הבהוב פיצרים רלוונטיים בהדרכה (pulse animation על הכרטיס המודגש)
- [ ] תיקון: הדרכה לא נפתחת בהתחברות לאתר

## שיפורי UX - מרץ 2026

- [x] איחוד כפתורי DXF + PDF לכפתור "הורד קובץ" אחד שפותח DxfDownloadDialog (History + ExportButtons)
- [x] עיצוב מחדש של OnboardingTour — פאנל לבן בפינה, ללא overlay כהה, עם pulse animation על האלמנטים
- [x] הטיור לא נפתח בהתחברות — שינוי מפתח localStorage ל-v2 כדי לאפס לכולם
- [x] הוספת כפתור "הצג מדריך" בתפריט המשתמש לפתיחה ידנית של הטיור
- [x] תמיכה ב-custom event 'tour:reset' לפתיחת הטיור מחדש מכל מקום

## הגדרות יצירת קשר - מרץ 2026

- [x] הוספת שדה contact_phone ל-systemSettings (key/value)
- [x] הוספת ממשק עריכה בניהול לפרטי יצירת קשר (וואצאפ, מייל, טלפון)
- [x] עדכון ContactButtons להציג גם כפתור טלפון
- [x] הוספת קישור יצירת קשר בתחתית הדף לכלל כולל מחוברים

## תיקון כפתורי יצירת קשר - מרץ 2026
- [x] תיקון: הוספת כפתור טלפון ל-CtaSection (קורא מה-DB)
- [x] הוספת כפתור טלפון ל-ContactButtons בפוטר
-- [x] הוספת ContactBar בתחתית הדף המחובר (וואצאפ, מייל, טלפון, שלח הודעה) מתחת ל-Tabs

## תיקון ContactBar - מרץ 2026
- [ ] מחיקת כפתור "שלח הודעה" כפול מ-ContactBar (הכפתור העליון)
- [ ] תיקון staleTime ל-0 כדי שהמייל/וואצאפ יוצגו מיידית אחרי עדכון בניהול
- [ ] בדיקת מייל ב-DB ותיקון אם לא עודכן
- [x] תיקון: contact.info procedure לא פרס נכון את result[0] מ-db.execute (mysql2 tuple)
- [x] הסרת כפילות: הסרת וואצאפ/מייל מ-CtaSection ומ-footer, נשאר רק ContactBar הלבן
- [x] שיפור מסגרת מהבהבת בטיור — צבע כתום/אדום, עבה 4px, glow effect
- [x] שינוי צבע pulse animation לירוק ניאון (#00ff88) עם glow כחול (#00e5ff), 5px, חזק ובולט
- [x] שינוי צבע כפתורי הבא/סיום בטיור לירוק ניאון — עקביות עם מסגרת המהבהבת
- [x] הוספת tour IDs לכפתור Pricing, מונה אסימונים ותפריט משתמש בלוח הראשי
- [x] הוספת שלבי טיור חדשים: קניית קרדיטים, מצב אסימונים, אזור אישי
- [x] תרגומים לשלבים חדשים בעברית ואנגלית
- [x] שינוי צבע כפתורי הבא/סיום בטיור לירוק ניאון
- [x] עדכון דומיין ראשי ל-dxfai.ai בכל הקבצים (index.html meta tags, og:url, canonical, אימיילים, emailService.ts)
- [x] תיקון באג double refund בפיצ'ר Portrait — refund רץ פעמיים כשפנים לא מזוהות
- [x] שיפור הודעת שגיאה כשפנים לא מזוהות — popup מרכזי + תיקון כתיב + טיפים
- [x] הוספת Google Tag AW-18000656977 ל-index.html
- [x] הוספת conversion event להרשמה (sign_up) בקוד הלקוח
- [x] הוספת conversion event לרכישת קרדיטים (purchase) בקוד הלקוח
- [x] הזזת כפתורי WhatsApp ומייל לתוך המלבן הכחול בתחתית הדף
- [x] הזזת כפתורי WhatsApp ומייל לתוך המלבן הכחול בתחתית הדף
- [x] הסרת כפתורי WhatsApp ומייל מ-ContactBar (האזור הישן) — ישארו רק במלבן הכחול

## תיקוני באגים - מרץ 2026

- [ ] פורטרט: כשמריצים job חדש, תוצאות ישנות נשארות מוצגות לצד תוצאות חדשות — צריך לנקות localStorage ו-state בתחילת כל job חדש

## זיהוי טקסט בתמונה - מרץ 2026

- [ ] שרת: endpoint לזיהוי טקסט בתמונה (OCR עם vision AI)
- [ ] UI: כשמעלים תמונה ב-AI Create — זיהוי טקסט אוטומטי
- [ ] UI: הצגת dialog "זיהיתי טקסט בתמונה" עם אפשרות לתקן/לאשר
- [ ] שרת: העברת הטקסט המאושר ל-prompt של יצירת AI עם הנחיה לכתוב בדיוק

## תיקון דיוק טקסט ב-AI - מרץ 2026

- [x] עדכון prompt ב-generateRoute: הוספת הנחיה מפורשת לכתוב טקסט בדיוק אות-באות כפי שהמשתמש הקליד
- [ ] עדכון prompt ב-aiTraceRoute: אותה הנחיה לטקסט מדויק

## hint טקסט מדויק ב-AI Create - מרץ 2026

- [x] הוספת hint בשדה הטקסט של AI Create: הסבר שימוש בגרשיים לטקסט מדויק

## תמיכה ב-PDF - מרץ 2026

- [x] הוספת endpoint בשרת להמרת PDF לתמונה (עמוד ראשון)- [x] עדכון AI Outline: קבלת PDF ושליחתו ל endpoint המרה לפני עיבוד- [x] עדכון AI Trace (Portrait): קבלת PDF ושליחתו ל endpoint המרה לפני עיבוד
- [x] עדכון ה-accept בכל שדות העלאת קבצים לכלול application/pdf

## קו יחיד ב-AI Outline - מרץ 2026

- [x] הוספת toggle "קו יחיד / קו כפול" ב-AI Outline
- [x] עדכון prompt בשרת: כשנבחר "קו יחיד" — AI מצייר centerline/skeleton strokes בלבד

## סגירת קווים פתוחים - מרץ 2026

- [x] הוספת לוגיקה לסגירת קווים פתוחים ב-SVG/DXF אחרי עיבוד AI (closePaths)
- [x] הוספת toggle "סגור קווים" ב-UI של AI Outline (מופיע כשקו יחיד פעיל)

## באג: קו יחיד תקוע - מרץ 2026

- [ ] תיקון: AI Outline במצב קו יחיד לא מסיים עיבוד — job תקוע

## Centerline Tracing אמיתי - מרץ 2026

- [x] מימוש skeletonization על תמונת ה-PNG לפני potrace כשsingleLine=true
- [x] חיבור: שימוש ב-centerline pipeline במקום ה-AI single-line prompt

## באג: תצוגה SVG לא ממלאת קופסה - מרץ 2026

- [x] תיקון: תצוגה מקדימה SVG מציגה רווח לבן גדול מתחת לציור — viewBox גדול מהתוכן

## שיפור נאמנות לתמונות שחור-לבן - מרץ 2026

- [x] זיהוי תמונת שחור-לבן בשרת (בדיקת saturation נמוך)
- [x] prompt מחמיר לתמונות שחור-לבן: "trace existing lines exactly, do not add or remove details"

## תיקון באגים - מרץ 2026 (דיווח משתמש)

- [x] תיקון תצוגת דף רכישה על אייפון צר: padding, גריד, גדלי פונט מותאמים למסכים קטנים
- [x] OAuth origin_mismatch: הוסבר למשתמש שיש להוסיף dxfai.ai ל-Authorized Origins ב-Google Cloud Console
- [x] שם קובץ DXF ב-iOS Share Sheet: נבדק ונמצא תקין

## תיקון שמות קבצים - מרץ 2026

- [x] buildFilename (aiTraceRoute): שמות קבצים DXF עכשיו ASCII בלבד — עברית מתורגמת למילים אנגליות (עכבר→mouse, מחשב→computer וכו')
- [x] promptToFilename (generateRoute): אותו תיקון — שמות קבצים ASCII בלבד לתאימות iOS Share Sheet
- [x] OAuth dxfai.ai: הוסבר למשתמש שיש להוסיף את הדומיין ל-Google Cloud Console (Authorized JavaScript Origins)

## תמיכה בדפדפנים ישנים - מרץ 2026

- [x] הוספת @vitejs/plugin-legacy לתמיכה ב-Chrome ישן (Windows 7): מייצר bundle ES5 + polyfills
- [x] postcss-oklab-function כבר היה קיים — ממיר oklch() לצבעים תואמים Chrome < 111

## תיקון שם קובץ PDF - מרץ 2026

- [x] תיקון שם קובץ PDF: נשמר כ-example.com (.COM) כי שם הקובץ מכיל URL — תוקן: URLs ודומיינים מנוקים משם הקובץ

## דפי נחיתה לפיצ'רים - מרץ 2026

- [x] דף נחיתה AI Create (/feature/ai-create)
- [x] דף נחיתה AI Outline (/feature/ai-outline)
- [x] דף נחיתה Portrait (/feature/portrait)
- [x] דף נחיתה CNC Relief (/feature/cnc-relief)
- [x] דף נחיתה Document Redraw (/feature/document-redraw)
- [x] רישום כל הנתיבים ב-App.tsx

## תיקוני דפי נחיתה - מרץ 2026

- [x] תיקון כפתור "לפני/אחרי" — ברירת מחדל שונתה ל-"לפני" (תמונה מקורית)
- [x] תיקון דף Portrait — תמונות לפני מוצגות נכון
- [x] תיקון תמונות Portrait — aspect-[3/4] + object-contain, תמונות מלאות ללא חיתוך
- [x] כפתורי CTA בדפי פיצ'ר יעבירו ל-/landing במקום לפתוח דיאלוג
- [x] הוספת לוגו שחור לנאב של דפי הפיצ'ר
- [x] שיפור כפתורי לפני/אחרי — גדולים וברורים יותר
- [ ] תיקון לינקים בדף נחיתה שפותחים דף ריק — להפנות לדף הרשמה

## שילוב Stripe לתשלומי כרטיס אשראי

- [ ] הפעלת Stripe feature ב-webdev
- [ ] הוספת מפתחות Stripe (Secret Key + Publishable Key)
- [ ] יצירת Stripe Checkout Session בשרת (server/stripe.ts)
- [ ] הוספת tRPC procedure: stripe.createCheckoutSession
- [ ] הוספת Stripe webhook handler ב-/api/stripe/webhook
- [ ] עדכון Buy.tsx: הוספת כפתור תשלום Stripe לצד PayPal
- [ ] עמוד /buy/stripe-success לאחר תשלום מוצלח
- [ ] בדיקות vitest לשרת Stripe

## דף אנליטיקס התנהגות מבקרים

- [x] DB schema: טבלת visitor_events עם שדות מורחבים (sessionId, country, referrer, utmSource, device, browser, timeOnPageSec, bounced)
- [x] Server: visitors.track procedure — שמירת pageview/click events
- [x] Server: visitors.stats procedure — bySource, byDevice, byBrowser, bounceRate, avgTime, funnel, dailyVisits, recentSessions
- [x] Client: tracking script — UTM, referrer, device, browser, time-on-page, bounce detection, data-track clicks
- [x] דף אנליטיקס ב-Admin: סיכום KPIs, גרף יומי, funnel chart, מקורות, מכשירים, דפדפנים, מדינות, sessions
- [x] data-track attributes: upload, convert, download, buy_click buttons

## באג: התנגשות דומיינים בהתחברות

- [x] לקוח שנרשם דרך dxfai.net לא מצליח להיכנס דרך dxfai.ai (מדפדפן ישן) — מועף החוצה
- [x] בדיקת הגדרות cookie domain (SameSite, Secure, domain)
- [x] תיקון: SSO token endpoint - /api/app-auth/sso-token ו-/api/app-auth/sso-exchange
- [ ] תיקון: client-side cross-domain redirect עם SSO token

## באג: דף אנליטיקס לא נטען (skeleton בלבד)

- [x] בדיקת tRPC visitors.stats procedure — מה מחזיר בפועל
- [x] תיקון: הנתונים לא מגיעים לדף Admin → אנליטיקס (תוקן: error state + retry:false + הסרת query כפול)

## באג: שגיאת SQL ב-visitors.stats (GROUP BY עם CASE)

- [x] תיקון: MySQL לא תומך ב-GROUP BY עם COALESCE/CASE expressions — הוחלף ב-JavaScript aggregation
- [x] Add new-user engagement popup: auto-show after 8s for users with full 10 tokens (never converted), with CTA to try the tool
- [x] Remove "כל פעולה עולה אסימון אחד" text from nudge popup
- [x] Replace welcome bonus banner with small subtle text "היכנס למייל לקבל עוד 20"
- [x] Remove bonus banner entirely from Home.tsx (showBonusBanner section)
- [x] Add small email bonus hint inside nudge popup for users with hasPendingWelcomeBonus
- [ ] Bug: nudge popup shows for users who already performed actions — fix hasAnyAction logic in tokens.balance procedure
- [x] Bug: Portrait refunds tokens even when no tokens were charged (no face detected = refund without prior deduction)
- [x] Improve AI Outline fidelity for B&W images: preserve small details (leaves, fine lines) by tuning Potrace turdSize and preprocessing
- [ ] OnboardingTour: show until user has 2+ conversions (server-side count), then hide permanently
- [ ] Nudge popup: show every login session until 1 conversion done — remove localStorage dependency, use server-side hasAnyAction per session
- [ ] Nudge popup mobile: smaller, centered on mobile (not bottom-corner), full-width on desktop stays as is
- [x] OnboardingTour: hide after 2 conversions (server-side actionCount)
- [x] Nudge popup: show every login session until 1 action done (no localStorage, server-side only)
- [x] Nudge popup mobile: smaller, centered on mobile
- [x] Implement adaptive threshold preprocessing in aiTraceRoute for pencil/sketch images with non-uniform backgrounds
- [ ] Bug: CLAHE preprocessing too slow — causes timeout with no result, need to optimize or revert
- [ ] Bug: OnboardingTour and nudge popup reopen unexpectedly mid-work after being closed

## תיקונים - מרץ 2026 (בקשה נוכחית)

- [x] חזרה ל-Simple mode לפני CLAHE — blur(1.0) + linear(1.8,-30) + threshold(155) @ 3072px
- [x] תיקון SvgMiniPreview בדיאלוג הורדה — SVG מוצג חצי בגלל width/height חסרים, תוקן ל-width="100%" height="100%"

## מעקב הורדות ושגיאות בניהול - מרץ 2026

- [x] הוספת event סוג "download" ל-user_actions — לוגינג בכל הורדת DXF/PDF
- [x] הוספת event סוג "error" ל-user_actions — לוגינג שגיאות המרה/AI עם סיבת השגיאה (כבר קיים בשרת)
- [x] דשבורד ניהול: עמודת "הורדות" בטבלת משתמשים
- [x] דשבורד ניהול: עמודת "שגיאות" בטבלת משתמשים עם פרטי השגיאה
- [x] דשבורד ניהול: סינון לפי סוג פעולה (הורדה / שגיאה / המרה / AI) — status+errorMessage נוספו לשאילתה

## תיקונים נוספים - מרץ 2026
- [x] תיקון שגיאת SQL GROUP BY באנליטיקס מבקרים — הוסר only_full_group_by מחיבור MySQL
- [x] הוספת טאב "הורדות" בדשבורד ניהול — רשימה מלאה של כל ההורדות
- [x] הצעה לעבור ל-AI Outline כשזיהוי פנים נכשל — כפתור "נסה AI Outline במקום" בדיאלוג שגיאה

## מעבר אוטומטי ל-AI Outline עם תמונה - מרץ 2026
- [x] כשזיהוי פנים נכשל ולוחצים "נסה AI Outline" — לעבור עם התמונה טעונה ולהתחיל המרה אוטומטית

## שיפורי UX להמרת משתמשים - מרץ 2026
- [x] Onboarding popup למשתמש חדש — delay קוצר ל-2 שניות
- [x] CTA ברור ב-landing page — redirect ל-/#main-tabs אחרי רישום/כניסה
- [x] כפתור FAB מובייל — floating "התחל עכשיו" שמגלגל ל-#main-tabs
- [x] סדר נכון: push notification נקרא רק בזמן המרה (לא בכניסה)

## שינוי שם AI Outline - מרץ 2026
- [x] שינוי "AI Outline" ל-"תמונה לקווים" (עברית) ו-"Image to Lines" (אנגלית) בכל הקבצים

## תיקון UX רישום - מרץ 2026
- [x] אחרי רישום מוצלח מדף Home — גלילה אוטומטית ל-#main-tabs

- [x] הדגשה ויזואלית (pulse glow) על לוח הטאבים אחרי רישום חדש
- [x] אחרי סגירת פופאפ הנאדג' — פתיחה אוטומטית של באנר ההדרכה (OnboardingTour)
- [x] תיקון: OnboardingTour לא נפתח ביחד עם פופאפ הנאדג' — ממתין לסגירתו

## שדה מיקוד ב-Popup זיהוי נוף — מרץ 2026
- [x] הוספת שדה טקסט ב-popup זיהוי נוף/סצנה — "מה לצייר?" (לדוגמה: רק הכסאות, רק העצים)
- [x] העברת הטקסט לפרומפט ה-AI כ-focusText

## תיקון Google Ads — מעקב הרשמות OAuth — מרץ 2026
- [x] שינוי oauth.ts: זיהוי משתמש חדש + הגדרת cookie זמני new_registration=1
- [x] שינוי Home.tsx: קריאת cookie new_registration ושליחת gtag conversion
- [x] בדיקת vitest לזיהוי משתמש חדש ב-OAuth

## שיפור פרומפטים - מרץ 2026

- [x] עדכון כל הפרומפטים ב-aiTraceRoute.ts לפרומפט "קווי עט נקיים" — continuous pen strokes, suitable for laser engraving
- [x] שינוי pipeline ב-aiTraceRoute.ts: פרומפט חדש שמבקש מ-AI לעקוב אחרי הקווים המדוייקים בתמונה (לא לצייר מחדש מזיכרון)
- [x] הסרת שלב ניתוח GPT-4o לגמרי — שליחה ישירה לגpt-image-1 ללא תיאור טקסטואלי
- [x] החלפת OpenAI images.edit ב-Forge ImageService (generateImage) ב-aiTraceRoute.ts
- [x] החלפת OpenAI images.edit ב-Forge ImageService (generateImage) ב-aiTraceRoute.ts
- [x] החלפת OpenAI images.generate ב-Forge ImageService ב-generateRoute (AI Create מטקסט)
- - [x] כיוון פרמטרי potrace (alphamax, opttolerance, turdsize) לקווים רציפים בתמונות עם הרבה פרטים- [x] עדכון פרומפטים ב-STYLE_VARIATIONS: הוספת הנחייה לצייר רק קווים ראשיים ולהתעלם מפרטים קטנים
- [x] הוספת הנחיית "bold thick strokes minimum 3px" לפרומפט כדי שקווים דקים ישרדו את ה-threshold
- [x] הוספת זיהוי סוג תמונה חכם (נוף/פורטרט/אובייקט/מנדלה/ציור) לפני שליחה ל-AI ועיצוב פרומפט מותאם לכל סוג
- [x] טקסט בתמונה מטופל כאובייקט — ציור קווי מתאר של אותיות במקום דילוג
- [x] כלל קו יחיד: טקסט ופריטים קטנים — קו מתאר חיצוני אחד בלבד, ללא כפילות
- [x] כלל פרטים קטנים: אם אין מקום לשני קווים נקיים — קו אחד או דילוג
- [x] פתרון A: כלל מיזוג קווים מקבילים קרובים בפרומפט
- [x] פתרון B: post-processing על SVG לסינון נתיבים כפולים
- [x] עובי קו אדפטיבי: קו אחד שעוביו משתנה לפי גודל האלמנט (גדול=עבה, קטן=דק) — ללא קווים כפולים

## שינוי גודל DXF - 200x200 ס"מ

- [x] Scale DXF output coordinates to fit within 2000x2000mm (200x200cm), preserving aspect ratio

## PWA - התקנה כאפליקציה

- [x] יצירת manifest.json עם שם, צבעים, ואייקונים
- [x] יצירת service worker לcaching בסיסי
- [x] הוספת manifest ל-index.html
- [x] יצירת אייקוני PWA (192x192, 512x512)
- [x] הוספת meta tags למובייל (theme-color, apple-touch-icon)

## Client-side timeout

- [x] הוספת timeout של 4 דקות בצד הלקוח — אם job לא הסתיים, מציג הודעה ומאפשר ביטול

## תיקוני Audit - מרץ 2026

- [x] תיקון ערבוב שפות בכרטיסיית "תמונה לקווים" — שימוש ב-t("aiTraceTabLabel") במקום hardcoded עברית
- [x] תיקון ערבוב שפות בטאב "תמונה לקווים" בסרגל הטאבים — שימוש ב-t("aiTraceTabLabel")
- [x] תמונת הבאנר (hero-laser) תקינה — הבעיה הייתה בטעינת CDN איטית בדב-סרבר, בייצור תקין

## PWA Install Button - מרץ 2026

- [ ] יצירת usePwaInstall hook לתפיסת beforeinstallprompt event
- [ ] הוספת כפתור "התקן אפליקציה" בתפריט ה-header
- [ ] הוספת שלב התקנה ב-onboarding tour
- [ ] הוספת push banner "התקן כאפליקציה" עם כפתור

## תיקוני באגים - מרץ 2026

- [x] תיקון תרגום "תמונה לקווים" — נשאר בעברית בכל השפות
- [x] תיקון כפתור "שלח מייל" — עכשיו פותח Gmail בדפדפן כ-fallback
- [x] תיקון תמונות ממוזערות ב-Admin History — הבעיה היתה שרשומות “הורדה” לא הציגו תמונה (תוקן)
- [x] תיקון Admin History — הצגת אייקון הורדה ולייבל "הורדה" לרשומות download

## תיקון סיווג תמונות - מרץ 2026

- [x] שיפור classifyImage — ציורים פשוטים על רקע לבן יסווגו כ-"drawing" ולא כ-"object"
