const test = require("node:test");
const assert = require("node:assert");
const { OrderService, ORDER_STATUS } = require("../server/services/orderService");

test("OrderService - Creates order in PENDING_PAYMENT state and transitions to CONFIRMED upon payment", () => {
  const order = OrderService.createOrder({
    items: [{ pricePaise: 395000, quantity: 1 }],
    shippingAddress: {
      fullName: "Priya Sharma",
      phone: "9876543210",
      pincode: "110001",
      city: "New Delhi",
      street: "Connaught Place"
    },
    buyerContact: { email: "priya@example.com", phone: "9876543210" }
  });

  assert.ok(order.orderNumber.startsWith("HBH-"));
  assert.strictEqual(order.status, ORDER_STATUS.PENDING_PAYMENT);
  assert.strictEqual(order.trackingTimeline.length, 1);

  // Confirm Payment
  const confirmed = OrderService.confirmPayment(order.orderNumber, {
    paymentId: "pay_test_998877",
    method: "UPI"
  });

  assert.strictEqual(confirmed.status, ORDER_STATUS.CONFIRMED);
  assert.strictEqual(confirmed.payment.status, "CAPTURED");
  assert.strictEqual(confirmed.payment.method, "UPI");
  assert.strictEqual(confirmed.trackingTimeline.length, 2);
});
