<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 25_AUTH_SECURITY.md — Identity, Authentication, Authorization & Security Architecture

## 1. Purpose
This document establishes the end-to-end security architecture, cryptographic controls, identity federation, and threat mitigation framework for the **Hampers by Her** commerce ecosystem. Because Hampers by Her operates a dual-track business model (frictionless consumer guest checkouts from Instagram versus privileged admin backoffice workflows managing revenue, customer PII, and financial refunds), the security model must deliver frictionless customer onboarding without compromising the zero-trust perimeter required for administrative backoffice operations. This specification adheres to OWASP Application Security Verification Standard (ASVS Level 2) and India Digital Personal Data Protection Act (DPDPA 2023) mandates.

## 2. Scope
- **In-Scope**:
  - Customer identity: Passwordless Mobile OTP (SMS/WhatsApp) and Email Magic Links.
  - Staff / Admin identity: Argon2id password hashing, Time-Based One-Time Passwords (TOTP MFA), and RBAC token issuance.
  - Session architecture: Cryptographically signed JWTs, Redis-backed refresh token rotation, and `HttpOnly`, `SameSite=Strict` cookies.
  - API boundary defenses: Ingress rate-limiting, CORS origin restrictions, security headers (CSP, HSTS, X-Frame-Options), and CSRF token verification for mutating actions.
  - Data protection at rest (AES-256 / AWS KMS) and in transit (TLS 1.3).
  - Webhook cryptographic verification (Razorpay HMAC-SHA256, Meta X-Hub-Signature-256).
  - Threat modeling and defensive controls against OWASP Top 10 vulnerabilities (SQLi, XSS, SSRF, IDOR, Broken Object Level Authorization).
- **Out-of-Scope**:
  - Processing or storing raw credit/debit card numbers or CVVs (delegated strictly to PCI-DSS Level 1 certified gateways).

## 3. Context
Gifting platforms are prime targets for automated credential stuffing, coupon/promotional code harvesting, credit card testing attacks, and malicious image uploads (e.g., polyglot files disguised as personalization photos). Hampers by Her establishes defense-in-depth across the network, application, and database tiers.

```
[Internet Traffic]
       │
       ▼ (AWS Route 53 + CloudFront CDN + AWS WAF)
  [Edge Defenses] ── DDoS Mitigation / Geo-IP / SQLi Rate-Limits
       │
       ▼ (TLS 1.3 / Strict SNI)
  [Next.js Storefront / Admin BFF] ── CSRF Guard & Secure Session Cookies
       │
       ▼ (Internal Private VPC)
  [NestJS Fastify Core API] ── JWT / MFA Verification & RBAC Guards
       │
       ▼ (Parameterized Prisma ORM)
  [PostgreSQL Aurora & Redis Cluster] (KMS Encrypted Storage)
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-SEC-01**: Passwordless Customer Authentication: Allow shoppers to sign in or claim past guest orders via a 6-digit OTP delivered via WhatsApp or SMS, expiring in 5 minutes with a maximum of 3 failed attempts.
- **FR-SEC-02**: Admin MFA: Mandate RFC 6238 TOTP authenticator app verification for all staff roles; reject admin logins that fail to supply valid TOTP codes.
- **FR-SEC-03**: Role-Based Authorization: Enforce strict declarative permissions (`@RequirePermissions('order:refund')`) on all backend API routes.
- **FR-SEC-04**: Secure File Upload Sandbox: Scan customer photo uploads for mime-type magic bytes, enforce 10MB limits, re-encode images via Sharp into WebP, and store them in isolated S3 buckets with no public read permissions.
- **FR-SEC-05**: Webhook Authenticity: Validate raw body HMAC-SHA256 signatures for Razorpay, WhatsApp, and Instagram webhooks using constant-time comparison algorithms to eliminate timing attacks.

### 4.2 Non-Functional Requirements
- **NFR-SEC-01**: Token Rotation: Short-lived Access Tokens (15 minutes lifespan) paired with single-use Refresh Tokens stored in Redis with sliding expiration.
- **NFR-SEC-02**: Cryptographic Rigor: Password hashing using Argon2id ($m=65536, t=3, p=4$); token signatures using RS256 asymmetric keys or HMAC-SHA256 with 256-bit entropy secrets.
- **NFR-SEC-03**: Audit Logging: 100% of authentication events (logins, logouts, failed attempts, password resets, role escalations) logged immutably.

## 5. Architecture & Design

### 5.1 Authentication Flow (Customer OTP vs Admin MFA)
```
[Customer Path]
1. POST /api/v1/auth/otp/send ──► Generates 6-digit cryptographically secure random OTP
2. OTP stored in Redis: "otp:auth:{phone}" (TTL: 300s, max_attempts: 3)
3. Dispatched via WhatsApp Cloud API (SMS fallback)
4. POST /api/v1/auth/otp/verify ──► Constant-time check ──► Issue JWT Cookie

