/**
 * HAMPERS BY HER — RULE-BASED COUPON EVALUATION & DISCOUNT PRECEDENCE ENGINE (DAG)
 * 
 * Formal Specification Reference: 39_DSA.md Section 7.3 (Algorithm 3)
 * Implements non-stackable DAG precedence evaluation and fraud defense.
 * Time Complexity: O(R log R)
 * Space Complexity: O(R)
 */

const { toPaiseBigInt } = require("./pricingLedger");

const ACTIVE_PROMOTIONAL_RULES = [
  {
    id: "RULE_ALMAS10",
    code: "ALMAS10",
    description: "10% off for atelier patrons up to ₹500 discount",
    discountType: "PERCENTAGE",
    discountValue: 10n,
    maxDiscountPaise: 50000n, // ₹500
    minOrderSubtotalPaise: 150000n, // ₹1,500
    userGroup: "ALL",
    maxGlobalRedemptions: 10000,
    maxPerUserRedemptions: 3,
    startsAt: "2026-01-01T00:00:00Z",
    expiresAt: "2027-12-31T23:59:59Z",
    allowedCategories: ["ALL"],
    stackable: false
  },
  {
    id: "RULE_WELCOME15",
    code: "WELCOME15",
    description: "15% off first-time order up to ₹1,000 discount",
    discountType: "PERCENTAGE",
    discountValue: 15n,
    maxDiscountPaise: 100000n, // ₹1,000
    minOrderSubtotalPaise: 250000n, // ₹2,500
    userGroup: "FIRST_TIME",
    maxGlobalRedemptions: 5000,
    maxPerUserRedemptions: 1,
    startsAt: "2026-01-01T00:00:00Z",
    expiresAt: "2027-12-31T23:59:59Z",
    allowedCategories: ["ALL"],
    stackable: false
  },
  {
    id: "RULE_WEDDINGVIP",
    code: "WEDDINGVIP",
    description: "Flat ₹2,500 discount on bespoke wedding orders over ₹15,000",
    discountType: "FLAT_PAISE",
    discountValue: 250000n, // ₹2,500
    maxDiscountPaise: 250000n,
    minOrderSubtotalPaise: 1500000n, // ₹15,000
    userGroup: "ALL",
    maxGlobalRedemptions: 1000,
    maxPerUserRedemptions: 2,
    startsAt: "2026-01-01T00:00:00Z",
    expiresAt: "2027-12-31T23:59:59Z",
    allowedCategories: ["WEDDING", "BESPOKE"],
    stackable: false
  },
  {
    id: "RULE_ATELIERVIP",
    code: "ATELIERVIP",
    description: "20% off for VIP patrons with total spend > ₹25,000",
    discountType: "PERCENTAGE",
    discountValue: 20n,
    maxDiscountPaise: 300000n, // ₹3,000
    minOrderSubtotalPaise: 500000n, // ₹5,000
    userGroup: "VIP",
    maxGlobalRedemptions: 2000,
    maxPerUserRedemptions: 5,
    startsAt: "2026-01-01T00:00:00Z",
    expiresAt: "2027-12-31T23:59:59Z",
    allowedCategories: ["ALL"],
    stackable: false
  }
];

class CouponPrecedenceEngine {
  constructor(rules = ACTIVE_PROMOTIONAL_RULES) {
    this.rules = rules;
    this.redemptionLedger = new Map(); // code:userId -> count
    this.globalRedemptionLedger = new Map(); // code -> count
  }

