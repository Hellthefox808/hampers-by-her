/**
 * Hampers by Her — Bespoke Hamper Builder Engine
 * Algorithmic 3D Volume Calculation, Collision Detection, and Rule Validation.
 */

const BOX_BASES = {
  BOX_KRAFT_RIGID: {
    id: "BOX_KRAFT_RIGID",
    name: "Classic Rigid Kraft Box",
    material: "FSC-certified recycled kraft board with magnetic catch",
    dimensionsCm: { l: 28, w: 22, h: 10 },
    capacityCm3: 5200, // Usable packing volume considering paper shred
    maxWeightGrams: 2500,
    pricePaise: 45000, // ₹450
    imageUrl: "images/hamper-corporate.jpg"
  },
  BOX_LINEN_KEEPSAKE: {
    id: "BOX_LINEN_KEEPSAKE",
    name: "Linen-Lined Wooden Keepsake",
    material: "Natural pine with natural ecru linen lining and brass hinges",
    dimensionsCm: { l: 32, w: 25, h: 12 },
    capacityCm3: 8200,
    maxWeightGrams: 4000,
    pricePaise: 95000, // ₹950
    imageUrl: "images/hamper-wedding.jpg"
  },
  BOX_VELVET_BORDEAUX: {
    id: "BOX_VELVET_BORDEAUX",
    name: "Royal Bordeaux Velvet Casket",
    material: "Deep bordeaux velvet wrap with gold foiled crest and ribbon clasp",
    dimensionsCm: { l: 35, w: 28, h: 14 },
    capacityCm3: 11800,
    maxWeightGrams: 6000,
    pricePaise: 145000, // ₹1,450
    imageUrl: "images/hamper-anniversary.jpg"
  }
};

const ATELIER_ITEMS = [
  {
    id: "ITEM_CANDLE_AMBER",
    name: "Amber & Vanilla Castor-Oil Candle",
    category: "CANDLES",
    volumeCm3: 750,
    weightGrams: 320,
    pricePaise: 68000, // ₹680
    isFragile: true,
    isScented: true,
    tags: ["cozy", "scented", "bestseller"]
  },
  {
    id: "ITEM_CHOCO_DARK_HAZELNUT",
    name: "Single-Origin Roasted Hazelnut Dark Cocoa (70%)",
    category: "CONFECTIONS",
    volumeCm3: 450,
    weightGrams: 150,
    pricePaise: 42000, // ₹420
    isFragile: false,
    isScented: false,
    tags: ["sweet", "artisan"]
  },
  {
    id: "ITEM_TEA_ROSE_BLUSH",
    name: "Himalayan Rose Blush Tisane (Loose Leaf)",
    category: "BEVERAGES",
    volumeCm3: 600,
    weightGrams: 100,
    pricePaise: 49000, // ₹490
    isFragile: false,
    isScented: true,
    tags: ["floral", "calming"]
  },
  {
    id: "ITEM_BRASS_BELL",
    name: "Hand-Etched Vintage Brass Bell / Paperweight",
    category: "KEEPSAKES",
    volumeCm3: 350,
    weightGrams: 280,
    pricePaise: 55000, // ₹550
    isFragile: false,
    isScented: false,
    tags: ["metal", "keepsake"]
  },
  {
    id: "ITEM_SILK_NAPKIN",
    name: "Washed Raw Silk Cocktail Napkins (Set of 2)",
    category: "LINEN",
    volumeCm3: 300,
    weightGrams: 80,
    pricePaise: 38000, // ₹380
    isFragile: false,
    isScented: false,
    tags: ["textile", "monogrammable"]
  },
  {
    id: "ITEM_BATH_SALTS",
    name: "French Clay & Bergamot Botanical Bath Soak",
    category: "SELF_CARE",
    volumeCm3: 850,
    weightGrams: 400,
    pricePaise: 62000, // ₹620
    isFragile: true,
    isScented: true,
    tags: ["pamper", "scented"]
  },
  {
    id: "ITEM_TONIC_ELDERFLOWER",
    name: "Craft Elderflower & Pear Sparkling Tonic",
    category: "BEVERAGES",
    volumeCm3: 700,
    weightGrams: 520,
    pricePaise: 34000, // ₹340
    isFragile: true,
    isScented: false,
    tags: ["sip", "celebration"]
  },
  {
    id: "ITEM_LEATHER_JOURNAL",
    name: "Full-Grain Leather Bound Pocket Journal",
    category: "KEEPSAKES",
    volumeCm3: 500,
    weightGrams: 220,
    pricePaise: 79000, // ₹790
    isFragile: false,
    isScented: false,
    tags: ["keepsake", "leather"]
  }
];

