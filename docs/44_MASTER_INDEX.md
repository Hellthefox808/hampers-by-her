<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 44_MASTER_INDEX.md — Master Architectural Registry, Traceability Matrix & Operational Navigation

## 1. Purpose
This document serves as the authoritative central registry, conceptual source of truth, cross-specification dependency graph, reading guide, and operational audit matrix for the complete **Hampers by Her** digital commerce platform documentation suite (`00_RESEARCH_NOTES.md` through `44_MASTER_INDEX.md`). It indexes all 44 architectural specifications, delineates primary stakeholder reading pathways, provides a single source of truth (SSOT) mapping for every critical domain concept, and codifies the owner verification checklist for transitioning from architecture to production implementation.

## 2. Scope
- **In-Scope**:
  - Authoritative inventory of all 44 core specifications and auxiliary assets (`docs/api/`, `docs/database/`, `docs/decisions/`, `docs/diagrams/`, `docs/runbooks/`).
  - Traceability metadata for each document: File Name, Document Title, Executive Summary, Primary Audience, Upstream Dependencies, Downstream Dependents, and Verification Requirements.
  - Tailored, persona-specific reading orders for 8 distinct roles:
    1. Brand Founder & Business Owner
    2. UI/UX Product Designer
    3. Frontend Engineer
    4. Backend & Database Engineer
    5. Cloud & DevOps Engineer
    6. Customer Concierge & Support Lead
    7. Studio Fulfillment & Atelier QC Operator
    8. Growth & Performance Marketing Manager
  - Single Source of Truth (SSOT) concept index mapping 24 core architectural concepts to their authoritative documents.
  - Complete Brand Owner Action Checklist for resolving all flagged `unknown:` schema blocks prior to public launch.
- **Out-of-Scope**:
  - Ephemeral task tracker items or individual daily commit logs.

## 3. Context
Enterprise-scale engineering suites spanning 44 interrelated documents risk fragmentation, duplicated definitions, or conflicting assumptions without an immutable master index. `44_MASTER_INDEX.md` establishes a single coherent mental model, enabling engineers and stakeholders to navigate the platform without context loss or cognitive overload.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 HAMPERS BY HER SYSTEM DOCUMENTATION TOPOLOGY                │
└─────────────────────────────────────────────────────────────────────────────┘
  [00–06 Foundation & Brand] ──► [07–13 Architecture & Data] ──► [14–19 Commerce Engines]
                                              │
  [39–44 Index & Operations] ◄── [31–38 Quality & Cloud] ◄── [20–30 Logistics & Integrations]
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-IDX-01**: Complete Document Registry: 100% of the 44 core documentation files and auxiliary directories must be cataloged with verified links and summaries.
- **FR-IDX-02**: SSOT Concept Mapping: Every domain concept (e.g. "Integer Pricing", "Fullness Heuristic", "QC Photo Gate", "24-Hour Window") must have exactly one designated authoritative specification.
- **FR-IDX-03**: Stakeholder Navigation: The document must provide sequential, role-tailored reading pathways preventing non-technical stakeholders from becoming bogged down in infrastructure details.
- **FR-IDX-04**: Unknown Fact Governance: Centralize all outstanding `unknown:` blocks into a consolidated executive action checklist.

### 4.2 Non-Functional Requirements
- **NFR-IDX-01**: Link Integrity: 100% of internal markdown links must resolve to valid files in both the workspace root and the mirrored `/docs/` directory.

## 5. Architecture & Design
### 5.1 The Complete 44-Document Canonical Registry

