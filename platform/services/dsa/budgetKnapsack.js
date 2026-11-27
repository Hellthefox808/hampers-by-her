/**
 * HAMPERS BY HER — MULTI-CRITERIA BUDGET MATCHING & KNAPSACK OPTIMIZATION
 * 
 * Formal Specification Reference: 39_DSA.md Section 7.5 (Algorithm 5)
 * Maximizes aesthetic harmony score and box fullness subject to price <= Budget.
 * Time Complexity: O(N log N)
 * Space Complexity: O(N)
 */

const { STANDARD_BOXES, evaluateHamperPacking } = require("./binPacker3D");
const { toPaiseBigInt } = require("./pricingLedger");

const CATALOG_COMPONENTS_POOL = [
  { id: "ITEM_CANDLE_AMBER", name: "Amber Noir Soy Wax Candle", pricePaise: 75000n, length_mm: 100, width_mm: 100, height_mm: 75, volume_mm3: 750000, weight_g: 350, aestheticScore: 92, category: "SCENT", is_fragile: true, must_keep_upright: true },
  { id: "ITEM_CHOCO_DARK_HAZELNUT", name: "Artisanal Dark Hazelnut Pralines", pricePaise: 45000n, length_mm: 150, width_mm: 100, height_mm: 30, volume_mm3: 450000, weight_g: 200, aestheticScore: 88, category: "GOURMET", is_fragile: false, must_keep_upright: false },
  { id: "ITEM_TEA_ROSE_BLUSH", name: "Kashmiri Rose Blush White Tea", pricePaise: 60000n, length_mm: 100, width_mm: 75, height_mm: 80, volume_mm3: 600000, weight_g: 150, aestheticScore: 85, category: "BEVERAGE", is_fragile: false, must_keep_upright: false },
  { id: "ITEM_BATH_SALTS", name: "Himalayan Pink Mineral Bath Salts", pricePaise: 85000n, length_mm: 100, width_mm: 100, height_mm: 85, volume_mm3: 850000, weight_g: 400, aestheticScore: 86, category: "WELLNESS", is_fragile: true, must_keep_upright: true },
  { id: "ITEM_HONEY_SAFFRON", name: "Raw Wildflower Honey with Saffron", pricePaise: 95000n, length_mm: 100, width_mm: 70, height_mm: 71, volume_mm3: 500000, weight_g: 380, aestheticScore: 90, category: "GOURMET", is_fragile: true, must_keep_upright: true },
  { id: "ITEM_SILK_SLEEP_MASK", name: "Mulberry Silk Luxury Sleep Mask", pricePaise: 110000n, length_mm: 150, width_mm: 100, height_mm: 20, volume_mm3: 300000, weight_g: 80, aestheticScore: 94, category: "KEEPSAKE", is_fragile: false, must_keep_upright: false },
  { id: "ITEM_MACARONS_BOX", name: "French Pistachio & Rose Macarons", pricePaise: 65000n, length_mm: 160, width_mm: 100, height_mm: 25, volume_mm3: 400000, weight_g: 180, aestheticScore: 89, category: "GOURMET", is_fragile: true, must_keep_upright: false },
  { id: "ITEM_LINEN_MIST", name: "Lavender & Bergamot Botanical Mist", pricePaise: 55000n, length_mm: 70, width_mm: 70, height_mm: 85, volume_mm3: 420000, weight_g: 220, aestheticScore: 84, category: "SCENT", is_fragile: true, must_keep_upright: true },
  { id: "ITEM_CERAMIC_MUG", name: "Hand-Thrown Speckled Ceramic Mug", pricePaise: 70000n, length_mm: 100, width_mm: 100, height_mm: 80, volume_mm3: 800000, weight_g: 340, aestheticScore: 87, category: "KEEPSAKE", is_fragile: true, must_keep_upright: true },
  { id: "ITEM_CALLIGRAPHY_JOURNAL", name: "Gold-Embossed Leatherette Journal", pricePaise: 80000n, length_mm: 180, width_mm: 120, height_mm: 30, volume_mm3: 650000, weight_g: 300, aestheticScore: 91, category: "KEEPSAKE", is_fragile: false, must_keep_upright: false }
];

/**
 * Optimizes hamper assembly using multi-criteria knapsack with 2-opt local search
 * @param {Object} params
 * @param {bigint|number} params.targetBudgetPaise Total target spend (e.g. 500000n for ₹5,000)
 * @param {Array<string>} [params.preferredCategories=[]]
 * @param {Array<Object>} [params.catalogPool=CATALOG_COMPONENTS_POOL]
 * @returns {Object} OptimizedBundle
 */
