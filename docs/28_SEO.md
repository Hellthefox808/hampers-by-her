<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 28_SEO.md — Technical SEO, Structured Data & Organic Acquisition Architecture

## 1. Purpose
This document establishes the technical SEO architecture, structured metadata specifications, JSON-LD Schema.org implementations, and internal linking hierarchy for **Hampers by Her**. While Instagram serves as the immediate discovery engine, high-margin evergreen organic search traffic (e.g., *"custom gift hampers mumbai"*, *"luxury birthday hampers for best friend"*, *"bespoke wedding return gifts india"*) provides compounding, zero-CAC (Customer Acquisition Cost) commercial demand. This specification guarantees full compliance with Google Search Central Ecommerce guidelines, automated Merchant Center product feeds, zero crawl budget waste, and rich snippet eligibility.

## 2. Scope
- **In-Scope**:
  - Dynamic Next.js Metadata API (`generateMetadata`) implementation across PDPs, PLPs, and editorial journals.
  - JSON-LD structured data schemas: `Product`, `Offer`, `AggregateRating`, `Organization`, `BreadcrumbList`, and `FAQPage`.
  - Canonical URL normalization and faceted search crawl management (`robots.txt` / `noindex,follow`).
  - Dynamic XML Sitemap generation (`/sitemap.xml`, `/sitemap-products.xml`, `/sitemap-categories.xml`).
  - Core Web Vitals optimization for mobile Googlebot (LCP, INP, CLS).
  - OpenGraph (OG) and Twitter Card dynamic image generation (`@vercel/og`).
  - Google Merchant Center XML / Content API feed automation.
- **Out-of-Scope**:
  - Spam black-hat PBN link building (strictly editorial, white-hat D2C optimization).

## 3. Context
Gifting commerce suffers severely from thin content, duplicate faceted search URLs, and out-of-date pricing in search snippets. Hampers by Her leverages Next.js 15 Server-Side Rendering (SSR) and Incremental Static Regeneration (ISR) to deliver instantaneous, pre-rendered HTML containing complete structured data directly to search crawler user agents.

```
[Googlebot / Social Crawler]
       │
       ▼ (GET /shop/the-royal-velvet-anniversary-hamper)
[CloudFront Edge / Next.js SSR]
       │
       ├── Pre-rendered Semantic HTML (<main>, <h1>, <article>)
       ├── JSON-LD Script Block (Schema.org Product + Offer)
       ├── Canonical Link (<link rel="canonical" href="...">)
       └── Dynamic OpenGraph Meta Tags (<meta property="og:image" ...>)
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-SEO-01**: Dynamic Metadata: Every indexable route must emit unique `<title>` (under 60 chars) and `<meta name="description">` (under 155 chars) reflecting product name, key items, and brand identity.
- **FR-SEO-02**: Comprehensive Schema.org JSON-LD:
  - Product Pages: `Product`, `Image`, `Description`, `Brand`, `Sku`, `Offers` (`price`, `priceCurrency: INR`, `availability: InStock`, `validThrough`, `shippingDetails`).
  - Category Pages: `CollectionPage`, `ItemList`, and `BreadcrumbList`.
  - Corporate / Wedding Pages: `Service`, `FAQPage`.
- **FR-SEO-03**: Canonical URL Enforcement: All product URLs must canonicalize to their root slug (`/shop/:slug`), stripping tracking parameters (`utm_*`, `gclid`, `session_id`).
- **FR-SEO-04**: Automated XML Sitemaps: Auto-generate sitemaps with `<lastmod>` timestamps reflecting the latest product update in PostgreSQL.
- **FR-SEO-05**: Google Merchant Center RSS Feed: Generate a daily updated `/api/v1/feeds/google-merchant.xml` conforming to Google Product Feed specifications.

### 4.2 Non-Functional Requirements
- **NFR-SEO-01**: Server-Side Rendering Latency: TTFB for search bots under 200ms.
- **NFR-SEO-02**: Structured Data Validation: 100% error-free validation on Google Rich Results Test.
- **NFR-SEO-03**: Mobile-First Indexing: Total page weight under 1.2MB with responsive viewport tags.

## 5. Architecture & Design

### 5.1 URL Taxonomy & Crawl Hierarchy
```
https://hampersbyher.com/
  ├── /shop (All Hampers)
  ├── /shop/birthday (Occasion Hub)
  │     └── /shop/the-royal-velvet-anniversary-hamper (Canonical PDP)
  ├── /shop/anniversary
  ├── /shop/wedding
  ├── /shop/corporate
  ├── /build-your-hamper (Atelier Studio - Noindex on active builder states)
  ├── /journal (Gifting Inspiration & Guides)
  │     └── /journal/top-10-anniversary-hampers-guide
  ├── /about
  └── /contact