[Admin Path]
1. POST /api/v1/admin/auth/login (Email + Argon2id Password)
2. If credentials valid ──► Return temporary session token (TTL: 300s, scope: 'MFA_PENDING')
3. POST /api/v1/admin/auth/mfa/verify (TOTP 6-digit code)
4. If code valid ──► Issue full privileged Admin JWT + Audit Log Event
```

### 5.2 Security Headers Specification
Every HTTP response emitted by CloudFront and Next.js must include:
```http
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-...'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://d1xxxx.cloudfront.net https://*.s3.ap-south-1.amazonaws.com; connect-src 'self' https://api.razorpay.com https://graph.facebook.com; frame-src https://api.razorpay.com;
```

## 6. Business Rules
1. **Account Lockout Policy**: 5 consecutive failed login attempts on an admin account or 3 failed OTP attempts on a customer account triggers a 15-minute progressive cool-off lock.
2. **Session Termination on Password Change**: Changing an account password or revoking staff credentials immediately invalidates all active Redis session keys across all devices.
3. **Restricted Direct Object References (IDOR Prevention)**: Customers can never query orders by sequential integer IDs (`/orders/123`). All customer-facing endpoints mandate cryptographically unguessable UUIDv7 identifiers combined with a session ownership filter (`WHERE id = :id AND user_id = :session_user_id`).
4. **Zero Cardholder Data Retention**: The system never receives, logs, or stores PAN, CVV, or cardholder expiry details.

## 7. Technical Details

### 7.1 Database Entity Relations (Security & Session Subsystem)
```sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(128) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    is_revoked BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(refresh_token_hash);

CREATE TABLE security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(64) NOT NULL, -- FAILED_LOGIN, BRUTE_FORCE_BLOCKED, PERMISSION_DENIED
    severity VARCHAR(16) NOT NULL, -- INFO, WARNING, CRITICAL
    actor_id UUID,
    actor_type VARCHAR(16), -- CUSTOMER, ADMIN, SYSTEM
    ip_address VARCHAR(45) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sec_events_type ON security_events(event_type, created_at DESC);
```

### 7.2 Constant-Time Webhook Verification Helper
```typescript
import * as crypto from 'crypto';

export function verifyWebhookSignature(
  rawBody: Buffer | string,
  incomingSignature: string,
  secret: string,
): boolean {
  if (!incomingSignature || !secret) return false;
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const digest = hmac.digest('hex');

  const incomingBuffer = Buffer.from(incomingSignature, 'utf8');
  const digestBuffer = Buffer.from(digest, 'utf8');

  if (incomingBuffer.length !== digestBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(incomingBuffer, digestBuffer);
}
```

## 8. Dependencies
- **Upstream Modules**: Ingress Gateway (CloudFront / Fastify Router).
- **Downstream Modules**: All application services (`Orders`, `Payments`, `Admin`, `CRM`, `Cart`).
- **External Dependencies**: AWS Secrets Manager, Redis (Distributed session store & rate limits).

## 9. Security (Threat Model & Mitigations)
| Threat Vector | Potential Impact | Architectural Mitigation |
| :--- | :--- | :--- |
| **Card Testing Botnet** | High gateway processing fee spikes & bank blacklisting | CloudFront Turnstile/reCAPTCHA v3 on payment initialization; rate-limit of 5 attempts/min per IP. |
| **BOLA / IDOR Attack** | Exposing other customers' gift messages & home addresses | Scope queries to `WHERE user_id = :req_user_id` or validate signed guest order tokens. |
| **Malicious SVG / PHP Upload** | Remote Code Execution or Stored XSS via photo upload | Reject SVGs; process all uploads through Sharp into WebP; strip EXIF metadata; serve via sandboxed CDN. |
| **Timing Attacks on Signatures**| Webhook forgery allowing fake order confirmations | Mandatory use of `crypto.timingSafeEqual()`. |

## 10. Failure Modes & Resilience
1. **Redis Session Cluster Partition**: If the Redis session cache becomes temporarily unreachable, stateless JWT verification continues validating requests for the duration of the 15-minute access token window, while queueing session refresh requests.
2. **KMS Key Unavailability**: In the catastrophic event of AWS KMS regional impairment, secrets are cached in local process memory with a 60-minute TTL to prevent immediate service collapse.

## 11. Testing
- **Unit Tests**:
  - Constant-time signature comparison tests with valid, invalid, and length-mismatched signatures.
  - Argon2id password hashing and verification tests.
- **Integration Tests**:
  - OTP lifecycle test: Send ──► verify within window ──► attempt replay (assert rejection) ──► test attempt exhaustion lock.
  - RBAC guard test asserting that unauthorized roles receive HTTP 403 Forbidden.
- **Automated Security Scans**: Daily CI/CD execution of Trivy container scans, npm audit dependency scans, and SonarQube static application security testing (SAST).

## 12. Observability & Monitoring
- **Metrics Tracked**:
  - `security.failed_logins_total` (Alert if > 20 per minute across system).
  - `security.csrf_violations_count`.
  - `security.webhook_signature_failures_count` (Alert if > 5 per minute).
  - `security.rate_limit_blocks_count`.
- **SIEM / Logging**: All `security_events` table writes stream to AWS CloudWatch Logs with metric filters connected to PagerDuty/SNS alerts.

## 13. Open Questions & Unknowns
```yaml
unknown:
  field: dpdpa_data_protection_officer_contact
  status: TO_VERIFY
  source_required: brand_owner
  impact: low
  temporary_assumption: "privacy@hampersbyher.com designated as interim grievance contact in Privacy Policy"

unknown:
  field: corporate_sso_saml_requirement
  status: TO_VERIFY
  source_required: brand_owner
  impact: low
  temporary_assumption: "Standard email/password + MFA sufficient for v1; SAML 2.0 / Okta deferred to Phase 11"
```

## 14. Future Evolution
- Passkey (WebAuthn / FIDO2) biometric login support for mobile consumers (FaceID / TouchID).
- Automated fraud detection engine using behavioral biometric signals during checkout.

## 15. References
- OWASP Application Security Verification Standard (ASVS 4.0.3): https://owasp.org/www-project-application-security-verification-standard/
- RFC 6238 (TOTP Specification): https://datatracker.ietf.org/doc/html/rfc6238
- Digital Personal Data Protection Act 2023, Ministry of Electronics & IT, Government of India: https://www.meity.gov.in/
