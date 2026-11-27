/**
 * Hampers by Her — Patron Stationery & Product Inquiry Service
 * Handles stationery contact letters, product enquiries, and DSA lead scoring
 * with atomic local JSON persistence.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { scoreInboundLead, leadPriorityQueue } = require("../../platform/services/dsa");
const { CatalogService } = require("./catalogService");
const { postgresStore, resolveConnectionString } = require("./postgresClient");

const ARCHIVED_EDITIONS = [
  {
    id: "arch_monsoon_chai",
    title: "Monsoon Chai Trunk",
    edition: "Edition 03",
    destination: "Mumbai",
    category: "Festive",
    deliveredTag: "ATELIER ----> MUMBAI",
    image: "images/hamper-festive.jpg",
    note: "Assam first-flush tea, brass infuser, cardamom shortbread."
  },
  {
    id: "arch_rosewood_trousseau",
    title: "Rosewood Trousseau 04",
    edition: "Edition 04",
    destination: "Jaipur",
    category: "Wedding",
    deliveredTag: "ATELIER ----> JAIPUR",
    image: "images/hamper-wedding.jpg",
    note: "36 bridesmaid keepsakes with botanical pressed-petal notes."
  },
  {
    id: "arch_solstice_cocoa",
    title: "Winter Solstice Cocoa",
    edition: "Edition 05",
    destination: "Bengaluru",
    category: "Corporate",
    deliveredTag: "ATELIER ----> BENGALURU",
    image: "images/hamper-corporate.jpg",
    note: "Single-origin Idukki cocoa, saddle-stitched desk notebook."
  },
  {
    id: "arch_nizam_velvet",
    title: "Nizam Velvet Keepsake",
    edition: "Edition 06",
    destination: "Hyderabad",
    category: "Anniversary",
    deliveredTag: "ATELIER ----> HYDERABAD",
    image: "images/hamper-anniversary.jpg",
    note: "Hand-frayed mulberry silk ribbon, Kashmiri rose wax seal."
  },
  {
    id: "arch_autumn_orchard",
    title: "Autumn Orchard Crate",
    edition: "Edition 06B",
    destination: "Chandigarh",
    category: "Festive",
    deliveredTag: "ATELIER ----> CHANDIGARH",
    image: "images/hero-hamper.jpg",
    note: "Spiced pear conserve, beeswax tapers, deckle cotton letter."
  },
  {
    id: "arch_atelier_midnight",
    title: "Midnight Candle Suite",
    edition: "Edition 02",
    destination: "Pune",
    category: "Anniversary",
    deliveredTag: "ATELIER ----> PUNE",
    image: "images/hamper-anniversary.jpg",
    note: "Smoked vanilla castor candle paired with brass snuffer."
  }
];

class InquiryService {
  constructor(dataDir = null) {
    const isReadOnlyRuntime = Boolean(
      process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.READ_ONLY_FS
    );
    this.dataDir = dataDir || (
      isReadOnlyRuntime
        ? path.join(os.tmpdir(), "hampers-by-her-data")
        : path.join(__dirname, "..", "..", "data")
    );
    this.storePath = path.join(this.dataDir, "inquiries_store.json");
    this.tempPath = path.join(this.dataDir, "inquiries_store.json.tmp");
    this.inquiries = [];
    this._hydrationPromise = null;
    this._hydratedUrl = null;
    this._load();
  }

  async ensureHydrated(force = false) {
    if (!postgresStore.isEnabled()) return false;
    const activeUrl = resolveConnectionString();
    if (this._hydrationPromise && !force && this._hydratedUrl === activeUrl) {
      return this._hydrationPromise;
    }
    this._hydratedUrl = activeUrl;
    this._hydrationPromise = (async () => {
      try {
        const dbRows = await postgresStore.loadInquiries();
        if (!Array.isArray(dbRows)) return false;
        const byId = new Map();
        for (const item of dbRows) {
          if (item?.id) byId.set(item.id, item);
        }
        for (const item of this.inquiries) {
          if (item?.id && !byId.has(item.id)) byId.set(item.id, item);
        }
        this.inquiries = Array.from(byId.values())
          .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0))
          .slice(0, 500);
        return true;
      } catch (err) {
        console.warn("[InquiryService] Postgres hydration skipped:", err.message);
        this._hydrationPromise = null;
        return false;
      }
    })();
    return this._hydrationPromise;
  }

  _load() {
    try {
      if (fs.existsSync(this.storePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
        if (Array.isArray(parsed.inquiries)) {
          this.inquiries = parsed.inquiries;
        }
      }
    } catch {
      this.inquiries = [];
    }
  }

  _persist(latestInquiry = null) {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      const payload = JSON.stringify(
        {
          version: "1.0.0",
          savedAt: new Date().toISOString(),
          inquiries: this.inquiries
        },
        null,
        2
      );
      const pidTemp = `${this.tempPath}.${process.pid}.tmp`;
      fs.writeFileSync(pidTemp, payload, "utf8");
      fs.renameSync(pidTemp, this.storePath);
    } catch {
      // Graceful non-fatal persistence fallback in read-only environments
    }

    if (postgresStore.isEnabled() && latestInquiry) {
      postgresStore.scheduleBackground(postgresStore.upsertInquiry(latestInquiry));
    }
  }

  /**
   * Create and score a patron stationery or hamper inquiry.
   */
  createInquiry(payload = {}) {
    const name = String(payload.name || "").trim();
    const phone = String(payload.phone || "").trim();
    const email = String(payload.email || "").trim();
    const city = String(payload.city || "").trim();
    const hamperId = String(payload.hamperId || "any").trim();
    const message = String(payload.message || "").trim();
    const source = String(payload.source || "stationery_letter").trim();

    if (name.length < 2) {
      throw new Error("Please enter your name (at least 2 characters).");
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) {
      throw new Error("Please enter a valid phone or WhatsApp number.");
    }
    if (message.length > 2000) {
      throw new Error("Message must be 2000 characters or fewer.");
    }

    const linkedProduct = hamperId && hamperId !== "any"
      ? CatalogService.getProductById(hamperId)
      : null;

    const leadEvaluation = scoreInboundLead({
      channel: "WEBSITE_LETTER",
      message: `${hamperId} ${message} ${city}`,
      customerName: name,
      phone
    });

    try {
      leadPriorityQueue.insert({
        id: `inq_${Date.now()}`,
        channel: "WEBSITE_LETTER",
        message: `${hamperId} ${message}`,
        customerName: name,
        phone
      });
    } catch {
      // Queue saturation safe fallback
    }

    const inquiry = {
      id: `INQ-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      name,
      phone,
      email: email || null,
      city: city || null,
      hamperId,
      hamperTitle: linkedProduct ? linkedProduct.title : (hamperId === "any" ? "General / Bespoke Hamper" : hamperId),
      message: message || "Curious to explore bespoke gifting options.",
      source,
      priorityTier: leadEvaluation.tier || "P2",
      leadScore: leadEvaluation.score || 65,
      status: "RECEIVED",
      createdAt: new Date().toISOString()
    };

    this.inquiries.unshift(inquiry);
    if (this.inquiries.length > 500) {
      this.inquiries = this.inquiries.slice(0, 500);
    }
    this._persist(inquiry);

    const waSummary = `Dear Hampers by Her, I'm ${name} (${phone})` +
      (city ? ` from ${city}` : "") +
      `. I'm enquiring about *${inquiry.hamperTitle}*.` +
      (message ? `\nNote: ${message}` : "");

    return {
      inquiry,
      waMeUrl: `https://wa.me/919876543210?text=${encodeURIComponent(waSummary)}`
    };
  }

  listInquiries({ limit = 50 } = {}) {
    return this.inquiries.slice(0, Math.max(1, Math.min(200, Number(limit) || 50)));
  }

  getArchivedEditions() {
    return ARCHIVED_EDITIONS;
  }
}

const inquiryService = new InquiryService();

module.exports = {
  InquiryService,
  inquiryService,
  ARCHIVED_EDITIONS
};
