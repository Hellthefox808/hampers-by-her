package com.hampersbyher.voiceai.net;

import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;

import com.hampersbyher.voiceai.model.HamperCard;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Native RFC-6455 WebSocket client engineered specifically for Voice AI streaming:
 * - Zero external dependencies (runs directly on Android ART runtime).
 * - Bi-directional binary PCM16 and JSON messaging.
 * - Auto-dispatches UI updates to the Android Main Looper.
 */
public class VoiceAiClient {
    private static final String TAG = "VoiceAiClient";

    public interface Callback {
        void onConnected(String sessionId);
        void onTranscriptDelta(String textDelta);
        void onTranscriptDone(String fullText);
        void onAudioChunkReceived(byte[] pcmData);
        void onActionCardsReceived(List<HamperCard> cards);
        void onPlaybackCancelled();
        void onError(String error);
        void onDisconnected();
    }

    private final Callback callback;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean isConnected = new AtomicBoolean(false);
    private Socket socket;
    private OutputStream outputStream;
    private InputStream inputStream;
    private final SecureRandom secureRandom = new SecureRandom();

    public VoiceAiClient(Callback callback) {
        this.callback = callback;
    }

    public void connect(String urlStr) {
        networkExecutor.execute(() -> {
            try {
                URI uri = new URI(urlStr);
                String host = uri.getHost();
                int port = uri.getPort() > 0 ? uri.getPort() : 80;
                String path = uri.getPath() != null && !uri.getPath().isEmpty() ? uri.getPath() : "/";

                socket = new Socket(host, port);
                outputStream = new BufferedOutputStream(socket.getOutputStream());
                inputStream = new BufferedInputStream(socket.getInputStream());

                // Perform WebSocket Handshake
                byte[] nonce = new byte[16];
                secureRandom.nextBytes(nonce);
                String key = Base64.encodeToString(nonce, Base64.NO_WRAP);

                String request = "GET " + path + " HTTP/1.1\r\n" +
                        "Host: " + host + ":" + port + "\r\n" +
                        "Upgrade: websocket\r\n" +
                        "Connection: Upgrade\r\n" +
                        "Sec-WebSocket-Key: " + key + "\r\n" +
                        "Sec-WebSocket-Version: 13\r\n\r\n";

                outputStream.write(request.getBytes(StandardCharsets.UTF_8));
                outputStream.flush();

                // Read Handshake Response
                ByteArrayOutputStream headerBuffer = new ByteArrayOutputStream();
                int b;
                int matches = 0;
                while ((b = inputStream.read()) != -1) {
                    headerBuffer.write(b);
                    if ((matches == 0 || matches == 2) && b == '\r') {
                        matches++;
                    } else if ((matches == 1 || matches == 3) && b == '\n') {
                        matches++;
                        if (matches == 4) break; // \r\n\r\n reached
                    } else {
                        matches = 0;
                    }
                }

                String headerStr = headerBuffer.toString(StandardCharsets.UTF_8.name());
                if (!headerStr.contains("101 Switching Protocols")) {
                    postError("Handshake failed: " + headerStr);
                    close();
                    return;
                }

                isConnected.set(true);

                // Start Frame Reader Loop
                readFrames();

            } catch (Exception e) {
                Log.e(TAG, "Connection error: " + e.getMessage());
                postError("Connection error: " + e.getMessage());
                close();
            }
        });
    }

    private void readFrames() {
        try {
            while (isConnected.get()) {
                int b1 = inputStream.read();
                if (b1 == -1) break;

                int opcode = b1 & 0x0F;
                int b2 = inputStream.read();
                if (b2 == -1) break;

                boolean masked = (b2 & 0x80) != 0;
                long payloadLength = b2 & 0x7F;

                if (payloadLength == 126) {
                    payloadLength = ((inputStream.read() & 0xFF) << 8) | (inputStream.read() & 0xFF);
                } else if (payloadLength == 127) {
                    payloadLength = 0;
                    for (int i = 0; i < 8; i++) {
                        payloadLength = (payloadLength << 8) | (inputStream.read() & 0xFF);
                    }
                }

                byte[] mask = null;
                if (masked) {
                    mask = new byte[4];
                    readFully(inputStream, mask);
                }

                byte[] payload = new byte[(int) payloadLength];
                readFully(inputStream, payload);

                if (masked && mask != null) {
                    for (int i = 0; i < payload.length; i++) {
                        payload[i] = (byte) (payload[i] ^ mask[i % 4]);
                    }
                }

                handleFrame(opcode, payload);
            }
        } catch (Exception e) {
            Log.e(TAG, "Frame reader error: " + e.getMessage());
        } finally {
            close();
        }
    }

    private void readFully(InputStream is, byte[] target) throws Exception {
        int read = 0;
        while (read < target.length) {
            int count = is.read(target, read, target.length - read);
            if (count == -1) throw new Exception("Unexpected EOF in WebSocket stream");
            read += count;
        }
    }

    private void handleFrame(int opcode, byte[] payload) {
        switch (opcode) {
            case 0x1: // Text Frame
                String text = new String(payload, StandardCharsets.UTF_8);
                handleTextMessage(text);
                break;

            case 0x2: // Binary Frame
                postAudioChunk(payload);
                break;

            case 0x8: // Close Frame
                close();
                break;

            case 0x9: // Ping
                sendFrame(0xA, payload); // Pong
                break;
        }
    }