| # | File Name | Document Title | Primary Audience | Upstream Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| **00** | `00_RESEARCH_NOTES.md` | Research Baseline & Instagram Audit | Founder, Architect | Instagram `@hampers._by_her` |
| **01** | `01_PROJECT_OVERVIEW.md` | Project Vision, Business Model & KPIs | All Stakeholders | `00_RESEARCH_NOTES.md` |
| **02** | `02_BRAND_REQUIREMENTS.md`| Atelier Brand Voice, Colors & Typography | Designer, Founder | `01_PROJECT_OVERVIEW.md` |
| **03** | `03_PRD.md` | Product Requirements Document | Product, Eng | `01`, `02` |
| **04** | `04_BRAND_UX.md` | Mobile Customer Journeys & Animations | Designer, Frontend | `02`, `03` |
| **05** | `05_UI_DESIGN_SYSTEM.md` | 3-Tier Design Tokens & Components | Designer, Frontend | `02`, `04` |
| **06** | `06_SITE_INFORMATION_ARCHITECTURE.md` | Sitemaps, URL Hierarchy & Routes | Frontend, SEO | `03`, `04` |
| **07** | `07_FSD.md` | Functional Specification Document | Eng, Product | `03`, `06` |
| **08** | `08_TAD.md` | Technical Architecture Document | Architect, Backend | `07` |
| **09** | `09_SAD.md` | Software Architecture Document | Architect, DevOps | `08` |
| **10** | `10_FRONTEND_ARCHITECTURE.md`| Next.js 15 App Router & RSC | Frontend | `05`, `08` |
| **11** | `11_BACKEND_ARCHITECTURE.md` | NestJS Modular Monolith Core | Backend | `08`, `09` |
| **12** | `12_API_SPEC.md` | OpenAPI 3.1 Contracts & RFC 7807 | Frontend, Backend | `11` |
| **13** | `13_DATABASE_DESIGN.md` | PostgreSQL Schema, UUIDv7 & DDL | Backend, Data | `11`, `12` |
| **14** | `14_PRODUCT_CATALOG.md` | Dual-Track Catalog & Dimensions | Catalog, Operations | `13` |
| **15** | `15_HAMPER_BUILDER.md` | 11-Step Guided Custom Atelier | Frontend, Operations | `05`, `14`, `39` |
| **16** | `16_CUSTOMIZATION_ENGINE.md`| Wax Seals, Ribbons & Polaroids | Frontend, Operations | `15` |
| **17** | `17_CART_CHECKOUT.md` | 2-Step Mobile Checkout & Storage | Frontend, Backend | `10`, `15` |
| **18** | `18_ORDER_MANAGEMENT.md` | 11-Stage Order Lifecycle & QC Gate | Operations, Backend | `13`, `17` |
| **19** | `19_PAYMENT_ARCHITECTURE.md`| Razorpay UPI & Webhook Engine | Backend, Finance | `17`, `18` |
| **20** | `20_DELIVERY_LOGISTICS.md` | Shiprocket 3PL & Pincode Matrix | Operations, Logistics | `18` |
| **21** | `21_WHATSAPP_INTEGRATION.md`| Meta Cloud API & Concierge | Marketing, Support | `18`, `20` |
| **22** | `22_INSTAGRAM_LEAD_WORKFLOW.md` | DM/Story Webhooks & Lead Scoring | Marketing, Support | `21`, `39` |
| **23** | `23_ADMIN_DASHBOARD.md` | 8 Operational Workspaces & RBAC | Operations, Admin | `18`, `20` |
| **24** | `24_CRM.md` | Customer 360 & Occasion Calendar | Marketing, Support | `18`, `21` |
| **25** | `25_AUTH_SECURITY.md` | Passwordless OTP & DPDPA 2023 | Security, Backend | `11`, `13` |
| **26** | `26_MEDIA_CDN.md` | CloudFront OAC & Sharp AVIF/WebP | Frontend, DevOps | `09`, `14` |
| **27** | `27_SEARCH_FILTERING.md` | PostgreSQL FTS & Trigram Search | Backend, Frontend | `13`, `14`, `39` |
| **28** | `28_SEO.md` | Next.js Metadata & Schema JSON-LD | Marketing, Frontend | `06`, `14` |
| **29** | `29_ANALYTICS.md` | 32 Commerce Events & Meta CAPI | Marketing, Data | `17`, `19` |
| **30** | `30_NOTIFICATION_SYSTEM.md`| Transactional Outbox & DLT SMS | Backend, Support | `18`, `21` |
| **31** | `31_TESTING.md` | Test Pyramid & Vitest Math Engine | QA, Engineering | `10`, `11`, `39` |
| **32** | `32_PERFORMANCE.md` | Core Web Vitals & PgBouncer Pool | Frontend, DevOps | `10`, `35` |
| **33** | `33_DEVOPS.md` | Terraform Multi-AZ VPC & Docker | DevOps, SRE | `09`, `35` |
| **34** | `34_CI_CD.md` | GitHub Actions & Rollback Scripts | DevOps, Engineering | `33` |
| **35** | `35_CLOUD_ARCHITECTURE.md` | AWS ECS, Aurora & WAF Topology | Architect, DevOps | `09`, `33` |
| **36** | `36_MONITORING_OBSERVABILITY.md`| OpenTelemetry & Golden Signals | DevOps, SRE | `11`, `35` |
| **37** | `37_BACKUP_DR.md` | Aurora 35-Day PITR & Runbook | DevOps, SRE | `13`, `35` |
| **38** | `38_AGENTIC_DEVELOPMENT.md`| AI Guardrails & Context Harness | AI Agents, Engineers | All Docs |
| **39** | `39_DSA.md` | Bin-Packing & Pricing Algorithms | Backend, Frontend | `14`, `15`, `19` |
| **40** | `40_ECOSYSTEM.md` | Meta, Razorpay & Carrier Topologies | Architect, Integrations | `19`, `20`, `21` |
| **41** | `41_ROADMAP.md` | 12-Phase Execution & Milestones | Founder, Lead Eng | `01`, `03` |
| **42** | `42_DEPLOYMENT_RUNBOOK.md`| Rollout & Incident CLI Runbook | DevOps, SRE | `33`, `34`, `37` |
| **43** | `43_RELEASE_CHECKLIST.md`| Pre-Launch Quality Gate Checklist | Founder, Quorum | `25`, `31`, `42` |
| **44** | `44_MASTER_INDEX.md` | Master Traceability & Registry | All Stakeholders | All Docs |

