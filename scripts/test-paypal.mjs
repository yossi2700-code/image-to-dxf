/**
 * test-paypal.mjs
 * Quick script to verify PayPal credentials are working.
 */
const clientId = process.env.PAYPAL_CLIENT_ID;
const secret = process.env.PAYPAL_CLIENT_SECRET;
const mode = process.env.PAYPAL_MODE ?? "sandbox";

console.log("PayPal Mode:", mode);
console.log("Client ID set:", !!clientId, clientId ? `(${clientId.substring(0, 10)}...)` : "MISSING");
console.log("Secret set:", !!secret);

if (!clientId || !secret) {
  console.error("ERROR: Missing PayPal credentials");
  process.exit(1);
}

const base =
  mode === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

const creds = Buffer.from(`${clientId}:${secret}`).toString("base64");

try {
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${creds}`,
    },
    body: "grant_type=client_credentials",
  });

  const data = await res.json();

  if (data.access_token) {
    console.log(`\nSUCCESS ✅ Got access token (${data.access_token.substring(0, 20)}...)`);
    console.log(`Expires in: ${data.expires_in} seconds`);
    console.log(`App ID: ${data.app_id}`);
  } else {
    console.error("\nERROR ❌:", JSON.stringify(data, null, 2));
    process.exit(1);
  }
} catch (e) {
  console.error("FETCH ERROR:", e.message);
  process.exit(1);
}
