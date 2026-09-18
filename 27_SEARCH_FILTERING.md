<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 27_SEARCH_FILTERING.md — Discovery, Search Engine & Multi-Faceted Filtering Architecture

## 1. Purpose
This document establishes the catalog discovery, search indexing, typo-tolerance algorithms, and multi-faceted filtering architecture for **Hampers by Her**. Gifting shoppers possess distinctly multi-dimensional search intents: users rarely search for exact SKUs; instead, queries reflect occasions (*"birthday hamper for sister"*), budget thresholds (*"gifts under 1500"*), aesthetics (*"pastel luxury bridal box"*), or dietary/personal preferences (*"eggless chocolate gourmet basket"*). This specification details how PostgreSQL Full-Text Search (FTS) combined with `pg_trgm` (trigram similarity) and Redis faceted caching delivers sub-100ms discovery without premature operational infrastructure bloat.

## 2. Scope
- **In-Scope**:
  - PostgreSQL native Full-Text Search with `tsvector`, `tsquery`, and GIN indexing.
  - Typo tolerance and fuzzy string matching via `pg_trgm` trigram extension.
  - Multi-faceted filtering: Occasion, Recipient, Budget Range, Color Theme, Customization Level, and In-Stock status.
  - Multi-token intent parser extracting budgets (e.g., *"under 2000"*) and occasions (*"anniversary"*) from unstructured search strings.
  - Facet count aggregation algorithms.
  - Client-side optimistic debounced search (300ms) with instant autocomplete.
  - Search analytics tracking (zero-result rate, top queries, click-through rates).
- **Out-of-Scope**:
  - Operating an external Elasticsearch or OpenSearch cluster in MVP (deferred until catalog exceeds 5,000 SKUs).

## 3. Context
Gifting customers experience decision paralysis when faced with unfiltered product walls. The search and filtering engine serves as an active concierge: helping users immediately narrow down hundreds of possibilities into 4–8 emotionally aligned choices within three clicks or taps on mobile screens.

