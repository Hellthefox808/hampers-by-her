# API STATE — Hampers by Her

## 1. Specification & Contract
- **Contract Source**: `docs/api/openapi.yaml` (OpenAPI 3.1.0).
- **Target URL**:
  - Production: `https://api.hampersbyher.com/v1`
  - Staging: `https://staging-api.hampersbyher.com/v1`

## 2. Key Endpoint Groups
- `GET /catalog/products`: Filtered catalog with occasion, recipient, and cursor pagination.
- `POST /builder/validate-step`: Real-time 11-step configuration validation and volume fullness score.
- `POST /checkout/create-order`: Idempotent order creation with server-side pricing calculation.
- `POST /payments/razorpay/webhook`: Razorpay webhook signature verification and async processing.
- `POST /whatsapp/webhook`: Inbound WhatsApp messaging, NDR responses, and customer support routing.
- `GET /delivery/serviceability/{pincode}`: Redis-cached Indian PIN code serviceability lookup.
- `GET /admin/orders`: RBAC-protected operational dashboard feed for atelier fulfillments.

## 3. Standards & Security
- **Error Model**: RFC 7807 problem details (`application/problem+json`).
- **Headers**: Mandatory `X-Request-ID` and `Idempotency-Key` (for non-safe mutations).
- **Rate Limiting**: 100 requests/minute per IP on public endpoints, 10 req/min on checkout & auth.
