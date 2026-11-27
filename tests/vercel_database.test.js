const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const rootServer = require("../server");
const { buildVercelPublic } = require("../scripts/build_vercel_public");
const {
  PostgresStore,
  resolveConnectionString,
  shouldUseSsl,
  RUNTIME_DDL_SQL
} = require("../server/services/postgresClient");
const { PersistenceEngine } = require("../server/services/persistenceEngine");
const { InquiryService } = require("../server/services/inquiryService");

const ROOT = path.resolve(__dirname, "..");

describe("Vercel Fluid Compute & Supabase/PostgreSQL Readiness Suite", () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = rootServer.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test("Root server.js exports an http.Server instance compatible with Vercel Fluid Compute & WebSockets", () => {
    assert.ok(rootServer instanceof http.Server, "Root entrypoint must export http.Server");
  });

  test("vercel.json and .vercelignore match Fluid Compute Express deployment configuration", () => {
    const vercelJson = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
    assert.equal(vercelJson.framework, "express");
    assert.equal(vercelJson.fluid, true);
    assert.equal(vercelJson.buildCommand, "npm run vercel-build");
    assert.equal(vercelJson.cleanUrls, true);
    assert.ok(vercelJson.functions && vercelJson.functions["server.js"]);
    assert.ok(vercelJson.functions["server.js"].maxDuration >= 60);

    const ignoreTxt = fs.readFileSync(path.join(ROOT, ".vercelignore"), "utf8");
    assert.ok(ignoreTxt.includes(".conda/"));
    assert.ok(ignoreTxt.includes("tests/"));
  });

  test("scripts/build_vercel_public.js builds public/ CDN assets cleanly", () => {
    const outDir = buildVercelPublic();
    assert.ok(fs.existsSync(path.join(outDir, "index.html")));
    assert.ok(fs.existsSync(path.join(outDir, "admin.html")));
    assert.ok(fs.existsSync(path.join(outDir, "lookbook.html")));
    assert.ok(fs.existsSync(path.join(outDir, "script.js")));
    assert.ok(fs.existsSync(path.join(outDir, "themes.css")));
    assert.ok(fs.existsSync(path.join(outDir, "architecture.html")));
    // Clean up generated public/ artifact unless running in Vercel CI build
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  test("Supabase SQL migration defines operational tables with Row Level Security locked down", () => {
    const migrationSql = fs.readFileSync(
      path.join(ROOT, "docs", "database", "supabase_migration.sql"),
      "utf8"
    );
    for (const tbl of ["hbh_orders", "hbh_qc_records", "hbh_shipments", "hbh_inquiries"]) {
      assert.ok(migrationSql.includes(tbl), `Missing table ${tbl} in supabase_migration.sql`);
      assert.ok(
        migrationSql.includes(`ENABLE ROW LEVEL SECURITY`) && RUNTIME_DDL_SQL.includes(tbl),
        `RLS and runtime DDL must include ${tbl}`
      );
    }
    assert.ok(migrationSql.includes("REVOKE ALL ON TABLE public.hbh_orders FROM anon, authenticated"));
  });

  test("Postgres connection resolver & SSL detector handle Supabase, Neon, and local Postgres URLs", () => {
    const prevEnv = {
      DATABASE_URL_POOLED: process.env.DATABASE_URL_POOLED,
      POSTGRES_URL: process.env.POSTGRES_URL,
      DATABASE_URL: process.env.DATABASE_URL
    };

    try {
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/hampers?sslmode=disable";
      process.env.POSTGRES_URL = "";
      process.env.DATABASE_URL_POOLED = "";
      assert.equal(resolveConnectionString(), "postgresql://user:pass@localhost:5432/hampers?sslmode=disable");
      assert.equal(shouldUseSsl(resolveConnectionString()), false);

      process.env.DATABASE_URL_POOLED = "postgresql://postgres.ref:pw@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";
      assert.equal(resolveConnectionString(), process.env.DATABASE_URL_POOLED);
      assert.equal(shouldUseSsl(process.env.DATABASE_URL_POOLED), true);
      assert.equal(shouldUseSsl("postgresql://u:p@db.neon.tech/neondb"), true);
    } finally {
      for (const [k, v] of Object.entries(prevEnv)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  test("PostgresStore performs transactional UNNEST UPSERTs and loads cold-start state", async () => {
    const queries = [];
    const mockClient = {
      async query(sql, params) {
        queries.push({ sql: String(sql).trim(), params });
        return { rows: [] };
      },
      release() {}
    };
    const mockPool = {
      async query(sql) {
        const s = String(sql);
        queries.push({ sql: s.trim() });
        if (s.includes("FROM hbh_orders")) {
          return { rows: [{ payload: { orderNumber: "HBH-PG-1", status: "CONFIRMED", pricing: { totalPaise: 420000 } } }] };
        }
        if (s.includes("FROM hbh_qc_records")) {
          return { rows: [{ payload: { orderNumber: "HBH-PG-1", inspectorName: "Fatima Bi", passed: true } }] };
        }
        if (s.includes("FROM hbh_shipments")) {
          return { rows: [{ payload: { awb: "HBH-AWB-1", orderNumber: "HBH-PG-1", carrier: "BlueDart Priority Air" } }] };
        }
        return { rows: [{ ok: 1 }] };
      },
      async connect() {
        return mockClient;
      }
    };

    const store = new PostgresStore("postgresql://postgres:pw@db.mock.supabase.co:5432/postgres");
    store.pool = mockPool;
    store.activeUrl = "postgresql://postgres:pw@db.mock.supabase.co:5432/postgres";
    store.schemaReadyPromise = Promise.resolve(true);

    const pingRes = await store.ping();
    assert.equal(pingRes.connected, true);

    const loaded = await store.loadAllState();
    assert.equal(loaded.orders.length, 1);
    assert.equal(loaded.orders[0].orderNumber, "HBH-PG-1");
    assert.equal(loaded.qcRecords[0].inspectorName, "Fatima Bi");
    assert.equal(loaded.shipments[0].awb, "HBH-AWB-1");

    const ok = await store.upsertState({
      orders: [{ orderNumber: "HBH-PG-2", status: "IN_PRODUCTION", pricing: { totalPaise: 350000 } }],
      qcRecords: [{ orderNumber: "HBH-PG-2", inspectorName: "Fatima Bi", passed: true }],
      shipments: [{ awb: "HBH-AWB-2", orderNumber: "HBH-PG-2", carrier: "Delhivery Air", status: "MANIFEST_CREATED" }]
    });
    assert.equal(ok, true);
    assert.ok(queries.some((q) => q.sql === "BEGIN"));
    assert.ok(queries.some((q) => q.sql.includes("INSERT INTO hbh_orders") && q.sql.includes("UNNEST")));
    assert.ok(queries.some((q) => q.sql === "COMMIT"));
  });

  test("PersistenceEngine & InquiryService automatically use os.tmpdir() on Vercel read-only FS", () => {
    const prevVercel = process.env.VERCEL;
    try {
      process.env.VERCEL = "1";
      const engine = new PersistenceEngine();
      const inq = new InquiryService();
      assert.ok(engine.dataDir.startsWith(os.tmpdir()), `Expected tmpdir on VERCEL=1, got ${engine.dataDir}`);
      assert.ok(inq.dataDir.startsWith(os.tmpdir()), `Expected tmpdir on VERCEL=1, got ${inq.dataDir}`);
    } finally {
      if (prevVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = prevVercel;
    }
  });

  test("Health endpoints surface database mode & connectivity status", async () => {
    const hRes = await fetch(`${baseUrl}/health?deep=1`);
    assert.equal(hRes.status, 200);
    const hJson = await hRes.json();
    assert.equal(hJson.status, "healthy");
    assert.ok(hJson.database && typeof hJson.database.mode === "string");

    const sRes = await fetch(`${baseUrl}/api/v1/system/health`);
    assert.equal(sRes.status, 200);
    const sJson = await sRes.json();
    assert.equal(sJson.success, true);
    assert.ok(sJson.data.database && typeof sJson.data.database.mode === "string");
  });
});
