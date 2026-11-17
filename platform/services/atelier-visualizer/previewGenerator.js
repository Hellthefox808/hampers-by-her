/**
 * HAMPERS BY HER — ATELIER PROCEDURAL LUXURY SVG & VISUAL PREVIEW GENERATOR
 * 
 * Generates photorealistic vector preview graphics for bespoke artisanal hampers:
 * - Handcrafted keepsake boxes with debossed gold foil emblem
 * - Hand-tied raw silk ribbons with natural fabric sheen gradients
 * - Stamped botanical wax seals with customized patron monograms
 * - Copperplate calligraphy parchment greeting cards with deckled edges
 */

const RIBBON_PALETTES = {
  burgundy_merlot: { name: "Burgundy Merlot", primary: "#4A1E29", highlight: "#6B2D3C", shadow: "#2D1018" },
  champagne_gold: { name: "Champagne Gold", primary: "#C89D42", highlight: "#E2BC68", shadow: "#8E6C23" },
  forest_emerald: { name: "Forest Emerald", primary: "#2E5A44", highlight: "#3D7559", shadow: "#1A3828" },
  blush_rose: { name: "Blush Rose", primary: "#D9A0A8", highlight: "#EDB8C0", shadow: "#A66D76" },
  midnight_navy: { name: "Midnight Navy", primary: "#1E293B", highlight: "#334155", shadow: "#0F172A" }
};

const WAX_SEAL_PALETTES = {
  vintage_gold: { name: "Vintage Gold Wax", primary: "#C59B3F", highlight: "#F3DC82", shadow: "#7A5915" },
  bordeaux_red: { name: "Bordeaux Merlot Wax", primary: "#5B1D27", highlight: "#822E3C", shadow: "#320E15" },
  forest_sage: { name: "Forest Sage Wax", primary: "#335E47", highlight: "#4E8566", shadow: "#1B3929" },
  antique_bronze: { name: "Antique Bronze Wax", primary: "#7D5836", highlight: "#A67A4F", shadow: "#48301B" }
};

const BOX_STYLES = {
  BOX_LINEN_KEEPSAKE: { name: "Linen Keepsake Box", baseColor: "#F5F2EB", shadowColor: "#D6D0C3", lidColor: "#EAE5DB", texture: "linen" },
  BOX_VELVET_CHEST: { name: "Royal Velvet Chest", baseColor: "#3B141E", shadowColor: "#22080E", lidColor: "#4E1B28", texture: "velvet" },
  BOX_KRAFT_RIGID: { name: "Raw Kraft Rigid Box", baseColor: "#C9A982", shadowColor: "#A3825C", lidColor: "#BCA07B", texture: "kraft" }
};

/**
 * Escapes text for XML/SVG safety
 * @param {string} str
 * @returns {string}
 */
function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generates an ultra-luxurious, production-grade vector SVG illustration of a personalized hamper
 * @param {Object} options
 * @param {string} [options.boxId="BOX_LINEN_KEEPSAKE"]
 * @param {string} [options.ribbonColor="burgundy_merlot"]
 * @param {string} [options.waxSealColor="vintage_gold"]
 * @param {string} [options.sealMotif="monogram_hbh"] "monogram_hbh" | "botanical_wreath" | "celestial_star"
 * @param {string} [options.monogramInitials="HBH"] 2-3 letters
 * @param {string} [options.cardMessage="To someone truly cherished..."]
 * @param {string} [options.recipientName="Aditi"]
 * @param {number} [options.width=800]
 * @param {number} [options.height=600]
 * @returns {string} SVG markup
 */
