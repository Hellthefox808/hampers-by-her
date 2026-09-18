# DATABASE STATE — Hampers by Her

## 1. Engine & Hosting
- **Engine**: PostgreSQL 16 on AWS Aurora Serverless v2.
- **ORM**: Prisma ORM with connection pooling via PgBouncer / RDS Proxy.
- **Config**: `prisma.config.ts` mapping to `docs/database/schema.prisma` and migrations.

## 2. Core Entities (316 Lines in schema.prisma)
- **Identity & Access**: `User`, `Customer`, `Address`, `AdminRoleAudit`.
- **Merchandising**: `Product`, `ProductVariant`, `Category`, `Collection`, `Occasion`.
- **Packaging & Atelier**: `PackagingBox`, `PackagingRibbon`, `PackagingWaxSeal`, `CustomizationOption`.
- **Transactional**: `Cart`, `CartItem`, `Order`, `OrderItem`, `CustomizationSelection`, `Payment`, `Shipment`.
- **CRM & Conversational**: `Lead`, `Conversation`, `CRMActivity`, `Campaign`.
- **Media & Content**: `MediaAsset`, `Review`, `AuditLog`, `WebhookEvent`.

## 3. Database Constraints & Invariants
- Integer storage for all monetary amounts in paise (1 INR = 100 paise) preventing floating point drift.
- Unique constraints on `User.email`, `Customer.phone`, `Order.orderNumber`, `Payment.providerPaymentId`.
- Foreign key cascading strictly controlled; soft deletion (`deletedAt`) preferred for auditable commerce records.
- Partitioning strategy defined for `AuditLog` and `WebhookEvent` by month (`13_DATABASE_DESIGN.md`).
