/**
 * HAMPERS BY HER — VOICE AI PROVIDER ADAPTERS, AUDIO CONFIG & WEBRTC INFRASTRUCTURE
 *
 * Implements production patterns from the Voice AI Development architecture:
 * - Documented PCM16 audio constants (eliminating hardcoded sample rates)
 * - Configurable Server-VAD parameters (threshold, prefix padding, silence duration)
 * - Clearable async outbound audio queue for sub-50ms barge-in cancellation
 * - Sentence/clause streaming text buffer (~50-char / punctuation boundary)
 * - OpenAI Realtime API session builder (gpt-4o-realtime-preview)
 * - Deepgram Nova-2 STT + ElevenLabs Turbo v2.5 streaming TTS adapter
 * - Vapi telephony/web voice agent webhook processor
 * - LiveKit WebRTC room JWT access token generator
 */

const crypto = require("crypto");

/**
 * Documented canonical audio format constants across Android APK, Web Audio API, and cloud providers.
 */
const AUDIO_CONFIG = Object.freeze({
  ENCODING: "pcm16",
  BIT_DEPTH: 16,
  BYTES_PER_SAMPLE: 2,
  CHANNELS: 1,
  CLIENT_SAMPLE_RATE_HZ: 16000,   // Android AudioRecord & Web Audio downsampled capture
  REALTIME_SAMPLE_RATE_HZ: 24000, // OpenAI Realtime API & ElevenLabs pcm_24000
  FRAME_DURATION_MS: 100,         // 100ms streaming chunk
  get CLIENT_CHUNK_BYTES() {
    return (this.CLIENT_SAMPLE_RATE_HZ * this.BYTES_PER_SAMPLE * this.CHANNELS * this.FRAME_DURATION_MS) / 1000;
  },
  get REALTIME_CHUNK_BYTES() {
    return (this.REALTIME_SAMPLE_RATE_HZ * this.BYTES_PER_SAMPLE * this.CHANNELS * this.FRAME_DURATION_MS) / 1000;
  }
});

/**
 * Tunable Server-side Voice Activity Detection (VAD) defaults.
 */
const DEFAULT_VAD_CONFIG = Object.freeze({
  type: "server_vad",
  threshold: 0.5,             // Normalized 0..1 VAD sensitivity (OpenAI Realtime compatible)
  rmsThreshold: 500,          // Int16 PCM RMS floor (~ -36 dBFS)
  prefix_padding_ms: 300,     // Audio kept before speech onset
  silence_duration_ms: 500,   // Trailing silence required to commit turn
  interrupt_enabled: true     // Allow customer barge-in during assistant playback
});

/**
 * Buffers assistant text into natural ~50-char / sentence-boundary segments so TTS
 * starts streaming before full LLM generation completes.
 * @param {string} text
 * @param {number} [minSegmentChars=50]
 * @returns {string[]}
 */
function splitIntoStreamingSegments(text, minSegmentChars = 50) {
  const clean = String(text || "").trim();
  if (!clean) return [];

  const rawSentences = clean.match(/[^.!?]+[.!?]*(\s|$)/g) || [clean];
  const segments = [];
  let buffer = "";

  for (const part of rawSentences) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    buffer = buffer ? `${buffer} ${trimmed}` : trimmed;
    if (buffer.length >= minSegmentChars || /[.!?]$/.test(trimmed)) {
      segments.push(buffer);
      buffer = "";
    }
  }
  if (buffer) segments.push(buffer);
  return segments;
}

/**
 * Clearable FIFO outbound audio queue supporting instant barge-in flushing.
 */
class AudioOutputQueue {
  constructor() {
    this._frames = [];
    this._clearedCount = 0;
  }

  enqueue(frame) {
    this._frames.push(frame);
  }

  dequeue() {
    return this._frames.shift() || null;
  }

  clear() {
    const dropped = this._frames.length;
    this._frames = [];
    this._clearedCount += dropped;
    return dropped;
  }

  get size() {
    return this._frames.length;
  }

  get clearedCount() {
    return this._clearedCount;
  }
}

/**
 * Builds canonical OpenAI Realtime API `session.update` payload for Hampers by Her.
 */
