const test = require("node:test");
const assert = require("node:assert");
const { HamperBuilderEngine, BOX_BASES } = require("../server/services/hamperBuilder");

test("HamperBuilder - Validates box capacity and computes fullness percentage", () => {
  const validation = HamperBuilderEngine.validateConfiguration({
    boxId: "BOX_KRAFT_RIGID", // Capacity: 5200 cm3
    itemIds: [
      "ITEM_CANDLE_AMBER",          // 750 cm3
      "ITEM_CHOCO_DARK_HAZELNUT",   // 450 cm3
      "ITEM_TEA_ROSE_BLUSH"         // 600 cm3
    ]
  });

  assert.strictEqual(validation.totalVolumeCm3, 1800);
  assert.strictEqual(validation.itemCount, 3);
  assert.strictEqual(validation.fullnessPercent, 35);
  assert.strictEqual(validation.fullnessStatus, "UNDERFILLED");
  assert.strictEqual(validation.isValid, true);
});

test("HamperBuilder - Rejects overfilled hampers exceeding 100% capacity", () => {
  // Select enough items to exceed 5200 cm3: 750*4 + 850*3 = 3000 + 2550 = 5550 cm3
  const validation = HamperBuilderEngine.validateConfiguration({
    boxId: "BOX_KRAFT_RIGID", // Capacity: 5200 cm3
    itemIds: [
      "ITEM_CANDLE_AMBER",
      "ITEM_CANDLE_AMBER",
      "ITEM_CANDLE_AMBER",
      "ITEM_CANDLE_AMBER",
      "ITEM_BATH_SALTS",
      "ITEM_BATH_SALTS",
      "ITEM_BATH_SALTS"
    ]
  });

  assert.strictEqual(validation.totalVolumeCm3, 5550);
  assert.ok(validation.totalVolumeCm3 > 5200);
  assert.strictEqual(validation.fullnessStatus, "OVERFILLED");
  assert.strictEqual(validation.isValid, false);
  assert.ok(validation.errors.some(e => e.includes("exceed box volume capacity")));
});

test("HamperBuilder - Warns on fewer than 3 items", () => {
  const validation = HamperBuilderEngine.validateConfiguration({
    boxId: "BOX_KRAFT_RIGID",
    itemIds: ["ITEM_CANDLE_AMBER"]
  });

  assert.strictEqual(validation.itemCount, 1);
  assert.ok(validation.warnings.some(w => w.includes("Add at least 2 more item(s)")));
});
