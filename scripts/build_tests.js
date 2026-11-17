const fs = require("fs");
const path = require("path");

const root = path.resolve(".");

// 1. pricingEngine.test.js
const pricingTest = `const test = require("node:test");
const assert = require("node:assert");
const { PricingEngine, COUPONS } = require("../server/services/pricingEngine");

test("PricingEngine - Computes correct paise integer math without float drift", () => {
  const result = PricingEngine.calculate({
    items: [
      { pricePaise: 395000, quantity: 1 }, // ₹3,950
      { pricePaise: 42000, quantity: 2 }   // ₹420 x 2 = ₹840 (84,000 paise)
    ],
    box: { pricePaise: 45000 },             // ₹450
    customizations: [
      { pricePaise: 12000 }                 // ₹120
    ]
  });

  // Expected subtotal: 395000 + 84000 + 45000 + 12000 = 536000 paise (₹5,360)
  assert.strictEqual(result.subtotalPaise, 536000);
  assert.strictEqual(result.subtotalRupees, "5360.00");

  // Free shipping since > ₹2,999 (299900 paise)
  assert.strictEqual(result.shippingPaise, 0);

  // 18% GST on 536000: Math.round(536000 * 0.18) = 96480 paise
  assert.strictEqual(result.taxPaise, 96480);
  assert.strictEqual(result.taxRupees, "964.80");

  // Grand total: 536000 + 96480 + 0 = 632480 paise
  assert.strictEqual(result.totalPaise, 632480);
  assert.strictEqual(result.totalRupees, "6324.80");
});

test("PricingEngine - Applies ALMAS10 coupon up to maximum cap", () => {
  const result = PricingEngine.calculate({
    items: [{ pricePaise: 600000, quantity: 1 }], // ₹6,000
    couponCode: "ALMAS10"
  });

  assert.strictEqual(result.subtotalPaise, 600000);
  // 10% of ₹6,000 is ₹600, but cap is ₹500 (50000 paise)
  assert.strictEqual(result.discountPaise, 50000);
  assert.strictEqual(result.discountRupees, "500.00");
  assert.ok(result.appliedCoupon);
  assert.strictEqual(result.appliedCoupon.code, "ALMAS10");

  // Taxable base: 600000 - 50000 = 550000 paise
  assert.strictEqual(result.taxableBasePaise, 550000);
});

test("PricingEngine - Standard delivery fee applies below free shipping threshold", () => {
  const result = PricingEngine.calculate({
    items: [{ pricePaise: 150000, quantity: 1 }], // ₹1,500
    deliveryTier: "STANDARD"
  });

  assert.strictEqual(result.subtotalPaise, 150000);
  assert.strictEqual(result.isFreeShippingEligible, false);
  assert.strictEqual(result.shippingPaise, 15000); // ₹150
  assert.strictEqual(result.remainingForFreeShippingPaise, 149900); // ₹1,499 more needed
});
`;

fs.writeFileSync(path.join(root, "tests", "pricingEngine.test.js"), pricingTest, "utf8");

// 2. hamperBuilder.test.js
const builderTest = `const test = require("node:test");
const assert = require("node:assert");
const { HamperBuilderEngine, BOX_BASES } = require("../server/services/hamperBuilder");

test("HamperBuilder - Validates box capacity and computes fullness percentage", () => {
  const validation = HamperBuilderEngine.validateConfiguration({
    boxId: "BOX_KRAFT_RIGID", // Capacity: 5200 cm3
    itemIds: [
      "ITEM_CANDLE_AMBER",          // 750 cm3
      "ITEM_CHOCO_DARK_HAZELNUT",   // 450 cm3
      "ITEM_TEA_ROSE_BLUSH"         // 600 cm3
    ]
  });

  // Total volume: 750 + 450 + 600 = 1800 cm3
  assert.strictEqual(validation.totalVolumeCm3, 1800);
  assert.strictEqual(validation.itemCount, 3);
  // Fullness: Math.round((1800 / 5200) * 100) = 35%
  assert.strictEqual(validation.fullnessPercent, 35);
  assert.strictEqual(validation.fullnessStatus, "UNDERFILLED");
  assert.strictEqual(validation.isValid, true);
});

test("HamperBuilder - Rejects overfilled hampers exceeding 100% capacity", () => {
  const validation = HamperBuilderEngine.validateConfiguration({
    boxId: "BOX_KRAFT_RIGID", // Capacity: 5200 cm3
    itemIds: [
      "ITEM_CANDLE_AMBER",
      "ITEM_BATH_SALTS",
      "ITEM_TONIC_ELDERFLOWER",
      "ITEM_TEA_ROSE_BLUSH",
      "ITEM_LEATHER_JOURNAL",
      "ITEM_BRASS_BELL",
      "ITEM_CHOCO_DARK_HAZELNUT",
      "ITEM_SILK_NAPKIN"
    ]
  });

  // Sum of all 8 items is > 5200 cm3
  assert.ok(validation.totalVolumeCm3 > 5200);
  assert.strictEqual(validation.fullnessStatus, "OVERFILLED");
  assert.strictEqual(validation.isValid, false);
  assert.ok(validation.errors.some(e => e.includes("exceed box volume capacity")));
});

test("HamperBuilder - Warns on fewer than 3 items", () => {
  const validation = HamperBuilderEngine.validateConfiguration({
    boxId: "BOX_KRAFT_RIGID",
    itemIds: ["ITEM_CANDLE_AMBER"]
  });

  assert.strictEqual(validation.itemCount, 1);
  assert.ok(validation.warnings.some(w => w.includes("Add at least 2 more item(s)")));
});
`;

