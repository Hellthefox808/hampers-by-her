/**
 * Hampers by Her Atelier AI Platform — 1M User Scalability & High-Concurrency Test Suite
 * Tests SingleFlight request coalescing, multi-tier rate limiting, adaptive load shedding,
 * and race-condition-free atomic inventory reservations.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { CacheGrid, SingleFlightCoalescer, LruCache } = require("../services/cache-service/cacheGrid");
const { SlidingWindowRateLimiter, AdaptiveLoadShedder } = require("../services/scaling-service/rateLimiter");
const { InventoryReservationEngine } = require("../services/scaling-service/inventoryLock");

describe("Hampers by Her 1M Scalability & Concurrency Subsystem", () => {
  describe("SingleFlight & Multi-Tier Cache Grid", () => {
    test("SingleFlight coalesces 50 concurrent requests into exactly 1 underlying execution", async () => {
      const coalescer = new SingleFlightCoalescer();
      let executionCount = 0;

      const fetchViralHamper = async () => {
        executionCount++;
        // Simulate 20ms database read latency
        await new Promise(resolve => setTimeout(resolve, 20));
        return {
          sku: "prod_diwali_royal_velvet",
          title: "Diwali Royal Velvet Artisan Hamper",
          pricePaise: 799900
        };
      };

      // Launch 50 concurrent calls
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(coalescer.do("hamper:viral_drop", fetchViralHamper));
      }

      const results = await Promise.all(promises);

      // Verify all 50 callers received the identical valid payload
      assert.strictEqual(results.length, 50);
      for (const res of results) {
        assert.strictEqual(res.sku, "prod_diwali_royal_velvet");
      }

      // Assert that DB query executed strictly ONCE
      assert.strictEqual(executionCount, 1);
    });

    test("CacheGrid serves L1 and L2 hits and supports prefix pattern invalidation", async () => {
      const grid = new CacheGrid();
      let dbReads = 0;

      const getCategory = async () => {
        dbReads++;
        return ["prod_wedding_1", "prod_wedding_2"];
      };

      // First call: Miss, executes fetch
      const res1 = await grid.getOrSet("catalog:wedding", getCategory, 5000);
      assert.strictEqual(res1.length, 2);
      assert.strictEqual(dbReads, 1);

      // Second call: Hits L1 cache directly
      const res2 = await grid.getOrSet("catalog:wedding", getCategory, 5000);
      assert.strictEqual(res2.length, 2);
      assert.strictEqual(dbReads, 1); // No additional DB read

      // Invalidate all catalog keys
      grid.invalidatePattern("catalog:");
      const res3 = await grid.getOrSet("catalog:wedding", getCategory, 5000);
      assert.strictEqual(res3.length, 2);
      assert.strictEqual(dbReads, 2); // Re-fetched after invalidation
    });

    test("LruCache evicts oldest entries when maxSize is exceeded", () => {
      const lru = new LruCache(3);
      lru.set("k1", "v1");
      lru.set("k2", "v2");
      lru.set("k3", "v3");

      assert.strictEqual(lru.get("k1"), "v1");
      assert.strictEqual(lru.get("k2"), "v2");

      // Insert k4, which should evict k3 (oldest unread)
      lru.set("k4", "v4");
      assert.strictEqual(lru.get("k3"), null);
      assert.strictEqual(lru.get("k4"), "v4");
    });
  });

  describe("SlidingWindowRateLimiter & Adaptive Load Shedding", () => {
    test("Rate limiter allows traffic within quota and blocks requests exceeding limit", () => {
      const limiter = new SlidingWindowRateLimiter();

      // Test Anonymous tier: Limit is 60 req/min
      for (let i = 1; i <= 60; i++) {
        const check = limiter.check("192.168.1.100", "ANONYMOUS");
        assert.strictEqual(check.allowed, true);
        assert.strictEqual(check.remaining, 60 - i);
      }

      // 61st request must be blocked
      const blocked = limiter.check("192.168.1.100", "ANONYMOUS");
      assert.strictEqual(blocked.allowed, false);
      assert.strictEqual(blocked.remaining, 0);
      assert.ok(blocked.retryAfterSec > 0);

      // Separate IP has its own window
      const separateIp = limiter.check("192.168.1.101", "ANONYMOUS");
      assert.strictEqual(separateIp.allowed, true);
      assert.strictEqual(separateIp.remaining, 59);
    });

    test("AdaptiveLoadShedder protects critical transactions while shedding non-critical during high lag", () => {
      const shedder = new AdaptiveLoadShedder({ maxLagMs: 70 });

      // Normal conditions: lag = 15ms
      shedder.setLag(15);
      assert.strictEqual(shedder.shouldShed("CRITICAL"), false);
      assert.strictEqual(shedder.shouldShed("STANDARD"), false);
      assert.strictEqual(shedder.shouldShed("BACKGROUND"), false);

      // High load conditions: event loop lag spikes to 85ms
      shedder.setLag(85);
      assert.strictEqual(shedder.shouldShed("STANDARD"), true); // Shed browsing request
      assert.strictEqual(shedder.shouldShed("BACKGROUND"), true); // Shed analytics request
      // CRITICAL requests (Checkout, Payment) are NEVER shed!
      assert.strictEqual(shedder.shouldShed("CRITICAL"), false);

      const metrics = shedder.getMetrics();
      assert.ok(metrics.totalShedRequests >= 2);
    });
  });

  describe("InventoryReservationEngine (High-Concurrency Flash Sale)", () => {
    test("Guarantees zero overselling when 20 concurrent threads attempt to reserve 5 items", async () => {
      const engine = new InventoryReservationEngine();
      const sku = "prod_mahogany_heritage_box";
      engine.setStock(sku, 5); // Strictly 5 handcrafted boxes available

      // 20 concurrent purchase attempts
      const reservationPromises = [];
      for (let i = 0; i < 20; i++) {
        reservationPromises.push(engine.reserve(sku, 1, `user_${i + 1}`));
      }

      const results = await Promise.all(reservationPromises);

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      assert.strictEqual(successful.length, 5);
      assert.strictEqual(failed.length, 15);

      for (const fail of failed) {
        assert.strictEqual(fail.reason, "INSUFFICIENT_STOCK");
      }

      const stockStatus = engine.getStock(sku);
      assert.strictEqual(stockStatus.total, 5);
      assert.strictEqual(stockStatus.reserved, 5);
      assert.strictEqual(stockStatus.available, 0); // Completely depleted, zero negative stock!
    });

    test("Commits reservation permanently on successful payment capture", async () => {
      const engine = new InventoryReservationEngine();
      const sku = "prod_truffle_selection";
      engine.setStock(sku, 10);

      const res = await engine.reserve(sku, 2, "user_vip_01");
      assert.strictEqual(res.success, true);

      // Verify available is 8, reserved is 2, total is 10
      let stock = engine.getStock(sku);
      assert.strictEqual(stock.available, 8);
      assert.strictEqual(stock.reserved, 2);

      // Payment succeeds -> Commit
      const commitRes = await engine.commit(res.reservationId);
      assert.strictEqual(commitRes.success, true);

      // Total decreases to 8, reserved back to 0, available remains 8
      stock = engine.getStock(sku);
      assert.strictEqual(stock.total, 8);
      assert.strictEqual(stock.reserved, 0);
      assert.strictEqual(stock.available, 8);
    });

    test("Releases reservation back to available inventory on checkout abandonment", async () => {
      const engine = new InventoryReservationEngine();
      const sku = "prod_silk_ribbon_gold";
      engine.setStock(sku, 10);

      const res = await engine.reserve(sku, 3, "user_abandon_01");
      assert.strictEqual(res.success, true);
      assert.strictEqual(engine.getStock(sku).available, 7);

      // User closes browser / cancels checkout -> Release
      const releaseRes = await engine.release(res.reservationId);
      assert.strictEqual(releaseRes.success, true);
      assert.strictEqual(engine.getStock(sku).available, 10); // Restored
      assert.strictEqual(engine.getStock(sku).reserved, 0);
    });

    test("Background sweep automatically releases expired holds", async () => {
      const engine = new InventoryReservationEngine();
      const sku = "prod_wax_seal_emerald";
      engine.setStock(sku, 10);
      engine.reservationTtlMs = 10; // 10ms expiry for test

      const res = await engine.reserve(sku, 4, "user_timeout_01");
      assert.strictEqual(res.success, true);
      assert.strictEqual(engine.getStock(sku).available, 6);

      // Wait 15ms for reservation to expire
      await new Promise(resolve => setTimeout(resolve, 15));

      const sweep = engine.sweepExpired();
      assert.strictEqual(sweep.sweptCount, 1);
      assert.strictEqual(engine.getStock(sku).available, 10); // Restored to 10
    });
  });
});
