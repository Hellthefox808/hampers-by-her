/**
 * HAMPERS BY HER — DETERMINISTIC SERVER-SIDE CART & HAMPER PRICING LEDGER
 * 
 * Formal Specification Reference: 39_DSA.md Section 7.2 (Algorithm 2)
 * Guarantees zero 64-bit float drift using BigInt integer paise math.
 * Time Complexity: O(I + C)
 * Space Complexity: O(1)
 */

/**
 * Converts any numerical or string amount to a safe BigInt paise integer
 * @param {number|string|bigint} val Amount in paise or rupees
 * @returns {bigint}
 */
function toPaiseBigInt(val) {
  if (typeof val === "bigint") return val;
  if (typeof val === "number") {
    if (!Number.isFinite(val)) throw new RangeError("Invalid non-finite number for currency conversion");
    return BigInt(Math.floor(val));
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!/^-?\d+$/.test(trimmed)) throw new TypeError(`Cannot convert string "${val}" to BigInt paise`);
    return BigInt(trimmed);
  }
  return 0n;
}

/**
 * Formats BigInt paise into a standardized ₹XX.XX string
 * @param {bigint} paiseBigInt
 * @returns {string}
 */
function formatRupees(paiseBigInt) {
  const isNegative = paiseBigInt < 0n;
  const abs = isNegative ? -paiseBigInt : paiseBigInt;
  const rupees = abs / 100n;
  const paise = abs % 100n;
  const paddedPaise = paise < 10n ? `0${paise}` : `${paise}`;
  return `${isNegative ? "-" : ""}${rupees}.${paddedPaise}`;
}

/**
 * Calculates deterministic order financial ledger
 * @param {Object} params
 * @param {bigint|number} [params.basePricePaise=0n]
 * @param {Array<{ unit_price_paise: bigint|number, quantity: number }>} [params.items=[]]
 * @param {Array<{ price_delta_paise: bigint|number }>} [params.customizations=[]]
 * @param {bigint|number} [params.packagingPricePaise=0n]
 * @param {Object|null} [params.coupon=null]
 * @param {Object} [params.shippingConfig]
 * @param {number} [params.gstRatePercent=18]
 * @returns {Object} PricingBreakdown with BigInts
 */
