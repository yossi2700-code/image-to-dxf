/**
 * products.ts
 * Defines token packages and regional pricing for PayPal checkout.
 */

export interface TokenPackage {
  id: "tokens_50" | "tokens_100";
  tokens: number;
  /** Price per region/currency */
  prices: Record<string, { amount: string; currency: string; symbol: string }>;
  /** Highlight as "best value" */
  popular?: boolean;
}

export const TOKEN_PACKAGES: TokenPackage[] = [
  {
    id: "tokens_50",
    tokens: 50,
    prices: {
      USD: { amount: "29.00", currency: "USD", symbol: "$" },
      EUR: { amount: "27.00", currency: "EUR", symbol: "€" },
      GBP: { amount: "23.00", currency: "GBP", symbol: "£" },
      ILS: { amount: "109.00", currency: "ILS", symbol: "₪" },
      CAD: { amount: "40.00", currency: "CAD", symbol: "CA$" },
      AUD: { amount: "45.00", currency: "AUD", symbol: "A$" },
      DEFAULT: { amount: "29.00", currency: "USD", symbol: "$" },
    },
  },
  {
    id: "tokens_100",
    tokens: 100,
    popular: true,
    prices: {
      USD: { amount: "49.00", currency: "USD", symbol: "$" },
      EUR: { amount: "45.00", currency: "EUR", symbol: "€" },
      GBP: { amount: "39.00", currency: "GBP", symbol: "£" },
      ILS: { amount: "185.00", currency: "ILS", symbol: "₪" },
      CAD: { amount: "67.00", currency: "CAD", symbol: "CA$" },
      AUD: { amount: "75.00", currency: "AUD", symbol: "A$" },
      DEFAULT: { amount: "49.00", currency: "USD", symbol: "$" },
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
