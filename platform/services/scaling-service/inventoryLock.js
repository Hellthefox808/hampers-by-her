/**
 * Hampers by Her Atelier AI Platform — High-Concurrency Inventory Reservation Engine
 * Eliminates race conditions and stock overselling during 1M user flash sales and festive drops.
 * Implements atomic check-and-reserve semantics with expiration TTL and transactional rollbacks.
 */

const crypto = require("crypto");

class InventoryReservationEngine {
  constructor() {
    // In-memory stock and active reservations ledger
    this.stockLevels = new Map();
    this.reservations = new Map();
    this.reservationTtlMs = 15 * 60 * 1000; // 15-minute checkout hold
  }

  /**
   * Initialize or update inventory stock for a SKU
   */
  setStock(skuId, totalUnits) {
    this.stockLevels.set(skuId, {
      total: totalUnits,
      reserved: 0,
      available: totalUnits
    });
  }

  /**
   * Atomically reserve inventory for an active user checkout session.
   * Simulates Redis Lua script atomic execution: avoids race conditions.
   * @param {string} skuId
   * @param {number} quantity
   * @param {string} userId
   * @returns {Object} Reservation result
   */
  async reserve(skuId, quantity = 1, userId = "anonymous") {
    const stock = this.stockLevels.get(skuId);
    if (!stock) {
      return { success: false, reason: "SKU_NOT_FOUND", available: 0 };
    }

    // Atomic evaluation
    if (stock.available < quantity) {
      return {
        success: false,
        reason: "INSUFFICIENT_STOCK",
        requested: quantity,
        available: stock.available
      };
    }

    // Deduct available, increment reserved
    stock.available -= quantity;
    stock.reserved += quantity;

    const reservationId = `res_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const reservation = {
      reservationId,
      skuId,
      quantity,
      userId,
      status: "HELD",
      expiresAt: Date.now() + this.reservationTtlMs,
      createdAt: Date.now()
    };

    this.reservations.set(reservationId, reservation);

    return {
      success: true,
      reservationId,
      skuId,
      quantity,
      remainingAvailable: stock.available,
      expiresAt: reservation.expiresAt
    };
  }

  /**
   * Commit reservation into permanent sale upon successful payment
   */
  async commit(reservationId) {
    const res = this.reservations.get(reservationId);
    if (!res || res.status !== "HELD") {
      return { success: false, reason: "INVALID_OR_EXPIRED_RESERVATION" };
    }

    const stock = this.stockLevels.get(res.skuId);
    if (stock) {
      stock.reserved -= res.quantity;
      stock.total -= res.quantity;
    }

    res.status = "COMMITTED";
    res.committedAt = Date.now();

    return {
      success: true,
      reservationId,
      skuId: res.skuId,
      quantity: res.quantity
    };
  }

  /**
   * Release reservation back to available stock pool (cart abandonment, payment failure)
   */
  async release(reservationId) {
    const res = this.reservations.get(reservationId);
    if (!res || res.status !== "HELD") {
      return { success: false, reason: "NOT_HELD" };
    }

    const stock = this.stockLevels.get(res.skuId);
    if (stock) {
      stock.reserved -= res.quantity;
      stock.available += res.quantity;
    }

    res.status = "RELEASED";
    res.releasedAt = Date.now();

    return {
      success: true,
      reservationId,
      restoredStock: stock ? stock.available : 0
    };
  }

  /**
   * Background sweep for expired reservations
   */
  sweepExpired() {
    const now = Date.now();
    let releasedCount = 0;

    for (const [id, res] of this.reservations.entries()) {
      if (res.status === "HELD" && res.expiresAt <= now) {
        this.release(id);
        releasedCount++;
      }
    }

    return { sweptCount: releasedCount };
  }

  getStock(skuId) {
    return this.stockLevels.get(skuId) || { total: 0, reserved: 0, available: 0 };
  }
}

const inventoryEngine = new InventoryReservationEngine();
module.exports = { InventoryReservationEngine, inventoryEngine };
