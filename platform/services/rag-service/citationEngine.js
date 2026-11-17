/**
 * Hampers by Her Atelier AI Platform — RAG Citation & Grounding Engine
 * Enforces verifiable source citations and prevents hallucinated claims.
 */

class CitationEngine {
  /**
   * Format retrieved chunks into an isolated evidence block
   */
  static formatEvidenceBlock(retrievedResults) {
    if (!retrievedResults || retrievedResults.length === 0) {
      return "<context_evidence>\n[NO RELEVANT EVIDENCE FOUND]\n</context_evidence>";
    }

    const items = retrievedResults.map((r, i) => {
      const c = r.chunk;
      const meta = c.metadata || {};
      return `[Citation ${i + 1} | Chunk ${c.id} | Doc ${c.document_id} | Page ${meta.pageNumber || 1}]:\n${c.content}`;
    });

    return `<context_evidence>\n${items.join("\n\n")}\n</context_evidence>`;
  }

  /**
   * Verify that an answer's citations point to real retrieved chunks
   */
  static verifyCitations(answerText, retrievedResults) {
    const validChunkIds = new Set(retrievedResults.map(r => r.chunk.id));
    const citationMatches = answerText.match(/\[Chunk\s+([a-zA-Z0-9_-]+)\]/g) || [];

    const verified = [];
    const invalid = [];

    for (const match of citationMatches) {
      const idMatch = match.match(/\[Chunk\s+([a-zA-Z0-9_-]+)\]/);
      if (idMatch && idMatch[1]) {
        const id = idMatch[1];
        if (validChunkIds.has(id)) {
          verified.push(id);
        } else {
          invalid.push(id);
        }
      }
    }

    const isGrounded = invalid.length === 0 && (verified.length > 0 || retrievedResults.length === 0);

    return {
      isGrounded,
      totalCitations: citationMatches.length,
      verifiedCitations: verified,
      invalidCitations: invalid
    };
  }

  /**
   * Produce explicit abstention when evidence is insufficient
   */
  static generateAbstention(queryTopic) {
    return `Based on the authorized enterprise documentation currently indexed for your tenant, no verified evidence was found regarding "${queryTopic}". To maintain strict accuracy, I cannot answer without verified documentation.`;
  }
}

module.exports = { CitationEngine };
