/**
 * Hampers by Her Atelier AI Platform — Microservices Mesh & Inter-Service Test Suite
 * Tests service discovery, correlation ID tracing, circuit breakers, aggregated health probes,
 * and end-to-end multi-service order lifecycle choreography.
 */

const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const { ServiceMeshRegistry, MicroserviceCircuitBreaker } = require("../services/mesh-service/serviceMesh");

describe("Hampers by Her Microservices Mesh Subsystem", () => {
  let mesh;

  beforeEach(() => {
    mesh = new ServiceMeshRegistry();

    // Register Catalog Microservice
    mesh.registerService("CatalogService", {
      version: "2.1.0",
      handlers: {
        getHamper: async ({ id }) => ({ id, title: "The Vows & Vines Hamper", inStock: true })
      }
    });

    // Register Inventory Microservice
    mesh.registerService("InventoryService", {
      version: "2.0.0",
      handlers: {
        commitStock: async ({ reservationId }) => ({ committed: true, reservationId })
      }
    });

    // Register Delivery Logistics Microservice
    mesh.registerService("DeliveryService", {
      version: "1.4.0",
      handlers: {
        scheduleDispatch: async ({ orderId, pincode }) => ({
          awb: `AWB_${pincode}_${orderId}`,
          courier: "BlueDart Express",
          dispatchDate: "2026-11-18"
        })
      }
    });

    // Register WhatsApp Notification Microservice
    mesh.registerService("WhatsAppService", {
      version: "21.0.0",
      handlers: {
        sendOrderConfirmation: async ({ orderId, customerPhone }) => ({
          messageId: `wamid_conf_${orderId}`,
          recipient: customerPhone,
          template: "hbh_order_confirmed_v2"
        })
      }
    });
  });

  describe("Service Discovery & Inter-Service Invocations", () => {
    test("Discovers registered service and invokes method with automatic correlationId", async () => {
      const res = await mesh.invoke({
        serviceName: "CatalogService",
        method: "getHamper",
        payload: { id: "prod_wedding_vows" }
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.id, "prod_wedding_vows");
      assert.ok(res.correlationId.startsWith("cid_"));
      assert.ok(res.latencyMs >= 0);
    });

    test("Throws error for non-existent microservice or unimplemented method", async () => {
      await assert.rejects(
        () => mesh.invoke({ serviceName: "UnknownService", method: "test" }),
        /Microservice not found: UnknownService/
      );

      await assert.rejects(
        () => mesh.invoke({ serviceName: "CatalogService", method: "nonExistentMethod" }),
        /Method 'nonExistentMethod' not implemented on microservice 'CatalogService'/
      );
    });
  });

  describe("Circuit Breaker Protection", () => {
    test("Trips circuit breaker to OPEN after repeated microservice failures", async () => {
      mesh.registerService("FailingGatewayService", {
        version: "1.0.0",
        handlers: {
          charge: async () => { throw new Error("Bank network timeout 504"); }
        }
      });

      // Execute 5 consecutive failures
      for (let i = 0; i < 5; i++) {
        await assert.rejects(
          () => mesh.invoke({ serviceName: "FailingGatewayService", method: "charge" }),
          /Bank network timeout 504/
        );
      }

      // 6th call should be immediately blocked by Circuit Breaker without calling handler
      await assert.rejects(
        () => mesh.invoke({ serviceName: "FailingGatewayService", method: "charge" }),
        /Circuit breaker is OPEN for microservice: FailingGatewayService/
      );
    });
  });

  describe("Aggregated System Health Probes", () => {
    test("Gathers real-time health across all microservices in the mesh", async () => {
      const health = await mesh.getSystemHealth();

      assert.strictEqual(health.status, "HEALTHY");
      assert.strictEqual(health.servicesCount, 4);
      assert.strictEqual(health.services.CatalogService.status, "UP");
      assert.strictEqual(health.services.InventoryService.status, "UP");
      assert.strictEqual(health.services.DeliveryService.status, "UP");
      assert.strictEqual(health.services.WhatsAppService.status, "UP");
    });
  });

  describe("Multi-Service Order Lifecycle Choreography", () => {
    test("Orchestrates order confirmation across Inventory, Delivery, and WhatsApp services", async () => {
      const order = {
        id: "HBH-ORD-2026-8877",
        reservationId: "res_hold_992",
        shippingPincode: "110001",
        customerPhone: "919876543210",
        totalAmount: 3950
      };

      const choreography = await mesh.executeOrderLifecycleChoreography({
        order,
        payment: { transactionId: "pay_rzp_990", status: "CAPTURED" }
      });

      assert.strictEqual(choreography.orderId, "HBH-ORD-2026-8877");
      assert.strictEqual(choreography.status, "CONFIRMED_AND_NOTIFIED");
      assert.strictEqual(choreography.deliveryAwb, "AWB_110001_HBH-ORD-2026-8877");
      assert.strictEqual(choreography.correlationId, "order_flow_HBH-ORD-2026-8877");
    });
  });
});
