const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AGENT_DIR = path.join(ROOT, '.agent');
const CONTEXT_DIR = path.join(AGENT_DIR, 'context');
const FOLLOWUPS_DIR = path.join(AGENT_DIR, 'followups');
const PLANS_DIR = path.join(AGENT_DIR, 'plans');
const DECISIONS_DIR = path.join(AGENT_DIR, 'decisions');
const AUDITS_DIR = path.join(AGENT_DIR, 'audits');
const CHECKPOINTS_DIR = path.join(AGENT_DIR, 'checkpoints');
const REPORTS_DIR = path.join(AGENT_DIR, 'reports');

[CONTEXT_DIR, FOLLOWUPS_DIR, PLANS_DIR, DECISIONS_DIR, AUDITS_DIR, CHECKPOINTS_DIR, REPORTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const files = {
  [path.join(CONTEXT_DIR, 'ci-cd-state.md')]: `# CI/CD STATE — Hampers by Her

## 1. Pipelines & Workflows
- **Platform**: GitHub Actions (\`.github/workflows/\`).
- **Core Workflows**:
  - \`ci.yml\`: Static analysis, linting, TypeScript check, unit & integration tests.
  - \`audit-docs.yml\`: Strict Section 40 documentation compliance check (\`node scripts/audit_documentation.js\`).
  - \`security.yml\`: Trivy container vulnerability scanner, CodeQL SAST, npm audit.
  - \`staging.yml\`: Automated deployment to ECS Fargate staging environment.
  - \`production.yml\`: Protected release deployment requiring manual peer sign-off.

## 2. Quality Gates
- Mandatory checks on all pull requests:
  - 100% passing documentation audit.
  - Zero TypeScript compiler errors (\`tsc --noEmit\`).
  - Vitest test pass rate: 100% (zero regressions).
  - Code coverage threshold: $\\ge 85\\%$ on financial, pricing, and inventory domains.
`,

  [path.join(CONTEXT_DIR, 'testing-state.md')]: `# TESTING STATE — Hampers by Her

## 1. Verification Layers
- **Layer 1: Documentation Integrity**: \`scripts/audit_documentation.js\` validates all 44 specifications for Section 40 compliance.
- **Layer 2: Unit Testing (Vitest)**:
  - Pricing engine formula verification (paise integers, discounts, GST).
  - Volumetric fullness and 3D box packing algorithms.
  - State machine transitions (Order & Payment lifecycles).
- **Layer 3: Integration Testing (Supertest + Testcontainers)**:
  - REST API endpoint verification with real PostgreSQL and Redis containers.
  - Webhook signature validation (Razorpay and WhatsApp Cloud API).
- **Layer 4: End-to-End (Playwright)**:
  - Mobile user journeys (PDP -> Hamper Builder -> Cart -> Checkout -> Payment modal).
- **Layer 5: Load Testing (k6)**:
  - Peak concurrency simulation: 500 requests/sec during festival sales.
`,

  [path.join(CONTEXT_DIR, 'release-state.md')]: `# RELEASE STATE — Hampers by Her

## 1. Versioning Strategy
- **Current Version**: \`2.0.0\` (Architecture & Foundation Phase).
- **Release Channel**: Pre-Alpha / Foundation.
- **Public Launch Target**: Phase 8 completion (Phases 0 through 8 constitute Launch MVP).

## 2. Release Checklist Gates (43_RELEASE_CHECKLIST.md)
- [x] Architectural specifications approved and audited.
- [ ] Next.js 15 & NestJS modular monolith scaffolded.
- [ ] Database migrations applied and verified on PostgreSQL 16.
- [ ] Razorpay webhook reconciliation validated in staging.
- [ ] Studio QC photo gate verified in admin dashboard.
- [ ] Disaster recovery simulation passed (RPO < 5 min, RTO < 30 min).
`,

  [path.join(FOLLOWUPS_DIR, 'FOLLOWUPS.md')]: `# FOLLOW-UP LEDGER — Hampers by Her

## FUP-001: Harmonize 10 Failing Architectural Documents
- **Type**: SPECIFICATION / QUALITY GATE
- **Priority**: CRITICAL
- **Status**: IN_PROGRESS
- **Dependency**: \`scripts/audit_documentation.js\`
- **Acceptance Criteria**:
  - Restructure sections in documents 10 through 19 across root and \`docs/\` to include: Purpose, Scope, Context, Requirements, Architecture, Business Rules, Technical Details, Dependencies, Security, Failure Modes, Testing, Observability, Open Questions, Future Evolution, References.
  - \`node scripts/audit_documentation.js\` returns 100% pass (57/57 files).

## FUP-002: Modular Monolith Repository Scaffolding
- **Type**: ARCHITECTURE / FOUNDATION
- **Priority**: HIGH
- **Status**: READY
- **Dependency**: FUP-001
- **Acceptance Criteria**:
  - Scaffold Next.js 15 App Router storefront in \`apps/web\` or root.
  - Scaffold NestJS Fastify backend service layer in \`apps/api\` or root module.
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
  - Workflow \`.github/workflows/ci.yml\` executing lint, typecheck, doc audit, and unit tests.
`,

  [path.join(FOLLOWUPS_DIR, 'NEXT-ACTIONS.md')]: `# NEXT ACTIONS — Hampers by Her

1. **[IMMEDIATE]** Execute Section 40 harmonization script across documents 10–19.
2. **[IMMEDIATE]** Run \`node scripts/audit_documentation.js\` and verify 57/57 pass.
3. **[IMMEDIATE]** Commit initial baseline to git repository.
4. **[PHASE 2]** Scaffold modular monolith project structure with TypeScript configuration.
5. **[PHASE 2]** Implement and unit test the core server-side Pricing Engine in TypeScript.
`,

  [path.join(FOLLOWUPS_DIR, 'BLOCKED.md')]: `# BLOCKED REGISTER — Hampers by Her

| Blocker ID | Item | Blocked By | Required Resolution | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **BLK-001** | Production Razorpay API Keys | Brand Owner / Merchant KYC | Live merchant dashboard activation | Low (Mock / Test mode active for development) |
| **BLK-002** | Meta WhatsApp Cloud API Phone Number Registration | Meta Business Verification | Verification of brand legal entity and registered phone | Low (Sandbox / Test webhook runner active) |
| **BLK-003** | Shiprocket Commercial Account & Carrier API Credentials | Brand Operations | Commercial contract sign-off | Low (Fallback zone table active) |
`,

  [path.join(FOLLOWUPS_DIR, 'TECH-DEBT.md')]: `# TECHNICAL DEBT REGISTER — Hampers by Her

| Debt ID | Module | Issue Description | Risk Level | Planned Remediation |
| :--- | :--- | :--- | :--- | :--- |
| **DEBT-001** | Root / Docs | Duplication of 44 markdown files between root and \`docs/\` | Medium | Maintain bidirectional synchronization script or symlink in CI |
| **DEBT-002** | Prototype | Static HTML/CSS/JS in \`website/\` not componentized | Low | Migrate UI components into Next.js 15 React 19 architecture during Phase 2 |
`
};

for (const [filePath, content] of Object.entries(files)) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Created: ${path.relative(ROOT, filePath)}`);
}

console.log('All context and follow-up ledgers successfully established!');
