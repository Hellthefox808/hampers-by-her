/**
 * HAMPERS BY HER — ATELIER STUDIO OPERATIONS & QC GATE TEST SUITE
 * 
 * Formal Specification Reference: 23_ADMIN_DASHBOARD.md & 18_ORDER_MANAGEMENT.md
 * Verifies strict QC photographic gate enforcement, order lifecycle state machine,
 * printable luxury packing slip generation, and real-time studio KPIs.
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { adminService } = require("../server/services/adminService");
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

describe("Hampers by Her Atelier Studio Operations OS (Section 81 & 23_ADMIN_DASHBOARD.md)", () => {

  let testOrderNumber;

  before(() => {
    // Provision a confirmed order for the test run
    const order = OrderService.createOrder({
      items: [
        { id: "ITEM_CANDLE_AMBER", title: "Amber Candle", pricePaise: 75000, quantity: 1, is_fragile: true },
        { id: "ITEM_CHOCO_DARK_HAZELNUT", title: "Dark Pralines", pricePaise: 45000, quantity: 2, is_fragile: false }
      ],
      box: { name: "Classic Linen Keepsake Box" },
      ribbon: { name: "Burgundy Merlot Raw Silk" },
      waxSeal: { name: "Vintage Gold Laurel" },
      customMonogram: "AK",
      cardMessage: "Wishing you a grand celebration with love.",
      shippingAddress: {
        fullName: "Aarav Kapoor",
        line1: "Golf Links, Villa 12",
        city: "New Delhi",
        pincode: "110003"
      },
      customer: { name: "Aarav Kapoor", phone: "919876543210" },
      pricing: { totalPaise: 165000, subtotalPaise: 165000 }
    });

    // Confirm order
    OrderService.updateOrderStatus(order.orderNumber, "CONFIRMED");
    testOrderNumber = order.orderNumber;
  });

  test("Order Transitions: Transitions CONFIRMED order into IN_PRODUCTION", () => {
    const updated = adminService.transitionOrderStatus({
      orderNumber: testOrderNumber,
      targetStatus: "IN_PRODUCTION",
      actorName: "Artisan Lead Fatima",
      notes: "Hamper assigned to workstation 3 for ribbon and wax sealing."
    });

    assert.equal(updated.status, "IN_PRODUCTION");
    assert.ok(updated.timeline.some(t => t.status === "IN_PRODUCTION"));
  });

  test("Strict QC Gate: Rejects transition to QUALITY_CHECKED without photographic evidence", () => {
    assert.throws(() => {
      adminService.transitionOrderStatus({
        orderNumber: testOrderNumber,
        targetStatus: "QUALITY_CHECKED",
        actorName: "Artisan Lead Fatima"
      });
    }, /QC_PHOTO_GATE_VIOLATION/);
  });

  test("Strict QC Gate: Passes QC inspection when photo evidence, inspector, and checklist provided", () => {
    const qcResult = adminService.verifyStudioQcGate({
      orderNumber: testOrderNumber,
      inspectorName: "Master Inspector Fatima Bi",
      photoEvidenceUrl: "https://cdn.hampersbyher.com/qc/sample_verified_hamper.jpg",
      checklist: {
        ribbonTied: true,
        waxSealIntact: true,
        calligraphyCardIncluded: true,
        componentsVerified: true
      },
      notes: "Double knot silk bow inspected. Wax seal crisp with AK initials."
    });

    assert.equal(qcResult.success, true);
    assert.equal(qcResult.passed, true);
    assert.equal(qcResult.orderStatus, "QUALITY_CHECKED");
    assert.equal(qcResult.qcRecord.inspectorName, "Master Inspector Fatima Bi");
  });

  test("Generates luxury printable packing slip with recipient details, embellishments, and checklist", () => {
    const slipHtml = adminService.generatePrintablePackingSlip(testOrderNumber);

    assert.ok(slipHtml.includes("<!DOCTYPE html>"));
    assert.ok(slipHtml.includes(testOrderNumber));
    assert.ok(slipHtml.includes("Aarav Kapoor"));
    assert.ok(slipHtml.includes("Burgundy Merlot Raw Silk"));
    assert.ok(slipHtml.includes("AK")); // Monogram
    assert.ok(slipHtml.includes("Amber Candle"));
    assert.ok(slipHtml.includes("QC Studio Inspector Sign-Off"));
  });

  test("Studio KPIs: Calculates real-time fulfillment metrics and approval rates", () => {
    const metrics = adminService.getStudioMetrics();

    assert.ok(metrics.activeOrdersCount > 0);
    assert.ok(metrics.revenue.totalPaise > 0);
    assert.ok(metrics.revenue.formattedRupees);
    assert.ok(metrics.pipeline.qualityChecked >= 1);
    assert.ok(metrics.qcApprovalRatePercent >= 0);
  });

  test("REST API: End-to-end studio operations endpoints (/admin/orders, /admin/metrics, /packing-slip)", async () => {
    // 1. Fetch orders feed
    const ordersRes = await fetch(`${baseUrl}/admin/orders`);
    assert.equal(ordersRes.status, 200);
    const ordersData = await ordersRes.json();
    assert.equal(ordersData.success, true);
    assert.ok(ordersData.data.orders.length > 0);

    // 2. Fetch packing slip HTML
    const slipRes = await fetch(`${baseUrl}/admin/orders/${testOrderNumber}/packing-slip`);
    assert.equal(slipRes.status, 200);
    const slipText = await slipRes.text();
    assert.ok(slipText.includes("Atelier Studio Packing Slip"));

    // 3. Fetch studio metrics
    const metricsRes = await fetch(`${baseUrl}/admin/metrics`);
    assert.equal(metricsRes.status, 200);
    const metricsData = await metricsRes.json();
    assert.equal(metricsData.success, true);
    assert.ok(metricsData.data.pipeline);
  });

});
