/**
 * Hampers by Her Atelier AI Platform — Hybrid RAG Retrieval Engine
 * Dense Vector + Sparse Lexical + Reciprocal Rank Fusion (RRF) + Cross-Encoder Reranker.
 */

class HybridRetriever {
  constructor({ dbClient, modelGateway } = {}) {
    this.dbClient = dbClient;
    this.modelGateway = modelGateway;
    this.rrfK = 60; // Standard reciprocal rank fusion smoothing constant
  }

  /**
   * Execute Hybrid Retrieval Pipeline with Strict Tenant Isolation
   * @param {Object} queryOptions
   */
  async retrieve({ tenantId, query, denseLimit = 20, sparseLimit = 20, rerankTopK = 5 }) {
    if (!tenantId) throw new Error("Tenant isolation violation: tenantId required");
    if (!query || typeof query !== "string") throw new Error("Valid query string required");

    // 1. Generate Query Embedding
    const queryVector = this.modelGateway
      ? await this.modelGateway.generateEmbedding(query)
      : null;

    // 2. Parallel Dense & Sparse Search in Database
    const { denseResults, sparseResults } = await this.dbClient.searchChunks({
      tenantId,
      queryVector,
      queryTokens: query,
      denseLimit,
      sparseLimit
    });

    // 3. Reciprocal Rank Fusion (RRF)
    const rrfMap = new Map();

    // Score Dense Ranks
    denseResults.forEach((item, rank) => {
      const id = item.chunk.id;
      const rrfScore = 1.0 / (this.rrfK + (rank + 1));
      rrfMap.set(id, {
        chunk: item.chunk,
        denseRank: rank + 1,
        sparseRank: null,
        rrfScore
      });
    });

    // Score Sparse Ranks
    sparseResults.forEach((item, rank) => {
      const id = item.chunk.id;
      const additionalScore = 1.0 / (this.rrfK + (rank + 1));
      if (rrfMap.has(id)) {
        const existing = rrfMap.get(id);
        existing.sparseRank = rank + 1;
        existing.rrfScore += additionalScore;
      } else {
        rrfMap.set(id, {
          chunk: item.chunk,
          denseRank: null,
          sparseRank: rank + 1,
          rrfScore: additionalScore
        });
      }
    });

    // Sort by RRF score descending
    const fusedList = Array.from(rrfMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, 20); // Top 20 candidate pool

    // 4. Semantic Reranker (Cross-Encoder simulation)
    const reranked = fusedList.map(item => {
      const queryLower = query.toLowerCase();
      const contentLower = item.chunk.content.toLowerCase();
      let semanticBoost = 0;

      // Exact phrase match boost
      if (contentLower.includes(queryLower)) semanticBoost += 0.4;
      // Key token match density
      const qTokens = queryLower.split(/\s+/).filter(Boolean);
      let matchCount = 0;
      for (const t of qTokens) {
        if (contentLower.includes(t)) matchCount++;
      }
      semanticBoost += (matchCount / Math.max(1, qTokens.length)) * 0.3;

      const finalScore = parseFloat((item.rrfScore + semanticBoost).toFixed(5));
      return {
        ...item,
        rerankScore: finalScore
      };
    });

    reranked.sort((a, b) => b.rerankScore - a.rerankScore);
    const topResults = reranked.slice(0, rerankTopK);

    return {
      query,
      tenantId,
      denseCount: denseResults.length,
      sparseCount: sparseResults.length,
      fusedCount: fusedList.length,
      topCount: topResults.length,
      fusedResults: topResults
    };
  }
}

module.exports = { HybridRetriever };
