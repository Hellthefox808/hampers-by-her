<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 43_RELEASE_CHECKLIST.md — Pre-Launch Verification, Quality Gates & Go/No-Go Release Checklist

## 1. Purpose
This document establishes the definitive, non-negotiable pre-launch verification protocol, operational quality gates, and executive Go/No-Go decision matrix for the commercial launch of **Hampers by Her**. To protect the brand's luxury reputation, artisanal credibility, financial integrity, and customer trust, no production release may occur until every item across the security, commerce, logistics, regulatory compliance, performance, and atelier operational checklists has been empirically verified and formally signed off.

## 2. Scope
- **In-Scope**:
  - Comprehensive quality gates covering:
    1. **Security & Data Privacy**: OWASP ASVS Level 2, DPDPA 2023 compliance, secret management, penetration test sign-off.
    2. **Core Commerce & Financial Integrity**: Journeys A through F, integer pricing determinism, Razorpay UPI reconciliation, coupon rules.
    3. **Hamper Builder & Atelier Experience**: 3D bin-packing heuristic, wax seal/ribbon customizer, mobile thumb-zone usability.
    4. **Logistics, Pincodes & Invoicing**: Shiprocket API contracts, AWB generation, GST tax split (CGST/SGST), PDF invoices.
    5. **Meta & WhatsApp Conversational Commerce**: Meta WABA approval, 24h window compliance, Instagram DM webhook latency.
    6. **Frontend Performance & Core Web Vitals**: LCP $< 2.0\text{s}$, INP $< 150\text{ms}$, CLS $< 0.05$, responsive images.
    7. **Observability, Backups & Disaster Recovery**: Aurora 35-day PITR, synthetic monitoring, CloudWatch alarms, PagerDuty on-call.
    8. **Atelier Operational Readiness**: Packaging supplies stock, QC photo gate protocol, customer support training.
  - Formal Go/No-Go voting quorum and emergency launch abort criteria.
- **Out-of-Scope**:
  - Post-launch feature backlog evaluations (governed by `41_ROADMAP.md`).

## 3. Context
Gifting purchases carry immense emotional weight. A delayed delivery, a forgotten handwritten gift card, a crushed box, or a payment glitch on Valentine's Eve permanently destroys customer trust. Unlike commodity retail where minor delays are tolerable, gifting requires 100% operational perfection. This checklist prevents premature launches.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       GO / NO-GO SIGN-OFF QUORUM                            │
└─────────────────────────────────────────────────────────────────────────────┘
  Lead Architect       Head of Operations      Security Engineer      Brand Founder
   [Tech & Perf]          [Logistics & QC]       [DPDPA & PCI]        [Atelier UX]
        │                       │                      │                    │
        └───────────────────────┴──────────┬───────────┴────────────────────┘
                                           │
                                           ▼ (Unanimous Consent Required)
                              [GO FOR PRODUCTION LAUNCH]
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-CHK-01**: Mandatory Verification Evidence: Every checklist item must reference an automated test run, CloudWatch dashboard link, signed audit document, or physical verification record.
- **FR-CHK-02**: Zero Critical Blockers: A single unverified or failed critical item ($P_0$) results in an automatic, immediate **NO-GO** decision.
- **FR-CHK-03**: Dual Sign-Off: Each domain checklist must be physically signed off by both the technical lead and the operational owner.

### 4.2 Non-Functional Requirements
- **NFR-CHK-01**: Audit Trail Retention: Completed release checklists with timestamped cryptographic hashes must be archived in S3 compliance storage for a minimum of 3 years.

## 5. Architecture & Design
### 5.1 Pre-Launch Verification Matrix & Quality Gates

```
                                    ┌───────────────────────┐
                                    │ PRE-LAUNCH EVALUATION │
                                    └───────────┬───────────┘
                                                │
       ┌────────────────────┬───────────────────┼───────────────────┬────────────────────┐
       ▼                    ▼                   ▼                   ▼                    ▼
[1. Security]        [2. Commerce]       [3. Logistics]       [4. Performance]     [5. Atelier Ops]
  • OWASP ASVS         • Pricing Math      • Pincode SLA        • LCP < 2.0s         • QC Photo Gate
  • DPDPA 2023         • Razorpay UPI      • Shiprocket AWB     • INP < 150ms        • Ribbon Stocks
  • No Secrets         • Cart Lock TTL     • GST Invoicing      • 100% Mobile Ready  • Packaging Boxes
```

## 6. Business Rules
- **BR-CHK-01**: **The Unanimous Quorum Invariant**: Commercial production traffic cutover requires 100% unanimous approval from:
  1. Lead Software Architect (Platform stability, security, and performance).
  2. Head of Atelier Operations (Physical packaging supplies, QC staff, courier contracts).
  3. Lead Security & Compliance Officer (DPDPA 2023, payment security, privacy policy).
  4. Brand Founder / Creative Director (Brand aesthetics, typography, customer communication tone).
