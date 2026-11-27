/**
 * Hampers by Her — Managed PostgreSQL / Supabase Pool Adapter
 *
 * Works seamlessly across:
 * - Vercel Fluid Compute + Supabase / Prisma Postgres / Neon (DATABASE_URL_POOLED / POSTGRES_URL / DATABASE_URL)
 * - Local Docker Compose PostgreSQL (pg16)
 * - Automatic offline / air-gapped JSON bypass when no DB URL is configured
 */

let pgModule = null;
let vercelFunctions = null;

function getPg() {
  if (!pgModule) {
    try {
      pgModule = require("pg");
    } catch {
      pgModule = null;
    }
  }
  return pgModule;
}

function getVercelFunctions() {
  if (!vercelFunctions) {
    try {
      vercelFunctions = require("@vercel/functions");
    } catch {
      vercelFunctions = {};
    }
  }
  return vercelFunctions;
}

function resolveConnectionString(explicitUrl = null) {
  return (
    explicitUrl ||
    process.env.DATABASE_URL_POOLED ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    ""
  ).trim();
}

function shouldUseSsl(connectionString) {
  if (!connectionString) return false;
  if (/sslmode=disable/i.test(connectionString)) return false;
  if (/localhost|127\.0\.0\.1|postgres(?::|@|\/)|hbh-postgres/i.test(connectionString)) {
    return /sslmode=require/i.test(connectionString);
  }
  return true;
}

const RUNTIME_DDL_SQL = `
CREATE TABLE IF NOT EXISTS hbh_orders (
  order_number TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
  total_paise BIGINT NOT NULL DEFAULT 0,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hbh_orders_status_updated ON hbh_orders (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS hbh_qc_records (
  order_number TEXT PRIMARY KEY,
  inspector_name TEXT NOT NULL DEFAULT 'Fatima Bi',
  passed BOOLEAN NOT NULL DEFAULT TRUE,
  payload JSONB NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hbh_shipments (
  awb TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  carrier TEXT NOT NULL DEFAULT 'BlueDart Priority Air',
  status TEXT NOT NULL DEFAULT 'MANIFEST_CREATED',
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hbh_shipments_order ON hbh_shipments (order_number);

CREATE TABLE IF NOT EXISTS hbh_inquiries (
  id TEXT PRIMARY KEY,
  priority_tier TEXT NOT NULL DEFAULT 'P2',
  lead_score INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hbh_inquiries_created ON hbh_inquiries (created_at DESC);

ALTER TABLE hbh_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE hbh_qc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE hbh_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hbh_inquiries ENABLE ROW LEVEL SECURITY;
`;

class PostgresStore {
  constructor(explicitUrl = null) {
    this.explicitUrl = explicitUrl;
    this.pool = null;
    this.activeUrl = "";
    this.schemaReadyPromise = null;
    this.lastError = null;
    this.lastSyncedAt = null;
  }

  isEnabled() {
    return Boolean(resolveConnectionString(this.explicitUrl) && getPg());
  }

  getConnectionMode() {
    const url = resolveConnectionString(this.explicitUrl);
    if (!url) return "local_json";
    if (!getPg()) return "local_json_missing_pg";
    return /supabase/i.test(url) ? "supabase_postgresql" : "postgresql";
  }

  emitMetric(name, value, attributes = {}) {
    try {
      const vf = getVercelFunctions();
      if (typeof vf.metric === "function") {
        vf.metric(name, value, attributes);
      }
    } catch {
      // No-op outside Vercel Observability Plus runtime
    }
  }

  scheduleBackground(promise) {
    if (!promise || typeof promise.then !== "function") return;
    const wrapped = Promise.resolve(promise).catch((err) => {
      this.lastError = err.message;
    });
    try {
      const vf = getVercelFunctions();
      if (typeof vf.waitUntil === "function") {
        vf.waitUntil(wrapped);
      }
    } catch {
      // Standard async fallback outside Vercel runtime
    }
  }

