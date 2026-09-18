<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 36_MONITORING_OBSERVABILITY.md — Observability, Distributed Tracing & Telemetry Architecture

## 1. Purpose
This document establishes the telemetry framework, distributed tracing specifications, structured logging standards, and alerting thresholds for **Hampers by Her**. Gifting platforms require visibility that transcends raw server metrics: engineering and business teams must be able to trace an order's lifecycle across client browsers, API gateways, database transactions, background workers, and external third parties (Razorpay, WhatsApp Cloud API, Shiprocket) with zero manual database querying. This specification implements the Three Pillars of Observability (Structured Logs, High-Cardinality Metrics, and Distributed Tracing via OpenTelemetry), correlated by an immutable end-to-end `correlation_id`.

## 2. Scope
- **In-Scope**:
  - OpenTelemetry (OTel) instrumentation for Next.js 15, NestJS Fastify, Prisma ORM, and BullMQ workers.
  - End-to-end W3C Trace Context propagation (`traceparent` header).
  - Structured JSON logging with Pino, enforcing correlation ID and request context propagation.
  - Sentry error tracking with sourcemap integration for frontend and backend stack traces.
  - CloudWatch & Prometheus/Grafana metric telemetry.
  - Synthetic uptime monitoring and heartbeat health checks (`/health/liveness`, `/health/readiness`).
  - Business observability: tracking payment failure spikes, cart abandonment anomalies, and delivery SLA breaches.
- **Out-of-Scope**:
  - Profiling individual line-by-line CPU cycles in production (handled via staging benchmarks).

## 3. Context
When an Indian gifting customer experiences a failed payment during Rakhi checkout, debugging through disconnected logs across AWS ALB, ECS containers, and Razorpay dashboards takes hours. With unified OpenTelemetry distributed tracing, entering an `order_number` or `payment_id` instantly brings up the entire end-to-end execution waterfall showing the exact failed database lock or rejected webhook signature.

```
[Mobile User / Instagram In-App Browser]
       │
       ▼ (Generates traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01)
[AWS ALB / CloudFront] ── Injects X-Correlation-ID
       │
       ▼
[Next.js SSR Frontend] ── Traces Server Component Rendering
       │
       ▼
[NestJS Fastify Core API] ── Traces Controller ──► Service ──► Prisma Query
       │
       ├──► [PostgreSQL Aurora] (DB Span: 12ms)
       ├──► [Redis Cache] (Cache Span: 2ms)
       └──► [BullMQ Worker] (Async Trace Context Inherited via Job Metadata)
              │
              ▼
       [WhatsApp Cloud API Dispatch] (External Span: 240ms)
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-OBS-01**: W3C Distributed Tracing: Propagate `traceparent` headers across all HTTP requests, Redis queue jobs, and outbound HTTP calls to third-party APIs.
- **FR-OBS-02**: Structured JSON Logging: All application logs must be output to stdout as structured JSON containing `timestamp`, `level`, `correlation_id`, `service`, `message`, and typed contextual metadata.
- **FR-OBS-03**: Automatic PII Redaction: Log scrubbers must automatically mask credit card numbers, OTPs, customer passwords, and gift card pins matching regex patterns.
- **FR-OBS-04**: Dual Health Check Endpoints:
  - `/health/liveness`: Checks process event loop responsiveness (returns 200 OK).
  - `/health/readiness`: Verifies active connectivity to PostgreSQL and Redis (returns 200 OK or 503 Service Unavailable).
- **FR-OBS-05**: High-Priority Alerting: Route P0 alerts (Payment failure rate $>5\%$, Checkout 5xx errors $>1\%$, Database storage $<15\%$) to on-call engineers via PagerDuty/Slack within 60 seconds.

### 4.2 Non-Functional Requirements
- **NFR-OBS-01**: Telemetry Overhead: Observability agents and tracing interceptors must add $< 5\text{ms}$ latency overhead per request.
- **NFR-OBS-02**: Retention Policy: Application logs retained for 30 days in CloudWatch Logs / OpenSearch; financial audit records retained for 7 years in immutable S3 Glacier storage.
- **NFR-OBS-03**: Error Capture Completeness: 100% of unhandled exceptions captured by Sentry with breadcrumbs and user context.

## 5. Architecture & Design

### 5.1 Alerting Severity Matrix
| Severity | Trigger Condition | Notification Channel | Response SLA |
| :--- | :--- | :--- | :--- |
| **P0 (Critical)** | Checkout 5xx $> 2\%$ over 3 mins, Payment Gateway 5xx Spike, DB Out of Disk | PagerDuty Phone Call + Slack `#incidents-p0` | $< 15\text{ mins}$ |
| **P1 (High)** | WhatsApp Notification Backlog $> 200$, Courier Webhook Error Rate $> 5\%$ | Slack `#alerts-ops` + SMS | $< 1\text{ hour}$ |
| **P2 (Medium)**| Search latency p95 $> 200\text{ms}$, Elevated 4xx errors, High memory warning | Slack `#alerts-ops` | $< 4\text{ hours}$ |
| **P3 (Low)** | Non-critical background worker retry, Daily backup completed | Slack `#logs-engineering` | Next Business Day |

