const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("http");
const WebSocket = require("ws");
const { app, httpServer, voiceGateway } = require("../server/index");

describe("VoiceAiGateway - Real-Time Streaming & Domain Orchestration", () => {
  let server;
  let serverPort;

  before((_, done) => {
    // Start test server on random available port
    server = httpServer.listen(0, () => {
      serverPort = server.address().port;
      done();
    });
  });

  after((_, done) => {
    server.close(done);
  });

  it("REST endpoint /api/v1/voice/status returns operational status and capabilities", async () => {
    const res = await fetch(`http://localhost:${serverPort}/api/v1/voice/status`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, "operational");
    assert.strictEqual(body.data.websocketEndpoint, "/api/v1/voice/stream");
    assert.ok(body.data.tools.includes("searchHampers"));
    assert.ok(body.data.tools.includes("dictateCardMessage"));
  });

  it("WebSocket initiates voice session with luxury atelier voice tools", (context, done) => {
    const ws = new WebSocket(`ws://localhost:${serverPort}/api/v1/voice/stream`);

    ws.on("open", () => {
      // Wait for session.created
    });

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "session.created") {
        assert.ok(msg.session.id.startsWith("v_sess_"));
        assert.strictEqual(msg.session.audio_format, "pcm16");
        assert.strictEqual(msg.session.sample_rate, 16000);
        assert.ok(msg.session.tools.includes("searchHampers"));
        ws.close();
        done();
      }
    });

    ws.on("error", (err) => {
      done(err);
    });
  });

  it("Processes user turn, triggers searchHampers tool, and streams audio deltas", (context, done) => {
    const ws = new WebSocket(`ws://localhost:${serverPort}/api/v1/voice/stream`);
    let receivedTranscriptDone = false;
    let receivedAudioDelta = false;
    let receivedActionCards = false;

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "session.created") {
        // Send a voice text query turn for wedding hamper
        ws.send(JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: "I need a luxury hamper for an upcoming wedding under ₹4,000"
          }
        }));
      }

      if (msg.type === "response.audio_transcript.done") {
        receivedTranscriptDone = true;
        assert.ok(msg.transcript.includes("Vows & Vines"));
      }

      if (msg.type === "response.action_cards") {
        receivedActionCards = true;
        assert.ok(Array.isArray(msg.cards));
        assert.strictEqual(msg.cards[0].occasion, "Wedding");
      }

      if (msg.type === "response.audio.delta") {
        receivedAudioDelta = true;
        assert.ok(msg.delta.length > 0);
        const pcmBuffer = Buffer.from(msg.delta, "base64");
        assert.ok(pcmBuffer.length > 0);
      }

      if (msg.type === "response.done") {
        assert.ok(receivedTranscriptDone, "Should receive final transcript");
        assert.ok(receivedActionCards, "Should receive visual action cards");
        assert.ok(receivedAudioDelta, "Should receive streaming audio deltas");
        ws.close();
        done();
      }
    });

    ws.on("error", (err) => {
      done(err);
    });
  });

  it("Handles barge-in / interruption by cancelling active assistant playback", (context, done) => {
    const ws = new WebSocket(`ws://localhost:${serverPort}/api/v1/voice/stream`);

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "session.created") {
        // Customer interrupts assistant
        ws.send(JSON.stringify({
          type: "response.cancel"
        }));
      }

      if (msg.type === "response.cancelled") {
        assert.ok(msg.message.includes("interrupted"));
        ws.close();
        done();
      }
    });

    ws.on("error", (err) => {
      done(err);
    });
  });
});
