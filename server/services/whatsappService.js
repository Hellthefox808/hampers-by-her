/**
 * Hampers by Her — WhatsApp Business Cloud API Service
 * Implements Meta Cloud API v21.0, X-Hub-Signature-256 verification,
 * HSM template catalog, and 2-way conversational atelier concierge.
 */

const crypto = require("crypto");
const { DeliveryService } = require("./deliveryService");
const { OrderService } = require("./orderService");
const { CatalogService } = require("./catalogService");

// Standard Meta HSM Template Definitions
const HSM_TEMPLATES = {
  hbh_order_confirmed_v2: {
    name: "hbh_order_confirmed_v2",
    category: "UTILITY",
    language: "en_US",
    components: [
      {
        type: "body",
        parameters: ["customer_name", "order_number", "item_count", "total_amount", "eta_date"]
      }
    ]
  },
  hbh_dispatch_update_v1: {
    name: "hbh_dispatch_update_v1",
    category: "UTILITY",
    language: "en_US",
    components: [
      {
        type: "body",
        parameters: ["order_number", "carrier_name", "awb_number", "tracking_link"]
      }
    ]
  },
  hbh_abandoned_cart_reminder_v1: {
    name: "hbh_abandoned_cart_reminder_v1",
    category: "MARKETING",
    language: "en_US",
    components: [
      {
        type: "body",
        parameters: ["customer_name", "hamper_name", "cart_link", "offer_code"]
      }
    ]
  }
};

class WhatsAppService {
  constructor() {
    this.appSecret = process.env.WHATSAPP_APP_SECRET || "hbh_dev_secret_whatsapp_2026";
    this.verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "hbh_waa_verify_token_2026";
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "100293847592019";
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || null;

    // In-memory conversation state ledger: phone -> state
    this.conversations = new Map();
    // Outbound message log
    this.outboundLogs = [];
  }

  /**
   * Meta Webhook Challenge Handshake (hub.challenge)
   */
  verifyWebhookChallenge(query) {
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    if (mode === "subscribe" && token === this.verifyToken) {
      return { success: true, challenge };
    }
    return { success: false, error: "Invalid verify token or subscription mode" };
  }

