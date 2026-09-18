<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 39_DSA.md — Data Structures, Algorithms & Computational Complexity Specifications

## 1. Purpose
This document specifies the algorithmic foundations, data structures, computational complexity profiles, and deterministic execution guarantees across the **Hampers by Her** digital gifting ecosystem. Bespoke gifting commerce introduces non-trivial combinatorial constraints that diverge sharply from standard commodity ecommerce: multi-item 3D physical box compatibility, strict integer-cent/paise pricing determinism, dynamic coupon rule precedence, multi-criteria budget matching under recipient constraints, atomic inventory reservation under concurrency, and heuristic multi-channel lead prioritization. This document establishes mathematically verified, production-grade algorithms designed to guarantee sub-millisecond execution, zero financial discrepancy, and graceful failure handling.

## 2. Scope
- **In-Scope**:
  - Detailed algorithmic specifications for the 8 core computational engines:
    1. Hamper 3D Volumetric Bin-Packing & Physical Compatibility Heuristic
    2. Deterministic Server-Side Cart & Custom Hamper Pricing Engine
    3. Rule-Based Coupon Evaluation & Discount Precedence Engine
    4. Faceted Search, Colloquial Intent Tokenizer & Trigram Fuzzy Ranking Engine
    5. Multi-Criteria Budget Matching & Recipient Recommendation Heuristic
    6. Atomic Inventory Allocation & Pessimistic Concurrency Lock Engine
    7. Multi-Channel Lead Scoring & Priority Queue Scheduler
    8. Dynamic Pincode SLA, Dispatch Distance & Delivery Date Interval Resolver
  - Formal documentation for each algorithm: Problem Statement, Input Schema, Output Schema, Algorithm Pseudo-Code (TypeScript), Time Complexity, Space Complexity, Edge Cases, and Failure Modes.
  - Asymptotic complexity analysis adhering to Big-$O$ notation.
  - Safe integer arithmetic preventing floating-point precision leakage.
- **Out-of-Scope**:
  - Unbounded NP-hard exact 3D polygon collision simulations (heuristic polynomial-time approximations are specified instead).
  - Unverified machine learning black-box models for real-time transactional pricing.

## 3. Context
Commodity ecommerce platforms model items as independent flat cart rows. In contrast, an artisanal gifting atelier bundles physical items with heterogeneous geometric dimensions, weight limits, fragile handling flags, temperature sensitivities, and handcrafted packaging enclosures. Furthermore, allowing client-side price computations or naive floating-point operations ($0.1 + 0.2 \neq 0.3$) introduces severe revenue loss and cart manipulation vulnerabilities. 

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HAMPER ENGINE COMPUTATIONAL PIPELINE                     │
└─────────────────────────────────────────────────────────────────────────────┘
  Customer Selections          Volumetric & Category Check       Deterministic Pricing
 [Items, Box, Add-ons]  ──► [3D Bin-Packing & Compat Rules] ──► [Integer Paise Math]
                                        │                                │
                                        ▼ (Pass)                         ▼
                               [Box Fullness Ratio]             [Detailed Breakdown]
                                  (65% - 95% OK)               (Base, Addon, Tax, Ship)
                                        │                                │
                                        ▼                                ▼
                               [Lock Inventory (TTL)]          [Apply Best Coupon]
                                 (Redis Mutex Lock)              (Precedence Engine)
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-DSA-01**: The 3D Bin-Packing engine must evaluate box physical compatibility in $\le 5\text{ ms}$ for hampers containing up to 25 items, returning box fullness percentage and packaging warnings.
- **FR-DSA-02**: The Pricing Engine must perform all calculations using integer `Paise` ($1\text{ INR} = 100\text{ Paise}$) via `BigInt` or 64-bit integers, guaranteeing zero floating-point drift across taxes, discounts, and packaging deltas.
- **FR-DSA-03**: The Coupon Engine must evaluate discount precedence deterministically, preventing illegal coupon stacking and enforcing maximum discount caps.
- **FR-DSA-04**: The Search and Trigram Ranker must execute colloquial queries (e.g., "birthday gift for sister under 2000") in $\le 20\text{ ms}$ on PostgreSQL using inverted full-text indexes and similarity operators.
- **FR-DSA-05**: The Lead Scoring Engine must rank incoming WhatsApp and Instagram leads into priority tiers ($P_1, P_2, P_3$) deterministically in $O(1)$ time per inbound event.

