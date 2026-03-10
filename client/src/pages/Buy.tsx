import { useState, useEffect } from "react";
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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-900 flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Purchase Terms &amp; Conditions</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-3xl leading-none font-light"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-5 text-sm text-gray-700 dark:text-gray-300">
          <p className="text-xs text-gray-500 dark:text-gray-400">Last updated: March 2026 | dxfai.net</p>

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
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Buy Page ────────────────────────────────────────────────────────────
export default function Buy() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();

  const [currency, setCurrency] = useState(() => detectCurrency());
  const [selectedPackage, setSelectedPackage] = useState("tokens_100");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paypalConfigured, setPaypalConfigured] = useState<boolean | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // קריאת מחירים דינמיים מה-DB
  const { data: dbPrices, isLoading: pricesLoading } = trpc.packages.prices.useQuery();

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
    fetch("/api/paypal/status")
      .then((r) => r.json())
      .then((d) => setPaypalConfigured(!!d?.configured))
      .catch(() => setPaypalConfigured(false));

    // Check auth & balance
    fetch("/api/app-auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setIsLoggedIn(!!d?.user);
        if (d?.user) setBalance(d.user.tokenBalance ?? null);
      })
      .catch(() => setIsLoggedIn(false));
  }, []);

  // בניית חבילות מה-DB או מה-fallback
  const packages = dbPrices && dbPrices.length > 0
    ? dbPrices.map((p) => ({
        id: p.packageId,
        tokens: p.tokenAmount,
        popular: p.packageId === "tokens_100",
        label: p.label,
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
    if (!isLoggedIn) { setError(t("buyLoginRequired")); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          packageId: selectedPackage,
          currency,
          termsAccepted: true,
          origin: window.location.origin,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.approvalUrl) {
        setError(data.error ?? t("buyOrderError"));
        return;
      }
      window.location.href = data.approvalUrl;
    } catch {
      setError(t("buyOrderError"));
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
              {p.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-400 text-black text-xs font-black px-5 py-1 rounded-full shadow-lg">
                  ⭐ {t("buyBestValue")}
                </div>
              )}

              <div className="text-center">
                <div className="text-6xl font-black mb-1 tabular-nums">{p.tokens}</div>
                <div className="text-blue-200 text-sm mb-5 uppercase tracking-widest">{t("buyTokensCount")}</div>
                <div className="text-4xl font-bold mb-1">{symbol}{pPrice}</div>
                <div className="text-blue-300 text-xs mt-1">
                  {symbol}{pPerToken} {t("buyPerToken")}
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

        {/* CTA */}
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
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto px-4 pb-20">
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
    </div>
  );
}
