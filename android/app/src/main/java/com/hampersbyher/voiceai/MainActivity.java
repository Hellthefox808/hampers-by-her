package com.hampersbyher.voiceai;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.animation.Animation;
import android.view.animation.ScaleAnimation;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import com.hampersbyher.voiceai.audio.AudioStreamEngine;
import com.hampersbyher.voiceai.model.HamperCard;
import com.hampersbyher.voiceai.net.VoiceAiClient;

import java.util.List;

/**
 * Main Activity powering the Hampers by Her luxury Atelier Voice Concierge
 * and dual-mode Storefront.
 */
public class MainActivity extends Activity implements AudioStreamEngine.AudioListener, VoiceAiClient.Callback {
    private static final int PERMISSION_REQ_RECORD_AUDIO = 101;
    private static final String DEFAULT_GATEWAY_URL = "ws://10.0.2.2:3000/api/v1/voice/stream";

    private AudioStreamEngine audioEngine;
    private VoiceAiClient voiceClient;

    // UI Components
    private TextView tvStatus;
    private View viewOrbPulse;
    private ImageButton btnVoiceOrb;
    private ProgressBar pbAmplitude;
    private TextView tvUserTranscript;
    private TextView tvAssistantTranscript;
    private LinearLayout layoutActionCards;
    private EditText etTextQuery;
    private Button btnSendQuery;
    private Button btnToggleMode;
    private View scrollVoiceContainer;
    private WebView webviewStorefront;