## 6. Business Rules
- **BR-IDX-01**: **Single Source of Truth (SSOT) Invariant**: If an architectural parameter, business logic rule, or data type appears in multiple documents, the document designated in the SSOT Index (Section 7.2) is authoritatively binding.
- **BR-IDX-02**: **Mandatory Pre-Commit Verification**: No code or documentation modification may be merged into `main` without updating cross-references in this Master Index.
- **BR-IDX-03**: **The Unknown Fact Rule**: Any document containing unconfirmed brand parameters must adhere strictly to the YAML `unknown:` block schema. Speculative fabrication is grounds for PR rejection.

## 7. Technical Details

### 7.1 Persona-Specific Reading Pathways

#### 1. Brand Founder & Business Owner
*Focus: Commercial model, brand aesthetics, operational safeguards, and launch readiness.*
1. `01_PROJECT_OVERVIEW.md` (Vision, customer journeys, KPIs)
2. `02_BRAND_REQUIREMENTS.md` (Atelier voice, luxury aesthetic identity)
3. `03_PRD.md` (Customer personas, functional requirements)
4. `21_WHATSAPP_INTEGRATION.md` (Conversational concierge model)
5. `41_ROADMAP.md` (12-phase timeline and milestones)
6. `43_RELEASE_CHECKLIST.md` (Executive Go/No-Go launch criteria)

#### 2. UI/UX Product Designer
*Focus: Mobile thumb zones, design tokens, artisanal interactions, and user flows.*
1. `02_BRAND_REQUIREMENTS.md` (Visual aesthetics, typography scales)
2. `04_BRAND_UX.md` (Customer Journeys A–F, motion specifications)
3. `05_UI_DESIGN_SYSTEM.md` (Atomic components, color tokens)
4. `06_SITE_INFORMATION_ARCHITECTURE.md` (Navigation structure, mobile menus)
5. `15_HAMPER_BUILDER.md` (11-step interactive builder drawer UX)
6. `16_CUSTOMIZATION_ENGINE.md` (Wax seal, ribbon, and card preview)

#### 3. Frontend Software Engineer
*Focus: Next.js 15 App Router, React Server Components, state management, and performance.*
1. `05_UI_DESIGN_SYSTEM.md` (Tailwind tokens and shadcn/ui components)
2. `10_FRONTEND_ARCHITECTURE.md` (Next.js 15 App Router, RSC islands, Zustand)
3. `12_API_SPEC.md` & `docs/api/openapi.yaml` (Backend API contracts)
4. `15_HAMPER_BUILDER.md` & `39_DSA.md` (Client-side bin-packing preview & pricing)
5. `17_CART_CHECKOUT.md` (Mobile 2-step checkout flow)
6. `32_PERFORMANCE.md` (Core Web Vitals budgets, image optimization)

#### 4. Backend & Database Engineer
*Focus: NestJS modular monolith, PostgreSQL schema, integer arithmetic, and queues.*
1. `08_TAD.md` & `09_SAD.md` (System topology and bounded contexts)
2. `11_BACKEND_ARCHITECTURE.md` (NestJS Fastify, BullMQ worker queues)
3. `13_DATABASE_DESIGN.md` & `docs/database/schema.prisma` (PostgreSQL DDL)
4. `18_ORDER_MANAGEMENT.md` & `19_PAYMENT_ARCHITECTURE.md` (State machines)
5. `25_AUTH_SECURITY.md` (Passwordless auth, RBAC, DPDPA compliance)
6. `39_DSA.md` (Deterministic pricing, bin-packing, and search algorithms)