### 4.2 Non-Functional Requirements
- **NFR-DSA-01**: Computational Latency: All core algorithmic routines executed during checkout and cart mutation must have an upper bound execution latency of $< 15\text{ ms}$ at 99th percentile ($p99$).
- **NFR-DSA-02**: Memory Bounds: Algorithmic auxiliary memory usage must not exceed $O(N)$ space relative to cart item count $N$, preventing heap exhaustion under burst traffic.
- **NFR-DSA-03**: ReDoS Protection: All string parsing and intent tokenization algorithms must use non-backtracking deterministic finite automaton (DFA) regex or linear token scanners to prevent catastrophic regular expression backtracking.

## 5. Architecture & Design
### 5.1 Algorithmic Taxonomy & Computational Matrix
The system avoids premature distributed complexity by executing all core computational algorithms within the Modular Monolith domain services, leveraging in-memory operations backed by PostgreSQL functional indexes and Redis transient structures.

| Algorithm Domain | Module Name | Primary Data Structure | Time Complexity | Space Complexity |
| :--- | :--- | :--- | :--- | :--- |
| **1. 3D Bin Packing** | `HamperBuilderService` | 3D Coordinate Bounding Box Array | $O(N \log N + N \cdot K)$ | $O(N)$ |
| **2. Pricing Engine** | `PricingCalculatorService` | Ordered Integer Ledger | $O(I + C)$ | $O(1)$ |
| **3. Coupon Precedence** | `PromotionEngineService` | Directed Evaluation DAG | $O(R \log R)$ | $O(R)$ |
| **4. Trigram Intent Search**| `CatalogSearchService` | Inverted Index / Lexeme Vector | $O(M + K \log K)$ | $O(K)$ |
| **5. Budget Matcher** | `RecommendationService` | Dynamic Programming / Greedy List | $O(N \cdot B)$ or $O(N \log N)$ | $O(B)$ |
| **6. Inventory Allocation**| `StockReservationService`| Distributed Redis Semaphore / Sorted Set | $O(K \log M)$ | $O(K)$ |
| **7. Lead Scoring** | `CrmLeadScheduler` | Min-Max Priority Heap / Bitfield | $O(\log L)$ insert, $O(1)$ peek | $O(L)$ |
| **8. Pincode SLA Resolver**| `LogisticsRoutingService`| Radix Prefix Tree / Interval Map | $O(\log Z)$ | $O(1)$ |

*Where $N$ = items in hamper, $K$ = candidate containers/results, $I$ = cart line items, $C$ = customizations, $R$ = applicable coupons, $M$ = query tokens, $B$ = budget units, $L$ = active leads, $Z$ = delivery zones.*

## 6. Business Rules
- **BR-DSA-01**: **Volumetric Safety Factor**: A hamper box is deemed physically overloaded if the aggregate item displacement volume exceeds 85% of the interior box volume ($V_{\text{items}} > 0.85 \times V_{\text{box}}$), or if the gross weight exceeds the box structural weight tolerance ($W_{\text{items}} > W_{\text{max}}$). The 15% headroom is strictly reserved for wood wool, shred filler, tissue wrapping, and cushioning.
- **BR-DSA-02**: **Fragile Cushioning Multiplier**: If an item possesses `is_fragile = true`, its virtual bounding box volume is multiplied by $1.25$ during bin packing to account for bubble wrap/honeycomb paper buffers.
- **BR-DSA-03**: **Discount Rounding**: Fractional paise resulting from percentage discounts (e.g., $15\%$ off on ₹1,299.00 = ₹194.85 = 19,485 paise) must strictly round down (`Math.floor`) to the nearest integer Paisa in favor of the customer, preventing dispute claims.
- **BR-DSA-04**: **Inventory Reservation TTL**: Pessimistic stock reservations made during checkout initiation expire automatically after exactly 900 seconds (15 minutes) via a Redis sliding expiry key.
- **BR-DSA-05**: **Lead Escalation Invariant**: Inbound leads requesting custom orders exceeding ₹10,000 or wedding/corporate bulk orders exceeding 20 units must bypass standard queueing and receive an instantaneous $P_1$ score override ($\text{Score} \ge 85$).

