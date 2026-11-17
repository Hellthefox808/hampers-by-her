/**
 * Hampers by Her Atelier AI Platform — Semantic & Parent-Child Chunker
 * Chunks structured text with controlled overlap, token limits, and parent-child linking.
 */

const crypto = require("crypto");

class SemanticChunker {
  constructor(options = {}) {
    this.childTokenLimit = options.childTokenLimit || 128;
    this.parentTokenLimit = options.parentTokenLimit || 512;
    this.overlapTokens = options.overlapTokens || 20;
  }

  /**
   * Chunk parsed document into parent-child hierarchy
   * @param {Object} parsedDocument
   * @param {string} documentId
   * @param {string} tenantId
   * @returns {Array} Array of DocumentChunk objects
   */
  chunk(parsedDocument, documentId, tenantId) {
    const chunks = [];
    let chunkIndex = 0;

    for (const section of parsedDocument.sections) {
      const words = section.content.split(/\s+/).filter(Boolean);
      if (words.length === 0) continue;

      // 1. Create Parent Chunk for this section / window
      const parentChunkId = `parent_${documentId}_sec_${chunkIndex}`;
      const parentContent = words.slice(0, this.parentTokenLimit).join(" ");

      chunks.push({
        chunkId: parentChunkId,
        documentId,
        tenantId,
        chunkIndex: chunkIndex++,
        parentChunkId: null,
        isParent: true,
        content: `[Heading: ${section.heading}] (Page ${section.pageNumber})\n${parentContent}`,
        tokenCount: Math.min(words.length, this.parentTokenLimit),
        metadata: {
          heading: section.heading,
          pageNumber: section.pageNumber,
          isParent: true
        }
      });

      // 2. Generate Child Chunks linked to this Parent
      let start = 0;
      while (start < words.length) {
        const end = Math.min(start + this.childTokenLimit, words.length);
        const childWords = words.slice(start, end);
        const childContent = childWords.join(" ");
        const childId = `chunk_${documentId}_${chunkIndex}`;

        chunks.push({
          chunkId: childId,
          documentId,
          tenantId,
          chunkIndex: chunkIndex++,
          parentChunkId: parentChunkId,
          isParent: false,
          content: `[${section.heading} | Page ${section.pageNumber}]: ${childContent}`,
          tokenCount: childWords.length,
          metadata: {
            heading: section.heading,
            pageNumber: section.pageNumber,
            isParent: false,
            parentChunkId
          }
        });

        if (end >= words.length) break;
        start += (this.childTokenLimit - this.overlapTokens);
      }
    }

    return chunks;
  }
}

module.exports = { SemanticChunker };
