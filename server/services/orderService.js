/**
 * Hampers by Her — Order Fulfillment & Lifecycle Service
 * Manages the 11-stage order lifecycle state machine.
 */

const { PricingEngine } = require("./pricingEngine");

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

// In-Memory Order Store for live execution
const ordersDb = new Map();

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
    if (!payload.items || !payload.items.length) {
      throw new Error("Cannot create order with an empty cart.");
    }
    if (!payload.shippingAddress || !payload.shippingAddress.pincode) {
      throw new Error("Shipping address with PIN code is required.");
    }

    const pricing = PricingEngine.calculate({
      items: payload.items,
      box: payload.box,
      customizations: payload.customizations,
      couponCode: payload.couponCode,
      deliveryTier: payload.deliveryTier
    });

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
    return order;
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
    return order;
  }

  static listRecentOrders(limit = 10) {
    return Array.from(ordersDb.values()).slice(-limit);
  }
}

module.exports = { OrderService, ORDER_STATUS };