  /**
   * Evaluates single coupon applicability against cart and patron context
   * @param {Object} params
   * @param {string} params.couponCode
   * @param {bigint|number} params.grossSubtotalPaise
   * @param {Array<string>} [params.categories=[]]
   * @param {Object} [params.customerContext={}]
   * @returns {Object} EvaluationResult
   */
  evaluateCoupon({
    couponCode,
    grossSubtotalPaise,
    categories = ["ALL"],
    customerContext = { userId: "anon", orderCount: 0, totalSpendPaise: 0n }
  }) {
    if (!couponCode) {
      return { valid: false, reason: "NO_COUPON_PROVIDED" };
    }

    const code = couponCode.trim().toUpperCase();
    const rule = this.rules.find(r => r.code === code);

    if (!rule) {
      return { valid: false, code, reason: "INVALID_COUPON_CODE" };
    }

    const now = new Date();
    const subtotal = toPaiseBigInt(grossSubtotalPaise);

    // 1. Temporal Validity Window
    if (new Date(rule.startsAt) > now) {
      return { valid: false, code, reason: "COUPON_NOT_YET_ACTIVE" };
    }
    if (new Date(rule.expiresAt) < now) {
      return { valid: false, code, reason: "COUPON_EXPIRED" };
    }

    // 2. Global Redemption Limit
    const globalCount = this.globalRedemptionLedger.get(code) || 0;
    if (globalCount >= rule.maxGlobalRedemptions) {
      return { valid: false, code, reason: "GLOBAL_REDEMPTION_LIMIT_EXCEEDED" };
    }

    // 3. Per-User Redemption Limit
    const userKey = `${code}:${customerContext.userId || "anon"}`;
    const userCount = this.redemptionLedger.get(userKey) || 0;
    if (userCount >= rule.maxPerUserRedemptions) {
      return { valid: false, code, reason: "USER_REDEMPTION_LIMIT_EXCEEDED" };
    }

    // 4. Cart Subtotal Threshold
    if (subtotal < rule.minOrderSubtotalPaise) {
      return {
        valid: false,
        code,
        reason: "MINIMUM_ORDER_THRESHOLD_NOT_MET",
        minOrderSubtotalPaise: Number(rule.minOrderSubtotalPaise)
      };
    }

    // 5. Category Inclusions
    if (!rule.allowedCategories.includes("ALL")) {
      const hasEligibleCategory = categories.some(cat => 
        rule.allowedCategories.map(c => c.toUpperCase()).includes(cat.toUpperCase())
      );
      if (!hasEligibleCategory) {
        return {
          valid: false,
          code,
          reason: "INELIGIBLE_CATEGORY",
          allowedCategories: rule.allowedCategories
        };
      }
    }

    // 6. User Group Eligibility
    if (rule.userGroup === "FIRST_TIME") {
      if ((customerContext.orderCount || 0) > 0) {
        return { valid: false, code, reason: "RESTRICTED_TO_FIRST_TIME_PATRONS" };
      }
    } else if (rule.userGroup === "VIP") {
      const totalSpend = toPaiseBigInt(customerContext.totalSpendPaise || 0n);
      const isVip = (customerContext.orderCount || 0) >= 5 || totalSpend >= 2500000n; // ₹25,000 spend
      if (!isVip) {
        return { valid: false, code, reason: "RESTRICTED_TO_VIP_PATRONS" };
      }
    }

    // Calculate exact discount amount
    let discountPaise = 0n;
    if (rule.discountType === "FLAT_PAISE") {
      discountPaise = rule.discountValue;
    } else if (rule.discountType === "PERCENTAGE") {
      const rawDiscount = (subtotal * rule.discountValue) / 100n;
      discountPaise = rule.maxDiscountPaise && rawDiscount > rule.maxDiscountPaise
        ? rule.maxDiscountPaise
        : rawDiscount;
    }

    if (discountPaise > subtotal) {
      discountPaise = subtotal;
    }

    return {
      valid: true,
      ruleId: rule.id,
      code: rule.code,
      discountType: rule.discountType,
      discountValue: Number(rule.discountValue),
      discountPaise,
      maxDiscountPaise: Number(rule.maxDiscountPaise || 0n)
    };
  }

  /**
   * Resolves the highest-value non-conflicting promotion from a candidate list
   * @param {Object} params
   * @param {Array<string>} params.candidateCodes
   * @param {bigint|number} params.grossSubtotalPaise
   * @param {Array<string>} [params.categories=[]]
   * @param {Object} [params.customerContext={}]
   * @returns {Object|null} Best promotion or null
   */
  resolveOptimalPromotion({
    candidateCodes,
    grossSubtotalPaise,
    categories = ["ALL"],
    customerContext = {}
  }) {
    if (!Array.isArray(candidateCodes) || candidateCodes.length === 0) {
      return null;
    }

    const validEvaluations = [];
    for (const code of candidateCodes) {
      const evalResult = this.evaluateCoupon({
        couponCode: code,
        grossSubtotalPaise,
        categories,
        customerContext
      });
      if (evalResult.valid) {
        validEvaluations.push(evalResult);
      }
    }

    if (validEvaluations.length === 0) {
      return null;
    }

    // Sort descending by monetary benefit: O(R log R)
    validEvaluations.sort((a, b) => {
      if (b.discountPaise > a.discountPaise) return 1;
      if (b.discountPaise < a.discountPaise) return -1;
      return 0;
    });

    return validEvaluations[0];
  }

  /**
   * Records successful redemption of coupon
   * @param {string} code
   * @param {string} userId
   */
  recordRedemption(code, userId = "anon") {
    const normCode = code.trim().toUpperCase();
    const userKey = `${normCode}:${userId}`;
    this.redemptionLedger.set(userKey, (this.redemptionLedger.get(userKey) || 0) + 1);
    this.globalRedemptionLedger.set(normCode, (this.globalRedemptionLedger.get(normCode) || 0) + 1);
  }
}

module.exports = {
  ACTIVE_PROMOTIONAL_RULES,
  CouponPrecedenceEngine
};
