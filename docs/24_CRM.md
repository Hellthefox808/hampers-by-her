<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 24_CRM.md — Customer Relationship Management, Customer 360 & Occasion Calendar

## 1. Purpose
This document establishes the architecture, data models, retention triggers, and lead qualification workflows for the **Hampers by Her Customer Relationship Management (CRM) Subsystem**. Gifting commerce features recurring, highly predictable emotional demand cycles: once a customer purchases an anniversary or birthday hamper, that occasion repeats identically every 365 days. By turning single-transaction purchasers into high-LTV (Lifetime Value) lifelong patrons through an automated **Occasion Reminder Calendar**, omni-channel conversation tracking (Instagram DMs, WhatsApp, Email), and structured B2B corporate lead pipelines, the CRM acts as the primary engine for sustainable, high-margin customer retention.

## 2. Scope
- **In-Scope**:
  - Unified **Customer 360** profile: aggregating identity, order history, lifetime spend, recipient addresses, and personalization preferences.
  - **Occasion Memory Vault**: capturing recurring personal dates (Birthdays, Anniversaries, Rakhi, Diwali, Valentine's, Mother's Day) with automated reminder workflows.
  - **Bespoke Quotation Engine**: creating, versioning, discounting, and tracking custom quotes for wedding favors and corporate bulk hampers.
  - **Deterministic Lead Scoring**: scoring inbound inquiries from Instagram, WhatsApp, and Web based on event proximity, budget tier, and business fit.
  - **Customer Segmentation**: dynamic RFM (Recency, Frequency, Monetary) clustering and occasion-based cohorts.
  - **Omni-channel Activity Timeline**: consolidated chronological feed of orders, WhatsApp messages, Instagram DMs, support tickets, and operator notes.
- **Out-of-Scope**:
  - Third-party CRM integration (e.g., Salesforce, HubSpot); the boutique runs entirely on the internal native PostgreSQL CRM module.
  - Unsolicited cold telephone telemarketing.

## 3. Context
Conventional ecommerce CRMs treat customers as anonymous shopping carts. In luxury gifting, however, the buyer and recipient are almost always different individuals. The buyer cares intensely about presentation, unboxing experience, punctuality, and emotional resonance. Hampers by Her models this dual-identity: remembering who the buyer is, who their recipients are, what items were previously gifted (to avoid embarrassing duplicate gifts in subsequent years), and when their annual milestones occur.

```
[Customer 360 Entity]
       │
       ├──► [Recipient Address Book] (Mom, Husband, Boss, Sister)
       ├──► [Occasion Vault] (Anniversary: Oct 14, Mom's Birthday: May 22)
       ├──► [Gift History] (2025: Rose Gold Velvet Box, 2026: Emerald Keepsake)
       └──► [Omni-channel Communications] (WhatsApp Chat + Instagram DMs + Quotes)
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-CRM-01**: Automated Contact Resolution: Match incoming checkout guests and WhatsApp inquiries to existing `CRMContact` records using normalized E.164 phone numbers and lowercased email addresses.
- **FR-CRM-02**: Occasion Reminder Engine: Enable customers to save special dates during checkout or inside their user account. Automatically schedule a WhatsApp/Email reminder 14 days and 7 days before the event with curated hamper recommendations.
- **FR-CRM-03**: Interactive Quotation Workflow: Allow concierge operators to draft a custom quote with line-item discounts, custom packaging options, and expiry deadlines, dispatching a signed pay-link.
- **FR-CRM-04**: Corporate / Bulk Lead Pipeline: Track B2B leads across 6 distinct stages: `NEW` ──► `REQUIREMENTS_SCOPED` ──► `SAMPLE_SENT` ──► `QUOTE_APPROVED` ──► `DEPOSIT_PAID` ──► `COMPLETED`.
- **FR-CRM-05**: Dynamic RFM Segmentation: Nightly automated job categorizing contacts into `VIP_ATELIER` (Spend > ₹25,000), `LOYAL_RECURRING` (>2 orders), `OCCASION_SEEKER` (1 holiday purchase), and `AT_RISK_DORMANT` (no purchase in 12 months).

### 4.2 Non-Functional Requirements
- **NFR-CRM-01**: Performance: Customer 360 timeline rendering under 250ms for contacts with over 50 associated orders and interactions.
- **NFR-CRM-02**: Privacy & Compliance: Support customer right-to-be-forgotten requests; anonymize customer PII while preserving anonymized transactional ledgers for GST tax audits.
- **NFR-CRM-03**: Concurrency: Distributed locking on quotation updates to prevent simultaneous operator modifications.

## 5. Architecture & Design

### 5.1 CRM Pipeline State Machine
```
INBOUND_LEAD ──► CONTACTED ──► QUALIFIED ──► QUOTE_DRAFTED ──► QUOTE_SENT
      │                                                           │
      ▼                                                           ▼
DISQUALIFIED                                              CUSTOMER_APPROVED
                                                                  │
                                                                  ▼
