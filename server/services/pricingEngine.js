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
  },
  WELCOME15: {
    code: 'WELCOME15',
    type: 'PERCENTAGE',
    value: 15,
    maxDiscountPaise: 100000, // ₹1,000
    minOrderPaise: 250000, // ₹2,500
    description: '15% off first atelier curation up to ₹1,000'
  },
  WEDDINGVIP: {
    code: 'WEDDINGVIP',
    type: 'FLAT',
    value: 250000, // ₹2,500
    minOrderPaise: 1500000, // ₹15,000
    description: 'Flat ₹2,500 off bespoke trousseau orders over ₹15,000'
  }
};

const FREE_SHIPPING_THRESHOLD_PAISE = 299900; // ₹2,999

function formatPaiseFixed(paiseBigInt) {
  const abs = paiseBigInt < 0n ? -paiseBigInt : paiseBigInt;
  const rupees = abs / 100n;
  const paise = abs % 100n;
  return `${paiseBigInt < 0n ? '-' : ''}${rupees}.${paise < 10n ? '0' : ''}${paise}`;
}

class PricingEngine {
  /**
   * Evaluate a single promo code against a subtotal in Paise
   */
  static validateCoupon(couponCode, subtotalPaise = 0) {
    const normalized = String(couponCode || '').trim().toUpperCase();
    if (!normalized) {
      return { valid: false, reason: 'EMPTY_CODE', message: 'Please enter a promo code.' };
    }
    const coupon = COUPONS[normalized];
    if (!coupon) {
      return { valid: false, code: normalized, reason: 'INVALID_CODE', message: `Promo code '${normalized}' is not valid.` };
    }

    const subtotal = BigInt(Math.max(0, Math.round(Number(subtotalPaise) || 0)));
    const minOrder = BigInt(coupon.minOrderPaise);
    if (subtotal < minOrder) {
      return {
        valid: false,
        code: coupon.code,
        reason: 'MIN_ORDER_NOT_MET',
        minOrderPaise: coupon.minOrderPaise,
        minOrderRupees: coupon.minOrderPaise / 100,
        message: `${coupon.code} requires a minimum order of ₹${(coupon.minOrderPaise / 100).toLocaleString('en-IN')}.`
      };
    }

    let discount = 0n;
    if (coupon.type === 'PERCENTAGE') {
      const raw = (subtotal * BigInt(coupon.value) + 50n) / 100n;
      const cap = coupon.maxDiscountPaise ? BigInt(coupon.maxDiscountPaise) : null;
      discount = cap !== null && raw > cap ? cap : raw;
    } else {
      discount = BigInt(coupon.value) > subtotal ? subtotal : BigInt(coupon.value);
    }

    return {
      valid: true,
      code: coupon.code,
      description: coupon.description,
      discountPaise: Number(discount),
      discountRupees: formatPaiseFixed(discount),
      minOrderRupees: coupon.minOrderPaise / 100
    };
  }

  /**
   * Calculate complete order pricing breakdown using exact BigInt integer Paise arithmetic
   */
  static calculate(params) {
    const items = Array.isArray(params.items) ? params.items : [];
    const box = params.box || null;
    const customizations = Array.isArray(params.customizations) ? params.customizations : [];
    const couponCode = params.couponCode ? params.couponCode.trim().toUpperCase() : null;
    const deliveryTier = params.deliveryTier || 'STANDARD';

    // 1. Calculate Items Subtotal (BigInt exact)
    let itemsSubtotal = 0n;
    for (const item of items) {
      const rawPaise = item.pricePaise ?? item.basePricePaise ?? (item.price ? Math.round(item.price * 100) : 0);
      const price = BigInt(Math.max(0, Math.round(Number(rawPaise) || 0)));
      const qty = BigInt(Math.max(1, Math.floor(Number(item.quantity || 1))));
      itemsSubtotal += price * qty;
    }

    // 2. Add Packaging Box
    const boxPrice = box
      ? BigInt(Math.max(0, Math.round(Number(box.pricePaise || (box.price ? Math.round(box.price * 100) : 0)) || 0)))
      : 0n;

    // 3. Add Customizations
    let customPrice = 0n;
    for (const cust of customizations) {
      const cPrice = BigInt(Math.max(0, Math.round(Number(cust.pricePaise || (cust.price ? Math.round(cust.price * 100) : 0)) || 0)));
      customPrice += cPrice;
    }

    const subtotalBig = itemsSubtotal + boxPrice + customPrice;
    const subtotalPaise = Number(subtotalBig);

    // 4. Calculate Coupon Discount
    let discountBig = 0n;
    let appliedCoupon = null;

    if (couponCode) {
      const couponEval = this.validateCoupon(couponCode, subtotalPaise);
      if (couponEval.valid) {
        discountBig = BigInt(couponEval.discountPaise);
        appliedCoupon = {
          code: couponEval.code,
          discountPaise: couponEval.discountPaise,
          description: couponEval.description
        };
      }
    }

    // Taxable Base (Subtotal - Discount)
    const taxableBaseBig = subtotalBig > discountBig ? subtotalBig - discountBig : 0n;

    // 5. Composite GST 18% (exact rounded integer BigInt, remainder-preserving CGST + SGST split)
    const taxBig = (taxableBaseBig * 18n + 50n) / 100n;
    const cgstBig = taxBig / 2n;
    const sgstBig = taxBig - cgstBig;

    // 6. Delivery Shipping Calculation
    let shippingBig = 0n;
    if (subtotalBig >= BigInt(FREE_SHIPPING_THRESHOLD_PAISE) && deliveryTier === 'STANDARD') {
      shippingBig = 0n;
    } else if (deliveryTier === 'EXPRESS') {
      shippingBig = 25000n; // ₹250 Express Air
    } else if (deliveryTier === 'SAME_DAY') {
      shippingBig = 45000n; // ₹450 Hyperlocal Same-Day
    } else {
      shippingBig = 15000n; // ₹150 Standard Surface/Air
    }

    // 7. Final Grand Total
    const totalBig = taxableBaseBig + taxBig + shippingBig;

    const subtotalRupees = formatPaiseFixed(subtotalBig);
    const discountRupees = formatPaiseFixed(discountBig);
    const taxableBaseRupees = formatPaiseFixed(taxableBaseBig);
    const taxRupees = formatPaiseFixed(taxBig);
    const shippingRupees = formatPaiseFixed(shippingBig);
    const totalRupees = formatPaiseFixed(totalBig);

    return {
      subtotalPaise,
      subtotalRupees,
      discountPaise: Number(discountBig),
      discountRupees,
      taxableBasePaise: Number(taxableBaseBig),
      taxableBaseRupees,
      taxPaise: Number(taxBig),
      cgstPaise: Number(cgstBig),
      sgstPaise: Number(sgstBig),
      taxRupees,
      shippingPaise: Number(shippingBig),
      shippingRupees,
      totalPaise: Number(totalBig),
      totalRupees,
      formatted: {
        subtotalRupees,
        discountRupees,
        taxableBaseRupees,
        taxRupees,
        shippingRupees,
        totalRupees
      },
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
      type: c.type,
      value: c.value,
      maxDiscountPaise: c.maxDiscountPaise || null,
      description: c.description,
      minOrderPaise: c.minOrderPaise,
      minOrderRupees: c.minOrderPaise / 100
    }));
  }
}

module.exports = { PricingEngine, COUPONS };
