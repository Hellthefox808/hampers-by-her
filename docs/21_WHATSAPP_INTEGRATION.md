<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 21_WHATSAPP_INTEGRATION.md — WhatsApp Commerce & Business Cloud API Integration

## 1. Purpose
This document specifies the technical architecture, conversational lifecycle, and compliance framework for integrating the **Meta WhatsApp Business Cloud API** into Hampers by Her. In the Indian luxury gifting market, WhatsApp is not merely a customer support helpdesk; it is a primary revenue conversion channel, an interactive quotation engine, and an automated fulfillment tracker. This design guarantees seamless bidirectional communication: synchronizing incoming shopper inquiries directly into the CRM while programmatically dispatching transactional notifications (order confirmation, artwork approval, dispatch tracking, delivery proof) under strict Meta HSM (Highly Structured Message) compliance.

## 2. Scope
- **In-Scope**:
  - Meta WhatsApp Business Cloud API integration (Graph API v20.0+).
  - Dual-track commerce workflows: Direct Checkout notifications and Consultative Bespoke Inquiry routing.
  - Automated 10-stage WhatsApp conversation lifecycle management.
  - Pre-approved HSM message templates (Utility, Authentication, Marketing).
  - Inbound webhook processing with HMAC-SHA256 signature verification and BullMQ queuing.
  - Interactive messages: Quick Reply buttons, List Messages, Product Catalog Messages, and Location Request pins.
  - Two-way operator chat interface within the Admin Dashboard.
  - Fallback mechanisms to SMS/Email upon template delivery failure.
- **Out-of-Scope**:
  - Direct P2P WhatsApp payments via WhatsApp Pay (payments are executed via secure web links to Razorpay UPI Intent).
  - Spam broadcast marketing without prior customer opt-in consent.

## 3. Context
Hampers by Her originates as an Instagram boutique where shoppers initiate purchase conversations via DMs or WhatsApp links. Forcing customers exclusively into an impersonal web checkout alienates patrons seeking bespoke advice on anniversary hampers, corporate branding, or wedding bulk favors. Conversely, relying on personal phones causes dropped leads, lost order context, and lack of team auditability.

```
[Customer on WhatsApp]
       │
       ▼ (Inbound Text / Audio / Image / Interactive Reply)
[Meta WhatsApp Cloud API]
       │
       ▼ (HTTPS Webhook POST with HMAC-SHA256)
[NestJS Ingress Controller] ── verify signature ──► [Redis BullMQ Queue]
                                                           │
                                                           ▼
                                                [WhatsAppWorker Service]
                                                ┌──────────┴──────────┐
                                                ▼                     ▼
                                         [NLP / Rule Router]    [CRM Message Store]
                                                │                     │
                                         ┌──────┴──────┐              ▼
                                         ▼             ▼       [Admin Unified Inbox]
                                    [Auto Bot]    [Human Agent]
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-WA-01**: Inbound Webhook Processing: Verify `hub.challenge` during Meta setup and securely ingest inbound message webhooks within 200ms.
- **FR-WA-02**: Automatic Contact Provisioning: Auto-create or resolve a `CRMContact` based on the incoming E.164 phone number.
- **FR-WA-03**: Interactive Hamper Consultation Flow: Provide interactive buttons allowing customers to select Occasion, Budget Tier, and Recipient directly in chat.
- **FR-WA-04**: Quote Presentation: Generate and deliver a rich PDF quotation message with an embedded "Pay Now via UPI" link.
- **FR-WA-05**: Transactional Notification Triggers: Automatically fire HSM templates on:
  - `order.created` (Utility template: Order ID, Summary, Expected Delivery).
  - `fulfillment.dispatched` (Utility template: Carrier, AWB, Live Tracking URL).
  - `fulfillment.out_for_delivery` (Utility template: Delivery agent alert).
  - `logistics.ndr_raised` (Interactive template: Requesting address landmark or alternate phone).
  - `customization.proof_ready` (Image template: Requesting customer approval for wax seal / custom card).
- **FR-WA-06**: Human Operator Escalation: Transition conversation state to `OPERATOR_ASSIGNED` whenever the customer types "agent", "human", or selects custom consultation.

### 4.2 Non-Functional Requirements
- **NFR-WA-01**: Resilience: Inbound webhooks must return HTTP 200 OK immediately after pushing to BullMQ (<50ms) to prevent Meta webhook retries and server bans.
- **NFR-WA-02**: Latency: Automated responses dispatched within 2 seconds of customer inbound message.
- **NFR-WA-03**: Compliance: Strict adherence to Meta's 24-hour Customer Service Window (free-form messaging permitted only within 24 hours of customer's last message; paid Utility/Marketing templates required outside the window).

## 5. Architecture & Design

### 5.1 Conversational Lifecycle State Machine
```
NEW_INQUIRY ──► QUALIFYING ──► REQUIREMENTS_COLLECTED ──► QUOTATION_SENT
                                                                │
                                                                ▼
                                                        WAITING_CUSTOMER
                                                                │
                                                                ▼
