<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 26_MEDIA_CDN.md — Media Ingestion, Image Optimization Pipeline & Global CDN Architecture

## 1. Purpose
This document establishes the media architecture, image processing pipelines, asset lifecycle management, and global content delivery network (CDN) strategy for **Hampers by Her**. Gifting commerce is an inherently visual discipline: conversion depends overwhelmingly on editorial-quality imagery that showcases tactile hamper textures, satin ribbons, metallic foil debossing, dried botanicals, and artisanal wax seals. This specification guarantees sub-second visual rendering, zero Cumulative Layout Shift (CLS), automated WebP/AVIF derivation, and strict cryptographic segregation between public catalog assets and private customer-uploaded gift photos.

## 2. Scope
- **In-Scope**:
  - CloudFront CDN edge distribution topology and caching behaviors.
  - S3 bucket architecture: public catalog storage vs. private customer-uploaded media.
  - S3 Presigned URL direct-upload protocol for client-side uploads.
  - Automated asynchronous image transformation worker (Sharp / AWS Lambda) generating responsive resolutions (thumbnail, card, PDP hero, zoom gallery, OpenGraph).
  - Next.js Image Optimization configuration (`next/image`) with blur-up placeholders.
  - EXIF metadata stripping for customer privacy.
  - Cache invalidation and versioning policies.
- **Out-of-Scope**:
  - Live video streaming (Reels are embedded or hosted as short looping muted MP4/WebM clips).

## 3. Context
Serving raw 10MB DSLR photographs directly from backend servers creates massive mobile latency, crashes mobile browsers, and blows up bandwidth costs. Hampers by Her establishes an event-driven serverless image optimization pipeline where master assets are uploaded directly from client browsers to S3, automatically processed into modern next-gen formats, and distributed worldwide via CloudFront edge locations.

```
[Browser / Mobile Client]
       │
       ├── 1. Request Presigned URL ──► [NestJS Media API]
       ├── 2. Direct PUT Binary ──────► [S3 Ingestion Bucket (Private)]
       │                                       │
       │                                       ▼ (S3 ObjectCreated Event)
       │                                [Lambda / BullMQ Sharp Worker]
       │                                       │
       │                                       ▼ (Resize, Strip EXIF, WebP/AVIF)
       │                                [S3 Derivatives Bucket (Public Origin)]
       │                                       │
       ▼                                       ▼
[CloudFront CDN Edge] ◄── Cached Delivery ─────┘
 (ap-south-1 Mumbai / Edge PoPs)
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-MED-01**: Direct Presigned S3 Uploads: Clients request temporary presigned upload URLs (`/api/v1/media/upload-intent`), specifying file size and mime-type, bypassing application server memory.
- **FR-MED-02**: Automated Derivative Generation: When an image is ingested, generate 5 responsive WebP and AVIF variants within 3 seconds:
  - `thumb`: $150 \times 150$ (cart, checkout preview)
  - `card`: $400 \times 500$ (catalog grid, collection view)
  - `pdp`: $800 \times 1000$ (product detail hero)
  - `zoom`: $1600 \times 2000$ (high-resolution lightbox zoom)
  - `og`: $1200 \times 630$ (social share preview)
- **FR-MED-03**: BlurHash / Low-Quality Image Placeholder (LQIP): Extract a compact 32-character BlurHash string during processing and store it in PostgreSQL to enable smooth blur-up transitions in Next.js.
- **FR-MED-04**: Customer Photo Isolation: Personalization photos uploaded by customers (for custom polaroids) are stored in `s3://hbh-media-customer-private/` with server-side KMS encryption and served strictly through time-limited presigned URLs (15 minutes expiry).

### 4.2 Non-Functional Requirements
- **NFR-MED-01**: CDN Cache Hit Ratio: Maintain $>95\%$ CloudFront cache hit ratio for all public catalog imagery.
- **NFR-MED-02**: Edge Latency: Time to First Byte (TTFB) under 50ms across all Tier-1 Indian metros (Mumbai, Delhi, Bengaluru, Chennai).
- **NFR-MED-03**: Core Web Vitals: Zero Cumulative Layout Shift ($CLS < 0.05$) achieved by enforcing explicit aspect ratios ($4:5$ editorial ratio) in all frontend image containers.

