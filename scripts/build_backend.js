const fs = require("fs");
const path = require("path");

const root = path.resolve(".");

// ----------------------------------------------------
// 1. hamperBuilder.js
// ----------------------------------------------------
const hamperBuilderCode = `/**
 * Hampers by Her — Bespoke Hamper Builder Engine
 * Algorithmic 3D Volume Calculation, Collision Detection, and Rule Validation.
 */

const BOX_BASES = {
  BOX_KRAFT_RIGID: {
    id: "BOX_KRAFT_RIGID",
    name: "Classic Rigid Kraft Box",
    material: "FSC-certified recycled kraft board with magnetic catch",
    dimensionsCm: { l: 28, w: 22, h: 10 },
    capacityCm3: 5200, // Usable packing volume considering paper shred
    maxWeightGrams: 2500,
    pricePaise: 45000, // ₹450
    imageUrl: "images/hamper-corporate.jpg"
  },
  BOX_LINEN_KEEPSAKE: {
    id: "BOX_LINEN_KEEPSAKE",
    name: "Linen-Lined Wooden Keepsake",
    material: "Natural pine with natural ecru linen lining and brass hinges",
    dimensionsCm: { l: 32, w: 25, h: 12 },
    capacityCm3: 8200,
    maxWeightGrams: 4000,
    pricePaise: 95000, // ₹950
    imageUrl: "images/hamper-wedding.jpg"
  },
  BOX_VELVET_BORDEAUX: {
    id: "BOX_VELVET_BORDEAUX",
    name: "Royal Bordeaux Velvet Casket",
    material: "Deep bordeaux velvet wrap with gold foiled crest and ribbon clasp",
    dimensionsCm: { l: 35, w: 28, h: 14 },
    capacityCm3: 11800,
    maxWeightGrams: 6000,
    pricePaise: 145000, // ₹1,450
    imageUrl: "images/hamper-anniversary.jpg"
  }
};

const ATELIER_ITEMS = [
  {
    id: "ITEM_CANDLE_AMBER",
    name: "Amber & Vanilla Castor-Oil Candle",
    category: "CANDLES",
    volumeCm3: 750,
    weightGrams: 320,
    pricePaise: 68000, // ₹680
    isFragile: true,
    isScented: true,
    tags: ["cozy", "scented", "bestseller"]
  },
  {
    id: "ITEM_CHOCO_DARK_HAZELNUT",
    name: "Single-Origin Roasted Hazelnut Dark Cocoa (70%)",
    category: "CONFECTIONS",
    volumeCm3: 450,
    weightGrams: 150,
    pricePaise: 42000, // ₹420
    isFragile: false,
    isScented: false,
    tags: ["sweet", "artisan"]
  },
  {
    id: "ITEM_TEA_ROSE_BLUSH",
    name: "Himalayan Rose Blush Tisane (Loose Leaf)",
    category: "BEVERAGES",
    volumeCm3: 600,
    weightGrams: 100,
    pricePaise: 49000, // ₹490
    isFragile: false,
    isScented: true,
    tags: ["floral", "calming"]
  },
  {
    id: "ITEM_BRASS_BELL",
    name: "Hand-Etched Vintage Brass Bell / Paperweight",
    category: "KEEPSAKES",
    volumeCm3: 350,
    weightGrams: 280,
    pricePaise: 55000, // ₹550
    isFragile: false,
    isScented: false,
    tags: ["metal", "keepsake"]
  },
  {
    id: "ITEM_SILK_NAPKIN",
    name: "Washed Raw Silk Cocktail Napkins (Set of 2)",
    category: "LINEN",
    volumeCm3: 300,
    weightGrams: 80,
    pricePaise: 38000, // ₹380
    isFragile: false,
    isScented: false,
    tags: ["textile", "monogrammable"]
  },
  {
    id: "ITEM_BATH_SALTS",
    name: "French Clay & Bergamot Botanical Bath Soak",
    category: "SELF_CARE",
    volumeCm3: 850,
    weightGrams: 400,
    pricePaise: 62000, // ₹620
    isFragile: true,
    isScented: true,
    tags: ["pamper", "scented"]
  },
  {
    id: "ITEM_TONIC_ELDERFLOWER",
    name: "Craft Elderflower & Pear Sparkling Tonic",
    category: "BEVERAGES",
    volumeCm3: 700,
    weightGrams: 520,
    pricePaise: 34000, // ₹340
    isFragile: true,
    isScented: false,
    tags: ["sip", "celebration"]
  },
  {
    id: "ITEM_LEATHER_JOURNAL",
    name: "Full-Grain Leather Bound Pocket Journal",
    category: "KEEPSAKES",
    volumeCm3: 500,
    weightGrams: 220,
    pricePaise: 79000, // ₹790
    isFragile: false,
    isScented: false,
    tags: ["keepsake", "leather"]
  }
];

const RIBBONS = [
  { id: "RIB_SATIN_CREAM", name: "Satin Silk (Warm Ivory)", pricePaise: 0, hex: "#F5F2EB" },
  { id: "RIB_VELVET_BORDEAUX", name: "Crushed Velvet (Bordeaux Wine)", pricePaise: 15000, hex: "#4A1E29" },
  { id: "RIB_RAW_GOLD", name: "Raw Silk (Clay Gold)", pricePaise: 12000, hex: "#C89D42" },
  { id: "RIB_GROSGRAIN_FOREST", name: "French Grosgrain (Forest Pine)", pricePaise: 10000, hex: "#2E5A44" }
];

const WAX_SEALS = [
  { id: "WAX_BOTANICAL_GOLD", name: "Botanical Olive Sprig (Antique Gold)", pricePaise: 12000 },
  { id: "WAX_CREST_BORDEAUX", name: "Atelier Monogram Crest (Deep Bordeaux)", pricePaise: 15000 },
  { id: "WAX_HEART_ROSE", name: "Minimalist Heart (Rose Blush)", pricePaise: 12000 },
  { id: "WAX_FLORAL_SAGE", name: "Wildflower Wreath (Sage Green)", pricePaise: 12000 }
];

class HamperBuilderEngine {
  static getOptions() {
    return {
      boxes: Object.values(BOX_BASES),
      items: ATELIER_ITEMS,
      ribbons: RIBBONS,
      waxSeals: WAX_SEALS,
      minItems: 3,
      maxItems: 8
    };
  }

  static validateConfiguration(config) {
    const boxId = config.boxId || "BOX_KRAFT_RIGID";
    const box = BOX_BASES[boxId] || BOX_BASES.BOX_KRAFT_RIGID;
    const selectedItemIds = Array.isArray(config.itemIds) ? config.itemIds : [];

    const selectedItems = selectedItemIds
      .map(id => ATELIER_ITEMS.find(item => item.id === id))
      .filter(Boolean);

    // 1. Calculate Volume & Weight
    let totalVolumeCm3 = 0;
    let totalWeightGrams = 0;
    let scentedCount = 0;
    let fragileCount = 0;

    for (const item of selectedItems) {
      totalVolumeCm3 += item.volumeCm3;
      totalWeightGrams += item.weightGrams;
      if (item.isScented) scentedCount++;
      if (item.isFragile) fragileCount++;
    }

    const fullnessPercent = Math.min(150, Math.round((totalVolumeCm3 / box.capacityCm3) * 100));

    // Fullness status
    let fullnessStatus = "OPTIMAL";
    if (fullnessPercent === 0) fullnessStatus = "EMPTY";
    else if (fullnessPercent < 45) fullnessStatus = "UNDERFILLED";
    else if (fullnessPercent <= 90) fullnessStatus = "OPTIMAL";
    else if (fullnessPercent <= 100) fullnessStatus = "FULL";
    else fullnessStatus = "OVERFILLED";

    // 2. Business Rules & Collisions
    const warnings = [];
    const errors = [];

    if (selectedItems.length < 3) {
      warnings.push("Add at least " + (3 - selectedItems.length) + " more item(s) for a beautifully curated gift box.");
    } else if (selectedItems.length > 8) {
      errors.push("Maximum 8 items per hamper box to ensure secure artisanal arrangement.");
    }

    if (fullnessStatus === "OVERFILLED") {
      errors.push("Selected items exceed box volume capacity by " + (fullnessPercent - 100) + "%. Choose a larger box or remove an item.");
    }

    if (scentedCount > 2) {
      warnings.push("You have chosen " + scentedCount + " fragrant items. Fragrances may mingle during transit; our studio will wrap each individually in glassine paper.");
    }

    if (fragileCount >= 3) {
      warnings.push("Multiple glassware items selected. Our atelier will include customized molded paper pulp buffers.");
    }

    return {
      isValid: errors.length === 0,
      box,
      selectedItems,
      itemCount: selectedItems.length,
      totalVolumeCm3,
      boxCapacityCm3: box.capacityCm3,
      fullnessPercent,
      fullnessStatus,
      totalWeightGrams,
      fragileCount,
      scentedCount,
      warnings,
      errors
    };
  }
}

module.exports = { HamperBuilderEngine, BOX_BASES, ATELIER_ITEMS, RIBBONS, WAX_SEALS };
`;

