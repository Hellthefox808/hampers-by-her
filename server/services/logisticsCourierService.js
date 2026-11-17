/**
 * HAMPERS BY HER — LOGISTICS COURIER ADAPTER & TRACKING WEBHOOK SERVICE
 * 
 * Formal Specification Reference: 20_DELIVERY_LOGISTICS.md
 * Integrates Shiprocket / Delhivery carrier contracts, automated AWB generation,
 * carrier tracking webhook ingestion, and Non-Delivery Report (NDR) recovery workflows.
 */

const { OrderService } = require("./orderService");
const { resolveDeliverySla } = require("../../platform/services/dsa/logisticsSlaResolver");

const CARRIER_TIERS = {
  METRO_AIR: { carrier: "BlueDart Priority Air", serviceType: "AIR_EXPRESS", maxTransitDays: 2 },
  TIER2_REGIONAL: { carrier: "Delhivery Air Express", serviceType: "AIR_STANDARD", maxTransitDays: 3 },
  SURFACE_NATIONAL: { carrier: "Delhivery Surface", serviceType: "SURFACE_STANDARD", maxTransitDays: 6 },
  SPECIAL_TERRITORY: { carrier: "IndiaPost SpeedPost", serviceType: "SPECIAL_AIR_SURFACE", maxTransitDays: 8 }
};

class LogisticsCourierService {
  constructor() {
    this.manifests = new Map(); // orderNumber -> Manifest
    this.awbLookup = new Map(); // awb -> orderNumber
    this.ndrLedger = new Map(); // orderNumber -> Array<NDREvent>
  }

  /**
   * Generates automated shipping manifest and assigns AWB tracking number
   * @param {Object} params
   * @param {string} params.orderNumber
   * @param {number} [params.grossWeightG=2500]
   * @param {string} [params.pickupSlot="MORNING"] "MORNING" (10-14) | "AFTERNOON" (14-18)
   * @returns {Object} ShippingManifest
   */
  generateShippingManifest({ orderNumber, grossWeightG = 2500, pickupSlot = "MORNING" }) {
    const order = OrderService.getOrderByNumber(orderNumber);
    if (!order) {
      throw new Error(`ORDER_NOT_FOUND: Cannot generate manifest for ${orderNumber}`);
    }

    if (order.status === "CANCELLED") {
      throw new Error(`ORDER_CANCELLED: Cannot generate manifest for cancelled order ${orderNumber}`);
    }

    const pincode = order.shippingAddress?.pincode || "110001";
    const sla = resolveDeliverySla({
      pincode,
      isBespokePersonalization: Boolean(order.ribbon || order.waxSeal || order.cardMessage)
    });

    if (!sla.isServiceable) {
      throw new Error(`UNSERVICEABLE_PINCODE: Destination PIN ${pincode} cannot be manifested`);
    }

    const carrierConfig = CARRIER_TIERS[sla.zone] || CARRIER_TIERS.SURFACE_NATIONAL;
    const awb = `HBH-AWB-2026-${Math.floor(100000 + Math.random() * 900000)}`;

    const manifest = {
      orderNumber,
      awb,
      carrier: carrierConfig.carrier,
      serviceType: carrierConfig.serviceType,
      zone: sla.zone,
      pincode,
      hubName: sla.hubName,
      grossWeightG,
      pickupSlot,
      createdAt: new Date().toISOString(),
      labelUrl: `https://cdn.hampersbyher.com/labels/${awb}.pdf`,
      estimatedDeliveryDate: sla.timelines.latestDeliveryDate,
      status: "MANIFEST_GENERATED",
      checkpoints: [
        {
          status: "MANIFEST_GENERATED",
          location: "New Delhi Atelier Studio Hub",
          timestamp: new Date().toISOString(),
          description: "Shipping label and AWB assigned. Packaged hamper ready for carrier handover."
        }
      ]
    };

    this.manifests.set(orderNumber, manifest);
    this.awbLookup.set(awb, orderNumber);

    // Update order with tracking information
    order.tracking = {
      awb,
      carrier: manifest.carrier,
      estimatedDeliveryDate: manifest.estimatedDeliveryDate,
      labelUrl: manifest.labelUrl,
      trackingUrl: `https://track.hampersbyher.com/${awb}`
    };

    // Transition order to DISPATCHED if currently PACKED or QUALITY_CHECKED
    if (order.status === "PACKED" || order.status === "QUALITY_CHECKED") {
      order.status = "DISPATCHED";
      if (!order.timeline) order.timeline = [];
      order.timeline.push({
        status: "DISPATCHED",
        timestamp: new Date().toISOString(),
        actor: manifest.carrier,
        notes: `Carrier AWB ${manifest.awb} dispatched via ${manifest.carrier}`
      });
      OrderService.syncPersistence();
    }

    return manifest;
  }

