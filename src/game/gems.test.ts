import assert from "node:assert/strict";
import test from "node:test";
import { gemEffect } from "./gems.ts";

test("gems - family and clarity deterministically define rank and effect", () => {
  assert.deepEqual(gemEffect("ruby", "flawed"), {
    resourceId: "ruby",
    family: "power",
    clarity: "flawed",
    rank: 2,
    label: "Power II",
    scope: "canonical",
    stat: "damage",
    amount: 2,
  });
  assert.deepEqual(gemEffect("sapphire", "flawless"), {
    resourceId: "sapphire",
    family: "fortune",
    clarity: "flawless",
    rank: 4,
    label: "Fortune IV",
    scope: "local",
    stat: "fortune",
    amount: 4,
  });
});

test("gems - all five clarities map monotonically and effects are frozen", () => {
  const clarities = ["cracked", "flawed", "cut", "flawless", "perfect"] as const;
  for (const resourceId of ["ruby", "sapphire"] as const) {
    const effects = clarities.map((clarity) => gemEffect(resourceId, clarity));
    assert.deepEqual(effects.map(({ rank }) => rank), [1, 2, 3, 4, 5]);
    assert.deepEqual(effects.map(({ amount }) => amount), [1, 2, 3, 4, 5]);
    assert.ok(effects.every(Object.isFrozen));
  }
});
