/**
 * HAMPERS BY HER — SECURITY, RESILIENCE & NEGATIVE EDGE-CASE SUITE
 * 
 * Formal Specification References:
 * - 25_AUTH_SECURITY.md (Rate limiting, OTP attempt lockout, token tampering)
 * - 18_ORDER_MANAGEMENT.md & 23_ADMIN_DASHBOARD.md (QC Photo Gate & state machine)
 * - 20_DELIVERY_LOGISTICS.md (Pincode serviceability bounds & courier manifest)
 * - Section 81 (Absolute Definition of Done: zero unvalidated inputs, crash resiliency)
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { OrderService, ORDER_STATUS } = require("../server/services/orderService");
const { authService } = require("../server/services/authService");
const { adminService } = require("../server/services/adminService");
const { logisticsCourierService } = require("../server/services/logisticsCourierService");
const { persistenceEngine } = require("../server/services/persistenceEngine");
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

describe("Hampers by Her Security, Resilience & Negative Validation Suite", () => {

  // ═══════════════════════════════════════════════════════════
  // 1. ORDER CREATION INPUT SANITIZATION & BOUNDARY TESTING
  // ═══════════════════════════════════════════════════════════

  test("Security: Rejects order creation with empty items array", () => {
    assert.throws(() => {
      OrderService.createOrder({
        items: [],
        shippingAddress: { pincode: "110001" }
      });
    }, /Cannot create order with an empty cart/);
  });

  test("Security: Rejects order creation with missing shipping address or pincode", () => {
    assert.throws(() => {
      OrderService.createOrder({
        items: [{ pricePaise: 100000, quantity: 1 }],
        shippingAddress: null
      });
    }, /Shipping address with PIN code is required/);
  });

  test("Security: Rejects order creation with invalid/malformed postal PIN codes", () => {
    const invalidPins = ["12345", "011001", "ABCD12", "1100000", "999-999"];
    for (const pin of invalidPins) {
      assert.throws(() => {
        OrderService.createOrder({
          items: [{ pricePaise: 250000, quantity: 1 }],
          shippingAddress: { pincode: pin, city: "Test City" }
        });
      }, /INVALID_PINCODE/);
    }
  });

  test("Security: Rejects order creation with negative item price manipulation", () => {
    assert.throws(() => {
      OrderService.createOrder({
        items: [{ pricePaise: -50000, quantity: 1 }],
        shippingAddress: { pincode: "110001" }
      });
    }, /INVALID_ITEM_PRICE/);
  });

  test("Security: Rejects order creation with zero or negative item quantity", () => {
    assert.throws(() => {
      OrderService.createOrder({
        items: [{ pricePaise: 350000, quantity: 0 }],
        shippingAddress: { pincode: "110001" }
      });
    }, /INVALID_ITEM_QUANTITY/);
  });

  // ═══════════════════════════════════════════════════════════
  // 2. AUTHENTICATION SECURITY & BRUTE-FORCE DEFENSE
  // ═══════════════════════════════════════════════════════════

  test("Auth: Rejects OTP request for invalid phone format (< 10 digits)", () => {
    assert.throws(() => {
      authService.requestOtp({ phone: "9876" });
    }, /INVALID_PHONE_NUMBER/);
  });

  test("Auth: Rejects wrong OTP and locks out patron after 3 failed attempts", () => {
    const testPhone = "919811223399";
    const otpRes = authService.requestOtp({ phone: testPhone });
    assert.ok(otpRes.sandboxCode);

    // Attempt 1: wrong code
    assert.throws(() => {
      authService.verifyOtp({ phone: testPhone, otp: "000000" });
    }, /INVALID_OTP/);

    // Attempt 2: wrong code
    assert.throws(() => {
      authService.verifyOtp({ phone: testPhone, otp: "111111" });
    }, /INVALID_OTP/);

    // Attempt 3: wrong code
    assert.throws(() => {
      authService.verifyOtp({ phone: testPhone, otp: "222222" });
    }, /INVALID_OTP/);

    // Attempt 4: Should be locked out (MAX_ATTEMPTS_EXCEEDED)
    assert.throws(() => {
      authService.verifyOtp({ phone: testPhone, otp: otpRes.sandboxCode });
    }, /MAX_ATTEMPTS_EXCEEDED|OTP_EXPIRED_OR_NOT_FOUND/);
  });

  test("Auth: Rejects tampered JWT token signature", () => {
    const payload = { userId: "cust_test_123", role: "CUSTOMER" };
    const validToken = authService.createJwtToken(payload, 3600);
    const parts = validToken.split(".");
    
    // Tamper with payload
    const tamperedPayload = Buffer.from(JSON.stringify({ userId: "cust_test_123", role: "SUPER_ADMIN" })).toString("base64url");
    const forgedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const verified = authService.verifyJwtToken(forgedToken);
    assert.equal(verified, null);
  });

  test("Rate Limiting: Returns HTTP 429 when IP rate limit is exceeded on /auth/request-otp", async () => {
    // Make 22 rapid requests to trip the 20-request/minute rate limiter
    let tripped429 = false;
    for (let i = 0; i < 22; i++) {
      const res = await fetch(`${baseUrl}/auth/request-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "198.51.100.42" // Unique mock IP
        },
        body: JSON.stringify({ phone: `91987654${1000 + i}` })
      });

      if (res.status === 429) {
        tripped429 = true;
        const errJson = await res.json();
        assert.equal(errJson.status, 429);
        assert.ok(res.headers.get("retry-after"));
        break;
      }
    }
    assert.ok(tripped429, "Rate limiter should return HTTP 429 after exceeding request quota");
  });

  // ═══════════════════════════════════════════════════════════
  // 3. ATELIER STUDIO QC GATE & WORKFLOW GUARDRAILS
  // ═══════════════════════════════════════════════════════════

  test("QC Gate: Rejects verification when photo evidence URL is empty or whitespace", () => {
    const order = OrderService.createOrder({
      items: [{ pricePaise: 495000, quantity: 1 }],
      shippingAddress: { pincode: "110001", city: "New Delhi" }
    });

    assert.throws(() => {
      adminService.verifyStudioQcGate({
        orderNumber: order.orderNumber,
        inspectorName: "Artisan Zoya",
        photoEvidenceUrl: "   " // Blank/whitespace
      });
    }, /QC_PHOTO_MANDATORY/);
  });

  test("QC Gate: Prevents illegal status jump (PENDING_PAYMENT to DISPATCHED)", () => {
    const order = OrderService.createOrder({
      items: [{ pricePaise: 295000, quantity: 1 }],
      shippingAddress: { pincode: "110001", city: "New Delhi" }
    });

    assert.throws(() => {
      adminService.transitionOrderStatus({
        orderNumber: order.orderNumber,
        targetStatus: "DISPATCHED",
        actorName: "Intruder"
      });
    }, /ILLEGAL_STATE_TRANSITION/);
  });

  test("QC Gate: Prevents transition to QUALITY_CHECKED without prior photographic inspection", () => {
    const order = OrderService.createOrder({
      items: [{ pricePaise: 395000, quantity: 1 }],
      shippingAddress: { pincode: "110001", city: "New Delhi" }
    });
    OrderService.confirmPayment(order.orderNumber, { paymentId: "pay_test_qc" });
    adminService.transitionOrderStatus({
      orderNumber: order.orderNumber,
      targetStatus: "IN_PRODUCTION",
      actorName: "Artisan Lead"
    });

    // Attempting direct jump to QUALITY_CHECKED without verifyStudioQcGate
    assert.throws(() => {
      adminService.transitionOrderStatus({
        orderNumber: order.orderNumber,
        targetStatus: "QUALITY_CHECKED",
        actorName: "Bypass Attempt"
      });
    }, /QC_PHOTO_GATE_VIOLATION/);
  });

  // ═══════════════════════════════════════════════════════════
  // 4. LOGISTICS & CARRIER MANIFEST GUARDRAILS
  // ═══════════════════════════════════════════════════════════

  test("Logistics: Rejects manifest generation for non-existent order number", () => {
    assert.throws(() => {
      logisticsCourierService.generateShippingManifest({
        orderNumber: "HBH-INVALID-999999"
      });
    }, /ORDER_NOT_FOUND/);
  });

  test("Logistics: Rejects manifest generation for unserviceable remote PIN code", () => {
    const unserviceableOrder = OrderService.createOrder({
      items: [{ pricePaise: 350000, quantity: 1 }],
      shippingAddress: {
        pincode: "990001", // APS military / unserviceable postal zone
        city: "Army Field Base"
      }
    });

    assert.throws(() => {
      logisticsCourierService.generateShippingManifest({
        orderNumber: unserviceableOrder.orderNumber
      });
    }, /UNSERVICEABLE_PINCODE/);
  });

  test("Logistics: Rejects manifest generation for cancelled order", () => {
    const cancelledOrder = OrderService.createOrder({
      items: [{ pricePaise: 250000, quantity: 1 }],
      shippingAddress: { pincode: "110001", city: "New Delhi" }
    });
    cancelledOrder.status = "CANCELLED";

    assert.throws(() => {
      logisticsCourierService.generateShippingManifest({
        orderNumber: cancelledOrder.orderNumber
      });
    }, /ORDER_CANCELLED/);
  });

  // ═══════════════════════════════════════════════════════════
  // 5. ATOMIC CRASH PERSISTENCE & REHYDRATION
  // ═══════════════════════════════════════════════════════════

  test("Persistence: Synchronously flushes orders to disk and rehydrates accurately", () => {
    const order = OrderService.createOrder({
      items: [{ id: "ITEM_PERSIST_TEST", title: "Resilient Atelier Hamper", pricePaise: 495000, quantity: 1 }],
      shippingAddress: {
        fullName: "Vikramaditya Roy",
        line1: "Civil Lines",
        city: "New Delhi",
        pincode: "110054"
      }
    });
    OrderService.confirmPayment(order.orderNumber, { paymentId: "pay_persist_7788" });

    // Flush immediately to disk
    OrderService.flushPersistence();

    // Verify disk file
    const storePath = path.join(__dirname, "..", "data", "atelier_store.json");
    assert.ok(fs.existsSync(storePath), "Store file must exist on disk");

    // Load state directly from persistence engine
    const state = persistenceEngine.loadState();
    assert.ok(Array.isArray(state.orders), "Persisted state must contain orders array");
    const found = state.orders.find(o => o.orderNumber === order.orderNumber);
    assert.ok(found, `Order ${order.orderNumber} must be present in persisted store`);
    assert.equal(found.status, ORDER_STATUS.CONFIRMED);
    assert.equal(found.payment?.paymentId, "pay_persist_7788");
  });

});