#### 5. Cloud, DevOps & SRE Engineer
*Focus: AWS infrastructure, Terraform, containerization, observability, and DR.*
1. `33_DEVOPS.md` (Terraform multi-AZ VPC, non-root Docker builds)
2. `34_CI_CD.md` (GitHub Actions workflows, automated rollback script)
3. `35_CLOUD_ARCHITECTURE.md` (AWS ECS Fargate, Aurora Serverless v2, WAF)
4. `36_MONITORING_OBSERVABILITY.md` (OpenTelemetry, Pino JSON logs, Golden Signals)
5. `37_BACKUP_DR.md` (35-day Aurora PITR, snapshot replication)
6. `42_DEPLOYMENT_RUNBOOK.md` (Operational release and incident runbook)

#### 6. Studio Fulfillment & Atelier QC Operator
*Focus: Physical packaging, order processing, quality control photos, and shipping.*
1. `14_PRODUCT_CATALOG.md` (Box sizes, volumetric tare weights)
2. `16_CUSTOMIZATION_ENGINE.md` (Wax seals, ribbons, and custom note cards)
3. `18_ORDER_MANAGEMENT.md` (11-stage order lifecycle, packing workflow)
4. `20_DELIVERY_LOGISTICS.md` (Shiprocket labels, thermal printing, pickup)
5. `23_ADMIN_DASHBOARD.md` (Atelier workspace and mandatory QC photo gate)

#### 7. Customer Support & Concierge Lead
*Focus: Customer inquiries, order status tracking, WhatsApp communication, and returns.*
1. `18_ORDER_MANAGEMENT.md` (Order status progression and cancel/refund rules)
2. `21_WHATSAPP_INTEGRATION.md` (WhatsApp templates and 24h customer window)
3. `22_INSTAGRAM_LEAD_WORKFLOW.md` (DM qualification and lead routing)
4. `24_CRM.md` (Customer 360 view, occasion reminders)
5. `23_ADMIN_DASHBOARD.md` (Customer support dashboard view)

#### 8. Growth & Performance Marketing Manager
*Focus: Lead generation, conversion optimization, SEO, and paid ad tracking.*
1. `06_SITE_INFORMATION_ARCHITECTURE.md` (Landing pages, festive collection URLs)
2. `22_INSTAGRAM_LEAD_WORKFLOW.md` (Instagram lead capture automation)
3. `27_SEARCH_FILTERING.md` (Gifting intent search optimization)
4. `28_SEO.md` (Google Merchant feeds, Schema.org JSON-LD structured data)
5. `29_ANALYTICS.md` (32 commerce events, Meta Conversions API / CAPI)

---

### 7.2 Single Source of Truth (SSOT) Domain Concept Matrix

| Domain Concept | Authoritative Specification | Secondary References |
| :--- | :--- | :--- |
| **Integer Pricing (Paise Math)** | `39_DSA.md` (§7.2) | `19_PAYMENT_ARCHITECTURE.md`, `13_DATABASE_DESIGN.md` |
| **3D Volumetric Bin-Packing** | `39_DSA.md` (§7.1) | `15_HAMPER_BUILDER.md`, `14_PRODUCT_CATALOG.md` |
| **Order State Machine (11 Stages)**| `18_ORDER_MANAGEMENT.md` (§7.1) | `13_DATABASE_DESIGN.md`, `23_ADMIN_DASHBOARD.md` |
| **Mandatory Atelier QC Photo Gate**| `18_ORDER_MANAGEMENT.md` (§6.2)| `23_ADMIN_DASHBOARD.md`, `43_RELEASE_CHECKLIST.md` |
| **Payment Webhook Verification** | `19_PAYMENT_ARCHITECTURE.md` (§7.3)| `40_ECOSYSTEM.md`, `18_ORDER_MANAGEMENT.md` |
| **3PL Logistics & Pincode SLAs** | `20_DELIVERY_LOGISTICS.md` (§7.2) | `40_ECOSYSTEM.md`, `39_DSA.md` (§7.8) |
| **WhatsApp 24h Customer Window**| `21_WHATSAPP_INTEGRATION.md` (§6.1)| `40_ECOSYSTEM.md`, `30_NOTIFICATION_SYSTEM.md` |
| **Instagram Lead Scoring Formula**| `39_DSA.md` (§7.7) | `22_INSTAGRAM_LEAD_WORKFLOW.md`, `24_CRM.md` |
| **Design Tokens & Typography** | `05_UI_DESIGN_SYSTEM.md` (§7.1) | `02_BRAND_REQUIREMENTS.md`, `04_BRAND_UX.md` |
| **Database Schema & UUIDv7** | `13_DATABASE_DESIGN.md` (§7.1) | `docs/database/schema.prisma`, `11_BACKEND_ARCHITECTURE.md` |
| **OpenAPI Contracts & Errors** | `12_API_SPEC.md` (§7.1) | `docs/api/openapi.yaml`, `10_FRONTEND_ARCHITECTURE.md` |
| **Zero-Downtime Rollback Runbook**| `42_DEPLOYMENT_RUNBOOK.md` (§7.6)| `34_CI_CD.md`, `37_BACKUP_DR.md` |
| **Go/No-Go Release Quorum** | `43_RELEASE_CHECKLIST.md` (§6.1) | `41_ROADMAP.md` |