fs.writeFileSync(path.join(root, "server", "services", "hamperBuilder.js"), hamperBuilderCode, "utf8");
console.log("Created server/services/hamperBuilder.js");

// ----------------------------------------------------
// 2. deliveryService.js
// ----------------------------------------------------
const deliveryCode = `/**
 * Hampers by Her — Delivery & Serviceability Engine
 * Validates 6-digit Indian PIN codes and computes carrier dispatch SLAs.
 */

const METRO_PINCODES = [
  // Delhi NCR
  { prefix: "110", city: "New Delhi", state: "Delhi", zone: "METRO_AIR", slaDays: 2 },
  { prefix: "121", city: "Faridabad", state: "Haryana", zone: "METRO_AIR", slaDays: 2 },
  { prefix: "122", city: "Gurugram", state: "Haryana", zone: "METRO_AIR", slaDays: 2 },
  { prefix: "201", city: "Noida / Ghaziabad", state: "Uttar Pradesh", zone: "METRO_AIR", slaDays: 2 },
  // Mumbai Region
  { prefix: "400", city: "Mumbai", state: "Maharashtra", zone: "METRO_AIR", slaDays: 2 },
  { prefix: "401", city: "Thane", state: "Maharashtra", zone: "METRO_AIR", slaDays: 2 },
  // Bengaluru
  { prefix: "560", city: "Bengaluru", state: "Karnataka", zone: "METRO_AIR", slaDays: 2 },
  // Hyderabad
  { prefix: "500", city: "Hyderabad", state: "Telangana", zone: "METRO_AIR", slaDays: 2 },
  // Chennai
  { prefix: "600", city: "Chennai", state: "Tamil Nadu", zone: "METRO_AIR", slaDays: 2 },
  // Kolkata
  { prefix: "700", city: "Kolkata", state: "West Bengal", zone: "METRO_AIR", slaDays: 2 },
  // Pune
  { prefix: "411", city: "Pune", state: "Maharashtra", zone: "METRO_AIR", slaDays: 2 }
];

const TIER_1_PINCODES = [
  { prefix: "380", city: "Ahmedabad", state: "Gujarat", zone: "TIER_1", slaDays: 3 },
  { prefix: "302", city: "Jaipur", state: "Rajasthan", zone: "TIER_1", slaDays: 3 },
  { prefix: "226", city: "Lucknow", state: "Uttar Pradesh", zone: "TIER_1", slaDays: 3 },
  { prefix: "452", city: "Indore", state: "Madhya Pradesh", zone: "TIER_1", slaDays: 3 },
  { prefix: "160", city: "Chandigarh", state: "Punjab", zone: "TIER_1", slaDays: 3 },
  { prefix: "682", city: "Kochi", state: "Kerala", zone: "TIER_1", slaDays: 3 }
];

class DeliveryService {
  /**
   * Check 6-digit India PIN code serviceability
   * @param {string} pincode
   * @returns {Object}
   */
  static checkPincode(pincode) {
    if (!pincode || typeof pincode !== "string") {
      return { isServiceable: false, error: "Please enter a valid 6-digit PIN code." };
    }

    const cleanPin = pincode.trim();
    if (!/^\\d{6}$/.test(cleanPin)) {
      return { isServiceable: false, error: "Indian PIN code must be exactly 6 digits." };
    }

    if (cleanPin.startsWith("0")) {
      return { isServiceable: false, error: "Invalid PIN code format." };
    }

    const prefix3 = cleanPin.substring(0, 3);
    const metro = METRO_PINCODES.find(m => m.prefix === prefix3);
    if (metro) {
      return {
        isServiceable: true,
        pincode: cleanPin,
        city: metro.city,
        state: metro.state,
        zone: metro.zone,
        carrier: "Blue Dart / Delhivery Express Air",
        standardDays: metro.slaDays,
        expressAvailable: true,
        expressDays: 1,
        message: "Express 48hr delivery available in " + metro.city + "."
      };
    }

    const tier1 = TIER_1_PINCODES.find(t => t.prefix === prefix3);
    if (tier1) {
      return {
        isServiceable: true,
        pincode: cleanPin,
        city: tier1.city,
        state: tier1.state,
        zone: tier1.zone,
        carrier: "Shiprocket / Delhivery Air",
        standardDays: tier1.slaDays,
        expressAvailable: true,
        expressDays: 2,
        message: "Pan-India delivery available in " + tier1.city + " within 3 business days."
      };
    }

    // Rest of serviceable India
    return {
      isServiceable: true,
      pincode: cleanPin,
      city: "National Delivery Zone",
      state: "India",
      zone: "REST_OF_INDIA",
      carrier: "Shiprocket Surface Priority",
      standardDays: 5,
      expressAvailable: false,
      expressDays: null,
      message: "Pan-India delivery available within 4-6 business days."
    };
  }
}

module.exports = { DeliveryService };
`;

