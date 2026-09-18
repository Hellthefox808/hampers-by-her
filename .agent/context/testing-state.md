# TESTING STATE — Hampers by Her

## 1. Verification Layers
- **Layer 1: Documentation Integrity**: `scripts/audit_documentation.js` validates all 44 specifications for Section 40 compliance.
- **Layer 2: Unit Testing (Vitest)**:
  - Pricing engine formula verification (paise integers, discounts, GST).
  - Volumetric fullness and 3D box packing algorithms.
  - State machine transitions (Order & Payment lifecycles).
- **Layer 3: Integration Testing (Supertest + Testcontainers)**:
  - REST API endpoint verification with real PostgreSQL and Redis containers.
  - Webhook signature validation (Razorpay and WhatsApp Cloud API).
- **Layer 4: End-to-End (Playwright)**:
  - Mobile user journeys (PDP -> Hamper Builder -> Cart -> Checkout -> Payment modal).
- **Layer 5: Load Testing (k6)**:
  - Peak concurrency simulation: 500 requests/sec during festival sales.
