# SCALE_1M_ARCHITECTURE.md — Hampers by Her 1M User Scalability Architecture

## 1. Executive Summary & Capacity Planning
This document establishes the production scaling architecture for **Hampers by Her** (`@hampers._by_her`), designed to reliably handle **1,000,000 Monthly Active Users (MAU)** with massive festive traffic spikes (Diwali, Rakhi, Valentine's, Wedding drops) generating **30,000 concurrent sessions** and **12,000 requests per second (RPS)**.

---

## 2. Traffic Modeling & Capacity Numbers

| Metric | Normal Business Day | Peak Festive Drop (Diwali / Rakhi) |
|:---|:---|:---|
| **Monthly Active Users (MAU)** | 1,000,000 | 1,000,000+ |
| **Daily Active Users (DAU)** | 35,000 | 180,000 |
| **Peak Concurrent Users (CCU)** | 3,500 | 32,000 |
| **Catalog / Storefront Browsing RPS** | 450 RPS | 10,500 RPS |
| **Bespoke Hamper 3D Builder RPS** | 80 RPS | 2,200 RPS |
| **Peak Checkout / Payment Orders** | 40 orders / min | 1,200 orders / min |
| **Concurrent Voice AI Sessions** | 50 WebRTC streams | 1,200 WebRTC streams |
| **Incoming Meta Webhook Bursts** | 30 webhooks / sec | 1,800 webhooks / sec |
| **Database Read IOPS** | 800 IOPS | 14,000 IOPS (absorbed by cache) |
| **Database Write IOPS** | 200 IOPS | 3,500 IOPS |

---

## 3. High-Concurrency Multi-Tier Topology

```
[1,000,000 Clients: Web / Voice / Meta]
                  │
                  ▼
[CloudFront Global CDN + AWS WAF Tier]
  ├── Edge Cache Static & Images (Hit Ratio: 94.2%)
  ├── Rate Limiter & DDoS Mitigation (Token Bucket)
  └── Stale-While-Revalidate (120s TTL)
                  │ (Origin Cache Misses: ~800 RPS)
                  ▼
[AWS Application Load Balancer (ALB) - Multi-AZ]
                  │
                  ▼
[Auto-Scaled ECS Fargate Container Fleet (8 to 64 Tasks)]
  ├── L1 In-Memory LRU Cache (50,000 entries per task)
  ├── SingleFlight Request Coalescer (Zero stampedes)
  ├── Adaptive Event Loop Load Shedder (Sheds non-critical at >70ms lag)
  └── Fastify Non-Blocking Async Core
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
[Redis 7 Cluster]     [PgBouncer Connection Pooler]
  ├── L2 Shared Cache    ├── 15,000 client conns -> 120 DB conns
  ├── Atomic Inventory   └── Transaction-level reuse
  │   Reservation Lock      │
  └── BullMQ Queues         ▼
                     [Amazon Aurora PostgreSQL 16 Serverless v2]
                       ├── Primary Writer (0.5 - 64 ACUs)
                       ├── 3 Auto-Scaled Read Replicas
                       ├── Range Partitioned Orders & Outbox
                       └── HNSW Vector Index (m=24, ef_const=128)
```

---

## 4. Key Scalability Subsystems

### 4.1 SingleFlight Request Coalescing
When a viral Instagram reel featuring a specific hamper drops, thousands of users request the exact same product details simultaneously. Without protection, this causes a **cache stampede** that overwhelms the database.
- **Engine**: `platform/services/cache-service/cacheGrid.js`.
- **Mechanism**: All concurrent requests for identical keys share a single active in-flight database Promise. 1,000 concurrent requests result in exactly **1 database read**, with the result distributed to all callers.

### 4.2 High-Concurrency Atomic Inventory Reservation
Exclusive artisan hampers have strictly limited stock (e.g. 50 handcrafted boxes). Traditional database `SELECT FOR UPDATE` causes massive lock contention and deadlocks at scale.
- **Engine**: `platform/services/scaling-service/inventoryLock.js`.
- **Mechanism**: Atomic check-and-decrement memory locks with 15-minute checkout expiration TTLs. Guarantees zero overselling and zero database locking during flash sales.

### 4.3 Multi-Tier Sliding Window Rate Limiting
- **Engine**: `platform/services/scaling-service/rateLimiter.js`.
- **Tiers**:
  - `ANONYMOUS`: 60 requests/minute.
  - `AUTHENTICATED`: 300 requests/minute.
  - `WEBHOOK`: 2,000 requests/minute (Meta WhatsApp & Instagram webhooks).
- **Adaptive Load Shedding**: If Node.js event loop lag exceeds 70ms, non-critical background traffic is shed with `503 / Retry-After` to protect checkout, payment, and voice audio streams.

### 4.4 Database Partitioning & Vector Tuning
- **DDL**: `platform/database/schemas/scale_1m_partitioning.sql`.
- **Orders Table**: Partitioned by quarterly/monthly range (`orders_2026_q4_festive`).
- **Transactional Outbox**: Partitioned by status (`outbox_pending` vs `outbox_dispatched`), keeping active queue polling tables sub-megabyte in size.
- **pgvector Indexing**: HNSW configured with `m = 24` and `ef_construction = 128` to maintain sub-10ms nearest-neighbor retrieval across 1,000,000+ vectors.

---

## 5. High Availability & Failure Recovery (SLA 99.95%)

| Failure Scenario | Mitigation Mechanism | RTO | RPO |
|:---|:---|:---|:---|
| **Aurora Primary AZ Outage** | Automatic Multi-AZ Aurora failover to Read Replica | $\le 18$s | $0$ (Synchronous storage) |
| **Redis Shard Failure** | Redis Sentinel / Cluster auto-promotion of replica | $\le 3$s | $\le 1$s (Async repl) |
| **Viral Traffic Spike (10x)** | CloudFront absorbs 94%; ECS Fargate auto-scales replicas | $\le 45$s | N/A |
| **Payment Gateway Downtime** | Fallback to secondary payment provider via Outbox retry | $\le 2$s | $0$ (ACID outbox) |
