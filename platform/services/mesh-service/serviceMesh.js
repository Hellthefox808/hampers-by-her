/**
 * Hampers by Her Atelier AI Platform — Microservices Service Mesh & Inter-Service Broker
 * Coordinates high-scale microservices with circuit breakers, distributed tracing correlation IDs,
 * standard health probes, and event-driven choreography.
 */

const crypto = require("crypto");
const { EventEmitter } = require("events");

class MicroserviceCircuitBreaker {
  constructor(serviceName, failureThreshold = 5, resetTimeoutMs = 15000) {
    this.serviceName = serviceName;
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
  }

  canExecute() {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = "HALF_OPEN";
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess() {
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }
}

class ServiceMeshRegistry extends EventEmitter {
  constructor() {
    super();
    this.services = new Map();
    this.circuitBreakers = new Map();
    this.activeCorrelationIds = new Set();
  }

  /**
   * Register a microservice with its health probe and method handlers
   */
  registerService(serviceName, { version = "1.0.0", handlers = {}, healthCheckFn }) {
    this.services.set(serviceName, {
      name: serviceName,
      version,
      handlers,
      healthCheckFn: healthCheckFn || (async () => ({ status: "UP", latencyMs: 1 })),
      metrics: { callsCount: 0, errorCount: 0, avgLatencyMs: 0 }
    });
    this.circuitBreakers.set(serviceName, new MicroserviceCircuitBreaker(serviceName));
  }

  /**
   * Invoke a microservice method with distributed tracing and circuit breaker protection
   */
  async invoke({ serviceName, method, payload = {}, correlationId }) {
    const cid = correlationId || `cid_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Microservice not found: ${serviceName}`);
    }

    const breaker = this.circuitBreakers.get(serviceName);
    if (!breaker.canExecute()) {
      throw new Error(`Circuit breaker is OPEN for microservice: ${serviceName}`);
    }

    const handler = service.handlers[method];
    if (typeof handler !== "function") {
      throw new Error(`Method '${method}' not implemented on microservice '${serviceName}'`);
    }

    const startTime = Date.now();
    service.metrics.callsCount++;

    try {
      const result = await handler(payload, { correlationId: cid });
      const durationMs = Date.now() - startTime;
      breaker.recordSuccess();

      // Update moving average latency
      service.metrics.avgLatencyMs = parseFloat(
        (service.metrics.avgLatencyMs * 0.9 + durationMs * 0.1).toFixed(2)
      );

      this.emit("service_call_completed", {
        serviceName,
        method,
        correlationId: cid,
        durationMs,
        status: "SUCCESS"
      });

      return {
        success: true,
        data: result,
        correlationId: cid,
        latencyMs: durationMs
      };
    } catch (err) {
      service.metrics.errorCount++;
      breaker.recordFailure();

      this.emit("service_call_failed", {
        serviceName,
        method,
        correlationId: cid,
        error: err.message,
        status: "FAILED"
      });

      throw err;
    }
  }

  /**
   * Aggregated health inspection of all registered microservices
   */
  async getSystemHealth() {
    const healthReport = {};
    let overallHealthy = true;

    for (const [name, service] of this.services.entries()) {
      const breaker = this.circuitBreakers.get(name);
      try {
        const check = await service.healthCheckFn();
        healthReport[name] = {
          status: check.status,
          version: service.version,
          circuitState: breaker.state,
          latencyMs: check.latencyMs,
          metrics: service.metrics
        };
        if (check.status !== "UP") overallHealthy = false;
      } catch (err) {
        healthReport[name] = {
          status: "DOWN",
          error: err.message,
          circuitState: breaker.state
        };
        overallHealthy = false;
      }
    }

    return {
      status: overallHealthy ? "HEALTHY" : "DEGRADED",
      timestamp: new Date().toISOString(),
      servicesCount: this.services.size,
      services: healthReport
    };
  }

  /**
   * Choreograph full order-to-delivery lifecycle across microservices
   */
  async executeOrderLifecycleChoreography({ order, payment }) {
    const cid = `order_flow_${order.id}`;

    // 1. Commit Inventory Reservation
    await this.invoke({
      serviceName: "InventoryService",
      method: "commitStock",
      payload: { reservationId: order.reservationId },
      correlationId: cid
    });

    // 2. Schedule Delivery AWB
    const delivery = await this.invoke({
      serviceName: "DeliveryService",
      method: "scheduleDispatch",
      payload: { orderId: order.id, pincode: order.shippingPincode },
      correlationId: cid
    });

    // 3. Dispatch WhatsApp Customer HSM Notification
    await this.invoke({
      serviceName: "WhatsAppService",
      method: "sendOrderConfirmation",
      payload: { orderId: order.id, customerPhone: order.customerPhone, amount: order.totalAmount },
      correlationId: cid
    });

    return {
      orderId: order.id,
      correlationId: cid,
      deliveryAwb: delivery.data.awb,
      status: "CONFIRMED_AND_NOTIFIED"
    };
  }
}

const serviceMesh = new ServiceMeshRegistry();
module.exports = { ServiceMeshRegistry, serviceMesh, MicroserviceCircuitBreaker };