    private void handleTextMessage(String jsonStr) {
        try {
            JSONObject json = new JSONObject(jsonStr);
            String type = json.optString("type");

            switch (type) {
                case "session.created":
                    JSONObject session = json.optJSONObject("session");
                    String sessionId = session != null ? session.optString("id") : "v_sess_ready";
                    mainHandler.post(() -> callback.onConnected(sessionId));
                    break;

                case "response.audio_transcript.delta":
                    String delta = json.optString("delta");
                    mainHandler.post(() -> callback.onTranscriptDelta(delta));
                    break;

                case "response.audio_transcript.done":
                    String fullText = json.optString("transcript");
                    mainHandler.post(() -> callback.onTranscriptDone(fullText));
                    break;

                case "response.audio.delta":
                    String b64Audio = json.optString("delta");
                    if (!b64Audio.isEmpty()) {
                        byte[] pcmData = Base64.decode(b64Audio, Base64.NO_WRAP);
                        postAudioChunk(pcmData);
                    }
                    break;

                case "response.action_cards":
                    JSONArray cardsArray = json.optJSONArray("cards");
                    List<HamperCard> cards = new ArrayList<>();
                    if (cardsArray != null) {
                        for (int i = 0; i < cardsArray.length(); i++) {
                            HamperCard card = HamperCard.fromJson(cardsArray.optJSONObject(i));
                            if (card != null) cards.add(card);
                        }
                    }
                    mainHandler.post(() -> callback.onActionCardsReceived(cards));
                    break;

                case "response.cancelled":
                    mainHandler.post(callback::onPlaybackCancelled);
                    break;
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to parse JSON event: " + e.getMessage());
        }
    }

    private void postAudioChunk(byte[] pcmData) {
        mainHandler.post(() -> callback.onAudioChunkReceived(pcmData));
    }

    private void postError(String error) {
        mainHandler.post(() -> callback.onError(error));
    }

    public synchronized void sendAudioChunk(byte[] pcmData) {
        if (!isConnected.get() || pcmData == null) return;
        networkExecutor.execute(() -> {
            try {
                JSONObject obj = new JSONObject();
                obj.put("type", "input_audio_buffer.append");
                obj.put("audio", Base64.encodeToString(pcmData, Base64.NO_WRAP));
                sendFrame(0x1, obj.toString().getBytes(StandardCharsets.UTF_8));
            } catch (Exception e) {
                Log.e(TAG, "Error sending audio chunk: " + e.getMessage());
            }
        });
    }

    public synchronized void commitAudioTurn(String clientTranscript) {
        if (!isConnected.get()) return;
        networkExecutor.execute(() -> {
            try {
                JSONObject obj = new JSONObject();
                obj.put("type", "input_audio_buffer.commit");
                if (clientTranscript != null) {
                    obj.put("transcript", clientTranscript);
                }
                sendFrame(0x1, obj.toString().getBytes(StandardCharsets.UTF_8));
            } catch (Exception e) {
                Log.e(TAG, "Error committing turn: " + e.getMessage());
            }
        });
    }

    public synchronized void sendTextQuery(String query) {
        if (!isConnected.get()) return;
        networkExecutor.execute(() -> {
            try {
                JSONObject obj = new JSONObject();
                obj.put("type", "conversation.item.create");
                JSONObject item = new JSONObject();
                item.put("type", "message");
                item.put("role", "user");
                item.put("content", query);
                obj.put("item", item);
                sendFrame(0x1, obj.toString().getBytes(StandardCharsets.UTF_8));
            } catch (Exception e) {
                Log.e(TAG, "Error sending text query: " + e.getMessage());
            }
        });
    }

    public synchronized void cancelAssistant() {
        if (!isConnected.get()) return;
        networkExecutor.execute(() -> {
            try {
                JSONObject obj = new JSONObject();
                obj.put("type", "response.cancel");
                sendFrame(0x1, obj.toString().getBytes(StandardCharsets.UTF_8));
            } catch (Exception e) {
                Log.e(TAG, "Error sending cancel event: " + e.getMessage());
            }
        });
    }

    private synchronized void sendFrame(int opcode, byte[] payload) {
        try {
            if (outputStream == null) return;
            outputStream.write(0x80 | (opcode & 0x0F)); // FIN + opcode

            int len = payload != null ? payload.length : 0;
            byte[] mask = new byte[4];
            secureRandom.nextBytes(mask);

            if (len <= 125) {
                outputStream.write(0x80 | len); // MASK bit set
            } else if (len <= 65535) {
                outputStream.write(0x80 | 126);
                outputStream.write((len >> 8) & 0xFF);
                outputStream.write(len & 0xFF);
            } else {
                outputStream.write(0x80 | 127);
                for (int i = 7; i >= 0; i--) {
                    outputStream.write((int) ((len >> (i * 8)) & 0xFF));
                }
            }

            outputStream.write(mask);

            if (payload != null && len > 0) {
                byte[] maskedPayload = new byte[len];
                for (int i = 0; i < len; i++) {
                    maskedPayload[i] = (byte) (payload[i] ^ mask[i % 4]);
                }
                outputStream.write(maskedPayload);
            }

            outputStream.flush();
        } catch (Exception e) {
            Log.e(TAG, "Failed to send WebSocket frame: " + e.getMessage());
        }
    }

    public void close() {
        if (!isConnected.getAndSet(false)) return;
        try {
            if (outputStream != null) outputStream.close();
            if (inputStream != null) inputStream.close();
            if (socket != null && !socket.isClosed()) socket.close();
        } catch (Exception ignored) {}
        mainHandler.post(callback::onDisconnected);
    }
}
