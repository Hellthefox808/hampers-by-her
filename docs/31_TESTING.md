<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 31_TESTING.md — Quality Engineering, Automated Verification & E2E Test Strategy

## 1. Purpose
This document establishes the comprehensive Quality Assurance (QA) and verification strategy for **Hampers by Her**. Gifting platforms possess zero tolerance for functional failure: a double payment charge, an unapplied coupon, a truncated personal gift message, or a corrupted delivery date ruins an irreplaceable personal milestone (anniversary, birthday, wedding). This specification defines the automated test pyramid, critical path End-to-End (E2E) journeys, webhook replay tests, financial idempotency assertions, visual regression checks, and CI/CD quality gating required prior to production deployment.

## 2. Scope
- **In-Scope**:
  - Test Pyramid distribution: Unit (70%), Integration (20%), and E2E (10%).
  - Deterministic pricing engine unit tests (integer Paise boundary cases).
  - Hamper Builder compatibility and volume heuristic tests.
  - Payment webhook replay and race-condition integration tests.
  - Playwright cross-browser/mobile viewport E2E test suites.
  - Visual regression testing using Playwright screenshot diffing.
  - Load and stress testing (k6) simulating 20x festival traffic surges.
  - Accessibility audits (Axe Core / WCAG 2.2 AA).
- **Out-of-Scope**:
  - Executing live financial transactions against real customer credit cards in production.

## 3. Context
Commerce platforms frequently suffer from "it works on my machine" regressions where minor CSS changes cause checkout button clipping on mobile screens, or ORM migrations silently break database unique constraints. Hampers by Her establishes strict automated pre-merge gates in GitHub Actions: code cannot merge to `main` without 100% green test execution.

```
[Developer Pull Request]
       │
       ▼ (GitHub Actions CI)
  ├── 1. Static Analysis (ESLint, TypeScript Strict Typecheck, Prettier)
  ├── 2. Security Scan (Trivy Container Scan, npm audit, Semgrep)
  ├── 3. Unit Tests (Jest / Vitest - 100% Coverage on Pricing & Rules)
  ├── 4. Integration Tests (Testcontainers PostgreSQL & Redis)
  ├── 5. E2E Playwright Tests (Headless Chromium & Mobile WebKit)
  └── 6. Visual Regression & Axe Accessibility Checks
       │
       ▼ (All Passed)
[Approved for Staging Deployment]
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-TST-01**: P0 Customer E2E Journey: Automated Playwright test executing: Homepage ──► Occasion PLP ──► PDP ──► Personalization form ──► Cart ──► Address ──► Simulated Razorpay UPI Intent ──► Order Success verification.
- **FR-TST-02**: P0 Hamper Builder E2E Journey: Step 1 (Occasion) through Step 11 (Review & Pay), verifying that max-item limits and box capacity constraints disable incompatible items.
- **FR-TST-03**: Payment Idempotency Assertions: Injecting duplicate Razorpay `order.paid` webhooks simultaneously; asserting that inventory is decremented exactly once and only one order confirmation notification is queued.
- **FR-TST-04**: Customization Validation Tests: Verify rejection of profane or oversized gift messages (>300 chars) and rejection of invalid file extensions (.exe, .svg) in polaroid uploads.
- **FR-TST-05**: Visual Regression Baselines: Capture and assert pixel-perfect alignment across 5 viewports (390px iPhone, 430px iPhone Pro Max, 768px iPad, 1024px, 1440px desktop).

### 4.2 Non-Functional Requirements
- **NFR-TST-01**: CI Execution Speed: Full unit + integration test suite must execute in under 4 minutes.
- **NFR-TST-02**: Deterministic Fixtures: Zero flaky tests; all external network boundaries (Razorpay, Meta WhatsApp, Shiprocket) must use WireMock or Testcontainers mock servers.
- **NFR-TST-03**: Code Coverage Targets: $>90\%$ branch coverage on `pricing`, `customization`, `payments`, and `logistics` modules.

## 5. Architecture & Design

### 5.1 Test Pyramid Distribution
```
      /\
     /  \     10% End-to-End Tests (Playwright: Critical User Flows)
    /────\
   /      \   20% Integration Tests (Supertest + Testcontainers DB/Redis)
  /────────\
 /          \ 70% Unit Tests (Vitest: Pricing, State Machines, Parsers)
