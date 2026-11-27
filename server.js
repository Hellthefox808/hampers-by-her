/**
 * Hampers by Her — Vercel Fluid Compute Entrypoint
 *
 * Explicitly imports `express` at the root entrypoint so Vercel's `@vercel/express`
 * detector recognizes `server.js`, mounts all modular Express routes/middleware from
 * `./server/index`, attaches VoiceAiGateway WebSockets onto the Node HTTP server,
 * and exports the `http.Server` instance for Vercel Fluid Compute.
 */

const http = require("http");
const express = require("express");
const { configureExpressApp } = require("./server/index");
const { VoiceAiGateway } = require("./server/services/voiceAiGateway");

const app = express();
configureExpressApp(app);

const httpServer = http.createServer(app);
const voiceGateway = new VoiceAiGateway(httpServer);
app.locals.voiceGateway = voiceGateway;

module.exports = httpServer;
