# INFRASTRUCTURE STATE — Hampers by Her

## 1. Cloud Architecture (AWS ap-south-1 Mumbai)
- **Compute**: AWS ECS Fargate running multi-stage hardened Node.js 22 Alpine containers with `dumb-init` signal handling, unprivileged `USER node` execution, and read-only root filesystems.
- **Relational Database**: Amazon Aurora PostgreSQL Serverless v2 (version 16.2) across 2 Availability Zones (`ap-south-1a`, `ap-south-1b`), dynamically scaling from 0.5 to 16 ACUs with automated KMS-encrypted 30-day backups.
- **In-Memory Cache**: Amazon ElastiCache for Redis 7.2 Multi-AZ replication group with in-transit TLS encryption, AUTH token protection, and LRU memory eviction.
- **Object Storage & CDN**: Amazon S3 private media bucket with Origin Access Control (OAC), public access blocks, and CloudFront CDN with TLS 1.3 and Brotli/Gzip compression.
- **DDoS & Web Exploit Shield**: AWS WAFv2 Web ACL with Core Rule Set (CRS), Known Bad Inputs, and 1,000 req/5min rate limiting per IP address.

## 2. Infrastructure as Code (IaC) Stack (`infra/terraform/`)
- **Engine**: Terraform v1.8+ / OpenTofu.
- **Root Configuration**: `main.tf`, `variables.tf`, `outputs.tf`, `terraform.tfvars.example`.
- **Modular Topology**:
  - `modules/vpc`: 3-tier subnets (Public, Private App, Isolated DB) across 3 AZs with dual NAT Gateways and VPC flow logging.
  - `modules/security`: Least-privilege security groups strictly isolating PostgreSQL (port 5432) and Redis (port 6379) to ECS tasks only.
  - `modules/iam`: Dedicated ECS task execution role (ECR pull, Secrets Manager decryption) and runtime task role (S3 media, CloudWatch).
  - `modules/compute`: ECS Fargate cluster with Container Insights, auto-scaling between 2 and 12 tasks based on target tracking (CPU 65%, Memory 75%).
  - `modules/loadbalancer`: Dual-stack ALB with HTTP-to-HTTPS 301 redirection, TLS 1.3 policy, health check probe on `/health`, and WAF association.
  - `modules/database`: Aurora Serverless v2 PostgreSQL 16 cluster and Multi-AZ ElastiCache Redis 7.2.
  - `modules/storage_cdn`: S3 media derivatives bucket with OAC and CloudFront distribution.

## 3. Local Development & Air-Gapped Emulation (`docker-compose.yml`)
- **App**: `hbh-app-server` running on port 3000 with live volume mounts and healthchecks.
- **PostgreSQL**: `hbh-postgres-db` (`pgvector/pgvector:pg16`) with automatic DDL and schema bootstrapping.
- **Redis**: `hbh-redis-cache` (`redis:7.2-alpine`) with AOF persistence, password authentication, and 256MB LRU memory cap.
- **LocalStack**: `hbh-localstack-aws` emulating S3, Secrets Manager, SQS, and KMS for offline air-gapped development.
- **Prometheus**: `hbh-prometheus-sre` scraping app, redis, and database metrics with alerting rules.
- **Networks**: `hbh-frontend-net` and `hbh-backend-net` enforcing network isolation.

## 4. SRE & Observability Infrastructure (`infra/observability/`)
- **Prometheus Scrapes** (`prometheus.yml`): Target configuration for `hbh-app:3000/metrics`, `redis:6379`, and `postgres:5432`.
- **SRE Alerting Rules** (`alerts.yml`):
  - `ServiceDown`: Heartbeat failure $>1\text{m}$.
  - `HighHttpErrorRate`: 5xx error rate $>1\%$ breaching 99.9% SLO.
  - `HighApiLatencyP99`: 99th percentile response time $>500\text{ms}$.
  - `HighEventLoopLag`: Node.js event loop lag $>70\text{ms}$ (adaptive load shedding trigger).
  - `RedisMemorySaturation`: Memory utilization $>90\%$.
  - `PostgresConnectionPoolSaturation`: DB active connection pool $>85\%$.

## 5. Operational Automation Scripts (`infra/scripts/`)
- `deploy_verify.sh`: Production Canary and smoke deployment healthcheck poller.
- `backup_restore.sh`: Disaster recovery on-demand Aurora snapshot trigger and local store persistence backup.
