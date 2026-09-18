# CI/CD STATE — Hampers by Her

## 1. Pipelines & Workflows
- **Platform**: GitHub Actions (`.github/workflows/`).
- **Core Workflows**:
  - `ci.yml`: Static analysis, linting, TypeScript check, unit & integration tests.
  - `audit-docs.yml`: Strict Section 40 documentation compliance check (`node scripts/audit_documentation.js`).
  - `security.yml`: Trivy container vulnerability scanner, CodeQL SAST, npm audit.
  - `staging.yml`: Automated deployment to ECS Fargate staging environment.
  - `production.yml`: Protected release deployment requiring manual peer sign-off.

## 2. Quality Gates
- Mandatory checks on all pull requests:
  - 100% passing documentation audit.
  - Zero TypeScript compiler errors (`tsc --noEmit`).
  - Vitest test pass rate: 100% (zero regressions).
  - Code coverage threshold: $\ge 85\%$ on financial, pricing, and inventory domains.
