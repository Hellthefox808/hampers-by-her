/**
 * Hampers by Her — Delivery & Serviceability Engine
 * Validates 6-digit Indian PIN codes and computes carrier dispatch SLAs.
 */

const METRO_PINCODES = [
  // Delhi NCR
  { prefix: "110", city: "New Delhi", state: "Delhi", zone: "METRO_AIR", slaDays: 2 },
  { prefix: "121", city: "Faridabad", state: "Haryana", zone: "METRO_AIR", slaDays: 2 },
  { prefix: "122", city: "Gurugram", state: "Haryana", zone: "METRO_AIR", slaDays: 2 },
  { prefix: "201", city: "Noida / Ghaziabad", state: "Uttar Pradesh", zone: "METRO_AIR", slaDays: 2 },
  // Mumbai Region
  { prefix: "400", city: "Mumbai", state: "Maharashtra", zone: "METRO_AIR", slaDays: 2 },
  { prefix: "401", city: "Thane", state: "Maharashtra", zone: "METRO_AIR", slaDays: 2 },
  // Bengaluru
  { prefix: "560", city: "Bengaluru", state: "Karnataka", zone: "METRO_AIR", slaDays: 2 },
  // Hyderabad
  { prefix: "500", city: "Hyderabad", state: "Telangana", zone: "METRO_AIR", slaDays: 2 },
  // Chennai
  { prefix: "600", city: "Chennai", state: "Tamil Nadu", zone: "METRO_AIR", slaDays: 2 },
  // Kolkata
  { prefix: "700", city: "Kolkata", state: "West Bengal", zone: "METRO_AIR", slaDays: 2 },
  // Pune
  { prefix: "411", city: "Pune", state: "Maharashtra", zone: "METRO_AIR", slaDays: 2 }
];

const TIER_1_PINCODES = [
  { prefix: "380", city: "Ahmedabad", state: "Gujarat", zone: "TIER_1", slaDays: 3 },
  { prefix: "302", city: "Jaipur", state: "Rajasthan", zone: "TIER_1", slaDays: 3 },
  { prefix: "226", city: "Lucknow", state: "Uttar Pradesh", zone: "TIER_1", slaDays: 3 },
  { prefix: "452", city: "Indore", state: "Madhya Pradesh", zone: "TIER_1", slaDays: 3 },
  { prefix: "160", city: "Chandigarh", state: "Punjab", zone: "TIER_1", slaDays: 3 },
  { prefix: "682", city: "Kochi", state: "Kerala", zone: "TIER_1", slaDays: 3 }
];

class DeliveryService {
  /**
   * Check 6-digit India PIN code serviceability
   * @param {string} pincode
   * @returns {Object}
   */
  static checkPincode(pincode) {
    if (!pincode || typeof pincode !== "string") {
      return { isServiceable: false, error: "Please enter a valid 6-digit PIN code." };
    }

    const cleanPin = pincode.trim();
    if (!/^\d{6}$/.test(cleanPin)) {
      return { isServiceable: false, error: "Indian PIN code must be exactly 6 digits." };
    }

    if (cleanPin.startsWith("0")) {
      return { isServiceable: false, error: "Invalid PIN code format." };
    }

    const prefix3 = cleanPin.substring(0, 3);
    const metro = METRO_PINCODES.find(m => m.prefix === prefix3);
    if (metro) {
      return {
        isServiceable: true,
        pincode: cleanPin,
        city: metro.city,
        state: metro.state,
        zone: metro.zone,
        carrier: "Blue Dart / Delhivery Express Air",
        standardDays: metro.slaDays,
        expressAvailable: true,
        expressDays: 1,
        message: "Express 48hr delivery available in " + metro.city + "."
      };
    }

    const tier1 = TIER_1_PINCODES.find(t => t.prefix === prefix3);
    if (tier1) {
      return {
        isServiceable: true,
        pincode: cleanPin,
        city: tier1.city,
        state: tier1.state,
        zone: tier1.zone,
        carrier: "Shiprocket / Delhivery Air",
        standardDays: tier1.slaDays,
        expressAvailable: true,
        expressDays: 2,
        message: "Pan-India delivery available in " + tier1.city + " within 3 business days."
      };
    }

    // Rest of serviceable India
    return {
      isServiceable: true,
      pincode: cleanPin,
      city: "National Delivery Zone",
      state: "India",
      zone: "REST_OF_INDIA",
      carrier: "Shiprocket Surface Priority",
      standardDays: 5,
      expressAvailable: false,
      expressDays: null,
      message: "Pan-India delivery available within 4-6 business days."
    };
  }
}

module.exports = { DeliveryService };