  getPool() {
    const url = resolveConnectionString(this.explicitUrl);
    if (!url) return null;
    const pg = getPg();
    if (!pg) return null;

    if (this.pool && this.activeUrl === url) {
      return this.pool;
    }

    if (this.pool && this.activeUrl !== url) {
      this.pool.end().catch(() => {});
      this.pool = null;
      this.schemaReadyPromise = null;
    }

    const useSsl = shouldUseSsl(url);
    const pool = new pg.Pool({
      connectionString: url,
      max: Number(process.env.PG_POOL_MAX) || (process.env.VERCEL ? 5 : 10),
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
      query_timeout: 8000,
      ssl: useSsl
        ? { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED === "true" }
        : undefined
    });

    pool.on("error", (err) => {
      this.lastError = err.message;
      console.warn("[PostgresStore] Idle client warning:", err.message);
    });

    try {
      const vf = getVercelFunctions();
      if (typeof vf.attachDatabasePool === "function") {
        vf.attachDatabasePool(pool);
      }
    } catch {
      // Safe local fallback
    }

    this.pool = pool;
    this.activeUrl = url;
    return this.pool;
  }

  async ensureSchema() {
    const pool = this.getPool();
    if (!pool) return false;
    if (!this.schemaReadyPromise) {
      this.schemaReadyPromise = pool
        .query(RUNTIME_DDL_SQL)
        .then(() => {
          this.lastError = null;
          return true;
        })
        .catch((err) => {
          this.lastError = err.message;
          this.schemaReadyPromise = null;
          throw err;
        });
    }
    return this.schemaReadyPromise;
  }

  async ping() {
    const pool = this.getPool();
    if (!pool) {
      return { enabled: false, mode: this.getConnectionMode(), connected: false };
    }
    const start = performance.now();
    try {
      await pool.query("SELECT 1 AS ok");
      const latencyMs = Number((performance.now() - start).toFixed(2));
      this.lastError = null;
      return { enabled: true, mode: this.getConnectionMode(), connected: true, latencyMs };
    } catch (err) {
      this.lastError = err.message;
      return { enabled: true, mode: this.getConnectionMode(), connected: false, error: err.message };
    }
  }

  async loadAllState() {
    const pool = this.getPool();
    if (!pool) return null;
    const start = performance.now();
    try {
      await this.ensureSchema();
      const [ordersRes, qcRes, shipRes] = await Promise.all([
        pool.query("SELECT payload FROM hbh_orders ORDER BY updated_at DESC LIMIT 2000"),
        pool.query("SELECT payload FROM hbh_qc_records ORDER BY verified_at DESC LIMIT 2000"),
        pool.query("SELECT payload FROM hbh_shipments ORDER BY updated_at DESC LIMIT 2000")
      ]);
      this.emitMetric("db.query_ms", performance.now() - start, { op: "load_state", outcome: "success" });
      this.lastSyncedAt = new Date().toISOString();
      return {
        orders: ordersRes.rows.map((r) => r.payload).filter(Boolean),
        qcRecords: qcRes.rows.map((r) => r.payload).filter(Boolean),
        shipments: shipRes.rows.map((r) => r.payload).filter(Boolean)
      };
    } catch (err) {
      this.emitMetric("db.query_ms", performance.now() - start, { op: "load_state", outcome: "error" });
      this.lastError = err.message;
      throw err;
    }
  }