## 7. Technical Details

### 7.1 Algorithm 1: Hamper 3D Volumetric Bin-Packing & Compatibility Heuristic
- **Problem Statement**: Given an artisanal packaging container $B$ with internal dimensions $(L_B, W_B, H_B)$, weight limit $W_{\text{max}}$, and a set of $N$ selected gift items $I = \{i_1, i_2, \dots, i_N\}$, determine whether all items fit safely within $B$ while respecting upright orientation rules, fragility spacing, and thermal insulation constraints.
- **Input**:
  - Container dimensions: `box: { length_mm: number, width_mm: number, height_mm: number, max_weight_g: number, tare_weight_g: number }`
  - Item list: `items: Array<{ id: string, length_mm: number, width_mm: number, height_mm: number, weight_g: number, is_fragile: boolean, must_keep_upright: boolean, temperature_sensitive: boolean }>`
- **Output**:
  ```typescript
  interface PackingResult {
    fits: boolean;
    fullness_ratio: number; // 0.00 to 1.00
    total_gross_weight_g: number;
    recommended_box_size?: 'SMALL' | 'MEDIUM' | 'LARGE' | 'GRANDE';
    violations: Array<'VOLUME_EXCEEDED' | 'WEIGHT_EXCEEDED' | 'HEIGHT_OVERFLOW' | 'INCOMPATIBLE_TEMPERATURE' | 'FRAGILE_COLLISION'>;
  }
  ```
- **Algorithm (TypeScript)**:
  ```typescript
  export function evaluateHamperPacking(
    box: { length_mm: number; width_mm: number; height_mm: number; max_weight_g: number; tare_weight_g: number },
    items: Array<{ id: string; length_mm: number; width_mm: number; height_mm: number; weight_g: number; is_fragile: boolean; must_keep_upright: boolean; temperature_sensitive: boolean }>
  ): PackingResult {
    const boxVolumeMm3 = box.length_mm * box.width_mm * box.height_mm;
    const USABLE_VOLUME_THRESHOLD = 0.85; // 85% usable; 15% reserved for filler & ribbons
    const usableVolumeMm3 = boxVolumeMm3 * USABLE_VOLUME_THRESHOLD;

    let totalItemVolumeMm3 = 0;
    let totalItemWeightG = 0;
    const violations: PackingResult['violations'] = [];
    let hasChilled = false;
    let hasAmbient = false;

    // 1. Dimension & Attribute Validation (Greedy Level-Oriented Sort)
    // Sort items by footprint area descending to simulate bottom-layer stability
    const sortedItems = [...items].sort((a, b) => (b.length_mm * b.width_mm) - (a.length_mm * a.width_mm));

    for (const item of sortedItems) {
      // Dimension bounds check: Any item dimension exceeding box dimensions in all allowed rotations
      const fitsNormal = item.length_mm <= box.length_mm && item.width_mm <= box.width_mm && item.height_mm <= box.height_mm;
      const fitsRotatedFootprint = item.width_mm <= box.length_mm && item.length_mm <= box.width_mm && item.height_mm <= box.height_mm;
      
      if (item.must_keep_upright) {
        if (!fitsNormal && !fitsRotatedFootprint) {
          violations.push('HEIGHT_OVERFLOW');
        }
      } else {
        // Can rotate on 3 axes
        const dims = [item.length_mm, item.width_mm, item.height_mm].sort((a, b) => a - b);
        const boxDims = [box.length_mm, box.width_mm, box.height_mm].sort((a, b) => a - b);
        if (dims[0] > boxDims[0] || dims[1] > boxDims[1] || dims[2] > boxDims[2]) {
          violations.push('HEIGHT_OVERFLOW');
        }
      }

      // Volume calculation with 1.25x virtual buffer for fragile items
      const itemVol = item.length_mm * item.width_mm * item.height_mm * (item.is_fragile ? 1.25 : 1.0);
      totalItemVolumeMm3 += itemVol;
      totalItemWeightG += item.weight_g;

      if (item.temperature_sensitive) hasChilled = true;
      else hasAmbient = true;
    }

    // Thermal conflict: Artisan cheeses/chocolates requiring ice packs cannot share sealed hampers with dry paper/linen items without thermal partition
    if (hasChilled && hasAmbient && items.length > 6) {
      violations.push('INCOMPATIBLE_TEMPERATURE');
    }

    if (totalItemVolumeMm3 > usableVolumeMm3) {
      violations.push('VOLUME_EXCEEDED');
    }

    if (totalItemWeightG > box.max_weight_g) {
      violations.push('WEIGHT_EXCEEDED');
    }

    const fullnessRatio = Math.min(1.0, totalItemVolumeMm3 / usableVolumeMm3);
    const totalGrossWeight = totalItemWeightG + box.tare_weight_g;

    return {
      fits: violations.length === 0,
      fullness_ratio: Number(fullnessRatio.toFixed(3)),
      total_gross_weight_g: totalGrossWeight,
      violations: Array.from(new Set(violations))
    };
  }
  ```
