const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');

function updateDoc(filename, transformer) {
  const rootFile = path.join(ROOT_DIR, filename);
  const docsFile = path.join(DOCS_DIR, filename);

  let content = fs.readFileSync(rootFile, 'utf8');
  content = transformer(content);

  fs.writeFileSync(rootFile, content, 'utf8');
  fs.writeFileSync(docsFile, content, 'utf8');
  console.log(`Updated and mirrored: ${filename}`);
}

// ----------------------------------------------------
// 11_BACKEND_ARCHITECTURE.md
// ----------------------------------------------------
updateDoc('11_BACKEND_ARCHITECTURE.md', (content) => {
  const reqBlock = `## 4. Requirements

### 4.1 Functional Requirements
- **FR-BE-01 (Domain Service Isolation)**: Encapsulate core e-commerce workflows into decoupled domain services with strict transactional boundaries.
- **FR-BE-02 (Server Authoritative Pricing)**: Enforce all pricing, tax, packaging, and coupon deductions on the server; never trust client-provided totals.
- **FR-BE-03 (Asynchronous Queue Decoupling)**: Offload external API calls, PDF rendering, and WhatsApp notifications to BullMQ Redis queues to keep HTTP response times under 200ms.
- **FR-BE-04 (Zero Overselling)**: Utilize serializable transactions and row-level locking on inventory items during checkout order reservation.

### 4.2 Non-Functional Requirements
- **NFR-BE-01 (Latency Budget)**: Database read operations $\\le 30\\text{ms}$; transactional checkout mutations $\\le 200\\text{ms}$.
- **NFR-BE-02 (Throughput Capacity)**: Sustain 500 concurrent requests/sec during peak festival drops (Diwali, Rakhi, Valentine's).
- **NFR-BE-03 (High Availability)**: Target 99.95% uptime with automated multi-AZ failover on Aurora Serverless v2.

---

## 5. Architecture & Layered Domain Model`;

  let updated = content.replace('## 4. Layered Architectural Pattern', reqBlock);
  updated = updated.replace('## 5. Core Domain Services (Specifications)', '### 5.1 Core Domain Services (Specifications)');
  
  const bizBlock = `## 6. Business Rules & Background Processing

### 6.1 Core Business Rules
- **Rule BE-201 (Transactional Stock Allocation)**: Inventory cannot be decremented without an active database transaction. If any item within a composite hamper fails stock availability, the entire order transaction is rolled back.
- **Rule BE-202 (Idempotent Webhook Processing)**: External payment webhooks must be verified via HMAC-SHA256 signature and deduplicated against the \`WebhookEvent\` table using \`provider_event_id\`.
- **Rule BE-203 (Automatic Expiry of Stale Orders)**: Orders in \`PENDING_PAYMENT\` state expire automatically after 15 minutes, unlocking reserved inventory back to available stock.

### 6.2 Asynchronous Background Worker Architecture (BullMQ)`;

  updated = updated.replace('## 6. Asynchronous Background Worker Architecture (BullMQ)', bizBlock);
  return updated;
});

// ----------------------------------------------------
// 12_API_SPEC.md
// ----------------------------------------------------
updateDoc('12_API_SPEC.md', (content) => {
  const reqBlock = `## 4. Requirements

### 4.1 Functional Requirements
- **FR-API-01 (RESTful Resource Design)**: Provide OpenAPI 3.1 compliant endpoints across Catalog, Builder, Cart, Checkout, Payments, WhatsApp Leads, and Admin operations.
- **FR-API-02 (Idempotency Enforcement)**: Require and validate \`Idempotency-Key\` UUID headers on all mutating financial and order submission requests.
- **FR-API-03 (Cryptographic Webhook Handshakes)**: Enforce HMAC-SHA256 signature verification on Razorpay and Meta WhatsApp webhooks before job ingestion.

### 4.2 Non-Functional Requirements
- **NFR-API-01 (Latency Budget)**: P95 latency $\\le 100\\text{ms}$ for catalog read requests; $\\le 250\\text{ms}$ for transactional mutations.
- **NFR-API-02 (Error Standardization)**: RFC 7807 Problem Details representation across all error responses.

---

## 5. Architecture & Endpoint Specifications

### 5.1 API Design Standards & Global Headers`;

  let updated = content.replace('## 4. API Design Standards & Global Headers', reqBlock);
  updated = updated.replace('## 5. Comprehensive Endpoint Specifications', '### 5.2 Comprehensive Endpoint Specifications');
  updated = updated.replace('## 6. Webhook Contracts & Security Handshakes', '## 6. Business Rules & Webhook Contracts\n\n### 6.1 Webhook Contracts & Security Handshakes');
  updated = updated.replace('## 7. Standardized Error Response Contract (RFC 7807)', '## 7. Technical Details & RFC 7807 Error Contract');
  return updated;
});

