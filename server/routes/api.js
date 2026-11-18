const express = require("express");
const router = express.Router();

const { PricingEngine } = require("../services/pricingEngine");
const { HamperBuilderEngine } = require("../services/hamperBuilder");
const { DeliveryService } = require("../services/deliveryService");
const { OrderService } = require("../services/orderService");
const { CatalogService } = require("../services/catalogService");
const { instagramService } = require("../services/instagramService");
const { whatsappService } = require("../services/whatsappService");
const { authService } = require("../services/authService");
const { adminService } = require("../services/adminService");
const { logisticsCourierService } = require("../services/logisticsCourierService");
const { notificationService } = require("../services/notificationService");
const {
  AUDIO_CONFIG,
  DEFAULT_VAD_CONFIG,
  createLiveKitAccessToken,
  verifyVapiSecret
} = require("../services/voiceProviders");

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

// Express 4 async error bridge so rejected promises reach RFC 7807 error middleware
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// RBAC Staff Authorization Middleware (25_AUTH_SECURITY.md)
// Always validates Bearer JWT if provided (rejecting tampered tokens or non-staff roles).
// In production or when REQUIRE_ADMIN_AUTH=true, fails closed if no Bearer token is supplied.
function requireStaffPermission(permission) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    const enforceStrict = process.env.NODE_ENV === "production" || process.env.REQUIRE_ADMIN_AUTH === "true";

    if (!authHeader) {
      if (enforceStrict) {
        return res.status(401).json({
          type: "https://hampersbyher.com/errors/unauthorized",
          title: "Unauthorized",
          status: 401,
          detail: "Staff Bearer token is required for this endpoint.",
          instance: req.originalUrl
        });
      }
      return next();
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        type: "https://hampersbyher.com/errors/unauthorized",
        title: "Unauthorized",
        status: 401,
        detail: "Authorization header must use Bearer scheme.",
        instance: req.originalUrl
      });
    }

    const token = authHeader.slice(7).trim();
    const claims = authService.verifyJwtToken(token);
    if (!claims) {
      return res.status(401).json({
        type: "https://hampersbyher.com/errors/unauthorized",
        title: "Invalid or Expired Token",
        status: 401,
        detail: "Bearer JWT signature verification failed or token has expired.",
        instance: req.originalUrl
      });
    }

    if (!authService.hasPermission(claims.role, permission)) {
      return res.status(403).json({
        type: "https://hampersbyher.com/errors/forbidden",
        title: "Insufficient Permissions",
        status: 403,
        detail: `Role '${claims.role}' lacks required permission '${permission}'.`,
        instance: req.originalUrl
      });
    }

    req.staffClaims = claims;
    next();
  };
}

// ═══════════════════════════════════════════════════════════
// SLIDING-WINDOW IP RATE LIMITING MIDDLEWARE (25_AUTH_SECURITY.md)
// ═══════════════════════════════════════════════════════════

function createRateLimiter({ windowMs = 60000, maxRequests = 30, message = "Too many requests. Please slow down." }) {
  const requests = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of requests.entries()) {
      const active = timestamps.filter(t => now - t < windowMs);
      if (active.length === 0) {
        requests.delete(ip);
      } else {
        requests.set(ip, active);
      }
    }
  }, windowMs).unref();

  return (req, res, next) => {
    if (process.env.DISABLE_RATE_LIMIT === "true") return next();

    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "127.0.0.1";
    const now = Date.now();
    const timestamps = requests.get(clientIp) || [];
    const validTimestamps = timestamps.filter(t => now - t < windowMs);

    if (validTimestamps.length >= maxRequests) {
      const oldest = validTimestamps[0];
      const retryAfterSeconds = Math.ceil((windowMs - (now - oldest)) / 1000);
      res.setHeader("Retry-After", retryAfterSeconds);
      return res.status(429).json({
        type: "https://hampersbyher.com/errors/rate-limit-exceeded",
        title: "Too Many Requests",
        status: 429,
        detail: message,
        retryAfterSeconds,
        instance: req.originalUrl
      });
    }

    validTimestamps.push(now);
    requests.set(clientIp, validTimestamps);
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - validTimestamps.length));
    next();
  };
}

const authRateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 20,
  message: "Excessive authentication requests. Please wait before retrying."
});

const checkoutRateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 40,
  message: "Too many checkout requests initiated from this IP. Please wait."
});