```
[Customer Search Query: "anniversary hamper under 3000"]
       │
       ▼
[Query Intent Tokenizer]
       ├── Occasion Detected: "ANNIVERSARY"
       ├── Max Price Filter: 300000 Paise (₹3,000)
       └── Remainder Search Term: "hamper"
       │
       ▼
[PostgreSQL tsvector & pg_trgm GIN Indexes]
       │ (Weighted matching: Title: A, Tags: B, Description: C)
       ▼
[Filtered Product IDs + Dynamic Facet Counts]
       │
       ▼ (Cached in Redis: "search:anniversary:under3000")
[Next.js Storefront Responsive Grid]
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-SRCH-01**: Instant Autocomplete: Return top 5 product suggestions and matching collections within 100ms as the user types in the mobile search bar.
- **FR-SRCH-02**: Fuzzy Typo Tolerance: Accurately match queries with up to 2 transposed or misspelled characters (e.g., *"aniversary"*, *"hampr"*, *"diwali"*).
- **FR-SRCH-03**: Intent Extraction: Automatically parse colloquial budget phrases (*"under 1500"*, *"below 2k"*, *"between 2000 and 4000"*) into numeric SQL `WHERE price_paise <= :max` filters.
- **FR-SRCH-04**: Dynamic Facet Generation: Provide accurate item counts for each filter option (e.g., `Birthday (14)`, `Wedding (8)`, `Self Care (6)`) reflecting the active search scope.
- **FR-SRCH-05**: Synonym Resolution: Map common colloquial terms to canonical categories (e.g., *"mom"* ──► *"Mother"*, *"bhaiya"* ──► *"Brother / Rakhi"*, *"chocolates"* ──► *"Confections"*).

### 4.2 Non-Functional Requirements
- **NFR-SRCH-01**: Query Latency: p95 search execution time under 80ms on database tier.
- **NFR-SRCH-02**: Cache Efficiency: Redis caching for top 100 common search queries and category landing pages, achieving $>80\%$ hit rate.
- **NFR-SRCH-03**: SEO Clean URLs: Filter states must serialize into shareable, crawlable query strings (`/shop?occasion=birthday&max_price=2500`).

## 5. Architecture & Design

### 5.1 Weighted Search Ranking Model
Relevance scoring uses PostgreSQL `ts_rank_cd` (Cover Density) with weighted fields:
- **Weight A (1.0)**: Product Title / Hamper Name (e.g., *"The Royal Velvet Anniversary Hamper"*)
- **Weight B (0.4)**: Curated Occasion & Recipient Tags (e.g., `["Anniversary", "Couples", "Luxury"]`)
- **Weight C (0.2)**: Collection Name and Box Type (e.g., *"Keepsake Wooden Trunk"*)
- **Weight D (0.1)**: Body Description and Component Product Names

### 5.2 Faceted Filter Architecture
The storefront filter bar exposes 5 high-converting dimensions:
1. **Occasion**: Birthday, Anniversary, Wedding, Rakhi, Diwali, Baby Shower, Housewarming, Corporate, Valentine's.
2. **Recipient**: For Her, For Him, For Couples, For Mom, For Sister, For Best Friend, For Clients.
3. **Price Band**: Under ₹1,500, ₹1,500 – ₹2,999, ₹3,000 – ₹4,999, Luxury Above ₹5,000.
4. **Hamper Type**: Ready-to-Ship, Custom Curated, Floral Combos.
5. **Personalization**: Custom Wax Seal, Polaroid Photo Card, Name Engraving.

## 6. Business Rules
1. **Out-of-Stock Deprioritization**: In-stock hampers always rank higher than sold-out items in search results; sold-out items are pushed to the end of the grid rather than hidden completely (preserving SEO equity).
2. **Zero-Results Graceful Fallback**: If a query yields 0 results, the UI must NEVER display a dead blank screen. It must render:
   - *"We couldn't find an exact match for '{query}', but you might adore these popular curations:"*
   - Display top 4 trending bestselling hampers.
   - Provide a prominent CTA: *"Looking for something bespoke? Design Your Own Hamper in our Atelier or Talk on WhatsApp."*
3. **Draft / Archived Product Exclusion**: Products with `status != 'ACTIVE'` are strictly filtered out of public search queries.

## 7. Technical Details

### 7.1 Database Indexing & Search Columns
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add generated full-text search vector column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'D')
) STORED;

CREATE INDEX idx_products_search_vector ON products USING GIN(search_vector);
CREATE INDEX idx_products_name_trgm ON products USING GIN(name gin_trgm_ops);

-- Search Query Procedure Sample
CREATE OR REPLACE FUNCTION search_hampers(
    search_query TEXT,
    filter_occasion VARCHAR DEFAULT NULL,
    max_price_paise BIGINT DEFAULT NULL,
    limit_val INT DEFAULT 20,
    offset_val INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    slug VARCHAR,
    base_price_paise BIGINT,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.slug,
        p.base_price_paise,
        ts_rank_cd(p.search_vector, plainto_tsquery('english', search_query)) + 
        similarity(p.name, search_query) AS rank
    FROM products p
    WHERE p.status = 'ACTIVE'
      AND (
          p.search_vector @@ plainto_tsquery('english', search_query)
          OR similarity(p.name, search_query) > 0.25
      )
      AND (max_price_paise IS NULL OR p.base_price_paise <= max_price_paise)
    ORDER BY rank DESC, p.base_price_paise ASC
    LIMIT limit_val OFFSET offset_val;
END;
$$ LANGUAGE plpgsql;
```

