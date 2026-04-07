// Update the shared file record with the preview image URL
// We'll use the freedxf API endpoint or directly update via a tRPC admin call

const previewUrl = "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/lion-preview_b80c1f3c.png";

// Since we need admin auth, let's use the admin login first
// First login as admin
const loginResp = await fetch("http://localhost:3000/api/trpc/adminLogin", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ json: { pin: process.env.ADMIN_PIN || "" } })
});
const loginData = await loginResp.json();
console.log("Login response:", JSON.stringify(loginData).substring(0, 200));

// Get the cookie from the response
const cookies = loginResp.headers.getSetCookie?.() || [];
console.log("Cookies:", cookies);

// Use the cookie to call adminUpdate
const cookie = cookies.find(c => c.startsWith("admin_session="));
if (!cookie) {
  console.log("No admin cookie found, trying direct DB update via SQL endpoint...");
  // Alternative: use the admin update tRPC endpoint with cookie
  process.exit(1);
}

const updateResp = await fetch("http://localhost:3000/api/trpc/sharedFiles.adminUpdate", {
  method: "POST",
  headers: { 
    "Content-Type": "application/json",
    "Cookie": cookie.split(";")[0]
  },
  body: JSON.stringify({ json: { id: 1, previewImageUrl: previewUrl } })
});
const updateData = await updateResp.json();
console.log("Update response:", JSON.stringify(updateData));