// ═══════════════════════════════════════════════════════════
// 1. PRODUCT CATALOG & ENRICHED ITEM VIEW (WITH CACHE GRID)
// ═══════════════════════════════════════════════════════════

// List products with filtering and singleflight request coalescing
router.get("/catalog/products", asyncHandler(async (req, res) => {
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
}));

// Enriched Item Detail View (PDP) with cache
router.get("/catalog/products/:id", asyncHandler(async (req, res) => {
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
}));

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

router.post("/checkout/create-order", checkoutRateLimiter, asyncHandler(async (req, res) => {
  const acquiredReservations = [];
  const rollbackReservations = async () => {
    for (const resId of acquiredReservations) {
      await inventoryEngine.release(resId);
    }
  };

  try {
    // Acquire atomic stock reservations for items if sku provided (sorted by SKU to avoid deadlocks)
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const skuItems = items.filter((item) => item && item.sku).sort((a, b) => String(a.sku).localeCompare(String(b.sku)));

    for (const item of skuItems) {
      const currentStock = inventoryEngine.getStock(item.sku);
      if (!inventoryEngine.stockLevels.has(item.sku) && currentStock.total === 0) {
        inventoryEngine.setStock(item.sku, 100);
      }
      const qty = item.quantity !== undefined ? item.quantity : 1;
      if (qty < 1) {
        await rollbackReservations();
        return res.status(400).json({
          success: false,
          error: { code: "INVALID_ITEM_QUANTITY", message: "Item quantity must be at least 1." }
        });
      }
      const reservation = await inventoryEngine.reserve(item.sku, qty, req.body.customer?.email || "guest");
      if (!reservation.success) {
        await rollbackReservations();
        return res.status(409).json({
          success: false,
          error: {
            code: reservation.reason || "INSUFFICIENT_STOCK",
            message: `Insufficient stock for SKU ${item.sku} (requested ${qty}, available ${reservation.available ?? 0}).`
          }
        });
      }
      acquiredReservations.push(reservation.reservationId);
    }

    const order = OrderService.createOrder(req.body);
    order.inventoryReservationIds = acquiredReservations;
    OrderService.syncPersistence();

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
    await rollbackReservations();
    res.status(400).json({
      success: false,
      error: { code: "ORDER_CREATION_FAILED", message: err.message }
    });
  }
}));

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
router.post("/instagram/sync", requireStaffPermission("orders:write"), asyncHandler(async (req, res) => {
  const { accessToken, accountId } = req.body || {};
  const result = await instagramService.syncMedia({ accessToken, accountId });
  res.json(result);
}));

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
router.get("/instagram/leads", requireStaffPermission("orders:read"), (req, res) => {
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

// Simulated Incoming Message (strictly disabled in production)
router.post("/whatsapp/simulate-incoming", asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      success: false,
      error: "SIMULATION_DISABLED_IN_PRODUCTION"
    });
  }
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
}));

// ═══════════════════════════════════════════════════════════
// 7. VOICE AI STATUS, VAPI WEBHOOK & LIVEKIT WEBRTC TOKENS
// ═══════════════════════════════════════════════════════════

router.get("/voice/status", (req, res) => {
  const gateway = req.app?.locals?.voiceGateway;
  const liveTelemetry = gateway ? gateway.getMetrics() : null;

  res.json({
    success: true,
    data: {
      status: "operational",
      version: "2.0.0",
      websocketEndpoint: "/api/v1/voice/stream",
      vapiWebhookEndpoint: "/api/v1/voice/vapi/webhook",
      livekitTokenEndpoint: "/api/v1/voice/livekit/token",
      supportedFormats: [AUDIO_CONFIG.ENCODING],
      sampleRates: [AUDIO_CONFIG.CLIENT_SAMPLE_RATE_HZ, AUDIO_CONFIG.REALTIME_SAMPLE_RATE_HZ],
      audioConfig: {
        encoding: AUDIO_CONFIG.ENCODING,
        clientSampleRateHz: AUDIO_CONFIG.CLIENT_SAMPLE_RATE_HZ,
        realtimeSampleRateHz: AUDIO_CONFIG.REALTIME_SAMPLE_RATE_HZ,
        channels: AUDIO_CONFIG.CHANNELS,
        frameDurationMs: AUDIO_CONFIG.FRAME_DURATION_MS,
        clientChunkBytes: AUDIO_CONFIG.CLIENT_CHUNK_BYTES
      },
      vadDefaults: { ...DEFAULT_VAD_CONFIG },
      activeEngine: process.env.OPENAI_API_KEY
        ? "openai_realtime"
        : (process.env.DEEPGRAM_API_KEY && process.env.ELEVENLABS_API_KEY
          ? "deepgram_elevenlabs_pipeline"
          : "local_atelier_sandbox"),
      models: [
        { id: "gpt-4o-realtime-preview", type: "speech-to-speech", active: Boolean(process.env.OPENAI_API_KEY) },
        { id: "deepgram-nova-2", type: "streaming-stt", active: Boolean(process.env.DEEPGRAM_API_KEY) },
        { id: "eleven_turbo_v2_5", type: "streaming-tts", active: Boolean(process.env.ELEVENLABS_API_KEY) },
        { id: "hampers-atelier-sandbox-v1", type: "domain-orchestrator", active: true }
      ],
      tools: [
        "searchHampers",
        "curateBudgetHamper",
        "customizeHamper",
        "dictateCardMessage",
        "checkOrderStatus",
        "estimateDelivery"
      ],
      telemetry: liveTelemetry
    }
  });
});