function optimizeHamperForBudget({
  targetBudgetPaise,
  preferredCategories = [],
  catalogPool = CATALOG_COMPONENTS_POOL
}) {
  const budget = toPaiseBigInt(targetBudgetPaise);
  if (budget <= 100000n) {
    throw new RangeError("Target budget must be at least ₹1,000 (100,000 paise)");
  }

  // 1. Container Box Selection (Allocating ~15-20% of budget to packaging container)
  let selectedBoxKey = "MEDIUM";
  let boxPricePaise = 45000n; // ₹450
  if (budget <= 250000n) {
    selectedBoxKey = "SMALL";
    boxPricePaise = 30000n; // ₹300
  } else if (budget >= 750000n) {
    selectedBoxKey = "LARGE";
    boxPricePaise = 65000n; // ₹650
  }
  if (budget >= 1500000n) {
    selectedBoxKey = "GRANDE";
    boxPricePaise = 95000n; // ₹950
  }

  const box = STANDARD_BOXES[selectedBoxKey];
  const builderBoxIdMap = {
    SMALL: "BOX_KRAFT_RIGID",
    MEDIUM: "BOX_KRAFT_RIGID",
    LARGE: "BOX_LINEN_KEEPSAKE",
    GRANDE: "BOX_VELVET_BORDEAUX"
  };
  const itemBudgetPaise = budget - boxPricePaise;

  // 2. Filter & Rank Catalog Candidates by Aesthetic Density
  // Density = (AestheticScore * CategoryBonus) / Price
  const candidates = catalogPool.map(item => {
    const isPreferred = preferredCategories.length === 0 || preferredCategories.includes(item.category);
    const bonus = isPreferred ? 1.3 : 1.0;
    const priceNum = Number(item.pricePaise);
    const density = (item.aestheticScore * bonus) / (priceNum / 10000); // normalized density
    return { ...item, density };
  });

  // Sort descending by density: O(N log N)
  candidates.sort((a, b) => b.density - a.density);

  // 3. Greedy Bounded Knapsack Pass
  let currentSpend = 0n;
  const selectedItems = [];
  const usedIds = new Set();

  for (const candidate of candidates) {
    if (usedIds.has(candidate.id)) continue;
    if (currentSpend + candidate.pricePaise <= itemBudgetPaise) {
      // Test physical packing fit before admitting
      const testPacking = evaluateHamperPacking(box, [...selectedItems, candidate]);
      if (testPacking.fits) {
        selectedItems.push(candidate);
        usedIds.add(candidate.id);
        currentSpend += candidate.pricePaise;
      }
    }
  }

  // 4. 2-Opt Local Search Relaxation:
  // If box is underfilled (fullness < 65%) and budget remains, attempt pairwise replacement
  let packing = evaluateHamperPacking(box, selectedItems);
  if (packing.fullness_ratio < 0.65 && selectedItems.length > 0) {
    for (let i = selectedItems.length - 1; i >= 0; i--) {
      const currentItem = selectedItems[i];
      // Find a larger alternative that still fits the budget
      for (const alt of candidates) {
        if (usedIds.has(alt.id)) continue;
        const newSpend = currentSpend - currentItem.pricePaise + alt.pricePaise;
        if (newSpend <= itemBudgetPaise && alt.volume_mm3 > currentItem.volume_mm3) {
          const testItems = [...selectedItems];
          testItems[i] = alt;
          const altPacking = evaluateHamperPacking(box, testItems);
          if (altPacking.fits && altPacking.fullness_ratio > packing.fullness_ratio) {
            selectedItems[i] = alt;
            usedIds.delete(currentItem.id);
            usedIds.add(alt.id);
            currentSpend = newSpend;
            packing = altPacking;
            break;
          }
        }
      }
      if (packing.fullness_ratio >= 0.65) break;
    }
  }

  const totalHamperPricePaise = currentSpend + boxPricePaise;
  const totalAestheticScore = selectedItems.reduce((sum, item) => sum + item.aestheticScore, 0);
  const averageHarmonyScore = selectedItems.length > 0 ? Number((totalAestheticScore / selectedItems.length).toFixed(1)) : 0;

  return {
    success: selectedItems.length >= 2,
    box: {
      id: builderBoxIdMap[selectedBoxKey] || "BOX_KRAFT_RIGID",
      sizeKey: selectedBoxKey,
      name: box.name,
      pricePaise: Number(boxPricePaise)
    },
    items: selectedItems.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      pricePaise: Number(item.pricePaise),
      aestheticScore: item.aestheticScore
    })),
    totalPricePaise: Number(totalHamperPricePaise),
    targetBudgetPaise: Number(budget),
    budgetUtilizationPercent: Number(((Number(totalHamperPricePaise) / Number(budget)) * 100).toFixed(1)),
    fullnessRatio: packing.fullness_ratio,
    fullnessStatus: packing.fullness_ratio >= 0.65 && packing.fullness_ratio <= 0.95 ? "OPTIMAL" : (packing.fullness_ratio < 0.65 ? "UNDERFILLED" : "NEAR_CAPACITY"),
    averageHarmonyScore,
    totalGrossWeightG: packing.total_gross_weight_g
  };
}

module.exports = {
  CATALOG_COMPONENTS_POOL,
  optimizeHamperForBudget
};
