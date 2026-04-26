import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";

// ─── Currency / pricing data ──────────────────────────────────────────────────
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

const TZ_CURRENCY: Record<string, string> = {
  "Asia/Jerusalem": "ILS", "Asia/Tel_Aviv": "ILS",
  "Europe/London": "GBP", "America/Toronto": "CAD", "America/Vancouver": "CAD",
  "Australia/Sydney": "AUD", "Australia/Melbourne": "AUD",
  "Europe/Berlin": "EUR", "Europe/Paris": "EUR", "Europe/Madrid": "EUR", "Europe/Rome": "EUR",
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
  const { isRtl } = useLanguage();
  const isHe = isRtl;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto bg-white" style={{ border: "1px solid #e5e7eb" }} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex justify-between items-center p-6 bg-white" style={{ borderBottom: "1px solid #f3f4f6" }} dir={isHe ? "rtl" : "ltr"}>
          <h2 className="text-xl font-bold text-gray-900">{isHe ? "תנאי רכישה" : "Purchase Terms & Conditions"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-6 space-y-5 text-sm text-gray-600" dir={isHe ? "rtl" : "ltr"}>
          <p className="text-xs text-gray-400">{isHe ? "עדכון אחרון: מרץ 2026 | dxfai.ai" : "Last updated: March 2026 | dxfai.ai"}</p>
          {isHe ? (
            <>
              <section><h3 className="font-semibold text-gray-900 mb-2">1. חבילות קרדיטים ותמחור</h3><p>בהשלמת הרכישה אתה רוכש רישיון שאינו ניתן להחזר ואינו ניתן להעברה לשימוש במספר הקרדיטים המצוין בפלטפורמת dxfai.ai.</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">2. ללא תפוגה</h3><p>קרדיטים שנרכשו אינם פגים ונשארים זמינים בחשבונך ללא הגבלת זמן.</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">3. מדיניות אי-החזר</h3><p>כל הרכישות סופיות ואינן ניתנות להחזר. פנה לתמיכה בכתובת support@dxfai.ai תוך 14 יום מתאריך העסקה.</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">4. עיבוד תשלומים</h3><p>התשלומים מעובדים בצורה מאובטחת על ידי PayPal Inc. איננו שומרים את פרטי כרטיס האשראי שלך.</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">5. ניכוי קרדיטים</h3><p>קרדיטים מנוכים עם תחילת עיבוד. אם עבודה נכשלת עקב שגיאת שרת מאומתת, הקרדיט יוחזר תוך 24 שעות.</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">6. יצירת קשר</h3><p>לשאלות: <a href="mailto:support@dxfai.ai" className="text-indigo-600 hover:underline">support@dxfai.ai</a></p></section>
            </>
          ) : (
            <>
              <section><h3 className="font-semibold text-gray-900 mb-2">1. Credit Packages &amp; Pricing</h3><p>By completing a purchase you acquire a non-refundable, non-transferable licence to use the stated number of design credits on the dxfai.ai platform.</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">2. No Expiry</h3><p>Purchased credits do not expire and remain available in your account indefinitely.</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">3. No Refunds Policy</h3><p>All purchases are final and non-refundable. Contact support@dxfai.ai within 14 days of the transaction date for billing errors.</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">4. Payment Processing</h3><p>Payments are processed securely by PayPal Inc. We do not store your payment card details.</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">5. Credit Deduction</h3><p>Credits are deducted upon initiating a processing job. If a job fails due to a verified server-side error, the credit is automatically refunded within 24 hours.</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">6. Contact</h3><p>For purchase-related queries: <a href="mailto:support@dxfai.ai" className="text-indigo-600 hover:underline">support@dxfai.ai</a></p></section>
            </>
          )}
        </div>
        <div className="sticky bottom-0 p-4 flex justify-end bg-white" style={{ borderTop: "1px solid #f3f4f6" }}>
          <button onClick={onClose} className="px-6 py-2.5 text-white rounded-xl font-semibold transition-colors text-sm" style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
            {isHe ? "סגור" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Buy Page ────────────────────────────────────────────────────────────
export default function Buy() {
  const { t, isRtl, language } = useLanguage();
  const [, navigate] = useLocation();

  const [currency, setCurrency] = useState(() => detectCurrency());
  useEffect(() => {
    if (language === "he") {
      setCurrency("ILS");
    } else if (currency === "ILS") {
      setCurrency("USD");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const [selectedPackage, setSelectedPackage] = useState("tokens_100");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paypalConfigured, setPaypalConfigured] = useState<boolean | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const cardFormRef = useRef<HTMLDivElement>(null);

  const { data: dbPrices } = trpc.packages.prices.useQuery();
  const { data: contactSettings } = trpc.contact.info.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const { data: manusUser } = trpc.auth.me.useQuery();
  const createOrderMutation = trpc.paypal.createOrder.useMutation();

  const activeCurrencies = dbPrices && dbPrices.length > 0 && dbPrices[0].enabledCurrencies
    ? dbPrices[0].enabledCurrencies.split(",").filter(Boolean)
    : CURRENCIES;

  useEffect(() => {
    if (activeCurrencies.length > 0 && !activeCurrencies.includes(currency)) {
      setCurrency(activeCurrencies[0]);
    }
  }, [activeCurrencies.join(",")]);

  useEffect(() => {
    fetch("/api/paypal/status", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setPaypalConfigured(!!d?.configured); })
      .catch(() => setPaypalConfigured(false));

    fetch("/api/app-auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setIsLoggedIn(!!d?.user);
        if (d?.user) setBalance(d.user.tokenBalance ?? null);
      })
      .catch(() => setIsLoggedIn(false));
  }, []);

  useEffect(() => {
    if (manusUser && !isLoggedIn) setIsLoggedIn(true);
  }, [manusUser]);

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
          USD: p.priceUSD, EUR: p.priceEUR, ILS: p.priceILS,
          GBP: p.priceGBP, AUD: p.priceAUD, CAD: p.priceCAD, JPY: p.priceJPY,
        } as Record<string, string>,
      }))
    : PACKAGES;

  const pkg = packages.find((p) => p.id === selectedPackage) ?? packages[packages.length - 1];
  const price = pkg.prices[currency] ?? pkg.prices["USD"];
  const symbol = CURRENCY_SYMBOLS[currency] ?? "$";
  const discount = (pkg as { discountPercent?: number }).discountPercent ?? 0;
  const finalPrice = discount > 0 ? (parseFloat(price) * (1 - discount / 100)).toFixed(2) : price;
  const perToken = (parseFloat(finalPrice) / pkg.tokens).toFixed(2);

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
      if (!data.approvalUrl) { setError(t("buyOrderError")); return; }
      window.location.href = data.approvalUrl;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("buyOrderError"));
    } finally {
      setLoading(false);
    }
  }

  // Card accent colors per package index (light-theme friendly)
  const cardAccents = [
    { bg: "linear-gradient(135deg, #ede9fe, #ddd6fe)", border: "#c4b5fd", selected: "linear-gradient(135deg, #4f46e5, #7c3aed)", selectedBorder: "#7c3aed", textColor: "#4f46e5" },
    { bg: "linear-gradient(135deg, #dbeafe, #bfdbfe)", border: "#93c5fd", selected: "linear-gradient(135deg, #1d4ed8, #2563eb)", selectedBorder: "#3b82f6", textColor: "#1d4ed8" },
    { bg: "linear-gradient(135deg, #d1fae5, #a7f3d0)", border: "#6ee7b7", selected: "linear-gradient(135deg, #065f46, #059669)", selectedBorder: "#10b981", textColor: "#065f46" },
    { bg: "linear-gradient(135deg, #fce7f3, #fbcfe8)", border: "#f9a8d4", selected: "linear-gradient(135deg, #9d174d, #db2777)", selectedBorder: "#ec4899", textColor: "#9d174d" },
    { bg: "linear-gradient(135deg, #fef3c7, #fde68a)", border: "#fcd34d", selected: "linear-gradient(135deg, #92400e, #d97706)", selectedBorder: "#f59e0b", textColor: "#92400e" },
  ];

  const badgeConfig: Record<string, { text: string }> = {
    recommended: { text: isRtl ? "★ מומלץ" : "★ Recommended" },
    best_value: { text: isRtl ? "💰 הכי משתלם" : "💰 Best Value" },
    sale: { text: isRtl ? "🔥 במבצע" : "🔥 Sale" },
    trial: { text: isRtl ? "🌟 התנסות" : "🌟 Starter" },
  };

  return (
    <div className="min-h-screen" style={{ background: "#f8f9fb" }} dir={isRtl ? "rtl" : "ltr"}>
      {showTermsModal && <PurchaseTermsModal onClose={() => setShowTermsModal(false)} />}

      {/* Top gradient bar */}
      <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #4f46e5, #7c3aed, #2563eb)" }} />

      <div className="relative max-w-5xl mx-auto px-4 py-12">

        {/* Back button */}
        <button
          onClick={() => navigate("/")}
          className="mb-10 inline-flex items-center gap-2 text-sm transition-colors group text-gray-400 hover:text-gray-700"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t("back")}
        </button>

        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium mb-6 tracking-wide uppercase" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#4f46e5" }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            {isRtl ? "קרדיטים לעיצוב" : "Design Credits"}
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-4 tracking-tight" style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed, #2563eb)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {isRtl ? "בחר את החבילה שלך" : "Choose Your Plan"}
          </h1>
          <p className="text-lg max-w-md mx-auto leading-relaxed text-gray-500">
            {t("buyPageSubtitle")}
          </p>

          {isLoggedIn && balance !== null && (
            <div className="mt-6 inline-flex items-center gap-3 rounded-2xl px-6 py-3 bg-white shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)" }}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ color: "#f59e0b" }}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
              </div>
              <div className={isRtl ? "text-right" : "text-left"}>
                <div className="text-xs text-gray-400">{t("buyCurrentBalance")}</div>
                <div className="font-bold text-gray-800">{balance} <span className="font-normal text-sm text-gray-400">{t("buyTokensLabel")}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Currency selector */}
        <div className="flex justify-center mb-10">
          <div className="flex items-center gap-3 rounded-xl px-5 py-2.5 bg-white shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span className="text-sm text-gray-400">{t("buySelectCurrency")}:</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="text-sm font-semibold focus:outline-none cursor-pointer text-gray-700 bg-transparent"
            >
              {activeCurrencies.map((c) => (
                <option key={c} value={c}>
                  {c} {CURRENCY_SYMBOLS[c as keyof typeof CURRENCY_SYMBOLS] ?? c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Package cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-12 max-w-3xl mx-auto">
          {packages.map((p, idx) => {
            const pPrice = p.prices[currency] ?? p.prices["USD"];
            const pDiscount = (p as { discountPercent?: number }).discountPercent ?? 0;
            const pFinalPrice = pDiscount > 0 ? (parseFloat(pPrice) * (1 - pDiscount / 100)).toFixed(2) : pPrice;
            const pPerToken = (parseFloat(pFinalPrice) / p.tokens).toFixed(2);
            const isSelected = selectedPackage === p.id;
            const badge = (p as { badge?: string | null }).badge ?? null;
            const accent = cardAccents[idx % cardAccents.length];

            return (
              <div
                key={p.id}
                onClick={() => setSelectedPackage(p.id)}
                className="relative cursor-pointer rounded-2xl transition-all duration-200 select-none overflow-hidden"
                style={{
                  background: isSelected ? accent.selected : "white",
                  border: `2px solid ${isSelected ? accent.selectedBorder : "#e5e7eb"}`,
                  boxShadow: isSelected ? `0 8px 30px ${accent.selectedBorder}40, 0 2px 8px rgba(0,0,0,0.08)` : "0 2px 8px rgba(0,0,0,0.06)",
                  transform: isSelected ? "scale(1.02)" : "scale(1)",
                }}
              >
                {/* Badge */}
                {badge && badgeConfig[badge] && (
                  <div className="absolute top-0 left-0 right-0 py-1.5 text-center text-xs font-bold tracking-wide" style={{ background: isSelected ? "rgba(0,0,0,0.15)" : accent.bg, color: isSelected ? "white" : accent.textColor }}>
                    {badgeConfig[badge].text}
                  </div>
                )}
                {!badge && p.popular && !pDiscount && (
                  <div className="absolute top-0 left-0 right-0 py-1.5 text-center text-xs font-bold tracking-wide" style={{ background: isSelected ? "rgba(0,0,0,0.15)" : accent.bg, color: isSelected ? "white" : accent.textColor }}>
                    ✦ {t("buyBestValue")}
                  </div>
                )}
                {pDiscount > 0 && (
                  <div className="absolute top-3 right-3 text-white text-xs font-black px-2.5 py-1 rounded-full" style={{ background: "#ef4444" }}>
                    -{pDiscount}%
                  </div>
                )}

                <div className={`p-7 ${badge || (p.popular && !pDiscount) ? "pt-10" : ""}`}>
                  {/* Token count */}
                  <div className="mb-5">
                    <div className="flex items-end gap-2 mb-1">
                      <span className="text-5xl font-black tabular-nums" style={{ color: isSelected ? "white" : "#111827" }}>{p.tokens}</span>
                      <span className="text-sm mb-1.5 uppercase tracking-widest" style={{ color: isSelected ? "rgba(255,255,255,0.7)" : "#9ca3af" }}>{t("buyTokensCount")}</span>
                    </div>
                    {(p as { label?: string | null }).label && (
                      <p className="text-sm" style={{ color: isSelected ? "rgba(255,255,255,0.65)" : "#6b7280" }}>{(p as { label?: string | null }).label}</p>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="mb-5" style={{ borderTop: `1px solid ${isSelected ? "rgba(255,255,255,0.2)" : "#f3f4f6"}` }} />

                  {/* Price */}
                  <div className="mb-5">
                    {pDiscount > 0 ? (
                      <div className="flex items-baseline gap-2">
                        <span className="line-through text-lg" style={{ color: isSelected ? "rgba(255,255,255,0.4)" : "#d1d5db" }}>{symbol}{pPrice}</span>
                        <span className="text-3xl font-black" style={{ color: isSelected ? "white" : "#111827" }}>{symbol}{pFinalPrice}</span>
                      </div>
                    ) : (
                      <span className="text-3xl font-black" style={{ color: isSelected ? "white" : "#111827" }}>{symbol}{pFinalPrice}</span>
                    )}
                    <div className="text-xs mt-1" style={{ color: isSelected ? "rgba(255,255,255,0.55)" : "#9ca3af" }}>{symbol}{pPerToken} {t("buyPerToken")}</div>
                  </div>

                  {/* Select indicator */}
                  <div className="flex items-center justify-between rounded-xl px-4 py-2.5 transition-all" style={{
                    background: isSelected ? "rgba(255,255,255,0.18)" : "#f9fafb",
                    border: `1px solid ${isSelected ? "rgba(255,255,255,0.3)" : "#e5e7eb"}`,
                  }}>
                    <span className="text-sm font-semibold" style={{ color: isSelected ? "white" : "#6b7280" }}>
                      {isSelected ? (isRtl ? "נבחר ✓" : "Selected ✓") : (isRtl ? "בחר חבילה" : "Select plan")}
                    </span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: isSelected ? "white" : "#9ca3af" }}>
                      {isSelected
                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                        : <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                      }
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trust badges */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>, text: isRtl ? "ללא תפוגה" : "Never expire", color: "#10b981" },
              { icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>, text: isRtl ? "תשלום מאובטח" : "Secure payment", color: "#3b82f6" },
              { icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>, text: isRtl ? "זיכוי מידי" : "Instant credit", color: "#f59e0b" },
              { icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>, text: isRtl ? "PayPal מאובטח" : "PayPal secured", color: "#6366f1" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-xl px-4 py-3 bg-white shadow-sm" style={{ border: "1px solid #f3f4f6" }}>
                <span style={{ color: f.color }} className="flex-shrink-0">{f.icon}</span>
                <span className="text-xs font-medium text-gray-600">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Purchase card */}
        <div className="max-w-md mx-auto">
          <div className="rounded-2xl p-6 bg-white shadow-md" style={{ border: "1px solid #e5e7eb" }}>

            {/* Order summary */}
            <div className="mb-6">
              <h3 className="text-xs uppercase tracking-widest mb-4 text-gray-400">{isRtl ? "סיכום הזמנה" : "Order Summary"}</h3>
              <div className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid #f3f4f6" }}>
                <div>
                  <div className="text-gray-800 font-semibold">{pkg.tokens} {t("buyTokensLabel")}</div>
                  <div className="text-xs mt-0.5 text-gray-400">{symbol}{perToken} {t("buyPerToken")}</div>
                </div>
                <div className="text-right">
                  {discount > 0 && <div className="line-through text-sm text-gray-300">{symbol}{price}</div>}
                  <div className="text-gray-900 font-bold text-xl">{symbol}{finalPrice}</div>
                  <div className="text-xs text-gray-300">{currency}</div>
                </div>
              </div>
            </div>

            {/* Terms checkbox */}
            <div className="flex items-start gap-3 mb-5" dir="rtl">
              <button
                type="button"
                onClick={() => { setTermsAccepted(!termsAccepted); if (error) setError(null); }}
                className="mt-0.5 flex-shrink-0 w-6 h-6 rounded flex items-center justify-center transition-all"
                style={{
                  background: termsAccepted ? "linear-gradient(135deg, #4f46e5, #7c3aed)" : "white",
                  border: `2px solid ${termsAccepted ? "#7c3aed" : "#d1d5db"}`,
                  minWidth: "24px",
                }}
                aria-label="אישור תנאי שימוש"
              >
                {termsAccepted && (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                )}
              </button>
              <span
                className="text-sm leading-relaxed cursor-pointer select-none text-gray-600"
                onClick={() => { setTermsAccepted(!termsAccepted); if (error) setError(null); }}
              >
                {t("buyTermsCheckbox")}{" "}
                <button type="button" onClick={(e) => { e.stopPropagation(); setShowTermsModal(true); }} className="underline underline-offset-2 font-medium transition-colors text-indigo-600 hover:text-indigo-800">
                  {t("buyTermsLink")}
                </button>
              </span>
            </div>

            {/* Alerts */}
            {error && (
              <div className="mb-4 p-3 rounded-xl text-sm text-center" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                {error}
              </div>
            )}
            {isLoggedIn === false && (
              <div className="mb-4 p-3 rounded-xl text-sm text-center" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>
                {t("buyLoginRequired")}
              </div>
            )}
            {paypalConfigured === false && (
              <div className="mb-4 p-3 rounded-xl text-sm text-center" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>
                {t("buyPayPalNotConfigured")}
              </div>
            )}

            {/* Payment method tabs */}
            <div className="flex gap-2 mb-5 p-1 rounded-xl bg-gray-50" style={{ border: "1px solid #f3f4f6" }}>
              {/* Credit Card — Coming Soon */}
              <div className="flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 select-none cursor-not-allowed text-gray-300">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
                <span className="text-xs font-medium">{isRtl ? "כרטיס — בקרוב" : "Card — Soon"}</span>
              </div>
              {/* PayPal — active */}
              <div className="flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 select-none bg-white shadow-sm" style={{ border: "1px solid #e5e7eb", color: "#1d4ed8" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#1d4ed8">
                  <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"/>
                </svg>
                <span className="text-xs font-semibold">PayPal</span>
              </div>
            </div>

            {/* PayPal button */}
            <button
              onClick={handlePurchase}
              disabled={loading || !termsAccepted || isLoggedIn === false || paypalConfigured === false}
              className="w-full py-4 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-3"
              style={
                loading || !termsAccepted || isLoggedIn === false || paypalConfigured === false
                  ? { background: "#f3f4f6", color: "#9ca3af", cursor: "not-allowed", border: "1px solid #e5e7eb" }
                  : { background: "linear-gradient(135deg, #4f46e5, #7c3aed, #2563eb)", color: "white", boxShadow: "0 4px 20px rgba(99,102,241,0.35)", cursor: "pointer" }
              }
              onMouseEnter={e => {
                if (!loading && termsAccepted && isLoggedIn !== false && paypalConfigured !== false) {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 28px rgba(99,102,241,0.5)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.01)";
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(99,102,241,0.35)";
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
              }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {t("buyRedirectingPayPal")}
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"/>
                  </svg>
                  {t("buyProceedPayPal")} — {symbol}{finalPrice}
                </>
              )}
            </button>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              {isRtl ? "מאובטח על ידי PayPal — פרטי הכרטיס לא נשמרים" : "Secured by PayPal — card details never stored"}
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mt-20 mb-10">
          <h2 className="text-center text-2xl font-bold text-gray-800 mb-8">{t("buyFaqTitle")}</h2>
          <div className="space-y-3">
            {[
              { q: t("buyFaq1Q"), a: t("buyFaq1A") },
              { q: t("buyFaq2Q"), a: t("buyFaq2A") },
              { q: t("buyFaq3Q"), a: t("buyFaq3A") },
            ].map((item, i) => (
              <details key={i} className="group rounded-xl overflow-hidden bg-white shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none">
                  <span className="font-semibold text-gray-800 text-sm">{item.q}</span>
                  <svg className="w-4 h-4 group-open:rotate-180 transition-transform flex-shrink-0 ml-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </summary>
                <div className="px-5 pb-4 text-sm leading-relaxed pt-3 text-gray-500" style={{ borderTop: "1px solid #f3f4f6" }}>
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* Support */}
        <div className="max-w-md mx-auto pb-20">
          <div className="rounded-2xl p-8 text-center bg-white shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
            <div className="w-12 h-12 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: "#6366f1" }}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              {isRtl ? "תמיכה טכנית" : "Technical Support"}
            </h3>
            <p className="text-sm mb-6 leading-relaxed text-gray-500">
              {isRtl ? "שאלות לגבי רכישה או בעיות טכניות? אנחנו כאן לעזור." : "Questions about your purchase or technical issues? We're here to help."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {contactSettings?.supportEmail ? (
                <a href={`mailto:${contactSettings.supportEmail}`}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all text-sm text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100"
                  style={{ border: "1px solid #e5e7eb" }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  {isRtl ? "שלח אימייל" : "Send Email"}
                </a>
              ) : (
                <a href="mailto:support@dxfai.ai"
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all text-sm text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100"
                  style={{ border: "1px solid #e5e7eb" }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  support@dxfai.ai
                </a>
              )}
              {contactSettings?.whatsappNumber && (
                <a href={`https://wa.me/${contactSettings.whatsappNumber.replace(/[^0-9]/g, "")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all text-sm"
                  style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a" }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.528 5.845L.057 23.5l5.797-1.522A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.848 0-3.576-.5-5.065-1.375l-.363-.215-3.44.902.918-3.354-.236-.38A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                  WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
