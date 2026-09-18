<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 20_DELIVERY_LOGISTICS.md — Delivery, Shipping & Logistics Architecture

## 1. Purpose
This document establishes the delivery, logistics, and serviceability architecture for **Hampers by Her**. Gifting commerce possesses distinct logistics requirements compared to conventional ecommerce: deliveries are intrinsically tied to firm emotional deadlines (birthdays, anniversaries, wedding dates, festivals), contents are often fragile or perishable (glass jars, wax seals, confections), and failed first-attempt deliveries ruin customer sentiment. This specification governs pin code serviceability checking, dynamic shipping calculations, carrier orchestration (Shiprocket, Delhivery, Bluedart, Borzo/Dunzo for hyper-local), delivery date estimation (ETA), and Non-Delivery Report (NDR) recovery.

## 2. Scope
- **In-Scope**:
  - 6-digit Indian PIN code validation and serviceability lookup.
  - Multi-tier delivery modes: Standard Surface/Air, Express Air, Guaranteed Date Delivery, and Same-Day Hyper-local.
  - Fragile and volumetric weight pricing calculations.
  - Production lead-time buffer integration into consumer-facing checkout ETAs.
  - Automated carrier label generation, manifest generation, and webhook tracking ingestion.
  - Non-Delivery Report (NDR) workflow with automated WhatsApp address correction.
  - Reverse logistics and return-to-origin (RTO) lifecycle management.
- **Out-of-Scope**:
  - Cross-border international customs clearing (MVP is strictly domestic India).
  - Operating an in-house fleet of delivery personnel (all shipping is 3PL outsourced).

## 3. Context
Gifting customers will abandon checkout if they cannot be guaranteed delivery on or before their recipient's special occasion. Conversely, promising delivery dates without accounting for artisan production lead times (e.g., handcrafted wax seals, custom polaroid printing, bespoke curation) leads to broken promises and brand erosion. Hampers by Her requires a unified engine that links artisan production status directly with carrier SLA matrices.

```
[Customer Checkout] 
       │ (PIN Code & Cart Items)
       ▼
[Serviceability Engine] ── checks ──► [Zone & PIN Master DB / Redis Cache]
       │
       ▼
[ETA Calculator] ◄── combines ── [Max Production Lead Time + Carrier SLA + Cutoff]
       │
       ▼
[Order Confirmed & QC Passed] 
       │
       ▼
[Carrier Orchestrator] ── dispatch ──► [Shiprocket / Delhivery API]
       │
       ▼
[Tracking Webhook Pipeline] ── status ──► [Customer WhatsApp / Email + Admin Dashboard]
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-LOG-01**: Instant PIN code serviceability check on Product Detail Pages and Checkout via Redis-cached pincode database.
- **FR-LOG-02**: Calculation of volumetric weight ($L \times W \times H / 5000$) versus dead weight, applying the higher value for carrier rate computation.
- **FR-LOG-03**: Blackout calendar support for national holidays, state holidays, and atelier workshop closure days.
- **FR-LOG-04**: Daily order cutoff time (default: 14:00 IST); orders placed after the cutoff automatically increment production start by +1 business day.
- **FR-LOG-05**: Automated AWB (Air Waybill) generation and PDF shipping label creation upon QC approval in Admin.
- **FR-LOG-06**: Real-time webhook ingestion for transit status updates (`PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `NDR_RAISED`).
- **FR-LOG-07**: Automated WhatsApp trigger upon NDR event prompting customer to verify or update recipient landmark and alternate phone number.

### 4.2 Non-Functional Requirements
- **NFR-LOG-01**: PIN code serviceability check latency under 50ms (Redis lookup).
- **NFR-LOG-02**: Webhook processing idempotency: duplicate carrier status webhooks must not cause duplicate customer notifications.
- **NFR-LOG-03**: High availability: carrier rate fallback to static zone-based tables if external aggregator API is degraded.

## 5. Architecture & Design

### 5.1 Serviceability and Delivery Zones
India delivery coverage is partitioned into 5 operational tiers:
1. **Zone 0 (Hyper-Local)**: Same-day / Next-day courier (Borzo, Dunzo, Porter) within base city radius (<25 km). Hand-delivered fragile baskets.
2. **Zone A (Intra-State / Metro)**: Primary state or immediate metro connections (Transit SLA: 24–48 hours).
3. **Zone B (Regional Metros)**: Tier-1 metros (Delhi NCR, Mumbai, Bengaluru, Chennai, Kolkata, Hyderabad; Transit SLA: 48–72 hours).
4. **Zone C (Rest of India - Tier 2 & 3)**: Major towns and serviceable districts (Transit SLA: 3–5 business days).
5. **Zone D (Special / Remote)**: Northeast, J&K, Andaman & Nicobar, Lakshadweep, remote hill stations (Transit SLA: 6–9 business days).

