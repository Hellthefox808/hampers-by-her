<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 40_ECOSYSTEM.md — Ecosystem Integration Topology, External Services & Third-Party Contracts

## 1. Purpose
This document defines the complete multi-system integration topology, external software-as-a-service (SaaS) dependencies, API communication protocols, authentication models, failure recovery patterns, and boundary contracts for the **Hampers by Her** digital commerce platform. While Hampers by Her maintains a strict, authoritative Modular Monolith core for transactional and proprietary customer data, it interacts with an extensive ecosystem of specialized external platforms: Meta (Instagram Graph API & WhatsApp Business Cloud API), payment orchestrators (Razorpay & Cashfree), logistics carriers (Shiprocket & Delhivery), communication carriers (AWS SES & TRAI DLT SMS), Google Merchant Services, and AWS Cloud infrastructure. This specification guarantees robust boundary contracts, strict defense-in-depth isolation, and continuous operational resilience against third-party outages.

## 2. Scope
- **In-Scope**:
  - Integration architectures, credential lifecycles, and SLA definitions for:
    1. **Meta Instagram Graph API**: DM webhooks, story mention listeners, comment automations, and catalog linking.
    2. **WhatsApp Business Cloud API**: Interactive message templates, media payloads, session window management, and fallback routing.
    3. **Payment Gateways**: Razorpay (Primary) and Cashfree (Secondary) webhook verification, auto-refunds, and settlement reconciliation.
    4. **3PL Logistics Aggregators**: Shiprocket and Delhivery API integrations, AWB generation, automated tracking webhooks, and NDR (Non-Delivery Report) workflows.
    5. **Customer Communications**: AWS Simple Email Service (SES) with DKIM/SPF/DMARC, and TRAI DLT-registered SMS gateways.
    6. **Product Aggregators & Search**: Google Merchant Center RSS/JSON product catalog feeds.
  - Webhook ingestion pipeline: cryptographic HMAC signature verification, idempotency deduplication, dead-letter queuing (DLQ), and circuit-breaker patterns.
- **Out-of-Scope**:
  - Unofficial reverse-engineered scraping of Instagram/WhatsApp endpoints (strictly prohibited under Meta Platform Terms).

## 3. Context
In modern Indian D2C commerce, an artisanal brand cannot operate as an isolated website. Over 70% of initial customer interactions originate on Instagram or WhatsApp, payments run through India's UPI rails, and order delivery depends on pan-India surface and air couriers. If an external carrier experiences downtime or an API undergoes breaking changes, the core Hampers by Her commerce engine must isolate the fault, buffer outbound notifications, and prevent transaction loss.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 HAMPERS BY HER ECOSYSTEM TOPOLOGY MATRIX                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                  ┌───────────────────────────┐
                                  │   Meta Graph API / CAPI   │
                                  │   (Instagram Inbound DMs) │
                                  └─────────────┬─────────────┘
                                                │ Webhooks (HMAC-SHA256)
                                                ▼
┌───────────────────────────┐     ┌───────────────────────────┐     ┌───────────────────────────┐
│ WhatsApp Business Cloud   │◄───►│      HAMPERS BY HER       │◄───►│ Razorpay / Cashfree       │
│ (Conversational Commerce) │     │      MODULAR MONOLITH     │     │ (UPI Intent / Cards)      │
└───────────────────────────┘     │  (AWS ECS / NestJS / PG)  │     └───────────────────────────┘
                                  └──────┬──────────────┬─────┘
                                         │              │
                    Shiprocket / Delhivery              AWS SES & DLT SMS
                    (AWB & Tracking Webhook)            (Transactional Notices)
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-ECO-01**: Meta Instagram Ingestion: Capture inbound Instagram customer DMs and story mentions within $\le 2\text{ seconds}$ via verified webhooks and enqueue them into the CRM qualification pipeline.
- **FR-ECO-02**: WhatsApp Message Automation: Deliver transactional notifications (Order Confirmed, Dispatched, Out for Delivery) using pre-approved WhatsApp Business templates within 5 seconds of domain event triggers.
- **FR-ECO-03**: Payment Provider Portability: Implement an abstract payment gateway provider interface allowing zero-downtime traffic cutover between Razorpay and Cashfree via feature flags.
- **FR-ECO-04**: Automated Logistics Dispatch: Generate carrier shipping labels, assign AWBs, and request pickup via Shiprocket/Delhivery APIs upon order transition to `PACKED`.
- **FR-ECO-05**: Regulatory Compliance: Ensure all outbound transactional SMS messages conform strictly to Telecom Regulatory Authority of India (TRAI) Distributed Ledger Technology (DLT) template hashing regulations.