fs.writeFileSync(path.join(root, "server", "services", "deliveryService.js"), deliveryCode, "utf8");
console.log("Created server/services/deliveryService.js");

// ----------------------------------------------------
// 3. orderService.js
// ----------------------------------------------------
const orderCode = `/**
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

  static listRecentOrders(limit = 10) {
    return Array.from(ordersDb.values()).slice(-limit);
  }
}

module.exports = { OrderService, ORDER_STATUS };
`;

fs.writeFileSync(path.join(root, "server", "services", "orderService.js"), orderCode, "utf8");
console.log("Created server/services/orderService.js");

// ----------------------------------------------------
// 4. api.js
// ----------------------------------------------------
const apiCode = `const express = require("express");
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

module.exports = router;
`;

fs.writeFileSync(path.join(root, "server", "routes", "api.js"), apiCode, "utf8");
console.log("Created server/routes/api.js");

// ----------------------------------------------------
// 5. server/index.js
// ----------------------------------------------------
const serverCode = `const express = require("express");
const cors = require("cors");
const path = require("path");
const apiRoutes = require("./routes/api");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(\`[\${new Date().toISOString()}] \${req.method} \${req.url} \${res.statusCode} - \${ms}ms\`);
  });
  next();
});

// API Routes
app.use("/api/v1", apiRoutes);

// Static Web App Serving
const websitePath = path.join(__dirname, "..", "website");
app.use(express.static(websitePath));

// Fallback to index.html for client-side navigation
app.get("*", (req, res) => {
  res.sendFile(path.join(websitePath, "index.html"));
});

// Error handling (RFC 7807)
app.use((err, req, res, next) => {
  console.error("Internal Server Error:", err);
  res.status(500).json({
    type: "https://hampersbyher.com/errors/internal",
    title: "Internal Server Error",
    status: 500,
    detail: err.message,
    instance: req.originalUrl
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(\`====================================================\`);
    console.log(\`  HAMPERS BY HER — LUXURY E-COMMERCE PLATFORM\`);
    console.log(\`  Server running on http://localhost:\${PORT}\`);
    console.log(\`  REST API v1 mounted at http://localhost:\${PORT}/api/v1\`);
    console.log(\`====================================================\`);
  });
}

module.exports = app;
`;

fs.writeFileSync(path.join(root, "server", "index.js"), serverCode, "utf8");
console.log("Created server/index.js");

console.log("Backend implementation files successfully created!");
