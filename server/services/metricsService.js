/**
 * Hampers by Her — Real-Time SRE Prometheus Metrics Collector
 * Zero-dependency OpenMetrics / Prometheus v0.0.4 text exposition engine.
 * Exposes metrics aligned with infra/observability/alerts.yml:
 *   - http_requests_total{method,route,status}
 *   - http_request_duration_seconds_bucket / _sum / _count
 *   - nodejs_eventloop_lag_seconds
 *   - process_resident_memory_bytes / nodejs_heap_used_bytes / process_uptime_seconds
 */

const { monitorEventLoopDelay } = require("perf_hooks");

const LATENCY_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

class MetricsCollector {
  constructor() {
    this.requestCounts = new Map(); // key: method|route|status -> count
    this.durationBuckets = new Map(); // bucket -> count
    for (const b of LATENCY_BUCKETS) {
      this.durationBuckets.set(b, 0);
    }
    this.durationInf = 0;
    this.durationSum = 0;
    this.durationCount = 0;

    this.eventLoopHistogram = monitorEventLoopDelay({ resolution: 20 });
    this.eventLoopHistogram.enable();
  }

  /**
   * Normalize dynamic URL path segments to bounded cardinality Prometheus route labels.
   */
  normalizeRoute(urlPath) {
    const clean = String(urlPath || "/").split("?")[0];
    return clean
      .replace(/\/HBH-[A-Z0-9-]+/gi, "/:orderNumber")
      .replace(/\/HBH-AWB-[A-Z0-9-]+/gi, "/:awb")
      .replace(/\/[0-9]{6}(?=\/|$)/g, "/:pincode")
      .replace(/\/[0-9a-f]{8,}(?=\/|$)/gi, "/:id");
  }

  /**
   * Record an HTTP request observation.
   */
  observeHttpRequest(method, urlPath, statusCode, durationMs) {
    const route = this.normalizeRoute(urlPath);
    const key = `${method}|${route}|${statusCode}`;
    this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);

    const seconds = Math.max(0, durationMs / 1000);
    for (const b of LATENCY_BUCKETS) {
      if (seconds <= b) {
        this.durationBuckets.set(b, this.durationBuckets.get(b) + 1);
      }
    }
    this.durationInf += 1;
    this.durationSum += seconds;
    this.durationCount += 1;
  }

  /**
   * Return current p99 event loop lag in seconds.
   */
  getEventLoopLagSeconds() {
    const p99Ns = this.eventLoopHistogram.percentile(99);
    if (!Number.isFinite(p99Ns) || p99Ns < 0) return 0;
    return Number((p99Ns / 1e9).toFixed(6));
  }

  /**
   * Render Prometheus text exposition format (version 0.0.4).
   */
  renderPrometheusMetrics() {
    const lines = [];
    const mem = process.memoryUsage();
    const lagSeconds = this.getEventLoopLagSeconds();

    lines.push("# HELP http_requests_total Total number of HTTP requests processed.");
    lines.push("# TYPE http_requests_total counter");
    for (const [key, count] of this.requestCounts.entries()) {
      const [method, route, status] = key.split("|");
      const safeRoute = route.replace(/"/g, '\\"');
      lines.push(`http_requests_total{method="${method}",route="${safeRoute}",status="${status}"} ${count}`);
    }

    lines.push("# HELP http_request_duration_seconds HTTP request duration in seconds.");
    lines.push("# TYPE http_request_duration_seconds histogram");
    for (const b of LATENCY_BUCKETS) {
      lines.push(`http_request_duration_seconds_bucket{le="${b}"} ${this.durationBuckets.get(b)}`);
    }
    lines.push(`http_request_duration_seconds_bucket{le="+Inf"} ${this.durationInf}`);
    lines.push(`http_request_duration_seconds_sum ${this.durationSum.toFixed(6)}`);
    lines.push(`http_request_duration_seconds_count ${this.durationCount}`);

    lines.push("# HELP nodejs_eventloop_lag_seconds 99th percentile Node.js event loop lag in seconds.");
    lines.push("# TYPE nodejs_eventloop_lag_seconds gauge");
    lines.push(`nodejs_eventloop_lag_seconds ${lagSeconds}`);

    lines.push("# HELP process_resident_memory_bytes Resident set size memory in bytes.");
    lines.push("# TYPE process_resident_memory_bytes gauge");
    lines.push(`process_resident_memory_bytes ${mem.rss}`);

    lines.push("# HELP nodejs_heap_used_bytes Node.js V8 heap used in bytes.");
    lines.push("# TYPE nodejs_heap_used_bytes gauge");
    lines.push(`nodejs_heap_used_bytes ${mem.heapUsed}`);

    lines.push("# HELP process_uptime_seconds Process uptime in seconds.");
    lines.push("# TYPE process_uptime_seconds gauge");
    lines.push(`process_uptime_seconds ${Math.floor(process.uptime())}`);

    return lines.join("\n") + "\n";
  }

  /**
   * Cleanly stop event loop monitoring on shutdown.
   */
  shutdown() {
    this.eventLoopHistogram.disable();
  }
}

const metricsCollector = new MetricsCollector();

module.exports = { MetricsCollector, metricsCollector };
