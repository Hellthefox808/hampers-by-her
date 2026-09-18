<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 29_ANALYTICS.md — Event-Driven Tracking, Commerce Funnel & Revenue Reconciliation Architecture

## 1. Purpose
This document establishes the event-driven measurement framework, telemetry tracking architecture, and financial reconciliation pipeline for **Hampers by Her**. High-growth boutique commerce requires precise instrumentation across both consumer conversion behavior (discovery, hamper builder drop-off, checkout friction, payment abandonment) and operational performance (atelier lead times, WhatsApp response latencies, carrier SLA adherence). This specification establishes a hybrid dual-plane analytics architecture: client-side behavioral instrumentation paired with an immutable server-side transactional ledger that ensures reported GMV and marketing ROI match actual bank deposits down to the rupee.

## 2. Scope
- **In-Scope**:
  - Unified Event Schema for client-side and server-side tracking.
  - 32 standardized commerce events across the full customer lifecycle.
  - Dual conversion funnel instrumentation:
    - Funnel 1: `VISIT` ──► `PLP/PDP` ──► `CART` ──► `CHECKOUT` ──► `PAYMENT` ──► `PURCHASE`
    - Funnel 2: `BUILDER_STEP_1` through `STEP_11` ──► `QUOTE/ORDER`
  - Server-Side Conversion APIs: Meta Conversions API (CAPI) and Google Analytics 4 (Measurement Protocol).
  - First-touch and last-touch attribution tracking preserving UTM parameters across cross-device journeys.
  - Internal analytics database tables for executive and operational backoffice dashboards.
- **Out-of-Scope**:
  - Selling or sharing raw customer behavioral streams with third-party data brokers.

## 3. Context
Relying solely on client-side browser tracking (Google Tag Manager, Meta Pixel) results in 20%–35% missing event data due to ad-blockers, iOS App Tracking Transparency (ATT), in-app Instagram browser restrictions, and Safari ITP cookie expirations. Hampers by Her solves this by implementing server-side tracking dispatch where conversion events (`purchase`, `lead_generated`, `quote_requested`) are emitted directly from backend services with deduplication IDs matching client-side events.