fs.writeFileSync(path.join(root, "tests", "hamperBuilder.test.js"), builderTest, "utf8");

// 3. deliveryService.test.js
const deliveryTest = `const test = require("node:test");
const assert = require("node:assert");
const { DeliveryService } = require("../server/services/deliveryService");

test("DeliveryService - Correctly identifies Delhi Metro PIN code", () => {
  const result = DeliveryService.checkPincode("110001");
  assert.strictEqual(result.isServiceable, true);
  assert.strictEqual(result.city, "New Delhi");
  assert.strictEqual(result.zone, "METRO_AIR");
  assert.strictEqual(result.standardDays, 2);
  assert.strictEqual(result.expressAvailable, true);
});

test("DeliveryService - Correctly identifies Mumbai Metro PIN code", () => {
  const result = DeliveryService.checkPincode("400050");
  assert.strictEqual(result.isServiceable, true);
  assert.strictEqual(result.city, "Mumbai");
  assert.strictEqual(result.zone, "METRO_AIR");
});

test("DeliveryService - Rejects malformed and invalid PIN codes", () => {
  const invalid1 = DeliveryService.checkPincode("123");
  assert.strictEqual(invalid1.isServiceable, false);

  const invalid2 = DeliveryService.checkPincode("012345");
  assert.strictEqual(invalid2.isServiceable, false);

  const invalid3 = DeliveryService.checkPincode("ABCD12");
  assert.strictEqual(invalid3.isServiceable, false);
});
`;

fs.writeFileSync(path.join(root, "tests", "deliveryService.test.js"), deliveryTest, "utf8");

// 4. orderService.test.js
const orderTest = `const test = require("node:test");
const assert = require("node:assert");
const { OrderService, ORDER_STATUS } = require("../server/services/orderService");

test("OrderService - Creates order in PENDING_PAYMENT state and transitions to CONFIRMED upon payment", () => {
  const order = OrderService.createOrder({
    items: [{ pricePaise: 395000, quantity: 1 }],
    shippingAddress: {
      fullName: "Priya Sharma",
      phone: "9876543210",
      pincode: "110001",
      city: "New Delhi",
      street: "Connaught Place"
    },
    buyerContact: { email: "priya@example.com", phone: "9876543210" }
  });

  assert.ok(order.orderNumber.startsWith("HBH-"));
  assert.strictEqual(order.status, ORDER_STATUS.PENDING_PAYMENT);
  assert.strictEqual(order.trackingTimeline.length, 1);

  // Confirm Payment
  const confirmed = OrderService.confirmPayment(order.orderNumber, {
    paymentId: "pay_test_998877",
    method: "UPI"
  });

  assert.strictEqual(confirmed.status, ORDER_STATUS.CONFIRMED);
  assert.strictEqual(confirmed.payment.status, "CAPTURED");
  assert.strictEqual(confirmed.payment.method, "UPI");
  assert.strictEqual(confirmed.trackingTimeline.length, 2);
});
`;

fs.writeFileSync(path.join(root, "tests", "orderService.test.js"), orderTest, "utf8");

console.log("All test suites written successfully!");
