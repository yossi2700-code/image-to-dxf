/**
 * paypal.ts
 * PayPal Orders API v2 helpers.
 * Credentials injected via PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET env vars.
 * Set PAYPAL_MODE=sandbox for testing, leave unset for production.
 */

// Use PAYPAL_MODE env var if set; otherwise default to production
// Note: sandbox client IDs work ONLY with sandbox API, live IDs work ONLY with live API
const PAYPAL_MODE = process.env.PAYPAL_MODE ?? "production";
const BASE_URL =
  PAYPAL_MODE === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

let _accessToken: string | null = null;
let _tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !secret) {
    throw new Error("PayPal credentials not configured (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)");
  }

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  _accessToken = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _accessToken;
}

export interface CreateOrderParams {
  packageId: string;
  tokens: number;
  amount: string;
  currency: string;
  userId: number;
  returnUrl: string;
  cancelUrl: string;
  useCard?: boolean; // if true, show card-first landing page (BILLING) via PayPal guest checkout
}

export interface PayPalOrderResponse {
  id: string;
  status: string;
  links: Array<{ href: string; rel: string; method: string }>;
}

export async function createPayPalOrder(params: CreateOrderParams): Promise<PayPalOrderResponse> {
  const token = await getAccessToken();

  // Both PayPal and card buttons use payment_source.paypal with GUEST_CHECKOUT.
  // When useCard=true we set landing_page=NO_PREFERENCE which shows the card option
  // prominently on the PayPal page (since "PayPal Account Optional" is enabled in the account).
  // When useCard=false we use GUEST_CHECKOUT which also allows card payments.
  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: `${params.packageId}_${params.userId}`,
        description: `${params.tokens} Design Tokens — dxfai.net`,
        amount: {
          currency_code: params.currency,
          value: params.amount,
        },
        custom_id: String(params.userId),
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "DXF AI",
          locale: "en-US",
          // GUEST_CHECKOUT: shows "Pay with Debit or Credit Card" option prominently
          // when "PayPal Account Optional" is enabled in the merchant account.
          landing_page: "GUEST_CHECKOUT",
          user_action: "PAY_NOW",
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl,
          payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
          shipping_preference: "NO_SHIPPING",
        },
      },
    },
  };

  const res = await fetch(`${BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal createOrder failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<PayPalOrderResponse>;
}

export interface CaptureResult {
  id: string;
  status: string;
  purchase_units: Array<{
    reference_id: string;
    payments: {
      captures: Array<{
        id: string;
        status: string;
        amount: { currency_code: string; value: string };
      }>;
    };
  }>;
}

export async function capturePayPalOrder(orderId: string): Promise<CaptureResult> {
  const token = await getAccessToken();

  const res = await fetch(`${BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal capture failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<CaptureResult>;
}

export async function getPayPalOrder(orderId: string): Promise<{ id: string; status: string }> {
  const token = await getAccessToken();

  const res = await fetch(`${BASE_URL}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal getOrder failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<{ id: string; status: string }>;
}

export function isPayPalConfigured(): boolean {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export function getPayPalMode(): string {
  return PAYPAL_MODE;
}

export function getPayPalClientId(): string {
  return process.env.PAYPAL_CLIENT_ID ?? "";
}
