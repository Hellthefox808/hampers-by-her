<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 33_DEVOPS.md — Infrastructure as Code, Containerization & Environment Management Architecture

## 1. Purpose
This document establishes the Infrastructure as Code (IaC), container packaging, secrets governance, and multi-environment lifecycle standards for **Hampers by Her**. Moving from an unorganized boutique to a high-scale commercial platform requires enterprise-grade operational discipline: manual server configurations, ad-hoc terminal tweaks, and uncommitted database changes are strictly prohibited. This specification mandates fully reproducible, immutable cloud infrastructure provisioned via Terraform / OpenTofu, multi-stage Docker containerization running under non-root permissions on AWS ECS Fargate, and dynamic secret injection via AWS Secrets Manager.

## 2. Scope
- **In-Scope**:
  - Environment hierarchy: `local` ──► `development` ──► `staging` ──► `production`.
  - Infrastructure as Code (IaC) via Terraform with remote S3 state locking in DynamoDB.
  - Multi-stage Docker packaging for Next.js 15 (standalone output) and NestJS Fastify backend.
  - Container security hardening: non-root execution, minimal Alpine/Debian-slim base images, zero shell binaries in production images.
  - Secrets injection architecture using AWS Secrets Manager and IAM Task Roles (no secrets in git or environment files).
  - AWS VPC network segmentation (Public, Private Application, Private Isolated Database subnets).
  - Zero-downtime Blue/Green rolling deployments on AWS ECS.
- **Out-of-Scope**:
  - Managing physical bare-metal on-premise hardware (100% AWS cloud-native).

## 3. Context
Commerce disruptions during holiday marketing blitzes cause permanent revenue loss and severe brand damage. Hampers by Her isolates environments such that `staging` mirrors `production` in networking, payment webhook handling, and database versioning, allowing seamless smoke testing prior to traffic cutover.

```
[Terraform Configuration (modules/)]
       │
       ▼ (terraform apply with S3/DynamoDB Lock)
[AWS Cloud Infrastructure (ap-south-1)]
  ├── VPC (10.0.0.0/16) Across 3 Availability Zones
  │     ├── Public Subnets (ALB, NAT Gateways)
  │     ├── Private App Subnets (ECS Fargate Next.js + NestJS)
  │     └── Isolated DB Subnets (Aurora PostgreSQL + ElastiCache)
  ├── Security Groups (Least Privilege Port Ingress)
  └── IAM Roles (TaskExecutionRole + TaskRole)
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-OPS-01**: Environment Parity: Maintain identical Terraform module topology across `staging` and `production`, differing only in instance sizes and scaling limits.
- **FR-OPS-02**: Multi-Stage Docker Builds: Produce optimized container images under 150MB using multi-stage compilation and cache mounting.
- **FR-OPS-03**: Non-Root Container Execution: Containers must enforce a dedicated unprivileged user (`USER node:node` or `USER nonroot`) with read-only root filesystems.
- **FR-OPS-04**: Dynamic Secret Resolution: Secrets (Razorpay keys, Meta WhatsApp tokens, database credentials) fetched at runtime via AWS Secrets Manager using IAM task execution credentials.
- **FR-OPS-05**: Zero-Downtime Deployments: ECS Fargate rolling updates with minimum healthy percent = 100% and maximum percent = 200%, ensuring continuous availability during code releases.

### 4.2 Non-Functional Requirements
- **NFR-OPS-01**: Cold Container Startup: Backend container startup and health check readiness (`/health/readiness`) completed in under 12 seconds.
- **NFR-OPS-02**: IaC Idempotency: Running `terraform plan` on an unchanged stack must return `No changes. Your infrastructure matches the configuration.`
- **NFR-OPS-03**: Container Vulnerabilities: 0 Critical or High severity CVEs in production container images scanned via Trivy.

## 5. Architecture & Design

### 5.1 Multi-Environment Architecture
```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   DEVELOPMENT   │       │     STAGING     │       │   PRODUCTION    │
│                 │       │                 │       │                 │
│ • Local Docker  │ ──►   │ • AWS Fargate   │ ──►   │ • AWS Fargate   │
│ • SQLite/PgDev  │       │ • Aurora Dev    │       │ • Aurora MultiAZ│
│ • Razorpay Test │       │ • Razorpay Test │       │ • Razorpay Live │
│ • Mock WhatsApp │       │ • Meta Sandbox  │       │ • Meta Live WABA│
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

