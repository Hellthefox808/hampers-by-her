/**
 * Hampers by Her Atelier AI Platform — Background Ingestion & Outbox Workers
 * Asynchronously processes Outbox events and executes multi-stage document pipelines.
 */

const { DocumentParser } = require("../rag-service/parser");
const { SemanticChunker } = require("../rag-service/chunker");

class OutboxDispatcherWorker {
  constructor({ dbClient, queue }) {
    this.dbClient = dbClient;
    this.queue = queue;
    this.isPolling = false;
  }

  /**
   * Run single outbox dispatch sweep
   */
  async sweep() {
    const pending = await this.dbClient.getPendingOutboxEvents(50);
    const dispatched = [];

    for (const ev of pending) {
      this.queue.enqueue({
        id: ev.id,
        payload: ev
      });
      await this.dbClient.markOutboxEventDispatched(ev.id);
      dispatched.push(ev.id);
    }

    return {
      dispatchedCount: dispatched.length,
      eventIds: dispatched
    };
  }
}

class DocumentIngestionWorker {
  constructor({ dbClient, modelGateway, chunker = new SemanticChunker() }) {
    this.dbClient = dbClient;
    this.modelGateway = modelGateway;
    this.chunker = chunker;
  }

  /**
   * Process raw document file into parsed, chunked, and embedded records
   */
  async processDocument({ tenantId, documentId, rawContent, mimeType, fileName }) {
    // 1. Parsing
    const parsed = DocumentParser.parse(rawContent, mimeType, fileName);

    // 2. Semantic Chunking
    const chunks = this.chunker.chunk(parsed, documentId, tenantId);

    // 3. Batch Embedding Generation & DB Storage
    const storedChunks = [];
    for (const c of chunks) {
      const embedding = this.modelGateway
        ? await this.modelGateway.generateEmbedding(c.content)
        : null;

      const stored = await this.dbClient.insertChunk(tenantId, {
        chunkId: c.chunkId,
        documentId,
        chunkIndex: c.chunkIndex,
        parentChunkId: c.parentChunkId,
        content: c.content,
        tokenCount: c.tokenCount,
        metadata: c.metadata,
        embedding
      });
      storedChunks.push(stored);
    }

    return {
      documentId,
      sectionsParsed: parsed.sections.length,
      chunksGenerated: storedChunks.length,
      status: "COMPLETED"
    };
  }
}

module.exports = {
  OutboxDispatcherWorker,
  DocumentIngestionWorker
};
