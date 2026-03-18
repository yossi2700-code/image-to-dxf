import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";

// ─── Currency / pricing data (duplicated from server/products.ts for client) ──
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", ILS: "₪", CAD: "CA$", AUD: "A$",
};

const PACKAGES = [
  {
    id: "tokens_50",
    tokens: 50,
    popular: false,
    prices: {
      USD: "29.00", EUR: "27.00", GBP: "23.00",
      ILS: "109.00", CAD: "40.00", AUD: "45.00",
    } as Record<string, string>,
  },
  {
    id: "tokens_100",
    tokens: 100,
    popular: true,
    prices: {
      USD: "49.00", EUR: "45.00", GBP: "39.00",
      ILS: "185.00", CAD: "67.00", AUD: "75.00",
    } as Record<string, string>,
  },
];

const CURRENCIES = ["USD", "EUR", "GBP", "ILS", "CAD", "AUD"];

// Timezone → currency mapping
const TZ_CURRENCY: Record<string, string> = {
  "Asia/Jerusalem": "ILS",
  "Asia/Tel_Aviv": "ILS",
  "Europe/London": "GBP",
  "America/Toronto": "CAD",
  "America/Vancouver": "CAD",
  "Australia/Sydney": "AUD",
  "Australia/Melbourne": "AUD",
  "Europe/Berlin": "EUR",
  "Europe/Paris": "EUR",
  "Europe/Madrid": "EUR",
  "Europe/Rome": "EUR",
};

function detectCurrency(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TZ_CURRENCY[tz]) return TZ_CURRENCY[tz];
    const locale = navigator.language || "en-US";
    if (locale.startsWith("he")) return "ILS";
    if (locale.startsWith("en-GB")) return "GBP";
    if (locale.startsWith("en-CA")) return "CAD";
    if (locale.startsWith("en-AU")) return "AUD";
    if (locale.startsWith("de") || locale.startsWith("fr") || locale.startsWith("es")) return "EUR";
  } catch { /* ignore */ }
  return "USD";
}

