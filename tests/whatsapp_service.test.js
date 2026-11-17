const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { WhatsAppService, HSM_TEMPLATES } = require("../server/services/whatsappService");
const { OrderService } = require("../server/services/orderService");

test("WhatsAppService - Verifies Meta Webhook Challenge handshake", () => {
  const service = new WhatsAppService();
  const valid = service.verifyWebhookChallenge({
    "hub.mode": "subscribe",
    "hub.verify_token": "hbh_waa_verify_token_2026",
    "hub.challenge": "ch_987654321"
  });
  assert.equal(valid.success, true);
  assert.equal(valid.challenge, "ch_987654321");

  const invalid = service.verifyWebhookChallenge({
    "hub.mode": "subscribe",
    "hub.verify_token": "wrong_token",
    "hub.challenge": "ch_987654321"
  });
  assert.equal(invalid.success, false);
});

test("WhatsAppService - Verifies X-Hub-Signature-256 HMAC signature", () => {
  const service = new WhatsAppService();
  const rawBody = Buffer.from(JSON.stringify({ test: "data" }));
  const validHmac = crypto
    .createHmac("sha256", service.appSecret)
    .update(rawBody)
    .digest("hex");

  assert.equal(service.verifyWebhookSignature(rawBody, `sha256=${validHmac}`), true);
  assert.equal(service.verifyWebhookSignature(rawBody, "sha256=wrong_signature"), false);
});

test("WhatsAppService - Dispatches HSM Template in sandbox mode", async () => {
  const service = new WhatsAppService();
  const result = await service.sendTemplate("919876543210", "hbh_order_confirmed_v2", {
    customer_name: "Priya Sharma",
    order_number: "HBH-20261117-1001",
    item_count: 2,
    total_amount: "₹3,950",
    eta_date: "2 Days"
  });

  assert.equal(result.success, true);
  assert.equal(result.mode, "sandbox");
  assert.ok(result.messages[0].id.startsWith("wamid.HBH"));
});

test("WhatsAppService - Responds to live Order Status check (HBH-...)", async () => {
  const service = new WhatsAppService();

  // Create an order first via OrderService
  const order = OrderService.createOrder({
    items: [{ id: "prod_wedding_vows", title: "The Vows & Vines Hamper", basePricePaise: 395000 }],
    customer: { name: "Kabir", phone: "919999999999" },
    shippingAddress: { pincode: "110001", city: "New Delhi" }
  });

  const webhookPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              contacts: [{ profile: { name: "Kabir" }, wa_id: "919999999999" }],
              messages: [
                {
                  from: "919999999999",
                  id: "wamid.msg1",
                  type: "text",
                  text: { body: `Status ${order.orderNumber}` }
                }
              ]
            }
          }
        ]
      }
    ]
  };

  const res = await service.handleIncomingWebhook(webhookPayload);
  assert.equal(res.handled, true);
  assert.equal(res.messagesProcessed, 1);
  assert.ok(service.outboundLogs.length > 0);
  const lastOutbound = service.outboundLogs[service.outboundLogs.length - 1];
  assert.ok(lastOutbound.payload.text.body.includes(order.orderNumber));
});

test("WhatsAppService - Handles delivery pincode inquiries with interactive buttons", async () => {
  const service = new WhatsAppService();
  const webhookPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              contacts: [{ profile: { name: "Ananya" }, wa_id: "919888888888" }],
              messages: [
                {
                  from: "919888888888",
                  id: "wamid.msg2",
                  type: "text",
                  text: { body: "Can you deliver to pincode 400001 Mumbai?" }
                }
              ]
            }
          }
        ]
      }
    ]
  };

  const res = await service.handleIncomingWebhook(webhookPayload);
  assert.equal(res.handled, true);
  const lastOutbound = service.outboundLogs[service.outboundLogs.length - 1];
  assert.equal(lastOutbound.payload.type, "interactive");
  assert.ok(lastOutbound.payload.interactive.body.text.includes("400001"));
});

test("WhatsAppService - Escalates to human atelier artisan on keyword 'agent'", async () => {
  const service = new WhatsAppService();
  const webhookPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              contacts: [{ profile: { name: "Rhea" }, wa_id: "919777777777" }],
              messages: [
                {
                  from: "919777777777",
                  id: "wamid.msg3",
                  type: "text",
                  text: { body: "I want to speak to an agent please" }
                }
              ]
            }
          }
        ]
      }
    ]
  };

  await service.handleIncomingWebhook(webhookPayload);
  assert.equal(service.conversations.get("919777777777").state, "OPERATOR_ASSIGNED");
});