### 5.2 Network Segmentation (VPC Layout)
- **VPC CIDR**: `10.0.0.0/16` in `ap-south-1` (Mumbai).
- **Subnets**:
  - `Public Subnet 1/2/3` (`10.0.1.0/24`, `10.0.2.0/24`, `10.0.3.0/24`): Internet Gateway, Application Load Balancers, NAT Gateways.
  - `Private App Subnet 1/2/3` (`10.0.10.0/24`, `10.0.11.0/24`, `10.0.12.0/24`): ECS Fargate tasks (Next.js & NestJS). Egress via NAT Gateway.
  - `Isolated DB Subnet 1/2/3` (`10.0.20.0/24`, `10.0.21.0/24`, `10.0.22.0/24`): Aurora PostgreSQL Cluster, ElastiCache Redis. Zero Internet ingress or egress.

## 6. Business Rules
1. **No Manual AWS Console Mutations ("ClickOps Prohibited")**: Any production resource modified manually in the AWS Console is considered an operational violation and will be overwritten by Terraform drift reconciliation.
2. **Production Access Governance**: Direct SSH or AWS SSM session access to production containers is restricted strictly to `SUPER_ADMIN` / Principal DevOps Engineers during emergency P0 incident resolution.
3. **Database Migration Gate**: Production database migrations can only execute via automated ephemeral ECS run-tasks immediately prior to new container cutover; migrations must be backwards-compatible with the currently running container version.

## 7. Technical Details

### 7.1 Multi-Stage Dockerfile (NestJS Fastify Backend)
```dockerfile
# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package*.json prisma ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --production

# Stage 2: Minimal Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

USER nestjs
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health/liveness || exit 1

CMD ["node", "dist/main.js"]
```

### 7.2 Terraform Remote State Locking Configuration
```hcl
# backend.tf
terraform {
  required_version = ">= 1.8.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }

  backend "s3" {
    bucket         = "hbh-terraform-state-prod"
    key            = "commerce/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "hbh-terraform-locks"
    encrypt        = true
  }
}
```

## 8. Dependencies
- **Tooling**: Terraform / OpenTofu 1.8+, Docker 26+, AWS CLI v2.
- **Upstream Modules**: `BackendArchitecture`, `FrontendArchitecture`, `DatabaseDesign`.
- **Cloud Infrastructure**: AWS ECS Fargate, AWS ECR, AWS Secrets Manager, AWS VPC, AWS KMS.

## 9. Security
- **Least Privilege IAM Roles**: ECS Tasks run with minimal IAM policies: `TaskRole` grants read-only access strictly to assigned S3 buckets and Secrets Manager ARNs; `TaskExecutionRole` allows pull from ECR and write to CloudWatch Logs.
- **Read-Only Root Filesystem**: Production containers mount the root filesystem as read-only (`readOnlyRootFilesystem: true`), utilizing ephemeral `/tmp` volumes for temporary file manipulation.

## 10. Failure Modes & Resilience
1. **ECS Task Crash Loop**: If a new container image fails startup health checks, ECS aborts deployment, keeps existing containers running, and marks the service deployment `FAILED` without customer downtime.
2. **NAT Gateway Outage**: NAT Gateways are provisioned redundantly across 2 Availability Zones; AZ failure routes outbound API traffic through the surviving zone.

## 11. Testing (DevOps & Infrastructure)
- **Terraform Validation**: Automated execution of `terraform fmt -check`, `tflint`, and `checkov` static analysis in CI.
- **Container Vulnerability Scan**: Trivy scan blocking build pipelines if High/Critical CVEs are discovered in base images.
- **Disaster Spin-Up Simulation**: Bi-annual test provisioning an entire staging environment from scratch in a clean AWS sandbox account via single-command `terraform apply`.

## 12. Observability & Monitoring
- **Metrics Tracked**:
  - `ecs.cpu_utilization` and `ecs.memory_utilization`.
  - `alb.healthy_host_count`.
  - `nat_gateway.bytes_out` and `nat_gateway.error_port_allocation`.
- **Dashboards**: AWS CloudWatch Infrastructure Dashboard displaying live Fargate task health, ALB target group latencies, and container restart counts.

## 13. Open Questions & Unknowns
```yaml
unknown:
  field: aws_production_account_id
  status: TO_VERIFY
  source_required: brand_owner
  impact: high
  temporary_assumption: "Requires business owner to provision dedicated AWS Organization account for production isolation"

unknown:
  field: monthly_aws_infrastructure_budget_ceiling
  status: TO_VERIFY
  source_required: brand_owner
  impact: medium
  temporary_assumption: "Initial MVP infrastructure sized within ₹15,000 - ₹25,000/month AWS baseline"
```

## 14. Future Evolution
- Multi-Region Disaster Recovery failover from `ap-south-1` (Mumbai) to `ap-south-2` (Hyderabad).
- Kubernetes (EKS) migration when container footprint exceeds 30 microservices.

## 15. References
- AWS Well-Architected Framework: https://aws.amazon.com/architecture/well-architected/
- Terraform AWS Provider Documentation: https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- CIS Docker Benchmark Guidelines: https://www.cisecurity.org/benchmark/docker
