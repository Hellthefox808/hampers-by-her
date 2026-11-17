const express = require("express");
const cors = require("cors");
const path = require("path");
const apiRoutes = require("./routes/api");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} - ${ms}ms`);
  });
  next();
});

// API Routes
app.use("/api/v1", apiRoutes);

// Static Web App Serving
const websitePath = path.join(__dirname, "..", "website");
app.use(express.static(websitePath));

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
}

module.exports = { app, httpServer, voiceGateway };