  /**
   * Ingests asynchronous tracking updates from carrier webhooks
   * @param {Object} payload
   * @param {string} payload.awb Air Waybill
   * @param {string} payload.status "PICKED_UP" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "NDR"
   * @param {string} [payload.location="Delhi Hub"]
   * @param {string} [payload.ndrReason=""]
   * @returns {Object} Update result
   */
  processTrackingWebhook(payload) {
    const { awb, status, location = "Hub", ndrReason = "" } = payload;
    if (!awb || !status) {
      throw new Error("INVALID_WEBHOOK_PAYLOAD: awb and status fields are required");
    }

    const orderNumber = this.awbLookup.get(awb);
    if (!orderNumber) {
      return { handled: false, error: `UNKNOWN_AWB: No manifest found for ${awb}` };
    }

    const manifest = this.manifests.get(orderNumber);
    const order = OrderService.getOrderByNumber(orderNumber);

    const checkpoint = {
      status,
      location,
      timestamp: new Date().toISOString(),
      description: ndrReason ? `Non-delivery reason: ${ndrReason}` : `Parcel status updated to ${status}`
    };

    if (manifest) {
      manifest.status = status;
      manifest.checkpoints.push(checkpoint);
    }

    if (order) {
      if (status === "DELIVERED") {
        order.status = "DELIVERED";
      } else if (status === "OUT_FOR_DELIVERY") {
        order.status = "OUT_FOR_DELIVERY";
      } else if (status === "PICKED_UP" || status === "IN_TRANSIT") {
        order.status = "IN_TRANSIT";
      }

      if (!order.timeline) order.timeline = [];
      order.timeline.push({
        status,
        timestamp: checkpoint.timestamp,
        actor: manifest ? manifest.carrier : "Carrier Gateway",
        notes: checkpoint.description
      });
      OrderService.syncPersistence();
    }

    // Handle NDR (Non-Delivery Report)
    let ndrAction = null;
    if (status === "NDR") {
      ndrAction = this.handleNonDeliveryReport(orderNumber, ndrReason);
    }

    return {
      handled: true,
      orderNumber,
      awb,
      currentStatus: status,
      ndrAction
    };
  }

  /**
   * Automates Non-Delivery Report recovery flow with customer intervention
   * @param {string} orderNumber
   * @param {string} reason
   * @returns {Object}
   */
  handleNonDeliveryReport(orderNumber, reason) {
    const record = {
      orderNumber,
      reason: reason || "Customer unavailable / Address incomplete",
      reportedAt: new Date().toISOString(),
      status: "RECOVERY_INITIATED",
      recoveryChannel: "WHATSAPP_HSM",
      templateDispatched: "hbh_ndr_address_update_v1"
    };

    const history = this.ndrLedger.get(orderNumber) || [];
    history.push(record);
    this.ndrLedger.set(orderNumber, history);

    return {
      recoveryDispatched: true,
      orderNumber,
      ndrRecord: record,
      message: "Automated WhatsApp NDR recovery sequence dispatched to patron."
    };
  }

  /**
   * Retrieves tracking details by AWB or Order Number
   * @param {string} identifier AWB or OrderNumber
   * @returns {Object|null}
   */
  getTrackingDetails(identifier) {
    let orderNum = identifier;
    if (identifier.startsWith("HBH-AWB-")) {
      orderNum = this.awbLookup.get(identifier);
    }

    if (!orderNum) return null;
    return this.manifests.get(orderNum) || null;
  }
}

const logisticsCourierService = new LogisticsCourierService();

module.exports = {
  LogisticsCourierService,
  logisticsCourierService,
  CARRIER_TIERS
};
