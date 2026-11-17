/**
 * HAMPERS BY HER — AUTHENTICATION & PATRON RBAC TEST SUITE
 * 
 * Formal Specification Reference: 25_AUTH_SECURITY.md
 * Verifies 6-digit WhatsApp/SMS OTP, JWT session creation, and staff RBAC gates.
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { authService, ROLE_PERMISSIONS } = require("../server/services/authService");
const { httpServer } = require("../server/index");

let port;
let baseUrl;
let serverInstance;

before(async () => {
  await new Promise((resolve) => {
    serverInstance = httpServer.listen(0, () => {
      port = serverInstance.address().port;
      baseUrl = `http://localhost:${port}/api/v1`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => serverInstance.close(resolve));
});

describe("Hampers by Her Customer Auth & RBAC Security Suite", () => {

  test("AuthService - Dispatches 6-digit numeric OTP with 300s expiration", () => {
    const res = authService.requestOtp({
      phone: "919876543210",
      channel: "WHATSAPP"
    });

    assert.equal(res.success, true);
    assert.equal(res.phone, "919876543210");
    assert.equal(res.expiresInSeconds, 300);
    assert.ok(res.sandboxCode);
    assert.equal(res.sandboxCode.length, 6);
    assert.match(res.sandboxCode, /^\d{6}$/);
  });

  test("AuthService - Rejects invalid phone numbers under 10 digits", () => {
    assert.throws(() => {
      authService.requestOtp({ phone: "12345" });
    }, /INVALID_PHONE_NUMBER/);
  });

  test("AuthService - Enforces rate limiting on rapid repeated OTP requests", () => {
    const phone = "919999988888";
    authService.requestOtp({ phone });

    // Requesting immediately again within 30s should be rate-limited
    assert.throws(() => {
      authService.requestOtp({ phone });
    }, /RATE_LIMITED/);
  });

  test("AuthService - Validates correct OTP, burns code, and issues signed JWT", () => {
    const phone = "919123456789";
    const otpRes = authService.requestOtp({ phone });
    const code = otpRes.sandboxCode;

    const session = authService.verifyOtp({ phone, otp: code });
    assert.equal(session.success, true);
    assert.ok(session.token);
    assert.equal(session.user.phone, phone);
    assert.equal(session.user.role, "CUSTOMER");

    // Replay defense: using the same code again must fail
    assert.throws(() => {
      authService.verifyOtp({ phone, otp: code });
    }, /OTP_EXPIRED_OR_NOT_FOUND/);
  });

  test("AuthService - Verifies HMAC-SHA256 JWT signature and rejects tampered tokens", () => {
    const token = authService.createJwtToken({ userId: "user_test", role: "CUSTOMER" }, 3600);
    const decoded = authService.verifyJwtToken(token);
    assert.equal(decoded.userId, "user_test");
    assert.equal(decoded.role, "CUSTOMER");

    // Tampered token
    const tampered = token.slice(0, -5) + "abcde";
    const invalid = authService.verifyJwtToken(tampered);
    assert.equal(invalid, null);
  });

  test("AuthService - Enforces Role-Based Access Control (RBAC) permissions", () => {
    assert.equal(authService.hasPermission("SUPER_ADMIN", "orders:qc_verify"), true);
    assert.equal(authService.hasPermission("OPERATIONS", "orders:dispatch"), true);
    assert.equal(authService.hasPermission("ARTISAN", "orders:qc_verify"), true);
    assert.equal(authService.hasPermission("ARTISAN", "orders:dispatch"), false); // Artisans cannot dispatch couriers
    assert.equal(authService.hasPermission("CUSTOMER", "orders:read_own"), true);
    assert.equal(authService.hasPermission("CUSTOMER", "orders:qc_verify"), false);
  });

  test("REST API: Full OTP authentication lifecycle (/auth/request-otp -> /auth/verify-otp -> /auth/me)", async () => {
    const phone = "919876599999";

    // 1. Request OTP
    const reqRes = await fetch(`${baseUrl}/auth/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, channel: "WHATSAPP" })
    });
    assert.equal(reqRes.status, 200);
    const reqData = await reqRes.json();
    assert.equal(reqData.success, true);
    const otp = reqData.data.sandboxCode;

    // 2. Verify OTP
    const verifyRes = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp })
    });
    assert.equal(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.success, true);
    const jwt = verifyData.data.token;

    // 3. Authenticate with Bearer token on /auth/me
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${jwt}` }
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.success, true);
    assert.equal(meData.data.user.phone, phone);
  });

});
