package com.hampersbyher.voiceai.audio;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.AudioTrack;
import android.media.MediaRecorder;
import android.util.Log;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Low-latency audio streaming engine:
 * - Records 16-bit linear PCM at 16kHz mono.
 * - Streams audio to listener with RMS amplitude telemetry.
 * - Plays streaming audio chunks via AudioTrack in MODE_STREAM.
 * - Supports instant barge-in / speech interruption cancellation.
 */
public class AudioStreamEngine {
    private static final String TAG = "AudioStreamEngine";
    public static final int SAMPLE_RATE = 16000;
    public static final int CHANNEL_CONFIG_IN = AudioFormat.CHANNEL_IN_MONO;
    public static final int CHANNEL_CONFIG_OUT = AudioFormat.CHANNEL_OUT_MONO;
    public static final int AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT;

    public interface AudioListener {
        void onAudioChunkCaptured(byte[] pcmData, int rms);
        void onSpeechStarted();
        void onSpeechStopped();
        void onError(String message);
    }

    private AudioRecord audioRecord;
    private AudioTrack audioTrack;
    private Thread recordingThread;
    private final AtomicBoolean isRecording = new AtomicBoolean(false);
    private final AtomicBoolean isPlaying = new AtomicBoolean(false);
    private final VoiceActivityDetector vad = new VoiceActivityDetector();
    private AudioListener listener;

    public AudioStreamEngine(AudioListener listener) {
        this.listener = listener;
        initAudioTrack();
    }

    private void initAudioTrack() {
        try {
            int minBufferSize = AudioTrack.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG_OUT, AUDIO_FORMAT);
            int bufferSize = Math.max(minBufferSize * 2, 4096);

            AudioAttributes attributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build();

            AudioFormat format = new AudioFormat.Builder()
                    .setSampleRate(SAMPLE_RATE)
                    .setEncoding(AUDIO_FORMAT)
                    .setChannelMask(CHANNEL_CONFIG_OUT)
                    .build();

            audioTrack = new AudioTrack(
                    attributes,
                    format,
                    bufferSize,
                    AudioTrack.MODE_STREAM,
                    AudioManager.AUDIO_SESSION_ID_GENERATE
            );
            audioTrack.play();
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize AudioTrack: " + e.getMessage());
        }
    }

    public synchronized void startRecording() {
        if (isRecording.get()) return;

        try {
            int minBufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG_IN, AUDIO_FORMAT);
            int bufferSize = Math.max(minBufferSize * 2, 3200); // 100ms chunks at 16kHz 16-bit mono

            audioRecord = new AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    SAMPLE_RATE,
                    CHANNEL_CONFIG_IN,
                    AUDIO_FORMAT,
                    bufferSize
            );

            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                if (listener != null) listener.onError("AudioRecord failed to initialize");
                return;
            }

            audioRecord.startRecording();
            isRecording.set(true);
            vad.reset();

            recordingThread = new Thread(() -> {
                byte[] buffer = new byte[3200]; // 100ms at 16kHz
                boolean wasSpeaking = false;

                while (isRecording.get()) {
                    int readBytes = audioRecord.read(buffer, 0, buffer.length);
                    if (readBytes > 0) {
                        int rms = vad.calculateRms(buffer, readBytes);
                        boolean isSpeakingNow = vad.processFrame(rms);

                        if (isSpeakingNow && !wasSpeaking) {
                            wasSpeaking = true;
                            if (listener != null) listener.onSpeechStarted();
                        } else if (!isSpeakingNow && wasSpeaking) {
                            wasSpeaking = false;
                            if (listener != null) listener.onSpeechStopped();
                        }

                        // Clone chunk for listener delivery
                        byte[] chunk = new byte[readBytes];
                        System.arraycopy(buffer, 0, chunk, 0, readBytes);

                        if (listener != null) {
                            listener.onAudioChunkCaptured(chunk, rms);
                        }
                    }
                }
            }, "AudioRecordingThread");

            recordingThread.start();
        } catch (Exception e) {
            Log.e(TAG, "Error starting recording: " + e.getMessage());
            if (listener != null) listener.onError(e.getMessage());
        }
    }

    public synchronized void stopRecording() {
        if (!isRecording.get()) return;
        isRecording.set(false);

        try {
            if (recordingThread != null) {
                recordingThread.join(500);
                recordingThread = null;
            }
            if (audioRecord != null) {
                audioRecord.stop();
                audioRecord.release();
                audioRecord = null;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error stopping recording: " + e.getMessage());
        }
    }

    /**
     * Plays a streaming audio chunk received from the Voice AI gateway.
     */
    public synchronized void playAudioChunk(byte[] pcmData) {
        if (pcmData == null || pcmData.length == 0) return;
        try {
            if (audioTrack == null || audioTrack.getState() != AudioTrack.STATE_INITIALIZED) {
                initAudioTrack();
            }
            if (audioTrack != null) {
                isPlaying.set(true);
                audioTrack.write(pcmData, 0, pcmData.length);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error playing audio chunk: " + e.getMessage());
        }
    }

    /**
     * Instantly aborts playback upon customer barge-in / speech interruption.
     */
    public synchronized void abortPlayback() {
        try {
            if (audioTrack != null) {
                audioTrack.pause();
                audioTrack.flush();
                audioTrack.play();
            }
            isPlaying.set(false);
        } catch (Exception e) {
            Log.e(TAG, "Error aborting playback: " + e.getMessage());
        }
    }

    public boolean isRecording() {
        return isRecording.get();
    }

    public boolean isPlaying() {
        return isPlaying.get();
    }

    public void release() {
        stopRecording();
        if (audioTrack != null) {
            try {
                audioTrack.stop();
                audioTrack.release();
                audioTrack = null;
            } catch (Exception ignored) {}
        }
    }
}
