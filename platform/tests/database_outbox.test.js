/**
 * Hampers by Her Atelier AI Platform — Database & Pipeline Subsystem Test Suite
 * Tests hardware RLS tenant isolation, transactional outbox pattern,
 * durable queue idempotency, bounded retries, and dead-letter queue (DLQ) transitions.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { DatabaseClient } = require("../database/client");
const { DurableQueue } = require("../services/pipeline-service/queue");
const { OutboxDispatcherWorker, DocumentIngestionWorker } = require("../services/pipeline-service/workers");
const { ModelGateway } = require("../services/model-gateway/gateway");

describe("Hampers by Her Database & Pipeline Subsystem", () => {
  describe("DatabaseClient & RLS Isolation", () => {
    test("Executes callback within tenant RLS boundary", async () => {
      const db = new DatabaseClient({ useMock: true });
      const result = await db.withTenant("tenant_alpha", async (session) => {
        return `Bound to ${session.tenantId}`;
      });
      assert.strictEqual(result, "Bound to tenant_alpha");
    });

    test("Rejects execution when tenant context is missing", async () => {
      const db = new DatabaseClient({ useMock: true });
      await assert.rejects(
        () => db.withTenant(null, async () => {}),
        /Tenant context violation: tenantId is required/
      );
    });

    test("Computes cosine similarity correctly", () => {
      const db = new DatabaseClient({ useMock: true });
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];
      const vecOrthogonal = [0, 1, 0];

      assert.strictEqual(db._cosineSimilarity(vec1, vec2), 1.0);
      assert.strictEqual(db._cosineSimilarity(vec1, vecOrthogonal), 0.0);
    });
  });

  describe("Transactional Outbox Pattern", () => {
    test("Inserts outbox event in PENDING state", async () => {
      const db = new DatabaseClient({ useMock: true });
      const ev = await db.insertOutboxEvent("tenant_omega", "DEAL", "DEAL_WON", {
        dealId: "d_99",
        amount: 500000
      });

      assert.strictEqual(ev.tenant_id, "tenant_omega");
      assert.strictEqual(ev.status, "PENDING");
      assert.strictEqual(ev.aggregate_type, "DEAL");
      assert.strictEqual(ev.event_type, "DEAL_WON");
      assert.ok(ev.id);
    });

    test("Fetches pending outbox events and marks them dispatched", async () => {
      const db = new DatabaseClient({ useMock: true });
      const ev = await db.insertOutboxEvent("tenant_omega", "LEAD", "LEAD_QUALIFIED", { leadId: "l_12" });

      const pending = await db.getPendingOutboxEvents(10);
      assert.ok(pending.some(e => e.id === ev.id));

      await db.markOutboxEventDispatched(ev.id);
      const remainingPending = await db.getPendingOutboxEvents(10);
      assert.ok(!remainingPending.some(e => e.id === ev.id));
    });
  });

  describe("DurableQueue & DLQ (At-Least-Once Delivery)", () => {
    test("Enqueues and processes message successfully", async () => {
      const queue = new DurableQueue("test-queue");
      queue.enqueue({ id: "msg_001", payload: { action: "sync_hubspot" } });

      let handled = false;
      const res = await queue.processNext("worker_1", async (payload) => {
        handled = true;
        return { status: "PROCESSED", action: payload.action };
      });

      assert.strictEqual(handled, true);
      assert.strictEqual(res.status, "SUCCESS");
      assert.strictEqual(res.messageId, "msg_001");
      assert.strictEqual(res.attempt, 1);
    });

    test("Enforces idempotency and skips duplicate messages", async () => {
      const queue = new DurableQueue("test-queue-idempotent");
      queue.enqueue({ id: "msg_idemp_1", payload: { task: "billing_invoice" } });

      // First run succeeds
      const res1 = await queue.processNext("worker_1", async () => "ok");
      assert.strictEqual(res1.status, "SUCCESS");

      // Push duplicate message with identical ID
      queue.messages.push({
        messageId: "msg_idemp_1",
        payload: { task: "billing_invoice" },
        attempt: 0
      });

      // Second run must be skipped
      const res2 = await queue.processNext("worker_1", async () => "should not run");
      assert.strictEqual(res2.status, "SKIPPED_DUPLICATE");
      assert.strictEqual(res2.messageId, "msg_idemp_1");
    });

    test("Retries failed message and moves to DLQ after exceeding maxRetries", async () => {
      const queue = new DurableQueue("test-dlq-queue");
      queue.maxRetries = 2; // Test threshold of 2 retries
      queue.enqueue({ id: "poison_msg_1", payload: { badData: true } });

      const failingHandler = async () => {
        throw new Error("Downstream CRM connection timeout");
      };

      // Attempt 1: Should schedule retry
      const attempt1 = await queue.processNext("worker_1", failingHandler);
      assert.strictEqual(attempt1.status, "RETRY_SCHEDULED");
      assert.strictEqual(attempt1.attempt, 1);

      // Attempt 2: Exceeds maxRetries (>= 2), should move to DLQ
      const attempt2 = await queue.processNext("worker_1", failingHandler);
      assert.strictEqual(attempt2.status, "MOVED_TO_DLQ");
      assert.strictEqual(attempt2.dlqSize, 1);

      const dlqItems = queue.getDlqMessages();
      assert.strictEqual(dlqItems.length, 1);
      assert.strictEqual(dlqItems[0].messageId, "poison_msg_1");
      assert.strictEqual(dlqItems[0].finalError, "Downstream CRM connection timeout");
    });
  });

  describe("OutboxDispatcherWorker & DocumentIngestionWorker", () => {
    test("OutboxDispatcherWorker sweeps pending events and queues them", async () => {
      const db = new DatabaseClient({ useMock: true });
      const queue = new DurableQueue("outbox-pipeline");
      const worker = new OutboxDispatcherWorker({ dbClient: db, queue });

      // Insert two outbox events
      await db.insertOutboxEvent("tenant_x", "CONTACT", "CONTACT_CREATED", { name: "John" });
      await db.insertOutboxEvent("tenant_x", "CONTACT", "CONTACT_UPDATED", { name: "John Doe" });

      const sweepResult = await worker.sweep();
      assert.strictEqual(sweepResult.dispatchedCount, 2);
      assert.strictEqual(queue.messages.length, 2);

      // Subsequent sweep finds 0 pending
      const sweep2 = await worker.sweep();
      assert.strictEqual(sweep2.dispatchedCount, 0);
    });

    test("DocumentIngestionWorker parses, chunks, embeds and persists document", async () => {
      const db = new DatabaseClient({ useMock: true });
      const modelGateway = new ModelGateway();
      const worker = new DocumentIngestionWorker({ dbClient: db, modelGateway });

      const rawMarkdown = `# Hampers by Her GTM Playbook\nHigh-touch sales strategies for series B companies.\n\n## Objection Handling\nAddress pricing concerns by demonstrating ROI within 90 days.`;

      const result = await worker.processDocument({
        tenantId: "tenant_corp",
        documentId: "doc_playbook_2026",
        rawContent: rawMarkdown,
        mimeType: "text/markdown",
        fileName: "playbook.md"
      });

      assert.strictEqual(result.documentId, "doc_playbook_2026");
      assert.strictEqual(result.status, "COMPLETED");
      assert.ok(result.sectionsParsed >= 2);
      assert.ok(result.chunksGenerated >= 2);

      // Verify chunks exist in DB under tenant_corp
      const chunks = Array.from(db.mockStore.document_chunks.values())
        .filter(c => c.tenant_id === "tenant_corp");
      assert.strictEqual(chunks.length, result.chunksGenerated);
      assert.ok(chunks.every(c => Array.isArray(c.embedding) && c.embedding.length === 1536));
    });
  });
});
