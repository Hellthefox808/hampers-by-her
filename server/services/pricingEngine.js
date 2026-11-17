/**
 * Hampers by Her — Server-Authoritative Pricing Engine
 * All calculations are executed in integer Paise (1 INR = 100 Paise)
 * to completely eliminate IEEE 754 floating-point rounding errors.
 */

const COUPONS = {
  ALMAS10: {
    code: 'ALMAS10',
    type: 'PERCENTAGE',
    value: 10,
    maxDiscountPaise: 50000, // ₹500
    minOrderPaise: 150000,    // ₹1,500
    description: '10% off artisanal hampers up to ₹500'
  },
  WELCOME500: {
    code: 'WELCOME500',
    type: 'FLAT',
    value: 50000, // ₹500
    minOrderPaise: 250000, // ₹2,500
    description: 'Flat ₹500 off on first atelier order over ₹2,500'
  },
  CELEBRATE: {
    code: 'CELEBRATE',
    type: 'FLAT',
    value: 30000, // ₹300
    minOrderPaise: 200000, // ₹2,000
    description: 'Flat ₹300 festive celebration discount'
  }
};

const FREE_SHIPPING_THRESHOLD_PAISE = 299900; // ₹2,999

class PricingEngine {
  /**
   * Calculate complete order pricing breakdown
   * @param {Object} params
   * @param {Array} params.items - Array of { pricePaise: number, quantity: number }
   * @param {Object} [params.box] - Packaging box { pricePaise: number }
   * @param {Array} [params.customizations] - Array of { pricePaise: number }
   * @param {string} [params.couponCode] - Optional coupon code
   * @param {string} [params.deliveryTier] - 'STANDARD' | 'EXPRESS' | 'SAME_DAY'
   * @returns {Object} Complete financial breakdown in Paise and Rupees
   */
  static calculate(params) {
    const items = Array.isArray(params.items) ? params.items : [];
    const box = params.box || null;
    const customizations = Array.isArray(params.customizations) ? params.customizations : [];
    const couponCode = params.couponCode ? params.couponCode.trim().toUpperCase() : null;
    const deliveryTier = params.deliveryTier || 'STANDARD';

    // 1. Calculate Items Subtotal
    let itemsSubtotalPaise = 0;
    for (const item of items) {
      const price = Math.max(0, parseInt(item.pricePaise || (item.price ? Math.round(item.price * 100) : 0), 10));
      const qty = Math.max(1, parseInt(item.quantity || 1, 10));
      itemsSubtotalPaise += price * qty;
    }

    // 2. Add Packaging Box
    const boxPricePaise = box ? Math.max(0, parseInt(box.pricePaise || (box.price ? Math.round(box.price * 100) : 0), 10)) : 0;

    // 3. Add Customizations (Monogram, Wax Seal, Polaroid, etc.)
    let customPricePaise = 0;
    for (const cust of customizations) {
      const cPrice = Math.max(0, parseInt(cust.pricePaise || (cust.price ? Math.round(cust.price * 100) : 0), 10));
      customPricePaise += cPrice;
    }

    const subtotalPaise = itemsSubtotalPaise + boxPricePaise + customPricePaise;

    // 4. Calculate Coupon Discount
    let discountPaise = 0;
    let appliedCoupon = null;

    if (couponCode && COUPONS[couponCode]) {
      const coupon = COUPONS[couponCode];
      if (subtotalPaise >= coupon.minOrderPaise) {
        if (coupon.type === 'PERCENTAGE') {
          const rawDiscount = Math.round((subtotalPaise * coupon.value) / 100);
          discountPaise = coupon.maxDiscountPaise ? Math.min(rawDiscount, coupon.maxDiscountPaise) : rawDiscount;
        } else if (coupon.type === 'FLAT') {
          discountPaise = Math.min(coupon.value, subtotalPaise);
        }
        appliedCoupon = {
          code: coupon.code,
          discountPaise,
          description: coupon.description
        };
      }
    }

    // Taxable Base (Subtotal - Discount)
    const taxableBasePaise = Math.max(0, subtotalPaise - discountPaise);

    // 5. Composite GST 18% (9% CGST + 9% SGST for intrastate, or 18% IGST)
    const taxPaise = Math.round(taxableBasePaise * 0.18);

    // 6. Delivery Shipping Calculation
    let shippingPaise = 0;
    if (subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE && deliveryTier === 'STANDARD') {
      shippingPaise = 0; // Free Standard Shipping
    } else {
      if (deliveryTier === 'EXPRESS') {
        shippingPaise = 25000; // ₹250 Express Air
      } else if (deliveryTier === 'SAME_DAY') {
        shippingPaise = 45000; // ₹450 Hyperlocal Same-Day
      } else {
        shippingPaise = 15000; // ₹150 Standard Surface/Air
      }
    }

    // 7. Final Grand Total
    const totalPaise = taxableBasePaise + taxPaise + shippingPaise;

    return {
      subtotalPaise,
      subtotalRupees: (subtotalPaise / 100).toFixed(2),
      discountPaise,
      discountRupees: (discountPaise / 100).toFixed(2),
      taxableBasePaise,
      taxableBaseRupees: (taxableBasePaise / 100).toFixed(2),
      taxPaise,
      taxRupees: (taxPaise / 100).toFixed(2),
      shippingPaise,
      shippingRupees: (shippingPaise / 100).toFixed(2),
      totalPaise,
      totalRupees: (totalPaise / 100).toFixed(2),
      currency: 'INR',
      appliedCoupon,
      isFreeShippingEligible: subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE,
      freeShippingThresholdPaise: FREE_SHIPPING_THRESHOLD_PAISE,
      remainingForFreeShippingPaise: Math.max(0, FREE_SHIPPING_THRESHOLD_PAISE - subtotalPaise)
    };
  }

  static getAvailableCoupons() {
    return Object.values(COUPONS).map(c => ({
      code: c.code,
      description: c.description,
      minOrderRupees: c.minOrderPaise / 100
    }));
  }
}

module.exports = { PricingEngine, COUPONS };
