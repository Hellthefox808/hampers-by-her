/**
 * HAMPERS BY HER — DYNAMIC PINCODE SLA, DISPATCH DISTANCE & DELIVERY INTERVAL RESOLVER
 * 
 * Formal Specification Reference: 39_DSA.md Section 7.8 (Algorithm 8)
 * Time Complexity: O(log Z)
 * Space Complexity: O(1)
 */

const PINCODE_ZONE_MAP = [
  // Tier-1 Metro Air (24-48h courier transit)
  { prefix: "11", zone: "METRO_AIR", minTransitDays: 1, maxTransitDays: 2, hubName: "Delhi NCR Air Gateway", expressEligible: true },
  { prefix: "40", zone: "METRO_AIR", minTransitDays: 1, maxTransitDays: 2, hubName: "Mumbai Central Air Hub", expressEligible: true },
  { prefix: "56", zone: "METRO_AIR", minTransitDays: 1, maxTransitDays: 2, hubName: "Bengaluru Tech Corridor Hub", expressEligible: true },
  { prefix: "50", zone: "METRO_AIR", minTransitDays: 1, maxTransitDays: 2, hubName: "Hyderabad Air Hub", expressEligible: true },
  { prefix: "60", zone: "METRO_AIR", minTransitDays: 1, maxTransitDays: 2, hubName: "Chennai Coastal Hub", expressEligible: true },
  { prefix: "70", zone: "METRO_AIR", minTransitDays: 1, maxTransitDays: 2, hubName: "Kolkata Eastern Gateway", expressEligible: true },

  // Tier-2 Regional (48-72h transit)
  { prefix: "41", zone: "TIER2_REGIONAL", minTransitDays: 2, maxTransitDays: 3, hubName: "Pune Hub", expressEligible: true },
  { prefix: "38", zone: "TIER2_REGIONAL", minTransitDays: 2, maxTransitDays: 3, hubName: "Ahmedabad Hub", expressEligible: true },
  { prefix: "30", zone: "TIER2_REGIONAL", minTransitDays: 2, maxTransitDays: 3, hubName: "Jaipur Heritage Hub", expressEligible: true },
  { prefix: "22", zone: "TIER2_REGIONAL", minTransitDays: 2, maxTransitDays: 3, hubName: "Lucknow Awadh Hub", expressEligible: true },
  { prefix: "16", zone: "TIER2_REGIONAL", minTransitDays: 2, maxTransitDays: 3, hubName: "Chandigarh Hub", expressEligible: true },

  // Special Territories (6-8 days transit)
  { prefix: "18", zone: "SPECIAL_TERRITORY", minTransitDays: 6, maxTransitDays: 8, hubName: "Jammu Valley Surface Transit", expressEligible: false },
  { prefix: "19", zone: "SPECIAL_TERRITORY", minTransitDays: 6, maxTransitDays: 8, hubName: "Kashmir Mountain Transit", expressEligible: false },
  { prefix: "78", zone: "SPECIAL_TERRITORY", minTransitDays: 5, maxTransitDays: 7, hubName: "Assam Valley Hub", expressEligible: false },
  { prefix: "79", zone: "SPECIAL_TERRITORY", minTransitDays: 6, maxTransitDays: 8, hubName: "North East Regional Transit", expressEligible: false },
  { prefix: "74", zone: "SPECIAL_TERRITORY", minTransitDays: 7, maxTransitDays: 9, hubName: "Andaman Marine / Air Corridor", expressEligible: false }
];

const STUDIO_DAILY_CUTOFF_HOUR_IST = 14; // 14:00 (2:00 PM) IST order cutoff

/**
 * Resolves delivery SLA window and transit routing given destination PIN code
 * @param {Object} params
 * @param {string} params.pincode 6-digit Indian PIN code
 * @param {Date} [params.orderTimestamp=new Date()]
 * @param {boolean} [params.isBespokePersonalization=false] Custom wax seal or handwritten calligraphy (+24h prep)
 * @param {number} [params.quantity=1] Bulk order unit count
 * @returns {Object} DeliverySlaWindow
 */
