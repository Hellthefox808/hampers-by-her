# PERFORMANCE BENCHMARK REPORT — Hampers by Her Commerce Ecosystem

> **Epistemic Evidence Classification (`/system-like-fabel` Section 0 & 16)**:
> - **VERIFIED**: Directly executed and measured via `npm run benchmark` (`scripts/benchmark_runtime.js`) and `npm test` on Node.js `v26.13.1` (`win32 x64`, localhost loopback, 100 iterations per endpoint after 5 warmup requests, 0 errors).
> - **UNVERIFIED**: Browser Core Web Vitals (LCP, INP, CLS) and multi-region AWS load tests require live headless Lighthouse / k6 runs against deployed cloud infrastructure; budgets below are architectural targets, not claimed field measurements.

---

## 1. VERIFIED Local Runtime HTTP & Computational Benchmarks

Executed via `npm run benchmark` (`scripts/benchmark_runtime.js`):

| Subsystem / Endpoint | Target Budget | Measured p50 | Measured p95 | Measured p99 | Measured Throughput | Errors | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Health Probe (`GET /health`)** | $\le 10\text{ms}$ | `0.239ms` | `0.418ms` | `0.534ms` | `3,614 req/s` | `0` | **VERIFIED** |
| **Prometheus Telemetry (`GET /metrics`)** | $\le 10\text{ms}$ | `0.190ms` | `0.313ms` | `0.495ms` | `4,593 req/s` | `0` | **VERIFIED** |
| **Catalog Listing (`GET /api/v1/catalog/products`)** | $\le 50\text{ms}$ | `0.203ms` | `0.297ms` | `0.515ms` | `4,321 req/s` | `0` | **VERIFIED** |
| **3D Volumetric Packing (`POST /api/v1/dsa/bin-packing`)** | $\le 30\text{ms}$ | `0.223ms` | `0.355ms` | `0.485ms` | `3,836 req/s` | `0` | **VERIFIED** |
| **Integer Paise Pricing (`POST /api/v1/dsa/pricing-ledger`)** | $\le 5\text{ms}$ | `0.188ms` | `0.320ms` | `0.516ms` | `4,418 req/s` | `0` | **VERIFIED** |
| **Budget Knapsack (`POST /api/v1/dsa/budget-knapsack`)** | $\le 40\text{ms}$ | `0.191ms` | `0.315ms` | `0.388ms` | `4,674 req/s` | `0` | **VERIFIED** |
| **Intent Search (`POST /api/v1/dsa/search-intent`)** | $\le 15\text{ms}$ | `0.300ms` | `0.456ms` | `0.542ms` | `2,952 req/s` | `0` | **VERIFIED** |
| **Full Automated Regression Suite (240 Tests)** | $\le 2,000\text{ms}$ | — | — | — | 64 Test Suites | `0` | **VERIFIED** |

---

## 2. Frontend Core Web Vitals (CWV) Budgets (UNVERIFIED in Live Browser)

| Metric | Target Budget | Measurement Status | Implemented Architecture Controls |
| :--- | :---: | :---: | :--- |
| **Largest Contentful Paint (LCP)** | $\le 2.2\text{s}$ | **UNVERIFIED (Requires Lighthouse CI)** | Inline SVG visualizer, `Cache-Control: public, max-age=86400`, zero heavy bundler overhead |
| **Interaction to Next Paint (INP)** | $\le 150\text{ms}$ | **UNVERIFIED (Requires Lighthouse CI)** | `requestAnimationFrame` debounced 4D tilt, decoupled Web Audio API synthesis |
| **Cumulative Layout Shift (CLS)** | $\le 0.05$ | **UNVERIFIED (Requires Lighthouse CI)** | Fixed aspect ratio card media slots and deterministic modal dimensions |

---

## 3. High-Concurrency Architecture Controls (Unit-Verified, Cloud Load UNVERIFIED)
- **Cache Stampede Elimination (`platform/services/cache-service/cacheGrid.js`)**: `SingleFlight` request coalescing verified in `platform/tests/scale_1m_concurrency.test.js`.
- **Adaptive Event Loop Telemetry (`server/services/metricsService.js`)**: Real-time `monitorEventLoopDelay` exposed at `GET /metrics` (`nodejs_eventloop_lag_seconds`) and `/health` (`eventLoopLagMs`).
- **Atomic Inventory Reservation & Rollback (`server/routes/api.js`, `platform/services/scaling-service/inventoryLock.js`)**: Rejects `INSUFFICIENT_STOCK` with HTTP `409` and atomically rolls back partial reservations on checkout failure (verified in `tests/elite_adversarial_audit.test.js`).
