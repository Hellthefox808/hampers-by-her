const test = require("node:test");
const assert = require("node:assert/strict");
const { CatalogService, ENRICHED_CATALOG } = require("../server/services/catalogService");

test("CatalogService - Returns all curated products", () => {
  const result = CatalogService.getProducts();
  assert.equal(result.total, 4);
  assert.equal(result.items.length, 4);
});

test("CatalogService - Filters by occasion", () => {
  const wedding = CatalogService.getProducts({ occasion: "wedding" });
  assert.equal(wedding.items.length, 1);
  assert.equal(wedding.items[0].id, "prod_wedding_vows");

  const festive = CatalogService.getProducts({ occasion: "festive" });
  assert.equal(festive.items.length, 1);
  assert.equal(festive.items[0].id, "prod_festive_diwali");
});

test("CatalogService - Searches across titles, descriptions, and inclusions", () => {
  const searchElder = CatalogService.getProducts({ search: "elderflower" });
  assert.equal(searchElder.items.length, 1);
  assert.equal(searchElder.items[0].id, "prod_wedding_vows");

  const searchBrass = CatalogService.getProducts({ search: "brass" });
  // Corporate (brass opener) and Festive (brass diya)
  assert.equal(searchBrass.items.length, 2);
});

test("CatalogService - Retrieves enriched item view by ID and slug", () => {
  const itemById = CatalogService.getProductById("prod_anniversary_letter");
  assert.ok(itemById);
  assert.equal(itemById.title, "The Ten-Year Letter");
  assert.ok(itemById.inclusions.length >= 4);
  assert.ok(itemById.gallery.length >= 2);
  assert.ok(itemById.personalizationOptions.ribbonColors.length >= 3);

  const itemBySlug = CatalogService.getProductById("the-ten-year-letter");
  assert.ok(itemBySlug);
  assert.equal(itemBySlug.id, "prod_anniversary_letter");
});

test("CatalogService - Handles non-existent products gracefully", () => {
  const missing = CatalogService.getProductById("prod_unknown_123");
  assert.equal(missing, null);
});

test("CatalogService - Generates recommendations excluding self", () => {
  const recs = CatalogService.getRecommendations("prod_wedding_vows");
  assert.ok(recs.length > 0);
  assert.ok(!recs.some(r => r.id === "prod_wedding_vows"));
});
