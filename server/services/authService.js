/**
 * HAMPERS BY HER — CUSTOMER AUTHENTICATION & ATELIER STAFF RBAC SERVICE
 * 
 * Formal Specification Reference: 25_AUTH_SECURITY.md
 * Passwordless 6-digit WhatsApp/SMS OTP for patrons, cryptographically signed JWT sessions,
 * and Role-Based Access Control (RBAC) for atelier fulfillment staff.
 */

const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || "hbh_atelier_luxury_jwt_secret_key_2026";
const OTP_TTL_MS = 300 * 1000; // 5 minutes (300 seconds)
const MAX_OTP_ATTEMPTS = 3;

const ROLE_PERMISSIONS = {
  SUPER_ADMIN: ["*"],
  OPERATIONS: [
    "orders:read",
    "orders:write",
    "orders:qc_verify",
    "orders:dispatch",
    "inventory:manage",
    "analytics:read",
    "logistics:manifest"
  ],
  ARTISAN: [
    "orders:read",
    "orders:qc_verify",
    "orders:pack",
    "packing_slip:view"
  ],
  CUSTOMER_SUPPORT: [
    "orders:read",
    "whatsapp:chat",
    "ndr:resolve",
    "refunds:initiate"
  ],
  CUSTOMER: [
    "orders:read_own",
    "profile:manage",
    "checkout:proceed"
  ]
};

// Seeded staff members for atelier studio operations
const STAFF_REGISTRY = [
  { id: "staff_almas", name: "Almas Khan", email: "almas@hampersbyher.com", phone: "919876500001", role: "SUPER_ADMIN" },
  { id: "staff_ops", name: "Pooja Sharma", email: "operations@hampersbyher.com", phone: "919876500002", role: "OPERATIONS" },
  { id: "staff_artisan", name: "Fatima Bi", email: "artisan@hampersbyher.com", phone: "919876500003", role: "ARTISAN" },
  { id: "staff_support", name: "Zoya Patel", email: "support@hampersbyher.com", phone: "919876500004", role: "CUSTOMER_SUPPORT" }
];

class AuthService {
  constructor() {
    this.otpStore = new Map(); // phone -> { code, expiresAt, attempts, createdAt }
    this.users = new Map(); // id -> user object
    this.phoneUserMap = new Map(); // phone -> userId

    // Pre-populate staff
    for (const staff of STAFF_REGISTRY) {
      this.users.set(staff.id, staff);
      this.phoneUserMap.set(staff.phone, staff.id);
    }
  }

  /**
   * Generates a secure random 6-digit numeric OTP
   * @private
   * @returns {string}
   */
  _generateNumericOtp() {
    const val = crypto.randomInt(100000, 999999);
    return String(val);
  }

  /**
   * Creates an HMAC-SHA256 URL-safe JWT token
   * @param {Object} payload
   * @param {number} [expiresInSeconds=86400] 24 hours
   * @returns {string}
   */
  createJwtToken(payload, expiresInSeconds = 86400) {
    const header = { alg: "HS256", typ: "JWT" };
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const claims = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

    const b64Header = Buffer.from(JSON.stringify(header)).toString("base64url");
    const b64Claims = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const signature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${b64Header}.${b64Claims}`)
      .digest("base64url");

    return `${b64Header}.${b64Claims}.${signature}`;
  }

  /**
   * Verifies and decodes an HMAC-SHA256 JWT token
   * @param {string} token
   * @returns {Object|null}
   */
  verifyJwtToken(token) {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [b64Header, b64Claims, signature] = parts;
    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${b64Header}.${b64Claims}`)
      .digest("base64url");

    if (signature !== expectedSignature) {
      return null; // Signature tampering
    }