function calculateDeterministicOrderPricing({
  basePricePaise = 0n,
  items = [],
  customizations = [],
  packagingPricePaise = 0n,
  coupon = null,
  shippingConfig = { base_shipping_paise: 25000n, free_threshold_paise: 299900n },
  gstRatePercent = 18
}) {
  const basePaise = toPaiseBigInt(basePricePaise);
  const packagingPaise = toPaiseBigInt(packagingPricePaise);
  const freeThresholdPaise = toPaiseBigInt(shippingConfig.free_threshold_paise ?? 299900n);
  const baseShippingPaise = toPaiseBigInt(shippingConfig.base_shipping_paise ?? 25000n);

  // 1. Items subtotal
  let itemsSubtotal = basePaise;
  for (const item of items) {
    const unitPrice = toPaiseBigInt(item.unit_price_paise ?? item.pricePaise ?? 0);
    const qty = BigInt(Math.max(1, Math.floor(Number(item.quantity || 1))));
    itemsSubtotal += unitPrice * qty;
  }

  // 2. Customizations subtotal
  let customizationsSubtotal = 0n;
  for (const c of customizations) {
    const delta = toPaiseBigInt(c.price_delta_paise ?? c.pricePaise ?? 0);
    customizationsSubtotal += delta;
  }

  // 3. Gross Subtotal
  const grossSubtotal = itemsSubtotal + packagingPaise + customizationsSubtotal;

  // 4. Coupon Discount Evaluation
  let discountPaise = 0n;
  let couponApplied = false;

  if (coupon) {
    const minSubtotal = toPaiseBigInt(coupon.min_order_subtotal_paise ?? coupon.minOrderSubtotalPaise ?? 0n);
    if (grossSubtotal >= minSubtotal) {
      const discountType = (coupon.discount_type || coupon.discountType || "PERCENTAGE").toUpperCase();
      const discountValue = toPaiseBigInt(coupon.discount_value ?? coupon.discountValue ?? 0);
      const maxDiscount = coupon.max_discount_paise !== undefined && coupon.max_discount_paise !== null
        ? toPaiseBigInt(coupon.max_discount_paise)
        : (coupon.maxDiscountPaise !== undefined && coupon.maxDiscountPaise !== null ? toPaiseBigInt(coupon.maxDiscountPaise) : null);

      if (discountType === "FLAT_PAISE" || discountType === "FLAT") {
        discountPaise = discountValue;
      } else if (discountType === "PERCENTAGE") {
        // Integer arithmetic: (grossSubtotal * discountValue) / 100n
        const rawDiscount = (grossSubtotal * discountValue) / 100n;
        discountPaise = maxDiscount !== null && rawDiscount > maxDiscount ? maxDiscount : rawDiscount;
      }

      // Discount can never exceed gross subtotal
      if (discountPaise > grossSubtotal) {
        discountPaise = grossSubtotal;
      }
      couponApplied = discountPaise > 0n;
    }
  }

  const netSubtotal = grossSubtotal - discountPaise;

  // 5. Shipping fee calculation
  let shippingPaise = 0n;
  if (netSubtotal < freeThresholdPaise && netSubtotal > 0n) {
    shippingPaise = baseShippingPaise;
  }

  // 6. GST Calculation (Inclusive B2C Model)
  // Taxable = NetSubtotal / (1 + Rate/100)
  const gstRate = BigInt(Math.max(0, Math.floor(gstRatePercent)));
  const taxDenominator = 100n + gstRate;
  const taxableAmount = (netSubtotal * 100n) / taxDenominator;
  const totalGst = netSubtotal - taxableAmount;
  const cgstPaise = totalGst / 2n;
  const sgstPaise = totalGst - cgstPaise; // Exact remainder guarantee: cgst + sgst === totalGst

  const totalPayable = netSubtotal + shippingPaise;

  return {
    subtotal_items_paise: itemsSubtotal,
    packaging_paise: packagingPaise,
    customizations_paise: customizationsSubtotal,
    gross_subtotal_paise: grossSubtotal,
    discount_paise: discountPaise,
    net_subtotal_paise: netSubtotal,
    shipping_paise: shippingPaise,
    taxable_amount_paise: taxableAmount,
    cgst_paise: cgstPaise,
    sgst_paise: sgstPaise,
    total_payable_paise: totalPayable,
    coupon_applied: couponApplied
  };
}

/**
 * Serializes BigInt ledger into a JSON-compliant response
 * @param {Object} ledger
 * @returns {Object}
 */
function serializePricingLedger(ledger) {
  return {
    subtotalItemsPaise: Number(ledger.subtotal_items_paise),
    packagingPaise: Number(ledger.packaging_paise),
    customizationsPaise: Number(ledger.customizations_paise),
    grossSubtotalPaise: Number(ledger.gross_subtotal_paise),
    discountPaise: Number(ledger.discount_paise),
    netSubtotalPaise: Number(ledger.net_subtotal_paise),
    shippingPaise: Number(ledger.shipping_paise),
    taxableAmountPaise: Number(ledger.taxable_amount_paise),
    cgstPaise: Number(ledger.cgst_paise),
    sgstPaise: Number(ledger.sgst_paise),
    totalPayablePaise: Number(ledger.total_payable_paise),
    couponApplied: Boolean(ledger.coupon_applied),
    formatted: {
      subtotalRupees: formatRupees(ledger.subtotal_items_paise),
      discountRupees: formatRupees(ledger.discount_paise),
      netSubtotalRupees: formatRupees(ledger.net_subtotal_paise),
      shippingRupees: formatRupees(ledger.shipping_paise),
      taxRupees: formatRupees(ledger.cgst_paise + ledger.sgst_paise),
      totalRupees: formatRupees(ledger.total_payable_paise)
    }
  };
}

module.exports = {
  toPaiseBigInt,
  formatRupees,
  calculateDeterministicOrderPricing,
  serializePricingLedger
};
