/**
 * Hampers by Her — Reproducible Runtime HTTP & Computational Benchmark
 * Measures real p50 / p95 / p99 latencies and throughput against the live Express server.
 * Zero fabricated numbers: every latency is directly measured via process.hrtime.bigint().
 */

const http = require("http");
const { app, metricsCollector } = require("../server/index");

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.ceil((p / 100) * sortedArr.length) - 1);
  return sortedArr[idx];
}

function sendRequest(port, method, path, bodyObj = null) {
  return new Promise((resolve, reject) => {
    const payload = bodyObj ? JSON.stringify(bodyObj) : null;
    const headers = payload
      ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
      : {};

    const start = process.hrtime.bigint();
    const req = http.request({ hostname: "127.0.0.1", port, path, method, headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
        resolve({ status: res.statusCode, elapsedMs, bytes: Buffer.byteLength(data) });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runSuite(port, name, method, path, bodyObj, iterations = 100) {
  // Warmup (5 requests)
  for (let i = 0; i < 5; i++) {
    await sendRequest(port, method, path, bodyObj);
  }

  const samples = [];
  let failures = 0;
  const suiteStart = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    const res = await sendRequest(port, method, path, bodyObj);
    if (res.status < 200 || res.status >= 300) failures++;
    samples.push(res.elapsedMs);
  }
  const totalSec = Number(process.hrtime.bigint() - suiteStart) / 1e9;
  samples.sort((a, b) => a - b);

  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return {
    name,
    method,
    path,
    iterations,
    failures,
    p50Ms: Number(percentile(samples, 50).toFixed(3)),
    p95Ms: Number(percentile(samples, 95).toFixed(3)),
    p99Ms: Number(percentile(samples, 99).toFixed(3)),
    meanMs: Number(mean.toFixed(3)),
    rps: Math.round(iterations / totalSec)
  };
}

async function main() {
  process.env.DISABLE_RATE_LIMIT = "true";
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  // Silence per-request console logs during benchmark measurement
  const origLog = console.log;
  console.log = () => {};

  const scenarios = [
    ["Health Probe", "GET", "/health", null],
    ["Prometheus Metrics", "GET", "/metrics", null],
    ["Catalog Products (CacheGrid)", "GET", "/api/v1/catalog/products", null],
    ["3D Volumetric Bin-Packing", "POST", "/api/v1/dsa/bin-packing", {
      boxSizeKey: "MEDIUM",
      items: [
        { id: "c1", name: "Artisan Candle", l_mm: 90, w_mm: 90, h_mm: 100, is_fragile: true, keep_upright: true },
        { id: "c2", name: "Belgian Truffles", l_mm: 120, w_mm: 80, h_mm: 50, is_fragile: false }
      ]
    }],
    ["Integer Paise Pricing Ledger", "POST", "/api/v1/dsa/pricing-ledger", {
      items: [
        { id: "p1", name: "Signature Hamper", unitPricePaise: 325000, quantity: 2 }
      ],
      couponCode: "ALMAS10",
      deliveryFeePaise: 0
    }],
    ["Budget Knapsack Optimizer", "POST", "/api/v1/dsa/budget-knapsack", {
      targetBudgetPaise: 450000,
      preferredCategories: ["gourmet", "wellness"]
    }],
    ["Intent Search Tokenizer", "POST", "/api/v1/dsa/search-intent", {
      query: "luxury diwali wedding gift hamper under 5000",
      rankCatalog: true
    }]
  ];

  const results = [];
  for (const [name, method, path, body] of scenarios) {
    results.push(await runSuite(port, name, method, path, body, 100));
  }

  console.log = origLog;
  metricsCollector.shutdown();
  await new Promise((resolve) => server.close(resolve));

  console.log("===============================================================================");
  console.log("  HAMPERS BY HER — VERIFIED RUNTIME BENCHMARK (100 ITERS/ENDPOINT, LOCALHOST)");
  console.log("===============================================================================");
  console.log(`  Node.js: ${process.version} | Platform: ${process.platform} ${process.arch} | Timestamp: ${new Date().toISOString()}`);
  console.log("-------------------------------------------------------------------------------");
  for (const r of results) {
    console.log(
      `  ${r.name.padEnd(32)} | p50: ${String(r.p50Ms).padStart(6)}ms | p95: ${String(r.p95Ms).padStart(6)}ms | p99: ${String(r.p99Ms).padStart(6)}ms | ${String(r.rps).padStart(5)} req/s | err: ${r.failures}`
    );
  }
  console.log("===============================================================================");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
