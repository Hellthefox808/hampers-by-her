package com.hampersbyher.voiceai.audio;

/**
 * Energy-based Voice Activity Detector (VAD) for real-time audio streams.
 */
public class VoiceActivityDetector {
    private final int energyThreshold;
    private int consecutiveSpeechFrames = 0;
    private int consecutiveSilenceFrames = 0;
    private static final int SPEECH_START_CONFIRMATION_FRAMES = 2;
    private static final int SILENCE_STOP_CONFIRMATION_FRAMES = 12;

    public VoiceActivityDetector(int energyThreshold) {
        this.energyThreshold = energyThreshold;
    }

    public VoiceActivityDetector() {
        this(600); // Conservative default threshold for ambient noise rejection
    }

    /**
     * Computes Root Mean Square (RMS) amplitude of 16-bit linear PCM audio.
     */
    public int calculateRms(byte[] buffer, int readBytes) {
        long sum = 0;
        int numSamples = readBytes / 2;
        if (numSamples == 0) return 0;

        for (int i = 0; i < readBytes - 1; i += 2) {
            short sample = (short) ((buffer[i] & 0xFF) | (buffer[i + 1] << 8));
            sum += (long) sample * sample;
        }

        return (int) Math.sqrt((double) sum / numSamples);
    }

    /**
     * Checks if the frame represents active speech.
     */
    public boolean processFrame(int rms) {
        if (rms > energyThreshold) {
            consecutiveSpeechFrames++;
            consecutiveSilenceFrames = 0;
            return consecutiveSpeechFrames >= SPEECH_START_CONFIRMATION_FRAMES;
        } else {
            consecutiveSilenceFrames++;
            if (consecutiveSilenceFrames > SILENCE_STOP_CONFIRMATION_FRAMES) {
                consecutiveSpeechFrames = 0;
            }
            return consecutiveSpeechFrames >= SPEECH_START_CONFIRMATION_FRAMES;
        }
    }

    public void reset() {
        consecutiveSpeechFrames = 0;
        consecutiveSilenceFrames = 0;
    }
}