CLOSED_LOST ◄── PAYMENT_FAILED ◄── DEPOSIT_PENDING ◄── PAYMENT_LINK_ACTIVE
                                                              │
                                                              ▼
                                                        CLOSED_WON (Order Spawned)
```

### 5.2 Deterministic Lead Scoring Formula
$$\text{Score} = S_{\text{intent}} + S_{\text{budget}} + S_{\text{proximity}} + S_{\text{channel}}$$
- **$S_{\text{intent}}$ (Intent Weight)**:
  - Corporate Bulk (>25 units): $+40$
  - Wedding Trousseau / Favors: $+35$
  - Custom Hamper Inquiry: $+25$
  - General Price Inquiry: $+10$
- **$S_{\text{budget}}$ (Budget Tier)**:
  - Budget $\ge ₹10,000$: $+30$
  - Budget ₹5,000–₹9,999: $+20$
  - Budget < ₹5,000: $+10$
- **$S_{\text{proximity}}$ (Event Proximity)**:
  - Event date within 3–7 days (Urgent): $+20$
  - Event date within 8–30 days: $+15$
  - Event date > 60 days: $+5$
- **$S_{\text{channel}}$**:
  - Inbound WhatsApp Chat: $+10$
  - Instagram DM / Web Form: $+5$
*Leads scoring $\ge 70$ are tagged `HIGH_PRIORITY_LEAD` and trigger an immediate mobile push notification to the sales concierge.*

## 6. Business Rules
1. **Deduplication Priority**: Phone number (E.164) is the primary deduplication anchor. If an existing contact with phone `+919876543210` enters a new email address during checkout, the new email is added to the contact's secondary email array rather than creating a duplicate contact.
2. **Occasion Reminder Frequency Cap**: A customer will never receive more than 1 occasion reminder message per week, even if multiple family birthdays fall in close succession, preventing notification fatigue.
3. **Quotation Payment Expiry**: Custom quotes default to a 48-hour expiration. Once expired, the payment link is invalidated in Razorpay to safeguard against inventory price fluctuations during festival surges.
4. **Consent-Gated Retention**: Promotional occasion reminders are sent strictly if `marketing_opt_in = true`. Transactional notifications (order status) ignore marketing flags.

## 7. Technical Details

### 7.1 Database Entity Relations (CRM Subsystem)
```sql
CREATE TABLE crm_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    first_name VARCHAR(64) NOT NULL,
    last_name VARCHAR(64),
    primary_phone VARCHAR(20) UNIQUE NOT NULL, -- Normalized E.164
    primary_email VARCHAR(255),
    instagram_handle VARCHAR(128),
    lifecycle_stage VARCHAR(32) NOT NULL DEFAULT 'LEAD', -- LEAD, CUSTOMER, VIP, CHURNED
    rfm_segment VARCHAR(32) DEFAULT 'NEW',
    total_orders_count INT DEFAULT 0,
    total_spend_paise BIGINT DEFAULT 0,
    average_order_value_paise BIGINT DEFAULT 0,
    marketing_opt_in BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_crm_phone ON crm_contacts(primary_phone);
CREATE INDEX idx_crm_email ON crm_contacts(primary_email);
CREATE INDEX idx_crm_segment ON crm_contacts(rfm_segment);

CREATE TABLE crm_occasions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
    recipient_name VARCHAR(128) NOT NULL,
    relationship VARCHAR(64) NOT NULL, -- SPOUSE, MOTHER, FRIEND, COLLEAGUE
    occasion_type VARCHAR(64) NOT NULL, -- BIRTHDAY, ANNIVERSARY, OTHER
    occasion_date DATE NOT NULL, -- Stored with recurring year representation
    reminder_days_before INT DEFAULT 14,
    last_reminded_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_crm_occasions_date ON crm_occasions(occasion_date);