COMPLETED ◄── FULFILLMENT ◄── PAID ◄── PAYMENT_PENDING ◄── APPROVED
```

### 5.2 Meta HSM Template Catalog
| Template Name | Category | Trigger Event | Parameters |
| :--- | :--- | :--- | :--- |
| `hbh_order_confirmed_v2` | UTILITY | Order Paid | `customer_name`, `order_number`, `item_count`, `total_amount`, `eta_date` |
| `hbh_dispatch_update_v1` | UTILITY | Shipment Picked Up | `order_number`, `carrier_name`, `awb_number`, `tracking_link` |
| `hbh_ndr_action_required_v1`| UTILITY | Delivery Attempt Failed | `order_number`, `carrier_reason`, `interactive_button: update_address` |
| `hbh_bespoke_proof_approval_v1`| UTILITY | Atelier Proof Uploaded | `customer_name`, `proof_image_url`, `interactive_buttons: [Approve, Request Change]`|
| `hbh_abandoned_cart_reminder_v1`| MARKETING | Cart Abandoned (>3 hrs)| `customer_name`, `hamper_name`, `cart_link`, `offer_code` |

### 5.3 Webhook Verification & Message Routing Pipeline
```typescript
@Controller('api/v1/integrations/whatsapp')
export class WhatsAppWebhookController {
  constructor(
    @InjectQueue('whatsapp-inbound') private readonly inboundQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const expectedToken = this.configService.get<string>('WHATSAPP_VERIFY_TOKEN');
    if (mode === 'subscribe' && token === expectedToken) {
      return challenge;
    }
    throw new ForbiddenException('Invalid verify token');
  }

  @Post('webhook')
  @HttpCode(200)
  async handleIncoming(
    @Headers('x-hub-signature-256') signature: string,
    @Req() req: RawBodyRequest<FastifyRequest>,
  ): Promise<{ status: string }> {
    const appSecret = this.configService.get<string>('WHATSAPP_APP_SECRET');
    const isValid = verifyMetaHmac(req.rawBody, signature, appSecret);
    if (!isValid) {
      throw new UnauthorizedException('Invalid HMAC signature');
    }

    await this.inboundQueue.add('process-message', req.body, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
    });