### 4.2 Non-Functional Requirements
- **NFR-ECO-01**: Ingestion Throughput: Ingest up to 250 concurrent external webhooks per second without database connection exhaustion, using an in-memory Redis stream buffer.
- **NFR-ECO-02**: Signature Verification: 100% of incoming webhooks must be cryptographically verified using constant-time HMAC comparison before payload deserialization.
- **NFR-ECO-03**: Outage Resilience: If an external provider (e.g. WhatsApp API) returns HTTP 5xx or times out, outbound events must automatically retry with exponential backoff and jitter over a 24-hour retention window.

## 5. Architecture & Design
### 5.1 Third-Party Integration Inventory & Topology
The following matrix defines the authoritative integrations, SLA boundaries, and integration mechanics:

| Provider | Purpose | Protocol | Auth Type | Inbound / Outbound | SLA Target | Failover Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Meta Graph API** | Instagram DMs & Leads | HTTPS / REST | OAuth 2.0 / App Secret | Bi-directional | 99.9% | Queue in Redis, retry with backoff |
| **WhatsApp Cloud API**| Atelier Concierge & Alerts | HTTPS / REST | Bearer Token (System User) | Bi-directional | 99.95% | Fallback to SMS + Email |
| **Razorpay** | Primary Payments & UPI | HTTPS / REST | Basic Auth (Key + Secret) | Bi-directional | 99.99% | Cashfree Auto-Failover |
| **Cashfree Payments**| Secondary / Backup PG | HTTPS / REST | App ID + Secret Key | Bi-directional | 99.95% | Razorpay Primary Revert |
| **Shiprocket** | Multi-Carrier Logistics | HTTPS / REST | JWT Bearer Token | Bi-directional | 99.5% | Direct Delhivery API Adapter |
| **Delhivery Direct** | Express Metro Courier | HTTPS / REST | API Key | Bi-directional | 99.8% | Shiprocket Aggregated Pool |
| **AWS SES** | Transactional Invoices | SMTP / AWS SDK | IAM SigV4 | Outbound | 99.99% | In-memory retry, cloud alerts |
| **Gupshup / Twilio** | TRAI DLT Compliant SMS | HTTPS / REST | API Key / Basic Auth | Outbound | 99.9% | Secondary SMS Provider |
| **Google Merchant** | Shopping Catalog XML/JSON| HTTPS / Pull | Public HTTPS feed / SFTP | Outbound Feed | 99.5% | Static S3 Cached XML Feed |

### 5.2 Universal Webhook Ingestion & Verification Pipeline
All inbound webhooks adhere to a single standardized ingestion pipeline:

```
[Inbound Webhook Request]
       │
       ▼
[Edge WAF / ALB] ── Rate-limit check & IP whitelisting
       │
       ▼
[Webhook Gateway Controller]
       ├── Capture raw binary buffer (preserve exact byte sequence)
       ├── Extract Provider Signature Header (`X-Hub-Signature-256`, `X-Razorpay-Signature`)
       └── Compute local HMAC-SHA256 using Provider Secret from AWS Secrets Manager
       │
       ▼
[Constant-Time Cryptographic Comparison]
       ├── Valid? ──► NO ──► Return HTTP 401 Unauthorized & Log Security Alert
       └── Valid? ──► YES
       │
       ▼
[Idempotency Check] (Redis `SETNX webhook:id:{provider}:{event_id} EX 86400`)
       ├── Duplicate? ──► YES ──► Return HTTP 200 OK (Acknowledge without re-executing)
       └── Unique? ──► Enqueue to BullMQ `webhook-processor-queue`
       │
       ▼
Return HTTP 200 OK (Acknowledge receipt in < 200ms)
```

