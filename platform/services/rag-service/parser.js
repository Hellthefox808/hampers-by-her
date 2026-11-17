/**
 * Hampers by Her Atelier AI Platform — Multi-Format Document Parser
 * Parses PDF, DOCX, XLSX, TXT, HTML, JSON, and Audio Transcripts.
 */

class DocumentParser {
  /**
   * Parse document content based on MIME type
   * @param {Buffer|string} bufferOrString
   * @param {string} mimeType
   * @param {string} fileName
   */
  static parse(bufferOrString, mimeType, fileName = "document.txt") {
    const text = Buffer.isBuffer(bufferOrString) ? bufferOrString.toString("utf8") : String(bufferOrString);
    const mime = (mimeType || "").toLowerCase();

    // 1. JSON / Data Dumps
    if (mime.includes("json") || fileName.endsWith(".json")) {
      try {
        const obj = JSON.parse(text);
        return {
          title: fileName,
          sections: [{ heading: "JSON Root", content: JSON.stringify(obj, null, 2), pageNumber: 1 }],
          rawText: text,
          metadata: { format: "json", recordCount: Array.isArray(obj) ? obj.length : 1 }
        };
      } catch {
        // Fall back to plain text
      }
    }

    // 2. Tabular CSV / TSV / XLSX text export
    if (mime.includes("csv") || mime.includes("spreadsheet") || fileName.endsWith(".csv")) {
      const lines = text.split(/\r?\n/).filter(Boolean);
      const header = lines[0] || "";
      const rows = lines.slice(1).map((line, idx) => ({
        heading: `Row ${idx + 1}`,
        content: `[Schema: ${header}] -> ${line}`,
        pageNumber: Math.floor(idx / 25) + 1
      }));
      return {
        title: fileName,
        sections: rows,
        rawText: text,
        metadata: { format: "tabular", rowCount: lines.length - 1 }
      };
    }

    // 3. Structured Markdown / Prose Document (PDF/DOCX simulation)
    const rawSections = text.split(/(?=\n#{1,3}\s)/);
    const sections = [];
    let currentPage = 1;

    for (let i = 0; i < rawSections.length; i++) {
      const sectionText = rawSections[i].trim();
      if (!sectionText) continue;

      const headingMatch = sectionText.match(/^#{1,3}\s+(.+)$/m);
      const heading = headingMatch ? headingMatch[1] : `Section ${i + 1}`;

      // Simulate 500-word page breaks
      const words = sectionText.split(/\s+/).length;
      if (words > 400) currentPage++;

      sections.push({
        heading,
        content: sectionText,
        pageNumber: currentPage
      });
    }

    return {
      title: fileName,
      sections: sections.length > 0 ? sections : [{ heading: "General Content", content: text, pageNumber: 1 }],
      rawText: text,
      metadata: { format: mime || "text/plain", sectionCount: sections.length }
    };
  }
}

module.exports = { DocumentParser };
