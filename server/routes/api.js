const express = require("express");
const router = express.Router();

const { PricingEngine } = require("../services/pricingEngine");
const { HamperBuilderEngine } = require("../services/hamperBuilder");
const { DeliveryService } = require("../services/deliveryService");
const { OrderService } = require("../services/orderService");
const { CatalogService } = require("../services/catalogService");
const { instagramService } = require("../services/instagramService");
const { whatsappService } = require("../services/whatsappService");

// Platform Distributed Services & Scalability Subsystems
const { SmartPaymentRouter } = require("../../platform/services/payment-service/smartRouter");
const { CacheGrid } = require("../../platform/services/cache-service/cacheGrid");
const { serviceMesh } = require("../../platform/services/mesh-service/serviceMesh");
const { inventoryEngine } = require("../../platform/services/scaling-service/inventoryLock");

// Advanced Computational Algorithms (39_DSA.md) & Visualizer
const {
  STANDARD_BOXES,
  evaluateHamperPacking,
  calculateDeterministicOrderPricing,
  serializePricingLedger,
  couponEngine,
  tokenizeSearchIntent,
  rankItemsByFuzzyQuery,
  optimizeHamperForBudget,
  scoreInboundLead,
  leadPriorityQueue,
  resolveDeliverySla
} = require("../../platform/services/dsa");

const {
  generateHamperPreviewSvg,
  generateHamperPreviewDataUri
} = require("../../platform/services/atelier-visualizer/previewGenerator");

const smartRouter = new SmartPaymentRouter();
const cacheGrid = new CacheGrid();

// ═══════════════════════════════════════════════════════════
// 1. PRODUCT CATALOG & ENRICHED ITEM VIEW (WITH CACHE GRID)
// ═══════════════════════════════════════════════════════════

// List products with filtering and singleflight request coalescing
router.get("/catalog/products", async (req, res) => {
  const { occasion, search, limit, offset } = req.query;
  const cacheKey = `catalog:products:${occasion || "all"}:${search || "none"}:${limit || 20}:${offset || 0}`;

  const result = await cacheGrid.getOrSet(cacheKey, () => {
    return CatalogService.getProducts({
      occasion,
      search,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0
    });
  }, 60000);

  res.json({
    success: true,
    data: {
      count: result.total,
      items: result.items
    }
  });
});

// Enriched Item Detail View (PDP) with cache
router.get("/catalog/products/:id", async (req, res) => {
  const cacheKey = `catalog:product:${req.params.id}`;
  const cached = await cacheGrid.getOrSet(cacheKey, () => {
    const item = CatalogService.getProductById(req.params.id);
    if (!item) return null;
    const recommendations = CatalogService.getRecommendations(item.id);
    return { ...item, recommendations };
  }, 60000);

  if (!cached) {
    return res.status(404).json({
      success: false,
      error: { code: "PRODUCT_NOT_FOUND", message: `Hamper not found: ${req.params.id}` }
    });
  }

  res.json({
    success: true,
    data: cached
  });
});

// ═══════════════════════════════════════════════════════════
// 2. BESPOKE HAMPER BUILDER
// ═══════════════════════════════════════════════════════════

router.get("/builder/options", (req, res) => {
  res.json({
    success: true,
    data: HamperBuilderEngine.getOptions()
  });
});

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

// ═══════════════════════════════════════════════════════════
// 3. LOGISTICS & DELIVERY SERVICEABILITY
// ═══════════════════════════════════════════════════════════

router.get("/delivery/serviceability/:pincode", (req, res) => {
  const result = DeliveryService.checkPincode(req.params.pincode);
  res.json({
    success: true,
    data: result
  });
});

// ═══════════════════════════════════════════════════════════
// 4. CART & CHECKOUT
// ═══════════════════════════════════════════════════════════

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

