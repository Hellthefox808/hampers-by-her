<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 42_DEPLOYMENT_RUNBOOK.md — Production Rollout, Infrastructure Operations & Incident Response Runbook

## 1. Purpose
This document provides the definitive, battle-tested operational runbook for provisioning, deploying, maintaining, migrating, and rolling back the **Hampers by Her** digital commerce platform across staging and production environments. It equips DevOps and on-call site reliability engineers (SREs) with explicit, copy-pasteable CLI commands, automated pre-flight checklists, database migration protocols, DNS cutover procedures, and incident recovery steps to guarantee zero-downtime releases and prevent accidental production data loss.

## 2. Scope
- **In-Scope**:
  - Step-by-step CLI execution commands for:
    1. Pre-deployment artifact validation and local smoke testing.
    2. Terraform AWS infrastructure provisioning (VPC, Aurora Serverless v2, Redis, ECS, CloudFront).
    3. Docker container building, vulnerability scanning, and Amazon ECR publishing.
    4. Database schema migration execution via Prisma with pre-migration snapshot locks.
    5. ECS Fargate blue/green service deployment with AWS CodeDeploy.
    6. Production health verification, synthetic smoke tests, and Route 53 DNS cutover.
    7. Rapid rollback procedures (ECS task definition reversion and database schema rollback).
    8. Critical incident runbooks (database connection exhaustion, Redis memory saturation, payment gateway webhook desynchronization).
- **Out-of-Scope**:
  - Undocumented manual console changes (all modifications must be executed via IaC or CI/CD).

