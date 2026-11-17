/**
 * Hampers by Her Atelier AI Platform — Hybrid RAG Subsystem Test Suite
 * Tests multi-format document parsing, semantic parent-child chunking, dense+sparse RRF retrieval,
 * strict multi-tenant isolation, and citation grounding verification.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { DocumentParser } = require("../services/rag-service/parser");
const { SemanticChunker } = require("../services/rag-service/chunker");
const { HybridRetriever } = require("../services/rag-service/hybridRetriever");
const { CitationEngine } = require("../services/rag-service/citationEngine");
const { DatabaseClient } = require("../database/client");
const { ModelGateway } = require("../services/model-gateway/gateway");

describe("Hampers by Her Hybrid RAG Subsystem", () => {
  describe("DocumentParser (Multi-Format Extraction)", () => {
    test("Parses JSON structured payloads", () => {
      const jsonPayload = JSON.stringify([
        { leadId: "L001", company: "Acme Corp", arr: 120000 },
        { leadId: "L002", company: "Globex Inc", arr: 250000 }
      ]);
      const parsed = DocumentParser.parse(jsonPayload, "application/json", "leads.json");

      assert.strictEqual(parsed.title, "leads.json");
      assert.strictEqual(parsed.metadata.format, "json");
      assert.strictEqual(parsed.metadata.recordCount, 2);
      assert.ok(parsed.sections[0].content.includes("Acme Corp"));
    });

    test("Parses Tabular CSV exports preserving schema header", () => {
      const csvData = "DealName,Stage,Value\nEnterprise Cloud,Proposal,50000\nSecurity Suite,Negotiation,120000";
      const parsed = DocumentParser.parse(csvData, "text/csv", "deals.csv");

      assert.strictEqual(parsed.metadata.format, "tabular");
      assert.strictEqual(parsed.metadata.rowCount, 2);
      assert.strictEqual(parsed.sections.length, 2);
      assert.ok(parsed.sections[0].content.includes("[Schema: DealName,Stage,Value]"));
      assert.ok(parsed.sections[0].content.includes("Enterprise Cloud"));
    });

    test("Parses Markdown text and segments by headings with simulated pagination", () => {
      const markdown = `# Architecture Overview\nHampers by Her operates an event-driven AI platform with PostgreSQL 16.\n\n## Vector Storage\npgvector provides HNSW indexes for sub-15ms semantic similarity search.`;
      const parsed = DocumentParser.parse(markdown, "text/markdown", "architecture.md");

      assert.strictEqual(parsed.sections.length, 2);
      assert.strictEqual(parsed.sections[0].heading, "Architecture Overview");
      assert.strictEqual(parsed.sections[1].heading, "Vector Storage");
      assert.strictEqual(parsed.sections[0].pageNumber, 1);
    });
  });

  describe("SemanticChunker (Parent-Child Hierarchy)", () => {
    test("Chunks parsed documents into linked parent and child units", () => {
      const chunker = new SemanticChunker({
        childTokenLimit: 15,
        parentTokenLimit: 60,
        overlapTokens: 5
      });

      const parsedDoc = {
        title: "gtm_strategy.md",
        sections: [
          {
            heading: "Outreach Strategy",
            pageNumber: 1,
            content: "We focus on enterprise accounts with over five hundred employees. Outbound sequences combine email, LinkedIn social touches, and phone follow-ups."
          }
        ]
      };

      const chunks = chunker.chunk(parsedDoc, "doc_gtm_strat", "tenant_alpha");
      assert.ok(chunks.length >= 2);

      const parent = chunks.find(c => c.isParent);
      const children = chunks.filter(c => !c.isParent);

      assert.ok(parent);
      assert.strictEqual(parent.chunkId, "parent_doc_gtm_strat_sec_0");
      assert.strictEqual(parent.parentChunkId, null);
      assert.strictEqual(parent.metadata.isParent, true);

      assert.ok(children.length >= 1);
      for (const child of children) {
        assert.strictEqual(child.parentChunkId, parent.chunkId);
        assert.strictEqual(child.metadata.heading, "Outreach Strategy");
        assert.strictEqual(child.metadata.pageNumber, 1);
      }
    });
  });

  describe("HybridRetriever (Dense + Sparse + RRF + Tenant Isolation)", () => {
    test("Performs RRF fusion and reranks top matching chunks", async () => {
      const dbClient = new DatabaseClient({ useMock: true });
      const modelGateway = new ModelGateway();
      const retriever = new HybridRetriever({ dbClient, modelGateway });

      // Ingest chunks for tenant_alpha
      const vectorA = await modelGateway.generateEmbedding("PostgreSQL vector search and pgvector indexing");
      const vectorB = await modelGateway.generateEmbedding("Voice AI and speech recognition pipeline");

      await dbClient.insertChunk("tenant_alpha", {
        chunkId: "chk_db_01",
        documentId: "doc_infra",
        content: "Hampers by Her relies on PostgreSQL pgvector with HNSW index for ultra-low latency hybrid search.",
        embedding: vectorA
      });

      await dbClient.insertChunk("tenant_alpha", {
        chunkId: "chk_voice_01",
        documentId: "doc_voice",
        content: "The voice AI subsystem supports real-time full-duplex WebRTC conversations with barge-in.",
        embedding: vectorB
      });

      const results = await retriever.retrieve({
        tenantId: "tenant_alpha",
        query: "How does PostgreSQL vector search work?",
        denseLimit: 5,
        sparseLimit: 5,
        rerankTopK: 2
      });

      assert.strictEqual(results.tenantId, "tenant_alpha");
      assert.ok(results.fusedResults.length > 0);

      // chk_db_01 should rank highest due to dense similarity and keyword overlap
      const topResult = results.fusedResults[0];
      assert.strictEqual(topResult.chunk.id, "chk_db_01");
      assert.ok(topResult.rerankScore > 0);
      assert.ok(topResult.rrfScore > 0);
    });

    test("Enforces hardware multi-tenant isolation: Tenant B cannot retrieve Tenant A data", async () => {
      const dbClient = new DatabaseClient({ useMock: true });
      const modelGateway = new ModelGateway();
      const retriever = new HybridRetriever({ dbClient, modelGateway });

      const vectorSecret = await modelGateway.generateEmbedding("Confidential strategic merger plans for Tenant A");
      await dbClient.insertChunk("tenant_confidential_a", {
        chunkId: "chk_secret_a",
        documentId: "doc_classified",
        content: "Top secret acquisition of target firm X for $50M cash.",
        embedding: vectorSecret
      });

      // Tenant B queries the exact same topic
      const queryVector = await modelGateway.generateEmbedding("acquisition of target firm X cash");
      const resultsTenantB = await retriever.retrieve({
        tenantId: "tenant_isolated_b",
        query: "What is the acquisition deal value?",
        denseLimit: 10,
        sparseLimit: 10
      });

      assert.strictEqual(resultsTenantB.denseCount, 0);
      assert.strictEqual(resultsTenantB.sparseCount, 0);
      assert.strictEqual(resultsTenantB.fusedResults.length, 0);
    });

    test("Throws error if tenantId is omitted", async () => {
      const retriever = new HybridRetriever();
      await assert.rejects(
        () => retriever.retrieve({ query: "Test query" }),
        /Tenant isolation violation: tenantId required/
      );
    });
  });

  describe("CitationEngine (Evidence Blocks & Grounding Verification)", () => {
    test("Formats context evidence block correctly", () => {
      const mockResults = [
        {
          chunk: {
            id: "chk_001",
            document_id: "doc_q3_report",
            content: "Q3 ARR reached $3.4M representing 45% YoY growth.",
            metadata: { pageNumber: 4 }
          }
        }
      ];

      const block = CitationEngine.formatEvidenceBlock(mockResults);
      assert.ok(block.startsWith("<context_evidence>"));
      assert.ok(block.endsWith("</context_evidence>"));
      assert.ok(block.includes("[Citation 1 | Chunk chk_001 | Doc doc_q3_report | Page 4]"));
      assert.ok(block.includes("Q3 ARR reached $3.4M"));
    });

    test("Returns empty placeholder if no evidence is found", () => {
      const block = CitationEngine.formatEvidenceBlock([]);
      assert.strictEqual(block, "<context_evidence>\n[NO RELEVANT EVIDENCE FOUND]\n</context_evidence>");
    });

    test("Verifies valid citations and flags hallucinated chunk IDs", () => {
      const mockResults = [
        { chunk: { id: "chk_valid_1", document_id: "doc_1" } },
        { chunk: { id: "chk_valid_2", document_id: "doc_2" } }
      ];

      const validAnswer = "Revenue grew significantly [Chunk chk_valid_1] and retention remained at 98% [Chunk chk_valid_2].";
      const validCheck = CitationEngine.verifyCitations(validAnswer, mockResults);

      assert.strictEqual(validCheck.isGrounded, true);
      assert.strictEqual(validCheck.totalCitations, 2);
      assert.strictEqual(validCheck.invalidCitations.length, 0);

      const hallucinatedAnswer = "Revenue was $10M [Chunk chk_fake_999].";
      const fakeCheck = CitationEngine.verifyCitations(hallucinatedAnswer, mockResults);

      assert.strictEqual(fakeCheck.isGrounded, false);
      assert.strictEqual(fakeCheck.invalidCitations.length, 1);
      assert.strictEqual(fakeCheck.invalidCitations[0], "chk_fake_999");
    });

    test("Generates explicit refusal when query lacks grounded evidence", () => {
      const abstention = CitationEngine.generateAbstention("Internal compensation matrices");
      assert.ok(abstention.includes('no verified evidence was found regarding "Internal compensation matrices"'));
      assert.ok(abstention.includes("I cannot answer without verified documentation"));
    });
  });
});