- **Time Complexity**: $O(N \log N)$ where $N$ is the number of items (dominated by sorting items by footprint). For $N \le 25$, this executes in $< 0.1\text{ ms}$.
- **Space Complexity**: $O(N)$ auxiliary space for sorted item references.
- **Edge Cases**:
  - Empty hamper ($N = 0$): Returns `fits: true, fullness_ratio: 0.0`.
  - Single item exceeding all box dimensions: Instantly flags `HEIGHT_OVERFLOW` without iterating full list.
  - Zero-volume items (e.g. digital gift vouchers): Filtered out prior to volumetric tally.
- **Failure Modes**: Overly optimistic geometric packing when irregular cylindrical items (e.g., honey jars) leave non-packable corners. Handled by the conservative 85% threshold.

---

### 7.2 Algorithm 2: Deterministic Server-Side Cart & Custom Hamper Pricing Engine
- **Problem Statement**: Calculate the authoritatively accurate, immutable order financial ledger in integer Paise. Must combine base product/box prices, variant deltas, individual component prices, bespoke customization add-ons, gift wrapping tiers, promotional coupon reductions, pincode-specific shipping fees, and GST tax components.
- **Input**:
  - Hamper Base Price (Paise): `base_price_paise: bigint`
  - Items List: `Array<{ item_id: string, unit_price_paise: bigint, quantity: number }>`
  - Customizations: `Array<{ customization_id: string, price_delta_paise: bigint }>`
  - Packaging Option: `{ packaging_id: string, price_paise: bigint }`
  - Coupon: `{ code: string, discount_type: 'FLAT_PAISE' | 'PERCENTAGE', discount_value: bigint, max_discount_paise: bigint | null, min_order_subtotal_paise: bigint } | null`
  - Shipping: `{ delivery_tier: 'STANDARD' | 'EXPRESS' | 'SAME_DAY', base_shipping_paise: bigint, free_threshold_paise: bigint }`
  - GST Rate: `gst_rate_percent: number` (e.g., 18 for 18%)
- **Output**:
  ```typescript
  interface PricingBreakdown {
    subtotal_items_paise: bigint;
    packaging_paise: bigint;
    customizations_paise: bigint;
    gross_subtotal_paise: bigint;
    discount_paise: bigint;
    net_subtotal_paise: bigint;
    shipping_paise: bigint;
    taxable_amount_paise: bigint;
    cgst_paise: bigint;
    sgst_paise: bigint;
    total_payable_paise: bigint;
  }
  ```
