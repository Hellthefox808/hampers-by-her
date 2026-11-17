/**
 * HAMPERS BY HER — LOGISTICS COURIER ADAPTER & TRACKING TEST SUITE
 * 
 * Formal Specification Reference: 20_DELIVERY_LOGISTICS.md
 * Verifies carrier integration, AWB generation, tracking webhooks, and NDR recovery.
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { logisticsCourierService } = require("../server/services/logisticsCourierService");
const { OrderService } = require("../server/services/orderService");
const { httpServer } = require("../server/index");

let port;
let baseUrl;
let serverInstance;

before(async () => {
  await new Promise((resolve) => {
    serverInstance = httpServer.listen(0, () => {
      port = serverInstance.address().port;
      baseUrl = `http://localhost:${port}/api/v1`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => serverInstance.close(resolve));
});

describe("Hampers by Her Logistics Courier & AWB Tracking Suite", () => {

  let testOrderNumber;

  before(() => {
    const order = OrderService.createOrder({
      items: [{ title: "Imperial Wedding Hamper", pricePaise: 850000, quantity: 1 }],
      shippingAddress: {
        fullName: "Rohan Mehra",
        line1: "Marine Drive, Sea Face",
        city: "Mumbai",
        pincode: "400020" // Metro Air zone
      },
      customer: { name: "Rohan Mehra", phone: "919811223344" },
      pricing: { totalPaise: 850000 }
    });

    OrderService.updateOrderStatus(order.orderNumber, "PACKED");
    testOrderNumber = order.orderNumber;
  });

  test("LogisticsCourierService - Generates shipping manifest and assigns compliant AWB number", () => {
    const manifest = logisticsCourierService.generateShippingManifest({
      orderNumber: testOrderNumber,
      grossWeightG: 3200,
      pickupSlot: "AFTERNOON"
    });

    assert.equal(manifest.orderNumber, testOrderNumber);
    assert.ok(manifest.awb.startsWith("HBH-AWB-2026-"));
    assert.equal(manifest.zone, "METRO_AIR");
    assert.equal(manifest.carrier, "BlueDart Priority Air");
    assert.ok(manifest.labelUrl.includes(manifest.awb));
    assert.equal(manifest.status, "MANIFEST_GENERATED");

    // Order should automatically transition to DISPATCHED
    const updatedOrder = OrderService.getOrderByNumber(testOrderNumber);
    assert.equal(updatedOrder.status, "DISPATCHED");
    assert.equal(updatedOrder.tracking.awb, manifest.awb);
  });

  test("LogisticsCourierService - Ingests carrier webhook updates and advances tracking checkpoints", () => {
    const tracking = logisticsCourierService.getTrackingDetails(testOrderNumber);
    const awb = tracking.awb;

    // Carrier reports OUT_FOR_DELIVERY
    const result = logisticsCourierService.processTrackingWebhook({
      awb,
      status: "OUT_FOR_DELIVERY",
      location: "Mumbai South Delivery Hub"
    });

    assert.equal(result.handled, true);
    assert.equal(result.currentStatus, "OUT_FOR_DELIVERY");

    const updatedOrder = OrderService.getOrderByNumber(testOrderNumber);
    assert.equal(updatedOrder.status, "OUT_FOR_DELIVERY");
  });

  test("LogisticsCourierService - Automates NDR (Non-Delivery Report) recovery workflow with WhatsApp HSM", () => {
    const tracking = logisticsCourierService.getTrackingDetails(testOrderNumber);
    const awb = tracking.awb;

    // Carrier reports non-delivery
    const result = logisticsCourierService.processTrackingWebhook({
      awb,
      status: "NDR",
      location: "Mumbai Delivery Center",
      ndrReason: "Patron premise locked / Unreachable"
    });

    assert.equal(result.handled, true);
    assert.ok(result.ndrAction);
    assert.equal(result.ndrAction.recoveryDispatched, true);
    assert.equal(result.ndrAction.ndrRecord.templateDispatched, "hbh_ndr_address_update_v1");
  });

  test("REST API: End-to-end logistics manifest, webhook, and tracking endpoints", async () => {
    // 1. Create fresh order for API test
    const order = OrderService.createOrder({
      shippingAddress: { pincode: "110001", fullName: "Kavita Seth" },
      items: [{ title: "Petite Luxe", pricePaise: 250000, quantity: 1 }]
    });

    // 2. Generate manifest via POST /delivery/manifest
    const manRes = await fetch(`${baseUrl}/delivery/manifest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber: order.orderNumber })
    });
    assert.equal(manRes.status, 200);
    const manData = await manRes.json();
    assert.equal(manData.success, true);
    const awb = manData.data.awb;

    // 3. Track parcel via GET /delivery/track/:awb
    const trackRes = await fetch(`${baseUrl}/delivery/track/${awb}`);
    assert.equal(trackRes.status, 200);
    const trackData = await trackRes.json();
    assert.equal(trackData.success, true);
    assert.equal(trackData.data.awb, awb);

    // 4. Simulate carrier delivering parcel via POST /delivery/carrier-webhook
    const hookRes = await fetch(`${baseUrl}/delivery/carrier-webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        awb,
        status: "DELIVERED",
        location: "Delhi Central Hub"
      })
    });
    assert.equal(hookRes.status, 200);
    const hookData = await hookRes.json();
    assert.equal(hookData.success, true);
    assert.equal(hookData.data.handled, true);
    assert.equal(hookData.data.currentStatus, "DELIVERED");
  });

});
