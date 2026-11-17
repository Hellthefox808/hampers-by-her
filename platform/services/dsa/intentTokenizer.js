/**
 * HAMPERS BY HER — FACETED SEARCH, COLLOQUIAL INTENT TOKENIZER & TRIGRAM RANKER
 * 
 * Formal Specification Reference: 39_DSA.md Section 7.4 (Algorithm 4)
 * Linear-time O(M) ReDoS-safe tokenizer with Trigram fuzzy ranking.
 * Time Complexity: O(M + K log K)
 * Space Complexity: O(M + K)
 */

const OCCASION_PATTERNS = [
  { occasion: "WEDDING", keywords: ["wedding", "shaadi", "marriage", "bridal", "groom", "nikah", "trousseau", "haldi", "mehendi"] },
  { occasion: "ANNIVERSARY", keywords: ["anniversary", "milestone", "jubilee", "years together"] },
  { occasion: "BIRTHDAY", keywords: ["birthday", "bday", "born day", "turning"] },
  { occasion: "CORPORATE", keywords: ["corporate", "client", "employee", "onboarding", "business", "colleague gift", "bulk"] },
  { occasion: "FESTIVE", keywords: ["diwali", "eid", "christmas", "rakhi", "raksha bandhan", "new year", "festive", "festivity"] },
  { occasion: "VALENTINES", keywords: ["valentine", "romantic", "romance", "date night", "love"] },
  { occasion: "HOUSEWARMING", keywords: ["housewarming", "new home", "griha pravesh"] },
  { occasion: "BABY_SHOWER", keywords: ["baby shower", "newborn", "maternity", "mom to be"] }
];

const RECIPIENT_PATTERNS = [
  { recipient: "SISTER", keywords: ["sister", "sis"] },
  { recipient: "MOTHER", keywords: ["mother", "mom", "mummy", "maa"] },
  { recipient: "FATHER", keywords: ["father", "dad", "papa"] },
  { recipient: "BROTHER", keywords: ["brother", "bro"] },
  { recipient: "WIFE", keywords: ["wife", "fiancee", "girlfriend", "gf"] },
  { recipient: "HUSBAND", keywords: ["husband", "fiance", "boyfriend", "bf"] },
  { recipient: "FRIEND", keywords: ["friend", "bestie", "buddy"] },
  { recipient: "COLLEAGUE", keywords: ["colleague", "coworker", "boss", "manager", "client"] },
  { recipient: "COUPLE", keywords: ["couple", "bride and groom", "parents", "them"] },
  { recipient: "HER", keywords: ["for her", "her", "women", "girl"] },
  { recipient: "HIM", keywords: ["for him", "him", "men", "boy"] }
];

const LUXURY_KEYWORDS = [
  "luxury", "royal", "exclusive", "premium", "bespoke", "artisan", "handcrafted", "signature", "gourmet", "velvet", "curated"
];

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "with", "from", "by", "about",
  "as", "into", "like", "through", "after", "over", "between", "out", "against", "during", "without",
  "before", "under", "around", "among", "i", "me", "my", "we", "our", "you", "your", "he", "him",
  "she", "her", "they", "them", "what", "which", "who", "whom", "this", "that", "these", "those",
  "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "need", "want", "looking", "give", "gift", "gifts", "hamper", "hampers", "box", "boxes"
]);

/**
 * Normalizes colloquial price strings ("5k", "3.5k", "4000") to integer paise
 * @param {string} rawVal
 * @returns {bigint|null}
 */
function parsePriceToPaise(rawVal) {
  if (!rawVal) return null;
  const cleaned = rawVal.replace(/[₹,\s]/g, "").toLowerCase();
  
  if (cleaned.endsWith("k")) {
    const num = parseFloat(cleaned.slice(0, -1));
    if (!Number.isNaN(num) && num > 0) {
      return BigInt(Math.floor(num * 1000 * 100));
    }
  }

  const num = parseFloat(cleaned);
  if (!Number.isNaN(num) && num > 0) {
    return BigInt(Math.floor(num * 100));
  }

  return null;
}

/**
 * Tokenizes raw query and extracts structured search facets in linear time O(M)
 * @param {string} rawQuery
 * @returns {Object} StructuredSearchIntent
 */
