import assert from "node:assert/strict";
import test from "node:test";
import {
  GEM_HARVEST_SKILL_BANDS,
  HARVEST_TOOL_POLICY,
  MATERIAL_HARVEST_SKILL_BANDS,
  UNKNOWN_RESOURCE_MESSAGE,
  assessResourceHarvest,
  harvestToolTier,
  identifyHarvestNode,
  meetsHarvestToolTier,
  type HarvestYield,
} from "./harvest.ts";

function assertDeepFrozen(value: unknown, path = "root"): void {
  if (typeof value !== "object" || value === null) return;
  assert.equal(Object.isFrozen(value), true, `${path} is frozen`);
  for (const [key, nested] of Object.entries(value)) assertDeepFrozen(nested, `${path}.${key}`);
}

const pristineRedwood = { seed: 1_419, tx: 188, ty: 88, nodeKind: "tree", discovered: false } as const;
const perfectRuby = { seed: 532, tx: 470, ty: 420, nodeKind: "rock", discovered: false } as const;

function assertCompileTimeHarvestYieldCorrelation(): void {
  // @ts-expect-error A gem cannot use the timber form even with a valid gem key and clarity.
  const invalidForm: HarvestYield = { key: "ruby:gem:cut", resourceId: "ruby", form: "log", quality: "cut", quantity: 1 };
  // @ts-expect-error The canonical key quality must match the explicit yield quality.
  const invalidQuality: HarvestYield = { key: "oak:log:rough", resourceId: "oak", form: "log", quality: "choice", quantity: 1 };
  void invalidForm;
  void invalidQuality;
}

void assertCompileTimeHarvestYieldCorrelation;

test("harvest skill ladders are explicit, immutable, and use exact threshold bands", () => {
  assert.deepEqual(MATERIAL_HARVEST_SKILL_BANDS, [
    { minimum: 0, quality: "rough" },
    { minimum: 25, quality: "sound" },
    { minimum: 50, quality: "choice" },
    { minimum: 75, quality: "pristine" },
  ]);
  assert.deepEqual(GEM_HARVEST_SKILL_BANDS, [
    { minimum: 0, quality: "cracked" },
    { minimum: 25, quality: "flawed" },
    { minimum: 50, quality: "cut" },
    { minimum: 75, quality: "flawless" },
    { minimum: 100, quality: "perfect" },
  ]);
  assertDeepFrozen(MATERIAL_HARVEST_SKILL_BANDS);
  assertDeepFrozen(GEM_HARVEST_SKILL_BANDS);
});

test("identification hides family and ceiling below the threshold, then reveals the stable node", () => {
  const unknown = identifyHarvestNode({ ...pristineRedwood, effectiveSkill: 34 });
  assert.deepEqual(unknown, { status: "unknown", message: UNKNOWN_RESOURCE_MESSAGE });
  assert.equal(JSON.stringify(unknown).includes("redwood"), false);
  assert.equal(JSON.stringify(unknown).includes("pristine"), false);

  const identified = identifyHarvestNode({ ...pristineRedwood, effectiveSkill: 35 });
  assert.deepEqual(identified, {
    status: "identified",
    identity: {
      nodeId: "resource-node:v1:1419:188:88:tree",
      resourceId: "redwood",
      qualityCeiling: "pristine",
    },
    label: "Pristine Redwood",
  });
  assertDeepFrozen(unknown);
  assertDeepFrozen(identified);

  const remembered = identifyHarvestNode({ ...pristineRedwood, effectiveSkill: 0, discovered: true });
  assert.equal(remembered.status, "identified");
  if (remembered.status === "identified") assert.deepEqual(remembered.identity, identified.identity);
});

test("extraction threshold is checked before tool tier and rejects with exact identified messages", () => {
  const belowExtraction = assessResourceHarvest({ ...pristineRedwood, effectiveSkill: 49, toolTier: 2 });
  assert.deepEqual(belowExtraction, {
    status: "blocked",
    reason: "skill",
    identity: {
      nodeId: "resource-node:v1:1419:188:88:tree",
      resourceId: "redwood",
      qualityCeiling: "pristine",
    },
    message: "You identify Pristine Redwood, but need 50 Lumberjacking to extract it.",
  });

  const belowTool = assessResourceHarvest({ ...pristineRedwood, effectiveSkill: 50, toolTier: 1 });
  assert.deepEqual(belowTool, {
    status: "blocked",
    reason: "tool",
    identity: belowExtraction.identity,
    message: "You identify Pristine Redwood, but need a tier 2 tool to extract it.",
  });
  assertDeepFrozen(belowExtraction);
  assertDeepFrozen(belowTool);
});

