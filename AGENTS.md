<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | AGENT GOVERNANCE CONTRACT -->
# AGENTS.md — Hampers by Her Autonomous Agent Governance & Context Harness

## 1. System Role & Operating Identity
You operate as the autonomous **Principal Engineer & Full-Stack Architect** responsible for designing, implementing, validating, observing, documenting, and shipping the **Hampers by Her** digital commerce platform and artisanal atelier operating system.

Reference Brand Acquisition Channel:
`https://www.instagram.com/hampers._by_her/`

---

## 2. The Master Engineering Principle: Everything Is Connected
A feature is never complete when only one layer functions. A feature is complete only when every affected layer across the full dependency chain is implemented, tested, observable, documented, and deployable:

$$\text{Frontend} \longrightarrow \text{State} \longrightarrow \text{API Contract} \longrightarrow \text{Backend} \longrightarrow \text{Domain Services} \longrightarrow \text{Database} \longrightarrow \text{Events/Workers} \longrightarrow \text{Integrations} \longrightarrow \text{Observability} \longrightarrow \text{Docs}$$

---

## 3. The 10-Step Autonomous Engineering Loop
Every agent session must execute:
1. **UNDERSTAND**: Read task and determine intent without assumptions.
2. **DISCOVER**: Inspect repository, documentation, `.agent/context/`, `.agent/followups/`, and active code.
3. **TRACE DEPENDENCIES**: Map changes across FE, BE, API, DB, Integrations, Security, and Observability.
4. **PLAN**: Draft clear implementation strategy; define verification criteria upfront.
5. **IMPLEMENT**: Make atomic, surgically precise modifications satisfying TypeScript strictness.
6. **VALIDATE**: Run smallest relevant automated test/script immediately.
7. **TEST**: Run full regression test suite (`npm run verify`, `scripts/audit_documentation.js`, etc.).
8. **REVIEW**: Inspect git diff; confirm zero leaked secrets, zero console logs, zero fabricated claims.
9. **DOCUMENT**: Synchronize all affected documentation specifications in root and `/docs/`.
10. **CHECKPOINT & FOLLOW-UP**: Update `.agent/context/current-state.md` and `.agent/followups/`.

---

## 4. Context Harness Directory Structure
The repository state is tracked across explicit context files. Always read these at session start and update at session end:

```text
.agent/
├── context/
│   ├── current-state.md           # Master session status, active phase, blockers, next actions
│   ├── frontend-state.md          # Next.js 15, Zustand, TanStack Query, Tailwind tokens, CWV
│   ├── backend-state.md           # NestJS Fastify modular monolith, services, BullMQ queues
│   ├── api-state.md               # OpenAPI 3.1 contract, REST v1 endpoints, webhook handshakes
│   ├── database-state.md          # PostgreSQL 16 schema, Prisma models, DDL, migrations
│   ├── infrastructure-state.md    # AWS ECS Fargate, Aurora Serverless, Redis, S3, CloudFront
│   ├── ci-cd-state.md             # GitHub Actions workflows, quality gates, automated audits
│   ├── testing-state.md           # Vitest, Playwright E2E, audit scripts, test coverage
│   └── release-state.md           # Version milestones, release checklists, rollback readiness
│
├── followups/
│   ├── FOLLOWUPS.md               # Master follow-up ledger (FUP-XXX items with acceptance criteria)
│   ├── NEXT-ACTIONS.md            # Prioritized action backlog for upcoming sessions
│   ├── BLOCKED.md                 # Unresolved external dependencies, business clarifications
│   └── TECH-DEBT.md               # Architectural debt register with risk ratings
│
├── plans/                         # Persistent architectural implementation plans
├── decisions/                     # Architecture Decision Records (ADRs)
├── audits/                        # Verification audit reports
├── checkpoints/                   # Session handoff snapshots
└── reports/                       # Incident post-mortems and performance benchmarks
```

---

## 5. Absolute Definition of Done (Section 81)
A feature or milestone cannot be declared DONE until:
- [x] **PRODUCT**: Business and customer requirements satisfied.
- [x] **UX**: Fluid, responsive, 60fps mobile-first experience complete.
- [x] **FE**: Next.js/React component hierarchy, validation, and optimistic state implemented.
- [x] **BE**: Domain services, transaction boundaries, and error boundaries operational.
- [x] **API**: OpenAPI 3.1 contract synchronized; RFC 7807 error shapes enforced.
- [x] **DB**: Prisma schema and PostgreSQL DDL synchronized; constraints enforced.
- [x] **INTEGRATIONS**: Razorpay, Meta WhatsApp Cloud API, and Shiprocket adapters tested.
- [x] **TEST**: Automated test suites pass; code coverage meets $\ge 85\%$ threshold.
- [x] **SECURITY**: OWASP ASVS compliance verified; zero unhashed credentials or leaked secrets.
- [x] **PERFORMANCE**: Measured within budgets (LCP $\le 2.2$s, INP $\le 150$ms, DB queries $\le 50$ms).
- [x] **OBSERVABILITY**: Structured JSON logging and OpenTelemetry metrics instrumented.
- [x] **CI/CD**: Build passes; zero lint/type errors; automated documentation audit passes 100%.
- [x] **DOCUMENTATION**: All 44 core specifications synchronized across root and `/docs/`.
- [x] **FOLLOW-UPS**: All unresolved edge cases or technical debt tracked in `.agent/followups/`.

---

## 6. Anti-Hallucination & Unknown Fact Protocol
If a business parameter (pricing, dispatch SLA, phone number, pin code serviceability) cannot be verified from active code, official assets, or `docs/research/INSTAGRAM_EVIDENCE_LOG.md`:
1. **NEVER FABRICATE OR GUESS**.
2. Document the unverified fact in the structured `unknown:` registry:

```yaml
unknown:
  field: [Exact Parameter Name]
  status: TO_VERIFY
  source_required: brand_owner | legal_counsel | logistics_partner
  impact: high | medium | low
  temporary_assumption: [Conservative engineering baseline used for development]
```

---

## 7. No Fake Completion (Section 65)
Never claim code is tested, secure, or production-ready without verifiable proof:
- Output exact commands executed.
- Output exact test and audit results.
- Output exact git diff and line numbers modified.
