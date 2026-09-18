<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 22_INSTAGRAM_LEAD_WORKFLOW.md — Instagram Lead Ingestion, DM Automation & Attribution Workflow

## 1. Purpose
This document establishes the system architecture, ingestion pipeline, and CRM conversion workflows for Instagram-driven customer acquisition for **Hampers by Her** (`@hampers._by_her`). Because Instagram serves as the primary visual showcase and discovery surface for the brand, converting visual engagement (Reels, Story mentions, Post comments, and Direct Messages) into structured commercial pipeline without compromising Meta Platform Policies or relying on brittle, illegal scraping techniques is vital. This specification standardizes official Meta Instagram Messaging API integration, UTM link tracking, automated DM keyword qualification, lead scoring, and quotation handoff.

## 2. Scope
- **In-Scope**:
  - Official Meta Instagram Graph API & Messenger Platform for Instagram integration.
  - Inbound webhook processing for Instagram DMs, Story Replies, and Story Mentions.
  - Keyword-triggered auto-responses (e.g., "PRICE", "HAMPER", "WEDDING", "DIWALI", "CUSTOM").
  - Multi-touch attribution tracking via UTM campaign tags embedded in Instagram Bio Linktree/Boutique links.
  - Instagram lead qualification pipeline in CRM (`NEW` ──► `QUALIFIED` ──► `QUOTE_SENT` ──► `WON`).
  - Bridge to WhatsApp: deep-linking high-intent DM inquiries into WhatsApp with pre-populated lead context.
- **Out-of-Scope**:
  - Unofficial scraping of Instagram profiles, follower lists, or private accounts.
  - Mass unsolicited outbound DM spamming (restricted strictly by Meta Developer Terms).

## 3. Context
Currently, boutique gifting operations lose over 40% of customer interest in the "DM for price" friction cycle. Prospective shoppers comment on a reel or DM an image; if an artisan takes 6 hours to manually reply with pricing and product details, the customer's emotional gifting impulse evaporates. Hampers by Her solves this by providing instant automated DM resolution linked directly to interactive catalog landing pages while capturing structured intent into the internal CRM.

```
[Instagram User Engagement]
  ├── Profile Bio Link (UTM Parameterized URL) ──► [Next.js Atelier Landing] ──► [Direct Checkout]
  ├── Story Mention / Post Comment ("Price please") 
  └── Inbound Direct Message ("Looking for anniversary hamper")
            │
            ▼ (Meta Messenger Webhook)
  [NestJS Instagram Ingress] ── verify HMAC ──► [BullMQ Ingestion Queue]
                                                        │
                                                        ▼
                                             [DM Automation Engine]
                                                        │
                         ┌──────────────────────────────┴──────────────────────────────┐
                         ▼                                                             ▼
                 [Keyword Bot]                                                  [Human Escalation]
          (Sends Interactive Product Card                                    (Assigned in Admin CRM
           + Pre-filled WhatsApp / Web Link)                                  with Full Chat History)
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-IG-01**: Meta Webhook Ingestion: Ingest real-time webhooks for `messages`, `messaging_postbacks`, and `mention` events via Meta Graph API v20.0+.
- **FR-IG-02**: Keyword Auto-Reply: Instantly respond to targeted keywords with rich generic templates containing photo carousels, pricing ranges, and direct catalog checkout links.
- **FR-IG-03**: Story Mention Ingestion: When a customer tags `@hampers._by_her` in their Instagram Story unboxing a gift, automatically capture the media URL, alert the social media manager, and dispatch a curated thank-you DM containing a 10% repeat purchase coupon.
- **FR-IG-04**: Lead Provisioning: Parse the customer's Instagram `sender.id` (IGSID), fetch public profile name (where permitted by Meta API scope), and initialize a `Lead` record with `source = 'INSTAGRAM_DM'`.
- **FR-IG-05**: UTM Link Tracking: Automatically record `utm_source=instagram`, `utm_medium=bio|story|reel`, and `utm_campaign` in session cookies during web visits to provide first-touch and last-touch conversion reporting.

### 4.2 Non-Functional Requirements
- **NFR-IG-01**: Inbound DM auto-reply latency under 3 seconds.
- **NFR-IG-02**: Meta API Rate Limit compliance: token bucket throttling ensuring the backend never breaches Meta's 200 calls/hour per user threshold.
- **NFR-IG-03**: Security: Constant-time verification of `X-Hub-Signature-256` headers on all incoming webhook payloads.

## 5. Architecture & Design

### 5.1 Instagram Lead Pipeline State Machine
```
NEW_LEAD ──► CONTACTED ──► QUALIFIED ──► QUOTE_SENT ──► NEGOTIATING
    │                                                        │
    ▼                                                        ▼