## 5. Architecture & Design

### 5.1 CloudFront Distribution Behaviors
CloudFront distribution `cdn.hampersbyher.com` is configured with distinct cache behaviors:

| Path Pattern | Target Origin | Allowed Methods | Cache Policy | Query String / Header Forwarding |
| :--- | :--- | :--- | :--- | :--- |
| `/catalog/*` | S3 Public Derivatives | `GET, HEAD` | `CacheOptimized` (TTL: 1 Year) | None (Immutable URLs) |
| `/assets/*` | S3 Static UI Assets | `GET, HEAD` | `CacheOptimized` (TTL: 1 Year) | None |
| `/api/*` | ECS Application ALB | `ALL` | `CachingDisabled` | Forward All Headers & Cookies |
| `/*` (Fallback) | Next.js ECS SSR Cluster | `GET, HEAD, OPTIONS` | `Managed-Amplify` (Custom) | Forward `Host`, `Accept-Language`, `RSC` |

### 5.2 Responsive Image Derivation Rules
```
Master Upload (e.g. 4000x5000 JPEG)
       │
       ├──► Sharp: Resize to 1600x2000, Quality: 85, Format: AVIF/WebP ──► /zoom.webp
       ├──► Sharp: Resize to 800x1000,  Quality: 82, Format: AVIF/WebP ──► /pdp.webp
       ├──► Sharp: Resize to 400x500,   Quality: 80, Format: AVIF/WebP ──► /card.webp
       ├──► Sharp: Resize to 150x150,   Quality: 75, Format: AVIF/WebP ──► /thumb.webp
       └──► Sharp: BlurHash extraction ──────────────────────────────────► "L6Pj0^jE.AyE_3t7t7R**0o#DgR4"
```

## 6. Business Rules
1. **Immutable Asset Naming**: Media URLs are immutable and keyed by UUIDv7 hash (`/catalog/2026/09/0191fa2b-8a21-71e0-a9cb-b2f5d96a0123/card.webp`). File updates spawn new asset records rather than mutating existing S3 keys.
2. **Strict Privacy on Gift Memories**: Customer-uploaded personal photos (e.g., anniversary pictures intended for inclusion inside custom gift hampers) can NEVER be cached in public CloudFront edge locations or indexed by Google Images.
3. **MIME Type Whitelist**: The ingestion engine accepts strictly `image/jpeg`, `image/png`, and `image/webp`. Executable files, PDFs, SVGs, and audio files are rejected at the presigned URL validation stage.

## 7. Technical Details

### 7.1 Database Entity Relations (Media Subsystem)
```sql
CREATE TABLE media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_type VARCHAR(32) NOT NULL, -- CATALOG_PRODUCT, CATALOG_COLLECTION, CUSTOMER_UPLOAD, ATELIER_QC
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(64) NOT NULL,
    file_size_bytes INT NOT NULL,
    storage_bucket VARCHAR(64) NOT NULL,
    storage_key_prefix TEXT NOT NULL,
    blurhash VARCHAR(64),
    width INT NOT NULL,
    height INT NOT NULL,
    variants JSONB NOT NULL, -- {"thumb": "...", "card": "...", "pdp": "...", "zoom": "..."}
    is_private BOOLEAN DEFAULT FALSE,
    uploader_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_media_type ON media_assets(asset_type);
CREATE INDEX idx_media_uploader ON media_assets(uploader_user_id);
```

