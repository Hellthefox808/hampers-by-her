/**
 * HAMPERS BY HER — ATOMIC INVENTORY ALLOCATION & PESSIMISTIC LOCK ENGINE
 * 
 * Formal Specification Reference: 39_DSA.md Section 7.6 (Algorithm 6)
 * Enforces lexicographical key sorting for deadlock-free multi-key acquisition.
 * Supports in-memory concurrent state with 15-minute sliding TTL.
 * Time Complexity: O(K log M)
 * Space Complexity: O(K)
 */

class AtomicInventoryLockEngine {
  constructor(defaultTtlSeconds = 900) {
    this.defaultTtlSeconds = defaultTtlSeconds;
    this.stockLedger = new Map(); // sku -> availableCount
    this.activeLocks = new Map(); // key -> { holder, expiresAt }
    this.reservations = new Map(); // orderId -> Array<{ sku, qty, expiresAt, sessionId }>
    this.sessionReservations = new Map(); // sessionId -> Set<orderId>
    this.MAX_RESERVATIONS_PER_SESSION = 3;
  }

  /**
   * Initializes or updates baseline stock for an SKU
   * @param {string} sku
   * @param {number} availableUnits
   */
  setStock(sku, availableUnits) {
    this.stockLedger.set(sku, Math.max(0, Math.floor(availableUnits)));
  }

  /**
   * Retrieves current stock level
   * @param {string} sku
   * @returns {number}
   */
  getStock(sku) {
    this._cleanExpired();
    return this.stockLedger.get(sku) || 0;
  }

  /**
   * Acquires atomic reservation for multiple items with deadlock avoidance
   * @param {Object} params
   * @param {string} params.orderId Unique order identifier
   * @param {string} [params.sessionId="anon"] Customer session identifier
   * @param {Array<{ sku: string, quantity: number }>} params.items List of SKUs and quantities
   * @param {number} [params.ttlSeconds=900] Expiration TTL
   * @returns {Promise<{ success: boolean, reservedItems?: Array<Object>, error?: string }>}
   */
  async acquireReservation({
    orderId,
    sessionId = "anon_session",
    items,
    ttlSeconds = this.defaultTtlSeconds
  }) {
    this._cleanExpired();

    if (!orderId || !Array.isArray(items) || items.length === 0) {
      return { success: false, error: "INVALID_RESERVATION_PAYLOAD" };
    }

    // 1. Session Hoarding Protection (Max 3 concurrent reservations per patron session)
    const activeSessionOrders = this.sessionReservations.get(sessionId) || new Set();
    if (activeSessionOrders.size >= this.MAX_RESERVATIONS_PER_SESSION) {
      return {
        success: false,
        error: "MAX_SESSION_RESERVATIONS_EXCEEDED",
        message: "You have reached the maximum active cart reservations (3). Please complete pending checkouts."
      };
    }

    // 2. Deadlock Avoidance: Sort lock keys alphabetically
    const sortedItems = [...items].sort((a, b) => a.sku.localeCompare(b.sku));
    const lockKeys = sortedItems.map(i => `lock:inventory:${i.sku}`);

    const now = Date.now();
    const acquiredLocks = [];

    try {
      // Step A: Acquire sequential mutex locks
      for (const key of lockKeys) {
        const existing = this.activeLocks.get(key);
        if (existing && existing.expiresAt > now && existing.holder !== orderId) {
          throw new Error(`LOCK_CONTENTION_${key}`);
        }
        this.activeLocks.set(key, { holder: orderId, expiresAt: now + 5000 }); // 5s mutex hold
        acquiredLocks.push(key);
      }

      // Step B: Verify stock availability across all requested SKUs
      for (const item of sortedItems) {
        const currentStock = this.stockLedger.get(item.sku) || 0;
        if (currentStock < item.quantity) {
          return {
            success: false,
            error: "INSUFFICIENT_STOCK",
            sku: item.sku,
            requested: item.quantity,
            available: currentStock
          };
        }
      }

      // Step C: Atomically decrement stock and record reservation
      const expiresAt = now + (ttlSeconds * 1000);
      const reservedRecords = [];

      for (const item of sortedItems) {
        const currentStock = this.stockLedger.get(item.sku);
        this.stockLedger.set(item.sku, currentStock - item.quantity);
        reservedRecords.push({
          sku: item.sku,
          quantity: item.quantity,
          expiresAt,
          sessionId
        });
      }

      this.reservations.set(orderId, reservedRecords);

      // Track under session
      activeSessionOrders.add(orderId);
      this.sessionReservations.set(sessionId, activeSessionOrders);

      return {
        success: true,
        orderId,
        expiresAt: new Date(expiresAt).toISOString(),
        ttlSeconds,
        reservedItems: reservedRecords
      };
    } catch (err) {
      return {
        success: false,
        error: "LOCK_ACQUISITION_FAILED",
        details: err.message
      };
    } finally {
      // Step D: Always release mutex locks
      for (const key of acquiredLocks) {
        this.activeLocks.delete(key);
      }
    }
  }

  /**
   * Commits reservation permanently upon successful payment confirmation
   * @param {string} orderId
   * @returns {boolean}
   */
  commitReservation(orderId) {
    const records = this.reservations.get(orderId);
    if (!records) return false;

    // Remove from temporary reservation ledger: stock remains permanently deducted
    this.reservations.delete(orderId);

    // Clean from session
    for (const [sId, set] of this.sessionReservations.entries()) {
      if (set.has(orderId)) {
        set.delete(orderId);
        break;
      }
    }
    return true;
  }

  /**
   * Releases and restores reserved stock upon order cancellation or checkout abandonment
   * @param {string} orderId
   * @returns {boolean}
   */
  releaseReservation(orderId) {
    const records = this.reservations.get(orderId);
    if (!records) return false;

    // Restore stock back into available pool
    for (const record of records) {
      const current = this.stockLedger.get(record.sku) || 0;
      this.stockLedger.set(record.sku, current + record.quantity);
    }

    this.reservations.delete(orderId);

    for (const [sId, set] of this.sessionReservations.entries()) {
      if (set.has(orderId)) {
        set.delete(orderId);
        break;
      }
    }
    return true;
  }

  /**
   * Sweeps expired reservations and restores stock
   * @private
   */
  _cleanExpired() {
    const now = Date.now();
    for (const [orderId, records] of this.reservations.entries()) {
      if (records.length > 0 && records[0].expiresAt <= now) {
        this.releaseReservation(orderId);
      }
    }
  }
}

module.exports = {
  AtomicInventoryLockEngine
};