```

### 5.2 Faceted Search Indexation Rules
Faceted navigation parameters (e.g., sorting, price bands) risk generating infinite crawl traps. The following rules are enforced:
- **Indexable**: Curated static collection pages (`/shop/birthday`, `/shop/anniversary`).
- **Noindex, Follow**: Dynamic query combinations (`/shop?price_min=1000&price_max=3000`, `/shop?sort=price_asc`). Meta tag `<meta name="robots" content="noindex, follow" />` is automatically injected when query parameters are present.

## 6. Business Rules
1. **Out-of-Stock Handling**: When a hamper goes out of stock, its HTTP status remains **200 OK**; the JSON-LD availability transitions to `https://schema.org/OutOfStock`. The page displays similar alternative curations and a *"Notify Me on WhatsApp"* form. Never return 404 for temporarily sold-out products.
2. **Permanent Discontinuation**: If a product is permanently retired, issue an HTTP **301 Permanent Redirect** to the parent occasion collection page.
3. **Price Parity**: The price declared in the JSON-LD `Offer` must match the server-calculated checkout price down to the exact rupee, avoiding Google Merchant Center suspension for price mismatch.

## 7. Technical Details

### 7.1 Next.js 15 Dynamic Metadata Implementation
```typescript
// app/shop/[slug]/page.tsx
import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const product = await prisma.product.findUnique({
    where: { slug: params.slug },
    include: { images: true, category: true },
  });

  if (!product) return { title: 'Product Not Found | Hampers by Her' };

  const title = `${product.name} | Luxury Curated Hampers | Hampers by Her`;
  const description = product.shortDescription || 
    `Discover ${product.name}, hand-curated with artisanal delicacies, bespoke wax seals, and personalized gift notes. Delivered across India.`;
  const heroImage = product.images[0]?.url || 'https://cdn.hampersbyher.com/assets/og-default.jpg';

  return {
    title,
    description,
    alternates: {
      canonical: `https://hampersbyher.com/shop/${product.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `https://hampersbyher.com/shop/${product.slug}`,
      siteName: 'Hampers by Her',
      images: [{ url: heroImage, width: 1200, height: 630, alt: product.name }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [heroImage],
    },
  };
}
```

### 7.2 JSON-LD Structured Data Component
```tsx
// components/seo/ProductJsonLd.tsx
export function ProductJsonLd({ product }: { product: any }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.images.map((img: any) => img.url),
    description: product.description,
    sku: product.sku,
    brand: {
      '@type': 'Brand',
      name: 'Hampers by Her',
    },
    offers: {
      '@type': 'Offer',
      url: `https://hampersbyher.com/shop/${product.slug}`,
      priceCurrency: 'INR',
      price: (product.basePricePaise / 100).toFixed(2),
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: 'Hampers by Her',
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

## 8. Dependencies
- **Upstream Modules**: `ProductCatalog` (slugs, titles, pricing, descriptions, imagery), `ReviewsModule` (aggregate ratings).
- **Downstream Modules**: Public Storefront Layouts, Google Search Console, Google Merchant Center.

## 9. Security
- **JSON-LD XSS Sanitization**: Ensure dynamic values in JSON-LD scripts are sanitized via `JSON.stringify()` to prevent script injection via malicious product titles.
- **Sitemap DoS Protection**: Cache XML sitemaps in Redis (24-hour TTL) to prevent repeated crawler requests from exhausting database connection pools.

## 10. Failure Modes & Resilience
1. **Database Downtime during Googlebot Crawl**: CloudFront serves stale cached HTML pages (`stale-if-error=86400`) to maintain 100% crawl availability even during backend maintenance windows.
2. **Missing Product Slug**: If a requested slug does not exist, return an explicit HTTP 404 with standard `<meta name="robots" content="noindex" />`, never redirecting to the homepage with a 200 OK (soft-404 penalty prevention).

## 11. Testing
- **Automated Schema Validation**: CI/CD pipeline step running `@google-rich-results-test` against pre-rendered staging HTML files.
- **Crawl Simulation**: Periodic Screaming Frog / Sitebulb headless crawl audits on staging to verify zero broken internal links, duplicate canonicals, or missing meta tags.

## 12. Observability & Monitoring
- **Metrics Tracked**:
  - Google Search Console Impressions and Clicks.
  - Average CTR by Occasion Keyword Cluster.
  - Server Log Bot Crawl Frequency (Googlebot-Mobile vs Desktop).
  - CWV Core Web Vitals field data (Real User Metrics).
- **Alerts**: Weekly automated Slack alert reporting indexed URL count changes and any Google Merchant Center item disapprovals.

## 13. Open Questions & Unknowns
```yaml
unknown:
  field: physical_atelier_storefront_address_for_local_schema
  status: TO_VERIFY
  source_required: brand_owner
  impact: low
  temporary_assumption: "National online D2C entity configured without LocalBusiness physical street address schema until physical studio location verified"

unknown:
  field: google_merchant_center_account_id
  status: TO_VERIFY
  source_required: brand_owner
  impact: medium
  temporary_assumption: "Direct XML feed generated at /api/v1/feeds/google-merchant.xml; account linkage handled upon client setup"
```

## 14. Future Evolution
- Programmatic Occasion SEO: Automatically generate dynamic gift guide pages for long-tail queries (*"best anniversary gifts for husbands in india"*).
- Automated AI-powered meta description optimization based on Google Search Console CTR underperformers.

## 15. References
- Google Search Central Ecommerce Documentation: https://developers.google.com/search/docs/specialty/ecommerce
- Schema.org Product Specifications: https://schema.org/Product
- Next.js 15 Metadata API Reference: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