## 6. Business Rules
- **BR-ECO-01**: **WhatsApp 24-Hour Customer Service Window**: Freeform concierge messages can only be sent within 24 hours of the customer's last inbound message. Outside this window, only pre-approved Meta transactional templates (order updates, shipping alerts) can be transmitted.
- **BR-ECO-02**: **Payment Webhook Authority**: Orders are **never** marked as `PAID` based solely on the client browser redirect. Fulfillment processing is triggered exclusively upon receipt and verification of the server-to-server `payment.captured` webhook from Razorpay/Cashfree.
- **BR-ECO-03**: **Zero Private Data Exfiltration to Meta**: No sensitive customer personally identifiable information (Aadhaar, full card numbers, recipient private medical/intimate notes) may ever be synced to Meta Conversions API (CAPI) or Facebook Pixel. Only hashed identifiers (SHA-256 email/phone) and standard monetary values are permissible.
- **BR-ECO-04**: **Carrier NDR Escalation**: When a courier flags an order as "Non-Delivery Report" (NDR - Customer Unavailable / Wrong Address), an automated WhatsApp message must be dispatched to the buyer within 15 minutes requesting address clarification or delivery rescheduling.
- **BR-ECO-05**: **TRAI DLT Template Invariant**: Outbound Indian SMS text must strictly match approved DLT template headers and registered body text hashes; dynamic parameter substitution must not modify registered sentence structure.

## 7. Technical Details

### 7.1 Meta & WhatsApp Integration Specifications
- **Base URL**: `https://graph.facebook.com/v19.0/`
- **Authentication**: Permanent System User Access Token generated in Meta Business Manager, injected via AWS Secrets Manager.
- **Webhook Endpoint**: `POST /api/v1/webhooks/whatsapp`
- **Verification Routine (TypeScript)**:
  ```typescript
  import * as crypto from 'crypto';

  export function verifyMetaWebhookSignature(
    rawBody: Buffer,
    signatureHeader: string | undefined,
    appSecret: string
  ): boolean {
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }
    const signatureHash = signatureHeader.split('sha256=')[1];
    const expectedHash = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signatureHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  }
  ```

### 7.2 Payment Gateway Abstraction & Dual-Provider Strategy
To prevent vendor lock-in and insulate operations from gateway outages:
```typescript
export interface PaymentGatewayProvider {
  createOrder(orderId: string, amountPaise: bigint, currency: string, customer: { name: string; phone: string; email: string }): Promise<{ gatewayOrderId: string; checkoutToken: string }>;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
  parseWebhookEvent(rawBody: Buffer): { eventType: string; gatewayOrderId: string; paymentId: string; amountPaise: bigint; status: 'SUCCESS' | 'FAILED' };
  initiateRefund(paymentId: string, amountPaise: bigint, reason: string): Promise<{ refundId: string; status: 'PROCESSED' | 'PENDING' }>;
}
```

### 7.3 Logistics & Carrier Webhook Integration
- **Shiprocket API Contract**:
  - Endpoint: `POST https://apiv2.shiprocket.in/v1/external/shipments/create/forward-shipment`
  - Webhook Tracking Endpoint: `POST /api/v1/webhooks/logistics/shiprocket`
  - Normalized Event Mapping:
    - `SHIPMENT_PICKED_UP` $\to$ Order Status: `SHIPPED`
    - `OUT_FOR_DELIVERY` $\to$ Order Status: `OUT_FOR_DELIVERY`
    - `DELIVERED` $\to$ Order Status: `DELIVERED` (triggers customer feedback survey)
    - `RTO_INITIATED` $\to$ Order Status: `RETURNED_TO_ORIGIN` (triggers atelier inventory restock inspection)

### 7.4 Google Merchant Center Product Feed
- **Feed Format**: Standardized Atom 1.0 XML / Google Shopping RSS 2.0.
- **Cache Location**: Generated every 6 hours by background worker, stored on Amazon S3 at `s3://hampers-by-her-media/feeds/google-merchant-products.xml`, served via CloudFront.
- **Required Fields**: `id`, `title`, `description`, `link`, `image_link`, `availability`, `price`, `brand`, `condition`, `google_product_category` (6063 - Gift Baskets).

## 8. Dependencies
- Upstream Modules:
  - `18_ORDER_MANAGEMENT.md` (Order status transition triggers).
  - `19_PAYMENT_ARCHITECTURE.md` (Payment capture and refund handlers).
  - `20_DELIVERY_LOGISTICS.md` (AWB assignment and delivery zones).
  - `21_WHATSAPP_INTEGRATION.md` (Message templates and conversational bots).
  - `22_INSTAGRAM_LEAD_WORKFLOW.md` (Lead qualification triggers).
