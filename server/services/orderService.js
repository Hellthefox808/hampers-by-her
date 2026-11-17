/**
 * Hampers by Her — Order Fulfillment & Lifecycle Service
 * Manages the 11-stage order lifecycle state machine.
 */

const { PricingEngine } = require("./pricingEngine");
const { persistenceEngine } = require("./persistenceEngine");

const ORDER_STATUS = {
  DRAFT: "DRAFT",
  PENDING_PAYMENT: "PENDING_PAYMENT",
  CONFIRMED: "CONFIRMED",
  IN_PRODUCTION: "IN_PRODUCTION",
  QUALITY_CHECKED: "QUALITY_CHECKED",
  PACKED: "PACKED",
  DISPATCHED: "DISPATCHED",
  IN_TRANSIT: "IN_TRANSIT",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED"
};

// In-Memory Order Store with File-Backed Crash Resiliency
const ordersDb = new Map();

// Rehydrate from persistence store on startup
try {
  const loaded = persistenceEngine.loadState();
  if (loaded && Array.isArray(loaded.orders)) {
    for (const ord of loaded.orders) {
      if (ord.orderNumber) ordersDb.set(ord.orderNumber, ord);
    }
  }
} catch (e) {
  // Graceful fallback to fresh in-memory store
}

class OrderService {
  /**
   * Generate human-readable order number: HBH-YYYYMMDD-XXXX
   */
  static generateOrderNumber() {
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(1000 + Math.random() * 9000);
    return "HBH-" + ymd + "-" + rand;
  }

  /**
   * Create new order in PENDING_PAYMENT state
   */
  static createOrder(payload) {
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error("Cannot create order with an empty cart.");
    }
    if (!payload.shippingAddress || !payload.shippingAddress.pincode) {
      throw new Error("Shipping address with PIN code is required.");
    }

    const rawPin = String(payload.shippingAddress.pincode).trim();
    const PIN_REGEX = /^[1-9][0-9]{5}$/;
    if (!PIN_REGEX.test(rawPin)) {
      throw new Error(`INVALID_PINCODE: Destination PIN code '${rawPin}' must be a valid 6-digit Indian postal code.`);
    }

    // Validate item integrity: non-negative prices and positive quantities
    for (const item of payload.items) {
      const price = item.pricePaise !== undefined ? item.pricePaise : (item.basePricePaise !== undefined ? item.basePricePaise : (item.price ? Math.round(item.price * 100) : 0));
      if (price < 0) {
        throw new Error("INVALID_ITEM_PRICE: Item prices cannot be negative.");
      }
      if (item.quantity !== undefined && item.quantity < 1) {
        throw new Error("INVALID_ITEM_QUANTITY: Item quantity must be at least 1.");
      }
    }

    const pricing = PricingEngine.calculate({
      items: payload.items,
      box: payload.box,
      customizations: payload.customizations,
      couponCode: payload.couponCode,
      deliveryTier: payload.deliveryTier
    });

    if (pricing.totalPaise <= 0) {
      throw new Error("INVALID_ORDER_TOTAL: Order total must be greater than zero.");
    }

    const orderNumber = this.generateOrderNumber();
    const order = {
      id: "ord_" + Math.random().toString(36).substring(2, 11),
      orderNumber,
      status: ORDER_STATUS.PENDING_PAYMENT,
      items: payload.items,
      box: payload.box || null,
      ribbon: payload.ribbon || null,
      waxSeal: payload.waxSeal || null,
      customMonogram: payload.customMonogram || null,
      cardMessage: payload.cardMessage || null,
      customer: payload.customer || null,
      customizations: payload.customizations || [],
      pricing,
      shippingAddress: payload.shippingAddress,
      buyerContact: payload.buyerContact,
      giftDetails: payload.giftDetails || null,
      trackingTimeline: [
        { status: ORDER_STATUS.PENDING_PAYMENT, timestamp: new Date().toISOString(), note: "Order placed, awaiting payment authorization." }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    ordersDb.set(orderNumber, order);
    this.syncPersistence();
    return order;
  }

  /**
   * Synchronize active orders to crash-proof atomic persistence
   */
  static syncPersistence() {
    try {
      persistenceEngine.scheduleSave({
        orders: Array.from(ordersDb.values())
      });
    } catch {
      // Non-blocking fallback
    }
  }

  /**
   * Immediate synchronous flush to disk
   */
  static flushPersistence() {
    try {
      persistenceEngine.flushToDisk();
    } catch {
      // Non-blocking fallback
    }
  }

  /**
   * Confirm order upon payment verification
   */
  static confirmPayment(orderNumber, paymentInfo) {
    const order = ordersDb.get(orderNumber);
    if (!order) throw new Error("Order not found: " + orderNumber);

    order.status = ORDER_STATUS.CONFIRMED;
    order.payment = {
      paymentId: paymentInfo.paymentId || "pay_mock_" + Date.now(),
      method: paymentInfo.method || "UPI",
      paidAt: new Date().toISOString(),
      status: "CAPTURED"
    };
    order.trackingTimeline.push({
      status: ORDER_STATUS.CONFIRMED,
      timestamp: new Date().toISOString(),
      note: "Payment captured successfully via " + (paymentInfo.method || "UPI") + ". Order assigned to atelier workshop."
    });
    order.updatedAt = new Date().toISOString();

    ordersDb.set(orderNumber, order);
    this.syncPersistence();
    return order;
  }

  static getOrderByNumber(orderNumber) {
    return ordersDb.get(orderNumber) || null;
  }

  static getAllOrders() {
    return Array.from(ordersDb.values());
  }

  static updateOrderStatus(orderNumber, status, note = "") {
    const order = ordersDb.get(orderNumber);
    if (!order) throw new Error("Order not found: " + orderNumber);
    order.status = status;
    order.updatedAt = new Date().toISOString();
    if (!order.trackingTimeline) order.trackingTimeline = [];
    order.trackingTimeline.push({
      status,
      timestamp: new Date().toISOString(),
      note: note || `Order transitioned to ${status}`
    });
    this.syncPersistence();
    return order;
  }

  static listRecentOrders(limit = 10) {
    return Array.from(ordersDb.values()).slice(-limit);
  }
}

module.exports = { OrderService, ORDER_STATUS };