---

### 7.3 Consolidated Brand Owner Verification Checklist
Prior to public commercial traffic cutover, the brand founder must provide verified inputs for the following open questions cataloged across the documentation:

- [ ] **OWN-01**: **Studio Dispatch Hub Pincode** (`39_DSA.md`, `20_DELIVERY_LOGISTICS.md`): Provide official physical studio location to calibrate Courier transit matrix and same-day delivery radius.
- [ ] **OWN-02**: **Legal Entity & GSTIN** (`43_RELEASE_CHECKLIST.md`, `19_PAYMENT_ARCHITECTURE.md`): Provide registered Trade Name, GSTIN number, and registered business billing address for tax invoices.
- [ ] **OWN-03**: **Meta Business Manager & WABA Onboarding** (`40_ECOSYSTEM.md`, `21_WHATSAPP_INTEGRATION.md`): Provide Meta Business Manager verification access and designated WhatsApp phone number.
- [ ] **OWN-04**: **Corporate Banking & Razorpay Account** (`19_PAYMENT_ARCHITECTURE.md`): Complete merchant KYC on Razorpay / Cashfree for direct UPI and card settlement.
- [ ] **OWN-05**: **Official Catalog Assets & Packaging Sizes** (`14_PRODUCT_CATALOG.md`, `15_HAMPER_BUILDER.md`): Provide high-resolution photography and exact physical dimensions (L x W x H mm) of all bespoke gift boxes.

## 8. Dependencies
- Cross-Dependency Graph:
  - This document depends directly upon the existence and correctness of all files `00_RESEARCH_NOTES.md` through `43_RELEASE_CHECKLIST.md`.

## 9. Security
- **Integrity Verification**: The sha256 checksum of every specification in this repository is computed during CI/CD to prevent undetected tampering or unauthorized modification.

## 10. Failure Modes
| Risk | Detection | Automated Recovery / Mitigation |
| :--- | :--- | :--- |
| **Broken Markdown Link** | CI check (`markdown-link-check`) | PR build fails; author must update path |
| **Conflicting Business Rule** | Architecture Decision Record audit | Lead Architect adjudicates using Section 7.2 SSOT |
| **Unresolved Unknown Fact** | Pre-release release checklist audit | Hard block on production release (`43_RELEASE_CHECKLIST.md`) |

## 11. Testing
- **Automated Repository Audit**: A deterministic Node.js audit script (`scripts/audit-docs.js`) iterates across all 44 markdown files, asserting:
  - Presence of all 15 Section-40 mandatory sections.
  - Zero empty code blocks.
  - File presence in both root and `/docs/` directories.

## 12. Observability
- **Suite Metadata**: Total document count, word count, line count, and last-updated timestamps published to the developer portal dashboard.

## 13. Open Questions
```yaml
unknown:
  field: canonical_production_domain
  status: TO_VERIFY
  source_required: brand_owner
  impact: low
  temporary_assumption: "Platform documentation utilizes hampersbyher.com as the canonical apex domain."
```

## 14. Future Evolution
- **Developer Documentation Portal**: Convert the 44 markdown specifications into an interactive Nextra / Mintlify developer portal with live OpenAPI interactive consoles and dynamic token playgrounds.

## 15. References
- ISO/IEC/IEEE 26515:2018: Systems and Software Engineering — Developing Information for Users in an Agile Environment.
- RFC 7807: Problem Details for HTTP APIs.
- OpenAPI Specification 3.1.0 (2026 Revision).

<!-- DOCUMENT END: 44_MASTER_INDEX.md -->