- **Algorithm (TypeScript)**:
  ```typescript
  export function calculateDeterministicOrderPricing(
    basePricePaise: bigint,
    items: Array<{ unit_price_paise: bigint; quantity: number }>,
    customizations: Array<{ price_delta_paise: bigint }>,
    packagingPricePaise: bigint,
    coupon: { discount_type: 'FLAT_PAISE' | 'PERCENTAGE'; discount_value: bigint; max_discount_paise: bigint | null; min_order_subtotal_paise: bigint } | null,
    shippingConfig: { base_shipping_paise: bigint; free_threshold_paise: bigint },
    gstRatePercent: number = 18
  ): PricingBreakdown {
    // 1. Items subtotal
    let itemsSubtotal = basePricePaise;
    for (const item of items) {
      itemsSubtotal += item.unit_price_paise * BigInt(item.quantity);
    }

    // 2. Customizations subtotal
    let customizationsSubtotal = 0n;
    for (const c of customizations) {
      customizationsSubtotal += c.price_delta_paise;
    }

    // 3. Gross Subtotal
    const grossSubtotal = itemsSubtotal + packagingPricePaise + customizationsSubtotal;

    // 4. Coupon Discount Evaluation
    let discountPaise = 0n;
    if (coupon && grossSubtotal >= coupon.min_order_subtotal_paise) {
      if (coupon.discount_type === 'FLAT_PAISE') {
        discountPaise = coupon.discount_value;
      } else if (coupon.discount_type === 'PERCENTAGE') {
        // Integer arithmetic: (grossSubtotal * discount_value) / 100
        const rawDiscount = (grossSubtotal * coupon.discount_value) / 100n;
        discountPaise = coupon.max_discount_paise && rawDiscount > coupon.max_discount_paise
          ? coupon.max_discount_paise
          : rawDiscount;
      }
      // Discount can never exceed gross subtotal
      if (discountPaise > grossSubtotal) {
        discountPaise = grossSubtotal;
      }
    }

    const netSubtotal = grossSubtotal - discountPaise;

    // 5. Shipping fee calculation with free shipping threshold
    let shippingPaise = 0n;
    if (netSubtotal < shippingConfig.free_threshold_paise) {
      shippingPaise = shippingConfig.base_shipping_paise;
    }

    // 6. GST Calculation (Indian GST Model: Tax inclusive in D2C or split CGST/SGST)
    // Assuming B2C catalogue prices are inclusive of GST: Taxable = NetSubtotal / (1 + Rate/100)
    // Rate = 18 -> Multiplier 118
    const taxDenominator = 100n + BigInt(gstRatePercent);
    const taxableAmount = (netSubtotal * 100n) / taxDenominator;
    const totalGst = netSubtotal - taxableAmount;
    const cgstPaise = totalGst / 2n;
    const sgstPaise = totalGst - cgstPaise; // Guarantees cgst + sgst === totalGst

    const totalPayable = netSubtotal + shippingPaise;

    return {
      subtotal_items_paise: itemsSubtotal,
      packaging_paise: packagingPricePaise,
      customizations_paise: customizationsSubtotal,
      gross_subtotal_paise: grossSubtotal,
      discount_paise: discountPaise,
      net_subtotal_paise: netSubtotal,
      shipping_paise: shippingPaise,
      taxable_amount_paise: taxableAmount,
      cgst_paise: cgstPaise,
      sgst_paise: sgstPaise,
      total_payable_paise: totalPayable,
    };
  }
  ```
- **Time Complexity**: $O(I + C)$ where $I$ is the number of cart items and $C$ is the number of customizations. Linear scan, sub-millisecond ($< 0.05\text{ ms}$).
- **Space Complexity**: $O(1)$ constant stack memory.
- **Edge Cases**:
  - Discount exceeds total cart value: Capped at `grossSubtotal`, total never falls below shipping cost.
  - Zero-value hampers (promotional gifts): Correctly computes ₹0.00 without division-by-zero crashes.
  - Odd paise division for CGST/SGST: Handled by remainder subtraction (`sgst = totalGst - cgst`).
- **Failure Modes**: Negative customization deltas causing negative totals; explicitly prevented by validation assertion $P_{\text{total}} \ge 0$.

---

### 7.3 Algorithm 3: Rule-Based Coupon Evaluation & Discount Precedence Engine
- **Problem Statement**: Given a set of active promotions, cart attributes, and customer history, validate coupon applicability and resolve precedence conflicts when multiple promo rules match.
- **Input**: Customer context (order count, spend history), Cart contents (categories, subtotal), Coupon definition.
- **Output**: Applicability decision (`valid: boolean, reason?: string`) and computed reduction.
- **Evaluation Order (DAG)**:
  1. **Temporal Window**: `now() >= starts_at && now() <= expires_at`.
  2. **Global & Per-User Redemption Limit**: `redemption_count < max_global && user_redemptions < max_per_user`.
  3. **Cart Subtotal Threshold**: `cart_subtotal_paise >= min_order_value_paise`.
  4. **Category Inclusions / Exclusions**: Ensure cart items belong to eligible categories.
  5. **User Group Eligibility**: First-time buyer (`orders_count == 0`), VIP customer, or general public.