    return { status: 'queued' };
  }
}
```

## 6. Business Rules
1. **Consent & Opt-In**: Outbound notifications are sent only to numbers provided during web checkout (with explicit checkbox "Receive delivery updates via WhatsApp") or to users who initiated inbound chat.
2. **24-Hour Window Guard**: If `last_customer_message_at` is older than 24 hours, the CRM interface disables the free-form text input box and forces the operator to select an approved Meta Utility Template.
3. **Atelier Tone of Voice**: Automated greetings must reflect the brand: warm, elegant, personal, and polite. Never use robotic phrases like "Press 1 for Sales". Use natural language: *"Welcome to Hampers by Her! Are you looking for a ready-to-ship hamper or would you like us to curate a bespoke gift?"*
4. **Quotation Validity**: WhatsApp quotes sent to customers have a default validity of 48 hours to manage seasonal inventory volatility and perishable flower pricing.

## 7. Technical Details

### 7.1 Database Entity Relations
```sql
CREATE TABLE whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
    wa_chat_id VARCHAR(64) UNIQUE NOT NULL, -- E.164 phone number
    lifecycle_state VARCHAR(32) NOT NULL DEFAULT 'NEW_INQUIRY',
    assigned_user_id UUID REFERENCES admin_users(id),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    last_customer_message_at TIMESTAMPTZ,
    is_window_active BOOLEAN GENERATED ALWAYS AS (
        last_customer_message_at IS NOT NULL AND 
        last_customer_message_at >= NOW() - INTERVAL '24 hours'
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_wa_conv_contact ON whatsapp_conversations(contact_id);
CREATE INDEX idx_wa_conv_state ON whatsapp_conversations(lifecycle_state);

CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
    wam_id VARCHAR(128) UNIQUE NOT NULL, -- Meta WhatsApp Message ID
    direction VARCHAR(8) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    message_type VARCHAR(32) NOT NULL, -- TEXT, IMAGE, DOCUMENT, INTERACTIVE, TEMPLATE
    template_name VARCHAR(64),
    content JSONB NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'SENT', -- SENT, DELIVERED, READ, FAILED
    error_code VARCHAR(32),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_wa_msg_conv ON whatsapp_messages(conversation_id, created_at DESC);
CREATE INDEX idx_wa_msg_wam ON whatsapp_messages(wam_id);
```

## 8. Dependencies
- **Upstream Modules**: `OrdersModule` (status updates), `CRM` (contact data, pipeline stages), `CustomizationEngine` (artwork previews).
- **Downstream Modules**: `NotificationSystem` (central dispatch coordinator), `Logistics` (NDR triggers).
- **External Dependencies**: Meta Graph API (`graph.facebook.com/v20.0/{phone-number-id}/messages`).

## 9. Security
- **Meta App Secret Verification**: Every incoming POST is cryptographically validated using `crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')`. Unsigned or tampered requests are immediately rejected with 401.
- **Media Asset Scrubbing**: Inbound attachments (images sent by customers for photo hampers or payment screenshots) are scanned for mime-type validity and stored in private S3 buckets under `s3://hbh-media-private/whatsapp/` with temporary presigned URLs generated for admin review.
- **Credential Storage**: Meta System User Permanent Access Tokens are loaded from AWS Secrets Manager and never logged in plaintext.

## 10. Failure Modes & Resilience
1. **Meta API Downtime**: If Meta Cloud API returns 5xx or rate limit (131056), BullMQ queues the outbound message with exponential backoff (1s, 2s, 4s, 8s, up to 5 retries). If retries fail after 15 minutes, critical notifications fall back to SMS via AWS SNS or Gupshup.
2. **Template Rejection**: If Meta deprecates or rejects an updated template, the system falls back to a standardized generic Utility template to ensure order confirmations are never blocked.
3. **Duplicate Delivery Webhooks**: Meta periodically redelivers status webhooks (`delivered`, `read`). All updates use `ON CONFLICT (wam_id) DO UPDATE` to ensure idempotent execution.

## 11. Testing
- **Unit Tests**:
  - HMAC-SHA256 signature calculation and validation tests.
  - 24-hour conversation window computation logic tests.
- **Integration Tests**:
  - Webhook controller test verifying that valid Meta payloads queue into BullMQ and return HTTP 200 within 50ms.
  - Mock Meta Graph API test asserting template parameter replacement and payload structure.
- **E2E Simulation**: Full round-trip test: Inbound customer inquiry → auto-lead creation in CRM → operator reply from admin → outbound API call.

## 12. Observability & Monitoring
- **Metrics Tracked**:
  - `whatsapp.webhook.latency_ms` (Target: <50ms).
  - `whatsapp.messages.sent_count` partitioned by category (Utility, Marketing).
  - `whatsapp.messages.delivery_rate` (Target: >98%).
  - `whatsapp.messages.read_rate`.
  - `whatsapp.operator_response_time_minutes`.
- **Alerts**: CloudWatch alarm if message delivery failure rate exceeds 3% over any 15-minute window.

## 13. Open Questions & Unknowns
```yaml
unknown:
  field: official_meta_whatsapp_phone_number
  status: TO_VERIFY
  source_required: brand_owner
  impact: high
  temporary_assumption: "Placeholder +91-XXXXXXXXXX designated for business profile creation on Meta Cloud API"

unknown:
  field: meta_business_manager_id
  status: TO_VERIFY
  source_required: brand_owner
  impact: high
  temporary_assumption: "Requires brand owner to link approved Meta Business Account for production WABA tier"
```

## 14. Future Evolution
- Integration with AI Concierge powered by Gemini 1.5 Flash to automatically interpret customer custom hamper requests, extract budget/occasion, and generate instant draft quotation cards.
- WhatsApp Catalog sync allowing customers to browse the live Hampers by Her boutique natively inside WhatsApp without opening a browser.

## 15. References
- Meta WhatsApp Business Cloud API Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/
- WhatsApp Message Templates Guidelines: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
- WhatsApp Webhook Security & Signatures: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