// ----------------------------------------------------
// 13_DATABASE_DESIGN.md
// ----------------------------------------------------
updateDoc('13_DATABASE_DESIGN.md', (content) => {
  const reqBlock = `## 4. Requirements

### 4.1 Functional Requirements
- **FR-DB-01 (Paise Currency Precision)**: Store all financial values as 64-bit integers in Paise (1 INR = 100 Paise) to avoid floating-point errors.
- **FR-DB-02 (Relational Integrity)**: Enforce referential integrity, unique constraints on SKUs and idempotency keys, and cascading rules.
- **FR-DB-03 (Immutable Historical Snapshots)**: Order item and personalization line items must freeze product titles, prices, and recipient notes at the time of purchase.

### 4.2 Non-Functional Requirements
- **NFR-DB-01 (Query Performance)**: Primary key lookups $\\le 5\\text{ms}$; complex catalog queries $\\le 30\\text{ms}$.
- **NFR-DB-02 (ACID Isolation)**: Serializable isolation on checkout order creation transactions.

---

## 5. Architecture & Relational Schema (ERD)

### 5.1 Entity-Relationship Diagram (ERD)`;

  let updated = content.replace('## 4. Entity-Relationship Diagram (ERD)', reqBlock);
  updated = updated.replace('## 5. Core Tables & DDL Schema Definitions', '### 5.2 Core Tables & DDL Schema Definitions');
  updated = updated.replace('## 6. Business Rules Encoded in Constraints', '## 6. Business Rules Encoded in Constraints');
  updated = updated.replace('## 7. Indexing Strategy & Query Optimization', '## 7. Technical Details, Indexing & Partitioning\n\n### 7.1 Indexing Strategy & Query Optimization');
  updated = updated.replace('## 8. Table Partitioning Strategy', '### 7.2 Table Partitioning Strategy\n\n---\n\n## 8. Dependencies & Database Extensions\n- **PostgreSQL**: Version 16 on Amazon Aurora Serverless v2.\n- **Extensions**: \`pgcrypto\` (UUID generation and KMS encryption), \`pg_trgm\` (trigram fuzzy search indexing).\n- **Connection Pooler**: AWS RDS Proxy / PgBouncer with maximum 100 pooled connections.');
  return updated;
});

// ----------------------------------------------------
// 14_PRODUCT_CATALOG.md
// ----------------------------------------------------
updateDoc('14_PRODUCT_CATALOG.md', (content) => {
  const reqBlock = `## 4. Requirements

### 4.1 Functional Requirements
- **FR-CAT-01 (Merchandising Taxonomies)**: Support multi-tiered product categorization by Occasion, Recipient, Season, and Collection.
- **FR-CAT-02 (Component Decomposition)**: Distinguish ready-made pre-curated hampers from standalone artisanal components used in the Hamper Builder.
- **FR-CAT-03 (Volumetric Attribute Tracking)**: Track 3D bounding box dimensions (L x W x H in cm) and fragile flags for every physical item.

### 4.2 Non-Functional Requirements
- **NFR-CAT-01 (Search Latency)**: Trigram fuzzy search response $\\le 40\\text{ms}$.
- **NFR-CAT-02 (Image Optimization)**: Product images served via CloudFront CDN in next-gen WebP/AVIF formats with responsive srcset.

---

## 5. Architecture & Merchandising Hierarchy

### 5.1 Merchandising Hierarchy & Taxonomies`;

  let updated = content.replace('## 4. Merchandising Hierarchy & Taxonomies', reqBlock);
  updated = updated.replace('## 5. Product Attribute Schema & Specifications', '### 5.2 Product Attribute Schema & Specifications');
  updated = updated.replace('## 6. Illustrative Seed Catalog Fixtures (Research-Derived)', '## 7. Technical Details & Seed Catalog Fixtures\n\n### 7.1 Illustrative Seed Catalog Fixtures (Research-Derived)');
  updated = updated.replace('## 7. Volumetric Packing & Shipping Rules', '## 6. Business Rules & Volumetric Packing\n\n### 6.1 Volumetric Packing & Shipping Rules');
  return updated;
});

