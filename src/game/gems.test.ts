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
  assert.deepEqual(gemEffect("emerald", "cut"), {
    resourceId: "emerald",
    family: "precision",
    clarity: "cut",
    rank: 3,
    label: "Precision III",
    scope: "canonical",
    stat: "hitBonus",
    amount: 3,
  });
  assert.deepEqual(gemEffect("diamond", "flawless"), {
    resourceId: "diamond",
    family: "protection",
    clarity: "flawless",
    rank: 4,
    label: "Protection IV",
    scope: "canonical",
    stat: "armor",
    amount: 1,
  });
});

test("gems - all five clarities map monotonically and effects are frozen", () => {
  const clarities = ["cracked", "flawed", "cut", "flawless", "perfect"] as const;
  for (const resourceId of ["ruby", "sapphire", "emerald"] as const) {
    const effects = clarities.map((clarity) => gemEffect(resourceId, clarity));
    assert.deepEqual(effects.map(({ rank }) => rank), [1, 2, 3, 4, 5]);
    assert.deepEqual(effects.map(({ amount }) => amount), [1, 2, 3, 4, 5]);
    assert.ok(effects.every(Object.isFrozen));
  }
});

test("gems - amethyst carries the mastery family onto the skill axis", () => {
  assert.deepEqual(gemEffect("amethyst", "flawless"), {
    resourceId: "amethyst",
    family: "mastery",
    clarity: "flawless",
    rank: 4,
    label: "Mastery IV",
    scope: "canonical",
    stat: "skill",
    amount: 2,
  });
});

test("gems - amethyst's mastery ladder is monotonic", () => {
  const clarities = ["cracked", "flawed", "cut", "flawless", "perfect"] as const;
  const effects = clarities.map((clarity) => gemEffect("amethyst", clarity));
  assert.deepEqual(effects.map(({ rank }) => rank), [1, 2, 3, 4, 5]);
  assert.deepEqual(effects.map(({ amount }) => amount), [0.5, 1, 1.5, 2, 3]);
  assert.ok(effects.every(({ stat, scope }) => stat === "skill" && scope === "canonical"));
  assert.ok(effects.every(Object.isFrozen));
});

test("gems - diamond's protection ladder is monotonic within the armor budget", () => {
  const clarities = ["cracked", "flawed", "cut", "flawless", "perfect"] as const;
  const effects = clarities.map((clarity) => gemEffect("diamond", clarity));
  assert.deepEqual(effects.map(({ rank }) => rank), [1, 2, 3, 4, 5]);
  assert.deepEqual(effects.map(({ amount }) => amount), [0.25, 0.5, 0.75, 1, 1.5]);
  assert.ok(effects.every(({ stat, scope }) => stat === "armor" && scope === "canonical"));
  assert.ok(effects.every(Object.isFrozen));
});
