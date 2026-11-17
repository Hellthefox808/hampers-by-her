# BACKEND STATE — Hampers by Her Digital Commerce Ecosystem

## 1. Architectural Model
- **Pattern**: Modular Monolith with Domain-Driven Design (DDD) backed by an enterprise Platform Service Mesh (`platform/services/`).
- **Core Runtime**: Node.js v22 LTS with Express & WebSocket (`ws`) transport, structured for straightforward migration to NestJS Fastify.
- **Microservices Mesh**: In-process dynamic service discovery with distributed correlation IDs (`cid_...`), per-service circuit breakers (`CLOSED` -> `OPEN` -> `HALF_OPEN`), and aggregated health probes.
- **Enterprise Platform Subsystems**:
  - `platform/services/payment-service/smartRouter.js`: Multi-acquirer smart routing (Razorpay, Cashfree, Stripe International), mobile UPI Intent vs desktop Dynamic QR, idempotency ledger, and FEMA export compliance.
  - `platform/services/cache-service/cacheGrid.js`: L1 LRU + L2 Redis cache grid with SingleFlight coalescing eliminating cache stampedes.
  - `platform/services/scaling-service/inventoryLock.js`: Atomic check-and-reserve concurrency control preventing inventory overselling.
  - `platform/services/scaling-service/rateLimiter.js`: Sliding-window rate limiter with adaptive event loop load shedding (>70ms lag).
  - `platform/services/voice-service/`: Full-duplex WebSocket gateway with PCM16 streaming, VAD 30ms windows, and barge-in playback cancellation.

## 2. Active Domain Services
1. **CatalogService**: Multi-angle asset manifests, artisan sourcing specs, unboxing breakdown, and raw silk/wax seal personalization matrices.
2. **PricingEngine**: Server-authoritative integer paise calculations (items, boxes, customizations, coupon caps, and 18% GST).
3. **HamperBuilder**: 3D volumetric packaging calculation, collision/fullness heuristics, and component compatibility.
4. **OrderService**: 11-stage order lifecycle state machine, atomic stock reservations, and payment transitions.
5. **SmartPaymentRouter**: Dual-mode UPI Intent/Dynamic QR generation, multi-gateway failover, and constant-time HMAC-SHA256 webhook verification.
6. **DeliveryLogistics**: 6-digit Indian PIN code serviceability validation with zone SLAs (Metro Air vs Regional Surface).
7. **WhatsAppService**: Meta Cloud API v21.0 challenge handshakes, HMAC-SHA256 signature verification, and 2-way conversational concierge.
8. **InstagramService**: Meta Graph API v21.0 feed synchronization, DM webhook ingestion, and CRM lead intent classification.
9. **VoiceAiGateway**: High-concurrency WebSocket engine streaming luxury atelier audio turns with domain tool invocation.
10. **ServiceMeshRegistry**: Inter-service choreography and aggregated health aggregation.

## 3. Security & Transactional Guarantees
- **OWASP ASVS Compliance**:
  - Security headers enforced: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
  - Static caching headers: `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`.
- **Idempotency Protection**: Enforced on `/checkout/create-order` and `/payments/initiate` via SHA-256 idempotency cache keys.
- **Concurrency & Inventory Locks**: Atomic reservation checks via `inventoryEngine` prevent overselling during flash promotions.
- **Lifecycle Management**: Deterministic graceful shutdown handlers (`SIGTERM`/`SIGINT`) cleanly drain open HTTP and WebSocket connections.
