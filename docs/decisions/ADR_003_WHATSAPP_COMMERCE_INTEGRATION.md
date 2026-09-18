<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# ADR 003: WhatsApp Business Cloud API & Dual-Track Commerce Integration

## Status
APPROVED

## Date
2026-09-18

## Context
A substantial portion of boutique gifting in India operates over WhatsApp conversations. Customers frequently require bespoke consultations for weddings, anniversary milestones, corporate bulk orders, and custom hamper styling that cannot be completely automated through static catalog checkout. 

Operating WhatsApp manually through personal phones or basic WhatsApp Business apps results in lost lead context, zero order status automation, unsearchable conversation histories, lack of CRM linkage, and risk of employee burnout during festive seasons. Conversely, forcing every shopper exclusively through rigid web checkout alienates customers seeking personal curation and human touch.

## Decision
We implement a **Dual-Track Commerce Strategy** powered by direct integration with the official **Meta WhatsApp Business Cloud API**:
1. **Direct Web Checkout Track**: Ready-made and structured custom hampers complete via self-serve web checkout.
2. **Consultative WhatsApp Track**: High-touch bespoke, bulk, wedding, and corporate inquiries link directly to automated WhatsApp chat flows via pre-filled `wa.me` deep links encoding cart/builder state.
3. **Architecture**:
   - Webhook-driven ingress via NestJS `WhatsAppModule` with HMAC-SHA256 signature verification.
   - Message routing engine that distinguishes between transactional notifications (order confirmation, tracking updates), automated conversational bots (quick replies, requirement gathering), and human-agent handoff.
   - Live CRM synchronization: Every inbound WhatsApp number maps to a `CRMContact`, auto-linking message threads, quotations, and order histories.
   - Pre-approved Meta HSM (Highly Structured Message) templates for transactional milestones to comply with Meta's 24-hour customer service window policies.

## Consequences
### Positive
- Preserves the handcrafted, personal concierge brand identity of Hampers by Her while introducing enterprise-grade tracking.
- Seamless omni-channel handoff: A customer can build a hamper on the web, hit "Consult on WhatsApp", and the concierge agent sees the exact cart items, budget, and recipient notes instantly.
- Automates 80%+ of repetitive status questions ("Where is my order?", "Send payment link") freeing atelier artisans to focus on curation.

### Negative / Trade-Offs
- Requires Meta Business verification, phone number provisioning, and ongoing per-conversation template messaging fees payable to Meta.
- Webhook resilience requirements: Inbound spikes during festive campaigns require resilient Redis BullMQ queuing to prevent dropped customer inquiries.
