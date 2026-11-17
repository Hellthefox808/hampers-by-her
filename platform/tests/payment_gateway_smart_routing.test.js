/**
 * Hampers by Her Atelier AI Platform — Smart Payment Router & Security Test Suite
 * Tests mobile UPI Intent, desktop Dynamic QR, NRI Multi-Currency Presentment (MCP),
 * multi-gateway failover, idempotency locks, replay-proof webhooks, and instant UPI refunds.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const { SmartPaymentRouter } = require("../services/payment-service/smartRouter");

describe("Hampers by Her Smart Payment Gateway Subsystem", () => {
  describe("UPI Routing: Mobile Intent vs Desktop Dynamic QR", () => {
    test("Generates compliant UPI Intent deep link for mobile devices", () => {
      const router = new SmartPaymentRouter();
      const session = router.routeCheckout({
        orderId: "HBH-2026-901",
        amountPaise: 499900,
        currency: "INR",
        clientType: "mobile"
      });

      assert.strictEqual(session.currency, "INR");
      assert.strictEqual(session.paymentMethod, "upi_intent");
      assert.ok(session.upiPayload);
      assert.strictEqual(session.upiPayload.type, "UPI_INTENT");
      assert.ok(session.upiPayload.deepLink.includes("upi://pay?pa=hampersbyher@icici"));
      assert.ok(session.upiPayload.deepLink.includes("am=4999.00"));
      assert.ok(session.upiPayload.targetApps.includes("gpay"));
      assert.ok(session.upiPayload.targetApps.includes("phonepe"));
    });

    test("Generates Dynamic QR code string with auto-refresh for desktop viewports", () => {
      const router = new SmartPaymentRouter();
      const session = router.routeCheckout({
        orderId: "HBH-2026-902",
        amountPaise: 799900,
        currency: "INR",
        clientType: "desktop"
      });

      assert.strictEqual(session.paymentMethod, "upi_qr");
      assert.strictEqual(session.upiPayload.type, "DYNAMIC_QR");
      assert.ok(session.upiPayload.qrString.includes("am=7999.00"));
      assert.strictEqual(session.upiPayload.refreshIntervalSec, 180);
    });
  });

  describe("Idempotency Protection", () => {
    test("Returns existing payment session on duplicate submission with identical idempotencyKey", () => {
      const router = new SmartPaymentRouter();
      const idempotencyKey = "idemp_order_9988_attempt_1";

      const session1 = router.routeCheckout({
        orderId: "HBH-2026-903",
        amountPaise: 350000,
        idempotencyKey
      });

      // User double clicks or network retries with exact same key
      const session2 = router.routeCheckout({
        orderId: "HBH-2026-903",
        amountPaise: 350000,
        idempotencyKey
      });

      assert.strictEqual(session1.sessionId, session2.sessionId);
      assert.strictEqual(session2.isDuplicate, true);
      assert.ok(session2.message.includes("Idempotent request"));
    });
  });

  describe("Smart Failover & Health Routing", () => {
    test("Routes to primary gateway (Razorpay) when success rate is healthy", () => {
      const router = new SmartPaymentRouter();
      const session = router.routeCheckout({
        orderId: "HBH-2026-904",
        amountPaise: 299900
      });

      assert.strictEqual(session.gateway, "razorpay");
      assert.ok(session.smartRoutingReason.includes("Optimal primary acquirer"));
    });

    test("Automatically shifts traffic to secondary gateway (Cashfree) when primary success rate drops", () => {
      const router = new SmartPaymentRouter();
      // Simulate bank outage on Razorpay (success rate drops to 82% < 88% threshold)
      router.simulateGatewayHealth("razorpay", 0.82);

      const session = router.routeCheckout({
        orderId: "HBH-2026-905",
        amountPaise: 299900
      });

      assert.strictEqual(session.gateway, "cashfree");
      assert.ok(session.smartRoutingReason.includes("Failover: Primary acquirer success rate degraded"));
    });
  });

  describe("International NRI Multi-Currency Presentment (MCP)", () => {
    test("Routes foreign currencies (USD/AED) to international rail with FEMA export metadata", () => {
      const router = new SmartPaymentRouter();

      const usdSession = router.routeCheckout({
        orderId: "HBH-INTL-101",
        amountPaise: 15000, // $150.00 USD
        currency: "USD"
      });

      assert.strictEqual(usdSession.gateway, "stripe_international");
      assert.strictEqual(usdSession.currency, "USD");
      assert.strictEqual(usdSession.settlementCurrency, "INR");
      assert.ok(usdSession.estimatedSettlementInrPaise > 0);
      assert.strictEqual(usdSession.femaExportCompliance.purposeCode, "P0104");
      assert.strictEqual(usdSession.femaExportCompliance.autoFirsGenerated, true);
    });
  });

  describe("Cryptographic Webhook Security & Replay Defense", () => {
    test("Verifies valid HMAC-SHA256 signature in constant time", () => {
      const router = new SmartPaymentRouter();
      const secret = "hbh_rzp_wh_secret_2026";
      const payload = JSON.stringify({ event: "payment.captured", id: "pay_123" });
      const now = Math.floor(Date.now() / 1000);

      const signature = crypto
        .createHmac("sha256", secret)
        .update(`${now}.${payload}`)
        .digest("hex");

      const check = router.verifyWebhook({
        gateway: "razorpay",
        rawBody: payload,
        signature,
        timestamp: now
      });

      assert.strictEqual(check.valid, true);
      assert.strictEqual(check.reason, "Signature verified");
    });

    test("Rejects forged signature with cryptographic mismatch", () => {
      const router = new SmartPaymentRouter();
      const payload = JSON.stringify({ event: "payment.captured", id: "pay_fake" });
      const fakeSignature = crypto.randomBytes(32).toString("hex");

      const check = router.verifyWebhook({
        gateway: "razorpay",
        rawBody: payload,
        signature: fakeSignature,
        timestamp: Math.floor(Date.now() / 1000)
      });

      assert.strictEqual(check.valid, false);
      assert.strictEqual(check.reason, "Cryptographic signature mismatch");
    });

    test("Rejects webhook with timestamp skew exceeding 300 seconds to prevent replay attacks", () => {
      const router = new SmartPaymentRouter();
      const secret = "hbh_rzp_wh_secret_2026";
      const payload = JSON.stringify({ event: "payment.captured" });
      const staleTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago (> 300s)

      const signature = crypto
        .createHmac("sha256", secret)
        .update(`${staleTimestamp}.${payload}`)
        .digest("hex");

      const check = router.verifyWebhook({
        gateway: "razorpay",
        rawBody: payload,
        signature,
        timestamp: staleTimestamp
      });

      assert.strictEqual(check.valid, false);
      assert.ok(check.reason.includes("Timestamp skew exceeded 300 seconds"));
    });
  });

  describe("Instant UPI Refund Dispatcher", () => {
    test("Dispatches sub-2-second instant UPI refund", async () => {
      const router = new SmartPaymentRouter();
      const refund = await router.processInstantRefund({
        orderId: "HBH-2026-999",
        amountPaise: 499900,
        vpa: "client@okaxis"
      });

      assert.strictEqual(refund.success, true);
      assert.strictEqual(refund.rail, "UPI_IMPS_INSTANT");
      assert.strictEqual(refund.status, "COMPLETED");
      assert.ok(refund.settlementTimeSeconds <= 2.0);
      assert.ok(refund.refundId.startsWith("rfnd_"));
    });
  });
});