/────────────\
```

### 5.2 Test Environment Topology
- **Local Dev / CI Runner**: Docker-based PostgreSQL 16 + Redis 7 running in GitHub Actions runners.
- **Mock Service Adapters**:
  - `MockPaymentGatewayAdapter`: Simulates Razorpay order creation and returns instant synthetic webhook payloads.
  - `MockWhatsAppClient`: Captures outbound HSM template dispatches in an in-memory array for inspection.
  - `MockCourierAdapter`: Returns deterministic AWB numbers and tracking events.

## 6. Business Rules
1. **Zero Failing Tests Policy**: No pull request can be merged with skipped, ignored, or failing tests.
2. **Synthetic Data Only**: Real customer PII (names, phone numbers, addresses) or production payment tokens can NEVER be copied into staging or test environments.
3. **Migration Reversibility Test**: Every new Prisma migration must include an automated down-migration rollback test in CI to prove zero-data-loss rollback capability.

## 7. Technical Details

### 7.1 Sample Unit Test: Pricing Engine Determinism (Vitest)
```typescript
import { describe, it, expect } from 'vitest';
import { calculateOrderPricing } from '@/modules/pricing/pricing.engine';

describe('PricingEngine - Gifting Order Calculations', () => {
  it('should accurately calculate subtotal, customization fees, coupon discounts, and GST', () => {
    const input = {
      items: [
        { basePricePaise: 250000n, quantity: 1 }, // ₹2,500
        { basePricePaise: 50000n, quantity: 2 },  // ₹500 x 2 = ₹1,000
      ],
      customizations: [
        { priceDeltaPaise: 15000n }, // Wax Seal: ₹150
        { priceDeltaPaise: 20000n }, // Polaroid: ₹200
      ],
      coupon: {
        discountType: 'PERCENTAGE',
        discountValue: 10, // 10% off items subtotal
        maxDiscountPaise: 50000n,
      },
      shippingRatePaise: 10000n, // ₹100
      taxRatePercent: 18,
    };

    const result = calculateOrderPricing(input);

    expect(result.itemsSubtotalPaise).toBe(350000n); // ₹3,500
    expect(result.customizationSubtotalPaise).toBe(35000n); // ₹350
    expect(result.discountPaise).toBe(35000n); // 10% of ₹3,500 = ₹350
    // Net Taxable = 350000 + 35000 - 35000 = 350000
    // 18% GST on 350000 = 63000
    expect(result.taxPaise).toBe(63000n); // ₹630
    expect(result.totalAmountPaise).toBe(423000n); // 350000 + 63000 + 10000 = ₹4,230
  });
});
```

### 7.2 Sample Playwright E2E Test: Guest Checkout Flow
```typescript
import { test, expect } from '@playwright/test';