function tokenizeSearchIntent(rawQuery) {
  if (!rawQuery || typeof rawQuery !== "string") {
    return {
      occasion: null,
      recipient: null,
      maxPricePaise: null,
      minPricePaise: null,
      isLuxury: false,
      keywords: [],
      rawQuery: ""
    };
  }

  const normalized = rawQuery.toLowerCase().trim();

  // 1. Extract Price Bounds using safe non-backtracking patterns
  let maxPricePaise = null;
  let minPricePaise = null;

  // Max price matches: "under 4000", "below 5k", "less than 3000", "budget 2500"
  const maxPriceMatch = normalized.match(/(?:under|below|less\s+than|budget|within|up\s+to)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?k?)/);
  if (maxPriceMatch) {
    maxPricePaise = parsePriceToPaise(maxPriceMatch[1]);
  }

  // Min price matches: "above 2000", "more than 1500", "starting from 3k"
  const minPriceMatch = normalized.match(/(?:above|over|more\s+than|starting\s+from|min)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?k?)/);
  if (minPriceMatch) {
    minPricePaise = parsePriceToPaise(minPriceMatch[1]);
  }

  // 2. Extract Occasion
  let detectedOccasion = null;
  for (const group of OCCASION_PATTERNS) {
    for (const kw of group.keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, "i");
      if (regex.test(normalized)) {
        detectedOccasion = group.occasion;
        break;
      }
    }
    if (detectedOccasion) break;
  }

  // 3. Extract Recipient
  let detectedRecipient = null;
  for (const group of RECIPIENT_PATTERNS) {
    for (const kw of group.keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, "i");
      if (regex.test(normalized)) {
        detectedRecipient = group.recipient;
        break;
      }
    }
    if (detectedRecipient) break;
  }

  // 4. Extract Luxury Intent Flag
  let isLuxury = false;
  for (const kw of LUXURY_KEYWORDS) {
    if (normalized.includes(kw)) {
      isLuxury = true;
      break;
    }
  }

  // 5. Extract Meaningful Keywords (stripping stop words and punctuation)
  const tokens = normalized
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));

  return {
    occasion: detectedOccasion,
    recipient: detectedRecipient,
    maxPricePaise,
    minPricePaise,
    isLuxury,
    keywords: Array.from(new Set(tokens)),
    rawQuery
  };
}

/**
 * Generates character 3-grams for fuzzy string ranking
 * @param {string} str
 * @returns {Set<string>}
 */
function generateTrigrams(str) {
  const trigrams = new Set();
  if (!str || str.length < 3) {
    if (str) trigrams.add(str.toLowerCase());
    return trigrams;
  }
  const padded = `  ${str.toLowerCase()} `;
  for (let i = 0; i < padded.length - 2; i++) {
    trigrams.add(padded.slice(i, i + 3));
  }
  return trigrams;
}

/**
 * Computes Jaccard Trigram Similarity between two strings (0.0 to 1.0)
 * @param {string} strA
 * @param {string} strB
 * @returns {number}
 */
function computeTrigramSimilarity(strA, strB) {
  if (!strA || !strB) return 0.0;
  if (strA.toLowerCase() === strB.toLowerCase()) return 1.0;

  const triA = generateTrigrams(strA);
  const triB = generateTrigrams(strB);

  let intersectionCount = 0;
  for (const tri of triA) {
    if (triB.has(tri)) {
      intersectionCount++;
    }
  }

  const unionCount = triA.size + triB.size - intersectionCount;
  if (unionCount === 0) return 0.0;

  return Number((intersectionCount / unionCount).toFixed(4));
}

/**
 * Ranks an array of catalog items against a query string using Trigram Fuzzy Matching
 * @param {Array<Object>} items
 * @param {string} query
 * @param {number} [threshold=0.2]
 * @returns {Array<Object>} Sorted items with similarity scores
 */
function rankItemsByFuzzyQuery(items, query, threshold = 0.2) {
  if (!Array.isArray(items) || !query) return items;

  const intent = tokenizeSearchIntent(query);
  const scored = [];

  for (const item of items) {
    const titleSim = computeTrigramSimilarity(item.title || item.name || "", query);
    const descSim = computeTrigramSimilarity(item.description || "", query);
    const occasionMatch = intent.occasion && item.occasion && item.occasion.toUpperCase() === intent.occasion ? 0.35 : 0.0;
    const recipientMatch = intent.recipient && item.recipient && item.recipient.toUpperCase() === intent.recipient ? 0.25 : 0.0;

    const compositeScore = (titleSim * 0.5) + (descSim * 0.2) + occasionMatch + recipientMatch;

    if (compositeScore >= threshold || titleSim >= 0.3) {
      scored.push({
        item,
        score: Number(compositeScore.toFixed(4)),
        titleSimilarity: titleSim
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => ({ ...s.item, _searchScore: s.score }));
}

module.exports = {
  OCCASION_PATTERNS,
  RECIPIENT_PATTERNS,
  tokenizeSearchIntent,
  generateTrigrams,
  computeTrigramSimilarity,
  rankItemsByFuzzyQuery
};
