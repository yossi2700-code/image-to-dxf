/**
 * products.ts
 * Defines token packages and regional pricing for PayPal checkout.
 * IMPORTANT: These are FALLBACK prices only — the server always prefers
 * prices from the `packagePrices` DB table. Keep in sync with DB.
 *
 * Last updated: April 2026
 */
export interface TokenPackage {
  id: string;
  tokens: number;
  /** Price per region/currency */
  prices: Record<string, { amount: string; currency: string; symbol: string }>;
  /** Highlight as "best value" */
  popular?: boolean;
}

export const TOKEN_PACKAGES: TokenPackage[] = [
  {
    id: "tokens_3",
    tokens: 30,
    prices: {
      USD: { amount: "7.83", currency: "USD", symbol: "$" },
      EUR: { amount: "7.25", currency: "EUR", symbol: "€" },
      GBP: { amount: "6.09", currency: "GBP", symbol: "£" },
      ILS: { amount: "29", currency: "ILS", symbol: "₪" },
      CAD: { amount: "10.73", currency: "CAD", symbol: "CA$" },
      AUD: { amount: "12.18", currency: "AUD", symbol: "A$" },
      DEFAULT: { amount: "7.83", currency: "USD", symbol: "$" },
    },
  },
  {
    id: "tokens_1",
    tokens: 100,
    popular: true,
    prices: {
      USD: { amount: "15.93", currency: "USD", symbol: "$" },
      EUR: { amount: "14.75", currency: "EUR", symbol: "€" },
      GBP: { amount: "12.39", currency: "GBP", symbol: "£" },
      ILS: { amount: "59", currency: "ILS", symbol: "₪" },
      CAD: { amount: "21.83", currency: "CAD", symbol: "CA$" },
      AUD: { amount: "24.78", currency: "AUD", symbol: "A$" },
      DEFAULT: { amount: "15.93", currency: "USD", symbol: "$" },
    },
  },
  {
    id: "tokens_300",
    tokens: 300,
    prices: {
      USD: { amount: "34.83", currency: "USD", symbol: "$" },
      EUR: { amount: "32.25", currency: "EUR", symbol: "€" },
      GBP: { amount: "27.09", currency: "GBP", symbol: "£" },
      ILS: { amount: "129", currency: "ILS", symbol: "₪" },
      CAD: { amount: "47.73", currency: "CAD", symbol: "CA$" },
      AUD: { amount: "54.18", currency: "AUD", symbol: "A$" },
      DEFAULT: { amount: "34.83", currency: "USD", symbol: "$" },
    },
  },
];

/** Map country code → currency code */
export const COUNTRY_CURRENCY: Record<string, string> = {
  US: "USD", CA: "CAD", AU: "AUD",
  GB: "GBP",
  IL: "ILS",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR",
  AT: "EUR", BE: "EUR", PT: "EUR", FI: "EUR", IE: "EUR",
  GR: "EUR", CY: "EUR", LU: "EUR", MT: "EUR", SK: "EUR",
  SI: "EUR", EE: "EUR", LV: "EUR", LT: "EUR",
};

export function getPackageById(id: string): TokenPackage | undefined {
  return TOKEN_PACKAGES.find((p) => p.id === id);
}

export function getPriceForCurrency(pkg: TokenPackage, currency: string) {
  return pkg.prices[currency] ?? pkg.prices["DEFAULT"];
}
