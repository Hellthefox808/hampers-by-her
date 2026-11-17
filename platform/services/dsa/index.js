/**
 * HAMPERS BY HER — UNIFIED DSA & COMPUTATIONAL ENGINES FACADE
 * 
 * Formal Specification Reference: 39_DSA.md
 * Integrates all 8 foundational computational engines:
 * 1. Hamper 3D Volumetric Bin-Packing & Physical Compatibility Heuristic
 * 2. Deterministic Server-Side Cart & Custom Hamper Pricing Ledger (BigInt Paise)
 * 3. Rule-Based Coupon Evaluation & Discount Precedence Engine (DAG)
 * 4. Faceted Search, Colloquial Intent Tokenizer & Trigram Fuzzy Ranking
 * 5. Multi-Criteria Budget Matching & Knapsack Optimization
 * 6. Atomic Inventory Allocation & Pessimistic Concurrency Lock Engine
 * 7. Multi-Channel Lead Scoring & Binary Priority Queue Scheduler
 * 8. Dynamic Pincode SLA, Dispatch Distance & Delivery Interval Resolver
 */

const { STANDARD_BOXES, evaluateHamperPacking } = require("./binPacker3D");
const { toPaiseBigInt, formatRupees, calculateDeterministicOrderPricing, serializePricingLedger } = require("./pricingLedger");
const { ACTIVE_PROMOTIONAL_RULES, CouponPrecedenceEngine } = require("./couponDAG");
const { tokenizeSearchIntent, computeTrigramSimilarity, rankItemsByFuzzyQuery } = require("./intentTokenizer");
const { CATALOG_COMPONENTS_POOL, optimizeHamperForBudget } = require("./budgetKnapsack");
const { AtomicInventoryLockEngine } = require("./atomicInventoryLock");
const { scoreInboundLead, LeadPriorityQueue } = require("./leadPriorityQueue");
const { PINCODE_ZONE_MAP, resolveDeliverySla } = require("./logisticsSlaResolver");

// Singleton shared instances for in-process caching & queues
const couponEngine = new CouponPrecedenceEngine();
const inventoryLockEngine = new AtomicInventoryLockEngine();
const leadPriorityQueue = new LeadPriorityQueue();

module.exports = {
  // 1. Bin Packing
  STANDARD_BOXES,
  evaluateHamperPacking,

  // 2. Pricing Ledger
  toPaiseBigInt,
  formatRupees,
  calculateDeterministicOrderPricing,
  serializePricingLedger,

  // 3. Coupon DAG
  ACTIVE_PROMOTIONAL_RULES,
  CouponPrecedenceEngine,
  couponEngine,

  // 4. Search & Intent Tokenizer
  tokenizeSearchIntent,
  computeTrigramSimilarity,
  rankItemsByFuzzyQuery,

  // 5. Budget Knapsack
  CATALOG_COMPONENTS_POOL,
  optimizeHamperForBudget,

  // 6. Atomic Inventory Lock
  AtomicInventoryLockEngine,
  inventoryLockEngine,

  // 7. Lead Priority Queue
  scoreInboundLead,
  LeadPriorityQueue,
  leadPriorityQueue,

  // 8. Logistics SLA Resolver
  PINCODE_ZONE_MAP,
  resolveDeliverySla
};
