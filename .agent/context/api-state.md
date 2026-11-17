# API STATE — Hampers by Her Digital Commerce Ecosystem

## 1. Specification & Contract
- **Contract Source**: `docs/api/openapi.yaml` (OpenAPI 3.1.0).
- **Target URL**:
  - Production: `https://api.hampersbyher.com/api/v1`
  - Staging: `https://staging-api.hampersbyher.com/api/v1`
  - Local Dev / Test: `http://localhost:3000/api/v1`

## 2. Active REST & WebSocket Endpoint Inventory
### A. Product Catalog & PDP
- `GET /catalog/products`: Filtered catalog with occasion, recipient, and cursor pagination. Coalesced via SingleFlight L1/L2 CacheGrid (60s TTL).
- `GET /catalog/products/:id`: Enriched Item Detail View (PDP) with multi-angle gallery, inclusions, sourcing provenance, and ribbon/seal matrices. SingleFlight cached.

### B. Bespoke Hamper Builder
- `GET /builder/options`: Returns available keepsake boxes, ribbons, wax seals, and luxury gourmet items.
- `POST /builder/validate-step`: Validates 11-step configuration, computes 3D volume capacity and packing fullness score.

### C. Checkout & Pricing Engine
- `POST /checkout/calculate`: Computes server-authoritative integer paise totals, ALMAS10 coupon discount cap, shipping surcharge, and 18% GST.
- `POST /checkout/create-order`: Atomic order creation with `inventoryEngine` stock reservations in `PENDING_PAYMENT` state.

### D. Orders & Fulfillment
- `GET /orders/:orderNumber`: Fetches order state, item breakdown, shipping address, and tracking status.

### E. Smart Payment Gateway Router
- `POST /payments/initiate`: Smart routing selecting optimal rail:
  - Mobile client -> Compliant `upi://pay` deep link for instant Google Pay / PhonePe / Paytm invocation.
  - Desktop client -> Dynamic UPI QR code string with 180s auto-refresh interval.
  - International / NRI client (USD / AED) -> Stripe International with FEMA export purpose code `P0104`.
  - Enforces SHA-256 idempotency protection against duplicate submissions.
- `POST /payments/verify`: Verifies payment settlement and transitions order to `CONFIRMED`.
- `POST /payments/smart-webhook`: Ingests asynchronous gateway webhooks with constant-time HMAC-SHA256 signature verification and $\le 300$s replay skew rejection.
- `POST /payments/refund`: Dispatches instant refund across original payment rail.
- `GET /payments/gateways/health`: Real-time health status, success rates, and active gateways (Razorpay, Cashfree, Stripe).

### F. Logistics & Serviceability
- `GET /delivery/serviceability/:pincode`: 6-digit Indian PIN code delivery verification with zone SLA classification (Metro Air vs Regional Surface).

### G. Meta WhatsApp Business Cloud API
- `GET /whatsapp/webhook`: Meta webhook challenge verification handshake.
- `POST /whatsapp/webhook`: Inbound customer message webhook ingestion.
- `POST /whatsapp/simulate-incoming`: Test/sandbox runner for 2-way conversational concierge (`STATUS <orderNumber>`, `DELIVERY <pincode>`, `AGENT` escalation).

### H. Meta Instagram Graph API
- `GET /instagram/feed`: Curated live reel and post grid from `@hampers._by_her`.
- `GET /instagram/webhook`: Meta Webhook challenge handshake.
- `POST /instagram/webhook`: Ingestion of Instagram DM leads with automated intent classification (`PRICING`, `WEDDING`, `CORPORATE_BULK`, etc.).

### I. Atelier Voice AI WebSocket Gateway
- `GET /voice/status`: Real-time operational status and model capabilities.
- `WS /voice/stream`: Full-duplex WebSocket stream supporting 16kHz PCM16 bidirectional audio, VAD 30ms frames, luxury voice tools, and barge-in abort.

### J. Platform Observability & Service Mesh
- `GET /system/health`: Aggregated platform health including memory RSS, uptime, cache metrics, and service mesh statuses.
- `GET /system/mesh/health`: Direct probe of all registered microservices in the service mesh.
- `GET /system/cache/metrics`: Hit/miss ratios, eviction count, and active keys across CacheGrid.

