<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 32_PERFORMANCE.md — Performance Engineering, Core Web Vitals & Scalability Architecture

## 1. Purpose
This document establishes the end-to-end performance budgets, Core Web Vitals (CWV) thresholds, database query tuning rules, and horizontal scaling architecture for **Hampers by Her**. In digital gifting commerce, mobile shoppers originating from Instagram in-app browsers exhibit high abandonment rates: every 100ms increase in checkout latency decreases conversion by 1%, and Cumulative Layout Shift (CLS) during card personalization causes mistaken form submissions. This specification guarantees sub-second page loads, instant builder interactivity, sub-100ms API responses, and resilient auto-scaling during festive surge traffic (Rakhi, Diwali, Valentine's).

## 2. Scope
- **In-Scope**:
  - Core Web Vitals targets: Largest Contentful Paint (LCP), Interaction to Next Paint (INP), and Cumulative Layout Shift (CLS).
  - Client-side payload budgets: JavaScript bundle sizing, CSS pruning, font loading strategies.
  - Server-Side Rendering (SSR) & Incremental Static Regeneration (ISR) optimization.
  - Database query latency targets, connection pooling (PgBouncer), and index tuning.
  - Redis multi-tier caching (Session, Full-Page Cache, Faceted Counts, Rate Limits).
  - Edge compute routing and CloudFront compression (Brotli/Gzip).
  - Capacity modeling for 20x traffic spikes during festival campaigns.
- **Out-of-Scope**:
  - Premature distributed caching across multi-region databases (single AWS ap-south-1 Mumbai region with multi-AZ replication in MVP).

## 3. Context
Instagram in-app browsers on mobile 4G networks operate in constrained CPU and memory environments. Bloated JavaScript bundles and unoptimized images cause sluggish UI responsiveness and jittery sheet transitions. Hampers by Her establishes a "Mobile 4G Budget": ensuring the entire initial page payload renders interactively within 2.0 seconds on throttled 4G connections.

```
[Mobile Shopper on 4G] 
       │
       ▼ (Target: TTFB < 200ms)
[CloudFront Edge CDN] ── Brotli Compressed HTML / Edge Cache
       │
       ▼ (Target: LCP < 1.8s)
[Next.js 15 App Router] ── Server Component HTML + Preloaded WebP Hero
       │
       ▼ (Target: INP < 150ms)
[React 19 Hydration] ── Only Interactive Islands Hydrate (Cart, Builder, Reviews)
       │
       ▼ (Target: DB Query < 50ms)
[PostgreSQL Aurora + Redis Read Cache]
```

## 4. Requirements
### 4.1 Functional Requirements & Budgets
- **FR-PRF-01**: Core Web Vitals Performance Budgets:
  - **LCP (Largest Contentful Paint)**: $< 2.0\text{s}$ (p75 real users on mobile 4G).
  - **INP (Interaction to Next Paint)**: $< 150\text{ms}$ (p75 real users).
  - **CLS (Cumulative Layout Shift)**: $< 0.05$ (p75 real users).
  - **TTFB (Time to First Byte)**: $< 200\text{ms}$ for cached edge assets; $< 400\text{ms}$ for dynamic SSR.
- **FR-PRF-02**: Asset Payload Budgets:
  - Initial JS bundle size per route: $< 85\text{KB}$ gzipped.
  - Total initial CSS weight: $< 20\text{KB}$ gzipped.
  - Font files: $< 40\text{KB}$ total (subsetted WOFF2 loaded via `next/font`).
  - Hero image weight: $< 120\text{KB}$ (WebP/AVIF).
- **FR-PRF-03**: Backend API Latency Budgets:
  - Catalog browsing (`/api/v1/catalog/products`): p95 $< 80\text{ms}$.
  - Product Detail (`/api/v1/catalog/products/:slug`): p95 $< 50\text{ms}$.
  - Search Autocomplete (`/api/v1/catalog/search`): p95 $< 80\text{ms}$.
  - Cart Total & Price Calculation (`/api/v1/cart/calculate`): p95 $< 100\text{ms}$.
  - Order Submission & Payment Init (`/api/v1/checkout/orders`): p95 $< 300\text{ms}$.

### 4.2 Non-Functional Requirements
- **NFR-PRF-01**: Concurrency & Throughput: Backend architecture must sustain 500 requests/second sustained throughput and 1,500 requests/second burst without 5xx errors.
- **NFR-PRF-02**: Auto-scaling: ECS Fargate container scale-out from 2 to 10 instances triggered when target CPU utilization exceeds 65% for 60 seconds.
- **NFR-PRF-03**: Database Connection Pooling: PgBouncer connection multiplexing capping backend pool connections at 100 to prevent PostgreSQL backend thread exhaustion.

## 5. Architecture & Design

### 5.1 Optimization Hierarchy & Order of Operations
Performance engineering adheres to a strict 7-stage optimization protocol:
```
1. Architecture & Protocol Selection (HTTP/3, Brotli, Multi-AZ VPC, Next.js 15 RSC)
             │
             ▼
2. Media & Asset Pipeline (WebP/AVIF Derivatives, Next/Image, Responsive Srcsets)
             │
             ▼
3. Caching Hierarchy (CloudFront CDN Edge ──► Redis Store ──► Next.js ISR)
             │
             ▼
4. Database Indexing & Query Tuning (GIN Trigrams, Partial Indexes, Explain Analyze)
             │
             ▼
5. Code Splitting & Tree-Shaking (Dynamic Imports for Builder Modals & Review Lightboxes)
             │
             ▼
6. Asynchronous Background Execution (BullMQ Queues for WhatsApp, SES, Webhooks)
             │
             ▼
7. Edge & Header Optimization (Early Hints 103, Font Preloading, Link Prefetching)
```

### 5.2 Next.js 15 Caching Strategy (ISR & Tag Revalidation)
- **Product Detail Pages (PDPs)**: Incremental Static Regeneration with a 3,600s (1 hour) revalidation window (`revalidate = 3600`).
- **On-Demand Tag Invalidation**: When an artisan updates product prices or stock in the Admin Dashboard, Next.js triggers `revalidateTag('product-${id}')` immediately clearing stale CDN and server caches.
- **Dynamic User State**: Cart drawer and authentication status are loaded purely client-side via React Server Component slots and lightweight client fetch to maintain static edge cacheability of the page shell.

## 6. Business Rules
1. **Zero Layout Shifts on Dynamic Content**: All personalization form inputs, wax seal selectors, and image carousels must declare explicit width/height or CSS `aspect-ratio: 4/5` containers to prevent layout reflow during client-side hydration.
2. **Font Loading Zero-FOIT Policy**: Web fonts (`Playfair Display` and `Montserrat`) must use CSS `font-display: swap` combined with zero-shift fallback system fonts (`font-serif` and `font-sans`) with pre-matched metric overrides (`size-adjust`, `ascent-override`).
3. **Graceful Degradation Under Surge**: If database CPU exceeds 85%, non-critical analytics logging is shifted to asynchronous batch ingestion, and search autocomplete disables fuzzy trigram queries, falling back to cached popular products.

## 7. Technical Details

### 7.1 Database Indexing & Query Optimization
```sql
-- Partial index on active products to accelerate storefront PLP queries
CREATE INDEX idx_products_active_category ON products (category_id, base_price_paise)
WHERE status = 'ACTIVE';

-- Composite index for fast order lookup by customer in CRM
CREATE INDEX idx_orders_customer_created ON orders (customer_phone, created_at DESC);

-- Inventory check optimization index
CREATE INDEX idx_inventory_product_stock ON inventory_items (product_id, available_quantity);
```

### 7.2 Database Connection Pool Configuration (PgBouncer)
```ini
[databases]
hampers_db = host=aurora-cluster.ap-south-1.rds.amazonaws.com port=5432 dbname=hbh_prod

[pgbouncer]
listen_port = 6432
listen_addr = 0.0.0.0
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 50
min_pool_size = 10
reserve_pool_size = 5
reserve_pool_timeout = 5
max_db_connections = 100
```

### 7.3 Font Optimization via Next/Font
```typescript
// app/layout.tsx
import { Playfair_Display, Montserrat } from 'next/font/google';

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
  weight: ['400', '600', '700'],
});

const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['300', '400', '500', '600'],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${montserrat.variable}`}>
      <body className="font-sans antialiased bg-sand-50 text-sand-900">{children}</body>
    </html>
  );
}
```

## 8. Dependencies
- **Upstream Modules**: `FrontendArchitecture`, `BackendArchitecture`, `DatabaseDesign`, `MediaCDN`.
- **Infrastructure Dependencies**: AWS CloudFront, AWS ElastiCache Redis, AWS Aurora PostgreSQL, PgBouncer.

## 9. Security
- **DDoS Mitigation**: AWS WAF rate-limits clients to 300 requests per 5 minutes per IP; CloudFront enforces HTTP request body size limits (<10MB) to prevent buffer exhaustion.
- **Slowloris Protection**: Fastify server configured with `keepAliveTimeout = 65000` and `headersTimeout = 66000` to prevent socket starvation attacks.

## 10. Failure Modes & Resilience
1. **Redis Cache Crash**: If Redis becomes unresponsive, cache-aside read calls catch the error, log a warning, and fall back transparently to direct PostgreSQL queries without crashing user requests.
2. **Database Read-Replica Lag**: Aurora read-replicas falling behind primary (>500ms) are temporarily excluded from read-pools; critical post-payment queries always route to the Aurora Primary writer instance.

## 11. Testing (Performance Benchmarking)
- **k6 Load Script (Checkout Concurrency)**:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 },  // Ramp up to 100 concurrent users
    { duration: '3m', target: 500 },  // Surge to 500 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95% of requests under 300ms
    http_req_failed: ['rate<0.01'],   // Error rate under 1%
  },
};

export default function () {
  const res = http.get('https://staging.hampersbyher.com/shop/the-royal-velvet-anniversary-hamper');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'LCP below 2s': (r) => r.timings.duration < 2000,
  });
  sleep(1);
}
```

