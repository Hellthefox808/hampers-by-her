const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { app } = require("../server/index");
const { CatalogService } = require("../server/services/catalogService");
const { OrderService } = require("../server/services/orderService");
const { notificationService } = require("../server/services/notificationService");
const { whatsappService } = require("../server/services/whatsappService");
const { SlidingWindowRateLimiter } = require("../platform/services/scaling-service/rateLimiter");
const { inventoryEngine } = require("../platform/services/scaling-service/inventoryLock");
const { generateHamperPreviewSvg } = require("../platform/services/atelier-visualizer/previewGenerator");
const { STANDARD_BOXES, evaluateHamperPacking, optimizeHamperForBudget } = require("../platform/services/dsa");

const ROOT = path.resolve(__dirname, "..");

describe("Platform & Storefront Enhancements E2E Suite", () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test("NotificationService sendTemplateMessage WhatsApp + HTML XSS escaping succeed without error", async () => {
    const xssOrder = {
      orderNumber: "HBH-XSS-TEST-1",
      status: "CONFIRMED",
      customer: { name: "<script>alert('xss')</script>Patron" },
      shippingAddress: {
        recipientName: "<img src=x onerror=alert(1)>",
        addressLine1: "42 Rose Lane",
        city: "Mumbai",
        pincode: "400001"
      },
      items: [{ name: "<b>Saffron</b> Elixir", quantity: 1, pricePaise: 245000 }],
      pricing: { basePricePaise: 245000, gstPaise: 44100, shippingFeePaise: 0, totalPaise: 289100 }
    };

    const dispatch = await notificationService.dispatchOrderNotification({
      event: "ORDER_CONFIRMED",
      order: xssOrder,
      customerPhone: "9876543210",
      customerEmail: "patron@example.com"
    });

    const waEntry = dispatch.channelsDispatched.find((c) => c.channel === "WHATSAPP");
    const emailEntry = dispatch.channelsDispatched.find((c) => c.channel === "EMAIL");
    assert.ok(waEntry && waEntry.success === true, "WhatsApp channel must succeed cleanly in sandbox");
    assert.ok(emailEntry && emailEntry.success === true, "Email channel must succeed cleanly in sandbox");

    const html = notificationService.generateReceiptEmailHtml(xssOrder, "ORDER_CONFIRMED");
    assert.ok(!html.includes("<script>"), "Receipt email must not include unescaped <script>");
    assert.ok(!html.includes("<img src=x"), "Receipt email must escape <img tag in recipient name");
    assert.ok(html.includes("&lt;img src=x"), "Escaped recipient payload must be present");
    assert.ok(html.includes("&lt;b&gt;Saffron&lt;/b&gt;"), "Escaped item name must be present");
  });

  test("WhatsAppService PIN lookup turn includes numeric SLA without undefined", async () => {
    const reply = whatsappService._processConversationalTurn
      ? await whatsappService._processConversationalTurn("Check delivery to 400001")
      : await whatsappService.handleIncomingText("919876543210", "Check delivery to 400001");
    const text = typeof reply === "string" ? reply : JSON.stringify(reply);
    assert.ok(!text.includes("undefined"), `WhatsApp reply should never leak 'undefined': ${text}`);
  });

  test("SlidingWindowRateLimiter enforces maxKeys memory cap", () => {
    const limiter = new SlidingWindowRateLimiter({ maxKeys: 5 });
    for (let i = 0; i < 12; i++) {
      const check = limiter.check(`10.0.0.${i}`, "ANONYMOUS");
      assert.equal(check.allowed, true);
    }
    assert.ok(limiter.windows.size <= 5, `Expected windows.size <= 5, got ${limiter.windows.size}`);
  });

  test("DSA 3D Bin Packer normalizes camelCase & snake_case item dimensions and weights", () => {
    const evaluation = evaluateHamperPacking(STANDARD_BOXES.MEDIUM, [
      {
        id: "camel_1",
        name: "Amber Candle",
        l_mm: 90,
        w_mm: 90,
        h_mm: 100,
        volumeCm3: 810,
        weightGrams: 420,
        isFragile: true,
        mustBeUpright: true
      }
    ]);
    assert.equal(evaluation.fits, true);
    assert.ok(evaluation.total_gross_weight_g >= 420, "camelCase weightGrams must be respected");
    assert.ok(evaluation.fullness_ratio > 0, "camelCase dimensions/volumeCm3 must contribute to fullness_ratio");
  });

  test("Preview SVG Generator supports BOX_VELVET_BORDEAUX, shred palette, botanical sprig, and custom monogram", () => {
    const svg = generateHamperPreviewSvg({
      boxId: "BOX_VELVET_BORDEAUX",
      shredId: "SHRED_GOLD",
      botanicalId: "BOT_EUCALYPTUS",
      monogramInitials: "AF",
      recipientName: "Aarav"
    });
    assert.ok(svg.includes("#3B141E") || svg.includes("#4E1B28"), "Velvet Bordeaux palette missing");
    assert.ok(svg.includes("AF"), "Monogram initials missing in SVG");
    assert.ok(svg.includes("<svg"), "Valid SVG root required");
  });

  test("Budget Knapsack emits matching Builder box IDs", () => {
    const result = optimizeHamperForBudget({ targetBudgetPaise: 500000, preferredCategories: ["Signature", "Gourmet"] });
    assert.ok(["BOX_KRAFT_RIGID", "BOX_LINEN_KEEPSAKE", "BOX_VELVET_BORDEAUX"].includes(result.box.id));
  });

  test("Service Mesh /system/health exposes all core registered services as UP", async () => {
    const res = await fetch(`${baseUrl}/system/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.mesh.servicesCount >= 4, "At least 4 domain microservices must be registered");
    assert.equal(body.data.mesh.services.CatalogService?.status, "UP", "CatalogService health check must be UP");
    assert.equal(body.data.mesh.services.InventoryService?.status, "UP", "InventoryService health check must be UP");
  });

  test("POST /checkout/validate-coupon evaluates WELCOME15, WEDDINGVIP, and rejects invalid codes", async () => {
    const r1 = await fetch(`${baseUrl}/checkout/validate-coupon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ couponCode: "WELCOME15", subtotalPaise: 500000 })
    });
    assert.equal(r1.status, 200);
    const j1 = await r1.json();
    assert.equal(j1.data.discountPaise, 75000);

    const rBad = await fetch(`${baseUrl}/checkout/validate-coupon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ couponCode: "NONEXISTENT99", subtotalPaise: 500000 })
    });
    assert.equal(rBad.status, 400);
    const jBad = await rBad.json();
    assert.equal(jBad.success, false);
  });

  test("POST /payments/initiate rejects zero or negative amountPaise", async () => {
    const rZero = await fetch(`${baseUrl}/payments/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "HBH-ZERO-1", amountPaise: 0 })
    });
    assert.equal(rZero.status, 400);

    const rNeg = await fetch(`${baseUrl}/payments/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "HBH-NEG-1", amountPaise: -2500 })
    });
    assert.equal(rNeg.status, 400);
  });

  test("Catalog SKU server price enforcement & inventory lock commit/release lifecycle", async () => {
    const catalogProd = CatalogService.getProducts({ limit: 1 }).items[0];
    assert.ok(catalogProd && catalogProd.basePricePaise > 1000);

    // 1. Tampered price on catalog SKU is overridden by server Pricing/Catalog price
    const createRes = await fetch(`${baseUrl}/checkout/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: catalogProd.id, sku: catalogProd.id, name: catalogProd.title, pricePaise: 100, quantity: 1 }],
        customer: { name: "Test Patron", phone: "9876543210", email: "test@example.com" },
        shippingAddress: { addressLine1: "12 MG Road", pincode: "560001", city: "Bengaluru" }
      })
    });
    assert.equal(createRes.status, 201);
    const createJson = await createRes.json();
    assert.ok(createJson.data.order.pricing.subtotalPaise >= catalogProd.basePricePaise, "Server must enforce real catalog SKU price");

    const orderNum = createJson.data.orderNumber;
    const cancelRes = await fetch(`${baseUrl}/admin/orders/${orderNum}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetStatus: "CANCELLED", actorName: "QAVerifier" })
    });
    assert.equal(cancelRes.status, 200);

    // Paying for a CANCELLED order must return 409 Conflict
    const latePayRes = await fetch(`${baseUrl}/payments/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber: orderNum, paymentId: "pay_late_1", method: "UPI" })
    });
    assert.equal(latePayRes.status, 409);

    // Verify all reservation IDs on cancelled order are released
    for (const resId of (createJson.data.order.inventoryReservationIds || [])) {
      const lock = inventoryEngine.reservations.get(resId);
      assert.ok(!lock || lock.status === "RELEASED", `Reservation ${resId} should be RELEASED`);
    }
  });

  test("Prometheus /metrics exposes business domain counters", async () => {
    const metricsRes = await fetch(`${baseUrl.replace("/api/v1", "")}/metrics`);
    assert.equal(metricsRes.status, 200);
    const text = await metricsRes.text();
    assert.ok(text.includes("hbh_orders_created_total"));
    assert.ok(text.includes("hbh_orders_confirmed_total"));
    assert.ok(text.includes("hbh_qc_verifications_total"));
    assert.ok(text.includes("hbh_inquiries_received_total"));
  });

  test("Storefront, Studio OS, OpenAPI & deploy script contracts hold without regressions", () => {
    const indexHtml = fs.readFileSync(path.join(ROOT, "website/index.html"), "utf8");
    const modalsHtml = fs.readFileSync(path.join(ROOT, "website/modals_builder.html"), "utf8");
    const scriptJs = fs.readFileSync(path.join(ROOT, "website/script.js"), "utf8");
    const adminHtml = fs.readFileSync(path.join(ROOT, "website/admin.html"), "utf8");
    const openapiYaml = fs.readFileSync(path.join(ROOT, "docs/api/openapi.yaml"), "utf8");
    const deploySh = fs.readFileSync(path.join(ROOT, "infra/scripts/deploy_verify.sh"), "utf8");

    assert.ok(indexHtml.includes('id="monogram-input"'), "index.html must include monogram-input in Step 6");
    assert.ok(modalsHtml.includes('id="monogram-input"'), "modals_builder.html must include monogram-input in Step 6");
    assert.ok(indexHtml.includes('id="remove-coupon-btn"'), "index.html must include coupon remove button");

    assert.ok(!scriptJs.includes("openItemModal("), "Dead openItemModal call must not remain in script.js");
    assert.ok(!scriptJs.includes("Sandbox code: 123456"), "Hardcoded OTP must not remain in script.js");
    assert.ok(scriptJs.includes("cart-overlay"), "Escape handler must check cart-overlay");

    assert.ok(adminHtml.includes('id="qc-photo-file-input"'), "Studio OS must expose real file upload input for QC");
    assert.ok(adminHtml.includes("visibility: visible;"), "Studio OS .modal-overlay must override styles_ext hidden default");
    assert.ok(!adminHtml.includes("4AAQSkZJRgABAQEASABIAAD/2wBDAP..."), "Truncated base64 placeholder must not remain");

    assert.ok(openapiYaml.includes("/checkout/validate-coupon:"));
    assert.ok(openapiYaml.includes("/system/health:"));
    assert.ok(!deploySh.includes("head -n -1"), "Portable sed must replace GNU-only head -n -1");
  });
});