function generateHamperPreviewSvg({
  boxId = "BOX_LINEN_KEEPSAKE",
  ribbonColor = "burgundy_merlot",
  waxSealColor = "vintage_gold",
  sealMotif = "monogram_hbh",
  monogramInitials = "HBH",
  cardMessage = "To someone truly cherished, with warmest congratulations on your joyous milestone.",
  recipientName = "Aditi",
  width = 800,
  height = 600
}) {
  const box = BOX_STYLES[boxId] || BOX_STYLES.BOX_LINEN_KEEPSAKE;
  const ribbon = RIBBON_PALETTES[ribbonColor] || RIBBON_PALETTES.burgundy_merlot;
  const seal = WAX_SEAL_PALETTES[waxSealColor] || WAX_SEAL_PALETTES.vintage_gold;
  const initials = escapeXml((monogramInitials || "HBH").slice(0, 3).toUpperCase());
  const safeMessage = escapeXml(cardMessage);
  const safeRecipient = escapeXml(recipientName);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <!-- Studio Ambient Radial Shadow -->
    <radialGradient id="studioShadow" cx="50%" cy="85%" r="45%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>

    <!-- Keepsake Box Shading -->
    <linearGradient id="boxLidGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${box.lidColor}"/>
      <stop offset="100%" stop-color="${box.shadowColor}"/>
    </linearGradient>

    <!-- Raw Silk Ribbon Gradients -->
    <linearGradient id="ribbonGradH" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${ribbon.highlight}"/>
      <stop offset="50%" stop-color="${ribbon.primary}"/>
      <stop offset="100%" stop-color="${ribbon.shadow}"/>
    </linearGradient>

    <linearGradient id="ribbonGradV" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${ribbon.highlight}"/>
      <stop offset="50%" stop-color="${ribbon.primary}"/>
      <stop offset="100%" stop-color="${ribbon.shadow}"/>
    </linearGradient>

    <!-- Wax Seal 3D Shading -->
    <radialGradient id="waxSealGrad" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="${seal.highlight}"/>
      <stop offset="45%" stop-color="${seal.primary}"/>
      <stop offset="100%" stop-color="${seal.shadow}"/>
    </radialGradient>

    <!-- Gold Foil Typography Gradient -->
    <linearGradient id="goldFoil" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCEBA4"/>
      <stop offset="40%" stop-color="#D4AF37"/>
      <stop offset="70%" stop-color="#AA771C"/>
      <stop offset="100%" stop-color="#F1D175"/>
    </linearGradient>

    <!-- Drop Shadows -->
    <filter id="boxShadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#1A0D11" flood-opacity="0.18"/>
    </filter>
    <filter id="ribbonShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="2" dy="5" stdDeviation="4" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
    <filter id="waxShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="3" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>

  <!-- Background Atelier Canvas -->
  <rect width="100%" height="100%" fill="#FBF9F5"/>
  <ellipse cx="400" cy="510" rx="260" ry="40" fill="url(#studioShadow)"/>

  <!-- Keepsake Box Container -->
  <g id="keepsake-box" filter="url(#boxShadow)">
    <!-- Box Body -->
    <rect x="200" y="160" width="400" height="320" rx="14" fill="${box.baseColor}" stroke="${box.shadowColor}" stroke-width="2"/>
    <!-- Lid Lip & Bevel -->
    <rect x="190" y="140" width="420" height="70" rx="10" fill="url(#boxLidGrad)" stroke="#C89D42" stroke-width="1.5" stroke-opacity="0.4"/>
    <line x1="200" y1="205" x2="600" y2="205" stroke="#C89D42" stroke-width="0.8" stroke-dasharray="6,4" stroke-opacity="0.5"/>
  </g>

  <!-- Calligraphy Greeting Card Tucked Under Ribbon -->
  <g id="calligraphy-card" transform="rotate(-6, 360, 290)">
    <rect x="230" y="230" width="220" height="150" rx="4" fill="#FFFDF8" stroke="#E3DAC9" stroke-width="1.5" filter="url(#ribbonShadow)"/>
    <!-- Deckled Gold Trim -->
    <rect x="236" y="236" width="208" height="138" fill="none" stroke="url(#goldFoil)" stroke-width="0.75" stroke-opacity="0.6"/>
    <!-- Copperplate Typography -->
    <text x="250" y="265" font-family="'Playfair Display', Georgia, serif" font-size="14" font-weight="700" fill="#4A1E29" font-style="italic">Dearest ${safeRecipient},</text>
    <foreignObject x="250" y="275" width="180" height="75">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:'Plus Jakarta Sans',sans-serif;font-size:10px;line-height:1.4;color:#47383B;font-style:italic;">
        ${safeMessage}
      </div>
    </foreignObject>
    <text x="410" y="360" font-family="'Playfair Display', Georgia, serif" font-size="10" text-anchor="end" fill="#C89D42">✦ Hampers by Her</text>
  </g>

  <!-- Handcrafted Raw Silk Ribbon (Horizontal & Vertical Bands) -->
  <g id="raw-silk-ribbons" filter="url(#ribbonShadow)">
    <!-- Vertical Ribbon Band -->
    <rect x="375" y="140" width="50" height="340" fill="url(#ribbonGradV)"/>
    <!-- Horizontal Ribbon Band -->
    <rect x="190" y="285" width="420" height="50" fill="url(#ribbonGradH)"/>
    
    <!-- Hand-Tied Luxury Bow Loops -->
    <!-- Left Loop -->
    <path d="M 400 310 C 330 250, 290 280, 360 325 C 385 330, 400 315, 400 310 Z" fill="${ribbon.primary}" stroke="${ribbon.highlight}" stroke-width="1"/>
    <!-- Right Loop -->
    <path d="M 400 310 C 470 250, 510 280, 440 325 C 415 330, 400 315, 400 310 Z" fill="${ribbon.primary}" stroke="${ribbon.highlight}" stroke-width="1"/>
    <!-- Ribbon Tails -->
    <path d="M 390 320 Q 360 410, 330 450 L 350 455 Q 380 400, 400 330 Z" fill="${ribbon.shadow}" opacity="0.9"/>
    <path d="M 410 320 Q 440 415, 480 445 L 460 452 Q 425 400, 405 330 Z" fill="${ribbon.shadow}" opacity="0.9"/>
  </g>

  <!-- Hand-Poured Botanical Wax Seal with Monogram -->
  <g id="botanical-wax-seal" filter="url(#waxShadow)" transform="translate(400, 310)">
    <!-- Organic Molten Wax Outer Contour -->
    <path d="M 0 -36 C 18 -38, 32 -26, 36 -10 C 42 6, 34 24, 22 34 C 8 42, -14 41, -26 32 C -38 22, -42 2, -35 -16 C -28 -30, -12 -34, 0 -36 Z" fill="url(#waxSealGrad)"/>
    
    <!-- Inner Rim Stamp Bevel -->
    <circle cx="0" cy="0" r="24" fill="none" stroke="${seal.highlight}" stroke-width="1.8" stroke-opacity="0.8"/>
    <circle cx="0" cy="0" r="21" fill="none" stroke="${seal.shadow}" stroke-width="1" stroke-opacity="0.6"/>

    <!-- Botanical Laurel Wreath Accents -->
    <path d="M -16 -4 C -20 6, -12 16, 0 18 C 12 16, 20 6, 16 -4" fill="none" stroke="${seal.highlight}" stroke-width="1" stroke-dasharray="2,2"/>

    <!-- Embossed Client Monogram Initials -->
    <text x="0" y="6" font-family="'Playfair Display', Georgia, serif" font-size="15" font-weight="700" text-anchor="middle" fill="${seal.highlight}" filter="drop-shadow(1px 1px 1px ${seal.shadow})">
      ${initials}
    </text>
  </g>

  <!-- Atelier Authentic Provenance Brand Stamp -->
  <g id="atelier-provenance" transform="translate(400, 470)">
    <text x="0" y="0" font-family="'Playfair Display', Georgia, serif" font-size="11" font-weight="600" text-anchor="middle" letter-spacing="3" fill="#8E6C23">
      HAMPERS BY HER · ATELIER BESPÔKE
    </text>
  </g>
</svg>`;
}

/**
 * Returns Base64 Data URI for direct <img src="..."> consumption in web/mobile UI
 * @param {Object} options
 * @returns {string} Data URI
 */
function generateHamperPreviewDataUri(options) {
  const svg = generateHamperPreviewSvg(options);
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

module.exports = {
  RIBBON_PALETTES,
  WAX_SEAL_PALETTES,
  BOX_STYLES,
  generateHamperPreviewSvg,
  generateHamperPreviewDataUri
};
