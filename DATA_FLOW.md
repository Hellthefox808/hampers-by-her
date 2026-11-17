# DATA_FLOW.md — Hampers by Her Atelier Platform End-to-End Data Flows

**Platform:** Hampers by Her Atelier AI Platform  
**Version:** 3.0.0 — Production Engineering Edition  
**Author:** Principal Distributed Systems Engineer & AI Pipeline Architect  
**Date:** November 2026  

---

## 1. Real-Time Voice Conversation Data Flow

```
[User Microphone]
       │
       ▼ (16kHz PCM16 Chunks via WebSocket / WebRTC)
[API & Media Gateway]
       │
       ├──► [Energy & VAD Filter] ── (Detects User Speaking) ──► [If Assistant Active: Emit ABORT Event]
       │                                                                      │
       ▼                                                                      ▼
 [Buffer Window (150ms)]                                          [Halt Active LLM & TTS Streams]
       │
       ▼ (Streaming Audio Delta)
 [Real-Time Voice Engine / STT Worker]
       │
       ├──► Emits partial transcript ──► [Client WebSocket UI]
       ▼
 [Finalized Turn Transcript]
       │
       ▼
 [Intent Detection & Query Extraction]
       │
       ├── (Is Knowledge Required?) ──► YES ──► [Invoke Hybrid RAG Subsystem] ──┐
       │                                                                         │
       ▼ NO                                                                      │
 [LLM Conversational Reasoning with Grounded Evidence] ◄────────────────────────┘
       │
       ▼ (Streaming Token Generation)
 [Sentence Boundary Detector (. ? ! ;)]
       │
       ▼ (Complete Sentences)
 [Text-to-Speech (TTS) Streaming Synthesizer]
       │
       ▼ (Streaming PCM16 / Opus Audio Chunks)
 [Client Audio Stream Player]
```

### Turn Lifecycle & Latency Budget
1. **Audio Ingest**: User audio captured in 30ms PCM16 frames ($960\text{ bytes}$ at 16kHz).
2. **VAD Turn Transition**: Silence timeout ($450\text{ ms}$) triggers end-of-user-turn.
3. **Transcription (STT)**: Whisper / Realtime STT emits finalized transcript within $120\text{ ms}$.
4. **Context Injection**: RAG retrieval executed in parallel within $45\text{ ms}$.
5. **LLM Generation**: Time-to-First-Token (TTFT) $\le 180\text{ ms}$.
6. **TTS Synthesis**: Sentence 1 synthesized and streaming audio dispatched to user within $120\text{ ms}$.
7. **Total Time-to-First-Audio (TTFA)**: $\mathbf{\le 480\text{ ms}}$.

---

## 2. Document Ingestion & Chunking Pipeline Data Flow

```
[User / Source Connector]
       │
       ▼ (HTTP Multipart Upload with Tenant JWT)
[Document Ingress Gateway]
       │
       ├── 1. Validate MIME, Magic Bytes & File Size (<= 50MB)
       ├── 2. Antivirus / Malware Stream Check
       ▼
[PostgreSQL Database Transaction]
       ├── INSERT INTO documents (id, tenant_id, file_name, status='PENDING')
       └── INSERT INTO outbox_events (aggregate_type='DOCUMENT', event_type='DOCUMENT_UPLOADED')
       │
       ▼ COMMIT
[Transactional Outbox Poller]
       │
       ▼ (Push to BullMQ queue: 'document-ingestion')
[Document Ingestion Worker]
       │
       ├── 3. Fetch Raw File from Private S3 Storage (Encrypted via KMS)
       ├── 4. Format-Specific Parser (PDF/DOCX/XLSX/Audio Transcript)
       │       └── Extract text, tables, headers, metadata, page boundaries
       ├── 5. Semantic Chunking Engine
       │       ├── Generate Child Chunks (128 tokens) for vector precision
       │       └── Link to Parent Chunks (512-1024 tokens) for contextual depth
       ├── 6. Deduplication & SHA-256 Content Hashing
       ├── 7. Batch Embedding Generation (OpenAI text-embedding-3-small, 1536 dims)
       ├── 8. Atomic Database Bulk Insert:
       │       ├── INSERT INTO document_chunks (tenant_id, document_id, content, embedding, tsvector)
       │       └── UPDATE documents SET status='READY', indexed_at=NOW()
       ▼
[Publish Event: 'DOCUMENT_INDEXED'] ──► Invalidate Tenant RAG Cache in Redis
```