  async upsertState({ orders = [], qcRecords = [], shipments = [] } = {}) {
    const pool = this.getPool();
    if (!pool) return false;
    const start = performance.now();
    await this.ensureSchema();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (orders.length > 0) {
        const orderNumbers = [];
        const statuses = [];
        const totalPaises = [];
        const payloads = [];
        for (const o of orders) {
          if (!o?.orderNumber) continue;
          orderNumbers.push(String(o.orderNumber));
          statuses.push(String(o.status || "PENDING_PAYMENT"));
          totalPaises.push(String(Math.round(Number(o.pricing?.totalPaise || o.totalPricePaise || 0))));
          payloads.push(JSON.stringify(o));
        }
        if (orderNumbers.length > 0) {
          await client.query(
            `INSERT INTO hbh_orders (order_number, status, total_paise, payload, updated_at)
             SELECT * FROM UNNEST($1::text[], $2::text[], $3::bigint[], $4::jsonb[])
             CROSS JOIN LATERAL (SELECT NOW()) AS _ts(updated_at)
             ON CONFLICT (order_number) DO UPDATE SET
               status = EXCLUDED.status,
               total_paise = EXCLUDED.total_paise,
               payload = EXCLUDED.payload,
               updated_at = NOW()`,
            [orderNumbers, statuses, totalPaises, payloads]
          );
        }
      }

      if (qcRecords.length > 0) {
        const orderNumbers = [];
        const inspectors = [];
        const passedFlags = [];
        const payloads = [];
        for (const q of qcRecords) {
          if (!q?.orderNumber) continue;
          orderNumbers.push(String(q.orderNumber));
          inspectors.push(String(q.inspectorName || "Fatima Bi"));
          passedFlags.push(Boolean(q.passed !== false));
          payloads.push(JSON.stringify(q));
        }
        if (orderNumbers.length > 0) {
          await client.query(
            `INSERT INTO hbh_qc_records (order_number, inspector_name, passed, payload, verified_at)
             SELECT * FROM UNNEST($1::text[], $2::text[], $3::boolean[], $4::jsonb[])
             CROSS JOIN LATERAL (SELECT NOW()) AS _ts(verified_at)
             ON CONFLICT (order_number) DO UPDATE SET
               inspector_name = EXCLUDED.inspector_name,
               passed = EXCLUDED.passed,
               payload = EXCLUDED.payload,
               verified_at = NOW()`,
            [orderNumbers, inspectors, passedFlags, payloads]
          );
        }
      }

      if (shipments.length > 0) {
        const awbs = [];
        const orderNumbers = [];
        const carriers = [];
        const statuses = [];
        const payloads = [];
        for (const s of shipments) {
          if (!s?.awb || !s?.orderNumber) continue;
          awbs.push(String(s.awb));
          orderNumbers.push(String(s.orderNumber));
          carriers.push(String(s.carrier || "BlueDart Priority Air"));
          statuses.push(String(s.status || "MANIFEST_CREATED"));
          payloads.push(JSON.stringify(s));
        }
        if (awbs.length > 0) {
          await client.query(
            `INSERT INTO hbh_shipments (awb, order_number, carrier, status, payload, updated_at)
             SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[], $5::jsonb[])
             CROSS JOIN LATERAL (SELECT NOW()) AS _ts(updated_at)
             ON CONFLICT (awb) DO UPDATE SET
               order_number = EXCLUDED.order_number,
               carrier = EXCLUDED.carrier,
               status = EXCLUDED.status,
               payload = EXCLUDED.payload,
               updated_at = NOW()`,
            [awbs, orderNumbers, carriers, statuses, payloads]
          );
        }
      }

      await client.query("COMMIT");
      this.lastError = null;
      this.lastSyncedAt = new Date().toISOString();
      this.emitMetric("db.query_ms", performance.now() - start, { op: "upsert_state", outcome: "success" });
      return true;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      this.lastError = err.message;
      this.emitMetric("db.query_ms", performance.now() - start, { op: "upsert_state", outcome: "error" });
      throw err;
    } finally {
      client.release();
    }
  }

  async loadInquiries(limit = 500) {
    const pool = this.getPool();
    if (!pool) return null;
    await this.ensureSchema();
    const res = await pool.query(
      "SELECT payload FROM hbh_inquiries ORDER BY created_at DESC LIMIT $1",
      [Math.max(1, Math.min(2000, Number(limit) || 500))]
    );
    return res.rows.map((r) => r.payload).filter(Boolean);
  }

  async upsertInquiry(inquiry) {
    const pool = this.getPool();
    if (!pool || !inquiry?.id) return false;
    await this.ensureSchema();
    await pool.query(
      `INSERT INTO hbh_inquiries (id, priority_tier, lead_score, status, payload, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, COALESCE($6::timestamptz, NOW()))
       ON CONFLICT (id) DO UPDATE SET
         priority_tier = EXCLUDED.priority_tier,
         lead_score = EXCLUDED.lead_score,
         status = EXCLUDED.status,
         payload = EXCLUDED.payload`,
      [
        String(inquiry.id),
        String(inquiry.priorityTier || "P2"),
        Math.round(Number(inquiry.leadScore || 50)),
        String(inquiry.status || "RECEIVED"),
        JSON.stringify(inquiry),
        inquiry.createdAt || null
      ]
    );
    return true;
  }
}

const postgresStore = new PostgresStore();

module.exports = {
  PostgresStore,
  postgresStore,
  resolveConnectionString,
  shouldUseSsl,
  RUNTIME_DDL_SQL
};