router.post("/checkout/create-order", async (req, res) => {
  try {
    // Acquire atomic stock reservations for items if sku provided
    const items = req.body.items || [];
    for (const item of items) {
      if (item.sku) {
        if (inventoryEngine.getStock(item.sku).total === 0) {
          inventoryEngine.setStock(item.sku, 100);
        }
        await inventoryEngine.reserve(item.sku, item.quantity || 1, req.body.customer?.email || "guest");
      }
    }

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

router.post("/payments/verify", async (req, res) => {
  const { orderNumber, paymentId, method } = req.body;
  if (!orderNumber) {
    return res.status(400).json({ success: false, error: { message: "orderNumber is required" } });
  }

  try {
    const order = OrderService.confirmPayment(orderNumber, { paymentId, method });

    // Programmatically trigger WhatsApp HSM notification asynchronously
    whatsappService.notifyOrderEvent(order, "ORDER_CONFIRMED").catch(err => {
      console.warn("WhatsApp notification error (non-blocking):", err.message);
    });

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

router.get("/coupons", (req, res) => {
  res.json({ success: true, data: PricingEngine.getAvailableCoupons() });
});

// ═══════════════════════════════════════════════════════════
// 5. INSTAGRAM GRAPH API & LEAD AUTOMATION
// ═══════════════════════════════════════════════════════════

// Live Instagram Feed
router.get("/instagram/feed", (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
  res.json(instagramService.getFeed({ limit }));
});

// Manual/Cron Instagram Media Sync
router.post("/instagram/sync", async (req, res) => {
  const { accessToken, accountId } = req.body || {};
  const result = await instagramService.syncMedia({ accessToken, accountId });
  res.json(result);
});

// Meta Webhook Challenge Handshake (GET)
router.get("/instagram/webhook", (req, res) => {
  const verification = instagramService.verifyWebhookChallenge(req.query);
  if (verification.success) {
    return res.status(200).send(verification.challenge);
  }
  return res.status(403).json({ error: verification.error });
});

// Meta Webhook Event Handler (POST)
router.post("/instagram/webhook", (req, res) => {
  const signature = req.headers["x-hub-signature-256"];
  const isValid = instagramService.verifyWebhookSignature(req.rawBody, signature);

  if (!isValid && process.env.NODE_ENV === "production") {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const result = instagramService.processIncomingWebhook(req.body);
  // Meta requires immediate 200 OK
  res.status(200).json(result);
});

// Captured CRM Leads from Instagram
router.get("/instagram/leads", (req, res) => {
  res.json({
    success: true,
    data: instagramService.getLeads()
  });
});

// ═══════════════════════════════════════════════════════════
// 6. WHATSAPP BUSINESS CLOUD API & ATELIER CONCIERGE
// ═══════════════════════════════════════════════════════════

// Meta Webhook Challenge Handshake (GET)
router.get("/whatsapp/webhook", (req, res) => {
  const verification = whatsappService.verifyWebhookChallenge(req.query);
  if (verification.success) {
    return res.status(200).send(verification.challenge);
  }
  return res.status(403).json({ error: verification.error });
});

// Meta Inbound Webhook Event Handler (POST)
router.post("/whatsapp/webhook", async (req, res) => {
  const signature = req.headers["x-hub-signature-256"];
  const isValid = whatsappService.verifyWebhookSignature(req.rawBody, signature);

  if (!isValid && process.env.NODE_ENV === "production") {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const result = await whatsappService.handleIncomingWebhook(req.body);
  res.status(200).json(result);
});

// PDP Item WhatsApp Inquiry (Dispatches pre-filled inquiry to atelier)
router.post("/whatsapp/inquire", async (req, res) => {
  const { phone, productId, customerName, ribbon, waxSeal, pinCode } = req.body;
  if (!productId) {
    return res.status(400).json({ success: false, error: "productId is required" });
  }

  const product = CatalogService.getProductById(productId);
  if (!product) {
    return res.status(404).json({ success: false, error: "Product not found" });
  }

  const targetPhone = phone || "919876543210";
  const inquiryText = `Inquiry from ${customerName || "a Patron"} for *${product.title}* (₹${product.priceRupees}).\n` +
    `• Ribbon: ${ribbon || "Natural Silk"}\n` +
    `• Wax Seal: ${waxSeal || "Botanica"}\n` +
    `• PIN Code: ${pinCode || "Not specified"}\n\n` +
    `Product Link: https://hampersbyher.com/#collections?highlight=${product.id}`;

  const sendResult = await whatsappService.sendTextMessage(targetPhone, inquiryText, true);

  res.json({
    success: true,
    data: {
      inquirySent: sendResult.success,
      inquiryText,
      waMeUrl: `https://wa.me/919876543210?text=${encodeURIComponent(inquiryText)}`
    }
  });
});

// Outbound Transactional Notification Dispatch
router.post("/whatsapp/notify/order", async (req, res) => {
  const { orderNumber, eventType } = req.body;
  const order = OrderService.getOrderByNumber(orderNumber);
  if (!order) {
    return res.status(404).json({ success: false, error: "Order not found" });
  }

  const result = await whatsappService.notifyOrderEvent(order, eventType || "ORDER_CONFIRMED");
  res.json({ success: true, result });
});

// Simulated Incoming Message (for testing / development)
router.post("/whatsapp/simulate-incoming", async (req, res) => {
  const { from, name, text } = req.body;
  if (!from || !text) {
    return res.status(400).json({ success: false, error: "from and text are required" });
  }

  const simulatedPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_SIMULATED_123",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "919876543210", phone_number_id: "100293847592019" },
              contacts: [{ profile: { name: name || "Test Patron" }, wa_id: from }],
              messages: [
                {
                  from,
                  id: `wamid.SIM_${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: { body: text },
                  type: "text"
                }
              ]
            }
          }
        ]
      }
    ]
  };

  const result = await whatsappService.handleIncomingWebhook(simulatedPayload);
  res.json({ success: true, data: result });
});

// ═══════════════════════════════════════════════════════════
// 7. VOICE AI STATUS & TELEMETRY
// ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════
// 8. MULTI-GATEWAY SMART PAYMENT ROUTER
// ═══════════════════════════════════════════════════════════

router.post("/payments/initiate", (req, res) => {
  const { orderId, amountPaise, currency, clientType, idempotencyKey } = req.body;
  if (!orderId || !amountPaise) {
    return res.status(400).json({
      success: false,
      error: "orderId and amountPaise are required"
    });
  }

  const session = smartRouter.routeCheckout({
    orderId,
    amountPaise,
    currency: currency || "INR",
    clientType: clientType || "mobile",
    idempotencyKey
  });

  const responseData = {
    ...session,
    actionUrl: session.actionUrl || session.upiPayload?.deepLink,
    qrCodeString: session.upiPayload?.qrString,
    expiresInSeconds: session.upiPayload?.refreshIntervalSec
  };

  res.json({
    success: true,
    data: responseData
  });
});

router.get("/payments/gateways/health", (req, res) => {
  res.json({
    success: true,
    data: smartRouter.getHealthStatus()
  });
});

router.post("/payments/smart-webhook", (req, res) => {
  const gateway = req.headers["x-gateway"] || "razorpay";
  const signature = req.headers["x-signature"] || req.headers["x-hub-signature-256"];
  const timestamp = parseInt(req.headers["x-timestamp"] || "0", 10);

  const verification = smartRouter.verifyWebhook({
    gateway,
    rawBody: req.rawBody,
    signature,
    timestamp
  });

  if (!verification.valid && process.env.NODE_ENV === "production") {
    return res.status(401).json({ success: false, error: verification.reason });
  }

  res.json({
    success: true,
    data: {
      gateway,
      signatureVerified: verification.valid,
      reason: verification.reason,
      processed: true
    }
  });
});

router.post("/payments/refund", async (req, res) => {
  const { orderId, refundAmountPaise, vpa } = req.body;
  if (!orderId || !refundAmountPaise) {
    return res.status(400).json({ success: false, error: "orderId and refundAmountPaise are required" });
  }

  const result = await smartRouter.processInstantRefund({
    orderId,
    amountPaise: refundAmountPaise,
    vpa: vpa || "customer@upi"
  });
  res.json({ success: true, data: result });
});

// ═══════════════════════════════════════════════════════════
// 9. PLATFORM OBSERVABILITY, SERVICE MESH & CACHE TELEMETRY
// ═══════════════════════════════════════════════════════════

router.get("/system/health", async (req, res) => {
  const meshHealth = await serviceMesh.getSystemHealth();
  res.json({
    success: true,
    data: {
      status: meshHealth.status === "HEALTHY" ? "healthy" : "degraded",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      cacheMetrics: cacheGrid.getMetrics(),
      mesh: meshHealth
    }
  });
});

router.get("/system/mesh/health", async (req, res) => {
  const meshHealth = await serviceMesh.getSystemHealth();
  res.json({
    success: true,
    data: meshHealth
  });
});

router.get("/system/cache/metrics", (req, res) => {
  res.json({
    success: true,
    data: cacheGrid.getMetrics()
  });
});

// ═══════════════════════════════════════════════════════════
// 10. ADVANCED COMPUTATIONAL ENGINES (39_DSA.md ALGORITHMS)
// ═══════════════════════════════════════════════════════════

// Algorithm 1: 3D Volumetric Bin-Packing & Orientation/Thermal Compatibility
router.post("/dsa/bin-packing", (req, res) => {
  try {
    const { box, boxSizeKey, items } = req.body;
    const targetBox = box || STANDARD_BOXES[boxSizeKey || "MEDIUM"] || STANDARD_BOXES.MEDIUM;
    const result = evaluateHamperPacking(targetBox, items || []);
    res.json({
      success: true,
      data: {
        box: targetBox,
        evaluation: result
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Algorithm 2: Deterministic Integer Paise Financial Ledger
router.post("/dsa/pricing-ledger", (req, res) => {
  try {
    const ledger = calculateDeterministicOrderPricing(req.body);
    const serialized = serializePricingLedger(ledger);
    res.json({
      success: true,
      data: serialized
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Algorithm 3: Rule-Based Coupon DAG Precedence
router.post("/dsa/coupon-dag", (req, res) => {
  try {
    const { couponCode, candidateCodes, grossSubtotalPaise, categories, customerContext } = req.body;

    if (candidateCodes && Array.isArray(candidateCodes)) {
      const optimal = couponEngine.resolveOptimalPromotion({
        candidateCodes,
        grossSubtotalPaise,
        categories,
        customerContext
      });
      return res.json({
        success: true,
        data: {
          optimalPromotion: optimal ? {
            ...optimal,
            discountPaise: Number(optimal.discountPaise)
          } : null
        }
      });
    }

    const evaluation = couponEngine.evaluateCoupon({
      couponCode,
      grossSubtotalPaise,
      categories,
      customerContext
    });

    res.json({
      success: true,
      data: {
        ...evaluation,
        discountPaise: evaluation.discountPaise !== undefined ? Number(evaluation.discountPaise) : 0
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Algorithm 4: Colloquial Intent Tokenizer & Trigram Fuzzy Matcher
router.post("/dsa/search-intent", (req, res) => {
  try {
    const { query, rankCatalog } = req.body;
    const intent = tokenizeSearchIntent(query);

    let rankedResults = null;
    if (rankCatalog) {
      const catalog = CatalogService.getProducts({ limit: 50 }).items;
      rankedResults = rankItemsByFuzzyQuery(catalog, query);
    }

    res.json({
      success: true,
      data: {
        intent: {
          ...intent,
          maxPricePaise: intent.maxPricePaise !== null ? Number(intent.maxPricePaise) : null,
          minPricePaise: intent.minPricePaise !== null ? Number(intent.minPricePaise) : null
        },
        rankedResults
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Algorithm 5: Multi-Criteria Budget Knapsack Optimizer
router.post("/dsa/budget-knapsack", (req, res) => {
  try {
    const { targetBudgetPaise, preferredCategories } = req.body;
    const result = optimizeHamperForBudget({
      targetBudgetPaise,
      preferredCategories
    });
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Algorithm 7: Omnichannel Conversational Lead Scoring & Max-Heap Priority
router.post("/dsa/lead-priority", (req, res) => {
  try {
    const { lead, enqueue } = req.body;
    if (!lead) {
      return res.status(400).json({ success: false, error: "lead object is required" });
    }

    if (enqueue) {
      const enqueuedNode = leadPriorityQueue.insert(lead);
      return res.json({
        success: true,
        data: {
          enqueued: true,
          lead: enqueuedNode,
          queueSize: leadPriorityQueue.size(),
          highestPriority: leadPriorityQueue.peekHighest()
        }
      });
    }

    const evaluation = scoreInboundLead(lead);
    res.json({
      success: true,
      data: evaluation
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Algorithm 8: Dynamic Pincode SLA, Dispatch Distance & Delivery Interval
router.post("/dsa/logistics-sla", (req, res) => {
  try {
    const { pincode, isBespokePersonalization, quantity } = req.body;
    const result = resolveDeliverySla({
      pincode,
      isBespokePersonalization,
      quantity
    });
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// 11. ATELIER BESPOKE HAMPER PROCEDURAL VISUALIZER
// ═══════════════════════════════════════════════════════════

router.post("/atelier/visualize-hamper", (req, res) => {
  try {
    const svg = generateHamperPreviewSvg(req.body);
    const dataUri = generateHamperPreviewDataUri(req.body);
    res.json({
      success: true,
      data: {
        svg,
        dataUri,
        options: req.body
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