### K. Advanced Computational Algorithms (39_DSA.md)
- `POST /dsa/bin-packing`: 3D physical bin packing evaluation (usable 85% volume threshold, upright constraints, 1.25x fragile buffer, thermal partition).
- `POST /dsa/pricing-ledger`: BigInt 64-bit integer paise ledger with coupon capping, free shipping evaluation, and remainder-preserving GST splitting.
- `POST /dsa/coupon-dag`: DAG-based promotion evaluator with temporal window, redemption caps, and conflict resolution.
- `POST /dsa/search-intent`: Colloquial query tokenizer extracting occasion, recipient, price cap, and trigram fuzzy catalog ranking.
- `POST /dsa/budget-knapsack`: Multi-criteria knapsack optimization for bespoke hampers with 2-opt local search relaxation.
- `POST /dsa/lead-priority`: Multi-Attribute Utility scoring with instant Tier-1 bulk wedding escalation and Binary Max-Heap scheduling.
- `POST /dsa/logistics-sla`: Resolves 6-digit PIN code delivery interval window with 14:00 IST cutoff and preparation lead times.

### L. Atelier Procedural Luxury Visualizer
- `POST /atelier/visualize-hamper`: Generates bespoke vector SVG illustrations and Base64 Data URIs with custom raw silk ribbon, botanical wax seal monograms, and copperplate calligraphy greeting cards.

### M. Customer Authentication & Patron RBAC (25_AUTH_SECURITY.md)
- `POST /auth/request-otp`: Dispatches 6-digit numeric OTP via WhatsApp HSM or SMS with 300s TTL.
- `POST /auth/verify-otp`: Validates OTP and issues URL-safe HMAC-SHA256 JWT session token with patron profile and VIP tier.
- `GET /auth/me`: Verifies Bearer JWT token and returns authenticated patron claims and role permissions.

### N. Atelier Studio Operations OS & Mandatory QC Gate (23_ADMIN_DASHBOARD.md)
- `GET /admin/orders`: Retrieves real-time studio fulfillment queue with pipeline status filters and QC pending flags.
- `GET /admin/orders/:orderNumber`: Fetches full order detail with embellishments, calligraphy text, and QC inspection history.
- `POST /admin/orders/:orderNumber/qc-inspect`: Enforces mandatory QC Photo Gate before orders can transition from `IN_PRODUCTION` to `QUALITY_CHECKED`. Requires inspector ID, name, passed boolean, and photographic proof hash/URL.
- `GET /admin/orders/:orderNumber/packing-slip`: Generates high-resolution printable HTML atelier packing slip with wax seal details, calligraphy card preview, item checklist, and artisan sign-off box.
- `GET /admin/metrics`: Real-time studio throughput KPIs, active order count, gross GMV revenue, pipeline distribution, and QC pass rate.

### O. Logistics Courier Adapter & Live AWB Tracking (20_DELIVERY_LOGISTICS.md)
- `POST /delivery/manifest`: Generates carrier shipping manifest, assigns compliant `HBH-AWB-...` identifier, routes via BlueDart Air / Delhivery Express / Shiprocket, and transitions order to `DISPATCHED`.
- `GET /delivery/track/:identifier`: Queries live shipment tracking and chronological checkpoint timeline by Order Number or AWB.
- `POST /delivery/carrier-webhook`: Ingests carrier scan events (`MANIFEST_CREATED`, `PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `UNDELIVERED_ATTEMPT`). Automates Non-Delivery Report (NDR) recovery sequence via WhatsApp HSM.

### P. Multi-Channel Notification Dispatcher (30_NOTIFICATION_SYSTEM.md)
- `POST /notifications/send`: Orchestrates transactional notifications across WhatsApp Business Cloud API HSM templates, responsive HTML email receipts, and carrier SMS alerts.
- `GET /notifications/recent`: Fetches recent notification audit dispatch ledger with delivery statuses and provider message IDs.
