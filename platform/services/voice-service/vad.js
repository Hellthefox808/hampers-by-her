/**
 * Hampers by Her Atelier AI Platform — Real-Time Voice Activity Detection (VAD)
 * Analyzes PCM16 audio energy frames, detects turn transitions, and signals barge-in.
 */

class VoiceActivityDetector {
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 16000;
    this.frameDurationMs = options.frameDurationMs || 30; // 30ms audio window
    this.frameByteLength = (this.sampleRate * (this.frameDurationMs / 1000)) * 2; // 16-bit = 2 bytes per sample (960 bytes)
    this.energyThreshold = options.energyThreshold || 0.015; // RMS threshold
    this.silenceTimeoutMs = options.silenceTimeoutMs || 450; // Milliseconds of silence to trigger turn end

    this.isSpeaking = false;
    this.lastSpeechTime = 0;
    this.consecutiveSpeechFrames = 0;
    this.requiredSpeechFrames = 2; // At least 60ms of continuous energy
  }

  /**
   * Process incoming PCM16 audio chunk
   * @param {Buffer} pcmBuffer
   * @returns {Object} VAD analysis event
   */
  processFrame(pcmBuffer) {
    if (!pcmBuffer || pcmBuffer.length < 2) {
      return { isSpeaking: false, energy: 0, event: "SILENCE" };
    }

    // Compute RMS Energy
    let sumSquares = 0;
    const numSamples = Math.floor(pcmBuffer.length / 2);

    for (let i = 0; i < numSamples; i++) {
      const sample = pcmBuffer.readInt16LE(i * 2) / 32768.0; // Normalize -1.0 to 1.0
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / numSamples);
    const now = Date.now();

    let event = "NONE";

    if (rms >= this.energyThreshold) {
      this.consecutiveSpeechFrames++;
      this.lastSpeechTime = now;

      if (!this.isSpeaking && this.consecutiveSpeechFrames >= this.requiredSpeechFrames) {
        this.isSpeaking = true;
        event = "SPEECH_STARTED"; // Triggers immediate conversational barge-in
      }
    } else {
      this.consecutiveSpeechFrames = 0;
      if (this.isSpeaking) {
        const silenceDuration = now - this.lastSpeechTime;
        if (silenceDuration >= this.silenceTimeoutMs) {
          this.isSpeaking = false;
          event = "SPEECH_ENDED"; // Triggers turn finalization
        }
      }
    }

    return {
      isSpeaking: this.isSpeaking,
      rmsEnergy: parseFloat(rms.toFixed(4)),
      event
    };
  }

  reset() {
    this.isSpeaking = false;
    this.lastSpeechTime = 0;
    this.consecutiveSpeechFrames = 0;
  }
}

module.exports = { VoiceActivityDetector };
