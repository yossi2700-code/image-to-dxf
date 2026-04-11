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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#0f1629] border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#0f1629] border-b border-white/10 flex justify-between items-center p-6" dir={isHe ? "rtl" : "ltr"}>
          <h2 className="text-xl font-bold text-white">{isHe ? "תנאי רכישה" : "Purchase Terms & Conditions"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-6 space-y-5 text-sm text-gray-300" dir={isHe ? "rtl" : "ltr"}>
          <p className="text-xs text-gray-500">{isHe ? "עדכון אחרון: מרץ 2026 | dxfai.ai" : "Last updated: March 2026 | dxfai.ai"}</p>
          {isHe ? (
            <>
              <section><h3 className="font-semibold text-white mb-2">1. חבילות אסימונים ותמחור</h3><p>בהשלמת הרכישה אתה רוכש רישיון שאינו ניתן להחזר ואינו ניתן להעברה לשימוש במספר האסימונים המצוין בפלטפורמת dxfai.ai.</p></section>
              <section><h3 className="font-semibold text-white mb-2">2. ללא תפוגה</h3><p>אסימונים שנרכשו אינם פגים ונשארים זמינים בחשבונך ללא הגבלת זמן.</p></section>
              <section><h3 className="font-semibold text-white mb-2">3. מדיניות אי-החזר</h3><p>כל הרכישות סופיות ואינן ניתנות להחזר. פנה לתמיכה בכתובת support@dxfai.ai תוך 14 יום מתאריך העסקה.</p></section>
              <section><h3 className="font-semibold text-white mb-2">4. עיבוד תשלומים</h3><p>התשלומים מעובדים בצורה מאובטחת על ידי PayPal Inc. איננו שומרים את פרטי כרטיס האשראי שלך.</p></section>
              <section><h3 className="font-semibold text-white mb-2">5. ניכוי אסימונים</h3><p>אסימונים מנוכים עם תחילת עיבוד. אם עבודה נכשלת עקב שגיאת שרת מאומתת, האסימון יוחזר תוך 24 שעות.</p></section>
              <section><h3 className="font-semibold text-white mb-2">6. יצירת קשר</h3><p>לשאלות: <a href="mailto:support@dxfai.ai" className="text-blue-400 hover:underline">support@dxfai.ai</a></p></section>
            </>
          ) : (
            <>
              <section><h3 className="font-semibold text-white mb-2">1. Token Packages &amp; Pricing</h3><p>By completing a purchase you acquire a non-refundable, non-transferable licence to use the stated number of design tokens on the dxfai.ai platform.</p></section>
              <section><h3 className="font-semibold text-white mb-2">2. No Expiry</h3><p>Purchased Tokens do not expire and remain available in your account indefinitely.</p></section>
              <section><h3 className="font-semibold text-white mb-2">3. No Refunds Policy</h3><p>All purchases are final and non-refundable. Contact support@dxfai.ai within 14 days of the transaction date for billing errors.</p></section>
              <section><h3 className="font-semibold text-white mb-2">4. Payment Processing</h3><p>Payments are processed securely by PayPal Inc. We do not store your payment card details.</p></section>
              <section><h3 className="font-semibold text-white mb-2">5. Token Deduction</h3><p>Tokens are deducted upon initiating a processing job. If a job fails due to a verified server-side error, the Token is automatically refunded within 24 hours.</p></section>
              <section><h3 className="font-semibold text-white mb-2">6. Contact</h3><p>For purchase-related queries: <a href="mailto:support@dxfai.ai" className="text-blue-400 hover:underline">support@dxfai.ai</a></p></section>
            </>
          )}
        </div>
        <div className="sticky bottom-0 bg-[#0f1629] border-t border-white/10 p-4 flex justify-end">
          <button onClick={onClose} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-colors text-sm">
            {isHe ? "סגור" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Feature Badge ────────────────────────────────────────────────────────────
function FeatureBadge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-300">
      <span className="text-emerald-400">{icon}</span>
      <span>{text}</span>
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

  const badgeConfig: Record<string, { text: string; className: string }> = {
    recommended: { text: isRtl ? "★ מומלץ" : "★ Recommended", className: "from-blue-500 to-indigo-600" },
    best_value: { text: isRtl ? "💰 הכי משתלם" : "💰 Best Value", className: "from-emerald-500 to-teal-600" },
    sale: { text: isRtl ? "🔥 במבצע" : "🔥 Sale", className: "from-rose-500 to-pink-600" },
    trial: { text: isRtl ? "🌟 התנסות" : "🌟 Starter", className: "from-violet-500 to-purple-600" },
  };

  return (
    <div className="min-h-screen bg-[#080d1a] text-white" dir={isRtl ? "rtl" : "ltr"}>
      {showTermsModal && <PurchaseTermsModal onClose={() => setShowTermsModal(false)} />}

      {/* Subtle background grid */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

      {/* Top glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-4 py-12">

        {/* Back button */}
        <button
          onClick={() => navigate("/")}
          className="mb-10 inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm group"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t("back")}
        </button>

        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-xs text-blue-300 font-medium mb-6 tracking-wide uppercase">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            {isRtl ? "אסימוני עיצוב" : "Design Tokens"}
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-4 tracking-tight">
            <span className="text-white">{isRtl ? "בחר " : "Choose Your "}</span>
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
              {isRtl ? "חבילה" : "Plan"}
            </span>
          </h1>
          <p className="text-gray-400 text-lg max-w-md mx-auto leading-relaxed">
            {t("buyPageSubtitle")}
          </p>

          {isLoggedIn && balance !== null && (
            <div className="mt-6 inline-flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-6 py-3">
              <div className="w-8 h-8 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
              </div>
              <div className="text-left">
                <div className="text-xs text-gray-500">{t("buyCurrentBalance")}</div>
                <div className="text-white font-bold">{balance} <span className="text-gray-400 font-normal text-sm">{t("buyTokensLabel")}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Currency selector */}
        <div className="flex justify-center mb-10">
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-5 py-2.5 hover:border-white/20 transition-colors">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span className="text-sm text-gray-400">{t("buySelectCurrency")}:</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="bg-transparent text-white text-sm font-semibold focus:outline-none cursor-pointer"
            >
              {activeCurrencies.map((c) => (
                <option key={c} value={c} className="bg-[#0f1629] text-white">
                  {c} {CURRENCY_SYMBOLS[c as keyof typeof CURRENCY_SYMBOLS] ?? c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Package cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-12 max-w-3xl mx-auto">
          {packages.map((p) => {
            const pPrice = p.prices[currency] ?? p.prices["USD"];
            const pDiscount = (p as { discountPercent?: number }).discountPercent ?? 0;
            const pFinalPrice = pDiscount > 0 ? (parseFloat(pPrice) * (1 - pDiscount / 100)).toFixed(2) : pPrice;
            const pPerToken = (parseFloat(pFinalPrice) / p.tokens).toFixed(2);
            const isSelected = selectedPackage === p.id;
            const badge = (p as { badge?: string | null }).badge ?? null;

            return (
              <div
                key={p.id}
                onClick={() => setSelectedPackage(p.id)}
                className={`relative cursor-pointer rounded-2xl border transition-all duration-200 select-none overflow-hidden ${
                  isSelected
                    ? "border-blue-500/60 bg-gradient-to-b from-blue-900/40 to-blue-950/60 shadow-2xl shadow-blue-500/10"
                    : "border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]"
                }`}
              >
                {/* Selected glow */}
                {isSelected && (
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent pointer-events-none" />
                )}

                {/* Badge */}
                {badge && badgeConfig[badge] && (
                  <div className={`absolute top-0 left-0 right-0 py-1.5 text-center text-xs font-bold tracking-wide bg-gradient-to-r ${badgeConfig[badge].className} text-white`}>
                    {badgeConfig[badge].text}
                  </div>
                )}
                {!badge && p.popular && !pDiscount && (
                  <div className="absolute top-0 left-0 right-0 py-1.5 text-center text-xs font-bold tracking-wide bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                    ⭐ {t("buyBestValue")}
                  </div>
                )}
                {pDiscount > 0 && (
                  <div className="absolute top-3 right-3 bg-rose-500 text-white text-xs font-black px-2.5 py-1 rounded-full">
                    -{pDiscount}%
                  </div>
                )}

                <div className={`p-7 ${badge || (p.popular && !pDiscount) ? "pt-10" : ""}`}>
                  {/* Token count */}
                  <div className="mb-5">
                    <div className="flex items-end gap-2 mb-1">
                      <span className="text-5xl font-black tabular-nums text-white">{p.tokens}</span>
                      <span className="text-gray-400 text-sm mb-1.5 uppercase tracking-widest">{t("buyTokensCount")}</span>
                    </div>
                    {(p as { label?: string | null }).label && (
                      <p className="text-gray-500 text-sm">{(p as { label?: string | null }).label}</p>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-white/8 mb-5" />

                  {/* Price */}
                  <div className="mb-5">
                    {pDiscount > 0 ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-gray-600 line-through text-lg">{symbol}{pPrice}</span>
                        <span className="text-3xl font-black text-white">{symbol}{pFinalPrice}</span>
                      </div>
                    ) : (
                      <span className="text-3xl font-black text-white">{symbol}{pFinalPrice}</span>
                    )}
                    <div className="text-gray-500 text-xs mt-1">{symbol}{pPerToken} {t("buyPerToken")}</div>
                  </div>

                  {/* Select indicator */}
                  <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 transition-all ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "bg-white/5 text-gray-400 group-hover:bg-white/10"
                  }`}>
                    <span className="text-sm font-semibold">
                      {isSelected ? (isRtl ? "נבחר" : "Selected") : (isRtl ? "בחר חבילה" : "Select plan")}
                    </span>
                    {isSelected ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Features */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>, text: isRtl ? "ללא תפוגה" : "Never expire" },
              { icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>, text: isRtl ? "תשלום מאובטח" : "Secure payment" },
              { icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>, text: isRtl ? "זיכוי מיידי" : "Instant credit" },
              { icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>, text: isRtl ? "PayPal מאובטח" : "PayPal secured" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-2.5 bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3">
                <span className="text-emerald-400 flex-shrink-0">{f.icon}</span>
                <span className="text-gray-300 text-xs font-medium">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Purchase card */}
        <div className="max-w-md mx-auto">
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-sm">

            {/* Order summary */}
            <div className="mb-6">
              <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-4">{isRtl ? "סיכום הזמנה" : "Order Summary"}</h3>
              <div className="flex items-center justify-between py-3 border-b border-white/8">
                <div>
                  <div className="text-white font-semibold">{pkg.tokens} {t("buyTokensLabel")}</div>
                  <div className="text-gray-500 text-xs mt-0.5">{symbol}{perToken} {t("buyPerToken")}</div>
                </div>
                <div className="text-right">
                  {discount > 0 && <div className="text-gray-600 line-through text-sm">{symbol}{price}</div>}
                  <div className="text-white font-bold text-xl">{symbol}{finalPrice}</div>
                  <div className="text-gray-500 text-xs">{currency}</div>
                </div>
              </div>
            </div>

            {/* Terms */}
            <label className="flex items-start gap-3 mb-5 cursor-pointer group">
              <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${termsAccepted ? "bg-blue-600 border-blue-600" : "border-white/20 group-hover:border-white/40"}`}
                onClick={() => { setTermsAccepted(!termsAccepted); if (error) setError(null); }}>
                {termsAccepted && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
              </div>
              <input type="checkbox" checked={termsAccepted} onChange={(e) => { setTermsAccepted(e.target.checked); if (error) setError(null); }} className="sr-only" />
              <span className="text-sm text-gray-400 leading-relaxed">
                {t("buyTermsCheckbox")}{" "}
                <button type="button" onClick={(e) => { e.preventDefault(); setShowTermsModal(true); }} className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
                  {t("buyTermsLink")}
                </button>
              </span>
            </label>

            {/* Alerts */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center">
                {error}
              </div>
            )}
            {isLoggedIn === false && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-sm text-center">
                {t("buyLoginRequired")}
              </div>
            )}
            {paypalConfigured === false && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400 text-sm text-center">
                {t("buyPayPalNotConfigured")}
              </div>
            )}

            {/* Payment method tabs */}
            <div className="flex gap-2 mb-5 p-1 bg-white/5 rounded-xl">
              {/* Credit Card — Coming Soon */}
              <div className="flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 text-gray-600 cursor-not-allowed select-none">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
                <span className="text-xs font-medium">{isRtl ? "כרטיס — בקרוב" : "Card — Soon"}</span>
              </div>
              {/* PayPal */}
              <div className="flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 bg-white/8 text-white cursor-default select-none">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"/>
                </svg>
                <span className="text-xs font-semibold">PayPal</span>
              </div>
            </div>

            {/* PayPal button */}
            <button
              onClick={handlePurchase}
              disabled={loading || !termsAccepted || isLoggedIn === false || paypalConfigured === false}
              className={`w-full py-4 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-3 ${
                loading || !termsAccepted || isLoggedIn === false || paypalConfigured === false
                  ? "bg-white/5 text-gray-600 cursor-not-allowed"
                  : "bg-[#0070BA] hover:bg-[#005ea6] active:bg-[#004a87] text-white shadow-lg shadow-blue-900/30 hover:shadow-blue-700/40 hover:scale-[1.01]"
              }`}
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

            <div className="mt-4 flex items-center justify-center gap-2 text-gray-600 text-xs">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              {isRtl ? "מאובטח על ידי PayPal — פרטי הכרטיס לא נשמרים" : "Secured by PayPal — card details never stored"}
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mt-20 mb-10">
          <h2 className="text-center text-2xl font-bold text-white mb-8">{t("buyFaqTitle")}</h2>
          <div className="space-y-3">
            {[
              { q: t("buyFaq1Q"), a: t("buyFaq1A") },
              { q: t("buyFaq2Q"), a: t("buyFaq2A") },
              { q: t("buyFaq3Q"), a: t("buyFaq3A") },
            ].map((item, i) => (
              <details key={i} className="group bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none">
                  <span className="font-semibold text-white text-sm">{item.q}</span>
                  <svg className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform flex-shrink-0 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </summary>
                <div className="px-5 pb-4 text-gray-400 text-sm leading-relaxed border-t border-white/8 pt-3">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* Support */}
        <div className="max-w-md mx-auto pb-20">
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/></svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              {isRtl ? "תמיכה טכנית" : "Technical Support"}
            </h3>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              {isRtl ? "שאלות לגבי רכישה או בעיות טכניות? אנחנו כאן לעזור." : "Questions about your purchase or technical issues? We're here to help."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {contactSettings?.supportEmail ? (
                <a href={`mailto:${contactSettings.supportEmail}`}
                  className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white px-5 py-2.5 rounded-xl font-medium transition-all text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  {isRtl ? "שלח אימייל" : "Send Email"}
                </a>
              ) : (
                <a href="mailto:support@dxfai.ai"
                  className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white px-5 py-2.5 rounded-xl font-medium transition-all text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  support@dxfai.ai
                </a>
              )}
              {contactSettings?.whatsappNumber && (
                <a href={`https://wa.me/${contactSettings.whatsappNumber.replace(/[^0-9]/g, "")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/30 hover:border-emerald-500/50 text-emerald-300 px-5 py-2.5 rounded-xl font-medium transition-all text-sm">
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