// Vapi Voice Agent Webhook (function-call tool dispatch + end-of-call-report archival)
router.post("/voice/vapi/webhook", (req, res) => {
  const providedSecret = req.headers["x-vapi-secret"];
  if (!verifyVapiSecret(providedSecret)) {
    return res.status(401).json({
      success: false,
      error: "INVALID_VAPI_WEBHOOK_SECRET"
    });
  }

  const gateway = req.app?.locals?.voiceGateway;
  const payload = req.body || {};
  const msg = payload.message || payload;
  const eventType = msg.type || payload.type;

  if (eventType === "function-call") {
    const fnCall = msg.functionCall || payload.functionCall || {};
    const name = fnCall.name;
    const args = fnCall.parameters || fnCall.arguments || {};
    if (!name) {
      return res.status(400).json({ success: false, error: "functionCall.name is required" });
    }
    const result = gateway
      ? gateway.executeToolCall(name, args)
      : { error: "Voice gateway unavailable" };
    return res.json({ result });
  }

  if (eventType === "end-of-call-report") {
    const callObj = msg.call || payload.call || {};
    const archived = gateway
      ? gateway.archiveCallTranscript({
          callId: callObj.id || payload.callId,
          transcript: msg.transcript || payload.transcript || "",
          summary: msg.summary || payload.summary || "",
          durationSeconds: msg.durationSeconds || payload.durationSeconds || 0,
          provider: "vapi"
        })
      : null;
    return res.json({ ok: true, archived });
  }

  return res.json({ ok: true, eventType: eventType || "ack" });
});

// Staff-protected access to archived Vapi / Voice AI call transcripts
router.get("/voice/vapi/transcripts", requireStaffPermission("orders:read"), (req, res) => {
  const gateway = req.app?.locals?.voiceGateway;
  const transcripts = gateway ? gateway.getTranscripts() : [];
  res.json({
    success: true,
    data: {
      count: transcripts.length,
      transcripts
    }
  });
});