### 5.2 Structured Log Schema (Pino JSON)
```json
{
  "level": 30,
  "time": 1726646400000,
  "pid": 12,
  "hostname": "ecs-fargate-task-1a",
  "service": "hbh-backend-api",
  "correlation_id": "0191fa2b-8a21-71e0-a9cb-b2f5d96a0123",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "user_id": "usr_0191fa2b-...",
  "module": "OrdersModule",
  "action": "create_order",
  "msg": "Order #HBH-2026-10492 created successfully",
  "metadata": {
    "order_id": "ord_0191fa2b-...",
    "amount_paise": 385000,
    "items_count": 2,
    "payment_method": "RAZORPAY_UPI"
  }
}
```

## 6. Business Rules
1. **Zero Customer Message Logging**: The bodies of private gift messages (*"I love you..."*) or uploaded personal photos must NEVER be printed to application logs or external tracing backends.
2. **Alert Fatigue Prevention**: Alerts must enforce a 15-minute suppression window after triggering to prevent flood storms while engineers are actively resolving an outage.
3. **Daily Executive Telemetry Digest**: An automated summary report is delivered to business founders at 08:00 IST detailing GMV, checkout conversion rate, payment success rate, and active logistics exceptions.

## 7. Technical Details

### 7.1 OpenTelemetry Initialization (`src/tracing.ts`)
```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
});

export const otelSDK = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'hbh-commerce-core',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV,
  }),
  traceExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false }, // Reduce noise
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-fastify': { enabled: true },
    }),
  ],
});

process.on('SIGTERM', () => {
  otelSDK.shutdown().finally(() => process.exit(0));
});
```

### 7.2 NestJS Health Controller (`health.controller.ts`)
```typescript
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { RedisService } from '@/modules/redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('liveness')
  checkLiveness(): { status: string; uptime: number } {
    return { status: 'OK', uptime: process.uptime() };
  }

  @Get('readiness')
  async checkReadiness(): Promise<{ status: string; db: string; cache: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.redis.ping();
      return { status: 'READY', db: 'UP', cache: 'UP' };
    } catch (err: any) {
      throw new ServiceUnavailableException({ status: 'DOWN', error: err.message });
    }
  }
}
```

## 8. Dependencies
- **Instrumentation**: OpenTelemetry SDK, Pino Logger, Sentry Node / Next.js SDK.
- **Telemetry Backends**: AWS CloudWatch, Grafana Cloud / Prometheus, Sentry.io.

## 9. Security
- **PII Scrubbing Interceptor**: Pino logger configured with field redactors for `password`, `token`, `secret`, `otp`, `cardNumber`, `cvv`, `authHeader`.
- **Trace Sampling Rate**: In production, trace sampling is set to 10% for successful HTTP 200 requests and 100% for HTTP 4xx/5xx requests to optimize storage costs while capturing all failure forensics.

## 10. Failure Modes & Resilience
1. **Telemetry Exporter Network Outage**: If the OpenTelemetry collector or CloudWatch endpoint is temporarily unreachable, the in-memory batch exporter drops oldest spans rather than stalling application worker threads.
2. **Log Flooding Attack**: If a malicious client spams 404 routes, Pino logs at `WARN` level with rate-limited sampling to prevent disk saturation.

## 11. Testing (Observability & Monitoring)
- **Synthetic Probe Tests**: External synthetic monitor (UptimeRobot / CloudWatch Synthetics) executing a probe every 60 seconds against `/health/readiness`.
- **Chaos Alert Injection**: Artificially inject simulated 500 errors on a test endpoint in Staging to verify that PagerDuty and Slack alerts fire within 60 seconds.

## 12. Observability & Monitoring (Key Golden Signals)
- **Latency**:
  - `http.server.duration.p95` (Target: <150ms).
  - `db.query.duration.p95` (Target: <40ms).
- **Traffic**:
  - `http.server.requests_per_second`.
- **Errors**:
  - `http.server.5xx_rate` (Target: <0.05%).
- **Saturation**:
  - `ecs.task.cpu_utilization` (Alert at >75%).
  - `db.connection_pool_utilization` (Alert at >80%).

## 13. Open Questions & Unknowns
```yaml
unknown:
  field: on_call_engineer_pagerduty_schedule
  status: TO_VERIFY
  source_required: brand_owner
  impact: high
  temporary_assumption: "Single primary engineering lead contact designated for P0 SMS/call escalation initially"

unknown:
  field: third_party_apm_budget_allocation
  status: TO_VERIFY
  source_required: brand_owner
  impact: medium
  temporary_assumption: "AWS CloudWatch Logs + Sentry Team Plan used for MVP telemetry to manage costs"
```

## 14. Future Evolution
- Automated Root Cause Analysis (AIOps) analyzing correlated metric anomalies and recommending configuration rollbacks during incidents.
- Real User Monitoring (RUM) tracking Core Web Vitals across individual mobile handset models in India (Samsung, Xiaomi, iPhone).

## 15. References
- OpenTelemetry Documentation: https://opentelemetry.io/docs/
- Google Cloud Site Reliability Engineering (The Four Golden Signals): https://sre.google/sre-book/monitoring-distributed-systems/
- Pino High Performance Node.js Logger: https://getpino.io/