    try {
      const claims = JSON.parse(Buffer.from(b64Claims, "base64url").toString("utf8"));
      if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) {
        return null; // Expired token
      }
      return claims;
    } catch {
      return null;
    }
  }

  /**
   * Initiates passwordless OTP login
   * @param {Object} params
   * @param {string} params.phone 10-12 digit mobile number
   * @param {string} [params.channel="WHATSAPP"] "WHATSAPP" | "SMS"
   * @returns {Object}
   */
  requestOtp({ phone, channel = "WHATSAPP" }) {
    const cleanPhone = String(phone || "").replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      throw new Error("INVALID_PHONE_NUMBER: Phone number must have at least 10 digits");
    }

    const now = Date.now();
    const existing = this.otpStore.get(cleanPhone);

    // Rate-limiting check: minimum 30s between OTP requests
    if (existing && (now - existing.createdAt) < 30000) {
      const remainingSeconds = Math.ceil((30000 - (now - existing.createdAt)) / 1000);
      throw new Error(`RATE_LIMITED: Please wait ${remainingSeconds}s before requesting a new OTP`);
    }

    const code = this._generateNumericOtp();
    this.otpStore.set(cleanPhone, {
      code,
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      createdAt: now
    });

    return {
      success: true,
      phone: cleanPhone,
      channel,
      expiresInSeconds: 300,
      // In development/sandbox environments, surface code for immediate verification
      sandboxCode: process.env.NODE_ENV !== "production" ? code : undefined,
      message: `A 6-digit luxury verification code has been dispatched via ${channel}`
    };
  }

  /**
   * Verifies OTP and issues signed JWT session
   * @param {Object} params
   * @param {string} params.phone
   * @param {string} params.otp 6-digit string
   * @returns {Object} Session result
   */
  verifyOtp({ phone, otp }) {
    const cleanPhone = String(phone || "").replace(/\D/g, "");
    const cleanOtp = String(otp || "").trim();

    const record = this.otpStore.get(cleanPhone);
    if (!record) {
      throw new Error("OTP_EXPIRED_OR_NOT_FOUND: Please request a new verification code");
    }

    const now = Date.now();
    if (record.expiresAt < now) {
      this.otpStore.delete(cleanPhone);
      throw new Error("OTP_EXPIRED: The 5-minute validity window has lapsed");
    }

    record.attempts++;
    if (record.attempts > MAX_OTP_ATTEMPTS) {
      this.otpStore.delete(cleanPhone);
      throw new Error("MAX_ATTEMPTS_EXCEEDED: Too many incorrect attempts. Request a new code");
    }

    if (record.code !== cleanOtp) {
      throw new Error(`INVALID_OTP: Code does not match. ${MAX_OTP_ATTEMPTS - record.attempts} attempts remaining`);
    }

    // OTP is valid: invalidate code immediately to prevent replay
    this.otpStore.delete(cleanPhone);

    // Resolve or provision user
    let userId = this.phoneUserMap.get(cleanPhone);
    let user;

    if (userId && this.users.has(userId)) {
      user = this.users.get(userId);
    } else {
      // Provision new customer account
      userId = `cust_${Date.now()}_${cleanPhone.slice(-4)}`;
      user = {
        id: userId,
        phone: cleanPhone,
        name: `Patron ${cleanPhone.slice(-4)}`,
        role: "CUSTOMER",
        createdAt: new Date().toISOString()
      };
      this.users.set(userId, user);
      this.phoneUserMap.set(cleanPhone, userId);
    }

    // Issue JWT
    const token = this.createJwtToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name
    });

    return {
      success: true,
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role
      },
      permissions: ROLE_PERMISSIONS[user.role] || []
    };
  }

  /**
   * Checks whether a role possesses a given permission
   * @param {string} role
   * @param {string} permission
   * @returns {boolean}
   */
  hasPermission(role, permission) {
    const perms = ROLE_PERMISSIONS[role] || [];
    if (perms.includes("*")) return true;
    return perms.includes(permission);
  }

  /**
   * Retrieves user profile by ID
   * @param {string} userId
   * @returns {Object|null}
   */
  getUserById(userId) {
    return this.users.get(userId) || null;
  }
}

const authService = new AuthService();

module.exports = {
  AuthService,
  authService,
  ROLE_PERMISSIONS,
  STAFF_REGISTRY
};