- Infrastructure Dependencies:
  - AWS Secrets Manager for encrypted storage of all third-party API tokens and secrets.
  - Redis 7.2 for webhook idempotency caching and rate limiting.

## 9. Security
- **Secret Rotation**: All external API keys and Meta access tokens are rotated every 90 days using AWS Secrets Manager rotation lambdas.
- **Constant-Time Verification**: All cryptographic signatures use `crypto.timingSafeEqual` to prevent side-channel timing attacks.
- **Egress IP Whitelisting**: Outbound requests to payment gateways and WhatsApp Cloud API originate from fixed AWS NAT Gateway Elastic IPs (`EIP_A`, `EIP_B`).
- **Least Privilege Access**: External API tokens are generated with strictly bounded permissions (e.g. Shiprocket API tokens restricted from viewing business banking details).

## 10. Failure Modes
| Integration Point | Failure Mode | Impact | Automated Recovery / Mitigation |
| :--- | :--- | :--- | :--- |
| **Razorpay API** | 500 Internal Error / Network Outage | Checkout stalls | Automated failover to Cashfree gateway provider |
| **WhatsApp Cloud API** | Rate Limit (429) or Service Outage | Notifications unreceived | Buffer in BullMQ with exponential backoff; fallback to transactional SMS |
| **Shiprocket API** | Token expiry or rate limit | Delay in AWB generation | Refresh JWT via background token manager; retry AWB request in 5 mins |
| **Webhook Delivery** | Network drop between Meta and App | Missed customer DM | Re-synchronize unread DMs via polling cron every 15 minutes |

## 11. Testing
- **WireMock / Nock Fixtures**: 100% of external HTTP interactions are covered by deterministic mock fixtures verifying payload transformations and error handling.
- **Webhook Signature Fuzzing**: Test suites feed corrupted, truncated, and forged HMAC signatures to verify that all unauthorized payloads return HTTP 401.
- **Idempotency Verification**: Simulate 10 duplicate webhook events arriving in parallel; assert that downstream business handlers execute exactly once.

## 12. Observability
- **Metrics**:
  - `ecosystem.webhook_received_total{provider="meta|razorpay|shiprocket"}`
  - `ecosystem.webhook_verification_failed_total`
  - `ecosystem.outbound_request_duration_ms{provider, endpoint}`
  - `ecosystem.dlq_message_count{queue="failed-webhooks"}`
- **Alerts**:
  - CloudWatch Alarm: `WebhookVerificationFailureRate > 5%` over 5 minutes $\to$ Triggers PagerDuty (possible credential compromise or active attack).
  - Third-party API response time $> 3000\text{ ms}$ over 10 consecutive requests $\to$ Log warning and activate circuit breaker.

## 13. Open Questions
```yaml
unknown:
  field: shiprocket_corporate_account_id
  status: TO_VERIFY
  source_required: brand_owner
  impact: high
  temporary_assumption: "Logistics integration is architected using standard Shiprocket REST API v2 endpoints pending brand corporate account credentials."
```

```yaml
unknown:
  field: meta_business_manager_id
  status: TO_VERIFY
  source_required: brand_owner
  impact: high
  temporary_assumption: "Meta Webhook and WhatsApp Cloud API configurations assume Meta App ID and WABA (WhatsApp Business Account) pending onboarding."
```

## 14. Future Evolution
- **Direct Carrier B2B Integrations**: As order volume scales past 2,000 hampers/month, migrate from aggregators (Shiprocket) to direct Enterprise API contracts with Bluedart Apex and Delhivery Surface.
- **Automated WhatsApp Payments**: Implement Meta Pay / In-Chat WhatsApp Native Checkout when permitted by Indian regulatory and UPI WhatsApp Pay guidelines.

## 15. References
- Meta Graph API Documentation for Instagram Messaging (v19.0).
- Meta WhatsApp Business Cloud API Reference: Guides, Webhooks, and Message Templates.
- Razorpay API & Webhooks Official Developer Documentation.
- Shiprocket REST API Documentation v2.
- Telecom Regulatory Authority of India (TRAI): Telecom Commercial Communications Customer Preference Regulations (TCCCPR).

<!-- DOCUMENT END: 40_ECOSYSTEM.md -->
