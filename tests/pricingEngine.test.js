const test = require("node:test");
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
