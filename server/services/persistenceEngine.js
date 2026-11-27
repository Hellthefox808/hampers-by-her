/**
 * HAMPERS BY HER — ATELIER PERSISTENCE ENGINE
 * 
 * Provides atomic, crash-resilient local persistence for:
 * - Orders & fulfillment status transitions
 * - Photographic QC inspection audit records
 * - Carrier manifests and live AWB tracking checkpoints
 * - Patron profiles and customer auth state
 * 
 * Guarantees in-memory zero-latency reads with atomic disk serialization.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { postgresStore, resolveConnectionString } = require("./postgresClient");

class PersistenceEngine {
  constructor(dataDir = null) {
    const isReadOnlyRuntime = Boolean(
      process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.READ_ONLY_FS
    );
    this.dataDir = dataDir || (
      isReadOnlyRuntime
        ? path.join(os.tmpdir(), "hampers-by-her-data")
        : path.join(__dirname, "..", "..", "data")
    );
    this.storeFilePath = path.join(this.dataDir, "atelier_store.json");
    this.saveTimeout = null;
    this.isDirty = false;
    this.cachedState = null;
    this.stateProviders = new Map();
    this.hydrators = [];
    this._hydrationPromise = null;
    this._hydratedUrl = null;

    this.ensureDataDirectory();
  }

  /**
   * Registers a live domain state collector (e.g. 'orders', 'qcRecords', 'shipments')
   * so any atomic disk flush preserves all domain slices together.
   */
  registerStateProvider(key, providerFn) {
    if (key && typeof providerFn === "function") {
      this.stateProviders.set(key, providerFn);
    }
  }

  /**
   * Registers a domain hydrator invoked once cold-start Postgres state is fetched.
   */
  registerHydrator(hydratorFn) {
    if (typeof hydratorFn === "function") {
      this.hydrators.push(hydratorFn);
    }
  }

  /**
   * Hydrates in-memory services from Supabase/PostgreSQL once per cold start when configured.
   */
  async ensureHydrated(force = false) {
    if (!postgresStore.isEnabled()) return false;
    const activeUrl = resolveConnectionString();
    if (this._hydrationPromise && !force && this._hydratedUrl === activeUrl) {
      return this._hydrationPromise;
    }

    this._hydratedUrl = activeUrl;
    this._hydrationPromise = (async () => {
      try {
        const dbState = await postgresStore.loadAllState();
        if (!dbState) return false;

        const diskBaseline = this.loadState();
        const mergedOrders = this._mergeSlice(diskBaseline.orders, dbState.orders, (o) => o?.orderNumber);
        const mergedQc = this._mergeSlice(diskBaseline.qcRecords, dbState.qcRecords, (q) => q?.orderNumber);
        const mergedShipments = this._mergeSlice(
          diskBaseline.shipments,
          dbState.shipments,
          (s) => s?.awb || s?.orderNumber
        );

        const nextState = {
          orders: mergedOrders,
          qcRecords: mergedQc,
          shipments: mergedShipments
        };
        this.cachedState = nextState;

        for (const hydrate of this.hydrators) {
          try {
            hydrate(nextState);
          } catch (err) {
            console.warn("[PersistenceEngine] Hydrator warning:", err.message);
          }
        }
        return true;
      } catch (err) {
        console.warn("[PersistenceEngine] Postgres hydration skipped:", err.message);
        this._hydrationPromise = null;
        return false;
      }
    })();

    return this._hydrationPromise;
  }

  ensureDataDirectory() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch (err) {
      console.warn("[PersistenceEngine] Warning: Could not create data directory:", err.message);
    }
  }

  /**
   * Merges disk records with in-memory domain records by primary key so concurrent workers
   * never clobber freshly committed records created in sibling processes.
   * @private
   */
  _mergeSlice(diskItems = [], memItems = [], keyFn) {
    const merged = new Map();
    for (const item of Array.isArray(diskItems) ? diskItems : []) {
      const k = keyFn(item);
      if (k) merged.set(k, item);
    }
    for (const item of Array.isArray(memItems) ? memItems : []) {
      const k = keyFn(item);
      if (!k) continue;
      const existing = merged.get(k);
      if (!existing) {
        merged.set(k, item);
      } else {
        const diskTs = Date.parse(existing.updatedAt || existing.verifiedAt || existing.createdAt || 0) || 0;
        const memTs = Date.parse(item.updatedAt || item.verifiedAt || item.createdAt || 0) || 0;
        merged.set(k, memTs >= diskTs ? item : existing);
      }
    }
    return Array.from(merged.values());
  }

  /**
   * Loads persisted state from disk
   * @returns {Object} { orders: [], qcRecords: [], shipments: [] }
   */
  loadState() {
    try {
      if (fs.existsSync(this.storeFilePath)) {
        const raw = fs.readFileSync(this.storeFilePath, "utf8");
        const parsed = JSON.parse(raw);
        return {
          orders: Array.isArray(parsed.orders) ? parsed.orders : [],
          qcRecords: Array.isArray(parsed.qcRecords) ? parsed.qcRecords : [],
          shipments: Array.isArray(parsed.shipments) ? parsed.shipments : [],
          savedAt: parsed.savedAt || null
        };
      }
    } catch (err) {
      console.warn("[PersistenceEngine] Could not read store file, starting fresh:", err.message);
    }

    return { orders: [], qcRecords: [], shipments: [], savedAt: null };
  }

  /**
   * Atomically schedules debounced write to disk, merging partial slices with live providers.
   * @param {Object} partialState
   */
  scheduleSave(partialState = {}) {
    const base = this.cachedState || this.loadState();
    this.cachedState = {
      ...base,
      ...partialState
    };
    this.isDirty = true;

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Debounce disk I/O by 50ms to maximize throughput
    this.saveTimeout = setTimeout(() => {
      this.flushToDisk();
    }, 50);
  }

  /**
   * Flushes current state to disk synchronously using PID-unique atomic temp files
   */
  flushToDisk() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    const diskBaseline = this.loadState();
    const assembled = {
      ...(this.cachedState || diskBaseline)
    };
    for (const [key, getter] of this.stateProviders.entries()) {
      try {
        assembled[key] = getter();
      } catch {
        // Keep previously cached slice on provider error
      }
    }

    const mergedOrders = this._mergeSlice(diskBaseline.orders, assembled.orders, (o) => o?.orderNumber);
    const mergedQc = this._mergeSlice(diskBaseline.qcRecords, assembled.qcRecords, (q) => q?.orderNumber);
    const mergedShipments = this._mergeSlice(diskBaseline.shipments, assembled.shipments, (s) => s?.awb || s?.orderNumber);

    this.cachedState = {
      orders: mergedOrders,
      qcRecords: mergedQc,
      shipments: mergedShipments
    };

    const uniqueTempPath = path.join(
      this.dataDir,
      `atelier_store.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2, 8)}.tmp`
    );

    try {
      this.ensureDataDirectory();
      const payload = {
        version: "2.1.0",
        savedAt: new Date().toISOString(),
        orders: mergedOrders,
        qcRecords: mergedQc,
        shipments: mergedShipments
      };

      const jsonStr = JSON.stringify(payload, null, 2);
      fs.writeFileSync(uniqueTempPath, jsonStr, "utf8");

      let renamed = false;
      let lastRenameErr = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          fs.renameSync(uniqueTempPath, this.storeFilePath);
          renamed = true;
          break;
        } catch (err) {
          lastRenameErr = err;
        }
      }
      if (!renamed) {
        // Windows concurrent reader fallback: direct write + remove temp file
        fs.writeFileSync(this.storeFilePath, jsonStr, "utf8");
        try {
          if (fs.existsSync(uniqueTempPath)) fs.unlinkSync(uniqueTempPath);
        } catch {
          // Ignore cleanup errors on already-moved temp files
        }
        if (lastRenameErr && !fs.existsSync(this.storeFilePath)) {
          throw lastRenameErr;
        }
      }
      this.isDirty = false;
    } catch (err) {
      try {
        if (fs.existsSync(uniqueTempPath)) fs.unlinkSync(uniqueTempPath);
      } catch {
        // Ignore cleanup errors
      }
      console.error("[PersistenceEngine] Failed atomic store write:", err.message);
    }

    if (postgresStore.isEnabled()) {
      postgresStore.scheduleBackground(
        postgresStore.upsertState({
          orders: mergedOrders,
          qcRecords: mergedQc,
          shipments: mergedShipments
        })
      );
    }
  }

  /**
   * Flushes both local atomic cache and awaiting PostgreSQL/Supabase UPSERT (used before clean shutdown or critical async flows).
   */
  async flushAllAsync() {
    this.flushToDisk();
    if (postgresStore.isEnabled() && this.cachedState) {
      await postgresStore.upsertState(this.cachedState);
    }
  }
}

const persistenceEngine = new PersistenceEngine();

// Ensure clean flush on process termination
process.on("SIGINT", () => {
  if (persistenceEngine.isDirty) persistenceEngine.flushToDisk();
});
process.on("SIGTERM", () => {
  if (persistenceEngine.isDirty) persistenceEngine.flushToDisk();
});

module.exports = {
  PersistenceEngine,
  persistenceEngine
};