// ----------------------------------------------------
// 15_HAMPER_BUILDER.md
// ----------------------------------------------------
updateDoc('15_HAMPER_BUILDER.md', (content) => {
  const reqBlock = `## 4. Requirements

### 4.1 Functional Requirements
- **FR-BLD-01 (11-Step Guided Atelier)**: Deliver a fluid 11-step customization sequence from Occasion selection to Wax Seal and Handwritten Card.
- **FR-BLD-02 (Live Fullness & Collision Gauge)**: Real-time calculation of remaining 3D volume capacity as items are added or removed.
- **FR-BLD-03 (State Persistence)**: Automatic synchronization of active hamper draft to local storage and WhatsApp deep-link generation.

### 4.2 Non-Functional Requirements
- **NFR-BLD-01 (Interaction Latency)**: Volume calculation and price recalculation $\\le 16\\text{ms}$ (maintaining 60fps).
- **NFR-BLD-02 (Mobile Usability)**: 100% responsive touch-friendly interface optimized for single-handed mobile navigation.

---

## 5. Architecture & Guided Atelier Workflow

### 5.1 The 11-Step Guided Atelier Workflow`;

  let updated = content.replace('## 4. The 11-Step Guided Atelier Workflow', reqBlock);
  updated = updated.replace('## 5. Algorithmic Specifications: Volume & Fullness Engine', '## 6. Business Rules & Fullness Engine\n\n### 6.1 Algorithmic Specifications: Volume & Fullness Engine');
  updated = updated.replace('## 6. Real-Time Pricing Engine Contract', '### 6.2 Real-Time Pricing Engine Contract');
  updated = updated.replace('## 7. State Persistence & WhatsApp Deep-Linking', '## 7. Technical Details & State Persistence\n\n### 7.1 State Persistence & WhatsApp Deep-Linking');
  return updated;
});

// ----------------------------------------------------
// 16_CUSTOMIZATION_ENGINE.md
// ----------------------------------------------------
updateDoc('16_CUSTOMIZATION_ENGINE.md', (content) => {
  const reqBlock = `## 4. Requirements

### 4.1 Functional Requirements
- **FR-CST-01 (Multi-Option Personalization)**: Support wax seal stamp designs, ribbon materials, calligraphy card styles, and polaroid photo prints.
- **FR-CST-02 (Direct S3 Presigned Photo Upload)**: Direct client-to-S3 image upload with automated server-side dimension and MIME verification.
- **FR-CST-03 (Production Lead Time Modeling)**: Customizations must dynamically increment required preparation time (+24h to +48h).

### 4.2 Non-Functional Requirements
- **NFR-CST-01 (Image Processing)**: User photo variants generated within 2 seconds via Sharp in BullMQ worker.
- **NFR-CST-02 (Data Privacy)**: Automated S3 lifecycle rules purging customer personal photos 30 days after order delivery.

---

## 5. Architecture & Customization Taxonomy

### 5.1 Customization Taxonomy & Option Model`;

  let updated = content.replace('## 4. Customization Taxonomy & Option Model', reqBlock);
  updated = updated.replace('## 5. Detailed Customization Specifications', '### 5.2 Detailed Customization Specifications');
  
  const bizBlock = `## 6. Business Rules & Lead-Time Governance

### 6.1 Personalization Business Rules
- **Rule CST-101 (Card Character Limits)**: Handwritten gift card text strictly capped at 300 characters to fit artisanal stationery.
- **Rule CST-102 (Photo Quality Threshold)**: Uploaded customer photos must have minimum dimensions of $1000 \\times 1000$ pixels.
- **Rule CST-103 (Lead Time Accumulation)**: Handcrafted wax seals add +1 business day to dispatch ETA.

### 6.2 Data Privacy & Automated Asset Retention`;

  updated = updated.replace('## 7. Data Privacy & Automated Asset Retention', bizBlock);
  updated = updated.replace('## 6. Secure Media Upload Pipeline (Personal Photos)', '## 7. Technical Details & Media Upload Pipeline\n\n### 7.1 Secure Media Upload Pipeline (Personal Photos)');
  return updated;
});

