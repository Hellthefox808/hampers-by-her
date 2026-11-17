const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { app } = require("../server/index");

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test("API - GET /catalog/products returns paginated list of items", async () => {
  const res = await fetch(`${baseUrl}/catalog/products`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.count, 4);
});

test("API - GET /catalog/products/:id returns enriched item view", async () => {
  const res = await fetch(`${baseUrl}/catalog/products/prod_wedding_vows`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.title, "The Vows & Vines Hamper");
  assert.ok(data.data.inclusions.length >= 4);
  assert.ok(data.data.recommendations.length > 0);
  assert.ok(data.data.personalizationOptions.ribbonColors.length >= 3);
});

test("API - GET /catalog/products/:id returns 404 for unknown product", async () => {
  const res = await fetch(`${baseUrl}/catalog/products/unknown_product_999`);
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.success, false);
});

test("API - GET /instagram/feed returns live synced feed", async () => {
  const res = await fetch(`${baseUrl}/instagram/feed?limit=2`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.items.length, 2);
  assert.equal(data.data.account, "@hampers._by_her");
});

test("API - GET /instagram/webhook handles Meta challenge", async () => {
  const res = await fetch(`${baseUrl}/instagram/webhook?hub.mode=subscribe&hub.verify_token=hbh_insta_verify_token_2026&hub.challenge=test_challenge_123`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.equal(text, "test_challenge_123");
});

test("API - GET /whatsapp/webhook handles Meta challenge", async () => {
  const res = await fetch(`${baseUrl}/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=hbh_waa_verify_token_2026&hub.challenge=wa_challenge_456`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.equal(text, "wa_challenge_456");
});

test("API - POST /whatsapp/inquire dispatches item inquiry with waMe link", async () => {
  const res = await fetch(`${baseUrl}/whatsapp/inquire`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId: "prod_wedding_vows",
      customerName: "Kabir Mehra",
      ribbon: "Natural Ecru Raw Silk",
      waxSeal: "Botanica",
      pinCode: "110001"
    })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.data.waMeUrl.includes("wa.me"));
  assert.ok(data.data.inquiryText.includes("The Vows & Vines Hamper"));
});

test("API - POST /whatsapp/simulate-incoming triggers 2-way bot turn", async () => {
  const res = await fetch(`${baseUrl}/whatsapp/simulate-incoming`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "919876543210",
      name: "Rohan",
      text: "Can you deliver to 110001?"
    })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.messagesProcessed, 1);
});

test("API - POST /payments/initiate generates mobile UPI intent link", async () => {
  const res = await fetch(`${baseUrl}/payments/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: "HBH-2026-TEST-001",
      amountPaise: 395000,
      currency: "INR",
      clientType: "mobile"
    })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.paymentMethod, "upi_intent");
  assert.ok(data.data.actionUrl.startsWith("upi://pay"));
});

test("API - POST /payments/initiate generates desktop Dynamic QR string", async () => {
  const res = await fetch(`${baseUrl}/payments/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: "HBH-2026-TEST-002",
      amountPaise: 540000,
      currency: "INR",
      clientType: "desktop"
    })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.paymentMethod, "upi_qr");
  assert.ok(data.data.qrCodeString.startsWith("upi://pay"));
  assert.ok(data.data.expiresInSeconds > 0);
});

test("API - GET /payments/gateways/health returns gateway health metrics", async () => {
  const res = await fetch(`${baseUrl}/payments/gateways/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.data.gateways.razorpay);
  assert.ok(data.data.gateways.cashfree);
});

test("API - GET /system/health returns platform observability & cache metrics", async () => {
  const res = await fetch(`${baseUrl}/system/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.data.status === "healthy" || data.data.status === "degraded");
  assert.ok(data.data.uptimeSeconds >= 0);
  assert.ok(data.data.cacheMetrics);
});
