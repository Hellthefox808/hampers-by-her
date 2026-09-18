<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# ADR 002: Payment Gateway Abstraction Layer

## Status
APPROVED

## Date
2026-09-18

## Context
Hampers by Her processes transactions primarily in India (INR) where UPI (Google Pay, PhonePe, Paytm, CRED) accounts for over 75% of consumer transactions, followed by credit/debit cards and net banking. During peak gifting festivals (Diwali, Rakhi, Valentine's), payment gateway outages, downtime, or banking network failures can cause severe revenue loss and cart abandonment. 

Directly coupling business logic (Checkout, Orders, Webhooks, Refunds) to a single proprietary SDK (such as Razorpay) creates single-point-of-failure vulnerabilities, vendor lock-in, and makes dynamic failover to alternative gateways (e.g., Cashfree or Stripe) impossible without major codebase refactoring.

## Decision
We establish a strict **Payment Gateway Abstraction Layer** using the Strategy and Adapter design patterns.
1. The domain core (`PaymentsModule`) interacts strictly with a vendor-neutral interface: `IPaymentGatewayAdapter`.
2. Core methods specified:
   - `createPaymentOrder(params: CreatePaymentOrderInput): Promise<PaymentOrderResult>`
   - `verifyWebhookSignature(payload: string, signature: string, secret: string): boolean`
   - `fetchPaymentDetails(gatewayPaymentId: string): Promise<PaymentDetailsResult>`
   - `initiateRefund(params: RefundInput): Promise<RefundResult>`
3. **Primary Implementation**: `RazorpayAdapter` utilizing Razorpay Orders API and UPI Intent deep-linking for mobile browsers.
4. **Secondary/Fallback Implementation**: `CashfreeAdapter` maintained with feature parity for immediate DNS/config-driven failover.
5. All monetary calculations are handled strictly in the domain engine in integer Paise (`BIGINT`), with gateway-specific currency formatters isolated entirely within the adapter layer.
6. Webhooks are routed through a unified ingress endpoint (`/api/v1/payments/webhooks/:gateway`) which resolves the matching adapter for cryptographic signature verification before dispatching normalized domain events (`payment.captured`, `payment.failed`).

## Consequences
### Positive
- Vendor independence: Switching or adding a gateway requires only implementing `IPaymentGatewayAdapter` without touching checkout or order state machines.
- Dynamic failover readiness: Health checks can detect gateway latency spikes (>3.5s) or elevated error rates (>5%) and shift new checkout sessions to the backup provider.
- Testability: Clean mock adapters (`MockPaymentAdapter`) allow automated end-to-end integration tests without network calls to external sandbox environments.

### Negative / Trade-Offs
- Marginal increase in upfront interface design and boilerplate code.
- Feature set restricted to common denominator payment capabilities across Indian gateways (advanced proprietary features like Razorpay Magic Checkout must be carefully evaluated to avoid leaking vendor specifics into core domain models).