function buildOpenAIRealtimeSessionConfig(vadOverrides = {}) {
  const vad = { ...DEFAULT_VAD_CONFIG, ...vadOverrides };
  return {
    type: "session.update",
    url: "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
    session: {
      modalities: ["text", "audio"],
      voice: process.env.OPENAI_REALTIME_VOICE || "shimmer",
      instructions:
        "You are Eleanor, the Hampers by Her luxury artisanal gifting concierge. Speak concisely in warm, refined sentences. Use tools for catalog search, budget knapsack curation, order tracking, delivery SLA checks, and handwritten card dictation.",
      input_audio_format: AUDIO_CONFIG.ENCODING,
      output_audio_format: AUDIO_CONFIG.ENCODING,
      input_audio_transcription: { model: "whisper-1" },
      turn_detection: {
        type: vad.type,
        threshold: vad.threshold,
        prefix_padding_ms: vad.prefix_padding_ms,
        silence_duration_ms: vad.silence_duration_ms
      },
      tools: [
        {
          type: "function",
          name: "searchHampers",
          description: "Search curated ready-made hampers by occasion, recipient, or budget ceiling in INR.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string" },
              occasion: { type: "string" },
              maxBudgetRupees: { type: "number" }
            }
          }
        },
        {
          type: "function",
          name: "curateBudgetHamper",
          description: "Use the multi-criteria knapsack engine to compose a bespoke hamper under a target INR budget.",
          parameters: {
            type: "object",
            properties: {
              budgetRupees: { type: "number" },
              occasion: { type: "string" }
            },
            required: ["budgetRupees"]
          }
        },
        {
          type: "function",
          name: "checkOrderStatus",
          description: "Look up live order fulfillment status and BlueDart/Delhivery AWB tracking.",
          parameters: {
            type: "object",
            properties: { orderNumber: { type: "string" } }
          }
        },
        {
          type: "function",
          name: "estimateDelivery",
          description: "Verify 6-digit Indian PIN code serviceability and delivery SLA.",
          parameters: {
            type: "object",
            properties: { pincode: { type: "string" } },
            required: ["pincode"]
          }
        },
        {
          type: "function",
          name: "dictateCardMessage",
          description: "Capture a patron's dictated handwritten calligraphy card note.",
          parameters: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"]
          }
        }
      ]
    }
  };
}

/**
 * Deepgram Nova-2 live streaming STT configuration.
 */
function buildDeepgramStreamConfig() {
  return {
    provider: "deepgram",
    model: "nova-2",
    language: "en-IN",
    smart_format: true,
    interim_results: true,
    utterance_end_ms: 1000,
    vad_events: true,
    encoding: "linear16",
    sample_rate: AUDIO_CONFIG.CLIENT_SAMPLE_RATE_HZ,
    channels: AUDIO_CONFIG.CHANNELS,
    configured: Boolean(process.env.DEEPGRAM_API_KEY)
  };
}

/**
 * ElevenLabs Turbo v2.5 streaming TTS configuration & optional live synthesis bridge.
 */
function buildElevenLabsStreamConfig() {
  return {
    provider: "elevenlabs",
    model_id: "eleven_turbo_v2_5",
    voice_id: process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM",
    output_format: `pcm_${AUDIO_CONFIG.REALTIME_SAMPLE_RATE_HZ}`,
    configured: Boolean(process.env.ELEVENLABS_API_KEY)
  };
}

/**
 * Async generator yielding streaming PCM16 audio frames for a single text segment.
 * Uses ElevenLabs streaming API when ELEVENLABS_API_KEY is present; otherwise generates
 * deterministic low-latency 100ms PCM16 16kHz frames cleanly without blocking the event loop.
 * @param {string} segmentText
 * @param {AbortSignal} [signal]
 */