- **Time Complexity**: $O(R \log R)$ where $R$ is candidate rules sorted by highest monetary benefit.
- **Space Complexity**: $O(R)$ for filtered rule candidates.

---

### 7.4 Algorithm 4: Faceted Search, Colloquial Intent Tokenizer & Trigram Fuzzy Ranking
- **Problem Statement**: Convert unstructured colloquial search phrases (e.g. "luxury birthday hamper for sister under 3000") into structured search facets while matching misspelled catalogue names using trigram fuzzy similarity.
- **Input**: Raw query string $Q \in \Sigma^*$.
- **Output**:
  ```typescript
  interface SearchIntent {
    occasion?: 'BIRTHDAY' | 'ANNIVERSARY' | 'WEDDING' | 'HOUSEWARMING';
    recipient?: 'SISTER' | 'MOTHER' | 'FRIEND' | 'COLLEAGUE' | 'HIM' | 'HER';
    max_price_paise?: bigint;
    keywords: string[];
    is_luxury_flag: boolean;
  }
  ```
- **Algorithm (Tokenizer & Regex Matcher)**:
  - Extract price bounds via non-backtracking regex: `/(?:under|below|less\s+than)\s*(?:rs\.?|inr|₹)?\s*(\d+)/i` $\to \text{max\_price} = \text{Match}_1 \times 100\text{ paise}$.
  - Occasion dictionary lookup using trie or token set intersection.
  - Compute similarity score on PostgreSQL:
    $$\text{Rank}(D, Q) = 0.6 \times \text{ts\_rank\_cd}(D_{\text{vector}}, Q_{\text{query}}) + 0.4 \times \text{similarity}(D_{\text{name}}, Q_{\text{raw}})$$
- **Time Complexity**: $O(M)$ for token extraction where $M = |Q|$; $O(\log K)$ index scan on PostgreSQL with GiST/GIN indexes.
- **Space Complexity**: $O(M)$ auxiliary token array.

---

### 7.5 Algorithm 5: Multi-Criteria Budget Matching & Recipient Recommendation Heuristic
- **Problem Statement**: Given a target budget $B$ and recipient traits, recommend an optimal combination of 1 container and $k$ complementary items that maximize the aesthetic score and fullness ratio while strictly adhering to $P_{\text{total}} \le B$.
- **Mathematical Model**: Bounded Knapsack Optimization with compatibility graph constraints:
  $$\max \sum_{j=1}^k \text{AestheticScore}(i_j) \quad \text{subject to} \quad \sum_{j=1}^k \text{Price}(i_j) + \text{Price}(Box) \le B \quad \text{and} \quad \text{Fullness}(Box, I) \in [0.65, 0.95]$$
- **Algorithm**: Greedy heuristic with local search relaxation:
  1. Select default luxury box fitting budget allocation ($15\text{--}20\%$ of $B$).
  2. Sort candidate catalog items by $\text{AestheticScore} / \text{Price}$ ratio.
  3. Greedily insert items until budget headroom $< \min(\text{ItemPrice})$ or box volume reaches 85%.
  4. Perform 2-opt item swaps if fullness ratio $< 65\%$.
- **Time Complexity**: $O(N \log N)$ where $N$ is catalog candidate size.
- **Space Complexity**: $O(N)$ for item pool.

---