### 7.2 Image Processing Worker (Sharp Implementation)
```typescript
import sharp from 'sharp';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

export async function processCatalogImage(bucket: string, key: string, assetId: string): Promise<ImageVariantsResult> {
  const s3 = new S3Client({ region: 'ap-south-1' });
  const rawObj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const inputBuffer = await rawObj.Body.transformToByteArray();

  const metadata = await sharp(inputBuffer).metadata();
  const baseSharp = sharp(inputBuffer).rotate(); // auto-orient via EXIF before stripping

  const resolutions = [
    { name: 'zoom', width: 1600, height: 2000, quality: 85 },
    { name: 'pdp', width: 800, height: 1000, quality: 82 },
    { name: 'card', width: 400, height: 500, quality: 80 },
    { name: 'thumb', width: 150, height: 150, quality: 75 },
  ];

  const variants: Record<string, string> = {};

  for (const res of resolutions) {
    const outputBuffer = await baseSharp
      .clone()
      .resize(res.width, res.height, { fit: 'cover', position: 'centre' })
      .webp({ quality: res.quality })
      .toBuffer();

    const destKey = `catalog/${assetId}/${res.name}.webp`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_DERIVATIVES_BUCKET,
      Key: destKey,
      Body: outputBuffer,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    variants[res.name] = `https://cdn.hampersbyher.com/${destKey}`;
  }

  return {
    width: metadata.width,
    height: metadata.height,
    variants,
  };
}
```

## 8. Dependencies
- **Upstream Modules**: `ProductCatalog` (linking imagery to variants and hampers), `CustomizationEngine` (handling personalization photo uploads), `AdminDashboard` (Atelier QC capture).
- **External Dependencies**: AWS S3, AWS CloudFront, Sharp image processing library.

## 9. Security
- **EXIF Metadata Scrubbing**: Personal GPS coordinates, camera serial numbers, and capture timestamps are automatically stripped from all uploaded media during Sharp transformation to protect customer privacy.
- **Bucket Lock-Down**: S3 origins use CloudFront Origin Access Control (OAC). Direct HTTP access to the underlying S3 buckets is prohibited via IAM bucket policy.
- **Upload Size Ceiling**: S3 Presigned POST policies strictly enforce a maximum payload size of 10,485,760 bytes (10MB) to prevent S3 storage exhaustion attacks.

## 10. Failure Modes & Resilience
1. **Lambda / Sharp Processing Crash**: If a corrupted JPEG crashes the Sharp worker, the S3 ObjectCreated event routes to a Dead Letter Queue (SQS DLQ). The system flags the asset as `PROCESSING_FAILED` and alerts the admin operator.
2. **CloudFront Regional PoP Failure**: CloudFront automatically routes incoming DNS requests to alternative healthy edge PoPs across India (e.g., failing over from Mumbai to Pune/Hyderabad) without client-visible disruption.

## 11. Testing
- **Unit Tests**:
  - Image aspect ratio calculation and crop boundary tests.
  - S3 key generation tests validating immutable UUID format.
- **Integration Tests**:
  - Presigned URL generation test: verifying signature expiration and file-size policy constraints.
  - Image pipeline test: Upload mock 4000x5000 JPEG ──► assert all 4 WebP variants exist in destination bucket with correct dimensions.
- **Performance Tests**: Lighthouse CWV audit validating that Product Detail Pages achieve Largest Contentful Paint (LCP) under 1.8 seconds on 4G networks.

## 12. Observability & Monitoring
- **Metrics Tracked**:
  - `cloudfront.cache_hit_rate` (Target: >95%).
  - `cloudfront.bandwidth_bytes_out`.
  - `media.processing_duration_ms` (Target: <2500ms).
  - `media.processing_failure_count`.
- **Alerts**: CloudWatch alarm triggered if derivative generation queue latency exceeds 30 seconds.

## 13. Open Questions & Unknowns
```yaml
unknown:
  field: photography_asset_archive_location
  status: TO_VERIFY
  source_required: brand_owner
  impact: low
  temporary_assumption: "Existing master photography currently stored in Google Drive / iCloud will be ingested via S3 CLI batch sync"

unknown:
  field: watermark_policy
  status: TO_VERIFY
  source_required: brand_owner
  impact: low
  temporary_assumption: "No visual watermarks burned into product photos; clean luxury editorial aesthetic prioritized"
```

## 14. Future Evolution
- Direct integration with Cloudflare Images or AWS CloudFront Functions for dynamic on-the-fly content negotiation (delivering AVIF to Chrome/Safari, WebP to older clients).
- AI background removal: Automatically clean atelier packaging bench backgrounds into studio white or curated brand pastel backdrops.

## 15. References
- AWS CloudFront Origin Access Control (OAC) Documentation: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html
- Sharp High Performance Node.js Image Processing: https://sharp.pixelplumbing.com/
- Google Web Vitals (Largest Contentful Paint Guidance): https://web.dev/lcp/
