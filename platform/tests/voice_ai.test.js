/**
 * Hampers by Her Atelier AI Platform — Voice AI Subsystem Test Suite
 * Tests VAD energy calculations, 12-state session lifecycle, barge-in interruptions, and streaming TTS deltas.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { VoiceActivityDetector } = require("../services/voice-service/vad");
const { VoiceSessionManager, InvalidStateTransitionError } = require("../services/voice-service/sessionManager");
const { VoiceEngine } = require("../services/voice-service/voiceEngine");
const { DatabaseClient } = require("../database/client");
const { ModelGateway } = require("../services/model-gateway/gateway");
const { HybridRetriever } = require("../services/rag-service/hybridRetriever");

describe("Hampers by Her Voice AI Subsystem", () => {
  // Helper to generate synthetic PCM16 buffers
  function createPcmBuffer(durationMs, amplitude = 0, sampleRate = 16000) {
    const numSamples = Math.floor(sampleRate * (durationMs / 1000));
    const buf = Buffer.alloc(numSamples * 2);
    for (let i = 0; i < numSamples; i++) {
      const val = amplitude === 0 ? 0 : Math.sin((2 * Math.PI * 440 * i) / sampleRate) * amplitude;
      buf.writeInt16LE(Math.floor(val), i * 2);
    }
    return buf;
  }

  describe("VoiceActivityDetector (VAD)", () => {
    test("Detects silence when processing zero-energy audio frames", () => {
      const vad = new VoiceActivityDetector({ energyThreshold: 0.015 });
      const silentFrame = createPcmBuffer(30, 0); // 30ms silence
      const result = vad.processFrame(silentFrame);

      assert.strictEqual(result.isSpeaking, false);
      assert.strictEqual(result.rmsEnergy, 0);
      assert.match(result.event, /^(NONE|SILENCE)$/);
    });

    test("Transitions to SPEECH_STARTED after required consecutive speech frames", () => {
      const vad = new VoiceActivityDetector({ energyThreshold: 0.015 });
      const speechFrame = createPcmBuffer(30, 16000); // 50% amplitude sine wave

      // First frame increases consecutive frame counter
      const frame1 = vad.processFrame(speechFrame);
      assert.strictEqual(frame1.isSpeaking, false);
      assert.strictEqual(frame1.event, "NONE");
      assert.ok(frame1.rmsEnergy > 0.015);

      // Second frame satisfies requiredSpeechFrames (>= 2)
      const frame2 = vad.processFrame(speechFrame);
      assert.strictEqual(frame2.isSpeaking, true);
      assert.strictEqual(frame2.event, "SPEECH_STARTED");
    });

    test("Emits SPEECH_ENDED when silence exceeds silenceTimeoutMs", async () => {
      const vad = new VoiceActivityDetector({ energyThreshold: 0.015, silenceTimeoutMs: 50 });
      const speechFrame = createPcmBuffer(30, 16000);

      vad.processFrame(speechFrame);
      vad.processFrame(speechFrame);
      assert.strictEqual(vad.isSpeaking, true);

      // Wait 60ms to exceed silenceTimeoutMs (50ms)
      await new Promise(resolve => setTimeout(resolve, 60));

      const silentFrame = createPcmBuffer(30, 0);
      const result = vad.processFrame(silentFrame);
      assert.strictEqual(result.isSpeaking, false);
      assert.strictEqual(result.event, "SPEECH_ENDED");
    });

    test("Reset restores initial VAD state", () => {
      const vad = new VoiceActivityDetector();
      const speechFrame = createPcmBuffer(30, 16000);
      vad.processFrame(speechFrame);
      vad.processFrame(speechFrame);
      assert.strictEqual(vad.isSpeaking, true);

      vad.reset();
      assert.strictEqual(vad.isSpeaking, false);
      assert.strictEqual(vad.consecutiveSpeechFrames, 0);
    });
  });

  describe("VoiceSessionManager (State Machine & Turn Accounting)", () => {
    test("Initializes in CREATED state with correct session properties", () => {
      const session = new VoiceSessionManager({
        sessionId: "sess_voice_101",
        tenantId: "tenant_alpha",
        userId: "usr_lead_01"
      });

      assert.strictEqual(session.sessionId, "sess_voice_101");
      assert.strictEqual(session.tenantId, "tenant_alpha");
      assert.strictEqual(session.userId, "usr_lead_01");
      assert.strictEqual(session.state, "CREATED");
      assert.strictEqual(session.interruptionCount, 0);
      assert.strictEqual(session.turns.length, 0);
    });

    test("Transitions smoothly through valid operational lifecycle", () => {
      const session = new VoiceSessionManager({
        sessionId: "sess_voice_102",
        tenantId: "tenant_alpha",
        userId: "usr_lead_02"
      });

      const events = [];
      session.on("state_changed", e => events.push(e));

      session.transitionTo("AUTHENTICATED");
      session.transitionTo("CONNECTING");
      session.transitionTo("CONNECTED");
      session.transitionTo("LISTENING");
      session.transitionTo("PROCESSING");
      session.transitionTo("RESPONDING");
      session.transitionTo("LISTENING");
      session.transitionTo("ENDING");
      session.transitionTo("COMPLETED");

      assert.strictEqual(session.state, "COMPLETED");
      assert.strictEqual(events.length, 9);
      assert.strictEqual(events[0].from, "CREATED");
      assert.strictEqual(events[0].to, "AUTHENTICATED");
      assert.strictEqual(events[8].to, "COMPLETED");
    });

    test("Rejects illegal state transitions with InvalidStateTransitionError", () => {
      const session = new VoiceSessionManager({
        sessionId: "sess_voice_103",
        tenantId: "tenant_alpha",
        userId: "usr_lead_03"
      });

      assert.throws(
        () => session.transitionTo("RESPONDING"), // Illegal jump from CREATED directly to RESPONDING
        (err) => {
          assert.ok(err instanceof InvalidStateTransitionError);
          assert.match(err.message, /Illegal voice session transition from CREATED to RESPONDING/);
          return true;
        }
      );
    });

    test("Tracks interruptions and increments counter", () => {
      const session = new VoiceSessionManager({
        sessionId: "sess_voice_104",
        tenantId: "tenant_alpha",
        userId: "usr_lead_04"
      });

      session.transitionTo("AUTHENTICATED");
      session.transitionTo("CONNECTING");
      session.transitionTo("CONNECTED");
      session.transitionTo("LISTENING");
      session.transitionTo("PROCESSING");
      session.transitionTo("RESPONDING");

      // Barge-in interruption
      session.transitionTo("INTERRUPTED", "User spoke during playback");
      assert.strictEqual(session.state, "INTERRUPTED");
      assert.strictEqual(session.interruptionCount, 1);

      session.transitionTo("LISTENING");
      assert.strictEqual(session.state, "LISTENING");
    });

    test("Records turn lifecycle and captures finalized transcripts", () => {
      const session = new VoiceSessionManager({
        sessionId: "sess_voice_105",
        tenantId: "tenant_alpha",
        userId: "usr_lead_05"
      });

      const turn = session.startTurn("USER");
      assert.strictEqual(turn.speaker, "USER");
      assert.strictEqual(turn.isFinal, false);

      const completed = session.completeTurn("Show me quarterly sales forecasts");
      assert.strictEqual(completed.transcript, "Show me quarterly sales forecasts");
      assert.strictEqual(completed.isFinal, true);
      assert.strictEqual(session.turns.length, 1);
      assert.strictEqual(session.activeTurn, null);
    });
  });

  describe("VoiceEngine (Streaming Ingestion, Barge-In & RAG Turn)", () => {
    test("Creates active session and transitions to LISTENING state", () => {
      const engine = new VoiceEngine();
      const session = engine.createSession({
        sessionId: "sess_engine_01",
        tenantId: "tenant_enterprise",
        userId: "usr_exec_01"
      });

      assert.strictEqual(session.sessionId, "sess_engine_01");
      assert.strictEqual(session.manager.state, "LISTENING");
      assert.ok(engine.activeSessions.has("sess_engine_01"));
    });

    test("Triggers conversational barge-in and aborts assistant playback when user interrupts", async () => {
      const engine = new VoiceEngine();
      const session = engine.createSession({
        sessionId: "sess_engine_bargein",
        tenantId: "tenant_enterprise",
        userId: "usr_exec_02"
      });

      // Simulate that assistant is actively synthesizing speech
      session.isAssistantSpeaking = true;
      session.manager.transitionTo("PROCESSING");
      session.manager.transitionTo("RESPONDING");

      let abortedEventReceived = false;
      engine.on("assistant_playback_aborted", (data) => {
        if (data.sessionId === "sess_engine_bargein") abortedEventReceived = true;
      });

      // Ingest loud speech frames
      const loudFrame = createPcmBuffer(30, 20000);
      await engine.ingestAudioChunk("sess_engine_bargein", loudFrame);
      await engine.ingestAudioChunk("sess_engine_bargein", loudFrame);

      assert.strictEqual(session.isAssistantSpeaking, false);
      assert.strictEqual(abortedEventReceived, true);
      assert.strictEqual(session.manager.interruptionCount, 1);
      assert.strictEqual(session.manager.state, "LISTENING");
    });

    test("Processes complete speech turn with simulated RAG and streams TTS deltas", async () => {
      const dbClient = new DatabaseClient({ useMock: true });
      const modelGateway = new ModelGateway();
      const hybridRetriever = new HybridRetriever({ dbClient, modelGateway });

      // Seed knowledge chunk for RAG
      await dbClient.insertDocument("tenant_enterprise", {
        id: "doc_gtm_01",
        fileName: "enterprise_deals.txt"
      });
      await dbClient.insertChunk("tenant_enterprise", {
        chunkId: "chk_gtm_01",
        documentId: "doc_gtm_01",
        content: "Enterprise deal pipeline total value is $4.2M across 18 qualified accounts."
      });

      const engine = new VoiceEngine({ modelGateway, hybridRetriever, dbClient });
      const session = engine.createSession({
        sessionId: "sess_turn_test",
        tenantId: "tenant_enterprise",
        userId: "usr_gtm_01"
      });

      const audioDeltas = [];
      engine.on("assistant_audio_delta", delta => audioDeltas.push(delta));

      // 1. Speak loud frame (SPEECH_STARTED)
      const loudFrame = createPcmBuffer(30, 20000);
      await engine.ingestAudioChunk("sess_turn_test", loudFrame);
      await engine.ingestAudioChunk("sess_turn_test", loudFrame);

      // Wait for silence timeout
      await new Promise(resolve => setTimeout(resolve, 500));

      // 2. Feed silent frame (SPEECH_ENDED)
      const silentFrame = createPcmBuffer(30, 0);
      const turnResult = await engine.ingestAudioChunk("sess_turn_test", silentFrame);

      assert.strictEqual(turnResult.status, undefined); // turn completed
      assert.ok(turnResult.transcript);
      assert.ok(turnResult.replyText);
      assert.ok(turnResult.sentencesCount >= 1);
      assert.ok(turnResult.audioDeltasDispatched >= 1);
      assert.strictEqual(audioDeltas.length, turnResult.audioDeltasDispatched);
      assert.strictEqual(session.manager.state, "LISTENING");
      assert.strictEqual(session.manager.turns.length, 2); // 1 User turn + 1 Assistant turn
    });
  });
});
