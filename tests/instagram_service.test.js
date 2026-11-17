const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { InstagramService, DEFAULT_INSTAGRAM_FEED } = require("../server/services/instagramService");

test("InstagramService - Returns default curated feed in sandbox mode", () => {
  const service = new InstagramService();
  const feed = service.getFeed({ limit: 3 });
  assert.equal(feed.success, true);
  assert.equal(feed.data.items.length, 3);
  assert.equal(feed.data.account, "@hampers._by_her");
});

test("InstagramService - Verifies Meta Webhook Challenge handshake", () => {
  const service = new InstagramService();
  const valid = service.verifyWebhookChallenge({
    "hub.mode": "subscribe",
    "hub.verify_token": "hbh_insta_verify_token_2026",
    "hub.challenge": "119827364"
  });
  assert.equal(valid.success, true);
  assert.equal(valid.challenge, "119827364");

  const invalid = service.verifyWebhookChallenge({
    "hub.mode": "subscribe",
    "hub.verify_token": "wrong_token",
    "hub.challenge": "119827364"
  });
  assert.equal(invalid.success, false);
});

test("InstagramService - Verifies X-Hub-Signature-256 HMAC-SHA256 signature", () => {
  const service = new InstagramService();
  const rawBody = Buffer.from(JSON.stringify({ object: "instagram", entry: [] }));
  const validHmac = crypto
    .createHmac("sha256", service.appSecret)
    .update(rawBody)
    .digest("hex");

  const isValid = service.verifyWebhookSignature(rawBody, `sha256=${validHmac}`);
  assert.equal(isValid, true);

  const isInvalid = service.verifyWebhookSignature(rawBody, "sha256=abcdef0123456789");
  assert.equal(isInvalid, false);

  const malformed = service.verifyWebhookSignature(rawBody, "invalid-header");
  assert.equal(malformed, false);
});

test("InstagramService - Classifies incoming DM intent accurately", () => {
  const service = new InstagramService();

  const pricing = service.classifyIntent("Hi, what is the price of the wedding hamper?");
  assert.equal(pricing.intent, "PRICING");
  assert.ok(pricing.score >= 80);

  const wedding = service.classifyIntent("Looking for bridesmaid trousseau favors");
  assert.equal(wedding.intent, "WEDDING");

  const corporate = service.classifyIntent("We need 50 corporate gifts for our leadership team");
  assert.equal(corporate.intent, "CORPORATE_BULK");
});

test("InstagramService - Ingests webhook DM event, provisions CRM lead and drafts response", () => {
  const service = new InstagramService();
  const payload = {
    object: "instagram",
    entry: [
      {
        id: "1784140001",
        messaging: [
          {
            sender: { id: "igsid_user_9918" },
            recipient: { id: "1784140001" },
            timestamp: 1731835000,
            message: {
              mid: "m_12345",
              text: "Hi! Can you tell me the price of the vows hamper?"
            }
          }
        ]
      }
    ]
  };

  const result = service.processIncomingWebhook(payload);
  assert.equal(result.handled, true);
  assert.equal(result.processedEvents, 1);
  assert.equal(result.events[0].classification.intent, "PRICING");
  assert.ok(result.events[0].whatsappHandoffUrl.includes("wa.me"));

  const leads = service.getLeads();
  assert.equal(leads.length, 1);
  assert.equal(leads[0].igsid, "igsid_user_9918");
  assert.equal(leads[0].intent, "PRICING");
});
