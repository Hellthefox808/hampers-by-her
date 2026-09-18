<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 30_NOTIFICATION_SYSTEM.md — Multi-Channel Notification Orchestrator & Outbox Pattern Architecture

## 1. Purpose
This document establishes the architecture, event routing, template compilation, and delivery guarantee mechanisms for the **Hampers by Her Notification Subsystem**. In artisanal gifting, timely notifications are critical to emotional peace of mind: customers need immediate confirmation that their payment was captured, artisans need real-time alerts when high-value custom hampers are ordered, and gift givers expect tracking milestones down to the moment their recipient opens the door. This specification details the multi-channel dispatch engine orchestrating WhatsApp Cloud API, Transactional Email (AWS SES / Resend), and SMS (AWS SNS / Fast2SMS), backed by a transactional **Outbox Pattern** to ensure zero dropped messages and zero duplicate sends.

## 2. Scope
- **In-Scope**:
  - Event-driven notification orchestration across 4 channels: WhatsApp (Primary), Email (Secondary/Invoices), SMS (High-Priority Fallback), and In-App Admin WebSockets.
  - Transactional Outbox Pattern in PostgreSQL to guarantee atomic order-state mutations and message queuing.
  - Dedicated BullMQ worker consumers processing delivery queues with exponential backoff and jitter.
  - Idempotent deduplication keys (`event_key = "order_confirmed:uuid"`) preventing duplicate customer alerts upon webhook replay.
  - HTML email template rendering via React Email with luxury atelier visual styling.
  - Granular customer communication preferences and DND (Do Not Disturb) quiet-hour queuing.
- **Out-of-Scope**:
  - Unsolicited cold marketing SMS blasts.

## 3. Context
Relying on synchronous network calls to external notification APIs (Meta, SES) inside HTTP request handlers causes slow checkout responses, risks order failures if an external provider hangs, and results in lost notifications during server restarts. Hampers by Her isolates all notification dispatch into an asynchronous outbox pipeline.

```
[Domain Service (e.g. OrdersModule)]
       │
       ▼ (Atomic DB Transaction)
[PostgreSQL: orders + notification_outbox]
       │
       ▼ (Outbox Poller / Debezium CDC / BullMQ)
[Notification Dispatcher Service]
       │
       ├── Priority Route ──► [WhatsApp Cloud API] (Status: Primary)
       ├── Documents/PDFs ──► [AWS SES / Resend] (Invoices, Packing Slips)
       └── Fallback ────────► [AWS SNS / Fast2SMS] (If WhatsApp Fails)
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-NOTIF-01**: Transactional Outbox: Persist all outbound notifications into `notification_outbox` inside the identical database transaction that commits the domain event.
- **FR-NOTIF-02**: Multi-Channel Fallback Ladder:
  - Step 1: Attempt dispatch via WhatsApp Cloud API.
  - Step 2: If WhatsApp returns unserviceable or delivery fails after 3 retries (5 mins), automatically trigger SMS fallback for critical transactional events (`order_confirmed`, `out_for_delivery`).
  - Step 3: Dispatch rich HTML invoice simultaneously via Email.
- **FR-NOTIF-03**: Idempotency Guard: Enforce unique constraints on `event_key` preventing duplicate notifications for identical business milestones.
- **FR-NOTIF-04**: React Email Engine: Render server-side email templates matching brand typography (Playfair Display / Montserrat) with responsive styling for Apple Mail and Gmail mobile apps.
- **FR-NOTIF-05**: Quiet Hours Buffer: Queue non-urgent promotional and occasion reminder messages between 21:00 and 09:00 IST, dispatching them automatically at 09:15 IST the following morning.

### 4.2 Non-Functional Requirements
- **NFR-NOTIF-01**: Delivery Latency: Transactional WhatsApp and SMS alerts dispatched within 5 seconds of order confirmation.
- **NFR-NOTIF-02**: Durability: Zero message loss during worker crashes achieved through persistent Redis BullMQ job queues.
- **NFR-NOTIF-03**: Observability: Full delivery lifecycle tracked (`QUEUED` ──► `SENT` ──► `DELIVERED` ──► `READ` ──► `FAILED`).

## 5. Architecture & Design

### 5.1 Event Notification Matrix
| Event Trigger | WhatsApp Template | Email Template | SMS Fallback | Priority |
| :--- | :--- | :--- | :--- | :--- |
| `order.confirmed` | `hbh_order_confirmed_v2` | `OrderConfirmedEmail` | Yes (Instant) | P0 (Critical) |
| `order.qc_approved` | `hbh_bespoke_proof_v1` | None | No | P1 (Standard) |
| `order.dispatched` | `hbh_dispatch_update_v1` | `ShipmentDispatchedEmail` | Yes | P0 (Critical) |
| `order.out_for_delivery`| `hbh_out_for_delivery_v1`| None | Yes | P0 (Critical) |
| `order.delivered` | `hbh_delivered_review_v1`| `DeliveryConfirmationEmail`| No | P1 (Standard) |
| `logistics.ndr_alert` | `hbh_ndr_action_v1` | None | Yes (Urgent) | P0 (Critical) |
| `crm.occasion_reminder`| `hbh_occasion_14d_v1` | `OccasionGiftGuideEmail` | No | P2 (Marketing)|

### 5.2 Outbox Processing State Machine
```
PENDING ──► PROCESSING ──► DISPATCHED ──► DELIVERED
   │             │
   ▼             ▼