- **BR-CHK-02**: **Immediate Abort Conditions**: An ongoing release is aborted immediately if:
  - Error rate on checkout endpoints exceeds $0.5\%$ during the first 60 minutes.
  - Razorpay payment capture webhook delay exceeds 10 seconds.
  - Database CPU utilization on Aurora Serverless v2 exceeds $75\%$ under baseline load.

## 7. Technical Details

### 7.1 Domain Checklist 1: Security & Compliance ($P_0$)
- [ ] **SEC-01**: All hardcoded secrets removed; zero AWS keys or API tokens present in git history (`trufflehog` scan clean).
- [ ] **SEC-02**: AWS Secrets Manager rotation active for Meta Graph API, Razorpay, and database credentials.
- [ ] **SEC-03**: DPDPA 2023 compliance verified: Explicit consent banner on phone capture; privacy policy accessible; data deletion mechanism active.
- [ ] **SEC-04**: PCI DSS SAQ-A verified: Zero credit card numbers or CVVs touch application servers; hosted Razorpay fields only.
- [ ] **SEC-05**: TLS 1.3 enforced on CloudFront; HTTP strictly redirected to HTTPS; HSTS header active with `max-age=31536000`.
- [ ] **SEC-06**: Rate limiting verified: Max 5 OTP requests per phone per hour; max 20 checkout attempts per IP per minute.
- [ ] **SEC-07**: CORS restricted strictly to `hampersbyher.com` and `stg.hampersbyher.com`; wildcard `*` prohibited.

### 7.2 Domain Checklist 2: Core Commerce & Financial Integrity ($P_0$)
- [ ] **COM-01**: Server-side integer Paise pricing determinism verified via 10,000 property-based Vitest cycles (`39_DSA.md`).
- [ ] **COM-02**: Razorpay live credentials configured; test transactions across UPI Intent, Net Banking, and Credit Cards verified.
- [ ] **COM-03**: Webhook signature verification active with `crypto.timingSafeEqual`; HMAC mismatch returns HTTP 401.
- [ ] **COM-04**: Idempotency verified: Duplicate payment webhooks acknowledge receipt without creating duplicate orders.
- [ ] **COM-05**: Inventory locking verified: Cart reserves items for 15 minutes; Redis TTL releases held stock upon abandonment.
- [ ] **COM-06**: Coupon rules verified: Minimum order values, max discount caps, and single-use promo codes tested.

### 7.3 Domain Checklist 3: Hamper Builder & Customization Atelier ($P_0$)
- [ ] **HAM-01**: 11-step mobile builder interactive without horizontal scroll or layout shift on 390px screens (iPhone 14).
- [ ] **HAM-02**: 3D bin-packing heuristic rejects overloaded containers and flags fragile collisions (`evaluateHamperPacking`).
- [ ] **HAM-03**: Customization add-on constraints verified: Character limit on gift tags (50 chars), card messages (300 chars).
- [ ] **HAM-04**: S3 presigned URL photo uploads: Max 10MB limit; PNG/JPEG only; EXIF location metadata stripped by Sharp.

### 7.4 Domain Checklist 4: Logistics & Order Operations ($P_0$)
- [ ] **LOG-01**: Shiprocket live API keys connected; test AWB generation and label printing verified on studio thermal printer.
- [ ] **LOG-02**: Pincode serviceability database populated with metro, tier-1, and tier-2 express zones.
- [ ] **LOG-03**: Automated GST compliant tax invoice PDF generation functional, displaying brand GSTIN, HSN codes, and CGST/SGST split.
- [ ] **LOG-04**: Atelier QC photo capture gate enforced: Order cannot transition to `SHIPPED` without admin photo upload.

### 7.5 Domain Checklist 5: Meta & WhatsApp Conversational Ecosystem ($P_1$)
- [ ] **WHA-01**: Meta WhatsApp Business Account (WABA) verified with green tick or approved business profile status.
- [ ] **WHA-02**: 5 core transactional message templates approved by Meta: `order_confirmed`, `out_for_delivery`, `delivered`, `ndr_alert`, `abandoned_cart`.
- [ ] **WHA-03**: Instagram DM webhook processing latency $< 2.0\text{s}$; inbound leads successfully appear in CRM workspace.
- [ ] **WHA-04**: 24-hour customer service window logic enforced: Bot transitions to human agent or template outside window.

### 7.6 Domain Checklist 6: Frontend Performance & Core Web Vitals ($P_1$)
- [ ] **PERF-01**: Google Lighthouse Mobile score $\ge 90$ on Homepage, Product Details, and Hamper Builder pages.
- [ ] **PERF-02**: Largest Contentful Paint (LCP) $< 2.0\text{s}$ on 4G mobile emulation.
- [ ] **PERF-03**: Cumulative Layout Shift (CLS) $< 0.05$ across all responsive breakpoints.
- [ ] **PERF-04**: Interaction to Next Paint (INP) $< 150\text{ms}$ during cart additions and builder drawer interactions.
- [ ] **PERF-05**: CloudFront CDN caching verified: Product images return `X-Cache: Hit from cloudfront` with 1-year cache headers.