DISQUALIFIED                                                WON (Converted to Order)
                                                             │
                                                             ▼
                                                            LOST (Archived with Reason)
```

### 5.2 Conversational Flow & Hand-Off
1. **Trigger**: User DMs: *"Hi, need a hamper for my mom's 50th birthday under 3000."*
2. **Entity Extraction**: 
   - Occasion: `Birthday` (Mom)
   - Budget Tier: `₹2,500 - ₹3,500`
   - Customization: High
3. **Automated Response**:
   *"Hello! We’d love to help celebrate your mom’s special milestone 🌸 Here are our top curated birthday hampers, or you can craft a bespoke basket with custom wax seal & personal notes:"*
   - [Button: Browse Birthday Collection] (Deep link to `/shop/birthday?budget=3000`)
   - [Button: Build Custom Hamper] (Deep link to `/builder?occasion=birthday`)
   - [Button: Chat with Concierge on WhatsApp] (Opens `wa.me/...?text=Hi!%20Discussing%20Mom%2050th%20Birthday%20Hamper`)
4. **CRM Action**: Record created in `leads` table with priority score = 85 (High Intent).

## 6. Business Rules
1. **Strict Zero Scraping Policy**: The platform will never deploy headless browsers (Puppeteer/Playwright) to log into Instagram consumer accounts or scrape private DMs. All interactions use the official Meta Graph API connected to an Instagram Professional Business Account.
2. **24-Hour Standard Messaging Window**: Free-form DM replies can only be sent within 24 hours of the user’s last incoming message. Operators attempting to message outside this window must rely on the user re-engaging or transition to WhatsApp/Email if consent exists.
3. **No Unsolicited Cold Outbound**: Never send cold DMs to users who merely followed the account or liked a post; automation is strictly reactionary to user-initiated incoming touches.
4. **Discounts & Coupons**: Promotional discount codes delivered via DMs are single-use, tied to an expiration window (72 hours), and tracked against the lead record to prevent coupon scraping.

## 7. Technical Details

### 7.1 Database Entity Relations (Instagram Leads Subsystem)
```sql
CREATE TABLE instagram_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    igsid VARCHAR(128) UNIQUE NOT NULL, -- Instagram Scoped User ID
    username VARCHAR(128),
    full_name VARCHAR(128),
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    profile_pic_url TEXT,
    follower_tier VARCHAR(32) DEFAULT 'STANDARD', -- INFLUENCER, VIP, STANDARD
    first_contact_at TIMESTAMPTZ DEFAULT NOW(),
    last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
    utm_source VARCHAR(64) DEFAULT 'instagram',
    utm_campaign VARCHAR(64),
    utm_content VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ig_leads_igsid ON instagram_leads(igsid);
CREATE INDEX idx_ig_leads_lead ON instagram_leads(lead_id);

CREATE TABLE instagram_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instagram_lead_id UUID NOT NULL REFERENCES instagram_leads(id) ON DELETE CASCADE,
    interaction_type VARCHAR(32) NOT NULL, -- DM, STORY_REPLY, STORY_MENTION, COMMENT
    message_id VARCHAR(128) UNIQUE,
    media_url TEXT,
    raw_text TEXT,
    bot_replied BOOLEAN DEFAULT FALSE,
    bot_reply_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ig_interaction_lead ON instagram_interactions(instagram_lead_id, created_at DESC);
```

### 7.2 Webhook Handling Sample Implementation
```typescript
@Injectable()
export class InstagramService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async processInboundMessage(entry: InstagramWebhookEntry): Promise<void> {
    const messaging = entry.messaging[0];
    const igsid = messaging.sender.id;
    const text = messaging.message?.text?.trim();