```
[Browser / Mobile Client]
       │
       ├── Client Beacon (GA4 / Meta Pixel) ────► [Ad Platforms] (Deduplication ID: evt_uuid)
       │
       ▼ (POST /api/v1/analytics/events)
[NestJS Ingress Controller] ──► [Redis BullMQ Event Queue]
                                          │
                                          ▼
                                 [Analytics Worker Service]
                                 ┌────────┴────────┐
                                 ▼                 ▼
                     [PostgreSQL Event Store]  [Server-Side CAPI / GA4]
                               (Internal BI)    (Deduplicated Match)
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-ANA-01**: Standardized Event Payload: Enforce strict TypeScript typing for all telemetry events (`event_name`, `event_id`, `anonymous_id`, `user_id`, `session_id`, `timestamp`, `context`, `properties`).
- **FR-ANA-02**: Hamper Builder Micro-Funnel Tracking: Track user progression through each step of the 11-step atelier builder (`builder_step_viewed`, `builder_component_selected`, `builder_step_completed`, `builder_abandoned`).
- **FR-ANA-03**: Server-Side Meta CAPI Dispatch: Emit server-side `Purchase` and `Lead` events to Meta Graph API containing hashed customer data (SHA-256 phone and email) to optimize Instagram Ad spend.
- **FR-ANA-04**: WhatsApp Conversion Tracking: Track every click on *"Talk on WhatsApp"* or *"Request Bespoke Quote"*, associating the originating product ID and active builder configuration.
- **FR-ANA-05**: Nightly Financial Reconciliation: Automated cron job comparing Razorpay captured settlement totals against internal `orders` table revenue, flagging discrepancies exceeding ₹1.

### 4.2 Non-Functional Requirements
- **NFR-ANA-01**: Non-Blocking Client Execution: Telemetry dispatch must use `navigator.sendBeacon()` or non-blocking Fetch with `keepalive: true`, introducing zero main-thread overhead.
- **NFR-ANA-02**: Ingestion Latency: Event ingestion endpoint must return HTTP 202 Accepted within 30ms.
- **NFR-ANA-03**: Data Privacy: Strict client-side scrubbing ensuring credit card numbers, passwords, and gift card pins are never transmitted in event properties.

## 5. Architecture & Design

### 5.1 Standardized Event Taxonomy
| Domain | Event Name | Trigger Condition | Key Properties |
| :--- | :--- | :--- | :--- |
| **Discovery** | `page_viewed` | Route change complete | `path`, `referrer`, `utm_source`, `device_type` |
| **Discovery** | `collection_viewed` | PLP rendered | `collection_id`, `occasion_tag`, `item_count` |
| **Discovery** | `product_viewed` | PDP rendered | `product_id`, `sku`, `price_paise`, `in_stock` |
| **Discovery** | `search_executed` | Search submitted | `query`, `results_count`, `filters_applied` |
| **Builder** | `builder_started` | Step 1 initiated | `source_campaign`, `initial_occasion` |
| **Builder** | `builder_step_completed` | User advances step | `step_number`, `selected_item_id`, `running_total` |
| **Cart** | `product_added_to_cart`| Add to cart clicked | `product_id`, `quantity`, `customizations_count` |
| **Checkout** | `checkout_started` | Step 1 checkout loaded| `cart_id`, `cart_value_paise`, `item_count` |
| **Checkout** | `payment_initiated` | Razorpay modal opened | `order_id`, `gateway: 'RAZORPAY'`, `method: 'UPI'`|
| **Conversion**| `order_completed` | Payment verified | `order_number`, `revenue_paise`, `tax_paise`, `awb`|
| **WhatsApp** | `whatsapp_click` | WhatsApp CTA tapped | `origin_page`, `inquiry_type: 'BESPOKE'` |

### 5.2 Attribution State Machine
```
[User Clicks Instagram Story Link (utm_source=instagram&utm_campaign=diwali2026)]
       │
       ▼
[Next.js Client Middleware] ── Extract & Store in Cookie: "hbh_attribution" (30-day sliding TTL)
       │
       ▼
[User Browses, Leaves, Returns 4 days later via Direct URL]
       │
       ▼
[Order Completed] ── Attribution Engine Attaches:
       ├── First Touch: Instagram / Story / diwali2026
       └── Last Touch: Direct
```

## 6. Business Rules
1. **Financial Source of Truth**: The `orders` and `payments` PostgreSQL tables are the sole authoritative sources for revenue, tax, and inventory figures. Third-party analytics platforms (GA4, Mixpanel, Meta Ads Manager) are recognized as trend indicators, not accounting books.
2. **Bot Traffic Exclusion**: Headless crawlers, synthetic pingers (UptimeRobot), and search engine bots are filtered out of analytics dashboards via User-Agent inspection.
3. **Opt-Out Compliance**: If a customer declines analytics cookies in the consent banner, client-side tracking tags are silenced; transactional server-side order records continue to function under legitimate interest.

## 7. Technical Details

### 7.1 Database Entity Relations (Analytics Subsystem)
```sql
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(128) UNIQUE NOT NULL, -- Deduplication key
    event_name VARCHAR(64) NOT NULL,
    session_id VARCHAR(64) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    anonymous_id VARCHAR(64) NOT NULL,
    properties JSONB NOT NULL,
    context JSONB NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    event_timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (event_timestamp);

-- Monthly partitioning for analytical queries
CREATE TABLE analytics_events_2026_09 PARTITION OF analytics_events
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE INDEX idx_analytics_event_name ON analytics_events(event_name, event_timestamp DESC);
CREATE INDEX idx_analytics_session ON analytics_events(session_id);
```

### 7.2 Server-Side Meta CAPI Dispatcher
```typescript
import axios from 'axios';
import * as crypto from 'crypto';