### 7.7 Domain Checklist 7: Observability & Disaster Recovery ($P_0$)
- [ ] **OBS-01**: Aurora Serverless v2 automated daily backup verified with 35-day point-in-time recovery (PITR) window.
- [ ] **OBS-02**: Restoration test successfully performed on staging cluster in $< 20\text{ minutes}$ (`37_BACKUP_DR.md`).
- [ ] **OBS-03**: CloudWatch Alarms active: 5xx Error Rate $> 1\%$, RDS CPU $> 75\%$, Dead-Letter Queue $> 5$ messages.
- [ ] **OBS-04**: PagerDuty / Telegram on-call alerting verified: Test alert triggers engineer phone within 60 seconds.

### 7.8 Domain Checklist 8: Atelier Physical Supplies & Staff Training ($P_0$)
- [ ] **OPS-01**: Minimum packaging inventory physically in studio: 200 Small, 300 Medium, 200 Large boxes, wood wool, ribbons.
- [ ] **OPS-02**: Atelier staff trained on Admin Dashboard order flow, QC photo uploading, and barcode thermal printer operation.
- [ ] **OPS-03**: Returns, damages, and refund standard operating procedure (SOP) printed and laminated in studio.

## 8. Dependencies
- Cross-Referenced Verification Documents:
  - `19_PAYMENT_ARCHITECTURE.md` (Checklist 2).
  - `20_DELIVERY_LOGISTICS.md` (Checklist 4).
  - `21_WHATSAPP_INTEGRATION.md` (Checklist 5).
  - `25_AUTH_SECURITY.md` (Checklist 1).
  - `32_PERFORMANCE.md` (Checklist 6).
  - `37_BACKUP_DR.md` (Checklist 7).
  - `42_DEPLOYMENT_RUNBOOK.md` (Execution Runbook).

## 9. Security
- **Checklist Integrity**: Completed checklists are digitally signed using GPG keys by the engineering leads and archived in tamper-evident S3 Object Lock storage.
- **Credential Hygiene**: Verification tests must be performed using dedicated staging test accounts; zero production administrative tokens shared during pre-launch testing.

## 10. Failure Modes
| Evaluation Result | Action Required | Escalation Path |
| :--- | :--- | :--- |
| **Any $P_0$ Item Fails** | Immediate **NO-GO**. Halt deployment. | Lead Architect notifies Founder; fix deployed to staging for re-test |
| **$P_1$ Item Fails with Workaround** | Conditional GO if operational fallback approved in writing | Requires Founder + Lead Architect co-signature |
| **Post-Launch Checkout Error Spike** | Trigger Immediate Rollback (`42_DEPLOYMENT_RUNBOOK.md`) | On-call SRE rolls back ECS service within 120 seconds |

## 11. Testing
- **End-to-End Dry Run**: 48 hours prior to launch, execute an end-to-end dry run:
  1. Place real order with live UPI payment for ₹1.00.
  2. Verify order appears in Admin Dashboard.
  3. Upload physical QC photo via mobile browser.
  4. Generate live Shiprocket label.
  5. Cancel/refund test order and verify Razorpay webhook auto-reconciliation.

## 12. Observability
- **Release Dashboard**: A dedicated real-time "Launch Control" Datadog/CloudWatch dashboard displaying active visitors, cart creations, checkout starts, payments captured, and error rates side-by-side.

## 13. Open Questions
```yaml
unknown:
  field: physical_packaging_stock_audit
  status: TO_VERIFY
  source_required: brand_owner
  impact: high
  temporary_assumption: "Pre-launch assumes physical studio inventory is verified by brand owner 72 hours prior to production traffic enable."
```

```yaml
unknown:
  field: official_gstin_registration_number
  status: TO_VERIFY
  source_required: brand_owner
  impact: high
  temporary_assumption: "Invoice generator configured with placeholder GSTIN 27ABCDE1234F1Z5 pending verified legal business registration input."
```

## 14. Future Evolution
- **Automated Continuous Verification**: Convert manual checklist items into automated synthetic test assertions integrated directly into GitHub Actions deployment environments.
- **AI-Powered Visual Regression**: Incorporate automated Percy/Playwright visual comparison runs to verify design token consistency before every release.

## 15. References
- OWASP Application Security Verification Standard (ASVS) 4.0.3.
- Digital Personal Data Protection Act (DPDPA), India (2023).
- Google Core Web Vitals Official Measurement Guidelines (2026).
- PCI Security Standards Council: SAQ-A Merchant Guidelines.

<!-- DOCUMENT END: 43_RELEASE_CHECKLIST.md -->