---

## 3. Hybrid Retrieval & Grounded Generation Data Flow

```
[User Query: "What was the agreed ARR for Deal #HBH-1001 with Apex Corp?"]
       │
       ▼
[Authentication & Tenant Context Validation] (Tenant ID: c4b8e21a-...)
       │
       ▼
[Query Expansion & Entity Normalization]
       ├── Alphanumeric entities extracted: ["HBH-1001", "Apex Corp"]
       └── Query Vector generated: Embed(Query) -> 1536d Float Array
       │
       ├─────────────────────────────────┬─────────────────────────────────┐
       ▼                                 ▼                                 ▼
 [Dense Vector Search]          [Lexical Sparse Search]          [Metadata Exact Filter]
 SELECT chunk_id, cosine_dist   SELECT chunk_id, ts_rank_cd      SELECT chunk_id
 FROM document_chunks           FROM document_chunks             FROM document_chunks
 WHERE tenant_id = :tenant_id   WHERE tenant_id = :tenant_id     WHERE tenant_id = :tenant_id
 ORDER BY embedding <=> :q_vec  AND text_search_vec @@ :q_tokens AND metadata->>'deal_id' = 'HBH-1001'
 LIMIT 30;                      LIMIT 30;                        LIMIT 10;
       │                                 │                                 │
       └─────────────────────────────────┼─────────────────────────────────┘
                                         ▼
                     [Reciprocal Rank Fusion (RRF, k=60)]
                                         │
                                         ▼ Top 20 Candidates
                     [Cross-Encoder Semantic Reranker]
                                         │
                                         ▼ Top 5 Grounded Evidence Chunks
                     [Citation Verification & ACL Check]
                                         │
                                         ▼
                     [Grounded LLM Prompt Assembly]
     <system_instruction> Answer strictly using supplied evidence </system_instruction>
     <context_evidence>
       [Chunk doc_81a_p2] Source: Master_Agreement.pdf, Page 4: "Agreed ARR: $120,000"
     </context_evidence>
     <user_query> What was the agreed ARR for Deal #HBH-1001 with Apex Corp? </user_query>
                                         │
                                         ▼
 [Streaming Response: "The agreed ARR for Deal #HBH-1001 is $120,000 [Source: Master_Agreement.pdf, Page 4]."]
```

---

## 4. Transactional Outbox & Background Processing Flow

```
[Client Mutation API (e.g. POST /api/leads)]
       │
       ▼
[PostgreSQL ACID Transaction]
       ├── INSERT INTO leads (id, tenant_id, name, email, company, status)
       └── INSERT INTO outbox_events (id, tenant_id, aggregate_type, event_type, payload)
       │
       ▼ COMMIT
[Outbox Dispatcher Daemon]
       ├── SELECT * FROM outbox_events WHERE status = 'PENDING' ORDER BY sequence_id LIMIT 100 FOR UPDATE SKIP LOCKED;
       ├── Push events into Redis BullMQ Queues
       └── UPDATE outbox_events SET status = 'DISPATCHED', dispatched_at = NOW();
       │
       ▼
[Distributed Consumer Worker]
       ├── Check Idempotency: SELECT 1 FROM processed_messages WHERE message_id = :id;
       ├── Execute Processing: Lead enrichment, CRM webhook notification, signal calculation
       ├── Record Idempotency: INSERT INTO processed_messages (message_id, processed_at)
       └── On Transient Error: Retry with exponential backoff (Max 5 attempts)
       └── On Exhausted Retries: Move to Dead-Letter Queue (DLQ) & Alert SRE
```

---
*Document approved by Principal Distributed Systems Engineer — Hampers by Her Atelier Platform Data Flows Verified.*