## 12. Observability & Monitoring
- **Metrics Tracked**:
  - `web.vitals.lcp_p75_ms`.
  - `web.vitals.inp_p75_ms`.
  - `web.vitals.cls_p75`.
  - `api.latency.p95_ms` and `p99_ms`.
  - `database.active_connections` and `database.cpu_utilization`.
  - `redis.cache_hit_rate` (Target: >85%).
- **Alerts**: PagerDuty alarm if p95 API response time exceeds 500ms for more than 3 consecutive minutes.

## 13. Open Questions & Unknowns
```yaml
unknown:
  field: flash_sale_peak_concurrency_estimate
  status: TO_VERIFY
  source_required: brand_owner
  impact: medium
  temporary_assumption: "System provisioned to support 1,500 simultaneous checkout sessions during major festival drops"

unknown:
  field: international_traffic_cdn_tier
  status: TO_VERIFY
  source_required: brand_owner
  impact: low
  temporary_assumption: "CloudFront PriceClass_All enabled for global edge delivery, ensuring fast loads for NRI family members gifting in India"
```

## 14. Future Evolution
- Edge Personalization: Using CloudFront Functions / Cloudflare Workers to serve geo-customized currency and delivery estimations directly at the edge.
- Predictive Asset Prefetching: Machine learning service predicting likely next-click products from Instagram entry points and pre-warming CDN cache.

## 15. References
- Google Web Vitals Documentation: https://web.dev/vitals/
- Next.js Performance & Optimization: https://nextjs.org/docs/app/building-your-application/optimizing
- PostgreSQL Indexing & Performance Best Practices: https://www.postgresql.org/docs/current/indexes.html
