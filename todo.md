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