test("recovered grade is capped by both node ceiling and the near-threshold harvester band", () => {
  const atChoice = assessResourceHarvest({ ...pristineRedwood, effectiveSkill: 50, toolTier: 2 });
  assert.equal(atChoice.status, "ready");
  if (atChoice.status !== "ready") return;
  assert.equal(atChoice.yield.quality, "choice");
  assert.equal(atChoice.yield.key, "redwood:log:choice");
  assert.equal(atChoice.yield.quantity, 1);
  assert.equal(atChoice.message, "Recovered a choice redwood log.");

  const justBelowPristine = assessResourceHarvest({ ...pristineRedwood, effectiveSkill: 74, toolTier: 2 });
  assert.equal(justBelowPristine.status, "ready");
  if (justBelowPristine.status !== "ready") return;
  assert.equal(justBelowPristine.yield.quality, "choice");

  const atPristine = assessResourceHarvest({ ...pristineRedwood, effectiveSkill: 75, toolTier: 2 });
  assert.equal(atPristine.status, "ready");
  if (atPristine.status !== "ready") return;
  assert.equal(atPristine.yield.quality, "pristine");

  const soundNode = assessResourceHarvest({ seed: 1, tx: 188, ty: 88, nodeKind: "tree", effectiveSkill: 100, discovered: false, toolTier: 2 });
  assert.equal(soundNode.status, "ready");
  if (soundNode.status !== "ready") return;
  assert.equal(soundNode.identity.resourceId, "redwood");
  assert.equal(soundNode.identity.qualityCeiling, "sound");
  assert.equal(soundNode.yield.quality, "sound", "mastery never exceeds the node-owned ceiling");
});

test("gem clarity uses its five-band ladder and mastery yield is exactly two", () => {
  const nearFlawless = assessResourceHarvest({ ...perfectRuby, effectiveSkill: 74, toolTier: 2 });
  assert.equal(nearFlawless.status, "ready");
  if (nearFlawless.status !== "ready") return;
  assert.equal(nearFlawless.identity.resourceId, "ruby");
  assert.equal(nearFlawless.identity.qualityCeiling, "perfect");
  assert.equal(nearFlawless.yield.quality, "cut");
  assert.equal(nearFlawless.yield.key, "ruby:gem:cut");
  assert.equal(nearFlawless.yield.quantity, 1);
  assert.equal(nearFlawless.message, "Recovered a cut ruby.");

  const mastery = assessResourceHarvest({ ...perfectRuby, effectiveSkill: 100, toolTier: 2 });
  assert.equal(mastery.status, "ready");
  if (mastery.status !== "ready") return;
  assert.equal(mastery.yield.quality, "perfect");
  assert.equal(mastery.yield.quantity, 2);
  assert.equal(mastery.message, "Recovered 2 perfect rubies.");
  assertDeepFrozen(nearFlawless);
  assertDeepFrozen(mastery);
});

test("tool policy is explicit and pure tier gating is independent of catalog literals", () => {
  assert.deepEqual(HARVEST_TOOL_POLICY, {
    tree: { hatchet: 2, knife: 1, sword: 1 },
    rock: { pick: 2 },
  });
  assertDeepFrozen(HARVEST_TOOL_POLICY);
  assert.equal(harvestToolTier({ nodeKind: "tree", tool: "knife" }), 1);
  assert.equal(harvestToolTier({ nodeKind: "tree", tool: "sword" }), 1);
  assert.equal(harvestToolTier({ nodeKind: "tree", tool: "hatchet" }), 2);
  assert.equal(harvestToolTier({ nodeKind: "rock", tool: "pick" }), 2);
  assert.equal(harvestToolTier({ nodeKind: "tree", tool: "pick" }), 0);
  assert.equal(meetsHarvestToolTier({ availableTier: 1, requiredTier: 2 }), false);
  assert.equal(meetsHarvestToolTier({ availableTier: 2, requiredTier: 2 }), true);
});

test("public harvest APIs accept exact null-prototype data and reject unsafe shapes without getters", () => {
  const identifyUnsafe = identifyHarvestNode as (input: unknown) => unknown;
  const assessUnsafe = assessResourceHarvest as (input: unknown) => unknown;
  const toolUnsafe = harvestToolTier as (input: unknown) => unknown;
  const tierUnsafe = meetsHarvestToolTier as (input: unknown) => unknown;
  const cases = [
    { api: identifyUnsafe, valid: { ...pristineRedwood, effectiveSkill: 35 } },
    { api: assessUnsafe, valid: { ...pristineRedwood, effectiveSkill: 50, toolTier: 2 } },
    { api: toolUnsafe, valid: { nodeKind: "tree", tool: "hatchet" } },
    { api: tierUnsafe, valid: { availableTier: 2, requiredTier: 2 } },
  ] as const;

  for (const { api, valid } of cases) {
    const nullPrototype = Object.assign(Object.create(null) as Record<string, unknown>, valid);
    assert.deepEqual(api(nullPrototype), api(valid));
    let getterCalls = 0;
    const accessor = { ...valid } as Record<string, unknown>;
    const firstField = Object.keys(valid)[0]!;
    Object.defineProperty(accessor, firstField, {
      enumerable: true,
      get() {
        getterCalls += 1;
        return valid[firstField as keyof typeof valid];
      },
    });
    const missing = Object.fromEntries(Object.entries(valid).slice(1));
    for (const unsafe of [
      undefined,
      null,
      1,
      "input",
      [],
      Object.create(valid),
      Object.assign(Object.create({ inherited: true }), valid),
      missing,
      { ...valid, unexpected: true },
      { ...valid, [Symbol("unexpected")]: true },
      accessor,
    ]) {
      assert.throws(() => api(unsafe), /harvest input must be a plain object with exactly own data fields/);
    }
    assert.equal(getterCalls, 0);
  }
});
