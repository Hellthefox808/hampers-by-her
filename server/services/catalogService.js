/**
 * Hampers by Her — Enriched Product Catalog & Item View Service
 * Comprehensive SKU specifications, multi-angle asset manifests,
 * unboxing inclusions breakdown, and personalization matrices.
 */

const ENRICHED_CATALOG = {
  prod_wedding_vows: {
    id: "prod_wedding_vows",
    slug: "the-vows-and-vines-hamper",
    title: "The Vows & Vines Hamper",
    occasion: "Wedding",
    theme: "Understated Botanical",
    subtitle: "Elderflower tonic, wax-sealed card, dried hydrangea, castor-oil candle.",
    description: "Composed specifically for quiet wedding mornings and trousseau gifting. Tied in natural ecru raw silk ribbon with hand-stamped botanical wax seal.",
    story: "Inspired by the quiet twilight before vows are spoken, this curation blends calming elderflower, soothing amber light, and eternal dried botanicals sourced directly from artisan growers in the Nilgiris.",
    basePricePaise: 395000,
    priceRupees: "3,950",
    badge: "Best Seller",
    primaryImage: "images/hamper-wedding.jpg",
    gallery: [
      { id: "img_01", url: "images/hamper-wedding.jpg", alt: "The Vows & Vines Hamper - Master Ensemble", label: "Full Composition" },
      { id: "img_02", url: "images/hero-hamper.jpg", alt: "Unboxed Presentation Flat Lay", label: "Unboxing Lay" },
      { id: "img_03", url: "images/hamper-anniversary.jpg", alt: "Wax Seal & Silk Ribbon Detail", label: "Atelier Details" }
    ],
    videoTeaserUrl: "https://assets.hampersbyher.com/videos/vows-and-vines-unboxing.mp4",
    dimensionsCm: { length: 32, width: 25, height: 12 },
    weightGrams: 2850,
    boxVessel: "Linen-Lined Pine Keepsake Box with Brass Hinges",
    inclusions: [
      {
        id: "inc_01",
        name: "Craft Elderflower Botanical Tonic",
        artisan: "Svami Drinks Studio, Mumbai",
        quantity: "200 ml bottle",
        volumeCm3: 450,
        tags: ["Non-Alcoholic", "Craft Brew", "Botanical"],
        description: "Small-batch tonic brewed with Austrian elderflower and sparkling mountain spring water."
      },
      {
        id: "inc_02",
        name: "Amber & Smoked Vanilla Castor-Oil Candle",
        artisan: "Atelier Waxworks, Dehradun",
        quantity: "220g (45hr burn)",
        volumeCm3: 600,
        tags: ["100% Soy & Castor", "Lead-Free Cotton Wick", "Hand-Poured"],
        description: "Hand-poured into an amber glass jar with top notes of madagascar vanilla and cedarwood."
      },
      {
        id: "inc_03",
        name: "Everlasting Dried Hydrangea Posy",
        artisan: "Nilgiri Mountain Florals, Ooty",
        quantity: "1 hand-tied bundle",
        volumeCm3: 350,
        tags: ["Naturally Preserved", "Zero Maintenance", "Biodegradable"],
        description: "Delicately preserved hydrangea florets tied in Japanese washi cord."
      },
      {
        id: "inc_04",
        name: "Deckle-Edge Cotton Rag Greeting Card",
        artisan: "Hampers by Her Atelier, Delhi",
        quantity: "1 letter card & envelope",
        volumeCm3: 50,
        tags: ["Handmade Paper", "Gold Foiled", "Hand-Calligraphed"],
        description: "300 GSM handmade recycled cotton paper with botanical gold-foil monogram."
      }
    ],
    personalizationOptions: {
      ribbonColors: [
        { id: "RIB_ECRU_SILK", name: "Natural Ecru Raw Silk", hex: "#E8D5C4", default: true },
        { id: "RIB_BORDEAUX_VELVET", name: "Royal Bordeaux Velvet", hex: "#4A1E29" },
        { id: "RIB_FOREST_EMERALD", name: "Forest Emerald Satin", hex: "#2E5A44" },
        { id: "RIB_ANTIQUE_GOLD", name: "Antique Gold Grosgrain", hex: "#C89D42" }
      ],
      waxSeals: [
        { id: "SEAL_BOTANICAL_OLIVE", name: "Olive Branch Botanica", color: "Antique Bronze", default: true },
        { id: "SEAL_FLEUR_CREST", name: "Atelier Fleur Crest", color: "Deep Burgundy" },
        { id: "SEAL_DOUBLE_HEART", name: "Interlocking Vines", color: "Gilded Gold" }
      ],
      greetingCardIncluded: true,
      maxCardCharacters: 280
    },
    serviceability: {
      dispatchSlaHours: 24,
      expressAirEligible: true,
      temperatureSensitive: false,
      metroDeliveryDays: 2,
      restOfIndiaDays: 4
    },
    inventory: {
      inStock: true,
      remainingCount: 18,
      lowStockThreshold: 5
    },
    socialProof: {
      rating: 4.96,
      reviewsCount: 84,
      instagramTaggedReels: [
        { id: "reel_wed_01", code: "C8xY91zLmNo", views: "42.8K", author: "@ananya_weddings" }
      ]
    }
  },

  prod_corporate_wellwisher: {
    id: "prod_corporate_wellwisher",
    slug: "the-office-well-wisher",
    title: "The Office Well-Wisher",
    occasion: "Corporate",
    theme: "Minimalist Monogram",
    subtitle: "Single-origin cocoa, linen napkin, brass opener.",
    description: "Refined executive desk gift. Custom monogramming available on request.",
    story: "Designed for milestones, board greetings, and client appreciation. Subdued elegance with tactile brass and heirloom cocoa.",
    basePricePaise: 215000,
    priceRupees: "2,150",
    badge: "Artisan Pick",
    primaryImage: "images/hamper-corporate.jpg",
    gallery: [
      { id: "img_corp_01", url: "images/hamper-corporate.jpg", alt: "The Office Well-Wisher Hamper", label: "Desk Ensemble" },
      { id: "img_corp_02", url: "images/hero-hamper.jpg", alt: "Linen & Brass Lay", label: "Executive Accessories" }
    ],
    videoTeaserUrl: "https://assets.hampersbyher.com/videos/corporate-well-wisher.mp4",
    dimensionsCm: { length: 28, width: 22, height: 10 },
    weightGrams: 1650,
    boxVessel: "Matte Charcoal FSC-Certified Rigid Board with Magnetic Clasp",
    inclusions: [
      {
        id: "inc_corp_01",
        name: "Single-Origin Roasted Hazelnut Cocoa Tin",
        artisan: "Subko Specialty Roasters, Mumbai",
        quantity: "150g tin",
        volumeCm3: 400,
        tags: ["Single Estate", "Bean-to-Bar", "Zero Preservatives"],
        description: "Slow-roasted Idukki cacao stone-ground with caramelized Turkish hazelnuts."
      },
      {
        id: "inc_corp_02",
        name: "Washed Raw Silk & Linen Desk Napkin",
        artisan: "Bengaluru Loom Collective",
        quantity: "Set of 2 napkins",
        volumeCm3: 150,
        tags: ["Organic Linen", "Handwoven"],
        description: "Hand-dyed slate grey linen with hemstitch border."
      },
      {
        id: "inc_corp_03",
        name: "Solid Forged Brass Letter Opener",
        artisan: "Moradabad Metalcraft Guild",
        quantity: "1 solid brass piece",
        volumeCm3: 120,
        tags: ["Unlacquered Brass", "Lifetime Durability"],
        description: "Hand-cast brass with brushed matte finish that develops a natural patina over time."
      }
    ],
    personalizationOptions: {
      ribbonColors: [
        { id: "RIB_CHARCOAL_GROSGRAIN", name: "Slate Charcoal Grosgrain", hex: "#3A3D40", default: true },
        { id: "RIB_ANTIQUE_GOLD", name: "Antique Gold Grosgrain", hex: "#C89D42" }
      ],
      waxSeals: [
        { id: "SEAL_GEOMETRIC_MINIMAL", name: "Modern Atelier Monogram", color: "Matte Black", default: true },
        { id: "SEAL_ANTIQUE_GOLD", name: "Gilded Seal", color: "Antique Gold" }
      ],
      greetingCardIncluded: true,
      maxCardCharacters: 240
    },
    serviceability: {
      dispatchSlaHours: 24,
      expressAirEligible: true,
      temperatureSensitive: false,
      metroDeliveryDays: 2,
      restOfIndiaDays: 3
    },
    inventory: {
      inStock: true,
      remainingCount: 34,
      lowStockThreshold: 10
    },
    socialProof: {
      rating: 4.88,
      reviewsCount: 62,
      instagramTaggedReels: [
        { id: "reel_corp_01", code: "C9aB33zKxY", views: "19.4K", author: "@design_collective" }
      ]
    }
  },

  prod_festive_diwali: {
    id: "prod_festive_diwali",
    slug: "the-diwali-slow-burn",
    title: "The Diwali Slow-Burn",
    occasion: "Festive",
    theme: "Terracotta Warmth",
    subtitle: "Brass diya, dried citrus, slow-burn incense.",
    description: "Warm artisanal glow for autumn festivals. Scented with wild sandalwood and dried orange peel.",
    story: "A reverent celebration of light and heritage craft. Hand-beaten brass illuminating slow-burning sacred woods.",
    basePricePaise: 285000,
    priceRupees: "2,850",
    badge: "Limited Festive",
    primaryImage: "images/hamper-festive.jpg",
    gallery: [
      { id: "img_fest_01", url: "images/hamper-festive.jpg", alt: "The Diwali Slow-Burn Hamper", label: "Festive Composition" },
      { id: "img_fest_02", url: "images/hero-hamper.jpg", alt: "Brass Diya Glow", label: "Artisan Elements" }
    ],
    videoTeaserUrl: "https://assets.hampersbyher.com/videos/diwali-slow-burn.mp4",
    dimensionsCm: { length: 30, width: 24, height: 11 },
    weightGrams: 2200,
    boxVessel: "Terracotta Board Casket with Gold Foil Paisley Inlay",
    inclusions: [
      {
        id: "inc_fest_01",
        name: "Hand-Cast Brass Diya",
        artisan: "Thanjavur Bell Metal Works",
        quantity: "1 polished brass diya",
        volumeCm3: 300,
        tags: ["Traditional Cast", "Solid Brass"],
        description: "Heavy solid brass diya crafted using traditional lost-wax casting technique."
      },
      {
        id: "inc_fest_02",
        name: "Slow-Burn Temple Sandalwood Incense",
        artisan: "Mysore Forest Cooperative",
        quantity: "Box of 20 sticks + brass holder",
        volumeCm3: 200,
        tags: ["Charcoal-Free", "Pure Essential Oils"],
        description: "Naturally dried sandalwood and resin rolled on bamboo cores."
      },
      {
        id: "inc_fest_03",
        name: "Sun-Dried Citrus & Clove Garland",
        artisan: "Nagpur Orchard Dryers",
        quantity: "1 scented garland (35 cm)",
        volumeCm3: 280,
        tags: ["Natural Botanicals", "Seasonal Fragrance"],
        description: "Dried blood orange wheels and whole cloves emitting a festive aroma."
      },
      {
        id: "inc_fest_04",
        name: "Pressed Marigold Deckle Note",
        artisan: "Hampers by Her Atelier, Delhi",
        quantity: "1 handmade greeting card",
        volumeCm3: 50,
        tags: ["Real Petals Pressed", "Gold Foiled"],
        description: "Recycled cotton paper embedded with real dried marigold petals."
      }
    ],
    personalizationOptions: {
      ribbonColors: [
        { id: "RIB_TERRACOTTA_SILK", name: "Terracotta Raw Silk", hex: "#B85D36", default: true },
        { id: "RIB_ANTIQUE_GOLD", name: "Antique Gold Grosgrain", hex: "#C89D42" }
      ],
      waxSeals: [
        { id: "SEAL_DIYA_FLAME", name: "Diya Flame Crest", color: "Gilded Gold", default: true },
        { id: "SEAL_BOTANICAL_OLIVE", name: "Olive Branch Botanica", color: "Warm Terracotta" }
      ],
      greetingCardIncluded: true,
      maxCardCharacters: 300
    },
    serviceability: {
      dispatchSlaHours: 24,
      expressAirEligible: true,
      temperatureSensitive: false,
      metroDeliveryDays: 2,
      restOfIndiaDays: 4
    },
    inventory: {
      inStock: true,
      remainingCount: 12,
      lowStockThreshold: 5
    },
    socialProof: {
      rating: 4.98,
      reviewsCount: 110,
      instagramTaggedReels: [
        { id: "reel_fest_01", code: "C9pL12qZaB", views: "68.2K", author: "@festive_homes_delhi" }
      ]
    }
  },

  prod_anniversary_letter: {
    id: "prod_anniversary_letter",
    slug: "the-ten-year-letter",
    title: "The Ten-Year Letter",
    occasion: "Anniversary",
    theme: "Royal Bordeaux",
    subtitle: "Pressed rose, small-batch mead, a letter you can keep.",
    description: "Our signature romantic edit. Features deckle-edge paper and heirloom wax stamp.",
    story: "Designed as an enduring testament of devotion. Intended to be opened slowly, savoring vintage scents and memories.",
    basePricePaise: 320000,
    priceRupees: "3,200",
    badge: "Signature",
    primaryImage: "images/hamper-anniversary.jpg",
    gallery: [
      { id: "img_ann_01", url: "images/hamper-anniversary.jpg", alt: "The Ten-Year Letter Hamper", label: "Romantic Suite" },
      { id: "img_ann_02", url: "images/hero-hamper.jpg", alt: "Wax Seal Close-Up", label: "Heirloom Craft" }
    ],
    videoTeaserUrl: "https://assets.hampersbyher.com/videos/ten-year-letter.mp4",
    dimensionsCm: { length: 30, width: 22, height: 11 },
    weightGrams: 2100,
    boxVessel: "Royal Bordeaux Velvet Casket with Gilded Hardware",
    inclusions: [
      {
        id: "inc_ann_01",
        name: "Pressed Kashmiri Rose & Damascena Blossom",
        artisan: "Srinagar Flower Press",
        quantity: "1 framed keepsake botanical card",
        volumeCm3: 150,
        tags: ["Kashmiri Rose", "Hand-Pressed"],
        description: "Naturally dried and pressed wild Kashmiri rose blossom preserved under glass-finish card."
      },
      {
        id: "inc_ann_02",
        name: "Artisanal Rose-Petal Dark Chocolate Truffles",
        artisan: "Smoor Artisan Confections, Bengaluru",
        quantity: "Box of 6 gourmet truffles",
        volumeCm3: 250,
        tags: ["70% Single Origin", "Edible Gold Leaf"],
        description: "Belgian single-origin cocoa ganache infused with organic edible rose essence."
      },
      {
        id: "inc_ann_03",
        name: "Deckle-Edge Letter Card with Wax Seal",
        artisan: "Hampers by Her Atelier, Delhi",
        quantity: "1 folded letter & vintage envelope",
        volumeCm3: 50,
        tags: ["Heirloom Paper", "Burgundy Wax"],
        description: "Deckle-edge paper suited for personal poetry or heartfelt anniversary letters."
      },
      {
        id: "inc_ann_04",
        name: "Crushed Velvet Wine Ribbon Tie",
        artisan: "Varanasi Silk Weavers",
        quantity: "1 heirloom ribbon wrap",
        volumeCm3: 80,
        tags: ["Silk Velvet", "Hand-Fringed"],
        description: "Deep bordeaux double-faced velvet ribbon."
      }
    ],
    personalizationOptions: {
      ribbonColors: [
        { id: "RIB_BORDEAUX_VELVET", name: "Royal Bordeaux Velvet", hex: "#4A1E29", default: true },
        { id: "RIB_ECRU_SILK", name: "Natural Ecru Raw Silk", hex: "#E8D5C4" },
        { id: "RIB_ANTIQUE_GOLD", name: "Antique Gold Grosgrain", hex: "#C89D42" }
      ],
      waxSeals: [
        { id: "SEAL_FLEUR_CREST", name: "Atelier Fleur Crest", color: "Deep Burgundy", default: true },
        { id: "SEAL_BOTANICAL_OLIVE", name: "Olive Branch Botanica", color: "Gilded Gold" }
      ],
      greetingCardIncluded: true,
      maxCardCharacters: 320
    },
    serviceability: {
      dispatchSlaHours: 24,
      expressAirEligible: true,
      temperatureSensitive: true,
      metroDeliveryDays: 1,
      restOfIndiaDays: 3
    },
    inventory: {
      inStock: true,
      remainingCount: 7,
      lowStockThreshold: 4
    },
    socialProof: {
      rating: 4.99,
      reviewsCount: 142,
      instagramTaggedReels: [
        { id: "reel_ann_01", code: "C9kX44wVuT", views: "85.1K", author: "@priya_lifestyle" }
      ]
    }
  }
};

