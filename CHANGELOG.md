# Changelog

## 2026-05-16 14:12 GMT+3 — Show conversion result immediately

תוקן מצב שבו ההמרה הסתיימה בהצלחה ללא שגיאה, אך התוצאה הווקטורית לא הוצגה מיד למשתמש משום שהתצוגה הווקטורית נשארה כבויה כברירת מחדל אחרי `setStatus("success")`. כעת לאחר קבלת תשובת `/api/convert` מוצלחת, `showSvgPreview` מופעל אוטומטית כדי שהמשתמש יראה תוצאה גלויה לצד כפתורי ההורדה.

## 2026-05-16 11:30 GMT+3 — DXFAI conversion storage fallback

תוקן מסלול יצירת הקובץ הראשי (`/api/convert`) כך שכשל זמני או חוסר הגדרה של Forge/Storage לא מפיל את יצירת ה־DXF. כאשר Storage זמין, הקבצים עדיין נשמרים ומוחזרים כקישורים קבועים. כאשר Storage אינו זמין, השרת מחזיר קישורי `data:` זמניים להורדה מיידית ומסמן את התשובה עם `storageMode: "temporary"`, כך שמשתמשים שמחוברים דרך DXFAI עדיין יכולים לקבל את הקובץ.

עודכן גם מסלול `api/dxf-legacy` כדי לתמוך ב־DXF זמני מסוג `data:` URL עבור הורדת CAS WIN / R12, תוך שמירה על הגבלת allow-list לכתובות חיצוניות.

## 2026-05-16 08:25 GMT+3 — API conversion request resilience

בוצע שיפור בצד הלקוח עבור פעולת ההמרה הראשית (`/api/convert`): הבקשה שולחת cookies במפורש באמצעות `credentials: "include"`, משתמשת ב־`AbortController` עם timeout של 60 שניות, ומטפלת במקרים שבהם השרת/Cloudflare מחזירים תגובה שאינה JSON. המטרה היא למנוע מצב שבו המשתמש רואה טעינה ללא תגובה ולהציג שגיאת רשת ברורה יותר.

בנוסף נבדק האתר החי `https://dxfai.ai`: נתיבי ה־API בדומיין הראשי עונים JSON תקין. לעומת זאת, `https://www.dxfai.ai` מחזיר Cloudflare `403` עם `error code: 1014`, ולכן נדרש תיקון DNS/Cloudflare נפרד אם משתמשים נכנסים דרך `www`.
