/**
 * HAMPERS BY HER — ATELIER STUDIO OPERATIONS & FULFILLMENT OS ENGINE
 * 
 * Formal Specification Reference: 23_ADMIN_DASHBOARD.md & 18_ORDER_MANAGEMENT.md
 * Manages 11-stage order transitions, strict QC photo gate enforcement,
 * printable luxury packing slip generation, and real-time studio fulfillment KPIs.
 */

const { OrderService } = require("./orderService");
const { formatRupees } = require("../../platform/services/dsa/pricingLedger");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const VALID_STATUS_TRANSITIONS = {
  DRAFT: ["PENDING_PAYMENT", "CANCELLED"],
  PENDING_PAYMENT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PRODUCTION", "CANCELLED"],
  IN_PRODUCTION: ["QUALITY_CHECKED", "CANCELLED"],
  QUALITY_CHECKED: ["PACKED", "IN_PRODUCTION"],
  PACKED: ["DISPATCHED"],
  DISPATCHED: ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "DELIVERED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: []
};

class AdminStudioService {
  constructor() {
    this.qcInspectionRecords = new Map(); // orderNumber -> QCInspection
    this.customPackingSlips = new Map(); // orderNumber -> PackingSlip
  }

  /**
   * Retrieves all orders for the studio operations feed with optional filtering
   * @param {Object} [filter={}]
   * @param {string} [filter.status]
   * @param {boolean} [filter.qcPendingOnly=false]
   * @returns {Array<Object>}
   */
  getStudioOrders(filter = {}) {
    const orders = OrderService.getAllOrders();

    return orders.filter(order => {
      if (filter.status && order.status !== filter.status) {
        return false;
      }
      if (filter.qcPendingOnly) {
        return order.status === "IN_PRODUCTION";
      }
      return true;
    }).map(order => {
      const qc = this.qcInspectionRecords.get(order.orderNumber) || null;
      return {
        ...order,
        qcInspection: qc,
        isQcVerified: Boolean(qc && qc.passed)
      };
    });
  }

  /**
   * Transitions an order along the studio fulfillment lifecycle with strict gating
   * @param {Object} params
   * @param {string} params.orderNumber
   * @param {string} params.targetStatus
   * @param {string} [params.actorName="Studio Lead"]
   * @param {string} [params.notes=""]
   * @returns {Object} Updated order
   */
  transitionOrderStatus({ orderNumber, targetStatus, actorName = "Studio Lead", notes = "" }) {
    const order = OrderService.getOrderByNumber(orderNumber);
    if (!order) {
      throw new Error(`ORDER_NOT_FOUND: No order found for ${orderNumber}`);
    }

    const currentStatus = order.status;
    const allowedTargets = VALID_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedTargets.includes(targetStatus)) {
      throw new Error(
        `ILLEGAL_STATE_TRANSITION: Cannot transition order from ${currentStatus} to ${targetStatus}. Allowed transitions: ${allowedTargets.join(", ") || "None (Terminal State)"}`
      );
    }

    // STRICT QC PHOTO GATE ENFORCEMENT (Section 81 & 23_ADMIN_DASHBOARD.md)
    if (targetStatus === "QUALITY_CHECKED") {
      const qcRecord = this.qcInspectionRecords.get(orderNumber);
      if (!qcRecord || !qcRecord.passed || !qcRecord.photoEvidenceUrl) {
        throw new Error(
          "QC_PHOTO_GATE_VIOLATION: Cannot transition order to QUALITY_CHECKED without prior photographic inspection evidence and artisan sign-off."
        );
      }
    }

    // Update status in master store & synchronize atomic crash persistence
    const nowIso = new Date().toISOString();
    order.status = targetStatus;
    order.updatedAt = nowIso;
    if (!order.timeline) order.timeline = [];
    order.timeline.push({
      status: targetStatus,
      timestamp: nowIso,
      actor: actorName,
      notes
    });
    if (!order.trackingTimeline) order.trackingTimeline = [];
    order.trackingTimeline.push({
      status: targetStatus,
      timestamp: nowIso,
      note: notes || `Studio transition to ${targetStatus} by ${actorName}`
    });
    OrderService.syncPersistence();

