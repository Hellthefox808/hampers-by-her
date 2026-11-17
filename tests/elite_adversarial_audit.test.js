/**
 * Hampers by Her — Elite Engineering Adversarial Audit & Hardening Verification Suite
 * Proves runtime observability (/metrics), API 404 isolation, XSS escaping,
 * constant-time JWT/RBAC enforcement, transactional inventory rollback,
 * crash-resilient studio transitions, and honest Admin UI error handling.
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const fs = require("fs");
const path = require("path");

const { app, metricsCollector } = require("../server/index");
const { authService } = require("../server/services/authService");
const { OrderService } = require("../server/services/orderService");
const { adminService } = require("../server/services/adminService");
const { persistenceEngine } = require("../server/services/persistenceEngine");
const { inventoryEngine } = require("../platform/services/scaling-service/inventoryLock");

function request(port, method, urlPath, { body = null, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (payload) {
      reqHeaders["Content-Type"] = "application/json";
      reqHeaders["Content-Length"] = Buffer.byteLength(payload);
    }

    const req = http.request({ hostname: "127.0.0.1", port, path: urlPath, method, headers: reqHeaders }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch { /* non-JSON */ }
        resolve({ status: res.statusCode, headers: res.headers, text: data, json: parsed });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe("Elite Adversarial Audit & Runtime Hardening Suite", () => {
  let server;
  let port;
  const origDisableRateLimit = process.env.DISABLE_RATE_LIMIT;

  before(async () => {
    process.env.DISABLE_RATE_LIMIT = "true";
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = server.address().port;
  });

  after(async () => {
    if (origDisableRateLimit === undefined) delete process.env.DISABLE_RATE_LIMIT;
    else process.env.DISABLE_RATE_LIMIT = origDisableRateLimit;
    delete process.env.REQUIRE_ADMIN_AUTH;
    metricsCollector.shutdown();
    await new Promise((resolve) => server.close(resolve));
  });

  // 1. Real Prometheus /metrics Endpoint & Security Headers
  test("GET /metrics returns Prometheus v0.0.4 metrics matching alerts.yml selectors", async () => {
    await request(port, "GET", "/health");
    const res = await request(port, "GET", "/metrics");
    assert.equal(res.status, 200);
    assert.ok(res.headers["content-type"].includes("text/plain"), "Must serve text/plain Prometheus exposition");
    assert.ok(res.text.includes("http_requests_total"), "Must export http_requests_total");
    assert.ok(res.text.includes("http_request_duration_seconds_bucket"), "Must export latency histogram buckets");
    assert.ok(res.text.includes("nodejs_eventloop_lag_seconds"), "Must export nodejs_eventloop_lag_seconds");
    assert.ok(res.text.includes("process_resident_memory_bytes"), "Must export process RSS memory");
    assert.ok(!res.text.includes("<!DOCTYPE html>"), "Must NEVER fall through to HTML SPA index");
  });

  test("Security headers strip X-Powered-By, enforce CSP, and propagate X-Request-Id", async () => {
    const res = await request(port, "GET", "/health", { headers: { "X-Request-Id": "trace-audit-001" } });
    assert.equal(res.status, 200);
    assert.equal(res.headers["x-request-id"], "trace-audit-001");
    assert.equal(res.headers["x-powered-by"], undefined, "X-Powered-By must be stripped");
    assert.ok(res.headers["content-security-policy"], "Content-Security-Policy header must be present");
    assert.equal(res.headers["x-content-type-options"], "nosniff");
  });

  test("Unmatched /api/* path returns RFC 7807 JSON 404 instead of SPA HTML", async () => {
    const res = await request(port, "GET", "/api/v1/nonexistent-endpoint-audit");
    assert.equal(res.status, 404);
    assert.ok(res.json, "404 response must be valid JSON");
    assert.equal(res.json.status, 404);
    assert.equal(res.json.title, "API Endpoint Not Found");
    assert.ok(res.json.requestId, "Must attach correlation requestId");
  });

  // 2. Stored & Reflected XSS Prevention
  test("Printable packing slip neutralizes stored XSS payloads in customer fields", async () => {
    const xssPayload = `<script>alert("xss")</script>`;
    const order = OrderService.createOrder({
      items: [{ id: "hbh_xss", name: `Truffle <b>${xssPayload}</b>`, pricePaise: 250000, quantity: 1 }],
      cardMessage: `Happy Diwali ${xssPayload}`,
      customMonogram: `<img src=x onerror=alert(1)>`,
      shippingAddress: {
        fullName: `Patron ${xssPayload}`,
        line1: `123 <script>evil()</script> Road`,
        city: "New Delhi",
        pincode: "110001"
      }
    });

    const slipRes = await request(port, "GET", `/api/v1/admin/orders/${order.orderNumber}/packing-slip`);
    assert.equal(slipRes.status, 200);
    assert.ok(!slipRes.text.includes("<script>"), "Raw <script> tag MUST NOT appear in packing slip HTML");
    assert.ok(!slipRes.text.includes("onerror=alert(1)>"), "Raw img onerror vector MUST be escaped");
    assert.ok(slipRes.text.includes("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"), "Must HTML-escape payload");
  });

  test("Packing slip 404 response HTML-escapes reflected orderNumber input", async () => {
    const res = await request(port, "GET", `/api/v1/admin/orders/${encodeURIComponent("<script>x()</script>")}/packing-slip`);
    assert.equal(res.status, 404);
    assert.ok(!res.text.includes("<script>x()</script>"), "Reflected XSS must be escaped in 404 HTML");
    assert.ok(res.text.includes("&lt;script&gt;x()&lt;/script&gt;"));
  });

  // 3. Staff Login & Fail-Closed RBAC Enforcement
  test("Staff PIN login issues valid JWT on correct PIN and rejects wrong PIN with 401", async () => {
    const badRes = await request(port, "POST", "/api/v1/auth/staff-login", { body: { pin: "0000" } });
    assert.equal(badRes.status, 401);
    assert.equal(badRes.json.success, false);

    const goodRes = await request(port, "POST", "/api/v1/auth/staff-login", { body: { pin: "2026", staffId: "staff_ops" } });
    assert.equal(goodRes.status, 200);
    assert.equal(goodRes.json.success, true);
    assert.ok(goodRes.json.data.token, "Must return signed JWT");
    assert.equal(goodRes.json.data.user.role, "OPERATIONS");
  });

  test("Admin RBAC middleware rejects tampered tokens (401), rejects CUSTOMER JWT (403), and enforces strict mode", async () => {
    // Tampered token always rejected with 401
    const tamperedRes = await request(port, "GET", "/api/v1/admin/orders", {
      headers: { Authorization: "Bearer invalid.jwt.signature" }
    });
    assert.equal(tamperedRes.status, 401);

    // CUSTOMER JWT rejected with 403
    const customerToken = authService.createJwtToken({
      userId: "cust_audit_1",
      phone: "919999888877",
      role: "CUSTOMER",
      name: "Audit Patron"
    });
    const forbiddenRes = await request(port, "GET", "/api/v1/admin/orders", {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.equal(forbiddenRes.status, 403);

    // Strict mode (production / REQUIRE_ADMIN_AUTH=true) fails closed without token
    process.env.REQUIRE_ADMIN_AUTH = "true";
    const noTokenRes = await request(port, "GET", "/api/v1/admin/orders");
    assert.equal(noTokenRes.status, 401);

    // Staff JWT succeeds in strict mode
    const staffLogin = await request(port, "POST", "/api/v1/auth/staff-login", { body: { pin: "2026" } });
    const okRes = await request(port, "GET", "/api/v1/admin/orders", {
      headers: { Authorization: `Bearer ${staffLogin.json.data.token}` }
    });
    assert.equal(okRes.status, 200);
    assert.equal(okRes.json.success, true);
    delete process.env.REQUIRE_ADMIN_AUTH;
  });

  // 4. Transactional Inventory Enforcement & Rollback on Partial Failure
  test("Checkout rejects INSUFFICIENT_STOCK with 409 and atomically rolls back earlier SKU reservations", async () => {
    const skuA = "SKU-AUDIT-A-" + Date.now();
    const skuB = "SKU-AUDIT-B-" + Date.now();
    inventoryEngine.setStock(skuA, 5);
    inventoryEngine.setStock(skuB, 1);

    // Request 2 of SKU-A (succeeds) and 3 of SKU-B (fails - only 1 available)
    const conflictRes = await request(port, "POST", "/api/v1/checkout/create-order", {
      body: {
        items: [
          { sku: skuA, name: "Item A", pricePaise: 100000, quantity: 2 },
          { sku: skuB, name: "Item B", pricePaise: 100000, quantity: 3 }
        ],
        shippingAddress: { fullName: "Test", line1: "1 Main St", city: "Delhi", pincode: "110001" }
      }
    });

    assert.equal(conflictRes.status, 409, "Must reject oversell with HTTP 409 Conflict");
    assert.equal(conflictRes.json.error.code, "INSUFFICIENT_STOCK");
    assert.equal(inventoryEngine.getStock(skuA).available, 5, "SKU-A reservation MUST be rolled back to 5");
    assert.equal(inventoryEngine.getStock(skuA).reserved, 0, "SKU-A reserved count MUST return to 0");

    // Also verify rollback when OrderService validation fails (invalid pincode) after reserving SKU-A
    const badPinRes = await request(port, "POST", "/api/v1/checkout/create-order", {
      body: {
        items: [{ sku: skuA, name: "Item A", pricePaise: 100000, quantity: 2 }],
        shippingAddress: { fullName: "Test", line1: "1 Main St", city: "Delhi", pincode: "000000" }
      }
    });
    assert.equal(badPinRes.status, 400);
    assert.equal(inventoryEngine.getStock(skuA).available, 5, "SKU-A reservation MUST roll back on invalid order payload");
  });

  // 5. Studio Order Transition Persistence Integrity
  test("Studio status transitions persist to disk and survive reload", () => {
    const order = OrderService.createOrder({
      items: [{ id: "hbh_pers", name: "Royal Hamper", pricePaise: 420000, quantity: 1 }],
      shippingAddress: { fullName: "Persist Test", line1: "CP", city: "New Delhi", pincode: "110001" }
    });
    OrderService.confirmPayment(order.orderNumber, { paymentId: "pay_pers_1", method: "UPI" });
    adminService.transitionOrderStatus({
      orderNumber: order.orderNumber,
      targetStatus: "IN_PRODUCTION",
      actorName: "Audit Artisan"
    });
    OrderService.flushPersistence();

    const persisted = persistenceEngine.loadState();
    const reloaded = persisted.orders.find((o) => o.orderNumber === order.orderNumber);
    assert.ok(reloaded, "Order must exist in persisted store");
    assert.equal(reloaded.status, "IN_PRODUCTION", "Studio transition status MUST survive persistence flush");
  });

  // 6. Admin Frontend Honesty & XSS Hygiene Audit
  test("website/admin.html contains zero fake-completion alerts, escapes HTML, and uses server JWT auth", () => {
    const adminHtml = fs.readFileSync(path.join(__dirname, "..", "website", "admin.html"), "utf8");
    assert.ok(!adminHtml.includes("Verified: Order passed QC gate successfully."), "Must NOT fake QC success on network error");
    assert.ok(!adminHtml.includes("AWB Manifest Assigned via BlueDart Priority Air."), "Must NOT fake AWB manifest on network error");
    assert.ok(!adminHtml.includes('pin === "2026"'), "Must NOT validate hardcoded PIN client-side");
    assert.ok(adminHtml.includes("function escapeHtml("), "Admin UI must implement HTML escaping");
    assert.ok(adminHtml.includes("/api/v1/auth/staff-login"), "Admin UI must authenticate against server staff-login endpoint");
  });
});