    // 1. Upsert Instagram Lead
    const lead = await this.prisma.instagramLead.upsert({
      where: { igsid },
      update: { lastInteractionAt: new Date() },
      create: {
        igsid,
        firstContactAt: new Date(),
        lastInteractionAt: new Date(),
      },
    });

    // 2. Keyword Classification & Auto-Dispatch
    if (this.isPriceInquiry(text)) {
      await this.sendCatalogQuickReply(igsid);
    } else if (this.isCustomHamperInquiry(text)) {
      await this.sendCustomHamperOptions(igsid);
    }

    // 3. Log Interaction Event
    await this.prisma.instagramInteraction.create({
      data: {
        instagramLeadId: lead.id,
        interactionType: 'DM',
        messageId: messaging.message.mid,
        rawText: text,
        botReplied: true,
      },
    });
  }
}
```

## 8. Dependencies
- **Upstream Modules**: Meta Graph API (`graph.facebook.com/v20.0/me/messages`), Meta Webhook Gateway.
- **Downstream Modules**: `CRMModule` (pipeline tracking, contact synchronization), `AnalyticsModule` (multi-touch UTM attribution).

## 9. Security
- **Meta Verification Token**: Handshake verification token validated on `/api/v1/integrations/instagram/webhook`.
- **HMAC Payload Authentication**: Validate `sha256` payload signature against Meta App Secret.
- **Data Privacy**: Instagram usernames and profile pictures cached in accordance with Meta Platform Terms; personal identifiers pruned if lead remains inactive for >180 days.

## 10. Failure Modes & Resilience
1. **Meta Graph API 500 / Network Error**: Inbound messages are acknowledged to Meta with 200 OK after being pushed into Redis BullMQ. If outbound reply encounters an error, worker retries up to 3 times before raising an admin alert.
2. **Messaging Window Expiry**: When attempting to message a user past the 24-hour window, the API returns error code 10. The system marks the lead `ACTION_REQUIRED_MANUAL` and instructs the sales team to engage via alternative channels if user provided email/phone.
3. **Webhook Floods (Viral Reel)**: A viral reel generating 10,000 comments in an hour triggers BullMQ rate-limiting queues, processing batch replies at a steady 30 messages/second to avoid Meta spam suspension.

## 11. Testing
- **Unit Tests**:
  - Regex keyword matching for price, occasion, and custom hamper intents.
  - Constant-time HMAC signature verification tests.
- **Integration Tests**:
  - Mock Meta webhook payload ingestion and database entity upsertion tests.
  - Outbound message dispatcher tests asserting correct JSON payload formatting.
- **Contract Tests**: Verify compatibility against Meta Graph API v20.0 schemas.

## 12. Observability & Monitoring
- **Metrics**:
  - `instagram.inbound_dms_count`.
  - `instagram.bot_response_latency_ms` (p95 < 2500ms).
  - `instagram.lead_conversion_rate` (IG Inbound ──► Web Checkout).
  - `instagram.story_mentions_captured_count`.
- **Dashboards**: Admin Lead Cockpit showcasing real-time funnel: Instagram Visits ──► Leads ──► Quotes Sent ──► Paid Orders.

## 13. Open Questions & Unknowns
```yaml
unknown:
  field: meta_instagram_business_account_id
  status: TO_VERIFY
  source_required: brand_owner
  impact: high
  temporary_assumption: "Placeholder linked to Facebook Page for development sandbox testing"

unknown:
  field: dedicated_social_media_manager_seat
  status: TO_VERIFY
  source_required: brand_owner
  impact: medium
  temporary_assumption: "Single admin operator role handles both Instagram DM triage and WhatsApp concierge initially"
```

## 14. Future Evolution
- Direct checkout inside Instagram via Meta Commerce Native Shops sync.
- AI automated DM agent capable of analyzing photos sent by customers ("Can you make a hamper matching this theme?") and recommending real catalog components.

## 15. References
- Meta Messenger Platform for Instagram: https://developers.facebook.com/docs/messenger-platform/instagram/
- Meta Graph API Webhooks Documentation: https://developers.facebook.com/docs/graph-api/webhooks/
- Meta Platform Terms and Commercial Policies: https://developers.facebook.com/terms/