class CatalogService {
  /**
   * List all products with optional filters
   */
  static getProducts({ occasion, search, limit = 20, offset = 0 } = {}) {
    let items = Object.values(ENRICHED_CATALOG);

    if (occasion && occasion !== "all") {
      items = items.filter(p => p.occasion.toLowerCase() === occasion.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.inclusions.some(inc => inc.name.toLowerCase().includes(q))
      );
    }

    const total = items.length;
    const paginated = items.slice(offset, offset + limit);

    return {
      total,
      limit,
      offset,
      items: paginated
    };
  }

  /**
   * Get enriched product detail by ID or Slug
   */
  static getProductById(idOrSlug) {
    if (!idOrSlug) return null;
    if (ENRICHED_CATALOG[idOrSlug]) {
      return ENRICHED_CATALOG[idOrSlug];
    }
    const found = Object.values(ENRICHED_CATALOG).find(p => p.slug === idOrSlug || p.id === idOrSlug);
    return found || null;
  }

  /**
   * Get recommended pairing items for an existing hamper
   */
  static getRecommendations(productId) {
    const current = this.getProductById(productId);
    if (!current) return [];

    return Object.values(ENRICHED_CATALOG)
      .filter(p => p.id !== current.id)
      .map(p => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        priceRupees: p.priceRupees,
        badge: p.badge,
        primaryImage: p.primaryImage,
        occasion: p.occasion
      }))
      .slice(0, 3);
  }
}

module.exports = { CatalogService, ENRICHED_CATALOG };