// LiveKit WebRTC Room Access Token Generator (HS256 JWT with audio/data room grants)
router.post("/voice/livekit/token", (req, res) => {
  try {
    const { roomName, participantName, ttlSeconds } = req.body || {};
    const tokenBundle = createLiveKitAccessToken({
      roomName: roomName || "atelier-concierge-lobby",
      participantName: participantName || `patron_${Date.now()}`,
      ttlSeconds: ttlSeconds ? Number(ttlSeconds) : 3600
    });
    res.json({
      success: true,
      data: tokenBundle
    });
  } catch (err) {
    const status = err.message.startsWith("LIVEKIT_NOT_CONFIGURED") ? 503 : 400;
    res.status(status).json({
      success: false,
      error: err.message
    });
  }
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

router.post("/payments/refund", requireStaffPermission("refunds:initiate"), asyncHandler(async (req, res) => {
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
}));

// ═══════════════════════════════════════════════════════════
// 9. PLATFORM OBSERVABILITY, SERVICE MESH & CACHE TELEMETRY
// ═══════════════════════════════════════════════════════════

router.get("/system/health", asyncHandler(async (req, res) => {
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
}));

router.get("/system/mesh/health", asyncHandler(async (req, res) => {
  const meshHealth = await serviceMesh.getSystemHealth();
  res.json({
    success: true,
    data: meshHealth
  });
}));

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
router.post(["/dsa/bin-packing", "/dsa/bin-pack-3d"], (req, res) => {
  try {
    const { box, boxSizeKey, boxType, items } = req.body;
    const targetBox = box || STANDARD_BOXES[boxSizeKey || boxType || "MEDIUM"] || STANDARD_BOXES.MEDIUM;
    const result = evaluateHamperPacking(targetBox, items || []);
    res.json({
      success: true,
      data: {
        box: targetBox,
        evaluation: result,
        fit: result.fits
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Algorithm 2: Deterministic Integer Paise Financial Ledger
router.post(["/dsa/pricing-ledger", "/dsa/calculate-pricing"], (req, res) => {
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
router.post(["/dsa/coupon-dag", "/dsa/evaluate-coupons"], (req, res) => {
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
router.post(["/dsa/search-intent", "/dsa/tokenize-intent"], (req, res) => {
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
router.post(["/dsa/budget-knapsack", "/dsa/knapsack-optimize"], (req, res) => {
  try {
    const { targetBudgetPaise, budgetPaise, preferredCategories } = req.body;
    const result = optimizeHamperForBudget({
      targetBudgetPaise: targetBudgetPaise || budgetPaise || 350000,
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

// ═══════════════════════════════════════════════════════════
// 12. CUSTOMER AUTHENTICATION & PATRON RBAC (25_AUTH_SECURITY.md)
// ═══════════════════════════════════════════════════════════

router.post("/auth/request-otp", authRateLimiter, (req, res) => {
  try {
    const { phone, channel } = req.body;
    const result = authService.requestOtp({ phone, channel });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post("/auth/verify-otp", authRateLimiter, (req, res) => {
  try {
    const { phone, otp } = req.body;
    const result = authService.verifyOtp({ phone, otp });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

router.post("/auth/staff-login", authRateLimiter, (req, res) => {
  try {
    const { pin, staffId } = req.body || {};
    const result = authService.authenticateStaffPin({ pin, staffId });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

router.get("/auth/me", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "MISSING_BEARER_TOKEN" });
  }

  const token = authHeader.slice(7);
  const claims = authService.verifyJwtToken(token);
  if (!claims) {
    return res.status(401).json({ success: false, error: "INVALID_OR_EXPIRED_TOKEN" });
  }

  const user = authService.getUserById(claims.userId);
  res.json({
    success: true,
    data: {
      user: user || { id: claims.userId, phone: claims.phone, role: claims.role, name: claims.name },
      claims
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 13. ATELIER STUDIO OPERATIONS OS & QC GATE (23_ADMIN_DASHBOARD.md)
// ═══════════════════════════════════════════════════════════

router.get("/admin/orders", requireStaffPermission("orders:read"), (req, res) => {
  const { status, qcPendingOnly } = req.query;
  const orders = adminService.getStudioOrders({
    status,
    qcPendingOnly: qcPendingOnly === "true" || qcPendingOnly === "1"
  });
  res.json({
    success: true,
    data: {
      count: orders.length,
      orders
    }
  });
});

router.get("/admin/orders/:orderNumber", requireStaffPermission("orders:read"), (req, res) => {
  const order = OrderService.getOrderByNumber(req.params.orderNumber);
  if (!order) {
    return res.status(404).json({ success: false, error: "ORDER_NOT_FOUND" });
  }
  res.json({ success: true, data: order });
});

router.post("/admin/orders/:orderNumber/transition", requireStaffPermission("orders:write"), (req, res) => {
  try {
    const { targetStatus, actorName, notes } = req.body;
    const updated = adminService.transitionOrderStatus({
      orderNumber: req.params.orderNumber,
      targetStatus,
      actorName,
      notes
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post(["/admin/orders/:orderNumber/qc-verify", "/admin/orders/:orderNumber/qc-inspect"], requireStaffPermission("orders:qc_verify"), (req, res) => {
  try {
    const { inspectorName, photoEvidenceUrl, photoProofUrl, photoProofHash, checklist, notes } = req.body;
    const result = adminService.verifyStudioQcGate({
      orderNumber: req.params.orderNumber,
      inspectorName,
      photoEvidenceUrl: photoEvidenceUrl || photoProofUrl,
      photoProofHash,
      checklist,
      notes
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get("/admin/orders/:orderNumber/packing-slip", requireStaffPermission("orders:read"), (req, res) => {
  try {
    const html = adminService.generatePrintablePackingSlip(req.params.orderNumber);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    res.status(404).send(`<h1>Error: ${escapeHtml(err.message)}</h1>`);
  }
});

router.get("/admin/metrics", requireStaffPermission("analytics:read"), (req, res) => {
  const metrics = adminService.getStudioMetrics();
  res.json({ success: true, data: metrics });
});

// ═══════════════════════════════════════════════════════════
// 14. LOGISTICS COURIER ADAPTER & AWB TRACKING (20_DELIVERY_LOGISTICS.md)
// ═══════════════════════════════════════════════════════════

router.post("/delivery/manifest", (req, res) => {
  try {
    const { orderNumber, grossWeightG, pickupSlot } = req.body;
    if (!orderNumber) {
      return res.status(400).json({ success: false, error: "orderNumber is required" });
    }
    const manifest = logisticsCourierService.generateShippingManifest({
      orderNumber,
      grossWeightG,
      pickupSlot
    });
    res.json({ success: true, data: manifest });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post("/delivery/carrier-webhook", (req, res) => {
  try {
    const result = logisticsCourierService.processTrackingWebhook(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get("/delivery/track/:identifier", (req, res) => {
  const rawId = String(req.params.identifier || "").trim();
  const details = logisticsCourierService.getTrackingDetails(rawId);
  if (details) {
    return res.json({ success: true, data: details });
  }

  // Fallback to real persisted OrderService record before courier AWB manifest is created
  const order = OrderService.getOrderByNumber(rawId.toUpperCase()) || OrderService.getOrderByNumber(rawId);
  if (order) {
    const status = order.status || "CONFIRMED";
    const createdAt = order.createdAt || new Date().toISOString();
    const updatedAt = order.updatedAt || createdAt;
    const checkpoints = [
      {
        status: "ORDER_PLACED",
        location: "Hampers by Her Storefront",
        message: `Artisanal order ${order.orderNumber} recorded and verified.`,
        timestamp: createdAt
      }
    ];
    if (["CONFIRMED", "IN_PRODUCTION", "QUALITY_CHECKED", "PACKED", "DISPATCHED", "DELIVERED"].includes(status)) {
      checkpoints.push({
        status: "PAYMENT_CONFIRMED",
        location: "New Delhi Atelier",
        message: "Payment authorized; assigned to master binder queue.",
        timestamp: updatedAt
      });
    }
    if (["IN_PRODUCTION", "QUALITY_CHECKED", "PACKED", "DISPATCHED", "DELIVERED"].includes(status)) {
      checkpoints.push({
        status: "IN_PRODUCTION",
        location: "Okhla Craft Studio",
        message: "Hand-tying raw silk ribbon, wax seal, and calligraphy note.",
        timestamp: updatedAt
      });
    }
    if (["QUALITY_CHECKED", "PACKED", "DISPATCHED", "DELIVERED"].includes(status)) {
      checkpoints.push({
        status: "QUALITY_CHECKED",
        location: "Studio QC Photo Gate",
        message: "Passed mandatory photographic inspection and protective packing.",
        timestamp: updatedAt
      });
    }
    if (["DISPATCHED", "DELIVERED"].includes(status)) {
      checkpoints.push({
        status,
        location: order.shippingAddress?.city || "Express Air Hub",
        message: "Handed over to BlueDart / Delhivery Express Air.",
        timestamp: updatedAt
      });
    }

    return res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        awbNumber: order.tracking?.awb || "Awaiting Courier Handover",
        carrier: order.tracking?.carrier || "BlueDart / Delhivery Express Air",
        status,
        checkpoints
      }
    });
  }

  return res.status(404).json({ success: false, error: "TRACKING_NOT_FOUND" });
});

// ═══════════════════════════════════════════════════════════
// 15. MULTI-CHANNEL NOTIFICATION DISPATCHER (30_NOTIFICATION_SYSTEM.md)
// ═══════════════════════════════════════════════════════════

router.post("/notifications/send", async (req, res) => {
  try {
    const { event, order, customerPhone, customerEmail } = req.body;
    if (!event || !order) {
      return res.status(400).json({ success: false, error: "event and order payload are required" });
    }
    const dispatchResult = await notificationService.dispatchOrderNotification({
      event,
      order,
      customerPhone,
      customerEmail
    });
    res.json({ success: true, data: dispatchResult });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/notifications/recent", requireStaffPermission("orders:read"), (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
  res.json({
    success: true,
    data: notificationService.getRecentNotifications(limit)
  });
});

module.exports = router;