function resolveDeliverySla({
  pincode,
  orderTimestamp = new Date(),
  isBespokePersonalization = false,
  quantity = 1
}) {
  const pinStr = String(pincode || "").trim();

  // Validate 6-digit Indian PIN code format (100000 to 999999, never starting with 0)
  if (!/^[1-9][0-9]{5}$/.test(pinStr)) {
    return {
      isServiceable: false,
      pincode: pinStr,
      error: "INVALID_PINCODE_FORMAT",
      message: "Please enter a valid 6-digit Indian postal code."
    };
  }

  const prefix2 = pinStr.slice(0, 2);

  // Restricted military / non-civilian postal zones (Army Postal Service 90-99)
  if (prefix2.startsWith("9")) {
    return {
      isServiceable: false,
      pincode: pinStr,
      error: "UNSERVICEABLE_PINCODE",
      message: "Express courier delivery is unserviceable to military/APS postal zones."
    };
  }

  let matchedZone = PINCODE_ZONE_MAP.find(z => z.prefix === prefix2);

  if (!matchedZone) {
    // Default National Surface routing for all other standard valid PIN codes
    matchedZone = {
      prefix: prefix2,
      zone: "SURFACE_NATIONAL",
      minTransitDays: 4,
      maxTransitDays: 6,
      hubName: "National Surface Logistics Hub",
      expressEligible: false
    };
  }

  // Calculate Studio Preparation Lead Time
  let prepDays = 1; // Standard ready-made curation: 24h
  if (quantity >= 20) {
    prepDays = 5; // Bulk artisanal wedding/corporate: 120h
  } else if (isBespokePersonalization) {
    prepDays = 2; // Handcrafted wax seal stamping & calligraphy card: 48h
  }

  // Check 14:00 IST Cutoff
  // Convert UTC timestamp to IST (UTC + 5:30)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(orderTimestamp.getTime() + istOffsetMs);
  const istHour = istDate.getUTCHours();

  let cutoffDelayDays = 0;
  if (istHour >= STUDIO_DAILY_CUTOFF_HOUR_IST) {
    cutoffDelayDays = 1; // Order placed after 2 PM IST rolls into next studio production cycle
  }

  const totalPrepDays = prepDays + cutoffDelayDays;

  // Compute Dispatch Date
  const dispatchDate = new Date(orderTimestamp);
  dispatchDate.setDate(dispatchDate.getDate() + totalPrepDays);

  // Compute Delivery Date Window
  const earliestDeliveryDate = new Date(dispatchDate);
  earliestDeliveryDate.setDate(earliestDeliveryDate.getDate() + matchedZone.minTransitDays);

  const latestDeliveryDate = new Date(dispatchDate);
  latestDeliveryDate.setDate(latestDeliveryDate.getDate() + matchedZone.maxTransitDays);

  const formatDate = d => d.toISOString().split("T")[0];

  return {
    isServiceable: true,
    pincode: pinStr,
    zone: matchedZone.zone,
    hubName: matchedZone.hubName,
    expressAirEligible: matchedZone.expressEligible,
    timelines: {
      orderDate: formatDate(orderTimestamp),
      cutoffApplied: cutoffDelayDays > 0,
      prepLeadDays: totalPrepDays,
      dispatchDate: formatDate(dispatchDate),
      earliestDeliveryDate: formatDate(earliestDeliveryDate),
      latestDeliveryDate: formatDate(latestDeliveryDate),
      totalEstimatedDays: totalPrepDays + matchedZone.maxTransitDays
    }
  };
}

module.exports = {
  PINCODE_ZONE_MAP,
  STUDIO_DAILY_CUTOFF_HOUR_IST,
  resolveDeliverySla
};
