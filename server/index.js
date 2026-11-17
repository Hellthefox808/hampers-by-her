const express = require("express");
const cors = require("cors");
const path = require("path");
const apiRoutes = require("./routes/api");

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Performance Middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
  next();
});

// Middleware
app.use(cors());
app.use(express.json({
  limit: "5mb",
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Request Logging & Performance Telemetry
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} - ${ms}ms`);
  });
  next();
});

// Root Health & Telemetry Probes
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    memory: {
      rssMb: (process.memoryUsage().rss / 1024 / 1024).toFixed(2),
      heapUsedMb: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)
    }
  });
});

// API Routes
app.use("/api/v1", apiRoutes);

// Static Web App Serving with Cache-Control Optimization
const websitePath = path.join(__dirname, "..", "website");
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
  console.error("Internal Server Error:", err);
  res.status(500).json({
    type: "https://hampersbyher.com/errors/internal",
    title: "Internal Server Error",
    status: 500,
    detail: err.message,
    instance: req.originalUrl
  });
});

const http = require("http");
const { VoiceAiGateway } = require("./services/voiceAiGateway");

const httpServer = http.createServer(app);
const voiceGateway = new VoiceAiGateway(httpServer);

if (require.main === module) {
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
    httpServer.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

module.exports = { app, httpServer, voiceGateway };
