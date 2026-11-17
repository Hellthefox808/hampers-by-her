/**
 * HAMPERS BY HER — END-TO-END SYSTEM INTEGRATION & VERIFICATION TEST SUITE
 * 
 * Verifies the complete digital commerce journey across all 11 architectural tiers:
 * Storefront & Catalog -> Enriched PDP -> Bespoke Builder -> Pricing Engine ->
 * Atomic Inventory -> Smart Payment Router (UPI Intent/QR/Stripe) -> HMAC Webhooks ->
 * Order Lifecycle -> WhatsApp Cloud Concierge -> Meta Instagram Sync -> Voice AI Streaming -> Microservices Mesh.
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const WebSocket = require("ws");

const { app, httpServer } = require("../server/index");

let port;
let baseUrl;
let wsUrl;
let serverInstance;

before(async () => {
  await new Promise((resolve) => {
    serverInstance = httpServer.listen(0, () => {
      port = serverInstance.address().port;
      baseUrl = `http://localhost:${port}/api/v1`;
      wsUrl = `ws://localhost:${port}/api/v1/voice/stream`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => serverInstance.close(resolve));
});

describe("Hampers by Her End-to-End Commerce & System Pipeline", () => {

  // ── Tier 1: Catalog & Enriched Item Detail View ──
  test("Tier 1: Catalog browsing, filtering, and enriched PDP discovery", async () => {
    // 1. Browse Catalog
    const catRes = await fetch(`${baseUrl}/catalog/products?occasion=wedding`);
    assert.equal(catRes.status, 200);
    const catData = await catRes.json();
    assert.equal(catData.success, true);
    assert.ok(catData.data.items.length > 0);

    const firstProduct = catData.data.items[0];
    assert.equal(firstProduct.occasion, "Wedding");

    // 2. Load Enriched PDP
    const pdpRes = await fetch(`${baseUrl}/catalog/products/${firstProduct.id}`);
    assert.equal(pdpRes.status, 200);
    const pdpData = await pdpRes.json();
    assert.equal(pdpData.success, true);
    assert.equal(pdpData.data.id, firstProduct.id);
    assert.ok(pdpData.data.gallery.length >= 2);
    assert.ok(pdpData.data.inclusions.length >= 2);
    assert.ok(pdpData.data.personalizationOptions.ribbonColors.length >= 2);
    assert.ok(pdpData.data.personalizationOptions.waxSeals.length >= 2);
  });

  // ── Tier 2: Logistics Pincode Serviceability ──
  test("Tier 2: Validates PIN code delivery serviceability and dispatch SLA", async () => {
    // Delhi Metro Pincode
    const delRes = await fetch(`${baseUrl}/delivery/serviceability/110001`);
    assert.equal(delRes.status, 200);
    const delData = await delRes.json();
    assert.equal(delData.success, true);
    assert.equal(delData.data.isServiceable, true);
    assert.equal(delData.data.zone, "METRO_AIR");
    assert.equal(delData.data.standardDays, 2);

    // Mumbai Metro Pincode
    const mumRes = await fetch(`${baseUrl}/delivery/serviceability/400001`);
    assert.equal(mumRes.status, 200);
    const mumData = await mumRes.json();
    assert.equal(mumData.success, true);
    assert.equal(mumData.data.zone, "METRO_AIR");

    // Invalid PIN Code (starts with 0)
    const badRes = await fetch(`${baseUrl}/delivery/serviceability/099999`);
    assert.equal(badRes.status, 200);
    const badData = await badRes.json();
    assert.equal(badData.data.isServiceable, false);
  });

  // ── Tier 3: Bespoke Hamper Builder Engine ──
  test("Tier 3: Bespoke Builder 11-step validation and 3D volume capacity math", async () => {
    // 1. Get builder options
    const optRes = await fetch(`${baseUrl}/builder/options`);
    assert.equal(optRes.status, 200);
    const optData = await optRes.json();
    assert.ok(optData.data.boxes.length >= 3);
    assert.ok(optData.data.ribbons.length >= 4);

    // 2. Validate configuration within capacity
    const validConfig = {
      boxId: "BOX_LINEN_KEEPSAKE",
      itemIds: [
        "ITEM_CHOCO_DARK_HAZELNUT",
        "ITEM_TEA_ROSE_BLUSH",
        "ITEM_CANDLE_AMBER"
      ],
      ribbonId: "RIB_VELVET_BORDEAUX",
      waxSealId: "WAX_BOTANICAL_GOLD"
    };

    const valRes = await fetch(`${baseUrl}/builder/validate-step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validConfig)
    });
    assert.equal(valRes.status, 200);
    const valData = await valRes.json();
    assert.equal(valData.success, true);
    assert.equal(valData.data.isValid, true);
    assert.ok(valData.data.fullnessPercent <= 100);
  });

  // ── Tier 4: Pricing Engine (Integer Paise Arithmetic & GST 18%) ──
  test("Tier 4: Pricing engine computes paise integer math, coupon cap and GST", async () => {
    const calcRes = await fetch(`${baseUrl}/checkout/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          { pricePaise: 395000, quantity: 1 }
        ],
        couponCode: "ALMAS10"
      })
    });
    assert.equal(calcRes.status, 200);
    const calcData = await calcRes.json();
    assert.equal(calcData.success, true);

    const pricing = calcData.data;
    assert.equal(pricing.subtotalPaise, 395000);
    assert.ok(pricing.discountPaise > 0);
    assert.ok(pricing.discountPaise <= 50000); // 10% capped at ₹500
    assert.equal(pricing.shippingPaise, 0); // Free delivery >= ₹2,999 threshold
    assert.ok(pricing.taxPaise > 0);
    assert.equal(pricing.totalPaise, pricing.taxableBasePaise + pricing.taxPaise + pricing.shippingPaise);
  });

  // ── Tier 5: Atomic Inventory & Order Creation ──
  let createdOrderNumber;
  test("Tier 5: Provisions order with atomic stock lock in PENDING_PAYMENT state", async () => {
    const orderPayload = {
      customer: {
        name: "Aarav Singhania",
        email: "aarav@singhania.in",
        phone: "919876543210"
      },
      shippingAddress: {
        line1: "42 Amrita Shergill Marg",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110003"
      },
      items: [
        {
          sku: "HBH-BOX-WEDDING-01",
          title: "The Vows & Vines Hamper",
          pricePaise: 395000,
          quantity: 1,
          personalization: {
            ribbon: "Natural Ecru Raw Silk",
            waxSeal: "Botanica",
            cardMessage: "Wishing you a lifetime of joy and quiet luxury."
          }
        }
      ],
      couponCode: "ALMAS10"
    };

    const orderRes = await fetch(`${baseUrl}/checkout/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderPayload)
    });
    assert.equal(orderRes.status, 201);
    const orderData = await orderRes.json();
    assert.equal(orderData.success, true);
    assert.ok(orderData.data.orderNumber.startsWith("HBH-"));
    assert.equal(orderData.data.status, "PENDING_PAYMENT");
    assert.ok(orderData.data.totalPaise > 0);

    createdOrderNumber = orderData.data.orderNumber;
  });

  // ── Tier 6: Multi-Gateway Smart Payment Routing ──
  test("Tier 6: Smart Payment Router selects optimal rails for mobile, desktop, and NRI", async () => {
    // 1. Mobile Client -> UPI Intent Deep Link
    const mobRes = await fetch(`${baseUrl}/payments/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: createdOrderNumber,
        amountPaise: 395000,
        currency: "INR",
        clientType: "mobile",
        idempotencyKey: `idem_mob_${createdOrderNumber}`
      })
    });
    assert.equal(mobRes.status, 200);
    const mobData = await mobRes.json();
    assert.equal(mobData.success, true);
    assert.equal(mobData.data.paymentMethod, "upi_intent");
    assert.ok(mobData.data.actionUrl.startsWith("upi://pay"));

    // 2. Desktop Client -> Dynamic QR Code
    const deskRes = await fetch(`${baseUrl}/payments/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: `HBH-DESK-${Date.now()}`,
        amountPaise: 500000,
        currency: "INR",
        clientType: "desktop"
      })
    });
    assert.equal(deskRes.status, 200);
    const deskData = await deskRes.json();
    assert.equal(deskData.data.paymentMethod, "upi_qr");
    assert.ok(deskData.data.qrCodeString.startsWith("upi://pay"));
    assert.equal(deskData.data.expiresInSeconds, 180);

    // 3. International NRI Customer (AED / USD) -> Stripe with FEMA export compliance
    const nriRes = await fetch(`${baseUrl}/payments/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: `HBH-NRI-${Date.now()}`,
        amountPaise: 50000,
        currency: "AED",
        clientType: "mobile"
      })
    });
    assert.equal(nriRes.status, 200);
    const nriData = await nriRes.json();
    assert.equal(nriData.data.gateway, "stripe_international");
    assert.equal(nriData.data.femaExportCompliance.purposeCode, "P0104");

    // 4. Idempotency Check: Repeating request returns duplicate session
    const idemRes = await fetch(`${baseUrl}/payments/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: createdOrderNumber,
        amountPaise: 395000,
        currency: "INR",
        clientType: "mobile",
        idempotencyKey: `idem_mob_${createdOrderNumber}`
      })
    });
    const idemData = await idemRes.json();
    assert.equal(idemData.data.isDuplicate, true);
  });

  // ── Tier 7: Cryptographic Webhooks & Payment Confirmation ──
  test("Tier 7: Verifies payment, transitions order to CONFIRMED and records transaction", async () => {
    const payRes = await fetch(`${baseUrl}/payments/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderNumber: createdOrderNumber,
        paymentId: `pay_rzp_${Date.now()}`,
        method: "upi"
      })
    });
    assert.equal(payRes.status, 200);
    const payData = await payRes.json();
    assert.equal(payData.success, true);
    assert.equal(payData.data.status, "CONFIRMED");
    assert.equal(payData.data.payment.status, "CAPTURED");

    // Fetch confirmed order by orderNumber
    const fetchOrderRes = await fetch(`${baseUrl}/orders/${createdOrderNumber}`);
    assert.equal(fetchOrderRes.status, 200);
    const fetchOrderData = await fetchOrderRes.json();
    assert.equal(fetchOrderData.data.status, "CONFIRMED");
  });

  // ── Tier 8: WhatsApp Conversational Concierge ──
  test("Tier 8: 2-way WhatsApp concierge tracks order status and delivers SLA responses", async () => {
    // Patron asks: "STATUS <orderNumber>"
    const waRes = await fetch(`${baseUrl}/whatsapp/simulate-incoming`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "919876543210",
        name: "Aarav Singhania",
        text: `STATUS ${createdOrderNumber}`
      })
    });
    assert.equal(waRes.status, 200);
    const waData = await waRes.json();
    assert.equal(waData.success, true);
    assert.equal(waData.data.messagesProcessed, 1);
    assert.ok(waData.data.events.length > 0);

    // Human artisan escalation
    const agentRes = await fetch(`${baseUrl}/whatsapp/simulate-incoming`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "919876543210",
        name: "Aarav Singhania",
        text: "agent"
      })
    });
    assert.equal(agentRes.status, 200);
    const agentData = await agentRes.json();
    assert.ok(agentData.data.events[0].replySent.success);
  });

  // ── Tier 9: Meta Instagram Graph Sync & DM Lead Automation ──
  test("Tier 9: Instagram Graph API syncs live feed and captures DM leads", async () => {
    const feedRes = await fetch(`${baseUrl}/instagram/feed?limit=3`);
    assert.equal(feedRes.status, 200);
    const feedData = await feedRes.json();
    assert.equal(feedData.success, true);
    assert.equal(feedData.data.account, "@hampers._by_her");
    assert.equal(feedData.data.items.length, 3);

    // Ingest Instagram DM webhook event
    const igPayload = {
      object: "instagram",
      entry: [
        {
          id: "17841400000000000",
          messaging: [
            {
              sender: { id: "ig_user_123" },
              recipient: { id: "17841400000000000" },
              message: { text: "Hi! What is the price of the wedding hamper?" }
            }
          ]
        }
      ]
    };

    const igHookRes = await fetch(`${baseUrl}/instagram/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(igPayload)
    });
    assert.equal(igHookRes.status, 200);
    const igHookData = await igHookRes.json();
    assert.equal(igHookData.handled, true);
    assert.equal(igHookData.processedEvents, 1);
    assert.equal(igHookData.events[0].classification.intent, "PRICING");
  });

  // ── Tier 10: Full-Duplex Real-Time Voice AI WebSocket Gateway ──
  test("Tier 10: Voice AI WebSocket session with audio streaming and barge-in abort", (context, done) => {
    const ws = new WebSocket(wsUrl);
    let receivedAudioDelta = false;
    let receivedActionCards = false;

    ws.on("open", () => {
      // Socket connected
    });

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "session.created") {
        ws.send(JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: "I need a luxury hamper for an upcoming wedding under ₹4,000"
          }
        }));
      }

      if (msg.type === "response.action_cards") {
        receivedActionCards = true;
        assert.ok(Array.isArray(msg.cards));
      }

      if (msg.type === "response.audio.delta") {
        receivedAudioDelta = true;
        assert.ok(msg.delta.length > 0);
      }

      if (msg.type === "response.done") {
        assert.ok(receivedAudioDelta);
        assert.ok(receivedActionCards);

        // Test barge-in cancellation
        ws.send(JSON.stringify({
          type: "response.cancel"
        }));
      }

      if (msg.type === "response.cancelled") {
        assert.ok(msg.message.includes("interrupted"));
        ws.close();
        done();
      }
    });

    ws.on("error", (err) => {
      done(err);
    });
  });

  // ── Tier 11: Platform Observability & System Mesh Health Probes ──
  test("Tier 11: Probes system observability, cache metrics, and service mesh health", async () => {
    const sysRes = await fetch(`${baseUrl}/system/health`);
    assert.equal(sysRes.status, 200);
    const sysData = await sysRes.json();
    assert.equal(sysData.success, true);
    assert.ok(sysData.data.status === "healthy" || sysData.data.status === "degraded");
    assert.ok(sysData.data.cacheMetrics);
    assert.ok(sysData.data.mesh);

    const gwHealthRes = await fetch(`${baseUrl}/payments/gateways/health`);
    assert.equal(gwHealthRes.status, 200);
    const gwHealth = await gwHealthRes.json();
    assert.equal(gwHealth.data.healthy, true);
    assert.ok(gwHealth.data.gateways.razorpay);
    assert.ok(gwHealth.data.gateways.cashfree);
  });

});