const express = require("express");
const router = express.Router();

const { PricingEngine } = require("../services/pricingEngine");
const { HamperBuilderEngine } = require("../services/hamperBuilder");
const { DeliveryService } = require("../services/deliveryService");
const { OrderService } = require("../services/orderService");

// Catalog of Curated Ready-Made Hampers
const CURATED_HAMPERS = [
  {
    id: "prod_wedding_vows",
    slug: "the-vows-and-vines-hamper",
    title: "The Vows & Vines Hamper",
    occasion: "Wedding",
    theme: "Understated Botanical",
    subtitle: "Elderflower tonic, wax-sealed card, dried hydrangea, castor-oil candle.",
    description: "Composed specifically for quiet wedding mornings and trousseau gifting. Tied in natural ecru raw silk ribbon with hand-stamped botanical wax seal.",
    basePricePaise: 395000,
    priceRupees: "3,950",
    badge: "Best Seller",
    imageUrl: "images/hamper-wedding.jpg",
    itemsIncluded: ["Craft Elderflower Tonic", "Amber & Vanilla Candle", "Dried Hydrangea Posy", "Wax-Sealed Greeting Card"]
  },
  {
    id: "prod_corporate_wellwisher",
    slug: "the-office-well-wisher",
    title: "The Office Well-Wisher",
    occasion: "Corporate",
    theme: "Minimalist Monogram",
    subtitle: "Single-origin cocoa, linen napkin, brass opener.",
    description: "Refined executive desk gift. Custom monogramming available on request.",
    basePricePaise: 215000,
    priceRupees: "2,150",
    badge: "Artisan Pick",
    imageUrl: "images/hamper-corporate.jpg",
    itemsIncluded: ["Single-Origin Roasted Hazelnut Cocoa", "Washed Raw Silk Napkins", "Handmade Brass Letter Opener"]
  },
  {
    id: "prod_festive_diwali",
    slug: "the-diwali-slow-burn",
    title: "The Diwali Slow-Burn",
    occasion: "Festive",
    theme: "Terracotta Warmth",
    subtitle: "Brass diya, dried citrus, slow-burn incense.",
    description: "Warm artisanal glow for autumn festivals. Scented with wild sandalwood and dried orange peel.",
    basePricePaise: 285000,
    priceRupees: "2,850",
    badge: "Limited Festive",
    imageUrl: "images/hamper-festive.jpg",
    itemsIncluded: ["Hand-Cast Brass Diya", "Slow-Burn Temple Incense", "Sun-Dried Citrus Garland", "Pressed Marigold Note"]
  },
  {
    id: "prod_anniversary_letter",
    slug: "the-ten-year-letter",
    title: "The Ten-Year Letter",
    occasion: "Anniversary",
    theme: "Royal Bordeaux",
    subtitle: "Pressed rose, small-batch mead, a letter you can keep.",
    description: "Our signature romantic edit. Features deckle-edge paper and heirloom wax stamp.",
    basePricePaise: 320000,
    priceRupees: "3,200",
    badge: "Signature",
    imageUrl: "images/hamper-anniversary.jpg",
    itemsIncluded: ["Pressed Kashmiri Rose", "Artisanal Confectionery", "Deckle-Edge Letter Card", "Crushed Velvet Wine Ribbon"]
  }
];

// 1. Catalog Products
router.get("/catalog/products", (req, res) => {
  const { occasion, search } = req.query;
  let items = [...CURATED_HAMPERS];

  if (occasion && occasion !== "all") {
    items = items.filter(h => h.occasion.toLowerCase() === occasion.toLowerCase());
  }

  if (search) {
    const q = search.toLowerCase();
    items = items.filter(h => h.title.toLowerCase().includes(q) || h.subtitle.toLowerCase().includes(q));
  }

  res.json({
    success: true,
    data: {
      count: items.length,
      items
    }
  });
});

// 2. Hamper Builder Options
router.get("/builder/options", (req, res) => {
  res.json({
    success: true,
    data: HamperBuilderEngine.getOptions()
  });
});

// 3. Hamper Builder Step Validation
router.post("/builder/validate-step", (req, res) => {
  try {
    const result = HamperBuilderEngine.validateConfiguration(req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: err.message }
    });
  }
});

// 4. Delivery PIN Code Check
router.get("/delivery/serviceability/:pincode", (req, res) => {
  const result = DeliveryService.checkPincode(req.params.pincode);
  res.json({
    success: true,
    data: result
  });
});

// 5. Checkout Price Calculation
router.post("/checkout/calculate", (req, res) => {
  try {
    const pricing = PricingEngine.calculate(req.body);
    res.json({
      success: true,
      data: pricing
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: { code: "CALCULATION_ERROR", message: err.message }
    });
  }
});

// 6. Create Order (Pending Payment)
router.post("/checkout/create-order", (req, res) => {
  try {
    const order = OrderService.createOrder(req.body);
    res.status(201).json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        totalRupees: order.pricing.totalRupees,
        totalPaise: order.pricing.totalPaise,
        status: order.status,
        order
      }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: { code: "ORDER_CREATION_FAILED", message: err.message }
    });
  }
});

// 7. Payment Verification Handshake
router.post("/payments/verify", (req, res) => {
  const { orderNumber, paymentId, method } = req.body;
  if (!orderNumber) {
    return res.status(400).json({ success: false, error: { message: "orderNumber is required" } });
  }

  try {
    const order = OrderService.confirmPayment(orderNumber, { paymentId, method });
    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        status: order.status,
        payment: order.payment,
        order
      }
    });
  } catch (err) {
    res.status(404).json({
      success: false,
      error: { code: "PAYMENT_CONFIRM_FAILED", message: err.message }
    });
  }
});

// 8. Order Tracking Lookup
router.get("/orders/:orderNumber", (req, res) => {
  const order = OrderService.getOrderByNumber(req.params.orderNumber);
  if (!order) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Order not found" }
    });
  }
  res.json({ success: true, data: order });
});

// 9. Available Coupons
router.get("/coupons", (req, res) => {
  res.json({ success: true, data: PricingEngine.getAvailableCoupons() });
});

// 10. Voice AI Status & Capabilities
router.get("/voice/status", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "operational",
      version: "1.0.0",
      websocketEndpoint: "/api/v1/voice/stream",
      supportedFormats: ["pcm16"],
      sampleRates: [16000, 24000],
      activeEngine: process.env.OPENAI_API_KEY ? "openai_realtime" : "local_atelier_sandbox",
      models: [
        { id: "gpt-4o-realtime-preview", type: "speech-to-speech", active: Boolean(process.env.OPENAI_API_KEY) },
        { id: "hampers-atelier-sandbox-v1", type: "domain-orchestrator", active: true }
      ],
      tools: [
        "searchHampers",
        "customizeHamper",
        "dictateCardMessage",
        "checkOrderStatus",
        "estimateDelivery"
      ]
    }
  });
});

module.exports = router;