### 5.2 Delivery State Machine
```
LABEL_GENERATED ──► MANIFESTED ──► PICKUP_SCHEDULED ──► PICKED_UP
       │                                                      │
       ▼                                                      ▼
   CANCELLED                                             IN_TRANSIT
                                                              │
                                                              ▼
                                                      OUT_FOR_DELIVERY
                                                       │            │
                                                       ▼            ▼
                                                   DELIVERED     NDR_RAISED
                                                                    │
                                                        ┌───────────┴───────────┐
                                                        ▼                       ▼
                                                   RE-ATTEMPT               RTO_INITIATED
                                                   SCHEDULED                    │
                                                        │                       ▼
                                                        └──────────────► RETURNED_TO_ORIGIN
```

### 5.3 Unified Carrier Adapter Interface
```typescript
export interface ICourierAdapter {
  checkServiceability(pincode: string, weightGrams: number, cod: boolean): Promise<ServiceabilityResult>;
  calculateRate(input: ShippingRateInput): Promise<ShippingRateQuote[]>;
  createShipment(order: Order, fulfillment: Fulfillment): Promise<ShipmentCreationResult>;
  cancelShipment(awb: string): Promise<boolean>;
  generateLabel(shipmentId: string): Promise<string>; // PDF URL
  trackShipment(awb: string): Promise<TrackingStatus>;
}
```

## 6. Business Rules
1. **Atelier Lead Time Precedence**: Total Promised ETA = `Order Timestamp` + `Lead Time Buffer` + `Carrier Transit SLA`. If a hamper contains custom wax seal engraving (+2 days) and standard items (+0 days), the cart's minimum lead time is 2 business days.
2. **Fragile Item Safeguard**: Hampers marked with `has_fragile_items = true` (ceramic mugs, glass candles, liquor/perfume flacons) cannot be shipped via budget surface post; they must mandate double-corrugated outer master cartons and Express Air or Hyper-local hand delivery.
3. **Cutoff Times**: 
   - Hyper-local Same-Day Cutoff: 11:00 IST.
   - Standard Dispatch Cutoff: 14:00 IST.
   - Orders confirmed after cutoff roll to the next operational business day.
4. **Free Shipping Threshold**: Standard orders above ₹2,999 qualify for complimentary surface/air shipping (configurable via Admin). Guaranteed Time-Slot and Same-Day deliveries always incur surcharge.
5. **Perishable Items**: Products containing fresh florals or perishable sweets are restricted strictly to Zone 0 (Local Hand Delivery). The system must block checkout if unserviceable PIN codes are entered.

## 7. Technical Details

### 7.1 Database Schema (Logistics Subsystem)
```sql
CREATE TABLE delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(32) UNIQUE NOT NULL, -- ZONE_0, ZONE_A, etc.
    name VARCHAR(64) NOT NULL,
    base_rate_paise BIGINT NOT NULL,
    per_kg_rate_paise BIGINT NOT NULL,
    estimated_days_min INT NOT NULL,
    estimated_days_max INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pincode_master (
    pincode VARCHAR(6) PRIMARY KEY,
    city VARCHAR(64) NOT NULL,
    state VARCHAR(64) NOT NULL,
    zone_code VARCHAR(32) REFERENCES delivery_zones(code),
    is_serviceable BOOLEAN DEFAULT TRUE,
    is_prepaid_allowed BOOLEAN DEFAULT TRUE,
    is_cod_allowed BOOLEAN DEFAULT FALSE,
    is_hyperlocal_eligible BOOLEAN DEFAULT FALSE,
    last_verified_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pincode_zone ON pincode_master(zone_code);

CREATE TABLE fulfillments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICTED,
    fulfillment_number VARCHAR(64) UNIQUE NOT NULL,
    carrier_code VARCHAR(32) NOT NULL, -- SHIPROCKET, DELHIVERY, BLUEDART, BORZO
    awb_number VARCHAR(64),
    label_url TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'LABEL_GENERATED',
    length_cm NUMERIC(6,2) NOT NULL,
    width_cm NUMERIC(6,2) NOT NULL,
    height_cm NUMERIC(6,2) NOT NULL,
    dead_weight_grams INT NOT NULL,
    volumetric_weight_grams INT NOT NULL,
    billable_weight_grams INT NOT NULL,
    shipping_charge_paise BIGINT NOT NULL,
    dispatched_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    ndr_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_fulfillments_order ON fulfillments(order_id);
CREATE INDEX idx_fulfillments_awb ON fulfillments(awb_number);

CREATE TABLE tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fulfillment_id UUID NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
    carrier_status VARCHAR(64) NOT NULL,
    normalized_status VARCHAR(32) NOT NULL,
    location VARCHAR(128),
    details TEXT,
    event_timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_tracking_fulfillment ON tracking_events(fulfillment_id, event_timestamp DESC);
```

