# PERFORMANCE BENCHMARK REPORT — Hampers by Her Commerce Ecosystem

> **Epistemic Evidence Classification (`/system-like-fabel` Section 0 & 16)**:
> - **VERIFIED (Local Runtime)**: Directly executed and measured via `npm run benchmark` (`scripts/benchmark_runtime.js`) and `npm test` on Node.js `v26.13.1` (`win32 x64`, localhost loopback, 100 iterations per endpoint after 5 warmup requests, 0 errors).
> - **VERIFIED (Local Headless Chromium Browser)**: Directly measured via Playwright headless Chromium (`1440x900` desktop and `390x844` mobile viewports) against live `http://localhost:3000` managed by `with_server.py` (27/27 E2E browser assertions passing, 0 uncaught errors).
> - **UNVERIFIED (Production Field / Cloud Load)**: Real-user INP (Interaction to Next Paint) across mid-tier mobile devices, CDN/4G network latency, and multi-region AWS k6 load tests require deployed cloud infrastructure.

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

## 2. Frontend Core Web Vitals (CWV) — Headless Chromium Telemetry (Localhost)

Measured via Playwright Headless Chromium (`PerformanceObserver` for `largest-contentful-paint` and `layout-shift`, plus Navigation & Paint Timing APIs) against live `http://localhost:3000`:

| Metric | Target Budget | Desktop (`1440×900`) | Mobile (`390×844`) | Status | Implemented Controls |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Time to First Byte (TTFB)** | $\le 200\text{ms}$ | `12ms` | `2ms` | **VERIFIED (Localhost)** | Express static caching (`max-age=86400`), lightweight server |
| **First Contentful Paint (FCP)** | $\le 1,800\text{ms}$ | `892ms` | `556ms` | **VERIFIED (Localhost)** | Immediate above-the-fold hero render (zero `opacity: 0` paint gate) |
| **Largest Contentful Paint (LCP)** | $\le 2,200\text{ms}$ | `892ms` | `556ms` | **VERIFIED (Localhost)** | `fetchpriority="high"` + explicit `width`/`height` on `hero-hamper.jpg` |
| **Cumulative Layout Shift (CLS)** | $\le 0.10$ | `0.0169` | `0.0000` | **VERIFIED (Localhost)** | Fixed aspect ratio card media slots, centered modal sheets |
| **DOMContentLoaded / Load** | $\le 2,500\text{ms}$ | `556ms` / `955ms` | `521ms` / `989ms` | **VERIFIED (Localhost)** | Zero heavy bundler overhead, inline SVG procedural visualizer |
| **Interaction to Next Paint (INP)** | $\le 150\text{ms}$ | — | — | **UNVERIFIED (Requires Field RUM / Lighthouse)** | `requestAnimationFrame` debounced 4D tilt, decoupled Web Audio API |

---

## 3. High-Concurrency Architecture Controls (Unit-Verified, Cloud Load UNVERIFIED)
- **Cache Stampede Elimination (`platform/services/cache-service/cacheGrid.js`)**: `SingleFlight` request coalescing verified in `platform/tests/scale_1m_concurrency.test.js`.
- **Adaptive Event Loop Telemetry (`server/services/metricsService.js`)**: Real-time `monitorEventLoopDelay` exposed at `GET /metrics` (`nodejs_eventloop_lag_seconds`) and `/health` (`eventLoopLagMs`).
- **Atomic Inventory Reservation & Rollback (`server/routes/api.js`, `platform/services/scaling-service/inventoryLock.js`)**: Rejects `INSUFFICIENT_STOCK` with HTTP `409` and atomically rolls back partial reservations on checkout failure (verified in `tests/elite_adversarial_audit.test.js`).
