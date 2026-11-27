/**
 * Hampers by Her — Vercel Fluid Compute Entrypoint
 *
 * Exports the HTTP server wrapping the Express 4 app + VoiceAiGateway WebSocket server,
 * following Vercel's native Node Backend / WebSocket Fluid Compute specification.
 */

const { httpServer } = require("./server/index");

module.exports = httpServer;