test.describe('P0 Guest Checkout Flow (Mobile 390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('should navigate from PDP, customize hamper, and load Razorpay checkout', async ({ page }) => {
    await page.goto('/shop/the-royal-velvet-anniversary-hamper');

    // 1. Verify PDP Header and Title
    await expect(page.locator('h1')).toContainText('Royal Velvet');

    // 2. Add Personalization Note
    await page.fill('textarea[name="giftMessage"]', 'Happy 5th Anniversary My Love! Forever & Always.');
    await page.click('button:has-text("Add Wax Seal (+₹150)")');

    // 3. Add to Cart & Open Drawer
    await page.click('button:has-text("Add to Atelier Cart")');
    await expect(page.locator('#cart-drawer')).toBeVisible();

    // 4. Proceed to Checkout
    await page.click('a:has-text("Proceed to Checkout")');
    await expect(page).toHaveURL(/\/checkout/);

    // 5. Fill Guest Recipient Form
    await page.fill('input[name="recipientName"]', 'Ananya Sharma');
    await page.fill('input[name="recipientPhone"]', '9876543210');
    await page.fill('input[name="pincode"]', '400050');
    await page.fill('input[name="addressLine1"]', 'Flat 402, Sea Green Apts, Bandra West');

    // 6. Select Payment Method
    await page.click('input[value="RAZORPAY_UPI"]');
    await page.click('button:has-text("Pay & Place Order")');

    // 7. Verify Razorpay Modal Trigger
    await expect(page.locator('iframe.razorpay-checkout-frame')).toBeAttached();
  });
});
```

## 8. Dependencies
- **Test Frameworks**: Vitest (Unit/Integration), Playwright (E2E & Visual Diffing), Supertest (REST API assertions), k6 (Performance/Load testing), Axe Core (Accessibility auditing).
- **Runtime Dependencies**: Docker, Testcontainers Node.

## 9. Security
- **Credential Scrubbing**: Test logs must mask API keys, auth tokens, and database passwords; CI pipelines fail immediately if regex detects exposed AWS/Razorpay secrets.
- **Sandboxed File Ingestion**: File upload tests run in isolated temporary RAM-disk directories and clean up immediately after execution.

## 10. Failure Modes & Resilience
1. **Flaky E2E Browser Tests**: Playwright tests use explicit locator assertions (`toBeVisible()`, `toHaveURL()`) with 5-second automatic retries rather than arbitrary `page.waitForTimeout()` sleep statements.
2. **Database Test Dirty State**: Integration tests run each test suite within a transactional rollback block or provision isolated ephemeral Testcontainers instances to prevent test pollution.

## 11. Testing (Quality Matrix & Test Suites)
| Test Suite | Tooling | Execution Trigger | Pass Criteria |
| :--- | :--- | :--- | :--- |
| **Lint & Typecheck** | ESLint + `tsc --noEmit` | Every git push | 0 errors, 0 warnings |
| **Unit Tests** | Vitest | Every PR commit | 100% pass, $>90\%$ coverage |
| **Integration Tests**| Supertest + Testcontainers | Every PR commit | 100% pass |
| **E2E Critical Paths**| Playwright | PR to `main` / Staging | 100% pass |
| **Visual Regression**| Playwright Image Diff | Staging release | Diff pixel threshold $< 0.1\%$ |
| **Performance Load** | k6 (500 virtual users) | Pre-festive release | p95 latency $< 350ms$ |
| **Accessibility** | `@axe-core/playwright` | PR to `main` | 0 critical/serious violations |

## 12. Observability & Monitoring
- **Metrics Tracked**:
  - `ci.test_execution_duration_seconds`.
  - `ci.test_failure_rate_percentage`.
  - `ci.flaky_test_detected_count`.
  - `qa.coverage_percentage`.
- **Dashboards**: GitHub Actions workflow summary reports and Codecov pull request coverage overlays.

## 13. Open Questions & Unknowns
```yaml
unknown:
  field: browserstack_saucelabs_device_cloud_account
  status: TO_VERIFY
  source_required: brand_owner
  impact: low
  temporary_assumption: "Playwright local headless mobile emulation (iPhone 14 / Pixel 7) sufficient for MVP testing; physical device clouds deferred"

unknown:
  field: performance_load_test_concurrency_target
  status: TO_VERIFY
  source_required: brand_owner
  impact: medium
  temporary_assumption: "Target 500 concurrent virtual users during holiday flash sales without degraded response times"
```

## 14. Future Evolution
- Automated Chaos Engineering (Chaos Mesh / AWS Fault Injection Simulator) injecting network latency and database failovers to verify system self-healing.
- AI-assisted test generation: Automatically generating edge-case hamper combinations using property-based testing (Fast-Check).

## 15. References
- Playwright Documentation: https://playwright.dev/
- Vitest High-Performance Testing Framework: https://vitest.dev/
- Google Web Accessibility Guidelines (WCAG 2.2): https://web.dev/learn/accessibility/
