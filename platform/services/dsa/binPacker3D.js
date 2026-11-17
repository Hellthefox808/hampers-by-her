/**
 * HAMPERS BY HER — 3D VOLUMETRIC BIN-PACKING & PHYSICAL COMPATIBILITY HEURISTIC
 * 
 * Formal Specification Reference: 39_DSA.md Section 7.1 (Algorithm 1)
 * Time Complexity: O(N log N)
 * Space Complexity: O(N)
 */

const STANDARD_BOXES = {
  SMALL: {
    id: "BOX_SMALL",
    name: "Petite Keepsake Box",
    length_mm: 200,
    width_mm: 150,
    height_mm: 80,
    max_weight_g: 2000,
    tare_weight_g: 250,
    volume_mm3: 200 * 150 * 80
  },
  MEDIUM: {
    id: "BOX_MEDIUM",
    name: "Classic Rigid Keepsake Box",
    length_mm: 250,
    width_mm: 200,
    height_mm: 100,
    max_weight_g: 4000,
    tare_weight_g: 400,
    volume_mm3: 250 * 200 * 100
  },
  LARGE: {
    id: "BOX_LARGE",
    name: "Grand Heirloom Keepsake Box",
    length_mm: 320,
    width_mm: 260,
    height_mm: 120,
    max_weight_g: 7000,
    tare_weight_g: 650,
    volume_mm3: 320 * 260 * 120
  },
  GRANDE: {
    id: "BOX_GRANDE",
    name: "Imperial Trunk Keepsake",
    length_mm: 400,
    width_mm: 300,
    height_mm: 150,
    max_weight_g: 12000,
    tare_weight_g: 950,
    volume_mm3: 400 * 300 * 150
  }
};

const USABLE_VOLUME_THRESHOLD = 0.85; // 85% usable; 15% reserved for wood wool, shred filler & ribbons
const FRAGILE_VOLUME_MULTIPLIER = 1.25; // 25% buffer for honeycomb padding

/**
 * Evaluates 3D physical bin packing and thermal/orientation compatibility
 * @param {Object} box Container dimensions and weight limits
 * @param {Array<Object>} items Array of items with dimensions, weight, and handling flags
 * @returns {Object} PackingResult
 */
function evaluateHamperPacking(box, items) {
  if (!box || typeof box !== "object") {
    throw new TypeError("evaluateHamperPacking requires a valid box configuration object");
  }
  if (!Array.isArray(items)) {
    throw new TypeError("evaluateHamperPacking requires an array of items");
  }

  const boxVolumeMm3 = box.length_mm * box.width_mm * box.height_mm;
  const usableVolumeMm3 = boxVolumeMm3 * USABLE_VOLUME_THRESHOLD;

  let totalItemVolumeMm3 = 0;
  let totalItemWeightG = 0;
  const violations = [];
  let hasChilled = false;
  let hasAmbient = false;

  // Empty hamper edge case
  if (items.length === 0) {
    return {
      fits: true,
      fullness_ratio: 0.0,
      total_gross_weight_g: box.tare_weight_g || 0,
      recommended_box_size: "SMALL",
      violations: []
    };
  }

  // Sort items by footprint area descending to simulate bottom-layer physical stability
  const sortedItems = [...items].sort((a, b) => {
    const areaA = (a.length_mm || 0) * (a.width_mm || 0);
    const areaB = (b.length_mm || 0) * (b.width_mm || 0);
    return areaB - areaA;
  });

  for (const item of sortedItems) {
    const l = item.length_mm || 0;
    const w = item.width_mm || 0;
    const h = item.height_mm || 0;
    const weight = item.weight_g || 0;

    // Dimension boundary check
    if (item.must_keep_upright) {
      // Must stay standing upright: height is fixed on vertical Z axis
      const fitsNormal = l <= box.length_mm && w <= box.width_mm && h <= box.height_mm;
      const fitsRotatedFootprint = w <= box.length_mm && l <= box.width_mm && h <= box.height_mm;
      if (!fitsNormal && !fitsRotatedFootprint) {
        violations.push("HEIGHT_OVERFLOW");
      }
    } else {
      // Free 3D rotation: check if item's sorted dimensions fit within box's sorted dimensions
      const itemDims = [l, w, h].sort((x, y) => x - y);
      const boxDims = [box.length_mm, box.width_mm, box.height_mm].sort((x, y) => x - y);
      if (itemDims[0] > boxDims[0] || itemDims[1] > boxDims[1] || itemDims[2] > boxDims[2]) {
        violations.push("HEIGHT_OVERFLOW");
      }
    }

    // Volume calculation with fragile cushioning factor
    const rawVolume = (l && w && h) ? (l * w * h) : (item.volume_mm3 || 0);
    const effectiveVolume = item.is_fragile ? rawVolume * FRAGILE_VOLUME_MULTIPLIER : rawVolume;
    totalItemVolumeMm3 += effectiveVolume;
    totalItemWeightG += weight;

    if (item.temperature_sensitive) {
      hasChilled = true;
    } else {
      hasAmbient = true;
    }
  }

  // Thermal conflict check
  if (hasChilled && hasAmbient && items.length > 6) {
    violations.push("INCOMPATIBLE_TEMPERATURE");
  }

  if (totalItemVolumeMm3 > usableVolumeMm3) {
    violations.push("VOLUME_EXCEEDED");
  }

  if (totalItemWeightG > box.max_weight_g) {
    violations.push("WEIGHT_EXCEEDED");
  }

  const fullnessRatio = usableVolumeMm3 > 0 ? Math.min(1.0, totalItemVolumeMm3 / usableVolumeMm3) : 1.0;
  const totalGrossWeight = totalItemWeightG + (box.tare_weight_g || 0);

  // Recommend optimal box if current box is invalid or underfilled
  let recommendedBox = "SMALL";
  for (const [sizeKey, candidateBox] of Object.entries(STANDARD_BOXES)) {
    const candidateUsable = candidateBox.volume_mm3 * USABLE_VOLUME_THRESHOLD;
    if (totalItemVolumeMm3 <= candidateUsable && totalItemWeightG <= candidateBox.max_weight_g) {
      recommendedBox = sizeKey;
      break;
    }
    recommendedBox = "GRANDE";
  }

  const uniqueViolations = Array.from(new Set(violations));

  return {
    fits: uniqueViolations.length === 0,
    fullness_ratio: Number(fullnessRatio.toFixed(3)),
    total_gross_weight_g: totalGrossWeight,
    recommended_box_size: recommendedBox,
    violations: uniqueViolations
  };
}

module.exports = {
  STANDARD_BOXES,
  USABLE_VOLUME_THRESHOLD,
  FRAGILE_VOLUME_MULTIPLIER,
  evaluateHamperPacking
};