    private boolean isVoiceMode = true;
    private int cartCount = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        bindViews();
        setupListeners();
        initEngines();
        checkPermissionsAndConnect();
    }

    private void bindViews() {
        tvStatus = findViewById(R.id.tv_voice_status);
        viewOrbPulse = findViewById(R.id.view_orb_pulse);
        btnVoiceOrb = findViewById(R.id.btn_voice_orb);
        pbAmplitude = findViewById(R.id.pb_amplitude);
        tvUserTranscript = findViewById(R.id.tv_user_transcript);
        tvAssistantTranscript = findViewById(R.id.tv_assistant_transcript);
        layoutActionCards = findViewById(R.id.layout_action_cards);
        etTextQuery = findViewById(R.id.et_text_query);
        btnSendQuery = findViewById(R.id.btn_send_query);
        btnToggleMode = findViewById(R.id.btn_toggle_mode);
        scrollVoiceContainer = findViewById(R.id.scroll_voice_container);
        webviewStorefront = findViewById(R.id.webview_storefront);
    }

    private void setupListeners() {
        btnVoiceOrb.setOnClickListener(v -> handleOrbClick());

        btnSendQuery.setOnClickListener(v -> {
            String query = etTextQuery.getText().toString().trim();
            if (!query.isEmpty()) {
                tvUserTranscript.setText(query);
                tvStatus.setText(R.string.thinking_status);
                voiceClient.sendTextQuery(query);
                etTextQuery.setText("");
            }
        });

        // Quick Suggestion Chips
        findViewById(R.id.chip_wedding).setOnClickListener(v -> sendQuickQuery("Recommend a luxury wedding hamper under ₹4,000"));
        findViewById(R.id.chip_anniversary).setOnClickListener(v -> sendQuickQuery("I need an anniversary keepsake hamper with slow-brewed cocoa"));
        findViewById(R.id.chip_card).setOnClickListener(v -> sendQuickQuery("Draft a handwritten card message for my sister"));
        findViewById(R.id.chip_track).setOnClickListener(v -> sendQuickQuery("Where is order #HBH-1042?"));

        // Mode Switch (Voice Concierge vs. Full Storefront)
        btnToggleMode.setOnClickListener(v -> toggleMode());
    }

    private void sendQuickQuery(String query) {
        tvUserTranscript.setText(query);
        tvStatus.setText(R.string.thinking_status);
        voiceClient.sendTextQuery(query);
    }

    private void toggleMode() {
        isVoiceMode = !isVoiceMode;
        if (isVoiceMode) {
            scrollVoiceContainer.setVisibility(View.VISIBLE);
            webviewStorefront.setVisibility(View.GONE);
            btnToggleMode.setText(R.string.toggle_storefront);
        } else {
            scrollVoiceContainer.setVisibility(View.GONE);
            webviewStorefront.setVisibility(View.VISIBLE);
            btnToggleMode.setText(R.string.toggle_voice);
            setupStorefrontWebView();
        }
    }

    private void setupStorefrontWebView() {
        WebSettings settings = webviewStorefront.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        webviewStorefront.setWebViewClient(new WebViewClient());
        webviewStorefront.loadUrl("http://10.0.2.2:3000/");
    }

    private void initEngines() {
        audioEngine = new AudioStreamEngine(this);
        voiceClient = new VoiceAiClient(this);
    }

    private void checkPermissionsAndConnect() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, PERMISSION_REQ_RECORD_AUDIO);
        } else {
            connectVoiceGateway();
        }
    }

    private void connectVoiceGateway() {
        tvStatus.setText("Connecting to Atelier Voice Gateway…");
        voiceClient.connect(DEFAULT_GATEWAY_URL);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == PERMISSION_REQ_RECORD_AUDIO) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                connectVoiceGateway();
            } else {
                tvStatus.setText("Audio permission required for Voice Concierge");
                Toast.makeText(this, "Microphone permission needed to speak with concierge", Toast.LENGTH_LONG).show();
            }
        }
    }

    private void handleOrbClick() {
        if (audioEngine.isPlaying()) {
            // Customer is interrupting assistant (barge-in)
            audioEngine.abortPlayback();
            voiceClient.cancelAssistant();
            tvStatus.setText(R.string.tap_to_speak);
            stopOrbAnimation();
            return;
        }

        if (audioEngine.isRecording()) {
            // Stop recording turn and commit
            audioEngine.stopRecording();
            voiceClient.commitAudioTurn(null);
            tvStatus.setText(R.string.thinking_status);
            stopOrbAnimation();
        } else {
            // Start recording turn
            audioEngine.startRecording();
            tvStatus.setText(R.string.listening_status);
            startOrbAnimation();
        }
    }

    private void startOrbAnimation() {
        ScaleAnimation pulse = new ScaleAnimation(
                1.0f, 1.35f, 1.0f, 1.35f,
                Animation.RELATIVE_TO_SELF, 0.5f,
                Animation.RELATIVE_TO_SELF, 0.5f
        );
        pulse.setDuration(900);
        pulse.setRepeatCount(Animation.INFINITE);
        pulse.setRepeatMode(Animation.REVERSE);
        viewOrbPulse.startAnimation(pulse);
    }

    private void stopOrbAnimation() {
        viewOrbPulse.clearAnimation();
        pbAmplitude.setProgress(0);
    }

    // --- AudioStreamEngine Callbacks ---
    @Override
    public void onAudioChunkCaptured(byte[] pcmData, int rms) {
        voiceClient.sendAudioChunk(pcmData);
        runOnUiThread(() -> {
            int progress = Math.min(100, rms / 15);
            pbAmplitude.setProgress(progress);
        });
    }

    @Override
    public void onSpeechStarted() {
        runOnUiThread(() -> {
            tvStatus.setText("Listening… (Speech detected)");
            if (audioEngine.isPlaying()) {
                audioEngine.abortPlayback();
                voiceClient.cancelAssistant();
            }
        });
    }

    @Override
    public void onSpeechStopped() {
        runOnUiThread(() -> tvStatus.setText("Processing your request…"));
    }

    @Override
    public void onError(String message) {
        runOnUiThread(() -> Toast.makeText(MainActivity.this, "Audio: " + message, Toast.LENGTH_SHORT).show());
    }

    // --- VoiceAiClient Callbacks ---
    @Override
    public void onConnected(String sessionId) {
        tvStatus.setText("Connected · Tap orb to speak");
        Toast.makeText(this, "Connected to Atelier Voice Concierge", Toast.LENGTH_SHORT).show();
    }

    @Override
    public void onTranscriptDelta(String textDelta) {
        // Progressive streaming transcript
        tvStatus.setText(R.string.speaking_status);
    }

    @Override
    public void onTranscriptDone(String fullText) {
        tvAssistantTranscript.setText(fullText);
        tvStatus.setText(R.string.speaking_status);
    }

    @Override
    public void onAudioChunkReceived(byte[] pcmData) {
        audioEngine.playAudioChunk(pcmData);
    }

    @Override
    public void onActionCardsReceived(List<HamperCard> cards) {
        layoutActionCards.removeAllViews();
        LayoutInflater inflater = LayoutInflater.from(this);

        for (HamperCard card : cards) {
            View cardView = inflater.inflate(R.layout.item_hamper_card, layoutActionCards, false);

            TextView tvBadge = cardView.findViewById(R.id.tv_hamper_badge);
            TextView tvPrice = cardView.findViewById(R.id.tv_hamper_price);
            TextView tvTitle = cardView.findViewById(R.id.tv_hamper_title);
            TextView tvSubtitle = cardView.findViewById(R.id.tv_hamper_subtitle);
            Button btnAdd = cardView.findViewById(R.id.btn_hamper_action);

            tvBadge.setText(card.getBadge());
            tvPrice.setText("₹ " + card.getPriceRupees());
            tvTitle.setText(card.getTitle());
            tvSubtitle.setText(card.getSubtitle());

            btnAdd.setOnClickListener(v -> {
                cartCount++;
                Toast.makeText(MainActivity.this, "Added " + card.getTitle() + " to Hamper (Total: " + cartCount + ")", Toast.LENGTH_SHORT).show();
            });

            layoutActionCards.addView(cardView);
        }
    }

    @Override
    public void onPlaybackCancelled() {
        audioEngine.abortPlayback();
        tvStatus.setText(R.string.tap_to_speak);
        stopOrbAnimation();
    }

    @Override
    public void onDisconnected() {
        tvStatus.setText("Disconnected · Tap orb to reconnect");
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (audioEngine != null) audioEngine.release();
        if (voiceClient != null) voiceClient.close();
    }
}