## 3. Context
Gifting commerce platforms experience extreme traffic surges during Indian festive periods (e.g. 10x traffic during Valentine's Day and Diwali). Deploying updates during these windows without strict operational runbooks introduces catastrophic outage risks. This runbook codifies deterministic operational rigor.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 CANARY & BLUE/GREEN DEPLOYMENT WORKFLOW                     │
└─────────────────────────────────────────────────────────────────────────────┘
  1. Git Tag Push (vX.Y.Z) ──► 2. Build & Scan ECR Image ──► 3. Aurora Snapshot
                                                                    │
  6. Production Route 53 ◄── 5. Synthetic Smoke Tests ◄── 4. ECS Blue/Green Deploy
     Traffic Shift 100%         (Health / Checkout)          (10% Canary -> 100%)
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-DEP-01**: Immutable Artifacts: Every deployment must reference an immutable Docker image tagged with the short git commit SHA (`git rev-parse --short HEAD`) and semantic release tag.
- **FR-DEP-02**: Mandatory Pre-Migration Snapshot: An automated Amazon Aurora point-in-time snapshot must be triggered immediately prior to executing any database migration script.
- **FR-DEP-03**: Zero-Downtime Deployment: Traffic shifting must utilize AWS ECS Blue/Green deployment with AWS CodeDeploy, maintaining existing tasks until new tasks pass ALB target group health checks (`/health/ready`).
- **FR-DEP-04**: One-Command Rollback: Reverting to the previous known-good deployment must be achievable via a single CLI invocation in $\le 120\text{ seconds}$.

### 4.2 Non-Functional Requirements
- **NFR-DEP-01**: Deployment Window: Standard production deployments must be executed during low-traffic studio maintenance windows (Tuesday/Wednesday 02:00–04:00 IST).
- **NFR-DEP-02**: Security Isolation: Production deployment credentials must use short-lived AWS STS assume-role sessions via GitHub Actions OIDC; zero permanent AWS access keys in CI/CD.

## 5. Architecture & Design
### 5.1 Deployment Pipeline Topology
The deployment workflow progresses through three strictly isolated environments:
- **Local Development**: Docker Compose with local PostgreSQL 16 and Redis 7.2.
- **Staging (`stg.hampersbyher.com`)**: Ephemeral ECS Fargate service matching production topology with sanitized catalog seed data.
- **Production (`hampersbyher.com`)**: Multi-AZ Aurora PostgreSQL Serverless v2, ElastiCache Redis cluster, ECS Fargate auto-scaling behind CloudFront WAF.

## 6. Business Rules
- **BR-DEP-01**: **Peak Season Deployment Freeze**: Zero non-emergency deployments are permitted within 7 days of major gifting holidays (Diwali, Rakhi, Valentine's, Mother's Day).
- **BR-DEP-02**: **Two-Engineer Authorization**: Production releases require sign-off from both the Lead Cloud Architect and the Head of Atelier Operations.
- **BR-DEP-03**: **Destructive SQL Prohibition**: DDL migrations containing `DROP TABLE`, `DROP COLUMN`, or `TRUNCATE` are strictly rejected by the deployment pipeline without prior data archival.

## 7. Technical Details

### 7.1 Pre-Deployment Verification
Execute locally prior to triggering CI/CD release:
```bash
# 1. Ensure working directory is clean
git status

# 2. Run full lint, typecheck, and test suite
npm run lint
npm run typecheck
npm test

# 3. Verify Docker container builds locally without errors
docker build -t hampers-by-her:local-verify .

# 4. Verify no high/critical CVEs in dependencies
npm audit --audit-level=high
trivy image hampers-by-her:local-verify
```

### 7.2 Infrastructure Provisioning (Terraform)
To apply infrastructure updates via AWS CLI and Terraform:
```bash
cd terraform/environments/production

# 1. Initialize remote S3 state
terraform init -backend-config="bucket=hampers-by-her-tf-state" -backend-config="key=prod/terraform.tfstate"

# 2. Plan and inspect resource diff
terraform plan -out=prod.tfplan

# 3. Apply infrastructure updates
terraform apply "prod.tfplan"
```

### 7.3 Database Migration Procedure (Prisma & Aurora)
```bash
# Step 1: Create manual pre-migration Aurora snapshot
aws rds create-db-cluster-snapshot \
  --db-cluster-identifier hampers-by-her-prod-aurora \
  --db-cluster-snapshot-identifier "pre-deploy-$(date +%Y%m%d%H%M%S)" \
  --region ap-south-1

# Step 2: Execute Prisma migrations via bastion or ECS one-off task
aws ecs run-task \
  --cluster hampers-by-her-prod-cluster \
  --task-definition hampers-by-her-migration-task:12 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-priv-a,subnet-priv-b],securityGroups=[sg-migration-task],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides": [{"name": "migration-runner", "command": ["npx", "prisma", "migrate", "deploy"]}]}' \
  --region ap-south-1

# Step 3: Verify migration status
# Check CloudWatch log stream: /ecs/hampers-by-her-prod/migration-runner
```

### 7.4 Application Container Deployment (ECS Fargate)
```bash
# Step 1: Authenticate Docker with Amazon ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.ap-south-1.amazonaws.com

# Step 2: Build, tag, and push immutable image
IMAGE_TAG="v1.2.0-$(git rev-parse --short HEAD)"
docker build -t hampers-by-her-core:$IMAGE_TAG .
docker tag hampers-by-her-core:$IMAGE_TAG 123456789012.dkr.ecr.ap-south-1.amazonaws.com/hampers-by-her-core:$IMAGE_TAG
docker push 123456789012.dkr.ecr.ap-south-1.amazonaws.com/hampers-by-her-core:$IMAGE_TAG

# Step 3: Register new ECS Task Definition revision with updated image
# (Automated via GitHub Actions, or manually via AWS CLI)
TASK_DEF_ARN=$(aws ecs register-task-definition --cli-input-json file://task-def.json --query 'taskDefinition.taskDefinitionArn' --output text)

# Step 4: Trigger ECS rolling update
aws ecs update-service \
  --cluster hampers-by-her-prod-cluster \
  --service hampers-by-her-prod-api \
  --task-definition $TASK_DEF_ARN \
  --force-new-deployment \
  --region ap-south-1

# Step 5: Wait for service stability
aws ecs wait services-stable \
  --cluster hampers-by-her-prod-cluster \
  --services hampers-by-her-prod-api \
  --region ap-south-1
```

### 7.5 Post-Deployment Smoke Test Script
```bash
#!/usr/bin/env bash
set -e

PROD_URL="https://hampersbyher.com"

echo "Running Smoke Tests on $PROD_URL..."

# 1. Health Check
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/health/ready")
if [ "$HTTP_STATUS" -ne 200 ]; then
  echo "FAILED: Health check returned $HTTP_STATUS"
  exit 1
fi
echo "PASSED: Health check OK (200)"

# 2. Product Catalog API
CATALOG_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/api/v1/products?limit=1")
if [ "$CATALOG_STATUS" -ne 200 ]; then
  echo "FAILED: Catalog API returned $CATALOG_STATUS"
  exit 1
fi
echo "PASSED: Catalog API OK (200)"

# 3. Hamper Builder Step Config
BUILDER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/api/v1/hampers/builder-config")
if [ "$BUILDER_STATUS" -ne 200 ]; then
  echo "FAILED: Hamper Builder config returned $BUILDER_STATUS"
  exit 1
fi
echo "PASSED: Hamper Builder API OK (200)"

echo "ALL SMOKE TESTS PASSED SUCCESSFULLY."
```

### 7.6 Rapid Rollback Procedure
If smoke tests fail or CloudWatch alerts trigger post-release:
```bash
# Step 1: Immediately revert ECS service to previous stable task definition revision
PREV_TASK_DEF="hampers-by-her-prod-api:24" # Replace with verified previous version

echo "ROLLING BACK to $PREV_TASK_DEF..."
aws ecs update-service \
  --cluster hampers-by-her-prod-cluster \
  --service hampers-by-her-prod-api \
  --task-definition $PREV_TASK_DEF \
  --force-new-deployment \
  --region ap-south-1

aws ecs wait services-stable \
  --cluster hampers-by-her-prod-cluster \
  --services hampers-by-her-prod-api \
  --region ap-south-1

# Step 2: Invalidate CloudFront edge cache to flush failing assets
aws cloudfront create-invalidation \
  --distribution-id E1A2B3C4D5E6F7 \
  --paths "/*"

echo "ROLLBACK COMPLETE. Monitoring metrics..."
```

## 8. Dependencies
- Upstream Modules:
  - `33_DEVOPS.md` (Terraform configurations and AWS network topology).
  - `34_CI_CD.md` (GitHub Actions workflow configurations).
  - `35_CLOUD_ARCHITECTURE.md` (AWS physical and logical resource maps).
  - `37_BACKUP_DR.md` (Disaster recovery and database restoration runbooks).

## 9. Security
- **OIDC IAM Roles**: GitHub Actions authenticates with AWS using OpenID Connect (OIDC), eliminating static IAM user keys.
- **KMS Secret Decryption**: Application containers decrypt production configuration variables via AWS Secrets Manager at task startup using runtime IAM task roles.
- **Network Bastion Access**: Direct SSH access to EC2/RDS instances is strictly disabled; access is managed via AWS Systems Manager (SSM) Session Manager with MFA and session logging.

## 10. Failure Modes
| Scenario | Detection Signal | Immediate Mitigation Action |
| :--- | :--- | :--- |
| **Prisma Migration Lock** | Migration task hangs $> 5\text{ mins}$ | Terminate migration task; check for lock on `_prisma_migrations` table; restart task |
| **New Container Crash Loop** | ECS tasks fail `/health/live` check | ECS automatically halts rollout; previous tasks continue serving traffic |
| **CloudFront 502 Bad Gateway** | CloudWatch 5xx alarm on CloudFront | Inspect ALB target health; verify security group egress rules from ALB to Fargate |
| **Redis Out of Memory (OOM)** | Redis memory usage $> 90\%$ | Scale up ElastiCache node class or flush ephemeral session cache (preserve reservations) |

## 11. Testing
- **Staging Pre-Flight**: 100% of deployment commands must be executed and validated in the `staging` environment prior to running against production.
- **Chaos Deployment Test**: Periodically simulate container termination during active deployment to verify ALB zero-downtime drain semantics (30s deregistration delay).

## 12. Observability
- **Deployment Markers**: Datadog / CloudWatch deployment events emitted upon task cutover.
- **Key Dashboards**: Monitor `AWS/ECS CPUUtilization`, `MemoryUtilization`, `ALB TargetResponseTime`, and `HTTPCode_Target_5XX_Count` for 30 minutes following release.

## 13. Open Questions
```yaml
unknown:
  field: production_aws_account_id
  status: TO_VERIFY
  source_required: brand_owner
  impact: high
  temporary_assumption: "AWS CLI runbook commands utilize placeholder Account ID 123456789012 and region ap-south-1 (Mumbai)."
```

```yaml
unknown:
  field: production_domain_registrar
  status: TO_VERIFY
  source_required: brand_owner
  impact: medium
  temporary_assumption: "DNS cutover assumes Route 53 is the authoritative nameserver for hampersbyher.com."
```

## 14. Future Evolution
- **GitOps with ArgoCD**: Migrate from imperative CLI/GitHub Actions deployments to declarative Kubernetes GitOps using Amazon EKS and ArgoCD as operational team expands.
- **Automated Canary Analysis (ACA)**: Implement Flagger / AWS App Mesh to automate metric-driven canary traffic analysis (automatically rolling back if error rate exceeds 0.5%).

## 15. References
- AWS ECS Blue/Green Deployment Guide with CodeDeploy.
- HashiCorp Terraform Production Best Practices.
- Prisma ORM Production Deployment and Migration Guide.
- Google SRE Book: *Site Reliability Engineering: How Google Runs Production Systems*.

<!-- DOCUMENT END: 42_DEPLOYMENT_RUNBOOK.md -->
