# FOLLOW-UP LEDGER — Hampers by Her

## FUP-001: Harmonize 10 Failing Architectural Documents
- **Type**: SPECIFICATION / QUALITY GATE
- **Priority**: CRITICAL
- **Status**: IN_PROGRESS
- **Dependency**: `scripts/audit_documentation.js`
- **Acceptance Criteria**:
  - Restructure sections in documents 10 through 19 across root and `docs/` to include: Purpose, Scope, Context, Requirements, Architecture, Business Rules, Technical Details, Dependencies, Security, Failure Modes, Testing, Observability, Open Questions, Future Evolution, References.
  - `node scripts/audit_documentation.js` returns 100% pass (57/57 files).

## FUP-002: Modular Monolith Repository Scaffolding
- **Type**: ARCHITECTURE / FOUNDATION
- **Priority**: HIGH
- **Status**: READY
- **Dependency**: FUP-001
- **Acceptance Criteria**:
  - Scaffold Next.js 15 App Router storefront in `apps/web` or root.
  - Scaffold NestJS Fastify backend service layer in `apps/api` or root module.
  - Wire Prisma ORM client with PostgreSQL connection pooling.

## FUP-003: Vitest Test Fixtures for Pricing & Fullness Engine
- **Type**: TESTING
- **Priority**: HIGH
- **Status**: READY
- **Dependency**: FUP-002
- **Acceptance Criteria**:
  - Unit tests verifying paise arithmetic, GST 18%, and coupon calculations.
  - Unit tests verifying 3D box capacity collision math.

## FUP-004: GitHub Actions CI Matrix Setup
- **Type**: DEVOPS / CI
- **Priority**: MEDIUM
- **Status**: READY
- **Dependency**: FUP-002
- **Acceptance Criteria**:
  - Workflow `.github/workflows/ci.yml` executing lint, typecheck, doc audit, and unit tests.
