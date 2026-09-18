<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 34_CI_CD.md — Continuous Integration, Continuous Delivery & Automated Rollback Pipeline

## 1. Purpose
This document establishes the continuous integration and continuous delivery (CI/CD) pipelines, automated release gating, and zero-downtime rollback protocols for **Hampers by Her**. Commercial gifting platforms cannot tolerate flawed deployments that introduce checkout friction or corrupt orders mid-flight during holiday shopping surges. This specification formalizes a unified GitHub Actions pipeline that enforces immutable artifact generation, automated Prisma schema migration safety, non-root Docker builds pushed to AWS ECR, and automated canary/rolling deployments on AWS ECS Fargate with instant rollback capabilities.

## 2. Scope
- **In-Scope**:
  - GitHub Actions automated workflows (`pr-validation.yml`, `deploy-staging.yml`, `release-production.yml`).
  - Strict pull request gating: linting, formatting, strict TypeScript compilation, unit tests, integration tests, container vulnerability scans.
  - "Build Once, Deploy Everywhere" artifact philosophy: immutable Docker images tagged by git SHA promoted from staging to production.
  - Automated database migration lifecycle using Prisma Migrate with backwards-compatibility checks.
  - Blue/Green and Rolling ECS task deployments with automated health verification.
  - Automated one-click and automated health-alarm rollback procedures.
- **Out-of-Scope**:
  - Deploying directly from developer local laptops to production servers (all production releases are git-triggered via protected tags).

## 3. Context
In early-stage boutique businesses, code is often deployed by manual FTP, untracked SSH sessions, or ad-hoc terminal scripts. When a bug occurs during peak hours, rollbacks are panicked, undocumented, and risk wiping out active orders. Hampers by Her establishes a deterministic pipeline where every release is completely traceable to a reviewed git commit and can be rolled back in under 60 seconds.

```
[Developer Git Push]
       │
       ▼ (Pull Request Opened)
[PR Validation Workflow] ──► [Lint + Typecheck + Unit + Integration + Trivy]
       │
       ▼ (PR Merged to 'main')
[Deploy Staging Workflow]
  ├── Build Docker Image & Push to AWS ECR (Tag: commit-sha)
  ├── Run Staging DB Migration (Prisma Migrate Deploy)
  ├── Deploy to ECS Staging Cluster
  └── Run Automated Smoke Tests & Playwright E2E
       │
       ▼ (Manual Approval / Release Tag 'v*.*.*')
[Release Production Workflow]
  ├── Promote Staging Image Digest to Production ECR Tag
  ├── Execute Ephemeral DB Migration Task
  ├── Trigger ECS Production Rolling Blue/Green Cutover
  └── Automated Post-Deploy Health Check (5-min canary window)
       │ (If 5xx > 1% ──► Automated Instant Rollback)
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-CICD-01**: PR Quality Gate: Every pull request must pass 100% of lint, typecheck, unit test, integration test, and security scan steps before branch merge is unlocked.
- **FR-CICD-02**: Immutable Container Artifacts: Docker images are compiled exactly once per git commit SHA; production promotes the identical image digest tested in staging without recompilation.
- **FR-CICD-03**: Backwards-Compatible Migrations: Database schema changes must adhere to expand-and-contract patterns; dropping columns or tables in a single step is blocked by CI linting.
- **FR-CICD-04**: Production Health Verification: Following container cutover, the pipeline monitors ALB target 5xx error rates and p95 latency for 5 minutes.
- **FR-CICD-05**: Automated Rollback Trigger: If health checks fail during the canary window, ECS automatically rolls back task definitions to the previous stable revision.

### 4.2 Non-Functional Requirements
- **NFR-CICD-01**: Pipeline Speed: PR validation workflow must finish in under 5 minutes.
- **NFR-CICD-02**: Production Deployment Duration: Total deployment time from release tag to 100% traffic cutover under 6 minutes.
- **NFR-CICD-03**: Security: GitHub Actions runner secrets protected via OIDC (OpenID Connect) federation with AWS IAM; zero long-lived AWS Access Keys stored in repository secrets.

## 5. Architecture & Design

### 5.1 CI/CD Stage Gate Pipeline
```
STAGE 1: Code Quality (3 min)
  ├── ESLint v9 (0 errors)
  ├── TypeScript Strict Mode (`tsc --noEmit`)
  └── Prettier formatting check

STAGE 2: Security & Supply Chain (2 min)
  ├── `npm audit --production` (0 high/critical)
  ├── Trivy Vulnerability Scan on base images
  └── Semgrep static application security audit

STAGE 3: Automated Testing (4 min)
  ├── Unit Tests (Vitest, 100% passing)
  └── Integration Tests (PostgreSQL & Redis Testcontainers)

STAGE 4: Artifact Compilation (3 min)
  ├── Multi-stage Docker build
  ├── Push to AWS ECR with tags: `sha-{commit}` and `git-ref`
  └── Generate SBOM (Software Bill of Materials)

STAGE 5: Deployment & Verification (5 min)
  ├── Ephemeral ECS task runs `npx prisma migrate deploy`
  ├── Rolling ECS update with minimumHealthyPercent = 100%
  ├── Health check probing `/health/readiness`
  └── Synthetic smoke test executing test checkout