const RIBBONS = [
  { id: "RIB_SATIN_CREAM", name: "Satin Silk (Warm Ivory)", pricePaise: 0, hex: "#F5F2EB" },
  { id: "RIB_VELVET_BORDEAUX", name: "Crushed Velvet (Bordeaux Wine)", pricePaise: 15000, hex: "#4A1E29" },
  { id: "RIB_RAW_GOLD", name: "Raw Silk (Clay Gold)", pricePaise: 12000, hex: "#C89D42" },
  { id: "RIB_GROSGRAIN_FOREST", name: "French Grosgrain (Forest Pine)", pricePaise: 10000, hex: "#2E5A44" }
];

const WAX_SEALS = [
  { id: "WAX_BOTANICAL_GOLD", name: "Botanical Olive Sprig (Antique Gold)", pricePaise: 12000 },
  { id: "WAX_CREST_BORDEAUX", name: "Atelier Monogram Crest (Deep Bordeaux)", pricePaise: 15000 },
  { id: "WAX_HEART_ROSE", name: "Minimalist Heart (Rose Blush)", pricePaise: 12000 },
  { id: "WAX_FLORAL_SAGE", name: "Wildflower Wreath (Sage Green)", pricePaise: 12000 }
];

class HamperBuilderEngine {
  static getOptions() {
    return {
      boxes: Object.values(BOX_BASES),
      items: ATELIER_ITEMS,
      ribbons: RIBBONS,
      waxSeals: WAX_SEALS,
      minItems: 3,
      maxItems: 8
    };
  }

  static validateConfiguration(config) {
    const boxId = config.boxId || "BOX_KRAFT_RIGID";
    const box = BOX_BASES[boxId] || BOX_BASES.BOX_KRAFT_RIGID;
    const selectedItemIds = Array.isArray(config.itemIds) ? config.itemIds : [];

    const selectedItems = selectedItemIds
      .map(id => ATELIER_ITEMS.find(item => item.id === id))
      .filter(Boolean);

    // 1. Calculate Volume & Weight
    let totalVolumeCm3 = 0;
    let totalWeightGrams = 0;
    let scentedCount = 0;
    let fragileCount = 0;

    for (const item of selectedItems) {
      totalVolumeCm3 += item.volumeCm3;
      totalWeightGrams += item.weightGrams;
      if (item.isScented) scentedCount++;
      if (item.isFragile) fragileCount++;
    }

    const fullnessPercent = Math.min(150, Math.round((totalVolumeCm3 / box.capacityCm3) * 100));

    // Fullness status
    let fullnessStatus = "OPTIMAL";
    if (fullnessPercent === 0) fullnessStatus = "EMPTY";
    else if (fullnessPercent < 45) fullnessStatus = "UNDERFILLED";
    else if (fullnessPercent <= 90) fullnessStatus = "OPTIMAL";
    else if (fullnessPercent <= 100) fullnessStatus = "FULL";
    else fullnessStatus = "OVERFILLED";

    // 2. Business Rules & Collisions
    const warnings = [];
    const errors = [];

    if (selectedItems.length < 3) {
      warnings.push("Add at least " + (3 - selectedItems.length) + " more item(s) for a beautifully curated gift box.");
    } else if (selectedItems.length > 8) {
      errors.push("Maximum 8 items per hamper box to ensure secure artisanal arrangement.");
    }

    if (fullnessStatus === "OVERFILLED") {
      errors.push("Selected items exceed box volume capacity by " + (fullnessPercent - 100) + "%. Choose a larger box or remove an item.");
    }

    if (scentedCount > 2) {
      warnings.push("You have chosen " + scentedCount + " fragrant items. Fragrances may mingle during transit; our studio will wrap each individually in glassine paper.");
    }

    if (fragileCount >= 3) {
      warnings.push("Multiple glassware items selected. Our atelier will include customized molded paper pulp buffers.");
    }

    return {
      isValid: errors.length === 0,
      box,
      selectedItems,
      itemCount: selectedItems.length,
      totalVolumeCm3,
      boxCapacityCm3: box.capacityCm3,
      fullnessPercent,
      fullnessStatus,
      totalWeightGrams,
      fragileCount,
      scentedCount,
      warnings,
      errors
    };
  }
}

module.exports = { HamperBuilderEngine, BOX_BASES, ATELIER_ITEMS, RIBBONS, WAX_SEALS };
