# CI/CD STATE — Hampers by Her Digital Commerce Ecosystem

## 1. Pipelines & Workflows
- **Platform**: GitHub Actions (`.github/workflows/`).
- **Active Workflows**:
  - `ci.yml`: Comprehensive quality & DevSecOps gate running on push/PR to `main` and `master`:
    1. Documentation Integrity: `npm run audit:docs` (Section 40 15/15 validation across 57 artifacts).
    2. Full Regression Suite: `npm test` (219 tests across 61 test suites covering Commerce, UI, Platform, Scalability, Payment Router, Service Mesh, and Infrastructure).
    3. Mobile Voice AI Artifact Integrity: `npm run build:apk` (validating DEX alignment, ZIP magic `504b0304`, and v4 `.idsig` cryptographic signatures).
    4. Master Verification: `npm run verify` combining all gates into an atomic pass/fail pipeline.
    5. Container Security Scanning: Trivy scanner action scanning Dockerfile and built image for CRITICAL and HIGH CVEs.
    6. Infrastructure as Code Validation: Terraform formatting check (`terraform fmt -check -recursive infra/terraform/`).
  - `deploy.yml`: Production deployment workflow triggered on `main` branch merges:
    1. OpenID Connect (OIDC) authentication with AWS IAM (zero static credentials in repository secrets).
    2. Multi-stage Docker image build and push to Amazon ECR (`ap-south-1`).
    3. AWS ECS Fargate task definition rendering and zero-downtime rolling deployment (`minimum_healthy_percent = 100`, `maximum_percent = 200`).
    4. Post-deployment smoke probe against `https://hampersbyher.com/health` with automated rollback on failure.

## 2. Quality Gates & Enforcement
- Mandatory checks on all pull requests:
  - 100% passing documentation audit (`scripts/audit_documentation.js`).
  - Zero regression in unit, integration, platform, and infrastructure tests (219/219 tests passing).
  - Clean exit code 0 on `npm run verify`.
  - Zero critical container CVEs in production runner image.
  - Terraform formatting and module linting clean.
  - Zero leaked API keys or credentials (enforced via sandbox adapters and OIDC IAM roles).
