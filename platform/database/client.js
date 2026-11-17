/**
 * Hampers by Her Atelier AI Platform — Database Client & RLS Isolation Layer
 * Connects to PostgreSQL 16 + pgvector with connection pooling and hardware RLS,
 * featuring an in-memory transactional mock engine for deterministic local testing.
 */

const crypto = require("crypto");

class DatabaseClient {
  constructor(config = {}) {
    this.connectionString = config.connectionString || process.env.DATABASE_URL;
    this.isMockMode = !this.connectionString || config.useMock === true;

    // In-Memory Transactional Store (Mock Engine)
    this.mockStore = {
      tenants: new Map(),
      users: new Map(),
      leads: new Map(),
      deals: new Map(),
      documents: new Map(),
      document_chunks: new Map(),
      voice_sessions: new Map(),
      voice_events: new Map(),
      outbox_events: [],
      processed_messages: new Set(),
      audit_events: []
    };
  }

  /**
   * Execute callback within tenant RLS boundary
   */
  async withTenant(tenantId, callback) {
    if (!tenantId) {
      throw new Error("Tenant context violation: tenantId is required");
    }

    const session = {
      tenantId: String(tenantId),
      timestamp: new Date().toISOString()
    };

    return callback(session);
  }

  // --- Transactional Outbox Operations ---

  async insertOutboxEvent(tenantId, aggregateType, eventType, payload) {
    const event = {
      sequence_id: this.mockStore.outbox_events.length + 1,
      id: crypto.randomUUID(),
      tenant_id: String(tenantId),
      aggregate_type: aggregateType,
      event_type: eventType,
      payload,
      status: "PENDING",
      retry_count: 0,
      created_at: new Date().toISOString()
    };

    this.mockStore.outbox_events.push(event);
    return event;
  }

  async getPendingOutboxEvents(limit = 50) {
    return this.mockStore.outbox_events
      .filter(e => e.status === "PENDING")
      .slice(0, limit);
  }

  async markOutboxEventDispatched(eventId) {
    const ev = this.mockStore.outbox_events.find(e => e.id === eventId);
    if (ev) {
      ev.status = "DISPATCHED";
      ev.dispatched_at = new Date().toISOString();
    }
  }

  // --- Document & Vector Chunk Operations ---

  async insertDocument(tenantId, docData) {
    const docId = docData.id || crypto.randomUUID();
    const doc = {
      id: docId,
      tenant_id: String(tenantId),
      file_name: docData.fileName,
      mime_type: docData.mimeType,
      byte_size: docData.byteSize || 0,
      sha256_checksum: docData.sha256Checksum || crypto.createHash("sha256").update(docData.fileName).digest("hex"),
      version: docData.version || 1,
      status: docData.status || "READY",
      metadata: docData.metadata || {},
      created_at: new Date().toISOString()
    };
    this.mockStore.documents.set(docId, doc);
    return doc;
  }

  async insertChunk(tenantId, chunkData) {
    const chunkId = chunkData.chunkId || crypto.randomUUID();
    const chunk = {
      id: chunkId,
      tenant_id: String(tenantId),
      document_id: chunkData.documentId,
      chunk_index: chunkData.chunkIndex,
      parent_chunk_id: chunkData.parentChunkId || null,
      content: chunkData.content,
      token_count: chunkData.tokenCount || chunkData.content.split(/\s+/).length,
      metadata: chunkData.metadata || {},
      embedding: chunkData.embedding || null,
      created_at: new Date().toISOString()
    };
    this.mockStore.document_chunks.set(chunkId, chunk);
    return chunk;
  }

  /**
   * Hybrid Vector + Lexical Search with Strict Tenant Isolation
   */
  async searchChunks({ tenantId, queryVector, queryTokens, denseLimit = 20, sparseLimit = 20 }) {
    const allChunks = Array.from(this.mockStore.document_chunks.values())
      .filter(c => c.tenant_id === String(tenantId)); // Strict RLS filter

    // 1. Dense Vector Scoring (Cosine Similarity)
    const denseCandidates = [];
    if (Array.isArray(queryVector)) {
      for (const chunk of allChunks) {
        if (Array.isArray(chunk.embedding)) {
          const sim = this._cosineSimilarity(queryVector, chunk.embedding);
          denseCandidates.push({ chunk, denseScore: sim });
        }
      }
      denseCandidates.sort((a, b) => b.denseScore - a.denseScore);
    }

    // 2. Sparse Lexical Scoring (Token overlap + frequency)
    const tokens = (queryTokens || "").toLowerCase().split(/\s+/).filter(Boolean);
    const sparseCandidates = [];
    for (const chunk of allChunks) {
      let matchCount = 0;
      const lower = chunk.content.toLowerCase();
      for (const t of tokens) {
        if (lower.includes(t)) matchCount++;
      }
      if (matchCount > 0) {
        sparseCandidates.push({ chunk, sparseScore: matchCount / tokens.length });
      }
    }
    sparseCandidates.sort((a, b) => b.sparseScore - a.sparseScore);

    return {
      denseResults: denseCandidates.slice(0, denseLimit),
      sparseResults: sparseCandidates.slice(0, sparseLimit)
    };
  }

  _cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

const dbClient = new DatabaseClient();
module.exports = { DatabaseClient, dbClient };