```

### 5.2 Database Expand-and-Contract Migration Pattern
```
Phase 1 (Release N): ADD new column as NULLABLE (Both old & new app code work)
Phase 2 (Release N+1): Backfill existing records; update application code to write to new column
Phase 3 (Release N+2): Add NOT NULL constraint or remove obsolete old column
```

## 6. Business Rules
1. **Protected Main Branch**: Committing directly to `main` is physically blocked in GitHub repository settings. All changes require an approved Pull Request with at least one peer review.
2. **Release Authorization**: Deployments to the Production environment require explicit approval by the Lead Engineer or Technical Founder via GitHub Environment Protection Rules.
3. **Emergency Fix Protocol (Hotfix)**: Hotfixes follow the identical pipeline via a dedicated `hotfix/*` branch, cherry-picked into `main` and tagged for immediate deployment without skipping test suites.

## 7. Technical Details

### 7.1 GitHub Actions Workflow (`.github/workflows/release-production.yml`)
```yaml
name: Release Production

on:
  push:
    tags:
      - 'v*.*.*'

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    name: Deploy to AWS ECS Production
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Configure AWS Credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsECRDeployRole
          aws-region: ap-south-1

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Run Database Migration
        run: |
          aws ecs run-task \
            --cluster hbh-production-cluster \
            --task-definition hbh-migration-task \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[subnet-10a,subnet-10b],securityGroups=[sg-migration]}"

      - name: Deploy Amazon ECS Task Definition
        uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: ecs/production-task-def.json
          service: hbh-commerce-service
          cluster: hbh-production-cluster
          wait-for-service-stability: true

      - name: Post-Deployment Canary Health Check
        run: |
          ./scripts/verify-production-health.sh https://hampersbyher.com
```

### 7.2 Automated Rollback Script (`scripts/rollback.sh`)
```bash
#!/usr/bin/env bash
set -euo pipefail

CLUSTER="hbh-production-cluster"
SERVICE="hbh-commerce-service"

echo "🚨 Initiating Automated Rollback for ${SERVICE}..."

# 1. Fetch previous active task definition revision
CURRENT_TASK_DEF=$(aws ecs describe-services --cluster "${CLUSTER}" --services "${SERVICE}" --query 'services[0].taskDefinition' --output text)
CURRENT_REV=$(echo "${CURRENT_TASK_DEF}" | awk -F: '{print $NF}')
PREV_REV=$((CURRENT_REV - 1))
FAMILY=$(echo "${CURRENT_TASK_DEF}" | awk -F/ '{print $NF}' | awk -F: '{print $1}')

echo "Rolling back from ${FAMILY}:${CURRENT_REV} to ${FAMILY}:${PREV_REV}..."

# 2. Update ECS service to previous stable task definition
aws ecs update-service \
  --cluster "${CLUSTER}" \
  --service "${SERVICE}" \
  --task-definition "${FAMILY}:${PREV_REV}" \
  --force-new-deployment

echo "✅ Rollback command dispatched. Waiting for cluster stabilization..."
aws ecs wait services-stable --cluster "${CLUSTER}" --services "${SERVICE}"
echo "🎉 Rollback complete and service stable."
```

## 8. Dependencies
- **CI/CD Platform**: GitHub Actions (Ubuntu 22.04 runners).
- **Target Cloud**: AWS ECR, AWS ECS Fargate, AWS Application Load Balancer.
- **Security Tools**: Trivy, Semgrep, npm audit.

## 9. Security
- **OIDC AWS Federation**: CI runners authenticate via temporary, short-lived AWS STS assume-role tokens scoped strictly to `repo:org/hampers-by-her:*`. No permanent IAM access keys exist.
- **Secrets Isolation**: Production database connection strings and payment secrets are never exposed in GitHub Actions runner logs or job environments; containers fetch them directly from AWS Secrets Manager at container runtime.

## 10. Failure Modes & Resilience
1. **Migration Failure Mid-Deploy**: If `prisma migrate deploy` fails, the workflow immediately halts; ECS task definition update is never triggered, keeping existing production containers running safely against uncorrupted schema.
2. **Post-Deploy Smoke Test Failure**: Synthetic checkout probe failure automatically triggers `scripts/rollback.sh` within 120 seconds of deployment.

## 11. Testing (CI/CD Pipeline Validation)
- **Pipeline Self-Test**: Validating workflow syntax via `actionlint`.
- **Dry-Run Deployment**: Executing staging deployment with simulated mock migration to assert ECS task definition replacement logic.

## 12. Observability & Monitoring
- **Metrics Tracked**:
  - `cicd.pipeline_duration_seconds`.
  - `cicd.deployments_total` (Partitioned by staging vs production).
  - `cicd.deployment_failure_rate` (Target: <2%).
  - `cicd.mean_time_to_recovery_minutes` (MTTR target: <5 mins).
- **Notifications**: Automated Slack / WhatsApp notifications to `#engineering-deploys` announcing start, commit SHA, author, and final deployment status.

## 13. Open Questions & Unknowns
```yaml
unknown:
  field: github_organization_plan_concurrency_limits
  status: TO_VERIFY
  source_required: brand_owner
  impact: low
  temporary_assumption: "Standard GitHub Team plan providing 3,000 CI runner minutes/month sufficient for initial engineering team"

unknown:
  field: production_change_freeze_schedule
  status: TO_VERIFY
  source_required: brand_owner
  impact: medium
  temporary_assumption: "Code deployment freeze enforced during 7 days preceding Diwali, Rakhi, and Valentine's Day"
```

## 14. Future Evolution
- Canary Deployments with AWS App Mesh / Route 53 Weighted Routing, shifting 5% of customer traffic to new releases before full cutover.
- Preview Environments: Automated ephemeral staging deployments for every open pull request (`pr-123.preview.hampersbyher.com`).

## 15. References
- GitHub Actions Documentation: https://docs.github.com/en/actions
- AWS ECS Blue/Green Deployments: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-bluegreen.html
- Evolutionary Database Design & Expand-Contract Pattern: https://martinfowler.com/bliki/ParallelChange.html
