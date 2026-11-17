# ARCHITECTURE_DECISIONS.md — Hampers by Her Atelier Platform Architecture Decision Records (ADRs)

**Platform:** Hampers by Her Atelier AI Platform  
**Status:** Active & Implemented  
**Council:** Principal AI Architect, Database Architect, Security Architect, SRE Lead  

---

## ADR-001: Migration from MongoDB to PostgreSQL 16 + pgvector

### Context
The legacy Hampers by Her prototype utilized MongoDB with Mongoose and Motor. MongoDB lacked transactional referential integrity across leads, deals, organizations, and audit logs. Furthermore, storing vector embeddings for RAG would have required introducing an external standalone vector database (e.g., Pinecone or Qdrant), leading to dual-write synchronization hazards, two backup regimes, increased infrastructure costs, and complex cross-database authorization.

### Decision
Migrate the entire operational data layer to **PostgreSQL 16 with the pgvector extension**. PostgreSQL acts as the single source of truth for:
1. Normalized relational business records (tenants, users, leads, deals, campaigns, audit logs).
2. Document metadata and version history.
3. High-dimensional vector embeddings (`vector(1536)`) indexed with HNSW graphs.
4. Lexical full-text search (`tsvector` with GIN indexing).
5. The Transactional Outbox table for resilient event dispatch.

### Consequences
- **Positive**: Single ACID transactional boundary; zero vector-relational synchronization drift; hardware Row-Level Security (RLS); lower operational overhead; unified point-in-time recovery (PITR).
- **Negative**: Requires careful connection pooling (PgBouncer) and memory allocation for HNSW graph maintenance.

---

## ADR-002: Dual-Mode Voice AI Architecture (Real-Time S2S & Chained STT/TTS)

### Context
Voice interactions in enterprise GTM platforms have divergent requirements. Live sales coaching and conversational briefings require ultra-low latency ($\le 300\text{ ms}$) and natural barge-in interruptions. Conversely, official customer communications, CRM updates, and audit-sensitive workflows require deterministic transcript verification, moderation, and business-rule validation before speech synthesis.

### Decision
Support two complementary, explicitly routed voice architectures:
1. **Architecture A (Real-Time Speech-to-Speech)**: Uses WebRTC/WebSocket streaming directly to low-latency multimodal voice models. Applied to conversational exploration, brainstorming, and real-time voice concierge.
2. **Architecture B (Chained Pipeline)**: Audio Input $\to$ STT (Whisper) $\to$ Transcript Normalization $\to$ Intent Extraction $\to$ RAG Context Injection $\to$ LLM Execution $\to$ Speech Synthesis (TTS). Applied to workflow automation, CRM updates, and compliance audits.

### Consequences
- **Positive**: Optimal latency for natural conversations while preserving full determinism and auditability where legally mandated.
- **Negative**: Requires maintaining two separate media pipelines and unified turn state reconciliation.

---

## ADR-003: Multi-Stage Hybrid Retrieval (Vector + Lexical + RRF + Reranker)

### Context
Naive vector search fails when searching for exact product names, lead email addresses, deal IDs, or specific contract clauses. Lexical search alone fails when users query concepts semantically without exact keyword matches.

### Decision
Implement a multi-stage hybrid retrieval engine:
1. Stage 1: Parallel dense retrieval (`pgvector` HNSW cosine distance) and sparse lexical retrieval (PostgreSQL `tsvector` with `ts_rank_cd`).
2. Stage 2: Rank aggregation via **Reciprocal Rank Fusion (RRF, $k=60$)**:
   $$\text{RRF\_Score}(d) = \sum_{m} \frac{1}{60 + r_m(d)}$$
3. Stage 3: Cross-encoder semantic reranking of the top-20 candidates to yield the final top-5 grounded snippets.
4. Stage 4: Strict citation verification enforcing document version, page number, and tenant ACL.

### Consequences
- **Positive**: Substantially higher recall and precision; eliminates both keyword blindness and semantic hallucination.
- **Negative**: Higher compute latency for reranking ($30-60\text{ ms}$ overhead), mitigated by caching top queries in Redis.

---

## ADR-004: Transactional Outbox Pattern for Distributed Event Resilience

### Context
When a user uploads a document or initiates a lead sequence, the system must write records to the database and publish processing events to background workers. Direct network calls to queues (BullMQ/SQS) inside API handlers cause data corruption if the database commits but the queue drops, or vice versa (the dual-write anomaly).

### Decision
Enforce the **Transactional Outbox Pattern**:
- Every business state mutation and its corresponding event are written into the same PostgreSQL ACID transaction:
  ```sql
  INSERT INTO documents (...) VALUES (...);
  INSERT INTO outbox_events (id, aggregate_type, event_type, payload) VALUES (...);
  ```
- A background worker reads unprocessed events ordered by `created_at`, pushes them to BullMQ/SQS, and marks them `PROCESSED`.
- Consumers track message IDs in an idempotent ledger table (`processed_messages`) with bounded exponential retries and Dead-Letter Queues (DLQ).

### Consequences
- **Positive**: Zero event loss; guaranteed eventual consistency; clean decoupled worker scaling.
- **Negative**: Polling or CDC process required; slight latency addition ($10-50\text{ ms}$) for event dispatch.

---

## ADR-005: Defense-in-Depth AI Security & Confirmation Gates

### Context
Autonomous AI agents with tool-calling capabilities can execute destructive actions (e.g., deleting deals, bulk emailing contacts, modifying pipeline stages). Furthermore, RAG systems are vulnerable to indirect prompt injection if an untrusted customer document contains malicious instructions.

### Decision
1. **Confirmation Gate for Destructive Actions**: Categorize all tools into `SAFE_READ` (auto-executable) and `DESTRUCTIVE_WRITE` (`CONFIRMATION_REQUIRED_TOOLS`). Tools modifying state or communicating externally require explicit cryptographic user approval via tokenized approval cards.
2. **Untrusted Evidence Isolation**: Retrieved RAG chunks are enclosed in strict XML `<context_evidence>` tags with system instructions explicitly stating that evidence content can never override platform rules or grant elevated permissions.
3. **Hardware Row-Level Security (RLS)**: Enforced directly on PostgreSQL tables, ensuring cross-tenant leakage is mathematically impossible at the database engine level.

### Consequences
- **Positive**: Complete defense against prompt injection privilege escalation and cross-tenant data leakage.
- **Negative**: Requires frontend UI support for confirmation cards and slightly increases user interaction steps for write operations.

---
*Certified by Architecture Review Board — Decisions Active for Hampers by Her Atelier Platform 3.0.*
