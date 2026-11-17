const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const WEBSITE_DIR = path.join(__dirname, "..", "website");

describe("Theme Factory - 11-Preset Design Token Engine & Executive Lookbook Deck", () => {
  const expectedPresetIds = [
    "desert-rose",
    "golden-hour",
    "botanical-garden",
    "forest-canopy",
    "sunset-boulevard",
    "arctic-frost",
    "modern-minimalist",
    "ocean-depths",
    "midnight-galaxy",
    "tech-innovation"
  ];

  it("website/themes.css defines all 10 official Theme Factory selectors and dark-mode contrast rules", () => {
    const css = fs.readFileSync(path.join(WEBSITE_DIR, "themes.css"), "utf8");
    for (const id of expectedPresetIds) {
      assert.ok(css.includes(`[data-theme="${id}"]`), `Missing [data-theme="${id}"] selector in themes.css`);
    }
    assert.ok(css.includes(".theme-studio-fab"), "Missing .theme-studio-fab floating widget styles");
    assert.ok(css.includes(".theme-studio-panel"), "Missing .theme-studio-panel popover styles");
    assert.ok(css.includes("color-scheme: dark;"), "Missing dark color-scheme declarations for dark presets");
  });

  it("website/theme-switcher.js registers all 11 presets (Atelier Signature + 10 Theme Factory) with localStorage sync", () => {
    const js = fs.readFileSync(path.join(WEBSITE_DIR, "theme-switcher.js"), "utf8");
    assert.ok(js.includes("atelier-signature"), "Missing atelier-signature default preset");
    for (const id of expectedPresetIds) {
      assert.ok(js.includes(`id: "${id}"`), `Missing theme catalog entry for ${id}`);
    }
    assert.ok(js.includes("hbh_theme_factory_v1"), "Missing localStorage persistence key");
    assert.ok(js.includes("window.HBHThemeFactory"), "Missing public HBHThemeFactory API");
  });

  it("Storefront (index.html), Studio OS (admin.html), and Lookbook (lookbook.html) all load themes.css and theme-switcher.js", () => {
    for (const file of ["index.html", "admin.html", "lookbook.html"]) {
      const html = fs.readFileSync(path.join(WEBSITE_DIR, file), "utf8");
      assert.ok(html.includes('href="themes.css"'), `${file} must load themes.css`);
      assert.ok(html.includes('src="theme-switcher.js"'), `${file} must load theme-switcher.js`);
    }
  });

  it("Executive Lookbook Deck (lookbook.html) contains all 8 slides and keyboard navigation", () => {
    const html = fs.readFileSync(path.join(WEBSITE_DIR, "lookbook.html"), "utf8");
    for (let i = 1; i <= 8; i++) {
      assert.ok(html.includes(`data-slide="${i}"`), `Missing slide ${i} in lookbook.html`);
    }
    assert.ok(html.includes("ArrowRight") && html.includes("ArrowLeft"), "Missing keyboard slide navigation");
    assert.ok(html.includes("@media print"), "Missing print-to-PDF stylesheet support");
  });
});
