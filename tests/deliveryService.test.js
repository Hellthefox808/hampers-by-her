const test = require("node:test");
const assert = require("node:assert");
const { DeliveryService } = require("../server/services/deliveryService");

test("DeliveryService - Correctly identifies Delhi Metro PIN code", () => {
  const result = DeliveryService.checkPincode("110001");
  assert.strictEqual(result.isServiceable, true);
  assert.strictEqual(result.city, "New Delhi");
  assert.strictEqual(result.zone, "METRO_AIR");
  assert.strictEqual(result.standardDays, 2);
  assert.strictEqual(result.expressAvailable, true);
});

test("DeliveryService - Correctly identifies Mumbai Metro PIN code", () => {
  const result = DeliveryService.checkPincode("400050");
  assert.strictEqual(result.isServiceable, true);
  assert.strictEqual(result.city, "Mumbai");
  assert.strictEqual(result.zone, "METRO_AIR");
});

test("DeliveryService - Rejects malformed and invalid PIN codes", () => {
  const invalid1 = DeliveryService.checkPincode("123");
  assert.strictEqual(invalid1.isServiceable, false);

  const invalid2 = DeliveryService.checkPincode("012345");
  assert.strictEqual(invalid2.isServiceable, false);

  const invalid3 = DeliveryService.checkPincode("ABCD12");
  assert.strictEqual(invalid3.isServiceable, false);
});