CANCELLED     RETRYING (Backoff: 2s, 4s, 8s)
                 │
                 ▼
          FAILED_FALLBACK ──► DISPATCHED_SECONDARY (SMS/Email)
                 │
                 ▼
          DEAD_LETTER_QUEUE (Admin Alert)
```

## 6. Business Rules
1. **DND Quiet Hours**: Promotional messages, gift guides, and occasion reminders will never be sent to customers between 21:00 and 09:00 IST. Transactional order confirmations and delivery OTPs are exempt from DND rules.
2. **Branded Sender ID**: SMS messages must utilize registered DLT (Distributed Ledger Technology) headers approved under Telecom Regulatory Authority of India (TRAI) guidelines (e.g., `HMPRBH`).
3. **Sensitive Data Redaction**: Notifications must never expose payment card details or full gift recipient addresses in unencrypted SMS messages.

## 7. Technical Details

### 7.1 Database Schema (Notification Subsystem)
```sql
CREATE TABLE notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key VARCHAR(128) UNIQUE NOT NULL, -- Deduplication anchor
    channel VARCHAR(16) NOT NULL, -- WHATSAPP, EMAIL, SMS
    recipient VARCHAR(255) NOT NULL, -- Phone E.164 or Email
    template_id VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_outbox_pending ON notification_outbox(status, scheduled_for) WHERE status = 'PENDING';

CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbox_id UUID REFERENCES notification_outbox(id) ON DELETE SET NULL,
    channel VARCHAR(16) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    external_message_id VARCHAR(128),
    delivery_status VARCHAR(32) NOT NULL, -- SENT, DELIVERED, READ, FAILED
    error_details JSONB,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notif_logs_ext ON notification_logs(external_message_id);
```

### 7.2 Transactional Outbox Worker (NestJS)
```typescript
@Injectable()
export class NotificationOutboxWorker {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsAppService: WhatsAppService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async processOutboxBatch(): Promise<void> {
    const jobs = await this.prisma.notificationOutbox.findMany({
      where: {
        status: 'PENDING',
        scheduledFor: { lte: new Date() },
      },
      take: 50,
    });

    for (const job of jobs) {
      try {
        await this.prisma.notificationOutbox.update({
          where: { id: job.id },
          data: { status: 'PROCESSING' },
        });

        if (job.channel === 'WHATSAPP') {
          await this.whatsAppService.sendTemplate(job.recipient, job.templateId, job.payload);
        } else if (job.channel === 'EMAIL') {
          await this.emailService.send(job.recipient, job.templateId, job.payload);
        } else if (job.channel === 'SMS') {
          await this.smsService.send(job.recipient, job.templateId, job.payload);
        }

        await this.prisma.notificationOutbox.update({
          where: { id: job.id },
          data: { status: 'DISPATCHED' },
        });
      } catch (err: any) {
        const nextRetry = job.retry_count + 1;
        if (nextRetry >= job.max_retries) {
          await this.prisma.notificationOutbox.update({
            where: { id: job.id },
            data: { status: 'FAILED', lastError: err.message },
          });
          // Trigger Fallback to SMS if WhatsApp failed on P0 event
          await this.triggerFallback(job);
        } else {
          await this.prisma.notificationOutbox.update({
            where: { id: job.id },
            data: {
              status: 'PENDING',
              retry_count: nextRetry,
              scheduledFor: dayjs().add(Math.pow(2, nextRetry), 'seconds').toDate(),
              lastError: err.message,
            },
          });
        }
      }
    }
  }

