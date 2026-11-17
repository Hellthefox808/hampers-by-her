# CHANGELOG.md — Hampers by Her Digital Commerce Platform

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] — 2026-11-17

### Added
- **Infrastructure as Code & Cloud Architecture (`infra/terraform/`)**:
  - Implemented 7 production Terraform / OpenTofu modules: `vpc` (3-tier across 3 AZs with dual NAT Gateways), `security` (least privilege groups + AWS WAFv2 rate limiting), `iam` (ECS task execution and runtime roles), `database` (Aurora Serverless v2 PostgreSQL 16 + ElastiCache Redis 7.2 Multi-AZ), `loadbalancer` (ALB dual-stack with TLS 1.3 redirect and `/health` probe), `compute` (ECS Fargate cluster with target tracking auto-scaling), and `storage_cdn` (S3 private media bucket with Origin Access Control and CloudFront distribution).
- **Containerization & Local Orchestration**:
  - Hardened multi-stage `Dockerfile` (`dependencies` $\rightarrow$ `builder` $\rightarrow$ `runner`) based on `node:22-alpine` with `dumb-init` signal trapping and unprivileged `USER node` execution.
  - Multi-service `docker-compose.yml` orchestrating App, PostgreSQL 16 with `pgvector`, Redis 7.2 with AOF and LRU cap, LocalStack AWS emulation, and Prometheus SRE scraper across segregated bridge networks.
- **Kubernetes Enterprise Orchestration (`infra/k8s/`)**:
  - Production manifests: Namespace with restricted pod security standards, ConfigMap, Secret template, Deployment with rolling updates (`maxSurge: 1`, `maxUnavailable: 0`), ClusterIP Service, Horizontal Pod Autoscaler (min 2, max 12 pods), AWS ALB Ingress, and PodDisruptionBudget.
- **CI/CD & DevSecOps Automation (`.github/workflows/`)**:
  - Upgraded `ci.yml` quality gate with Trivy container vulnerability scanning (CRITICAL/HIGH CVE detection) and Terraform formatting checks.
  - Added `deploy.yml` with AWS OpenID Connect (OIDC) authentication, Amazon ECR container build & push, zero-downtime ECS rolling updates, and post-deployment `/health` smoke rollback guards.
- **SRE Observability & Operational Runbooks**:
  - Prometheus scrape configuration (`infra/observability/prometheus.yml`) and alerting rules (`alerts.yml`) monitoring availability, 5xx error rates, P99 latency, event loop lag, and connection pools.
  - Operational scripts: `deploy_verify.sh` (Canary health probe) and `backup_restore.sh` (Aurora snapshot trigger).
- **Apple Human Interface Guidelines (HIG) Glassmorphism & UI/UX Elevation**:
  - Apple Liquid Glass design tokens, multi-stop ambient radial mesh background, floating capsule navigation, iOS Dynamic Island mobile dock, tactile spring buttons, VisionOS floating sheets, and macOS Sonoma Studio Operations OS cockpit.
- **Core Domain Services & Storefront Atelier Systems**:
  - Passwordless 6-digit WhatsApp OTP authentication with URL-safe JWT issuance and staff RBAC (`SUPER_ADMIN`, `OPERATIONS`, `ARTISAN`, `CUSTOMER`).
  - Atelier Studio Fulfillment OS (`website/admin.html`) with workshop PIN gate, real-time live order search, and mandatory QC Photo Gate.
  - Logistics Courier Adapter (`server/services/logisticsCourierService.js`) with AWB generation, carrier routing, and tracking checkpoints.
  - 11-Step Bespoke Hamper Builder Engine with live 3D capacity calculations and Atelier Procedural Luxury SVG preview generation.
  - Natural Language Intent Search with ReDoS-safe tokenizer and fuzzy filtering.
- **Algorithmic DSA Core (`platform/services/dsa/`)**:
  - 3D Volumetric Bin-Packing, Deterministic Integer Paise Pricing Ledger, Rule-Based Coupon DAG, Multi-Criteria Budget Knapsack Optimization, Atomic Inventory Allocation with Pessimistic Concurrency, and Omnichannel Lead Scoring.
- **Voice AI Android Application (`dist/HampersByHer-VoiceAI.apk`)**:
  - Low-latency WebSocket streaming PCM16 audio engine with VAD and instant barge-in interruption detection packaged in native Android APK.
- **Multi-Gateway Smart Payment Router (`platform/services/payment-service/smartRouter.js`)**:
  - Sub-second multi-acquirer failover (Razorpay $\leftrightarrow$ Cashfree $\leftrightarrow$ Stripe), dynamic UPI Intent vs QR code generation, constant-time HMAC-SHA256 signature verification with replay protection, and FEMA export compliance.
- **Automated Test Suites**:
  - Expanded automated test coverage to **219/219 passing tests across 61 test suites in 770ms**.

### Changed
- Refactored storefront and admin stylesheets to native Apple Glassmorphism without breaking 4D motion or 3D card tilt geometry.
- Hardened server crash recovery with atomic synchronous flush and startup rehydration from `data/atelier_store.json`.
- Synchronized all 44 architectural specifications across root and `docs/` maintaining 100% Section 40 compliance.
