/**
 * Hampers by Her Atelier AI Platform — Shared Contracts & Domain Schemas
 * Strict validation, serialization, and typing contracts.
 */

class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

// 1. Voice Session Contract
class VoiceSessionContract {
  static validate(data) {
    const errors = [];
    if (!data.sessionId || typeof data.sessionId !== "string") errors.push("sessionId string required");
    if (!data.tenantId || typeof data.tenantId !== "string") errors.push("tenantId string required");
    if (!data.userId || typeof data.userId !== "string") errors.push("userId string required");

    const validStates = [
      "CREATED", "AUTHENTICATED", "CONNECTING", "CONNECTED",
      "LISTENING", "PROCESSING", "RESPONDING", "INTERRUPTED",
      "RECONNECTING", "ENDING", "COMPLETED", "FAILED"
    ];
    if (!data.state || !validStates.includes(data.state)) {
      errors.push(`state must be one of: ${validStates.join(", ")}`);
    }

    if (errors.length > 0) throw new ValidationError("Invalid VoiceSession data", errors);
    return {
      sessionId: data.sessionId,
      tenantId: data.tenantId,
      userId: data.userId,
      state: data.state,
      sampleRate: data.sampleRate || 16000,
      format: data.format || "pcm16",
      startedAt: data.startedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: data.metadata || {}
    };
  }
}

// 2. Document & Chunk Contracts
class DocumentChunkContract {
  static validate(data) {
    const errors = [];
    if (!data.chunkId) errors.push("chunkId required");
    if (!data.documentId) errors.push("documentId required");
    if (!data.tenantId) errors.push("tenantId required");
    if (typeof data.content !== "string" || data.content.trim().length === 0) {
      errors.push("content non-empty string required");
    }

    if (errors.length > 0) throw new ValidationError("Invalid DocumentChunk data", errors);
    return {
      chunkId: String(data.chunkId),
      documentId: String(data.documentId),
      tenantId: String(data.tenantId),
      chunkIndex: Number(data.chunkIndex || 0),
      parentChunkId: data.parentChunkId ? String(data.parentChunkId) : null,
      content: String(data.content).trim(),
      metadata: data.metadata || {},
      embedding: Array.isArray(data.embedding) ? data.embedding : null,
      tokenCount: Number(data.tokenCount || 0),
      createdAt: data.createdAt || new Date().toISOString()
    };
  }
}

// 3. Retrieval Query & Result Contracts
class RetrievalQueryContract {
  static validate(data) {
    const errors = [];
    if (!data.tenantId) errors.push("tenantId required");
    if (!data.query || typeof data.query !== "string" || data.query.trim().length === 0) {
      errors.push("query non-empty string required");
    }

    if (errors.length > 0) throw new ValidationError("Invalid RetrievalQuery data", errors);
    return {
      tenantId: String(data.tenantId),
      query: String(data.query).trim(),
      denseLimit: Math.min(Math.max(Number(data.denseLimit || 20), 1), 100),
      sparseLimit: Math.min(Math.max(Number(data.sparseLimit || 20), 1), 100),
      rrfK: Number(data.rrfK || 60),
      rerankTopK: Math.min(Math.max(Number(data.rerankTopK || 5), 1), 20),
      metadataFilter: data.metadataFilter || null
    };
  }
}

// 4. Transactional Outbox Event Contract
class OutboxEventContract {
  static validate(data) {
    const errors = [];
    if (!data.eventId) errors.push("eventId required");
    if (!data.tenantId) errors.push("tenantId required");
    if (!data.aggregateType) errors.push("aggregateType required");
    if (!data.eventType) errors.push("eventType required");

    if (errors.length > 0) throw new ValidationError("Invalid OutboxEvent data", errors);
    return {
      eventId: String(data.eventId),
      tenantId: String(data.tenantId),
      aggregateType: String(data.aggregateType),
      eventType: String(data.eventType),
      payload: data.payload || {},
      status: data.status || "PENDING",
      retryCount: Number(data.retryCount || 0),
      createdAt: data.createdAt || new Date().toISOString()
    };
  }
}

// 5. Tool Invocation Contract
class ToolInvocationContract {
  static validate(data) {
    const errors = [];
    if (!data.toolCallId) errors.push("toolCallId required");
    if (!data.toolName) errors.push("toolName required");
    if (!data.tenantId) errors.push("tenantId required");

    if (errors.length > 0) throw new ValidationError("Invalid ToolInvocation data", errors);
    return {
      toolCallId: String(data.toolCallId),
      toolName: String(data.toolName),
      tenantId: String(data.tenantId),
      arguments: data.arguments || {},
      requiresConfirmation: Boolean(data.requiresConfirmation),
      status: data.status || (data.requiresConfirmation ? "PENDING_CONFIRMATION" : "EXECUTING"),
      createdAt: data.createdAt || new Date().toISOString()
    };
  }
}

module.exports = {
  ValidationError,
  VoiceSessionContract,
  DocumentChunkContract,
  RetrievalQueryContract,
  OutboxEventContract,
  ToolInvocationContract
};