CREATE TABLE quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_number VARCHAR(64) UNIQUE NOT NULL,
    contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE RESTRICTED,
    assigned_admin_id UUID REFERENCES admin_users(id),
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- DRAFT, SENT, APPROVED, EXPIRED, CONVERTED
    currency VARCHAR(3) DEFAULT 'INR',
    subtotal_paise BIGINT NOT NULL,
    discount_paise BIGINT DEFAULT 0,
    tax_paise BIGINT NOT NULL,
    shipping_paise BIGINT DEFAULT 0,
    total_amount_paise BIGINT NOT NULL,
    line_items JSONB NOT NULL,
    payment_link_url TEXT,
    payment_link_id VARCHAR(128),
    expires_at TIMESTAMPTZ NOT NULL,
    converted_order_id UUID REFERENCES orders(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_quote_contact ON quotations(contact_id);
CREATE INDEX idx_quote_status ON quotations(status);

CREATE TABLE crm_timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
    event_type VARCHAR(32) NOT NULL, -- ORDER, WHATSAPP, INSTAGRAM, NOTE, QUOTE
    reference_id UUID,
    title VARCHAR(128) NOT NULL,
    summary TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_crm_timeline ON crm_timeline_events(contact_id, created_at DESC);
```

### 7.2 Scheduled Occasion Reminder Worker
```typescript
@Injectable()
export class OccasionReminderWorker {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async dispatchOccasionReminders(): Promise<void> {
    const targetDate = dayjs().add(14, 'days').toDate();
    const month = targetDate.getMonth() + 1;
    const day = targetDate.getDate();

    // Query recurring occasions matching month & day
    const occasions = await this.prisma.$queryRaw<OccasionRecord[]>`
      SELECT o.*, c.primary_phone, c.first_name, c.marketing_opt_in
      FROM crm_occasions o
      JOIN crm_contacts c ON o.contact_id = c.id
      WHERE EXTRACT(MONTH FROM o.occasion_date) = ${month}
        AND EXTRACT(DAY FROM o.occasion_date) = ${day}
        AND c.marketing_opt_in = TRUE
    `;

    for (const item of occasions) {
      await this.notificationService.sendWhatsAppTemplate({
        to: item.primary_phone,
        templateName: 'hbh_occasion_reminder_14d_v1',
        parameters: {
          customer_name: item.first_name,
          recipient_name: item.recipient_name,
          relationship: item.relationship,
          occasion_type: item.occasion_type,
          curated_link: `https://hampersbyher.com/shop?occasion=${item.occasion_type.toLowerCase()}&utm_source=occasion_reminder`,
        },
      });

      await this.prisma.crmOccasion.update({
        where: { id: item.id },
        data: { lastRemindedAt: new Date() },
      });
    }
  }
}
```

## 8. Dependencies
- **Upstream Modules**: `CartCheckout` (guest address and contact capture), `OrdersModule` (GMV and order history updates), `WhatsAppModule` and `InstagramModule` (conversation sync).
- **Downstream Modules**: `NotificationSystem` (reminder dispatches), `AdminDashboard` (Customer 360 UI).

## 9. Security
- **Data Minimization**: Store only business-necessary customer information. Do not record sensitive personal attributes (religious beliefs, health data).
- **Access Segregation**: Non-admin operators can view customer names, communication histories, and order items, but raw payment details (card numbers) and plain passwords are never accessible.
- **Export Throttling**: Exporting customer contact rosters is restricted to `SUPER_ADMIN` and capped at 500 records per export with mandatory audit log generation.

## 10. Failure Modes & Resilience
1. **Duplicate Phone Entry with Discrepant Name**: If phone `+919876543210` enters checkout as "Ananya" and later as "Sneha" (ordering for a colleague), the CRM preserves the master contact as "Ananya" and attaches "Sneha" as a secondary profile alias rather than corrupting the master record.
2. **WhatsApp Reminder Delivery Failure**: If a WhatsApp reminder fails (phone inactive or unverified), the system logs the failure and falls back to transactional Email if an email address exists on file.

## 11. Testing
- **Unit Tests**:
  - Deterministic lead scoring calculations across all parameter combinations.
  - E.164 phone number formatting and normalization logic.
- **Integration Tests**:
  - Automated cron job execution test validating date extraction for leap years and edge-of-month calendar dates.
  - Quotation generation test: asserting accurate tax and line-item total calculation in integer Paise.
- **Database Tests**: Test contact deduplication queries under concurrent simulated checkouts using PostgreSQL transaction isolation.

## 12. Observability & Monitoring
- **Metrics Tracked**:
  - `crm.contacts.total_count`.
  - `crm.occasion_reminders.sent_daily_count`.
  - `crm.occasion_reminders.conversion_rate` (Tracking orders placed within 14 days of reminder).
  - `crm.quotes.conversion_rate` (Quotes converted to paid orders; target > 40%).
- **Dashboards**: Admin Customer Intelligence Cockpit showing RFM distribution, upcoming occasion volume for the next 30 days, and corporate pipeline value.

## 13. Open Questions & Unknowns
```yaml
unknown:
  field: existing_customer_roster_migration
  status: TO_VERIFY
  source_required: brand_owner
  impact: medium
  temporary_assumption: "Past customers currently recorded in informal Instagram DMs or phone books will be backfilled via CSV import during onboarding"

unknown:
  field: default_quotation_deposit_percentage
  status: TO_VERIFY
  source_required: brand_owner
  impact: high
  temporary_assumption: "50% upfront advance deposit required for wedding and corporate bulk orders; balance due prior to dispatch"
```

## 14. Future Evolution
- AI Customer Gifting Stylist: Analyzes past purchases and predicts ideal color palettes and product categories for upcoming anniversaries.
- Corporate Client Portal: Self-serve dashboard where corporate HR managers can upload employee recipient spreadsheets and track 500+ hamper dispatches in real-time.

## 15. References
- RFM Segmentation Principles in Retail Commerce: https://en.wikipedia.org/wiki/RFM_(market_research)
- India Digital Personal Data Protection Act (DPDPA 2023) Guidelines: https://www.meity.gov.in/
- OWASP Data Protection Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