### 7.2 Colloquial Intent Parser (TypeScript)
```typescript
export interface ParsedSearchIntent {
  rawTerm: string;
  cleanTerm: string;
  occasion?: string;
  maxPricePaise?: number;
}

export function parseSearchIntent(query: string): ParsedSearchIntent {
  let cleanTerm = query.trim().toLowerCase();
  let maxPricePaise: number | undefined;
  let occasion: string | undefined;

  // 1. Regex price extraction: "under 2000", "below 2k", "under 1500"
  const priceMatch = cleanTerm.match(/(?:under|below|less than)\s*(?:₹|rs\.?)?\s*(\d+)(k)?/i);
  if (priceMatch) {
    let amount = parseInt(priceMatch[1], 10);
    if (priceMatch[2]?.toLowerCase() === 'k') amount *= 1000;
    maxPricePaise = amount * 100;
    cleanTerm = cleanTerm.replace(priceMatch[0], '').trim();
  }

  // 2. Occasion keyword resolution
  const occasionDictionary: Record<string, string> = {
    anniversary: 'ANNIVERSARY',
    birthday: 'BIRTHDAY',
    wedding: 'WEDDING',
    diwali: 'DIWALI',
    rakhi: 'RAKHI',
    rakshabandhan: 'RAKHI',
  };

  for (const [key, value] of Object.entries(occasionDictionary)) {
    if (cleanTerm.includes(key)) {
      occasion = value;
      cleanTerm = cleanTerm.replace(key, '').trim();
      break;
    }
  }

  return {
    rawTerm: query,
    cleanTerm: cleanTerm.replace(/\s+/g, ' '),
    occasion,
    maxPricePaise,
  };
}
```

## 8. Dependencies
- **Upstream Modules**: `ProductCatalog` (source data: titles, descriptions, categories, prices, inventory).
- **Downstream Modules**: `StorefrontUI` (search bar, filter drawer), `AnalyticsModule` (tracking search conversions and zero-result queries).

## 9. Security
- **SQL Injection Prevention**: All search queries use parameterized Prisma queries or strictly prepared SQL functions; user input is never concatenated into raw SQL strings.
- **Query Length Limits**: Search inputs are sanitized and truncated to a maximum of 100 characters to prevent ReDoS (Regular Expression Denial of Service) and excessive database CPU utilization.

## 10. Failure Modes & Resilience
1. **Full-Text Index Lock or Corruption**: If GIN search queries timeout (>2000ms), the backend automatically degrades to an unindexed `ILIKE '%term%'` query on product names to maintain basic functionality while alerting engineering.
2. **Search Flooding Bot**: Rate-limiting on `/api/v1/catalog/search` restricts client IPs to 60 searches per minute, returning HTTP 429 upon breach.

## 11. Testing
- **Unit Tests**:
  - Intent parser regex tests verifying extraction of *"below 3k"*, *"under 1500"*, *"anniversary gifts"*.
  - Typo tolerance similarity score threshold tests.
- **Integration Tests**:
  - Database search tests validating that searching *"aniversary"* returns *"The Royal Velvet Anniversary Hamper"*.
  - Multi-faceted filter queries asserting correct boolean `AND`/`OR` filtering logic.
- **Performance Benchmarks**: Load testing PostgreSQL search queries with k6 at 200 requests/second under sustained load.

## 12. Observability & Monitoring
- **Metrics Tracked**:
  - `catalog.search.duration_ms` (Target: <80ms).
  - `catalog.search.zero_results_rate` (Target: <5%).
  - `catalog.search.top_queries_counter`.
  - `catalog.search.click_through_rate`.
- **Dashboards**: Admin Merchandising Cockpit showing top 20 searched terms and zero-result queries for the past 7 days to guide new hamper curation.

## 13. Open Questions & Unknowns
```yaml
unknown:
  field: search_synonyms_custom_vocabulary
  status: TO_VERIFY
  source_required: brand_owner
  impact: low
  temporary_assumption: "Standard Indian English gifting vocabulary configured initially; refined post-launch based on search query logs"

unknown:
  field: default_sorting_preference
  status: TO_VERIFY
  source_required: brand_owner
  impact: low
  temporary_assumption: "'Featured / Editorial Pick' default sort order, followed by 'Price: Low to High' and 'Bestsellers'"
```

## 14. Future Evolution
- Semantic Vector Search utilizing pgvector and text embeddings (OpenAI `text-embedding-3-small`) to enable conversational, mood-based queries (*"something aesthetic and calming for a friend feeling stressed"*).
- Personalized search reranking based on user's past purchase history and recipient preferences.

## 15. References
- PostgreSQL Full Text Search Documentation: https://www.postgresql.org/docs/current/textsearch.html
- PostgreSQL Trigram (pg_trgm) Extension Guide: https://www.postgresql.org/docs/current/pgtrgm.html
- Algolia Ecommerce Search UX Best Practices: https://www.algolia.com/blog/ux/ecommerce-search-best-practices/