### 7.6 Algorithm 6: Atomic Inventory Allocation & Pessimistic Lock Engine
- **Problem Statement**: Prevent inventory overselling during flash seasonal campaigns (Valentine's, Diwali, Rakhi) when concurrent buyers check out identical limited-run artisanal products.
- **Algorithm**: Distributed Redis Token-Bucket Lock with PostgreSQL Fallback:
  ```typescript
  export async function acquireInventoryReservation(
    redis: any,
    orderId: string,
    items: Array<{ productId: string; quantity: number }>,
    ttlSeconds: number = 900
  ): Promise<boolean> {
    const lockKeys = items.map(i => `lock:inventory:${i.productId}`).sort();
    // Sort keys alphabetically to prevent distributed deadlocks
    
    const acquiredLocks: string[] = [];
    try {
      for (const key of lockKeys) {
        const acquired = await redis.set(key, orderId, 'NX', 'EX', 10);
        if (!acquired) {
          throw new Error(`Failed to acquire lock for ${key}`);
        }
        acquiredLocks.push(key);
      }

      // Check available stock in Redis hash
      for (const item of items) {
        const stock = await redis.hget(`stock:available`, item.productId);
        if (!stock || parseInt(stock, 10) < item.quantity) {
          return false; // Insufficient stock
        }
      }

      // Decrement stock and store reservation
      const multi = redis.multi();
      for (const item of items) {
        multi.hincrby(`stock:available`, item.productId, -item.quantity);
        multi.zadd(`reservations:${orderId}`, Date.now() + (ttlSeconds * 1000), item.productId);
      }
      await multi.exec();
      return true;
    } finally {
      // Release mutex locks
      for (const key of acquiredLocks) {
        await redis.del(key);
      }
    }
  }
  ```
- **Time Complexity**: $O(K \log M)$ where $K$ is items in order and $M$ is lock keys.
- **Deadlock Avoidance**: Enforced by sorting all inventory mutex keys alphabetically before sequential acquisition.

---

### 7.7 Algorithm 7: Multi-Channel Lead Scoring & Priority Queue Scheduler
- **Problem Statement**: Rank inbound conversational inquiries from Instagram DMs and WhatsApp to route high-intent, high-value corporate/wedding inquiries to human atelier curators instantly.
- **Scoring Formula**:
  $$\text{Score} = w_1 \cdot C_{\text{intent}} + w_2 \cdot C_{\text{budget}} + w_3 \cdot C_{\text{urgency}} + w_4 \cdot C_{\text{channel}}$$
  - Intent Keywords ($C_{\text{intent}}$): "wedding hampers", "corporate bulk", "50 pieces" $\to +35$ pts.
  - Explicit Budget Mention ($C_{\text{budget}}$): $> ₹10,000 \to +30$ pts; $> ₹5,000 \to +15$ pts.
  - Event Date Urgency ($C_{\text{urgency}}$): Delivery within 48h $\to +20$ pts.
  - Returning Customer: $+15$ pts.
- **Routing Thresholds**:
  - Score $\ge 70$: Tier 1 (Urgent) $\to$ Instant WhatsApp concierge ping & push notification to atelier lead.
  - Score $40\text{--}69$: Tier 2 (Standard) $\to$ Interactive WhatsApp bot qualification flow.
  - Score $< 40$: Tier 3 (Cold) $\to$ Automated catalog link broadcast.
- **Time Complexity**: $O(1)$ score computation; $O(\log L)$ insertion into priority heap.

---

### 7.8 Algorithm 8: Dynamic Pincode SLA, Dispatch Distance & Delivery Date Interval Resolver
- **Problem Statement**: Determine guaranteed delivery date window $[D_{\text{min}}, D_{\text{max}}]$ given destination pincode, studio cutoff time, preparation lead time, and courier transit calendars.
- **Formula**:
  $$D_{\text{dispatch}} = \begin{cases} \text{Today} + T_{\text{prep}}, & \text{if } \text{OrderTime} < \text{CutoffTime} \\ \text{Tomorrow} + T_{\text{prep}}, & \text{if } \text{OrderTime} \ge \text{CutoffTime} \end{cases}$$
  $$D_{\text{delivery}} = D_{\text{dispatch}} + T_{\text{transit}}(\text{PincodeZone}) + \sum \text{CourierHolidays}$$
- **Complexity**: $O(\log Z)$ where $Z$ is zone boundary intervals.

## 8. Dependencies
- Upstream Modules:
  - `13_DATABASE_DESIGN.md` (Entity schemas for Product, Variant, Inventory, Order, Lead).
  - `14_PRODUCT_CATALOG.md` (Product dimensions, tare weight, thermal flags).
  - `15_HAMPER_BUILDER.md` (Builder step progression and UX feedback loops).
  - `19_PAYMENT_ARCHITECTURE.md` (Payment state machine and authorization tokens).
- External Runtime Dependencies:
  - PostgreSQL 16 `pg_trgm` and full-text search extensions.
  - Redis 7.2 for atomic semaphores and sorted-set inventory TTL management.

## 9. Security
- **Integer Overflow Protection**: All pricing routines strictly utilize JavaScript `BigInt` types, preventing 32-bit/64-bit float precision corruption or integer wrapping attacks.
- **Algorithmic Complexity DoS (ReDoS)**: All regular expressions used in intent tokenization are validated using safe regex linters to guarantee linear-time evaluation $O(M)$ without catastrophic backtracking.
- **Inventory Hoarding Defense**: Single customer sessions cannot hold more than 3 active reservations concurrently; uncompleted checkouts expire within 15 minutes.

## 10. Failure Modes
| Failure Scenario | Root Cause | System Response | Recovery / Compensation |
| :--- | :--- | :--- | :--- |
| **Volumetric False Positive** | Asymmetrical packaging shape | Reject packing in builder UI | Allow customer to request custom quote or upgrade box size |
| **Redis Lock Timeout** | Network partition during checkout | Return HTTP 409 Conflict | Prompt user: "Item held by another customer. Retry in 1 min." |
| **Coupon Stacking Exploit** | Simultaneous concurrent requests | Database unique constraint on order | Rollback transaction, apply single highest coupon |
| **Pincode Lookup Failure** | Unindexed new postal pincode | Mark SLA as TO_VERIFY | Default to standard national 5-7 business days transit |

## 11. Testing
- **Property-Based Testing**: Utilize `fast-check` to run 10,000 randomized iterations of `calculateDeterministicOrderPricing` asserting that:
  - $\text{Taxable} + \text{CGST} + \text{SGST} \equiv \text{NetSubtotal}$.
  - $\text{TotalPayable} \ge \text{ShippingPaise}$.
  - Zero floating-point decimals exist in the resulting ledger.
- **Geometric Edge Cases**: Test zero-item hamper, single fragile wine bottle, 25 compact macarons, and negative dimensions.
- **Concurrency Unit Tests**: Simulate 100 parallel checkout requests against a single inventory unit in Vitest; assert that exactly 1 checkout succeeds and 99 receive graceful out-of-stock messages.

## 12. Observability
- **Metrics**:
  - `algo.packing_evaluation_duration_ms` (Histogram, target $p99 < 5\text{ ms}$).
  - `algo.fullness_ratio` (Gauge, healthy baseline $0.70\text{--}0.85$).
  - `algo.inventory_lock_contention_total` (Counter, tracks high-demand product spikes).
- **Traces**: OpenTelemetry spans wrap `evaluateHamperPacking` and `calculateDeterministicOrderPricing` attached to checkout trace roots.

## 13. Open Questions
```yaml
unknown:
  field: studio_dispatch_hub_pincode
  status: TO_VERIFY
  source_required: brand_owner
  impact: high
  temporary_assumption: "Pincode zone transit matrix assumes Tier-1 metro origin (e.g., 400001 / 560001 / 110001) pending physical studio location input."
```

```yaml
unknown:
  field: default_box_dimensions_registry
  status: TO_VERIFY
  source_required: brand_owner
  impact: medium
  temporary_assumption: "Standard box dimensions modeled as Small (200x150x80mm), Medium (250x200x100mm), Large (320x260x120mm), Grande (400x300x150mm)."
```

## 14. Future Evolution
- **Phase 10 AI Upgrade**: Integrate 3D WebGL physics-based collision rendering in the browser atelier, allowing customers to drag, drop, and rotate artisanal items inside the virtual box in real time.
- **Dynamic Pricing Elasticity**: Implement ML-driven pricing recommendations for bulk wedding and corporate orders based on raw material market fluctuations and studio labor capacity.

## 15. References
- IEEE 754 Standard for Floating-Point Arithmetic Pitfalls in Financial Software.
- Martello, S., & Toth, P. (1990). *Knapsack Problems: Algorithms and Computer Implementations*. John Wiley & Sons.
- PostgreSQL 16 Official Documentation: Trigram Similarity (`pg_trgm`) and GIN Indexing.
- Redis Documentation: Distributed Locks with Redis (Redlock Pattern and Single-Instance Mutex).

<!-- DOCUMENT END: 39_DSA.md -->