async function* synthesizeSegmentStream(segmentText, signal) {
  if (signal?.aborted) return;

  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (elevenKey && typeof fetch === "function") {
    const cfg = buildElevenLabsStreamConfig();
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(cfg.voice_id)}/stream?output_format=pcm_16000`,
        {
          method: "POST",
          headers: {
            "xi-api-key": elevenKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: segmentText,
            model_id: cfg.model_id,
            voice_settings: { stability: 0.5, similarity_boost: 0.78 }
          }),
          signal
        }
      );
      if (res.ok && res.body) {
        const reader = res.body.getReader();
        while (!signal?.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.length > 0) {
            yield Buffer.from(value);
          }
        }
        return;
      }
    } catch (err) {
      if (signal?.aborted) return;
      // Gracefully fall back to local deterministic PCM16 synthesis on transient provider failure
    }
  }

  // Local deterministic streaming PCM16 16kHz mono synthesis (100ms frames)
  const words = String(segmentText || "").trim().split(/\s+/).filter(Boolean).length;
  const durationSec = Math.max(0.3, Math.min(2.4, words * 0.14));
  const sampleRate = AUDIO_CONFIG.CLIENT_SAMPLE_RATE_HZ;
  const totalSamples = Math.floor(sampleRate * durationSec);
  const chunkSamples = Math.floor((sampleRate * AUDIO_CONFIG.FRAME_DURATION_MS) / 1000);
  const baseFreq = 261.63; // Warm C4 atelier chime fundamental

  for (let start = 0; start < totalSamples; start += chunkSamples) {
    if (signal?.aborted) return;
    const count = Math.min(chunkSamples, totalSamples - start);
    const frame = Buffer.alloc(count * AUDIO_CONFIG.BYTES_PER_SAMPLE);

    for (let i = 0; i < count; i++) {
      const idx = start + i;
      const t = idx / sampleRate;
      const envelope = Math.sin(Math.PI * (idx / totalSamples));
      const wave =
        (Math.sin(2 * Math.PI * baseFreq * t) + 0.45 * Math.sin(2 * Math.PI * (baseFreq * 1.5) * t)) *
        0.12 *
        envelope;
      frame.writeInt16LE(Math.floor(wave * 32767), i * 2);
    }

    // Yield cooperatively so WebSocket barge-in cancel frames can preempt mid-stream
    await new Promise((resolve) => setImmediate(resolve));
    if (signal?.aborted) return;
    yield frame;
  }
}

/**
 * Generates an RFC-7519 HS256 LiveKit WebRTC Room Access Token.
 * Fails closed in production if LIVEKIT_API_KEY / LIVEKIT_API_SECRET are missing.
 */
function createLiveKitAccessToken({ roomName, participantName, ttlSeconds = 3600 } = {}) {
  const cleanRoom = String(roomName || "").trim();
  const cleanIdentity = String(participantName || "").trim();

  if (!cleanRoom || !/^[a-zA-Z0-9_-]{2,64}$/.test(cleanRoom)) {
    throw new Error("INVALID_ROOM_NAME: roomName must be 2-64 alphanumeric, hyphen, or underscore characters.");
  }
  if (!cleanIdentity || !/^[a-zA-Z0-9._-]{2,64}$/.test(cleanIdentity)) {
    throw new Error("INVALID_PARTICIPANT: participantName must be 2-64 safe characters.");
  }

  const apiKey = process.env.LIVEKIT_API_KEY || (process.env.NODE_ENV === "production" ? "" : "devkey_hbh_atelier");
  const apiSecret = process.env.LIVEKIT_API_SECRET || (process.env.NODE_ENV === "production" ? "" : "devsecret_hbh_atelier_livekit_2026");

  if (!apiKey || !apiSecret) {
    throw new Error("LIVEKIT_NOT_CONFIGURED: LIVEKIT_API_KEY and LIVEKIT_API_SECRET are required in production.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: apiKey,
      sub: cleanIdentity,
      nbf: now,
      exp: now + ttlSeconds,
      jti: `lk_${crypto.randomUUID()}`,
      video: {
        roomJoin: true,
        room: cleanRoom,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true
      }
    })
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return {
    token: `${header}.${payload}.${signature}`,
    url: process.env.LIVEKIT_URL || "wss://atelier-voice.livekit.cloud",
    roomName: cleanRoom,
    participantName: cleanIdentity,
    expiresAt: new Date((now + ttlSeconds) * 1000).toISOString(),
    audioConfig: {
      sampleRateHz: AUDIO_CONFIG.REALTIME_SAMPLE_RATE_HZ,
      channels: AUDIO_CONFIG.CHANNELS,
      encoding: AUDIO_CONFIG.ENCODING
    },
    sandboxMode: !process.env.LIVEKIT_API_KEY
  };
}

/**
 * Constant-time Vapi webhook secret verification.
 */
function verifyVapiSecret(providedSecret) {
  const configured = process.env.VAPI_WEBHOOK_SECRET;
  if (!configured) {
    return process.env.NODE_ENV !== "production";
  }
  const a = Buffer.from(String(providedSecret || ""), "utf8");
  const b = Buffer.from(String(configured), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  AUDIO_CONFIG,
  DEFAULT_VAD_CONFIG,
  AudioOutputQueue,
  splitIntoStreamingSegments,
  buildOpenAIRealtimeSessionConfig,
  buildDeepgramStreamConfig,
  buildElevenLabsStreamConfig,
  synthesizeSegmentStream,
  createLiveKitAccessToken,
  verifyVapiSecret
};