// ─── Purchase Terms Modal ─────────────────────────────────────────────────────
function PurchaseTermsModal({ onClose }: { onClose: () => void }) {
  const { t, isRtl } = useLanguage();
  const isHe = isRtl;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-900 flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700" dir={isHe ? "rtl" : "ltr"}>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{isHe ? "תנאי רכישה" : "Purchase Terms & Conditions"}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-3xl leading-none font-light"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-5 text-sm text-gray-700 dark:text-gray-300" dir={isHe ? "rtl" : "ltr"}>
          <p className="text-xs text-gray-500 dark:text-gray-400">{isHe ? "עדכון אחרון: מרץ 2026 | dxfai.net" : "Last updated: March 2026 | dxfai.net"}</p>

          {isHe ? (
            <>
              <section>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">1. חבילות אסימונים ותמחור</h3>
                <p>בהשלמת הרכישה אתה רוכש רישיון שאינו ניתן להחזר ואינו ניתן להעברה לשימוש במספר האסימונים המצוין בפלטפורמת dxfai.net. לאסימונים אין ערך כספי, לא ניתן להמירם למזומן, ואינם ניתנים להעברה לחשבונות אחרים. המחירים מוצגים במטבע שנבחר וכוללים מסים רלוונטיים אלא אם צוין אחרת.</p>
              </section>
              <section>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">2. ללא תפוגה</h3>
                <p>אסימונים שנרכשו אינם פגים ונשארים זמינים בחשבונך ללא הגבלת זמן, בתנאי שחשבונך פעיל ותקין. אנו שומרים את הזכות לבטל חשבונות המפרים את תנאי השירות, ובמקרה כזה האסימונים הנותרים יאבדו ללא פיצוי.</p>
              </section>
              <section>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">3. מדיניות אי-החזר</h3>
                <p>כל הרכישות סופיות ואינן ניתנות להחזר. איננו מציעים החזרים, זיכויים, או החלפות עבור אסימונים שנרכשו, אלא כנדרש על פי חוק מחייב. אם אתה סבור שחיוב בוצע בטעות, פנה לתמיכה בכתובת support@dxfai.net תוך 14 יום מתאריך העסקה.</p>
              </section>
              <section>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">4. עיבוד תשלומים</h3>
                <p>התשלומים מעובדים בצורה מאובטחת על ידי PayPal Inc. איננו שומרים את פרטי כרטיס האשראי שלך. בהשלמת התשלום אתה מסכים גם להסכם המשתמש ומדיניות הפרטיות של PayPal. במקרה של מחלוקת, תהליך הגישור של PayPal עשוי לחול.</p>
              </section>
              <section>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">5. ניכוי אסימונים והחזר בכשלים</h3>
                <p>אסימונים מנוכים עם תחילת עיבוד (המרת תמונה, יצירת AI, או שיפור עיצוב). אם עבודה נכשלת עקב שגיאת שרת מאומתת מצדנו, האסימון יוחזר אוטומטית לחשבונך תוך 24 שעות. אסימונים <strong>אינם</strong> מוחזרים עבור: (א) ביטולים שיזם המשתמש לאחר תחילת העיבוד; (ב) תוצאות שאינן עומדות בציפיות סובייקטיביות; (ג) העלאות תמונה שגויות.</p>
              </section>
              <section>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">6. קניין רוחני</h3>
                <p>אתה שומר על בעלות התמונות שאתה מעלה. קבצי פלט (DXF, PDF) שנוצרו מתמונותיך מורשים לך לשימוש אישי ומסחרי. איננו שומרים על זכויות כלשהן בקבצי הפלט שלך.</p>
              </section>
              <section>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">7. שינויי מחירים</h3>
                <p>אנו שומרים את הזכות לשנות מחירי אסימונים בכל עת ללא הודעה מוקדמת. שינויי מחירים אינם משפיעים על אסימונים שנרכשו כבר.</p>
              </section>
              <section>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">8. הגבלת אחריות</h3>
                <p>במידה המרבית המותרת בחוק, האחריות הכוללת שלנו לכל תביעה הקשורה לרכישת אסימון לא תעלה על הסכום ששולם עבור אותה רכישה. איננו אחראים לנזקים עקיפים, מקריים, או תוצאתיים.</p>
              </section>
              <section>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">9. ברירת דין</h3>
                <p>תנאי רכישה אלה כפופים לחוקי מדינת ישראל. כל סכסוך יוגש לסמכות השיפוט הבלעדית של בתי המשפט בתל אביב, ישראל.</p>
              </section>
              <section>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">10. יצירת קשר</h3>
                <p>לשאלות הקשורות לרכישה: <a href="mailto:support@dxfai.net" className="text-blue-500 hover:underline">support@dxfai.net</a></p>
              </section>
            </>
          ) : (
            <>
              <section>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">1. Token Packages &amp; Pricing</h3>
                <p>By completing a purchase you acquire a non-refundable, non-transferable licence to use the stated number of design tokens ("Tokens") on the dxfai.net platform. Tokens have no monetary value, cannot be exchanged for cash, and are not transferable to other accounts. Prices are displayed in your selected currency and are inclusive of any applicable taxes unless stated otherwise.</p>
              </section>
              <section>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">2. No Expiry</h3>
                <p>Purchased Tokens do not expire and remain available in your account indefinitely, provided your account remains active and in good standing. We reserve the right to deactivate accounts that violate our Terms of Service, in which case remaining Tokens are forfeited without compensation.</p>
              </section>
              <section>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">3. No Refunds Policy</h3>
                <p>All purchases are final and non-refundable. We do not offer refunds, credits, or exchanges for purchased Tokens except where required by applicable mandatory law. If you believe a charge was made in error, please contact support at support@dxfai.net within 14 days of the transaction date.</p>
              </section>
              <section>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">4. Payment Processing</h3>
                <p>Payments are processed securely by PayPal Inc. We do not store your payment card details. By completing payment you also agree to PayPal's User Agreement and Privacy Policy. In case of a dispute, PayPal's resolution process may apply.</p>
              </section>
              <section>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">5. Token Deduction &amp; Refunds for Failures</h3>
                <p>Tokens are deducted upon initiating a processing job (image conversion, AI generation, or AI refinement). If a job fails due to a verified server-side error on our part, the Token is automatically refunded to your account within 24 hours. Tokens are <strong>not</strong> refunded for: (a) user-initiated cancellations after processing has begun; (b) results that do not meet subjective expectations; (c) incorrect image uploads.</p>
              </section>
              <section>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">6. Intellectual Property</h3>
                <p>You retain ownership of images you upload. Output files (DXF, PDF) generated from your images are licensed to you for personal and commercial use. We retain no rights to your output files.</p>
              </section>
              <section>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">7. Price Changes</h3>
                <p>We reserve the right to change Token prices at any time without prior notice. Price changes do not affect Tokens already purchased.</p>
              </section>
              <section>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">8. Limitation of Liability</h3>
                <p>To the maximum extent permitted by law, our total liability for any claim related to a Token purchase shall not exceed the amount paid for that purchase. We are not liable for indirect, incidental, or consequential damages.</p>
              </section>
              <section>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">9. Governing Law</h3>
                <p>These Purchase Terms are governed by the laws of the State of Israel. Any disputes shall be submitted to the exclusive jurisdiction of the courts of Tel Aviv, Israel.</p>
              </section>
              <section>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">10. Contact</h3>
                <p>For purchase-related queries: <a href="mailto:support@dxfai.net" className="text-blue-500 hover:underline">support@dxfai.net</a></p>
              </section>
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
          >
            {isHe ? "סגור" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Buy Page ────────────────────────────────────────────────────────────
export default function Buy() {
  const { t, isRtl } = useLanguage();
  const [, navigate] = useLocation();

  const [currency, setCurrency] = useState(() => detectCurrency());
  const [selectedPackage, setSelectedPackage] = useState("tokens_100");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paypalConfigured, setPaypalConfigured] = useState<boolean | null>(null);
  const [paypalClientId, setPaypalClientId] = useState<string>("");
  const [paypalMode, setPaypalMode] = useState<string>("production");
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"paypal" | "card">("paypal");
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardSuccess, setCardSuccess] = useState(false);
  const [cardFieldsReady, setCardFieldsReady] = useState(false);
  const [cardFieldsMounted, setCardFieldsMounted] = useState(false);
  const [cardFieldsFallback, setCardFieldsFallback] = useState(false);
  const cardFormRef = useRef<HTMLDivElement>(null);
  const cardFieldsInstanceRef = useRef<{ submit: (data: Record<string, unknown>) => Promise<unknown> } | null>(null);
  const createOrderForCardFieldsMutation = trpc.paypal.createOrderForCardFields.useMutation();

  // קריאת מחירים דינמיים מה-DB
  const { data: dbPrices, isLoading: pricesLoading } = trpc.packages.prices.useQuery();
  // קריאת הגדרות יצירת קשר
  const { data: contactSettings } = trpc.admin.getContactSettings.useQuery();
  // Manus OAuth auth check (primary)
  const { data: manusUser } = trpc.auth.me.useQuery();
  // tRPC mutations for PayPal
  const createOrderMutation = trpc.paypal.createOrder.useMutation();
  const captureOrderMutation = trpc.paypal.captureOrder.useMutation();

  // מטבעות פעילים — מבוסס על enabledCurrencies של החבילה הראשונה (או כולם אם לא הוגדר)
  const activeCurrencies = dbPrices && dbPrices.length > 0 && dbPrices[0].enabledCurrencies
    ? dbPrices[0].enabledCurrencies.split(",").filter(Boolean)
    : CURRENCIES;

  // וודא שה-currency הנוכחי פעיל
  useEffect(() => {
    if (activeCurrencies.length > 0 && !activeCurrencies.includes(currency)) {
      setCurrency(activeCurrencies[0]);
    }
  }, [activeCurrencies.join(",")]);

  useEffect(() => {
    // Check PayPal configuration
    fetch("/api/paypal/status", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setPaypalConfigured(!!d?.configured);
        if (d?.clientId) setPaypalClientId(d.clientId);
        if (d?.mode) setPaypalMode(d.mode);
      })
      .catch(() => setPaypalConfigured(false));

    // Check auth & balance (app_user_session cookie)
    fetch("/api/app-auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setIsLoggedIn(!!d?.user);
        if (d?.user) setBalance(d.user.tokenBalance ?? null);
      })
      .catch(() => setIsLoggedIn(false));
  }, []);
  // Also set isLoggedIn from Manus OAuth if available
  useEffect(() => {
    if (manusUser && !isLoggedIn) {
      setIsLoggedIn(true);
    }
  }, [manusUser]);

  // Mount PayPal Card Fields when card tab is selected
  useEffect(() => {
    if (paymentMethod !== "card" || !termsAccepted || isLoggedIn === false || !paypalClientId || cardFieldsMounted) return;

    const scriptId = "paypal-sdk-card-fields";
    const existingScript = document.getElementById(scriptId);

    const initCardFields = () => {
      const paypal = (window as unknown as { paypal?: { CardFields?: (config: Record<string, unknown>) => { isEligible: () => boolean; NumberField: (o?: Record<string,unknown>) => { render: (el: HTMLElement) => Promise<void> }; ExpiryField: (o?: Record<string,unknown>) => { render: (el: HTMLElement) => Promise<void> }; CVVField: (o?: Record<string,unknown>) => { render: (el: HTMLElement) => Promise<void> }; submit: (data: Record<string, unknown>) => Promise<unknown> } } }).paypal;
      if (!paypal?.CardFields) return;

      const cardFields = paypal.CardFields({
        createOrder: async () => {
          const data = await createOrderForCardFieldsMutation.mutateAsync({
            packageId: selectedPackage,
            currency,
            termsAccepted: true,
          });
          return data.orderId;
        },
        onApprove: async (data: { orderID: string }) => {
          setCardLoading(true);
          try {
            const result = await captureOrderMutation.mutateAsync({ orderId: data.orderID });
            if (result.success) {
              setCardSuccess(true);
              setTimeout(() => navigate("/buy/success?orderId=" + data.orderID), 1500);
            }
          } catch (e: unknown) {
            setCardError(e instanceof Error ? e.message : "שגיאה בעיבוד התשלום");
          } finally {
            setCardLoading(false);
          }
        },
        onError: (err: unknown) => {
          console.error("CardFields error", err);
          setCardError("שגיאה בשדות הכרטיס — נסה שוב");
          setCardLoading(false);
        },
        style: {
          input: { "font-size": "16px", "font-family": "system-ui, sans-serif", color: "#ffffff" },
          ".invalid": { color: "#f87171" },
        },
      });

      if (!cardFields.isEligible()) {
        // Card Fields not eligible — fall back to PayPal guest checkout
        setCardFieldsFallback(true);
        setCardFieldsReady(true); // allow submit button to be clickable
        cardFieldsInstanceRef.current = null; // signal fallback mode
        setCardFieldsMounted(true);
        return;
      }

      const numberEl = document.getElementById("card-number-field");
      const expiryEl = document.getElementById("card-expiry-field");
      const cvvEl = document.getElementById("card-cvv-field");
      if (!numberEl || !expiryEl || !cvvEl) return;

      Promise.all([
        cardFields.NumberField().render(numberEl),
        cardFields.ExpiryField().render(expiryEl),
        cardFields.CVVField().render(cvvEl),
      ]).then(() => {
        cardFieldsInstanceRef.current = cardFields;
        setCardFieldsReady(true);
        setCardFieldsMounted(true);
      }).catch((err) => {
        console.error("CardFields render error", err);
        setCardError("לא ניתן לטעון שדות כרטיס — נסה שוב");
      });
    };

    if (existingScript) {
      initCardFields();
    } else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&components=card-fields&currency=${currency}`;
      script.onload = initCardFields;
      script.onerror = () => setCardError("שגיאה בטעינת PayPal SDK");
      document.head.appendChild(script);
    }
  }, [paymentMethod, termsAccepted, isLoggedIn, paypalClientId, cardFieldsMounted]);

  // Reset card fields when package/currency changes
  useEffect(() => {
    setCardFieldsMounted(false);
    setCardFieldsReady(false);
    setCardFieldsFallback(false);
    cardFieldsInstanceRef.current = null;
  }, [selectedPackage, currency]);

  async function handleCardSubmit() {
    setCardLoading(true);
    setCardError(null);
    try {
      // Fallback mode: Card Fields not eligible, redirect to PayPal with guest checkout
      if (!cardFieldsInstanceRef.current) {
        const data = await createOrderMutation.mutateAsync({
          packageId: selectedPackage,
          currency,
          termsAccepted: true,
          useCard: false,
        });
        if (data.approvalUrl) {
          window.location.href = data.approvalUrl;
        }
        return;
      }
      await cardFieldsInstanceRef.current.submit({});
    } catch (e: unknown) {
      setCardError(e instanceof Error ? e.message : "שגיאה בתשלום — בדוק פרטי כרטיס");
      setCardLoading(false);
    } finally {
      if (cardFieldsInstanceRef.current) setCardLoading(false);
    }
  }

  // בניית חבילות מה-DB או מה-fallback
  const packages = dbPrices && dbPrices.length > 0
    ? dbPrices.map((p) => ({
        id: p.packageId,
        tokens: p.tokenAmount,
        popular: p.packageId === "tokens_100",
        label: p.label,
        discountPercent: p.discountPercent ?? 0,
        badge: p.badge ?? null,
        imageUrl: p.imageUrl ?? null,
        prices: {
          USD: p.priceUSD,
          EUR: p.priceEUR,
          ILS: p.priceILS,
          GBP: p.priceGBP,
          AUD: p.priceAUD,
          CAD: p.priceCAD,
          JPY: p.priceJPY,
        } as Record<string, string>,
      }))
    : PACKAGES;

  const pkg = packages.find((p) => p.id === selectedPackage) ?? packages[packages.length - 1];
  const price = pkg.prices[currency] ?? pkg.prices["USD"];
  const symbol = CURRENCY_SYMBOLS[currency] ?? "$";
  const perToken = (parseFloat(price) / pkg.tokens).toFixed(2);

  async function handlePurchase() {
    if (!termsAccepted) { setError(t("buyTermsRequired")); return; }
    const loggedIn = isLoggedIn || !!manusUser;
    if (!loggedIn) { setError(t("buyLoginRequired")); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await createOrderMutation.mutateAsync({
        packageId: selectedPackage,
        currency,
        termsAccepted: true,
        origin: window.location.origin,
      });
      if (!data.approvalUrl) {
        setError(t("buyOrderError"));
        return;
      }
      window.location.href = data.approvalUrl;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("buyOrderError");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      {showTermsModal && <PurchaseTermsModal onClose={() => setShowTermsModal(false)} />}

      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 pt-16 pb-8 text-center">
        <button
          onClick={() => navigate("/")}
          className="mb-8 inline-flex items-center gap-2 text-blue-300 hover:text-blue-100 transition-colors text-sm"
        >
          ← {t("back")}
        </button>
        <h1 className="text-4xl md:text-5xl font-black mb-3 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
          {t("buyPageTitle")}
        </h1>
        <p className="text-blue-200 text-lg">{t("buyPageSubtitle")}</p>

        {isLoggedIn && balance !== null && (
          <div className="mt-5 inline-flex items-center gap-2 bg-blue-800/40 border border-blue-600/30 rounded-full px-5 py-2 text-sm">
            <span className="text-blue-300">{t("buyCurrentBalance")}</span>
            <span className="font-bold text-white">{balance} {t("buyTokensLabel")}</span>
          </div>
        )}
      </div>

      {/* Currency selector */}
      <div className="max-w-4xl mx-auto px-4 mb-8 flex justify-center">
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-5 py-2.5">
          <span className="text-sm text-blue-200">{t("buySelectCurrency")}:</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="bg-transparent text-white text-sm font-semibold focus:outline-none cursor-pointer"
          >
            {activeCurrencies.map((c) => (
              <option key={c} value={c} className="bg-slate-800 text-white">
                {c} {CURRENCY_SYMBOLS[c as keyof typeof CURRENCY_SYMBOLS] ?? c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Package cards */}
      <div className="max-w-3xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {packages.map((p) => {
          const pPrice = p.prices[currency] ?? p.prices["USD"];
          const pPerToken = (parseFloat(pPrice) / p.tokens).toFixed(2);
          const isSelected = selectedPackage === p.id;

          const discount = (p as { discountPercent?: number }).discountPercent ?? 0;
          const badge = (p as { badge?: string | null }).badge ?? null;
          const discountedPrice = discount > 0 ? (parseFloat(pPrice) * (1 - discount / 100)).toFixed(2) : null;

          const badgeConfig: Record<string, { text: string; className: string }> = {
            recommended: { text: "★ מומלץ", className: "bg-gradient-to-r from-blue-500 to-blue-600 text-white" },
            best_value: { text: "💰 הכי משתלם", className: "bg-gradient-to-r from-green-500 to-emerald-600 text-white" },
            sale: { text: "🔥 במבצע", className: "bg-gradient-to-r from-red-500 to-pink-500 text-white" },
            trial: { text: "🌟 התנסות", className: "bg-gradient-to-r from-purple-500 to-violet-600 text-white" },
          };

          return (
            <div
              key={p.id}
              onClick={() => setSelectedPackage(p.id)}
              className={`relative cursor-pointer rounded-2xl border-2 p-8 transition-all duration-200 select-none ${
                isSelected
                  ? "border-blue-400 bg-blue-600/20 shadow-xl shadow-blue-500/20 scale-[1.02]"
                  : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10"
              }`}
            >
              {/* Badge (centered top) — always shown when set */}
              {badge && badgeConfig[badge] && (
                <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-black px-5 py-1 rounded-full shadow-lg ${badgeConfig[badge].className}`}>
                  {badgeConfig[badge].text}
                </div>
              )}
              {/* Discount pill (right side) — shown whenever discount > 0, even alongside badge */}
              {discount > 0 && (
                <div className="absolute -top-3.5 right-4 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-black px-3 py-1 rounded-full shadow-lg">
                  -{discount}% הנחה!
                </div>
              )}
              {/* Fallback popular badge when no badge and no discount */}
              {!badge && p.popular && !discount && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-400 text-black text-xs font-black px-5 py-1 rounded-full shadow-lg">
                  ⭐ {t("buyBestValue")}
                </div>
              )}

              <div className="text-center">
                {(p as { imageUrl?: string | null }).imageUrl && (
                  <div className="flex justify-center mb-4">
                    <img
                      src={(p as { imageUrl?: string | null }).imageUrl!}
                      alt={(p as { label?: string | null }).label ?? ""}
                      className="h-24 w-auto object-contain rounded-xl opacity-90"
                      onError={e => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                )}
                <div className="text-6xl font-black mb-1 tabular-nums bg-gradient-to-b from-yellow-300 via-amber-400 to-orange-400 bg-clip-text text-transparent drop-shadow-lg">{p.tokens}</div>
                <div className="text-blue-200 text-sm mb-5 uppercase tracking-widest">{t("buyTokensCount")}</div>
                {discountedPrice ? (
                  <div className="mb-1">
                    <span className="text-2xl text-blue-400/60 line-through mr-2">{symbol}{pPrice}</span>
                    <span className="text-4xl font-bold text-green-300">{symbol}{discountedPrice}</span>
                  </div>
                ) : (
                  <div className="text-4xl font-bold mb-1">{symbol}{pPrice}</div>
                )}
                <div className="text-blue-300 text-xs mt-1">
                  {symbol}{discountedPrice ? (parseFloat(discountedPrice) / p.tokens).toFixed(2) : pPerToken} {t("buyPerToken")}
                </div>
              </div>

              {isSelected && (
                <div className="mt-5 flex justify-center">
                  <div className="w-7 h-7 rounded-full bg-blue-400 flex items-center justify-center shadow-lg">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Purchase section */}
      <div className="max-w-md mx-auto px-4 mb-16">
        {/* Terms checkbox */}
        <label className="flex items-start gap-3 mb-5 cursor-pointer group">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => { setTermsAccepted(e.target.checked); if (error) setError(null); }}
            className="mt-0.5 w-4 h-4 rounded border-gray-400 accent-blue-500 cursor-pointer flex-shrink-0"
          />
          <span className="text-sm text-blue-200 group-hover:text-white transition-colors leading-relaxed">
            {t("buyTermsCheckbox")}{" "}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setShowTermsModal(true); }}
              className="text-blue-400 hover:text-blue-200 underline underline-offset-2 font-medium"
            >
              {t("buyTermsLink")}
            </button>
          </span>
        </label>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-sm text-center">
            {error}
          </div>
        )}
        {isLoggedIn === false && (
          <div className="mb-4 p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-300 text-sm text-center">
            {t("buyLoginRequired")}
          </div>
        )}
        {paypalConfigured === false && (
          <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/40 rounded-xl text-yellow-300 text-sm text-center">
            {t("buyPayPalNotConfigured")}
          </div>
        )}

        {/* Payment method selector */}
        <div className="flex gap-2 mb-5">
          <button
            type="button"
            onClick={() => setPaymentMethod("paypal")}
            className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all border-2 ${
              paymentMethod === "paypal"
                ? "border-[#0070BA] bg-[#0070BA]/20 text-white"
                : "border-white/10 bg-white/5 text-blue-200 hover:border-white/30"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z" />
            </svg>
            PayPal
          </button>
          <button
            type="button"
            disabled
            className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all border-2 border-white/10 bg-white/5 text-blue-300/50 cursor-not-allowed relative"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
            <span>כרטיס אשראי</span>
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-black whitespace-nowrap">
              בקרוב
            </span>
          </button>
        </div>

        {/* PayPal button */}
        {paymentMethod === "paypal" && (
          <>
            <button
              onClick={handlePurchase}
              disabled={loading || !termsAccepted || isLoggedIn === false || paypalConfigured === false}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-200 flex items-center justify-center gap-3 ${
                loading || !termsAccepted || isLoggedIn === false || paypalConfigured === false
                  ? "bg-gray-600/60 text-gray-400 cursor-not-allowed"
                  : "bg-[#0070BA] hover:bg-[#005ea6] active:bg-[#004a87] text-white shadow-xl shadow-blue-900/40 hover:shadow-blue-700/50 hover:scale-[1.02]"
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t("buyRedirectingPayPal")}
                </>
              ) : (
                <>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z" />
                  </svg>
                  {t("buyProceedPayPal")} — {symbol}{price}
                </>
              )}
            </button>
            <p className="text-center text-xs text-blue-400/70 mt-3">
              🔒 Secured by PayPal — your card details are never stored
            </p>
          </>
        )}

        {/* Credit Card — Coming Soon */}
        {paymentMethod === "card" && false && (
          <div ref={cardFormRef}>
            {!termsAccepted ? (
              <div className="text-center py-4 text-amber-300 text-sm">
                יש לאשר את תנאי הרכישה כדי להמשיך
              </div>
            ) : isLoggedIn === false ? (
              <div className="text-center py-4 text-amber-300 text-sm">
                {t("buyLoginRequired")}
              </div>
            ) : cardSuccess ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 border-2 border-green-400/60 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-green-300 font-bold text-lg">תשלום התקבל!</p>
                <p className="text-blue-300 text-sm mt-1">מעביר אותך...</p>
              </div>
            ) : (
              <>
                {cardError && (
                  <div className="mb-3 p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-sm text-center">
                    {cardError}
                  </div>
                )}

                {/* Card Fields form — only show if card fields are eligible (not fallback mode) */}
                {cardFieldsMounted && !cardFieldsFallback && (
                  <div className="space-y-3 mb-4">
                    {/* Card Number */}
                    <div>
                      <label className="block text-xs text-blue-300 mb-1 font-medium">מספר כרטיס</label>
                      <div
                        id="card-number-field"
                        className="w-full h-12 bg-white/10 border border-white/20 rounded-xl px-3 flex items-center"
                        style={{ minHeight: "48px" }}
                      />
                    </div>
                    {/* Expiry + CVV */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-blue-300 mb-1 font-medium">תוקף (MM/YY)</label>
                        <div
                          id="card-expiry-field"
                          className="w-full h-12 bg-white/10 border border-white/20 rounded-xl px-3 flex items-center"
                          style={{ minHeight: "48px" }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-blue-300 mb-1 font-medium">CVV</label>
                        <div
                          id="card-cvv-field"
                          className="w-full h-12 bg-white/10 border border-white/20 rounded-xl px-3 flex items-center"
                          style={{ minHeight: "48px" }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Always render hidden card field containers so PayPal SDK can find them */}
                {!cardFieldsMounted && (
                  <div style={{ display: 'none' }}>
                    <div id="card-number-field" />
                    <div id="card-expiry-field" />
                    <div id="card-cvv-field" />
                  </div>
                )}

                {/* Loading indicator while card fields initialize */}
                {!cardFieldsReady && (
                  <div className="text-center py-4 text-blue-300 text-sm flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    מתחבר ל-PayPal...
                  </div>
                )}

                {/* Fallback mode info */}
                {cardFieldsFallback && (
                  <div className="mb-4 p-4 bg-blue-500/10 border border-blue-400/30 rounded-xl text-center">
                    <p className="text-blue-200 text-sm font-medium mb-1">תשלום בכרטיס אשראי</p>
                    <p className="text-blue-300/80 text-xs">לחץ על הכפתור ובדף PayPal שייפתח — לחץ על <strong className="text-white">"Pay with Debit or Credit Card"</strong></p>
                  </div>
                )}

                <button
                  onClick={handleCardSubmit}
                  disabled={cardLoading || !cardFieldsReady || paypalConfigured === false}
                  className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-200 flex items-center justify-center gap-3 ${
                    cardLoading || !cardFieldsReady || paypalConfigured === false
                      ? "bg-gray-600/60 text-gray-400 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-xl shadow-emerald-900/40 hover:shadow-emerald-700/50 hover:scale-[1.02]"
                  }`}
                >
                  {cardLoading ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      מעבד תשלום...
                    </>
                  ) : (
                    <>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                        <line x1="1" y1="10" x2="23" y2="10"/>
                      </svg>
                      שלם {symbol}{price}
                    </>
                  )}
                </button>
                <p className="text-center text-xs text-blue-400/70 mt-3">
                  🔒 מאובטח על ידי PayPal — פרטי הכרטיס לא נשמרים
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto px-4 pb-10">
        <h2 className="text-2xl font-bold text-center mb-8 text-blue-100">{t("buyFaqTitle")}</h2>
        <div className="space-y-4">
          {[
            { q: t("buyFaq1Q"), a: t("buyFaq1A") },
            { q: t("buyFaq2Q"), a: t("buyFaq2A") },
            { q: t("buyFaq3Q"), a: t("buyFaq3A") },
          ].map((item, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <p className="font-semibold text-white mb-2">{item.q}</p>
              <p className="text-blue-200 text-sm leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Support Contact */}
      <div className="max-w-2xl mx-auto px-4 pb-20">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <div className="text-3xl mb-3">🛠️</div>
          <h3 className="text-xl font-bold text-white mb-2">
            {isRtl ? "תמיכה טכנית" : "Technical Support"}
          </h3>
          <p className="text-blue-200 text-sm mb-6">
            {isRtl ? "שאלות לגבי רכישה או בעיות טכניות? אנחנו כאן לעזור" : "Questions about your purchase or technical issues? We're here to help."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            {contactSettings?.supportEmail && (
              <a
                href={`mailto:${contactSettings.supportEmail}`}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {isRtl ? "שלח אימייל" : "Send Email"}
              </a>
            )}
            {contactSettings?.whatsappNumber && (
              <a
                href={`https://wa.me/${contactSettings.whatsappNumber.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors text-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.528 5.845L.057 23.5l5.797-1.522A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.848 0-3.576-.5-5.065-1.375l-.363-.215-3.44.902.918-3.354-.236-.38A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
                WhatsApp
              </a>
            )}
            {!contactSettings?.supportEmail && !contactSettings?.whatsappNumber && (
              <a
                href="mailto:support@dxfai.net"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                support@dxfai.net
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