// ----------------------------------------------------
// 17_CART_CHECKOUT.md
// ----------------------------------------------------
updateDoc('17_CART_CHECKOUT.md', (content) => {
  const reqBlock = `## 4. Requirements

### 4.1 Functional Requirements
- **FR-CHK-01 (Frictionless 2-Step Checkout)**: Streamlined mobile checkout: Step 1 (Recipient & Delivery Date), Step 2 (Review & UPI/Payment).
- **FR-CHK-02 (Guest & Merged Carts)**: Support guest session carts seamlessly merged upon OTP authentication.
- **FR-CHK-03 (Dynamic Serviceability & Shipping)**: Real-time India PIN code lookup calculating carrier transit SLAs and delivery surcharges.

### 4.2 Non-Functional Requirements
- **NFR-CHK-01 (Cart Hydration)**: Restored from local storage in $\\le 50\\text{ms}$.
- **NFR-CHK-02 (Checkout Conversion)**: Sub-3-second end-to-end checkout initiation.

---

## 5. Architecture & 2-Step Mobile Checkout

### 5.1 Cart Lifecycle & State Transitions`;

  let updated = content.replace('## 4. Cart Lifecycle & State Transitions', reqBlock);
  updated = updated.replace('## 5. 2-Step Mobile Checkout Architecture', '### 5.2 2-Step Mobile Checkout Architecture');
  updated = updated.replace('## 6. Business & Pricing Rules', '## 6. Business Rules & Pricing Governance\n\n### 6.1 Business & Pricing Rules');
  updated = updated.replace('## 7. Delivery Scheduling & Pincode Routing', '## 7. Technical Details & Delivery Routing\n\n### 7.1 Delivery Scheduling & Pincode Routing');
  return updated;
});

// ----------------------------------------------------
// 18_ORDER_MANAGEMENT.md
// ----------------------------------------------------
updateDoc('18_ORDER_MANAGEMENT.md', (content) => {
  const reqBlock = `## 4. Requirements

### 4.1 Functional Requirements
- **FR-ORD-01 (11-Stage Order Lifecycle)**: Enforce formal state transitions from DRAFT to DELIVERED with audit logging.
- **FR-ORD-02 (Atelier QC Photo Gate)**: Physical hampers cannot be marked ready for carrier pickup without an uploaded inspection photo.
- **FR-ORD-03 (Automated AWB & Shipping Generation)**: Instant generation of Shiprocket/carrier shipping labels upon QC approval.

### 4.2 Non-Functional Requirements
- **NFR-ORD-01 (State Transition Latency)**: Order status mutations processed in $\\le 100\\text{ms}$.
- **NFR-ORD-02 (Auditability)**: 100% of order modifications tracked with actor ID, timestamp, and metadata in \`AuditLog\`.

---

## 5. Architecture & Order Lifecycle State Machine

### 5.1 Order State Machine & Lifecycle`;

  let updated = content.replace('## 4. Order State Machine & Lifecycle', reqBlock);
  updated = updated.replace('## 5. Operational Workshop Queues', '### 5.2 Operational Workshop Queues');
  updated = updated.replace('## 6. Assisted Manual Order Creation (WhatsApp / DM Commerce)', '## 7. Technical Details & Assisted Commerce\n\n### 7.1 Assisted Manual Order Creation (WhatsApp / DM Commerce)');
  updated = updated.replace('## 7. Business Rules & Cancellation Policy', '## 6. Business Rules & Cancellation Policy\n\n### 6.1 Business Rules & Cancellation Policy');
  return updated;
});

// ----------------------------------------------------
// 19_PAYMENT_ARCHITECTURE.md
// ----------------------------------------------------
updateDoc('19_PAYMENT_ARCHITECTURE.md', (content) => {
  const reqBlock = `## 4. Requirements

### 4.1 Functional Requirements
- **FR-PAY-01 (Multi-Modal Indian Payments)**: Native support for UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, NetBanking, and Wallets via Razorpay.
- **FR-PAY-02 (Idempotent Webhook Processing)**: Secure ingestion of payment gateway webhooks with HMAC-SHA256 signature verification.
- **FR-PAY-03 (Automated Reconciliation)**: Background worker polling and reconciling orphaned payments stuck in pending states.

### 4.2 Non-Functional Requirements
- **NFR-PAY-01 (Zero Financial Discrepancy)**: Strict integer arithmetic in Paise eliminating any float rounding discrepancies.
- **NFR-PAY-02 (Webhook Ingestion SLA)**: Webhook endpoints return HTTP 200 within 200ms by deferring processing to BullMQ.

---

## 5. Architecture & Payment Gateway Abstraction

### 5.1 Payment Gateway Abstraction Architecture`;

  let updated = content.replace('## 4. Payment Gateway Abstraction Architecture', reqBlock);
  updated = updated.replace('## 5. Payment State Machine & Transitions', '### 5.2 Payment State Machine & Transitions');
  updated = updated.replace('## 6. Webhook Signature Verification & Ingestion Handshake', '## 7. Technical Details & Webhook Signature Verification\n\n### 7.1 Webhook Signature Verification & Ingestion Handshake');
  updated = updated.replace('## 7. Asynchronous Payment Reconciliation Worker', '## 6. Business Rules & Payment Reconciliation\n\n### 6.1 Asynchronous Payment Reconciliation Worker');
  return updated;
});

console.log('All 9 architectural documentation files have been harmonized and mirrored!');
