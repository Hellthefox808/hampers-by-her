<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 41_ROADMAP.md — Engineering Roadmap, Phased Execution & Milestone Gates

## 1. Purpose
This document establishes the strategic 12-phase engineering roadmap, implementation timeline, resource allocation, and milestone verification criteria for transforming **Hampers by Her** from an artisanal Instagram-first gifting boutique into a high-conversion, enterprise-grade digital commerce platform and WhatsApp commerce atelier. The roadmap enforces strict progressive delivery: establishing brand and UX contracts first, constructing the core transactional modular monolith, introducing the proprietary bespoke Hamper Builder, deploying conversational CRM workflows, and hardening infrastructure for high-concurrency festival peaks (Diwali, Rakhi, Valentine's) without compromising the handcrafted ethos of the brand.

## 2. Scope
- **In-Scope**:
  - Detailed phased breakdown spanning all 12 defined project phases:
    - **Phase 0**: Discovery, Research & Baseline Verification
    - **Phase 1**: Brand Identity, Design Tokens & Mobile UX Contracts
    - **Phase 2**: Foundation, Modular Monolith Scaffolding & DevOps CI/CD
    - **Phase 3**: Product Catalog, Collections & Media Ingestion
    - **Phase 4**: Shopping Cart, Pricing Engine & 2-Step Mobile Checkout
    - **Phase 5**: Bespoke Hamper Builder & Customization Atelier
    - **Phase 6**: Order Management, 3PL Delivery Logistics & Invoicing
    - **Phase 7**: WhatsApp Commerce, Instagram Leads & CRM Pipeline
    - **Phase 8**: Atelier Operations & Admin Dashboard
    - **Phase 9**: Unified Analytics, Server-Side CAPI & Funnel Optimization
    - **Phase 10**: Production Hardening, Security Audits & Load Testing
    - **Phase 11**: Hyper-Scale, B2B Corporate Portals & AI Gifting Assistant
  - Milestone gates, exit criteria, dependencies, technical debt budgets, and verification protocols.
- **Out-of-Scope**:
  - Premature implementation of Phase 11 microservice decomposition or speculative ML engines prior to Phase 10 validation.

## 3. Context
Rushing directly to code without architectural discipline in gifting commerce invariably leads to fragmented customer data, inventory overselling, and lost WhatsApp orders. The Hampers by Her roadmap uses a phased dependency model where each phase builds upon the cryptographically and operationally verified foundation of its predecessors.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 HAMPERS BY HER 12-PHASE ROADMAP TIMELINE                    │
└─────────────────────────────────────────────────────────────────────────────┘
  Phase 0: Discovery ──► Phase 1: Brand & UX ──► Phase 2: Core Foundation
                                                       │
  Phase 5: Hamper Builder ◄── Phase 4: Cart/Checkout ◄── Phase 3: Catalog
        │
        ▼
  Phase 6: Orders & Logistics ──► Phase 7: WhatsApp/CRM ──► Phase 8: Admin Operations
                                                                 │
  Phase 11: Scale & B2B ◄── Phase 10: Hardening ◄── Phase 9: Unified Analytics
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-RDM-01**: Strict Gate Verification: Progression from Phase $N$ to Phase $N+1$ requires 100% completion of defined exit criteria and passing automated test suites.
- **FR-RDM-02**: MVP Delivery: Phases 0 through 8 constitute the minimum viable product (MVP) required for public commercial launch.
- **FR-RDM-03**: Zero Unverified Inventions: The execution of any phase must adhere strictly to verified brand assets; any missing operational fact must be held in the `unknown:` registry.
- **FR-RDM-04**: Continuous Documentation Updates: Every milestone completion must update `44_MASTER_INDEX.md` and generate an entry in the repository changelog.

### 4.2 Non-Functional Requirements
- **NFR-RDM-01**: Sprint Velocity Discipline: Engineering tasks must be sized into 2-week sprint cycles with a maximum of 40 story points per cycle across a core 4-engineer team.
- **NFR-RDM-02**: Quality Gates: Code coverage must remain $\ge 85\%$ for core financial, pricing, and inventory modules throughout all execution phases.

## 5. Architecture & Design
### 5.1 12-Phase Milestone Delivery Matrix

| Phase | Name | Duration | Primary Focus & Deliverables | Exit Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | **Discovery** | Weeks 1–2 | Competitive audit, brand research, evidence logging, tech selection. | Research notes complete, Instagram evidence log established. |
| **Phase 1** | **Brand + UX** | Weeks 3–4 | Atelier design tokens, Figma UI kit, mobile journeys (A–F), micro-interactions. | UI design system approved, token CSS variables compiled. |
| **Phase 2** | **Foundation** | Weeks 5–6 | Next.js 15, NestJS modular monolith, PostgreSQL schema, Docker, AWS VPC. | CI/CD pipeline passing, database migrations functional. |
| **Phase 3** | **Catalog** | Weeks 7–8 | Ready-made hampers, standalone products, S3 media pipeline, Sharp WebP. | Catalog CRUD API operational, CloudFront CDN verified. |
| **Phase 4** | **Cart & Checkout** | Weeks 9–10 | Cart state (Zustand), integer pricing engine, 2-step checkout, Razorpay UPI. | Vitest financial property tests pass, test payment verified. |
| **Phase 5** | **Hamper Builder** | Weeks 11–12 | 11-step guided atelier, 3D volume heuristic, wax seal/ribbon customizer. | Builder interactive on mobile, box fullness math validated. |
| **Phase 6** | **Orders & Delivery** | Weeks 13–14 | 11-stage order lifecycle, Shiprocket AWB dispatch, invoice PDF generation. | End-to-end order placement to AWB label generation passes. |
| **Phase 7** | **WhatsApp & CRM** | Weeks 15–16 | Meta Cloud API webhooks, Instagram lead parser, CRM lead pipeline. | Inbound DM creates CRM lead; WhatsApp template delivered. |
| **Phase 8** | **Admin Operations** | Weeks 17–18 | 8 operational dashboards, RBAC, atelier QC photo gate, packing slips. | Operations team can fulfill orders and manage inventory. |
| **Phase 9** | **Analytics** | Weeks 19–20 | First-party event engine, Meta Conversions API (CAPI), GA4 server sync. | 32 commerce events firing; zero private PII leakage. |
| **Phase 10**| **Hardening** | Weeks 21–22 | OWASP ASVS audit, k6 load testing (500 req/s), backup DR simulation. | Zero critical vulnerabilities; restore test verified. |
| **Phase 11**| **Scale & B2B** | Post-Launch| Corporate bulk order portal, wedding registry, AI Gifting Concierge. | Multi-address shipping operational, B2B quotation flow live. |

## 6. Business Rules
- **BR-RDM-01**: **No Commercial Go-Live without Financial Reconciliation**: Production checkout cannot be enabled for real customer cards/UPI until automated end-of-day Razorpay payment reconciliation crons have executed successfully for 7 consecutive days in staging.
- **BR-RDM-02**: **Atelier QC Photo Gate Invariant**: The order management workflow in Phase 6 cannot bypass the physical studio photo capture step; packing labels cannot be marked `READY_FOR_PICKUP` without an uploaded QC image.
- **BR-RDM-03**: **Zero-Downtime Migration Policy**: All database schema migrations introduced from Phase 4 onward must follow the expand-contract pattern (never drop active columns synchronously).
- **BR-RDM-04**: **Code Freeze During Peak Festivals**: A strict code freeze (critical hotfixes only) is automatically enforced 7 days prior to Raksha Bandhan, Diwali, and Valentine's Day.

## 7. Technical Details

### 7.1 Phase-by-Phase Technical Specifications & Deliverables

#### Phase 0: Discovery & Verification (Weeks 1–2)
- **Technical Focus**: Environment baseline, competitive teardown, Instagram evidence parsing.
- **Deliverables**:
  - `00_RESEARCH_NOTES.md`, `docs/research/COMPETITIVE_ANALYSIS.md`.
  - Formal anti-hallucination boundary established in `docs/research/INSTAGRAM_EVIDENCE_LOG.md`.

#### Phase 1: Brand & UX System (Weeks 3–4)
- **Technical Focus**: Design system tokens, mobile viewport optimization, typography.
- **Deliverables**:
  - `02_BRAND_REQUIREMENTS.md`, `04_BRAND_UX.md`, `05_UI_DESIGN_SYSTEM.md`.
  - Tailwind CSS v4 design token configurations (`globals.css`).

#### Phase 2: Core Engineering Foundation (Weeks 5–6)
- **Technical Focus**: Architecture scaffolding, database schemas, AWS Terraform.
- **Deliverables**:
  - Modular Monolith core (`11_BACKEND_ARCHITECTURE.md`), Prisma DDL (`13_DATABASE_DESIGN.md`).
  - Terraform AWS VPC, ECS Fargate, Aurora PostgreSQL cluster (`33_DEVOPS.md`, `35_CLOUD_ARCHITECTURE.md`).
  - GitHub Actions CI/CD workflows (`34_CI_CD.md`).

#### Phase 3: Catalog & Media Pipeline (Weeks 7–8)
- **Technical Focus**: Dual-track catalog data modeling, S3 image optimization.
- **Deliverables**:
  - `14_PRODUCT_CATALOG.md`, `26_MEDIA_CDN.md`.
  - Sharp image processing worker (WebP/AVIF derivation generation with EXIF stripping).

#### Phase 4: Cart, Pricing & Checkout (Weeks 9–10)
- **Technical Focus**: Client-server cart synchronization, integer arithmetic, Razorpay integration.
- **Deliverables**:
  - `17_CART_CHECKOUT.md`, `19_PAYMENT_ARCHITECTURE.md`, `39_DSA.md` (Algorithm 2).
  - Razorpay Webhook listener with constant-time HMAC validation.

#### Phase 5: Hamper Builder Atelier (Weeks 11–12)
- **Technical Focus**: 11-step interactive builder, 3D bin-packing heuristic, customization engine.
- **Deliverables**:
  - `15_HAMPER_BUILDER.md`, `16_CUSTOMIZATION_ENGINE.md`.
  - Framer Motion progressive step container with mobile thumb-zone layout.

#### Phase 6: Order Lifecycle & Logistics (Weeks 13–14)
- **Technical Focus**: 11-stage order state machine, Shiprocket API integration, GST PDF invoices.
- **Deliverables**:
  - `18_ORDER_MANAGEMENT.md`, `20_DELIVERY_LOGISTICS.md`.
  - Dynamic AWB assignment, tracking webhook ingest, PDF invoice generator.

#### Phase 7: Conversational Commerce & CRM (Weeks 15–16)
- **Technical Focus**: Meta Cloud API, Instagram DM parser, CRM lead pipeline.
- **Deliverables**:
  - `21_WHATSAPP_INTEGRATION.md`, `22_INSTAGRAM_LEAD_WORKFLOW.md`, `24_CRM.md`.
  - Inbound lead classification worker, WhatsApp interactive cart link dispatcher.

#### Phase 8: Operations & Admin Dashboard (Weeks 17–18)
- **Technical Focus**: Administrative portals, RBAC, QC verification gate.
- **Deliverables**:
  - `23_ADMIN_DASHBOARD.md`, `25_AUTH_SECURITY.md`.
  - Super Admin, Atelier Operations, and Customer Support role-based views.

#### Phase 9: Unified Analytics & Funnel Tracking (Weeks 19–20)
- **Technical Focus**: Server-side CAPI, GA4 Measurement Protocol, privacy guardrails.
- **Deliverables**:
  - `29_ANALYTICS.md`, `28_SEO.md`.
  - 32-event telemetry publisher, XML sitemaps, Google Merchant feed.

#### Phase 10: Production Hardening & Pre-Launch (Weeks 21–22)
- **Technical Focus**: Penetration testing, k6 load testing, DR drill, runbook validation.
- **Deliverables**:
  - `31_TESTING.md`, `32_PERFORMANCE.md`, `36_MONITORING_OBSERVABILITY.md`, `37_BACKUP_DR.md`.
  - `42_DEPLOYMENT_RUNBOOK.md`, `43_RELEASE_CHECKLIST.md`.

#### Phase 11: Hyper-Scale & B2B Expansion (Post-Launch)
- **Technical Focus**: Corporate bulk ordering, multi-recipient shipping, AI concierge.
- **Deliverables**:
  - B2B quotation negotiation portal, CSV multi-recipient bulk address dispatch, LLM semantic search.

## 8. Dependencies
- Cross-Phase Dependency Graph:
  ```
  Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
                                          │           │           │
                                          ▼           ▼           ▼
                                      Phase 6 ──► Phase 7 ──► Phase 8
                                                                  │
                                      Phase 11 ◄── Phase 10 ◄── Phase 9
  ```

## 9. Security
- **Milestone Security Gates**:
  - Phase 2: Static Application Security Testing (SAST) integrated into GitHub Actions (`npm audit`, Trivy container scan).
  - Phase 4: PCI DSS SAQ-A compliance verification (zero card data touch point).
  - Phase 10: Full OWASP ASVS Level 2 security audit and third-party penetration testing.

## 10. Failure Modes
| Milestone Risk | Probability | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Meta WABA Delay** | High | High | Fall back to Web Checkout + SMS/Email notifications while approval completes |
| **Catalog Asset Delay** | Medium | Medium | Utilize high-fidelity editorial mock placeholders tagged `TO_VERIFY` |
| **Payment Gateway Review** | Medium | Critical | Parallel onboarding on both Razorpay and Cashfree |
| **Festival Traffic Surge** | High | High | Aurora Serverless v2 auto-scaling (up to 16 ACUs) and Redis cache pre-warming |

## 11. Testing
- **Milestone Testing Protocol**: Each phase must achieve a passing status on its respective automated test suite before git merge to `staging` or `main`.
- **Pre-Launch End-to-End Drill**: Phase 10 requires running the complete Playwright customer journey from Instagram ad click through WhatsApp confirmation to delivery tracking.

## 12. Observability
- **Milestone Tracking**: Sprints and velocity tracked via GitHub Projects / Linear.
- **Operational Health Index**: Real-time deployment health monitored through Datadog/CloudWatch dashboard linking release tags to error rates.

## 13. Open Questions
```yaml
unknown:
  field: target_commercial_launch_date
  status: TO_VERIFY
  source_required: brand_owner
  impact: high
  temporary_assumption: "Roadmap assumes a 22-week engineering timeline starting from project initiation to public production release."
```

```yaml
unknown:
  field: initial_catalog_sku_count
  status: TO_VERIFY
  source_required: brand_owner
  impact: medium
  temporary_assumption: "MVP modeled on 25 ready-made hampers, 80 standalone gift components, and 4 packaging container sizes."
```

## 14. Future Evolution
- **Phase 12 (Omnichannel Expansion)**: Integration of offline studio POS (Point of Sale) systems for pop-up luxury exhibitions and festive trunk shows.
- **International Gifting**: Cross-border NRI gifting capabilities allowing customers in the US, UK, and UAE to order hampers delivered to families in India with currency auto-conversion.

## 15. References
- Martin, R. C. (2017). *Clean Architecture: A Craftsman's Guide to Software Structure and Design*. Prentice Hall.
- Highsmith, J. (2004). *Agile Project Management: Creating Innovative Products*. Addison-Wesley.
- AWS Well-Architected Framework: Reliability and Performance Pillars.

<!-- DOCUMENT END: 41_ROADMAP.md -->
