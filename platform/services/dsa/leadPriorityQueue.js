/**
 * HAMPERS BY HER — MULTI-CHANNEL LEAD SCORING & BINARY PRIORITY QUEUE SCHEDULER
 * 
 * Formal Specification Reference: 39_DSA.md Section 7.7 (Algorithm 7)
 * Implements deterministic lead scoring and a Binary Max-Heap for real-time lead routing.
 * Time Complexity: O(1) score calculation, O(log L) heap insert/pop, O(1) peek
 * Space Complexity: O(L)
 */

const BULK_INTENT_KEYWORDS = [
  "wedding hampers", "corporate bulk", "50 pieces", "100 hampers", "bulk order",
  "corporate gifting", "wedding favors", "trousseau packing", "50 units", "100 units"
];

const STANDARD_INTENT_KEYWORDS = [
  "anniversary", "birthday", "custom hamper", "bespoke box", "gift for wife", "gift for sister"
];

/**
 * Computes deterministic lead score (0 to 100)
 * @param {Object} lead
 * @param {string} lead.message
 * @param {number} [lead.budgetRupees=0]
 * @param {number} [lead.requiredDeliveryHours=168]
 * @param {string} [lead.channel="WHATSAPP"] "WHATSAPP" | "INSTAGRAM"
 * @param {boolean} [lead.isReturningCustomer=false]
 * @param {number} [lead.quantity=1]
 * @returns {Object} { score: number, tier: 'P1'|'P2'|'P3', breakdown: Object }
 */
function scoreInboundLead(lead) {
  const msg = (lead.message || "").toLowerCase();
  const budget = lead.budgetRupees || 0;
  const hours = lead.requiredDeliveryHours !== undefined ? lead.requiredDeliveryHours : 168; // default 7 days
  const channel = (lead.channel || "WHATSAPP").toUpperCase();
  const isReturning = Boolean(lead.isReturningCustomer);
  const qty = lead.quantity || 1;

  let intentScore = 10;
  let isBulkEscalation = false;

  // 1. Intent Analysis
  for (const kw of BULK_INTENT_KEYWORDS) {
    if (msg.includes(kw) || qty >= 20) {
      intentScore = 35;
      isBulkEscalation = true;
      break;
    }
  }

  if (!isBulkEscalation) {
    for (const kw of STANDARD_INTENT_KEYWORDS) {
      if (msg.includes(kw)) {
        intentScore = 20;
        break;
      }
    }
  }

  // 2. Budget Score
  let budgetScore = 5;
  if (budget >= 10000 || (qty * 1500 >= 10000)) {
    budgetScore = 30;
    isBulkEscalation = true;
  } else if (budget >= 5000) {
    budgetScore = 15;
  }

  // 3. Urgency Score
  let urgencyScore = 5;
  if (hours <= 48) {
    urgencyScore = 20;
  } else if (hours <= 96) {
    urgencyScore = 10;
  }

  // 4. Channel Affinity
  const channelScore = channel === "WHATSAPP" ? 10 : 5;

  // 5. Customer Loyalty
  const loyaltyScore = isReturning ? 15 : 0;

  let totalScore = intentScore + budgetScore + urgencyScore + channelScore + loyaltyScore;

  // Lead Escalation Invariant (BR-DSA-05): Bulk orders or spend > ₹10,000 must receive >= 85
  if (isBulkEscalation && totalScore < 85) {
    totalScore = 85;
  }

  totalScore = Math.min(100, Math.max(0, totalScore));

  let tier = "P3";
  let routingAction = "AUTOMATED_CATALOG_BROADCAST";

  if (totalScore >= 70) {
    tier = "P1";
    routingAction = "INSTANT_HUMAN_ATELIER_CONCIERGE_DISPATCH";
  } else if (totalScore >= 40) {
    tier = "P2";
    routingAction = "INTERACTIVE_BOT_QUALIFICATION_FLOW";
  }

  return {
    score: totalScore,
    tier,
    routingAction,
    isBulkEscalation,
    breakdown: {
      intentScore,
      budgetScore,
      urgencyScore,
      channelScore,
      loyaltyScore
    }
  };
}

/**
 * High-performance Binary Max-Heap priority queue for real-time lead routing
 */
class LeadPriorityQueue {
  constructor() {
    this.heap = []; // array of { id, score, tier, lead, timestamp }
  }

  size() {
    return this.heap.length;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  /**
   * Enqueues a new lead into the binary max-heap: O(log L)
   * @param {Object} lead
   * @returns {Object} Evaluated lead item
   */
  insert(lead) {
    const evaluation = scoreInboundLead(lead);
    const node = {
      id: lead.id || `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      score: evaluation.score,
      tier: evaluation.tier,
      routingAction: evaluation.routingAction,
      isBulkEscalation: evaluation.isBulkEscalation,
      lead,
      timestamp: Date.now()
    };

    this.heap.push(node);
    this._bubbleUp(this.heap.length - 1);
    return node;
  }

  /**
   * Peeks the highest priority lead without removing it: O(1)
   * @returns {Object|null}
   */
  peekHighest() {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  /**
   * Extracts and returns the highest priority lead: O(log L)
   * @returns {Object|null}
   */
  popHighest() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this._bubbleDown(0);
    }
    return top;
  }

  /**
   * Bubbles up an element at index to maintain heap invariant
   * @private
   */
  _bubbleUp(index) {
    let curr = index;
    while (curr > 0) {
      const parent = Math.floor((curr - 1) / 2);
      if (this._compare(this.heap[curr], this.heap[parent]) > 0) {
        // Swap
        [this.heap[curr], this.heap[parent]] = [this.heap[parent], this.heap[curr]];
        curr = parent;
      } else {
        break;
      }
    }
  }

  /**
   * Bubbles down an element at index to maintain heap invariant
   * @private
   */
  _bubbleDown(index) {
    let curr = index;
    const len = this.heap.length;

    while (true) {
      const left = 2 * curr + 1;
      const right = 2 * curr + 2;
      let largest = curr;

      if (left < len && this._compare(this.heap[left], this.heap[largest]) > 0) {
        largest = left;
      }
      if (right < len && this._compare(this.heap[right], this.heap[largest]) > 0) {
        largest = right;
      }

      if (largest !== curr) {
        [this.heap[curr], this.heap[largest]] = [this.heap[largest], this.heap[curr]];
        curr = largest;
      } else {
        break;
      }
    }
  }

  /**
   * Compares two nodes: higher score wins; tie-breaker: older timestamp wins
   * @private
   */
  _compare(a, b) {
    if (a.score !== b.score) {
      return a.score - b.score;
    }
    return b.timestamp - a.timestamp; // earlier timestamp has priority
  }
}

module.exports = {
  scoreInboundLead,
  LeadPriorityQueue
};
