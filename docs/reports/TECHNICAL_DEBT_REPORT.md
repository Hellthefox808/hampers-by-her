# TECHNICAL DEBT REGISTER — Hampers by Her Commerce Ecosystem

## 1. Technical Debt Overview
Technical debt is logged, categorized by risk rating, and assigned actionable remediation timelines to prevent unmanaged architectural drift.

---

## 2. Active Technical Debt Register

| Debt ID | System Area | Debt Description | Risk Rating | Impact | Remediation Plan | Target Milestone |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **DEBT-001** | Frontend | Monolithic `script.js` contains both storefront micro-interactions and modal handlers | **Low** | Reduced modularity for multi-developer teams | Refactor into modular ES modules (`/modules/cart.js`, `/modules/builder.js`, `/modules/visualizer.js`) when transitioning to Next.js App Router | Phase 3 |
| **DEBT-002** | Integrations | Razorpay and WhatsApp Cloud API currently operate in sandboxed mock mode | **Medium** | Pre-production testing relies on cryptographic simulation | Replace mock credentials with production merchant keys upon corporate bank onboarding | Phase 2 Go-Live |
| **DEBT-003** | Database | SQLite/JSON local fallback mirrors PostgreSQL schema instead of native dialect | **Low** | Query syntax variations in local development | Local Docker Compose with native `pgvector:pg16` now provides 100% dialect parity | Completed |
| **DEBT-004** | Cloud IaC | Multi-Region active-active failover is deferred in favor of ap-south-1 Multi-AZ | **Low** | Regional disaster recovery relies on snapshot replication | Implement cross-region Aurora replica in `eu-central-1` during International NRI expansion | Phase 4 |
