# BACKEND STATE — Hampers by Her

## 1. Architectural Model
- **Pattern**: Modular Monolith structured using Domain-Driven Design (DDD).
- **Core Runtime**: Node.js v22 LTS with NestJS framework and Fastify adapter for low-latency HTTP transport.
- **ORM & Data Access**: Prisma ORM 5/6 with PostgreSQL 16 connection pooling.
- **Job Engine**: BullMQ 5.x backed by Redis 7.2 for async operations (PDF invoices, WhatsApp notifications, payment reconciliation).

## 2. Domain Services
1. **PricingEngineService**: Server-authoritative price calculation (items, boxes, customizations, coupons, GST).
2. **HamperBuilderService**: 3D volumetric packaging calculation, collision/fullness heuristics, component compatibility.
3. **CartService**: Anonymous session persistence, cart merge upon authentication, inventory reservations.
4. **CheckoutOrchestrationService**: 2-step checkout flow, address validation, shipping surcharge calculation.
5. **OrderFulfillmentService**: 11-stage order lifecycle state machine, studio QC gate enforcement.
6. **PaymentAdapterService**: Razorpay SDK abstraction, webhook signature verification, refund handling.
7. **DeliveryLogisticsService**: 6-digit Indian PIN code serviceability check, Shiprocket/Delhivery adapter.
8. **WhatsAppCommerceService**: Meta Cloud API webhooks, automated order updates, NDR recovery flows.
9. **CrmLeadService**: Instagram DM lead capture, qualification stages, quotation generation.
10. **AdminAtelierService**: Operational dashboard data, atelier packing slips, inventory adjustments.

## 3. Transactional Guarantees
- Idempotency keys enforced on `/checkout/create-order` and `/payments/verify`.
- Optimistic concurrency locking (`version` column) on inventory items to prevent overselling.
- Isolation level: `READ COMMITTED` default, `SERIALIZABLE` for inventory deduction transactions.