  /**
   * Verify Meta X-Hub-Signature-256 header using constant-time comparison
   */
  verifyWebhookSignature(rawBody, signatureHeader) {
    if (!signatureHeader || !rawBody) {
      return false;
    }

    const parts = signatureHeader.split("=");
    if (parts.length !== 2 || parts[0] !== "sha256") {
      return false;
    }

    const signature = parts[1];
    const expected = crypto
      .createHmac("sha256", this.appSecret)
      .update(rawBody)
      .digest("hex");

    try {
      const sigBuf = Buffer.from(signature, "hex");
      const expBuf = Buffer.from(expected, "hex");
      if (sigBuf.length !== expBuf.length) {
        return false;
      }
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }

  /**
   * Send generic message payload to Meta Graph API or Sandbox
   */
  async _dispatchPayload(payload) {
    this.outboundLogs.push({
      timestamp: new Date().toISOString(),
      payload
    });

    if (!this.accessToken) {
      // Sandbox / Local Mode: Return simulated Meta message ID
      return {
        success: true,
        mode: "sandbox",
        messages: [{ id: `wamid.HBHSANDBOX_${Date.now()}_${Math.random().toString(36).substring(7)}` }]
      };
    }

    try {
      const url = `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || `HTTP ${res.status}`);
      }
      return { success: true, mode: "live_meta_cloud_api", data };
    } catch (err) {
      return { success: false, error: err.message, fallbackPayload: payload };
    }
  }

  /**
   * Send Free-form Text Message (Within 24h Customer Service Window)
   */
  async sendTextMessage(toPhone, text, previewUrl = false) {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: this._cleanPhone(toPhone),
      type: "text",
      text: {
        preview_url: previewUrl,
        body: text
      }
    };
    return this._dispatchPayload(payload);
  }

  /**
   * Send Interactive Buttons Message
   */
  async sendInteractiveButtons(toPhone, { headerText, bodyText, footerText, buttons }) {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: this._cleanPhone(toPhone),
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.map(b => ({
            type: "reply",
            reply: {
              id: b.id,
              title: b.title.slice(0, 20) // Meta 20-char button limit
            }
          }))
        }
      }
    };

    if (headerText) {
      payload.interactive.header = { type: "text", text: headerText };
    }
    if (footerText) {
      payload.interactive.footer = { text: footerText };
    }

    return this._dispatchPayload(payload);
  }

  /**
   * Send Pre-approved HSM Template Message
   */
  async sendTemplate(toPhone, templateKey, parameterValues = {}) {
    const templateDef = HSM_TEMPLATES[templateKey];
    if (!templateDef) {
      throw new Error(`Unregistered WhatsApp HSM Template: ${templateKey}`);
    }

    const bodyParams = templateDef.components[0].parameters.map(paramName => ({
      type: "text",
      text: String(parameterValues[paramName] || "")
    }));

    const payload = {
      messaging_product: "whatsapp",
      to: this._cleanPhone(toPhone),
      type: "template",
      template: {
        name: templateDef.name,
        language: { code: templateDef.language },
        components: [
          {
            type: "body",
            parameters: bodyParams
          }
        ]
      }
    };

    return this._dispatchPayload(payload);
  }

  /**
   * Dispatch Transactional Order Notifications
   */
  async notifyOrderEvent(order, eventType) {
    const phone = order.customer?.phone || order.shippingAddress?.phone;
    if (!phone) {
      return { success: false, reason: "Missing customer phone number" };
    }

    switch (eventType) {
      case "ORDER_CONFIRMED":
        return this.sendTemplate(phone, "hbh_order_confirmed_v2", {
          customer_name: order.customer?.name || "Patron",
          order_number: order.orderNumber,
          item_count: order.items?.length || 1,
          total_amount: `₹${order.pricing?.totalRupees || "0"}`,
          eta_date: "2-4 Business Days"
        });

      case "ORDER_DISPATCHED":
        return this.sendTemplate(phone, "hbh_dispatch_update_v1", {
          order_number: order.orderNumber,
          carrier_name: order.fulfillment?.carrier || "BlueDart Express",
          awb_number: order.fulfillment?.awb || "HBH-EXP-91823",
          tracking_link: `https://hampersbyher.com/track/${order.orderNumber}`
        });

      default:
        return this.sendTextMessage(
          phone,
          `Atelier Update for Order #${order.orderNumber}: Status changed to ${order.status}.`
        );
    }
  }

  /**
   * Process incoming Webhook Payload from Meta Cloud API
   */
  async handleIncomingWebhook(payload) {
    if (!payload || payload.object !== "whatsapp_business_account") {
      return { handled: false, reason: "Not a whatsapp_business_account event" };
    }

    const responses = [];
    const entries = Array.isArray(payload.entry) ? payload.entry : [];

    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        if (change.field !== "messages") continue;

        const value = change.value;
        const contact = value.contacts?.[0] || {};
        const messages = Array.isArray(value.messages) ? value.messages : [];

        for (const msg of messages) {
          const fromPhone = msg.from;
          const senderName = contact.profile?.name || "Patron";

          let messageText = "";
          let buttonId = null;

          if (msg.type === "text") {
            messageText = msg.text?.body || "";
          } else if (msg.type === "interactive") {
            buttonId = msg.interactive?.button_reply?.id;
            messageText = msg.interactive?.button_reply?.title || "";
          }

          const botReply = await this._processConversationalTurn(fromPhone, senderName, messageText, buttonId);
          responses.push({
            from: fromPhone,
            userMessage: messageText,
            replySent: botReply
          });
        }
      }
    }

    return {
      handled: true,
      messagesProcessed: responses.length,
      events: responses
    };
  }

  /**
   * Conversational State Machine Logic
   */
  async _processConversationalTurn(phone, name, text, buttonId) {
    const raw = (text || "").trim();
    const upper = raw.toUpperCase();

    // 1. Order Status Check
    const orderMatch = raw.match(/HBH-\d+-\d+/i) || (upper.startsWith("STATUS") && raw.split(/\s+/)[1]);
    if (orderMatch) {
      const orderNum = typeof orderMatch === "string" ? orderMatch : orderMatch[0];
      const order = OrderService.getOrderByNumber(orderNum);

      if (order) {
        const statusText = `🌸 *Atelier Status for #${order.orderNumber}*\n\n` +
          `• *Status:* ${order.status}\n` +
          `• *Total:* ₹${order.pricing?.totalRupees || "0"}\n` +
          `• *Dispatch SLA:* ${order.fulfillment?.carrier ? "With " + order.fulfillment.carrier : "In studio curation"}\n\n` +
          `Every composition is ribboned by hand. Type *AGENT* if you need customized card updates.`;
        return this.sendTextMessage(phone, statusText);
      } else {
        return this.sendTextMessage(
          phone,
          `We couldn't locate Order #${orderNum} in our studio ledger. Please verify your order ID or type *AGENT* to connect with our atelier concierge.`
        );
      }
    }

    // 2. PIN Code Serviceability Check
    const pinMatch = raw.match(/\b\d{6}\b/);
    if (upper.includes("DELIVERY") || pinMatch) {
      const pin = pinMatch ? pinMatch[0] : raw.replace(/\D/g, "");
      if (pin.length === 6) {
        const result = DeliveryService.checkPincode(pin);
        const pinText = `📦 *Delivery Serviceability for PIN ${pin}*\n\n` +
          `• *Zone:* ${result.city || result.tier}\n` +
          `• *Estimated Time:* ${result.slaHours} hours (${result.expressAvailable ? "Air Express Eligible" : "Standard Surface"})\n` +
          `• *Free Shipping:* On orders above ₹2,999\n\n` +
          `Would you like to explore curated hampers for this zone?`;

        return this.sendInteractiveButtons(phone, {
          headerText: "Hampers by Her · Atelier Logistics",
          bodyText: pinText,
          footerText: "Handcrafted in New Delhi",
          buttons: [
            { id: "BTN_VIEW_CATALOG", title: "View Collections" },
            { id: "BTN_BUILD_CUSTOM", title: "Build Your Own" }
          ]
        });
      }
    }

    // 3. Human Operator Escalation
    if (/agent|human|talk|speak|call|operator/i.test(raw)) {
      this.conversations.set(phone, { state: "OPERATOR_ASSIGNED", assignedAt: Date.now() });
      return this.sendTextMessage(
        phone,
        `🕊️ *Atelier Concierge Connected*\n\nYou are now speaking with our master gifting binder. Please share any special customization, wedding monogram, or delivery date requests — we're reading your notes.`
      );
    }

    // 4. Interactive Button Handlers
    if (buttonId === "BTN_VIEW_CATALOG" || /collection|catalog|browse|shop/i.test(raw)) {
      return this.sendTextMessage(
        phone,
        `✨ *The Hampers by Her Edit*\n\n` +
          `1. *The Vows & Vines Hamper* — ₹3,950 (Wedding)\n` +
          `2. *The Office Well-Wisher* — ₹2,150 (Corporate)\n` +
          `3. *The Diwali Slow-Burn* — ₹2,850 (Festive)\n` +
          `4. *The Ten-Year Letter* — ₹3,200 (Anniversary)\n\n` +
          `Explore & customize with live wax seals: https://hampersbyher.com/#collections`
      );
    }

    if (buttonId === "BTN_BUILD_CUSTOM" || /build|custom|bespoke/i.test(raw)) {
      return this.sendTextMessage(
        phone,
        `📦 *The Bespoke Atelier Builder*\n\nCompose your own 11-step hamper: select your heirloom keepsake box, choose artisan treats, select raw silk ribbons, and dictate your wax-sealed letter.\n\nOpen Builder: https://hampersbyher.com/#builder`
      );
    }

    // 5. Default Greeting Menu
    const welcome = `Greetings, ${name}! Welcome to *Hampers by Her* (@hampers._by_her) ✨\n\n` +
      `We compose artisanal gifting hampers in small batches — hand-tied raw silk, botanical wax seals, and heartfelt calligraphy.\n\n` +
      `How may our atelier assist you today?`;

    return this.sendInteractiveButtons(phone, {
      headerText: "Hampers by Her · Luxury Gifting",
      bodyText: welcome,
      footerText: "Order tracking & bespoke consultations",
      buttons: [
        { id: "BTN_VIEW_CATALOG", title: "Explore Hampers" },
        { id: "BTN_BUILD_CUSTOM", title: "Build Your Own" },
        { id: "BTN_SPEAK_AGENT", title: "Artisan Concierge" }
      ]
    });
  }

  _cleanPhone(phone) {
    if (!phone) return "";
    return String(phone).replace(/\D/g, "");
  }
}

const whatsappService = new WhatsAppService();
module.exports = { WhatsAppService, whatsappService, HSM_TEMPLATES };