### 7.2 ETA Calculation Algorithm
$$\text{Transit Days} = \text{Zone Transit SLA}(\text{Destination PIN})$$
$$\text{Production Days} = \max_{i \in \text{Items}}(\text{LeadTime}(i))$$
$$\text{Total Business Days} = \text{Cutoff Penalty} + \text{Production Days} + \text{Transit Days}$$
$$\text{Delivery Date} = \text{AddBusinessDays}(\text{OrderDate}, \text{Total Business Days}, \text{HolidayCalendar})$$

## 8. Dependencies
- **Upstream Modules**: `OrdersModule` (order status transition to `PROCESSING`), `ProductCatalog` (item weights, fragile flags, lead times), `CustomizationEngine` (bespoke item lead times).
- **Downstream Modules**: `NotificationSystem` (dispatch, out-for-delivery, and delivered WhatsApp/SMS alerts), `CRM` (delivery failure tickets, address corrections).
- **External Third Parties**: Shiprocket API / Delhivery API / Borzo API / India Post PIN directory.

## 9. Security
- **PII Protection**: Carrier manifests and labels must mask recipient phone numbers on public QR scans where feasible, and encrypt full street addresses in data at rest.
- **Webhook Ingress Authentication**: Carrier webhooks must validate HMAC secret signatures (or static carrier token headers over TLS) before parsing incoming payloads.
- **Rate Limiting**: Public `/api/v1/logistics/pincode/:code` API is rate-limited to 30 requests/minute per IP to prevent PIN scraping and database denial of service.

## 10. Failure Modes & Resilience
1. **Carrier API Outage**: If the primary aggregator API (e.g., Shiprocket) returns 5xx during checkout rate calculation, the system seamlessly degrades to the internal `delivery_zones` flat rate matrix stored in PostgreSQL/Redis.
2. **Non-Delivery Report (NDR)**: If a delivery attempt fails (door closed, wrong phone number, incorrect address), the carrier webhook triggers an immediate high-priority Redis queue event. An interactive WhatsApp message is sent to the customer requesting GPS location pin or landmark instructions within 12 hours.
3. **Damaged in Transit**: Fragile items reported damaged with photographic proof trigger an instant priority RMA flow in Admin, initiating a replacement dispatch while filing insurance claims against the 3PL.

## 11. Testing
- **Unit Tests**:
  - Volumetric weight vs dead weight calculation tests ($L \times W \times H / 5000$).
  - Business day addition algorithm considering bank holidays and weekend cutoffs.
- **Integration Tests**:
  - Mock carrier API responses for label creation, tracking updates, and rate cards.
  - End-to-end webhook ingestion test: validating that `DELIVERED` webhook advances Order status to `DELIVERED` and fires customer review request notification.
- **Contract Tests**: Verify Shiprocket and Delhivery API schema compatibility using Pact or recorded WireMock stubs.

## 12. Observability & Monitoring
- **Metrics Tracked**:
  - `logistics.pincode_lookup.duration_ms` (Target: <50ms).
  - `logistics.label_generation.error_rate` (Alert if > 2%).
  - `logistics.rto_rate_percentage` (Alert if > 4% across 7-day rolling window).
  - `logistics.carrier_sla_breach_count`.
- **Dashboards**: Admin Operations logistics cockpit displaying live parcels in transit, NDR aging bucket (<24h, 24-48h, >48h), and carrier performance SLAs.

## 13. Open Questions & Unknowns
```yaml
unknown:
  field: dispatch_hub_pincode
  status: TO_VERIFY
  source_required: brand_owner
  impact: high
  temporary_assumption: "Primary atelier operations based in Mumbai / Metro hub (Zone A origin)"

unknown:
  field: default_contracted_3pl_courier
  status: TO_VERIFY
  source_required: brand_owner
  impact: medium
  temporary_assumption: "Shiprocket Aggregator API providing unified access to Bluedart, Delhivery, and DTDC"

unknown:
  field: cod_cash_on_delivery_policy
  status: TO_VERIFY
  source_required: brand_owner
  impact: high
  temporary_assumption: "COD disabled for personalized/bespoke hampers to prevent non-recoverable RTO losses; prepaid only"
```

## 14. Future Evolution
- Integration with Hyper-local on-demand fleets (Porter, Dunzo, Borzo) via automated dispatch bots for same-day flower/cake hamper combinations.
- Real-time courier vehicle tracking map links embedded in WhatsApp delivery messages.
- Predictive RTO AI model scoring address risk based on historical PIN-code delivery success rates.

## 15. References
- Shiprocket Logistics API Reference: https://apidocs.shiprocket.in/
- Delhivery Express B2C API Documentation: https://www.delhivery.com/
- India Post National Pincode Directory: https://www.indiapost.gov.in/
- OWASP API Security Top 10 (Webhook Verification & Rate Limiting): https://owasp.org/www-project-api-security/
