# ARCHITECTURE.md — Hampers by Her Enterprise AI Master System Architecture

**Platform:** Hampers by Her Atelier AI Platform  
**Version:** 3.0.0 — Production Engineering Edition  
**Architecture Classification:** 4-Plane Enterprise Multimodal Intelligence Ecosystem  
**Author:** Principal AI Architect & Distributed Systems Council  
**Date:** November 2026  

---

## 1. System Vision & Architecture Topology

The Hampers by Her Atelier AI Platform is architected as an interconnected, 4-plane distributed intelligence system engineered for ultra-low latency, strict tenant isolation, hybrid retrieval, and real-time multimodal voice interaction.

```
══════════════════════════════════════════════════════════════════════════════════════════
                            1. CORE CONTROL PLANE
══════════════════════════════════════════════════════════════════════════════════════════
  [Edge CloudFront / ALB] ──► [API & Media Gateway (Node.js/Fastify + WS Server)]
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
  [Tenant & Auth Manager]      [Policy & Approval Engine]    [Agent Context Orchestrator]
  (JWT, RBAC/ABAC, RLS)        (Gate for Destructive Tools)  (16-Phase Context Loop)
                                         │
                                         ▼
                             [Unified AI Model Gateway]
               (OpenAI, Anthropic Claude, Google Gemini, Local vLLM/Ollama)

══════════════════════════════════════════════════════════════════════════════════════════
                            2. INTELLIGENCE PLANE
══════════════════════════════════════════════════════════════════════════════════════════
  ┌──────────────────────────────┐              ┌──────────────────────────────┐
  │     VOICE AI SUBSYSTEM       │              │     HYBRID RAG SUBSYSTEM     │
  │ • Real-Time Speech-to-Speech │              │ • Multi-format Parsers       │
  │ • Dual-Mode Chained STT/TTS  │              │ • Semantic & Parent Chunking │
  │ • VAD & Conversational Abort │              │ • Dense pgvector HNSW Search │
  │ • PCM16 Low-Latency Streaming│              │ • Lexical GIN tsvector Search│
  │ • Multilingual Code-Switching│              │ • Reciprocal Rank Fusion(RRF)│
  │ • Voice Session State Machine│              │ • Cross-Encoder Reranker     │
  └──────────────┬───────────────┘              └──────────────┬───────────────┘
                 │                                             │
                 └──────────────────────┬──────────────────────┘
                                        ▼
                          [Conversational Memory Service]
                 (Short-Term, Long-Term, Episodic & Semantic Memory)

══════════════════════════════════════════════════════════════════════════════════════════
                               3. DATA PLANE
══════════════════════════════════════════════════════════════════════════════════════════
  ┌──────────────────────────────┐              ┌──────────────────────────────┐
  │   PostgreSQL 16 + pgvector   │              │     Redis 7 Cache Cluster    │
  │ • Normalized ACID Relational │              │ • Distributed Session Ledger │
  │ • Hardware Row-Level Security│              │ • Token Bucket Rate Limiter  │
  │ • HNSW Vector Embeddings     │              │ • VAD State & Audio Buffers  │
  │ • Full-Text GIN Indexes      │              │ • BullMQ Execution Queues    │
  │ • Transactional Outbox Table │              │ • Fast L1 Semantic Cache     │
  └──────────────┬───────────────┘              └──────────────┬───────────────┘
                 │                                             │
                 └──────────────────────┬──────────────────────┘
                                        ▼
                        [Distributed Pipeline Workers]
                 (Document Ingestion, Embedding Workers, DLQ)

══════════════════════════════════════════════════════════════════════════════════════════
                            4. OPERATIONS PLANE
══════════════════════════════════════════════════════════════════════════════════════════
  [OpenTelemetry Collector] ──► [Prometheus Metrics] + [Jaeger Distributed Tracing]
  [Structured Audit Logs]   ──► [CloudWatch / Elastic]
  [Automated SRE Alerts]    ──► [PagerDuty / Slack Ops]
══════════════════════════════════════════════════════════════════════════════════════════
```

---

## 2. Plane Specifications & Module Boundaries

### 2.1 Core Control Plane

#### 1. API & Media Gateway (`platform/gateway`)
- **Responsibilities**: Terminates TLS 1.3; authenticates JWT sessions; handles WebSocket (RFC 6455) streaming upgrades for voice; rate-limits requests via Redis token buckets; dispatches to downstream internal services.
- **Protocol**: HTTP/2, REST (OpenAPI 3.1), WebSockets (`/api/v1/voice/stream`).
- **Dependencies**: Redis 7, Tenant Auth Manager.

#### 2. Tenant & Auth Manager (`platform/services/auth`)
- **Responsibilities**: Issues short-lived JWT access tokens and cryptographically signed refresh tokens; validates RBAC roles (`SUPER_ADMIN`, `TENANT_ADMIN`, `GTM_MEMBER`, `READ_ONLY`) and ABAC attributes; sets PostgreSQL connection session variables (`SET LOCAL app.current_tenant_id = ?`).
- **Permissions**: Only module authorized to inspect root identity tables.

