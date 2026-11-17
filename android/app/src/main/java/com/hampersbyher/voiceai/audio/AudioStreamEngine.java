package com.hampersbyher.voiceai.audio;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.AudioTrack;
import android.media.MediaRecorder;
import android.util.Log;

import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Low-latency audio streaming engine:
 * - Records 16-bit linear PCM at 16kHz mono using documented constants.
 * - Streams audio to listener with RMS amplitude telemetry.
 * - Uses a clearable non-blocking LinkedBlockingQueue + dedicated playback thread
 *   for zero-jank AudioTrack MODE_STREAM output and instant barge-in queue clearing.
 */
public class AudioStreamEngine {
    private static final String TAG = "AudioStreamEngine";
    public static final int SAMPLE_RATE = 16000;
    public static final int BYTES_PER_SAMPLE = 2;
    public static final int FRAME_DURATION_MS = 100;
    public static final int CHUNK_BYTES = (SAMPLE_RATE * BYTES_PER_SAMPLE * FRAME_DURATION_MS) / 1000; // 3200B
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
    private Thread playbackThread;
    private final LinkedBlockingQueue<byte[]> playbackQueue = new LinkedBlockingQueue<>();
    private final AtomicBoolean isRecording = new AtomicBoolean(false);
    private final AtomicBoolean isPlaying = new AtomicBoolean(false);
    private final AtomicBoolean playbackWorkerActive = new AtomicBoolean(false);
    private final VoiceActivityDetector vad = new VoiceActivityDetector();
    private AudioListener listener;

    public AudioStreamEngine(AudioListener listener) {
        this.listener = listener;
        initAudioTrack();
        startPlaybackWorker();
    }

    private void startPlaybackWorker() {
        if (playbackWorkerActive.getAndSet(true)) return;
        playbackThread = new Thread(() -> {
            while (playbackWorkerActive.get()) {
                try {
                    byte[] pcmData = playbackQueue.take();
                    if (!playbackWorkerActive.get() || pcmData.length == 0) continue;
                    synchronized (this) {
                        if (audioTrack == null || audioTrack.getState() != AudioTrack.STATE_INITIALIZED) {
                            initAudioTrack();
                        }
                        if (audioTrack != null) {
                            isPlaying.set(true);
                            audioTrack.write(pcmData, 0, pcmData.length);
                        }
                    }
                    if (playbackQueue.isEmpty()) {
                        isPlaying.set(false);
                    }
                } catch (InterruptedException ie) {
                    if (!playbackWorkerActive.get()) break;
                } catch (Exception e) {
                    Log.e(TAG, "Playback worker error: " + e.getMessage());
                }
            }
        }, "AudioPlaybackThread");
        playbackThread.start();
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
            int bufferSize = Math.max(minBufferSize * 2, CHUNK_BYTES);

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
                byte[] buffer = new byte[CHUNK_BYTES];
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
     * Enqueues a streaming audio chunk to the non-blocking playback worker queue.
     */
    public void playAudioChunk(byte[] pcmData) {
        if (pcmData == null || pcmData.length == 0) return;
        playbackQueue.offer(pcmData);
    }

    /**
     * Instantly clears the outbound playback queue and flushes AudioTrack upon customer barge-in.
     */
    public synchronized void abortPlayback() {
        playbackQueue.clear();
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

    public int getPendingPlaybackChunks() {
        return playbackQueue.size();
    }

    public boolean isRecording() {
        return isRecording.get();
    }

    public boolean isPlaying() {
        return isPlaying.get();
    }

    public void release() {
        stopRecording();
        playbackWorkerActive.set(false);
        playbackQueue.clear();
        if (playbackThread != null) {
            playbackThread.interrupt();
            playbackThread = null;
        }
        if (audioTrack != null) {
            try {
                audioTrack.stop();
                audioTrack.release();
                audioTrack = null;
            } catch (Exception ignored) {}
        }
    }
}
