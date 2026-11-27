const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const apiRoutes = require("./routes/api");
const http = require("http");
const { VoiceAiGateway } = require("./services/voiceAiGateway");
const { metricsCollector } = require("./services/metricsService");
const { OrderService } = require("./services/orderService");
const { postgresStore } = require("./services/postgresClient");

const PORT = process.env.PORT || 3000;

/**
 * Configures all security headers, telemetry, REST API v1 routes, storefront pages,
 * static file caching headers, and RFC 7807 error handlers onto an Express instance.
 *
 * @param {import("express").Express} app - Express 4 application instance.
 * @returns {import("express").Express} Configured Express application.
 */
function configureExpressApp(app) {
  app.disable("x-powered-by");

  // Security, Correlation ID & Performance Middleware
  app.use((req, res, next) => {
    const incomingReqId = req.headers["x-request-id"];
    const requestId = (typeof incomingReqId === "string" && /^[a-zA-Z0-9._-]{1,64}$/.test(incomingReqId))
      ? incomingReqId
      : `req_${crypto.randomUUID()}`;
    req.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' https: data: blob:; frame-ancestors 'self';"
    );
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
    next();
  });

  // Configurable CORS Allowlist (strict in production, permissive in local dev)
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS_ORIGIN_NOT_ALLOWED"));
    },
    credentials: true
  }));
  app.use(express.json({
    limit: "5mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ extended: true, limit: "5mb" }));

  // Structured JSON Request Logging & Prometheus Telemetry
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - start;
      metricsCollector.observeHttpRequest(req.method, req.path, res.statusCode, ms);
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: ms
      };
      if ((process.env.LOG_LEVEL || "").trim().toLowerCase() !== "silent") {
        if (process.env.LOG_FORMAT === "json") {
          console.log(JSON.stringify(logEntry));
        } else {
          console.log(`[${logEntry.timestamp}] [${logEntry.requestId}] ${logEntry.method} ${req.url} ${logEntry.statusCode} - ${ms}ms`);
        }
      }
    });
    next();
  });

  // Root Health & Telemetry Probes
  app.get("/health", async (req, res) => {
    const dbStatus = req.query.deep === "1"
      ? await postgresStore.ping()
      : {
          enabled: postgresStore.isEnabled(),
          mode: postgresStore.getConnectionMode()
        };
    res.json({
      status: "healthy",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: dbStatus,
      eventLoopLagMs: (metricsCollector.getEventLoopLagSeconds() * 1000).toFixed(2),
      memory: {
        rssMb: (process.memoryUsage().rss / 1024 / 1024).toFixed(2),
        heapUsedMb: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)
      }
    });
  });

  // Production Prometheus / OpenMetrics Exposition Endpoint
  app.get("/metrics", (req, res) => {
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.send(metricsCollector.renderPrometheusMetrics());
  });

  // API Routes
  app.use("/api/v1", apiRoutes);

  // Explicit RFC 7807 JSON 404 for unmatched API paths (prevent HTML SPA fallback on API typos)
  app.use("/api", (req, res) => {
    res.status(404).json({
      type: "https://hampersbyher.com/errors/not-found",
      title: "API Endpoint Not Found",
      status: 404,
      detail: `No route matched ${req.method} ${req.originalUrl}`,
      requestId: req.requestId,
      instance: req.originalUrl
    });
  });

  const rawWebsiteDir = path.join(__dirname, "..", "website");
  const vercelPublicDir = path.join(__dirname, "..", "public");
  const websitePath = fs.existsSync(rawWebsiteDir) ? rawWebsiteDir : vercelPublicDir;

  // Interactive Archify Architecture Diagram Route
  app.get(["/architecture", "/architecture.html"], (req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    const diagramPath = path.join(__dirname, "..", "docs", "diagrams", "hampers_by_her_architecture.html");
    const target = fs.existsSync(diagramPath) ? diagramPath : path.join(websitePath, "architecture.html");
    res.sendFile(target);
  });

  // Clean extensionless routes for Storybook Storefront Multi-Page Views
  const PAGE_ROUTES = [
    ["/catalog", "catalog.html"],
    ["/hamper", "hamper.html"],
    ["/moments", "moments.html"],
    ["/how-it-works", "how-it-works.html"],
    ["/faq", "faq.html"],
    ["/contact", "contact.html"],
    ["/delivered", "delivered.html"],
    ["/admin", "admin.html"],
    ["/lookbook", "lookbook.html"]
  ];
  for (const [routePath, fileName] of PAGE_ROUTES) {
    app.get(routePath, (req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(websitePath, fileName));
    });
  }

  // Static Web App Serving with Cache-Control Optimization
  app.use(express.static(websitePath, {
    maxAge: "1d",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache");
      } else if (filePath.match(/\.(css|js|woff2|jpg|png|webp|svg)$/)) {
        res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      }
    }
  }));

  // Fallback to index.html for client-side navigation
  app.get("*", (req, res) => {
    res.sendFile(path.join(websitePath, "index.html"));
  });

  // Error handling (RFC 7807)
  app.use((err, req, res, next) => {
    const status = err.statusCode || err.status || (err.message === "CORS_ORIGIN_NOT_ALLOWED" ? 403 : 500);
    const isProd = process.env.NODE_ENV === "production";
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      requestId: req.requestId,
      status,
      path: req.originalUrl,
      message: err.message
    }));
    res.status(status).json({
      type: status === 403 ? "https://hampersbyher.com/errors/forbidden" : "https://hampersbyher.com/errors/internal",
      title: status === 403 ? "Forbidden" : "Internal Server Error",
      status,
      detail: isProd && status >= 500 ? "An unexpected internal error occurred." : err.message,
      requestId: req.requestId,
      instance: req.originalUrl
    });
  });

  return app;
}

let defaultBundle = null;
function getDefaultBundle() {
  if (!defaultBundle) {
    const app = configureExpressApp(express());
    const httpServer = http.createServer(app);
    const voiceGateway = new VoiceAiGateway(httpServer);
    app.locals.voiceGateway = voiceGateway;
    defaultBundle = { app, httpServer, voiceGateway };
  }
  return defaultBundle;
}

if (require.main === module) {
  const { httpServer } = getDefaultBundle();
  httpServer.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  HAMPERS BY HER — LUXURY E-COMMERCE PLATFORM`);
    console.log(`  Server running on http://localhost:${PORT}`);
    console.log(`  REST API v1 mounted at http://localhost:${PORT}/api/v1`);
    console.log(`  Voice AI Stream mounted at ws://localhost:${PORT}/api/v1/voice/stream`);
    console.log(`====================================================`);
  });

  const gracefulShutdown = (signal) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    OrderService.flushPersistence();
    metricsCollector.shutdown();
    httpServer.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

module.exports = {
  configureExpressApp,
  metricsCollector,
  get app() {
    return getDefaultBundle().app;
  },
  get httpServer() {
    return getDefaultBundle().httpServer;
  },
  get voiceGateway() {
    return getDefaultBundle().voiceGateway;
  }
};