    return order;
  }

  /**
   * Performs studio photographic Quality Check verification
   * @param {Object} params
   * @param {string} params.orderNumber
   * @param {string} params.inspectorName Studio artisan name
   * @param {string} params.photoEvidenceUrl URL or Base64 data URI of the packed hamper
   * @param {Object} [params.checklist={}]
   * @param {boolean} [params.checklist.ribbonTied=true]
   * @param {boolean} [params.checklist.waxSealIntact=true]
   * @param {boolean} [params.checklist.calligraphyCardIncluded=true]
   * @param {boolean} [params.checklist.componentsVerified=true]
   * @param {string} [params.notes=""]
   * @returns {Object} Inspection result
   */
  verifyStudioQcGate({
    orderNumber,
    inspectorName,
    photoEvidenceUrl,
    checklist = {},
    notes = ""
  }) {
    const order = OrderService.getOrderByNumber(orderNumber);
    if (!order) {
      throw new Error(`ORDER_NOT_FOUND: No order found for ${orderNumber}`);
    }

    if (!inspectorName || !inspectorName.trim()) {
      throw new Error("QC_INSPECTOR_REQUIRED: Studio inspector name must be specified for accountability");
    }

    if (!photoEvidenceUrl || !photoEvidenceUrl.trim()) {
      throw new Error("QC_PHOTO_MANDATORY: Photographic evidence of the assembled hamper is required to pass the QC gate");
    }

    const {
      ribbonTied = true,
      waxSealIntact = true,
      calligraphyCardIncluded = true,
      componentsVerified = true
    } = checklist;

    const allPassed = ribbonTied && waxSealIntact && calligraphyCardIncluded && componentsVerified;

    const verifiedAt = new Date().toISOString();
    const record = {
      orderNumber,
      inspectorName: inspectorName.trim(),
      photoEvidenceUrl: photoEvidenceUrl.trim(),
      verifiedAt,
      timestamp: verifiedAt,
      passed: allPassed,
      checklist: {
        ribbonTied,
        waxSealIntact,
        calligraphyCardIncluded,
        componentsVerified
      },
      notes
    };

    this.qcInspectionRecords.set(orderNumber, record);
    order.qcInspection = record;
    OrderService.syncPersistence();

    if (allPassed && order.status === "IN_PRODUCTION") {
      this.transitionOrderStatus({
        orderNumber,
        targetStatus: "QUALITY_CHECKED",
        actorName: inspectorName,
        notes: `Passed QC Photo Gate. Inspector: ${inspectorName}`
      });
    }

    return {
      success: true,
      passed: allPassed,
      orderNumber,
      orderStatus: order.status,
      qcRecord: record
    };
  }

  /**
   * Generates a printable, luxury HTML atelier packing slip
   * @param {string} orderNumber
   * @returns {string} HTML packing slip document
   */
  generatePrintablePackingSlip(orderNumber) {
    const order = OrderService.getOrderByNumber(orderNumber);
    if (!order) {
      throw new Error(`ORDER_NOT_FOUND: No order found for ${orderNumber}`);
    }

    const qc = this.qcInspectionRecords.get(orderNumber);
    const safeOrderNumber = escapeHtml(orderNumber);
    const safeStatus = escapeHtml(order.status);
    const boxName = escapeHtml(order.box?.name || "Artisanal Keepsake Box");
    const ribbon = escapeHtml(order.ribbon?.name || order.ribbon || "Burgundy Merlot Silk");
    const waxSeal = escapeHtml(order.waxSeal?.name || order.waxSeal || "Vintage Gold Laurel");
    const monogram = escapeHtml(order.customMonogram || "HBH");
    const cardMsg = escapeHtml(order.cardMessage || "With warmest compliments from Hampers by Her.");
    const recipient = escapeHtml(order.shippingAddress?.fullName || order.customer?.name || "Valued Patron");
    const address = order.shippingAddress || { line1: "Standard Delivery", city: "Delhi", pincode: "110001" };
    const safeLine1 = escapeHtml(address.line1 || "");
    const safeLine2 = escapeHtml(address.line2 || "");
    const safeCity = escapeHtml(address.city || "");
    const safeState = escapeHtml(address.state || "Delhi");
    const safePincode = escapeHtml(address.pincode || "");
    const safePhone = escapeHtml(order.customer?.phone || address.phone || "N/A");
    const safeInspector = qc && qc.inspectorName ? escapeHtml(qc.inspectorName) : "";
    const items = order.items || [];

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Atelier Packing Slip — ${safeOrderNumber}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #2D1018; margin: 0; padding: 20px; line-height: 1.5; }
    .header { border-bottom: 2px solid #C89D42; padding-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
    .brand-title { font-family: 'Playfair Display', Georgia, serif; font-size: 26px; color: #4A1E29; font-weight: 700; margin: 0; }
    .brand-sub { font-size: 11px; letter-spacing: 2px; color: #C89D42; text-transform: uppercase; margin-top: 4px; }
    .order-meta { text-align: right; font-size: 12px; }
    .order-meta strong { font-size: 16px; color: #4A1E29; }
    .section-title { font-family: 'Playfair Display', Georgia, serif; font-size: 15px; color: #4A1E29; border-bottom: 1px solid #E5D5BA; padding-bottom: 4px; margin-top: 20px; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px; font-size: 13px; }
    .card-box { background: #FDFBF7; border: 1px solid #E5D5BA; padding: 12px; border-radius: 6px; }
    .calligraphy-preview { font-family: 'Playfair Display', Georgia, serif; font-style: italic; color: #4A1E29; font-size: 14px; background: #FFFDF9; border-left: 3px solid #C89D42; padding: 10px; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
    th { background: #4A1E29; color: #FFFFFF; text-align: left; padding: 8px 10px; font-weight: 600; }
    td { padding: 8px 10px; border-bottom: 1px solid #EFEAE1; }
    .checkbox { width: 16px; height: 16px; border: 1.5px solid #C89D42; display: inline-block; vertical-align: middle; margin-right: 8px; border-radius: 3px; }
    .qc-badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; background: ${qc && qc.passed ? "#E6F4EA; color: #137333" : "#FCE8E6; color: #C5221F"}; }
    .footer { margin-top: 30px; border-top: 1px dashed #C89D42; padding-top: 15px; display: flex; justify-content: space-between; font-size: 11px; color: #776568; }
    .sign-box { border-bottom: 1px solid #2D1018; width: 180px; height: 30px; margin-top: 5px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="brand-title">Hampers by Her</h1>
      <div class="brand-sub">Atelier Studio Packing Slip &amp; QC Verification</div>
    </div>
    <div class="order-meta">
      <strong>${safeOrderNumber}</strong><br>
      Date: ${escapeHtml(new Date(order.createdAt || Date.now()).toLocaleDateString("en-IN"))}<br>
      Status: <span>${safeStatus}</span>
    </div>
  </div>

  <div class="details-grid">
    <div class="card-box">
      <div style="font-weight:700; color:#4A1E29; margin-bottom:6px;">✦ RECIPIENT &amp; SHIPPING DETAILS</div>
      <div><strong>${recipient}</strong></div>
      <div>${safeLine1} ${safeLine2}</div>
      <div>${safeCity}, ${safeState} — <strong>${safePincode}</strong></div>
      <div>Phone: ${safePhone}</div>
    </div>

    <div class="card-box">
      <div style="font-weight:700; color:#4A1E29; margin-bottom:6px;">✦ BESPOKE EMBELLISHMENTS</div>
      <div><strong>Packaging Box:</strong> ${boxName}</div>
      <div><strong>Raw Silk Ribbon:</strong> ${ribbon}</div>
      <div><strong>Wax Seal:</strong> ${waxSeal} (Monogram: <strong style="color:#C89D42;">${monogram}</strong>)</div>
      <div style="margin-top:6px;">
        QC Gate Status: <span class="qc-badge">${qc && qc.passed ? `PASSED (${safeInspector})` : "PENDING QC INSPECTION"}</span>
      </div>
    </div>
  </div>

  <div class="section-title">✦ HANDWRITTEN CALLIGRAPHY CARD</div>
  <div class="calligraphy-preview">
    "${cardMsg}"
  </div>

  <div class="section-title">✦ ITEM VERIFICATION CHECKLIST</div>
  <table>
    <thead>
      <tr>
        <th style="width: 10%;">Verify</th>
        <th style="width: 60%;">Item Description</th>
        <th style="width: 15%;">Qty</th>
        <th style="width: 15%;">Handling</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(i => `
        <tr>
          <td><span class="checkbox"></span></td>
          <td><strong>${escapeHtml(i.name || i.title || "Gourmet Component")}</strong></td>
          <td>${escapeHtml(i.quantity || 1)}</td>
          <td>${i.is_fragile ? "Fragile (Cushion)" : "Standard"}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <div class="footer">
    <div>
      <div>Artisan Packing Lead:</div>
      <div class="sign-box"></div>
    </div>
    <div>
      <div>QC Studio Inspector Sign-Off:</div>
      <div class="sign-box"></div>
    </div>
    <div style="text-align: right;">
      Hampers by Her Atelier OS<br>
      Handcrafted with love in New Delhi
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Returns aggregated studio fulfillment metrics and KPIs
   * @returns {Object}
   */
  getStudioMetrics() {
    const orders = OrderService.getAllOrders();

    let totalGrossRevenuePaise = 0;
    let pendingPaymentCount = 0;
    let confirmedCount = 0;
    let inProductionCount = 0;
    let qualityCheckedCount = 0;
    let packedCount = 0;
    let dispatchedCount = 0;
    let deliveredCount = 0;

    for (const order of orders) {
      if (order.status !== "CANCELLED") {
        totalGrossRevenuePaise += (order.pricing?.totalPaise || order.totalPricePaise || 0);
      }

      switch (order.status) {
        case "PENDING_PAYMENT": pendingPaymentCount++; break;
        case "CONFIRMED": confirmedCount++; break;
        case "IN_PRODUCTION": inProductionCount++; break;
        case "QUALITY_CHECKED": qualityCheckedCount++; break;
        case "PACKED": packedCount++; break;
        case "DISPATCHED": dispatchedCount++; break;
        case "DELIVERED": deliveredCount++; break;
      }
    }

    return {
      activeOrdersCount: orders.length,
      revenue: {
        totalPaise: totalGrossRevenuePaise,
        formattedRupees: formatRupees(BigInt(totalGrossRevenuePaise))
      },
      pipeline: {
        pendingPayment: pendingPaymentCount,
        confirmed: confirmedCount,
        inProduction: inProductionCount,
        pendingQc: inProductionCount, // In production requires QC
        qualityChecked: qualityCheckedCount,
        packed: packedCount,
        dispatched: dispatchedCount,
        delivered: deliveredCount
      },
      qcApprovalRatePercent: inProductionCount + qualityCheckedCount > 0
        ? Number(((qualityCheckedCount / (inProductionCount + qualityCheckedCount)) * 100).toFixed(1))
        : 100.0,
      timestamp: new Date().toISOString()
    };
  }
}

const adminService = new AdminStudioService();

module.exports = {
  AdminStudioService,
  adminService,
  VALID_STATUS_TRANSITIONS
};
