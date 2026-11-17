/**
 * HAMPERS BY HER — ADVANCED DSA & COMPUTATIONAL ENGINES TEST SUITE
 * 
 * Formal Specification Reference: 39_DSA.md (Algorithms 1 through 8)
 * Verifies all 8 computational algorithms + Atelier Procedural Preview Visualizer.
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const {
  STANDARD_BOXES,
  evaluateHamperPacking,
  calculateDeterministicOrderPricing,
  serializePricingLedger,
  formatRupees,
  toPaiseBigInt,
  CouponPrecedenceEngine,
  tokenizeSearchIntent,
  computeTrigramSimilarity,
  rankItemsByFuzzyQuery,
  optimizeHamperForBudget,
  AtomicInventoryLockEngine,
  scoreInboundLead,
  LeadPriorityQueue,
  resolveDeliverySla
} = require("../platform/services/dsa");

const {
  generateHamperPreviewSvg,
  generateHamperPreviewDataUri
} = require("../platform/services/atelier-visualizer/previewGenerator");

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

describe("Hampers by Her Advanced Computational & DSA Suite (39_DSA.md)", () => {

  // ── Algorithm 1: 3D Volumetric Bin-Packing ──
  describe("Algorithm 1: 3D Volumetric Bin-Packing & Orientation/Thermal Compatibility", () => {
    test("Correctly packs compatible items within usable volume threshold (85%)", () => {
      const box = STANDARD_BOXES.MEDIUM; // 250 x 200 x 100 mm = 5,000,000 mm3
      const items = [
        { length_mm: 100, width_mm: 80, height_mm: 60, weight_g: 300, is_fragile: false, must_keep_upright: false, temperature_sensitive: false },
        { length_mm: 120, width_mm: 90, height_mm: 50, weight_g: 250, is_fragile: false, must_keep_upright: false, temperature_sensitive: false }
      ];

      const result = evaluateHamperPacking(box, items);
      assert.equal(result.fits, true);
      assert.ok(result.fullness_ratio > 0 && result.fullness_ratio < 0.85);
      assert.equal(result.total_gross_weight_g, 300 + 250 + box.tare_weight_g);
      assert.equal(result.violations.length, 0);
    });

    test("Applies 1.25x virtual buffer on fragile items and flags volume overflow when exceeded", () => {
      const box = STANDARD_BOXES.SMALL; // 200 x 150 x 80 = 2,400,000 mm3. 85% = 2,040,000 mm3
      // A fragile item with base volume 1,800,000 * 1.25 = 2,250,000 mm3 (> 2,040,000 mm3)
      const items = [
        { length_mm: 150, width_mm: 120, height_mm: 100, weight_g: 400, is_fragile: true, must_keep_upright: false }
      ];

      const result = evaluateHamperPacking(box, items);
      assert.equal(result.fits, false);
      assert.ok(result.violations.includes("VOLUME_EXCEEDED"));
    });

    test("Enforces upright orientation and flags HEIGHT_OVERFLOW if vertical Z dimension exceeded", () => {
      const box = STANDARD_BOXES.MEDIUM; // height is 100mm
      const items = [
        // Height 150mm cannot be placed upright
        { length_mm: 80, width_mm: 80, height_mm: 150, weight_g: 300, must_keep_upright: true }
      ];

      const result = evaluateHamperPacking(box, items);
      assert.equal(result.fits, false);
      assert.ok(result.violations.includes("HEIGHT_OVERFLOW"));
    });

    test("Flags thermal incompatibility when chilled and ambient goods share box with >6 items", () => {
      const box = STANDARD_BOXES.LARGE;
      const items = [
        { length_mm: 50, width_mm: 50, height_mm: 50, weight_g: 100, temperature_sensitive: true },
        { length_mm: 50, width_mm: 50, height_mm: 50, weight_g: 100, temperature_sensitive: false },
        { length_mm: 50, width_mm: 50, height_mm: 50, weight_g: 100, temperature_sensitive: false },
        { length_mm: 50, width_mm: 50, height_mm: 50, weight_g: 100, temperature_sensitive: false },
        { length_mm: 50, width_mm: 50, height_mm: 50, weight_g: 100, temperature_sensitive: false },
        { length_mm: 50, width_mm: 50, height_mm: 50, weight_g: 100, temperature_sensitive: false },
        { length_mm: 50, width_mm: 50, height_mm: 50, weight_g: 100, temperature_sensitive: false }
      ];

      const result = evaluateHamperPacking(box, items);
      assert.equal(result.fits, false);
      assert.ok(result.violations.includes("INCOMPATIBLE_TEMPERATURE"));
    });
  });

  // ── Algorithm 2: Deterministic Integer Paise Financial Ledger ──
  describe("Algorithm 2: Deterministic Integer Paise Financial Ledger (Zero-Float Drift)", () => {
    test("Computes exact integer paise financial ledger without float drift", () => {
      const ledger = calculateDeterministicOrderPricing({
        basePricePaise: 150000n, // ₹1,500
        items: [
          { unit_price_paise: 75000n, quantity: 2 }, // ₹1,500
          { unit_price_paise: 42000n, quantity: 1 }  // ₹420
        ],
        customizations: [
          { price_delta_paise: 12000n } // ₹120
        ],
        packagingPricePaise: 45000n, // ₹450
        coupon: null,
        shippingConfig: { base_shipping_paise: 25000n, free_threshold_paise: 299900n },
        gstRatePercent: 18
      });

      // Gross subtotal: 150000 + (75000*2) + 42000 + 12000 + 45000 = 399000 paise (₹3,990)
      assert.equal(ledger.gross_subtotal_paise, 399000n);
      assert.equal(ledger.discount_paise, 0n);
      assert.equal(ledger.net_subtotal_paise, 399000n);
      // Free shipping applies (> ₹2,999)
      assert.equal(ledger.shipping_paise, 0n);

      // Invariant: taxableAmount + cgst + sgst === netSubtotal
      const sumOfParts = ledger.taxable_amount_paise + ledger.cgst_paise + ledger.sgst_paise;
      assert.equal(sumOfParts, ledger.net_subtotal_paise);

      // Verify serialization
      const serialized = serializePricingLedger(ledger);
      assert.equal(serialized.totalPayablePaise, 399000);
      assert.equal(serialized.formatted.totalRupees, "3990.00");
    });

    test("Enforces coupon discount capping and applies standard shipping fee under threshold", () => {
      const ledger = calculateDeterministicOrderPricing({
        basePricePaise: 0n,
        items: [{ unit_price_paise: 600000n, quantity: 1 }], // ₹6,000
        coupon: {
          discount_type: "PERCENTAGE",
          discount_value: 10n, // 10% of ₹6,000 = ₹600 (60,000 paise)
          max_discount_paise: 50000n, // capped at ₹500 (50,000 paise)
          min_order_subtotal_paise: 150000n
        },
        shippingConfig: { base_shipping_paise: 25000n, free_threshold_paise: 700000n }
      });

      assert.equal(ledger.discount_paise, 50000n);
      assert.equal(ledger.net_subtotal_paise, 550000n);
      // Shipping fee applies because netSubtotal < 700,000
      assert.equal(ledger.shipping_paise, 25000n);
      assert.equal(ledger.total_payable_paise, 575000n);
      assert.equal(formatRupees(ledger.total_payable_paise), "5750.00");
    });
  });

  // ── Algorithm 3: Rule-Based Coupon DAG ──
  describe("Algorithm 3: Rule-Based Coupon Evaluation & DAG Precedence", () => {
    const engine = new CouponPrecedenceEngine();

    test("Validates ALMAS10 when minimum spend threshold met", () => {
      const evalResult = engine.evaluateCoupon({
        couponCode: "ALMAS10",
        grossSubtotalPaise: 400000n // ₹4,000
      });

      assert.equal(evalResult.valid, true);
      assert.equal(evalResult.code, "ALMAS10");
      // 10% of ₹4,000 is ₹400 (40000 paise), which is within the ₹500 cap
      assert.equal(evalResult.discountPaise, 40000n);
    });

    test("Rejects FIRST_TIME coupon if customer has previous orders", () => {
      const evalResult = engine.evaluateCoupon({
        couponCode: "WELCOME15",
        grossSubtotalPaise: 500000n,
        customerContext: { userId: "user_777", orderCount: 2 }
      });

      assert.equal(evalResult.valid, false);
      assert.equal(evalResult.reason, "RESTRICTED_TO_FIRST_TIME_PATRONS");
    });

    test("Resolves highest-value non-conflicting promotion from candidate list", () => {
      const best = engine.resolveOptimalPromotion({
        candidateCodes: ["ALMAS10", "WEDDINGVIP"],
        grossSubtotalPaise: 2000000n, // ₹20,000
        categories: ["WEDDING"]
      });

      assert.ok(best);
      assert.equal(best.code, "WEDDINGVIP"); // Flat ₹2,500 is higher than ALMAS10's capped ₹500
      assert.equal(best.discountPaise, 250000n);
    });
  });

  // ── Algorithm 4: Colloquial Intent Tokenizer & Trigram Ranker ──
  describe("Algorithm 4: Colloquial Intent Tokenizer & Trigram Fuzzy Ranking", () => {
    test("Extracts occasion, recipient, price cap, and luxury intent from natural phrase", () => {
      const intent = tokenizeSearchIntent("luxury wedding hamper for sister under ₹4000 with rich chocolates");

      assert.equal(intent.occasion, "WEDDING");
      assert.equal(intent.recipient, "SISTER");
      assert.equal(intent.maxPricePaise, 400000n);
      assert.equal(intent.isLuxury, true);
      assert.ok(intent.keywords.includes("chocolates"));
    });

    test("Computes trigram fuzzy similarity and handles typographical errors", () => {
      const simExact = computeTrigramSimilarity("artisanal chocolate", "artisanal chocolate");
      assert.equal(simExact, 1.0);

      // Typos: "artisanel choclate" vs "artisanal chocolate"
      const simTypo = computeTrigramSimilarity("artisanel choclate", "artisanal chocolate");
      assert.ok(simTypo > 0.45);
    });

    test("Ranks catalog items with fuzzy query tolerance", () => {
      const sampleCatalog = [
        { id: "1", title: "Royal Wedding Keepsake", occasion: "Wedding", description: "Luxury brass and velvet box" },
        { id: "2", title: "Midnight Wellness Box", occasion: "Birthday", description: "Bath salts and scented candle" }
      ];

      const ranked = rankItemsByFuzzyQuery(sampleCatalog, "wedding gift for sister");
      assert.ok(ranked.length > 0);
      assert.equal(ranked[0].id, "1");
      assert.ok(ranked[0]._searchScore > 0.3);
    });
  });

  // ── Algorithm 5: Multi-Criteria Budget Knapsack ──
  describe("Algorithm 5: Multi-Criteria Budget Matching & Knapsack Optimization", () => {
    test("Recommends optimal container and items adhering to budget and fullness constraints", () => {
      const result = optimizeHamperForBudget({
        targetBudgetPaise: 400000n // ₹4,000 budget
      });

      assert.equal(result.success, true);
      assert.ok(result.items.length >= 2);
      assert.ok(result.totalPricePaise <= 400000);
      assert.ok(result.fullnessRatio >= 0.3);
      assert.ok(result.averageHarmonyScore >= 80);
    });
  });

  // ── Algorithm 6: Atomic Inventory Lock Engine ──
  describe("Algorithm 6: Atomic Inventory Allocation & Pessimistic Lock Engine", () => {
    const lockEngine = new AtomicInventoryLockEngine(60);

    before(() => {
      lockEngine.setStock("SKU_AMBER_CANDLE", 5);
      lockEngine.setStock("SKU_DARK_CHOCO", 10);
    });

    test("Acquires atomic multi-item reservation and decrements available pool", async () => {
      const res = await lockEngine.acquireReservation({
        orderId: "ORDER_TEST_001",
        sessionId: "sess_123",
        items: [
          { sku: "SKU_AMBER_CANDLE", quantity: 2 },
          { sku: "SKU_DARK_CHOCO", quantity: 3 }
        ]
      });

      assert.equal(res.success, true);
      assert.equal(lockEngine.getStock("SKU_AMBER_CANDLE"), 3);
      assert.equal(lockEngine.getStock("SKU_DARK_CHOCO"), 7);
    });

    test("Rejects reservation when stock is insufficient and preserves existing levels", async () => {
      const res = await lockEngine.acquireReservation({
        orderId: "ORDER_TEST_FAIL",
        sessionId: "sess_456",
        items: [
          { sku: "SKU_AMBER_CANDLE", quantity: 10 } // Only 3 left
        ]
      });

      assert.equal(res.success, false);
      assert.equal(res.error, "INSUFFICIENT_STOCK");
      assert.equal(lockEngine.getStock("SKU_AMBER_CANDLE"), 3);
    });

    test("Releases reservation and restores stock upon abandonment", () => {
      const restored = lockEngine.releaseReservation("ORDER_TEST_001");
      assert.equal(restored, true);
      assert.equal(lockEngine.getStock("SKU_AMBER_CANDLE"), 5);
      assert.equal(lockEngine.getStock("SKU_DARK_CHOCO"), 10);
    });
  });

  // ── Algorithm 7: Omnichannel Lead Priority Queue ──
  describe("Algorithm 7: Lead Scoring & Binary Priority Queue Scheduler", () => {
    test("Scores bulk wedding lead into Tier 1 (P1) with instant concierge routing", () => {
      const evaluation = scoreInboundLead({
        message: "We need 50 wedding hampers for a destination wedding in Udaipur",
        budgetRupees: 75000,
        channel: "WHATSAPP",
        quantity: 50
      });

      assert.equal(evaluation.tier, "P1");
      assert.ok(evaluation.score >= 85);
      assert.equal(evaluation.routingAction, "INSTANT_HUMAN_ATELIER_CONCIERGE_DISPATCH");
    });

    test("Maintains binary max-heap invariant across lead priority insertions and pop operations", () => {
      const queue = new LeadPriorityQueue();

      queue.insert({ id: "lead_low", message: "Hi just browsing the catalog", budgetRupees: 500 });
      queue.insert({ id: "lead_urgent", message: "Need 25 corporate hampers urgently", budgetRupees: 50000 });
      queue.insert({ id: "lead_mid", message: "Looking for birthday gift for my wife", budgetRupees: 3500 });

      assert.equal(queue.size(), 3);
      const top = queue.peekHighest();
      assert.equal(top.lead.id, "lead_urgent");

      const popped = queue.popHighest();
      assert.equal(popped.lead.id, "lead_urgent");
      assert.equal(queue.size(), 2);
    });
  });

  // ── Algorithm 8: Dynamic Pincode SLA Resolver ──
  describe("Algorithm 8: Dynamic Pincode SLA, Dispatch Distance & Delivery Interval", () => {
    test("Resolves Delhi Metro Air zone with 2-day delivery SLA", () => {
      const sla = resolveDeliverySla({
        pincode: "110001",
        orderTimestamp: new Date("2026-11-18T10:00:00Z"), // 10 AM UTC (before 2 PM IST cutoff)
        isBespokePersonalization: false
      });

      assert.equal(sla.isServiceable, true);
      assert.equal(sla.zone, "METRO_AIR");
      assert.equal(sla.expressAirEligible, true);
      assert.ok(sla.timelines.dispatchDate);
      assert.ok(sla.timelines.latestDeliveryDate);
    });

    test("Applies 24h bespoke personalization buffer and 14:00 IST cutoff delay", () => {
      // 10:00 UTC = 15:30 IST (after 14:00 cutoff)
      const sla = resolveDeliverySla({
        pincode: "400001",
        orderTimestamp: new Date("2026-11-18T10:00:00Z"),
        isBespokePersonalization: true // +2 days prep instead of 1
      });

      assert.equal(sla.isServiceable, true);
      assert.equal(sla.timelines.cutoffApplied, true);
      // Total prep days = 2 (bespoke) + 1 (cutoff) = 3 days
      assert.equal(sla.timelines.prepLeadDays, 3);
    });

    test("Rejects invalid PIN code format", () => {
      const sla = resolveDeliverySla({ pincode: "099999" });
      assert.equal(sla.isServiceable, false);
      assert.equal(sla.error, "INVALID_PINCODE_FORMAT");
    });
  });

  // ── Atelier Procedural Preview Visualizer ──
  describe("Atelier Procedural Luxury SVG & Visual Preview Generator", () => {
    test("Generates valid vector SVG markup with custom ribbon, wax seal monogram, and calligraphy card", () => {
      const svg = generateHamperPreviewSvg({
        boxId: "BOX_LINEN_KEEPSAKE",
        ribbonColor: "champagne_gold",
        waxSealColor: "vintage_gold",
        monogramInitials: "AS",
        cardMessage: "Wishing you a lifetime of joy and happiness.",
        recipientName: "Aarav"
      });

      assert.ok(svg.startsWith("<?xml"));
      assert.ok(svg.includes("<svg"));
      assert.ok(svg.includes("Aarav"));
      assert.ok(svg.includes("AS")); // Monogram initials
      assert.ok(svg.includes("#C89D42")); // Champagne Gold color
    });

    test("Generates Base64 Data URI for image rendering", () => {
      const dataUri = generateHamperPreviewDataUri({
        monogramInitials: "HBH"
      });

      assert.ok(dataUri.startsWith("data:image/svg+xml;base64,"));
    });
  });

  // ── REST API Integration Verification ──
  describe("REST API Endpoints for DSA & Visualizer", () => {
    test("POST /api/v1/dsa/bin-packing returns 3D packing evaluation", async () => {
      const res = await fetch(`${baseUrl}/dsa/bin-packing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boxSizeKey: "MEDIUM",
          items: [{ length_mm: 80, width_mm: 60, height_mm: 40, weight_g: 200 }]
        })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.evaluation.fits, true);
    });

    test("POST /api/v1/dsa/pricing-ledger returns serialized BigInt breakdown", async () => {
      const res = await fetch(`${baseUrl}/dsa/pricing-ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basePricePaise: 200000,
          items: [{ unit_price_paise: 50000, quantity: 2 }]
        })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.totalPayablePaise, 300000);
      assert.equal(data.data.formatted.totalRupees, "3000.00");
    });

    test("POST /api/v1/dsa/search-intent tokenizes natural query", async () => {
      const res = await fetch(`${baseUrl}/dsa/search-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "luxury anniversary gift under 5000 for wife",
          rankCatalog: true
        })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.intent.occasion, "ANNIVERSARY");
      assert.equal(data.data.intent.recipient, "WIFE");
      assert.equal(data.data.intent.maxPricePaise, 500000);
      assert.ok(Array.isArray(data.data.rankedResults));
    });

    test("POST /api/v1/dsa/budget-knapsack returns optimized hamper recommendation", async () => {
      const res = await fetch(`${baseUrl}/dsa/budget-knapsack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetBudgetPaise: 500000
        })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.data.items.length >= 2);
    });

    test("POST /api/v1/atelier/visualize-hamper generates SVG and Data URI preview", async () => {
      const res = await fetch(`${baseUrl}/atelier/visualize-hamper`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boxId: "BOX_VELVET_CHEST",
          ribbonColor: "burgundy_merlot",
          waxSealColor: "vintage_gold",
          monogramInitials: "RH"
        })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.data.svg.includes("<svg"));
      assert.ok(data.data.dataUri.startsWith("data:image/svg+xml;base64,"));
    });
  });

});