#### 3. Agent Context Orchestrator (`platform/services/orchestrator`)
- **Responsibilities**: Executes the deterministic 16-phase context loop connecting Voice inputs, RAG retrieval, Database transactions, and Tool execution.
- **Safety Law**: No non-deterministic LLM output can bypass confirmation gates for write actions (`CONFIRMATION_REQUIRED_TOOLS`).

#### 4. Unified AI Model Gateway (`platform/services/model-gateway`)
- **Responsibilities**: Provides a provider-agnostic interface across OpenAI (`gpt-4o`, `text-embedding-3-small`, `whisper-1`), Anthropic (`claude-3-5-sonnet`), Google Gemini (`gemini-2.0-flash`), and local vLLM/Ollama endpoints.
- **Resilience Features**: Circuit breakers (5 consecutive 5xx errors trips breaker for 30 seconds), exponential jittered retry, token usage accounting, and graceful model fallback.

---

### 2.2 Intelligence Plane

#### 1. Voice AI Subsystem (`platform/services/voice`)
- **Dual Architecture Support**:
  - **Architecture A (Real-Time Speech-to-Speech)**: Direct audio stream exchange via WebSocket/WebRTC with low-latency multimodal voice models. Latency budget: $\le 300\text{ ms}$.
  - **Architecture B (Chained Pipeline)**: Audio Input $\to$ Speech-to-Text (STT) $\to$ Transcript Normalization $\to$ Intent & RAG Retrieval $\to$ LLM Execution $\to$ Text-to-Speech (TTS) $\to$ Audio Output. Latency budget: $\le 800\text{ ms}$.
- **VAD & Barge-In Engine**: Evaluates audio energy and voice probability in 30ms frames. Interruption halts downstream synthesis immediately, preserving consistent turn history.
- **Session State Machine**:
  ```
  CREATED ──► AUTHENTICATED ──► CONNECTING ──► CONNECTED
                                                  │
             ┌────────────────────────────────────┴────────────────────────────────────┐
             ▼                                                                         ▼
         LISTENING ──► PROCESSING ──► RESPONDING ──► (Barge-In) ──► INTERRUPTED ──► LISTENING
             │                                                                         │
             └────────────────────────────────────┬────────────────────────────────────┘
                                                  ▼
                                         ENDING ──► COMPLETED / FAILED
  ```

#### 2. Hybrid RAG Subsystem (`platform/services/rag`)
- **Ingestion Pipeline**: Parses documents (PDF, DOCX, XLSX, TXT, HTML, JSON, Audio transcripts), performs OCR when necessary, extracts metadata, and chunks text via parent-child recursive strategies.
- **Multi-Stage Retrieval Engine**:
  1. Dense semantic search via `pgvector` HNSW index with cosine distance.
  2. Sparse lexical search via PostgreSQL `tsvector` with `ts_rank_cd`.
  3. Rank aggregation via Reciprocal Rank Fusion (RRF, $k=60$).
  4. Cross-encoder semantic reranking selecting top-5 grounded snippets.
- **Strict Grounding Contract**: Models must cite exact document chunk IDs, page numbers, and versions. If retrieved evidence is insufficient, the model must explicitly abstain.

#### 3. Conversational Memory Subsystem (`platform/services/memory`)
- **Short-Term Memory**: Redis-backed active turn context and audio session state.
- **Long-Term Memory**: User preferences, organization policies, and verified company facts.
- **Episodic Memory**: Summarized outcomes of past sales calls, pipeline updates, and deal negotiations.
- **Semantic Memory**: Knowledge base chunks and domain entity graphs.

---

### 2.3 Data Plane

#### 1. PostgreSQL 16 + pgvector (`platform/database`)
- **System of Record**: Stores all relational entities, document chunks, vector embeddings, audit logs, and transactional outbox events.
- **Security**: Hardware Row-Level Security (RLS) enabled on all tenant-owned tables.
- **Index Topology**:
  - B-tree on primary keys, tenant IDs, timestamps, and foreign keys.
  - GIN on `tsvector` document content and JSONB metadata.
  - HNSW (`m=16, ef_construction=64`) on 1536-dimensional vector columns.

#### 2. Redis 7 In-Memory Cluster (`platform/cache`)
- High-performance key-value caching, active voice session coordination, token bucket rate limiting, and BullMQ task queues.

#### 3. Distributed Ingestion & Event Workers (`platform/workers`)
- Transactional Outbox dispatchers, asynchronous document parsing workers, batch embedding generators, and Dead-Letter Queue (DLQ) retry handlers.

---

### 2.4 Operations Plane

#### 1. Observability & SRE (`platform/observability`)
- OpenTelemetry instrumentation injecting W3C trace contexts (`traceparent`) across HTTP headers, WebSocket frames, database queries, and LLM completions.
- Prometheus metrics tracking:
  - Voice: Connection success rate, Time-to-First-Audio (TTFA), turn latency, barge-in rate.
  - RAG: Recall@5, MRR, reranker latency, citation coverage, abstention rate.
  - Database: Query latency (p50, p95, p99), connection pool saturation, lock waits.
  - Pipelines: Queue lag, worker throughput, DLQ failure rate.

---
*Certified by Principal Systems Architect — Hampers by Her Atelier Platform Architecture Baseline Established.*