  private async triggerFallback(job: any): Promise<void> {
    if (job.channel === 'WHATSAPP' && job.payload.isCritical) {
      await this.prisma.notificationOutbox.create({
        data: {
          eventKey: `fallback_sms_${job.eventKey}`,
          channel: 'SMS',
          recipient: job.recipient,
          templateId: 'DLT_ORDER_UPDATE_SMS',
          payload: job.payload,
        },
      });
    }
  }
}
```

## 8. Dependencies
- **Upstream Modules**: `OrdersModule` (status updates), `LogisticsModule` (tracking updates), `CRMModule` (occasion reminders).
- **External Dependencies**: Meta WhatsApp Business Cloud API, AWS Simple Email Service (SES), AWS Simple Notification Service (SNS) / Fast2SMS.

## 9. Security
- **TRAI DLT Compliance**: In accordance with Indian telecommunications regulations, all SMS copy templates, headers, and entity IDs must be pre-registered on Telecom DLT portals (Jio/Airtel) to prevent message blacklisting.
- **Email DKIM & SPF Authentication**: SES domains configured with 2048-bit DKIM keys, SPF records (`v=spf1 include:amazonses.com ~all`), and strict DMARC enforcement (`p=reject`) to eliminate domain spoofing.

## 10. Failure Modes & Resilience
1. **WhatsApp Cloud API Outage**: The outbox worker detects 5 consecutive WhatsApp HTTP 5xx responses, trips an internal circuit breaker, and immediately diverts all P0 transactional alerts to SMS.
2. **Email Bounces & Spam Complaints**: AWS SES webhook listener flags hard bounces and unsubscribe requests in `crm_contacts`, instantly suppressing future marketing sends to preserve sender reputation.

## 11. Testing
- **Unit Tests**:
  - Outbox retry exponential backoff formula validation.
  - React Email template HTML rendering tests asserting correct variable interpolation.
- **Integration Tests**:
  - Outbox atomicity test: Verify that rolling back an order creation transaction also rolls back the `notification_outbox` insert.
  - Fallback ladder test: Simulate WhatsApp API failure ──► verify SMS job spawned in outbox.
- **Delivery Webhook Simulation**: Test that incoming SES and WhatsApp delivery receipts correctly update `notification_logs` to `DELIVERED` or `READ`.

## 12. Observability & Monitoring
- **Metrics Tracked**:
  - `notifications.outbox_backlog_size` (Alert if > 100).
  - `notifications.dispatch_latency_seconds`.
  - `notifications.whatsapp_delivery_rate` (Target: >98%).
  - `notifications.sms_fallback_count`.
  - `notifications.email_bounce_rate` (Alert if > 1.5%).
- **Dashboards**: Admin Notification Health Cockpit showing channel throughput, live failure rate, and outbox queue depth.

## 13. Open Questions & Unknowns
```yaml
unknown:
  field: trai_dlt_registration_entity_id
  status: TO_VERIFY
  source_required: brand_owner
  impact: high
  temporary_assumption: "Requires business owner PAN / GST registration to register official DLT SMS sender header"

unknown:
  field: official_support_email_sender_domain
  status: TO_VERIFY
  source_required: brand_owner
  impact: medium
  temporary_assumption: "concierge@hampersbyher.com designated as default outbound email identity"
```

## 14. Future Evolution
- Interactive Email (AMP for Email) allowing customers to submit reviews and star ratings directly inside Gmail without leaving their inbox.
- Web Push Notifications for desktop and Android browsers announcing seasonal limited-edition festive hamper drops.

## 15. References
- Enterprise Integration Patterns (Transactional Outbox Pattern): https://microservices.io/patterns/data/transactional-outbox.html
- React Email Documentation: https://react.email/
- Telecom Regulatory Authority of India (TRAI) DLT Messaging Guidelines: https://www.trai.gov.in/