export async function sendMetaConversionsApiEvent(order: Order, context: AnalyticsContext): Promise<void> {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_TOKEN;

  const hashData = (val?: string) => val ? crypto.createHash('sha256').update(val.trim().toLowerCase()).digest('hex') : undefined;

  const payload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: `purchase_${order.id}`,
        action_source: 'website',
        event_source_url: `https://hampersbyher.com/checkout/success/${order.id}`,
        user_data: {
          em: [hashData(order.customerEmail)],
          ph: [hashData(order.customerPhone)],
          client_ip_address: context.ipAddress,
          client_user_agent: context.userAgent,
        },
        custom_data: {
          currency: 'INR',
          value: order.totalAmountPaise / 100,
          order_id: order.orderNumber,
          content_type: 'product',
        },
      },
    ],
  };

  await axios.post(`https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`, payload);
}
```

## 8. Dependencies
- **Upstream Modules**: `StorefrontUI`, `CartCheckout`, `OrdersModule`, `HamperBuilder`.
- **Downstream Modules**: `AdminDashboard` (executive KPI tiles), Meta Conversions API, Google Analytics 4.

## 9. Security
- **PII Hashing**: All customer identifiers transmitted to third-party ad networks (Meta, Google) must be cryptographically hashed with SHA-256 before network transit.
- **Storage Partitioning**: Analytics tables are partitioned monthly to ensure fast vacuuming and automated archiving after 12 months in accordance with privacy data retention policies.

## 10. Failure Modes & Resilience
1. **Analytics Ingress Flood**: If traffic spikes 50x during a celebrity influencer mention, the analytics controller sheds non-critical client events (`page_scroll`) while guaranteeing 100% preservation of commerce conversion events (`purchase`, `add_to_cart`).
2. **Meta CAPI Rate Limit**: Failed CAPI calls are retried via BullMQ with exponential backoff up to 24 hours to ensure advertising attribution is preserved.

## 11. Testing
- **Unit Tests**:
  - Event property schema validation using Zod.
  - SHA-256 PII normalizer and hashing tests.
- **Integration Tests**:
  - Full funnel simulation: Trigger client event ──► ingest ──► verify record in `analytics_events` table ──► verify outbound CAPI payload structure.
  - Reconciliation cron test: Introduce simulated ₹50 variance between mock gateway settlement and orders table; verify Slack alert generation.

## 12. Observability & Monitoring
- **Metrics Tracked**:
  - `analytics.events_ingested_per_second`.
  - `analytics.capi_dispatch_latency_ms`.
  - `analytics.capi_error_rate` (Alert if > 2%).
  - `commerce.conversion_rate_percentage`.
  - `commerce.average_order_value_inr`.
- **Dashboards**: Executive Conversion Cockpit displaying real-time purchase funnel, channel attribution ROI, and hamper builder drop-off heatmap.

## 13. Open Questions & Unknowns
```yaml
unknown:
  field: meta_pixel_id
  status: TO_VERIFY
  source_required: brand_owner
  impact: high
  temporary_assumption: "Placeholder META_PIXEL_ID configured in .env.example; verified account ID required before running paid campaigns"

unknown:
  field: ga4_measurement_id
  status: TO_VERIFY
  source_required: brand_owner
  impact: high
  temporary_assumption: "Placeholder G-XXXXXXXXXX configured in frontend environment variables"
```

## 14. Future Evolution
- Multi-Touch Algorithmic Attribution: Moving beyond simple last-touch to data-driven Shapley value attribution across Instagram, Search, and WhatsApp.
- Predictive LTV Modeling: Identifying high-value corporate clients early in their browsing journey to route them to VIP human concierges.

## 15. References
- Meta Conversions API (CAPI) Best Practices: https://developers.facebook.com/docs/marketing-api/conversions-api/
- Google Analytics 4 Measurement Protocol: https://developers.google.com/analytics/devguides/collection/protocol/ga4
- W3C Beacon API Specification: https://www.w3.org/TR/beacon/
