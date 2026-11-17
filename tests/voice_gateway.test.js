const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const WebSocket = require("ws");
const { httpServer } = require("../server/index");
const {
  AUDIO_CONFIG,
  DEFAULT_VAD_CONFIG,
  AudioOutputQueue,
  splitIntoStreamingSegments,
  buildOpenAIRealtimeSessionConfig
} = require("../server/services/voiceProviders");

function generateTonePcm16(sampleRate, durationMs, amplitude = 8000, freqHz = 440) {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const buf = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.floor(Math.sin((2 * Math.PI * freqHz * i) / sampleRate) * amplitude);
    buf.writeInt16LE(sample, i * 2);
  }
  return buf;
}

function generateSilencePcm16(sampleRate, durationMs) {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  return Buffer.alloc(numSamples * 2); // all zeros
}

describe("VoiceAiGateway - Real-Time Streaming, Providers & Domain Orchestration", () => {
  let server;
  let serverPort;

  before((_, done) => {
    server = httpServer.listen(0, () => {
      serverPort = server.address().port;
      done();
    });
  });

  after((_, done) => {
    server.close(done);
  });

  it("AUDIO_CONFIG, VAD defaults, clearable AudioOutputQueue, and ~50-char streaming segments are well-defined", () => {
    assert.strictEqual(AUDIO_CONFIG.ENCODING, "pcm16");
    assert.strictEqual(AUDIO_CONFIG.CLIENT_SAMPLE_RATE_HZ, 16000);
    assert.strictEqual(AUDIO_CONFIG.REALTIME_SAMPLE_RATE_HZ, 24000);
    assert.strictEqual(AUDIO_CONFIG.CLIENT_CHUNK_BYTES, 3200);
    assert.strictEqual(DEFAULT_VAD_CONFIG.silence_duration_ms, 500);

    const q = new AudioOutputQueue();
    q.enqueue(Buffer.from([1, 2]));
    q.enqueue(Buffer.from([3, 4]));
    assert.strictEqual(q.size, 2);
    const dropped = q.clear();
    assert.strictEqual(dropped, 2);
    assert.strictEqual(q.size, 0);
    assert.strictEqual(q.clearedCount, 2);

    const segments = splitIntoStreamingSegments("First luxury sentence for wedding gifting. Second sentence with handmade ribbon and wax seal.", 50);
    assert.ok(segments.length >= 2);

    const oaCfg = buildOpenAIRealtimeSessionConfig();
    assert.strictEqual(oaCfg.type, "session.update");
    assert.strictEqual(oaCfg.session.input_audio_format, "pcm16");
    assert.ok(oaCfg.session.tools.some((t) => t.name === "curateBudgetHamper"));
  });

  it("REST endpoint /api/v1/voice/status returns operational status, audioConfig, VAD, and provider capabilities", async () => {
    const res = await fetch(`http://localhost:${serverPort}/api/v1/voice/status`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, "operational");
    assert.strictEqual(body.data.websocketEndpoint, "/api/v1/voice/stream");
    assert.strictEqual(body.data.vapiWebhookEndpoint, "/api/v1/voice/vapi/webhook");
    assert.strictEqual(body.data.livekitTokenEndpoint, "/api/v1/voice/livekit/token");
    assert.strictEqual(body.data.audioConfig.clientSampleRateHz, 16000);
    assert.strictEqual(body.data.vadDefaults.silence_duration_ms, 500);
    assert.ok(body.data.tools.includes("searchHampers"));
    assert.ok(body.data.tools.includes("curateBudgetHamper"));
    assert.ok(body.data.tools.includes("dictateCardMessage"));
  });

  it("WebSocket initiates voice session with explicit VAD config and supports session.update", (context, done) => {
    const ws = new WebSocket(`ws://localhost:${serverPort}/api/v1/voice/stream`);

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "session.created") {
        assert.ok(msg.session.id.startsWith("v_sess_"));
        assert.strictEqual(msg.session.audio_format, "pcm16");
        assert.strictEqual(msg.session.sample_rate, 16000);
        assert.strictEqual(msg.session.turn_detection.silence_duration_ms, 500);
        assert.ok(msg.session.tools.includes("searchHampers"));

        ws.send(JSON.stringify({
          type: "session.update",
          session: { turn_detection: { threshold: 0.65, silence_duration_ms: 400 } }
        }));
      }

      if (msg.type === "session.updated") {
        assert.strictEqual(msg.session.turn_detection.threshold, 0.65);
        assert.strictEqual(msg.session.turn_detection.silence_duration_ms, 400);
        ws.close();
        done();
      }
    });

    ws.on("error", done);
  });

  it("Processes user turn, triggers searchHampers tool, and streams audio deltas with TTFA metrics", (context, done) => {
    const ws = new WebSocket(`ws://localhost:${serverPort}/api/v1/voice/stream`);
    let receivedTranscriptDone = false;
    let receivedAudioDelta = false;
    let receivedActionCards = false;

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "session.created") {
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
        assert.strictEqual(typeof msg.response.metrics.ttfaMs, "number");
        ws.close();
        done();
      }
    });

    ws.on("error", done);
  });

  it("Executes real Knapsack curateBudgetHamper and DeliveryService.checkPincode tools over WebSocket", (context, done) => {
    const ws = new WebSocket(`ws://localhost:${serverPort}/api/v1/voice/stream`);
    let stage = 0;

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "session.created") {
        stage = 1;
        ws.send(JSON.stringify({
          type: "conversation.item.create",
          item: { type: "message", role: "user", content: "Curate a custom hamper under 3500" }
        }));
      } else if (stage === 1 && msg.type === "response.function_call") {
        assert.strictEqual(msg.functionCall.name, "curateBudgetHamper");
        assert.ok(msg.functionCall.result.totalPricePaise <= 350000);
        assert.ok(msg.functionCall.result.items.length >= 2);
      } else if (stage === 1 && msg.type === "response.done") {
        stage = 2;
        ws.send(JSON.stringify({
          type: "conversation.item.create",
          item: { type: "message", role: "user", content: "Can you deliver to Mumbai pincode 400001?" }
        }));
      } else if (stage === 2 && msg.type === "response.function_call") {
        assert.strictEqual(msg.functionCall.name, "estimateDelivery");
        assert.strictEqual(msg.functionCall.arguments.pincode, "400001");
        assert.strictEqual(msg.functionCall.arguments.serviceable, true);
      } else if (stage === 2 && msg.type === "response.done") {
        ws.close();
        done();
      }
    });

    ws.on("error", done);
  });

  it("Handles explicit response.cancel barge-in AND Server-VAD binary audio silence auto-endpointing", (context, done) => {
    const ws = new WebSocket(`ws://localhost:${serverPort}/api/v1/voice/stream`);
    let cancelled = false;
    let speechStarted = false;
    let speechStopped = false;

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "session.created") {
        ws.send(JSON.stringify({ type: "response.cancel" }));
      } else if (msg.type === "response.cancelled" && !cancelled) {
        cancelled = true;
        assert.ok(msg.message.includes("interrupted"));
        // Now stream 100ms speech tone followed by 600ms silence to verify server-VAD auto-commit
        ws.send(generateTonePcm16(AUDIO_CONFIG.CLIENT_SAMPLE_RATE_HZ, 100, 9000));
        ws.send(generateSilencePcm16(AUDIO_CONFIG.CLIENT_SAMPLE_RATE_HZ, 600));
      } else if (msg.type === "input_audio_buffer.speech_started") {
        speechStarted = true;
        assert.ok(msg.rms >= DEFAULT_VAD_CONFIG.rmsThreshold);
      } else if (msg.type === "input_audio_buffer.speech_stopped") {
        speechStopped = true;
      } else if (msg.type === "response.done" && cancelled) {
        assert.ok(speechStarted, "Server-VAD should detect speech onset");
        assert.ok(speechStopped, "Server-VAD should auto-endpoint on silence");
        ws.close();
        done();
      }
    });

    ws.on("error", done);
  });

  it("Handles malformed JSON WebSocket frames gracefully without disconnecting", (context, done) => {
    const ws = new WebSocket(`ws://localhost:${serverPort}/api/v1/voice/stream`);

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "session.created") {
        ws.send("{broken-json");
      } else if (msg.type === "error") {
        assert.strictEqual(msg.error.code, "invalid_json_frame");
        ws.close();
        done();
      }
    });

    ws.on("error", done);
  });

  it("Vapi webhook dispatches live function-call tools and archives end-of-call-report transcripts", async () => {
    const fnRes = await fetch(`http://localhost:${serverPort}/api/v1/voice/vapi/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "function-call",
        functionCall: {
          name: "estimateDelivery",
          parameters: { pincode: "110001" }
        }
      })
    });
    assert.strictEqual(fnRes.status, 200);
    const fnJson = await fnRes.json();
    assert.strictEqual(fnJson.result.isServiceable, true);
    assert.strictEqual(fnJson.result.city, "New Delhi");

    const endRes = await fetch(`http://localhost:${serverPort}/api/v1/voice/vapi/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "end-of-call-report",
        call: { id: "vapi_call_991" },
        transcript: "User: Wedding hamper under 4000. Eleanor: Vows & Vines recommended.",
        durationSeconds: 48
      })
    });
    assert.strictEqual(endRes.status, 200);
    const endJson = await endRes.json();
    assert.strictEqual(endJson.ok, true);
    assert.strictEqual(endJson.archived.callId, "vapi_call_991");
  });

  it("LiveKit endpoint issues valid HS256 WebRTC access tokens and rejects invalid room names", async () => {
    const okRes = await fetch(`http://localhost:${serverPort}/api/v1/voice/livekit/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomName: "atelier-vip-room-01",
        participantName: "patron_aditi"
      })
    });
    assert.strictEqual(okRes.status, 200);
    const okJson = await okRes.json();
    assert.strictEqual(okJson.success, true);
    const parts = okJson.data.token.split(".");
    assert.strictEqual(parts.length, 3);
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    assert.strictEqual(claims.sub, "patron_aditi");
    assert.strictEqual(claims.video.room, "atelier-vip-room-01");
    assert.strictEqual(claims.video.roomJoin, true);

    const badRes = await fetch(`http://localhost:${serverPort}/api/v1/voice/livekit/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName: "bad room!@#", participantName: "patron_aditi" })
    });
    assert.strictEqual(badRes.status, 400);
  });
});
