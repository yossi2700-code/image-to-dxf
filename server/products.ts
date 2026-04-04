/**
 * products.ts
 * Defines token packages and regional pricing for PayPal checkout.
 * NOTE: DB prices (packagePrices table) take precedence over these fallback values.
 * Keep these in sync with the DB to avoid price discrepancies.
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
      USD: { amount: "7.99", currency: "USD", symbol: "$" },
      EUR: { amount: "7.50", currency: "EUR", symbol: "€" },
      GBP: { amount: "6.50", currency: "GBP", symbol: "£" },
      ILS: { amount: "29.00", currency: "ILS", symbol: "₪" },
      CAD: { amount: "11.00", currency: "CAD", symbol: "CA$" },
      AUD: { amount: "12.00", currency: "AUD", symbol: "A$" },
      DEFAULT: { amount: "7.99", currency: "USD", symbol: "$" },
    },
  },
  {
    id: "tokens_100",
    tokens: 100,
    popular: true,
    prices: {
      USD: { amount: "15.99", currency: "USD", symbol: "$" },
      EUR: { amount: "14.99", currency: "EUR", symbol: "€" },
      GBP: { amount: "12.99", currency: "GBP", symbol: "£" },
      ILS: { amount: "59.00", currency: "ILS", symbol: "₪" },
      CAD: { amount: "21.00", currency: "CAD", symbol: "CA$" },
      AUD: { amount: "24.00", currency: "AUD", symbol: "A$" },
      DEFAULT: { amount: "15.99", currency: "USD", symbol: "$" },
    },
  },
  {
    id: "tokens_300",
    tokens: 300,
    prices: {
      USD: { amount: "33.99", currency: "USD", symbol: "$" },
      EUR: { amount: "31.99", currency: "EUR", symbol: "€" },
      GBP: { amount: "27.99", currency: "GBP", symbol: "£" },
      ILS: { amount: "129.00", currency: "ILS", symbol: "₪" },
      CAD: { amount: "46.00", currency: "CAD", symbol: "CA$" },
      AUD: { amount: "52.00", currency: "AUD", symbol: "A$" },
      DEFAULT: { amount: "33.99", currency: "USD", symbol: "$" },
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
