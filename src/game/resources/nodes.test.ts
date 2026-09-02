import assert from "node:assert/strict";
import test from "node:test";
import { BIOME_IDS, biomeAt } from "../biome.ts";
import { placeAffinity } from "../atlas.ts";
import { RESOURCE_CATALOG, RESOURCE_IDS } from "./catalog.ts";
import {
  GEM_CLARITY_QUALITY_POLICY,
  MATERIAL_GRADE_QUALITY_POLICY,
  RESOURCE_NODE_ORDINARY_FAMILY_FLOOR,
  RESOURCE_NODE_RARE_FAMILY_CAP,
  inspectResourceNodeProbabilities,
  resolveResourceNode,
  type ResourceNodeKind,
} from "./nodes.ts";
import type { ResourceId } from "./types.ts";

function assertDeepFrozen(value: unknown, path = "root"): void {
  if (typeof value !== "object" || value === null) return;
  assert.equal(Object.isFrozen(value), true, `${path} is frozen`);
  for (const [key, nested] of Object.entries(value)) assertDeepFrozen(nested, `${path}.${key}`);
}

function rawWeightAt(tx: number, ty: number, nodeKind: ResourceNodeKind, resourceId: ResourceId): number {
  return inspectResourceNodeProbabilities({ tx, ty, nodeKind }).candidates.find((candidate) => candidate.resourceId === resourceId)?.rawWeight ?? 0;
}

test("node resolution is stable, deeply immutable, and owns a canonical identity", () => {
  const input = { seed: 4_294_967_311, tx: 188, ty: 88, nodeKind: "tree" } as const;
  const first = resolveResourceNode(input);
  const second = resolveResourceNode({ ...input });

  assert.deepEqual(second, first);
  assert.match(first.identity.nodeId, /^resource-node:v1:/);
  assert.ok(first.identity.nodeId.length > 20);
  assert.equal(first.nodeKind, input.nodeKind);
  assert.deepEqual(first.biomeWeights, inspectResourceNodeProbabilities({ tx: input.tx, ty: input.ty, nodeKind: input.nodeKind }).biomeWeights);
  assertDeepFrozen(first);
  assert.throws(() => {
    (first.identity as { nodeId: string }).nodeId = "changed";
  }, TypeError);
});

test("seed, coordinate, and node kind are distinct parts of node identity", () => {
  const base = { seed: 91, tx: 200, ty: 200, nodeKind: "tree" } as const;
  const nodeIds = [
    resolveResourceNode(base).identity.nodeId,
    resolveResourceNode({ ...base, seed: 92 }).identity.nodeId,
    resolveResourceNode({ ...base, tx: 201 }).identity.nodeId,
    resolveResourceNode({ ...base, ty: 201 }).identity.nodeId,
    resolveResourceNode({ ...base, nodeKind: "rock" }).identity.nodeId,
  ];
  assert.equal(new Set(nodeIds).size, nodeIds.length);
});

test("candidate families come only from matching catalog node kinds in canonical order", () => {
  for (const [tx, ty] of [
    [188, 88],
    [250, 48],
    [360, 460],
    [470, 420],
  ] as const) {
    for (const nodeKind of ["tree", "rock"] as const) {
      const inspection = inspectResourceNodeProbabilities({ tx, ty, nodeKind });
      const expected = RESOURCE_IDS.filter((id) => {
        const spawn = RESOURCE_CATALOG[id].spawn;
        if (spawn?.nodeKind !== nodeKind) return false;
        if (spawn.places) {
          return Object.entries(spawn.places).some(([placeId, weight]) => placeAffinity(tx, ty, placeId) * (weight ?? 0) > 0);
        }
        return BIOME_IDS.some((biomeId) => (spawn.regions[biomeId] ?? 0) * inspection.biomeWeights[biomeId] > 0);
      });
      assert.deepEqual(inspection.candidates.map(({ resourceId }) => resourceId), expected);
      for (const candidate of inspection.candidates) assert.equal(RESOURCE_CATALOG[candidate.resourceId].spawn?.nodeKind, nodeKind);
    }
  }
});

test("family probabilities are finite, normalized, affinity-weighted, and policy bounded", () => {
  for (const [tx, ty] of [
    [256, 292],
    [188, 88],
    [250, 48],
    [400, 168],
    [360, 460],
    [470, 420],
  ] as const) {
    for (const nodeKind of ["tree", "rock"] as const) {
      const inspection = inspectResourceNodeProbabilities({ tx, ty, nodeKind });
      assertDeepFrozen(inspection);
      assert.ok(inspection.candidates.length > 0);
      const total = inspection.candidates.reduce((sum, candidate) => sum + candidate.probability, 0);
      const rare = inspection.candidates.filter((candidate) => !candidate.ordinary).reduce((sum, candidate) => sum + candidate.probability, 0);
      const ordinary = inspection.candidates.filter((candidate) => candidate.ordinary).reduce((sum, candidate) => sum + candidate.probability, 0);
      assert.ok(Math.abs(total - 1) < 1e-12, `${tx},${ty} ${nodeKind} normalized`);
      assert.ok(rare <= RESOURCE_NODE_RARE_FAMILY_CAP + 1e-12, `${tx},${ty} ${nodeKind} rare cap`);
      assert.ok(ordinary >= RESOURCE_NODE_ORDINARY_FAMILY_FLOOR - 1e-12, `${tx},${ty} ${nodeKind} ordinary floor`);
      for (const candidate of inspection.candidates) {
        assert.ok(Number.isFinite(candidate.affinity) && candidate.affinity > 0);
        assert.ok(Number.isFinite(candidate.rawWeight) && candidate.rawWeight > 0);
        assert.ok(Number.isFinite(candidate.probability) && candidate.probability >= 0);
        assert.equal(candidate.rawWeight, RESOURCE_CATALOG[candidate.resourceId].spawn!.weight * candidate.affinity);
      }

      const rawTotal = inspection.candidates.reduce((sum, candidate) => sum + candidate.rawWeight, 0);
      const rawRareShare = inspection.candidates.filter((candidate) => !candidate.ordinary).reduce((sum, candidate) => sum + candidate.rawWeight, 0) / rawTotal;
      if (rawRareShare <= RESOURCE_NODE_RARE_FAMILY_CAP) assert.ok(Math.abs(rawRareShare - rare) < 1e-12, "rare share is not inflated");
    }
  }
});

test("soft biome affinities make catalog preferences observable and omit zero affinity", () => {
  assert.ok(rawWeightAt(188, 88, "tree", "pine") > rawWeightAt(256, 292, "tree", "pine"));
  assert.equal(rawWeightAt(256, 292, "tree", "redwood"), 0);
  assert.equal(rawWeightAt(256, 292, "tree", "pine"), 0);
  assert.ok(rawWeightAt(470, 420, "rock", "ruby") > rawWeightAt(250, 48, "rock", "ruby"));
  assert.ok(rawWeightAt(360, 460, "rock", "ruby") > 0);
  assert.ok(rawWeightAt(250, 48, "rock", "sapphire") > rawWeightAt(470, 420, "rock", "sapphire"));
  assert.ok(rawWeightAt(188, 88, "rock", "sapphire") > 0);
  assert.ok(rawWeightAt(250, 48, "rock", "highland_ore") > rawWeightAt(256, 292, "rock", "highland_ore"));
});

test("bounded deterministic grid frequencies track inspected probabilities", () => {
  const actual = new Map<ResourceId, number>();
  const expected = new Map<ResourceId, number>();
  let samples = 0;
  let rareCount = 0;

  for (let ty = 4; ty < 512; ty += 8) {
    for (let tx = 4; tx < 512; tx += 8) {
      for (const nodeKind of ["tree", "rock"] as const) {
        const inspection = inspectResourceNodeProbabilities({ tx, ty, nodeKind });
        for (const candidate of inspection.candidates) expected.set(candidate.resourceId, (expected.get(candidate.resourceId) ?? 0) + candidate.probability);
        const resourceId = resolveResourceNode({ seed: 8_675_309, tx, ty, nodeKind }).identity.resourceId;
        actual.set(resourceId, (actual.get(resourceId) ?? 0) + 1);
        if (!inspection.candidates.find((candidate) => candidate.resourceId === resourceId)!.ordinary) rareCount += 1;
        samples += 1;
      }
    }
  }

  for (const resourceId of RESOURCE_IDS) {
    const expectedShare = (expected.get(resourceId) ?? 0) / samples;
    const actualShare = (actual.get(resourceId) ?? 0) / samples;
    assert.ok(Math.abs(actualShare - expectedShare) < 0.015, `${resourceId}: actual ${actualShare}, expected ${expectedShare}`);
  }
  assert.ok(rareCount / samples <= RESOURCE_NODE_RARE_FAMILY_CAP + 0.015);
});

test("quality uses immutable explicit ladders and every ceiling is deterministically reachable", () => {
  assert.deepEqual(MATERIAL_GRADE_QUALITY_POLICY.map(({ quality }) => quality), ["rough", "sound", "choice", "pristine"]);
  assert.deepEqual(GEM_CLARITY_QUALITY_POLICY.map(({ quality }) => quality), ["cracked", "flawed", "cut", "flawless", "perfect"]);
  assertDeepFrozen(MATERIAL_GRADE_QUALITY_POLICY);
  assertDeepFrozen(GEM_CLARITY_QUALITY_POLICY);
  for (const policy of [MATERIAL_GRADE_QUALITY_POLICY, GEM_CLARITY_QUALITY_POLICY]) {
    assert.ok(Math.abs(policy.reduce((sum, entry) => sum + entry.probability, 0) - 1) < 1e-12);
    assert.equal(policy.at(-1)?.upperThreshold, 1);
    for (const entry of policy) assert.ok(entry.probability > 0 && entry.probability < 1);
  }
  assert.ok(MATERIAL_GRADE_QUALITY_POLICY.at(-1)!.probability <= 0.03);
  assert.ok(GEM_CLARITY_QUALITY_POLICY.at(-1)!.probability <= 0.02);

  const gradeSeen = new Set<string>();
  const claritySeen = new Set<string>();
  let gradeTop = 0;
  let gradeTotal = 0;
  let clarityTop = 0;
  let clarityTotal = 0;
  for (let seed = 0; seed < 50_000; seed += 1) {
    const tree = resolveResourceNode({ seed, tx: 188, ty: 88, nodeKind: "tree" }).identity;
    gradeSeen.add(tree.qualityCeiling);
    gradeTop += Number(tree.qualityCeiling === "pristine");
    gradeTotal += 1;

    const rock = resolveResourceNode({ seed, tx: seed % 2 === 0 ? 470 : 250, ty: seed % 2 === 0 ? 420 : 48, nodeKind: "rock" }).identity;
    if (RESOURCE_CATALOG[rock.resourceId].qualityType === "clarity") {
      claritySeen.add(rock.qualityCeiling);
      clarityTop += Number(rock.qualityCeiling === "perfect");
      clarityTotal += 1;
    }
  }
  assert.deepEqual([...gradeSeen].sort(), ["choice", "pristine", "rough", "sound"]);
  assert.deepEqual([...claritySeen].sort(), ["cracked", "cut", "flawed", "flawless", "perfect"]);
  assert.ok(gradeTop > 0 && gradeTop / gradeTotal < 0.04);
  assert.ok(clarityTop > 0 && clarityTop / clarityTotal < 0.04);
});

test("quality and family are unaffected by call order or unrelated random calls", () => {
  const input = { seed: -9_007_199_254_740_000, tx: 470, ty: 420, nodeKind: "rock" } as const;
  const expected = resolveResourceNode(input);
  for (let index = 0; index < 100; index += 1) {
    Math.random();
    resolveResourceNode({ seed: index, tx: index % 512, ty: (index * 7) % 512, nodeKind: index % 2 ? "tree" : "rock" });
  }
  assert.deepEqual(resolveResourceNode(structuredClone(input)), expected);
});

test("public node APIs reject malformed inputs with deterministic domain errors", () => {
  const resolveUnsafe = resolveResourceNode as (input: unknown) => unknown;
  const inspectUnsafe = inspectResourceNodeProbabilities as (input: unknown) => unknown;
  for (const seed of [Number.NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => resolveUnsafe({ seed, tx: 1, ty: 1, nodeKind: "tree" }), /seed must be a safe integer/);
  }
  for (const [field, value] of [["tx", -1], ["tx", 512], ["tx", 1.5], ["ty", -1], ["ty", 512], ["ty", Infinity]] as const) {
    assert.throws(() => resolveUnsafe({ seed: 1, tx: field === "tx" ? value : 1, ty: field === "ty" ? value : 1, nodeKind: "tree" }), new RegExp(`${field} must be a safe integer within map bounds`));
    assert.throws(() => inspectUnsafe({ tx: field === "tx" ? value : 1, ty: field === "ty" ? value : 1, nodeKind: "tree" }), new RegExp(`${field} must be a safe integer within map bounds`));
  }
  for (const nodeKind of ["Tree", "ore", "", null, undefined]) {
    assert.throws(() => resolveUnsafe({ seed: 1, tx: 1, ty: 1, nodeKind }), /nodeKind must be tree or rock/);
    assert.throws(() => inspectUnsafe({ tx: 1, ty: 1, nodeKind }), /nodeKind must be tree or rock/);
  }
  assert.throws(() => resolveUnsafe(null), /resource node input must be a plain object with exactly own data fields/);
  assert.throws(() => inspectUnsafe(null), /resource node input must be a plain object with exactly own data fields/);
});

test("public node APIs accept exact null-prototype data records and reject unsafe record shapes", () => {
  const resolveUnsafe = resolveResourceNode as (input: unknown) => unknown;
  const inspectUnsafe = inspectResourceNodeProbabilities as (input: unknown) => unknown;
  const cases = [
    {
      api: resolveUnsafe,
      valid: { seed: 73, tx: 188, ty: 88, nodeKind: "tree" },
    },
    {
      api: inspectUnsafe,
      valid: { tx: 188, ty: 88, nodeKind: "tree" },
    },
  ] as const;

  class CustomInput {
    constructor(values: Record<string, unknown>) {
      Object.assign(this, values);
    }
  }

  for (const { api, valid } of cases) {
    const nullPrototypeInput = Object.assign(Object.create(null) as Record<string, unknown>, valid);
    assert.deepEqual(api(nullPrototypeInput), api(valid));

    const inheritedOnly = Object.create(valid) as Record<string, unknown>;
    const customPrototype = Object.assign(Object.create({ custom: true }) as Record<string, unknown>, valid);
    const classInstance = new CustomInput(valid);
    const unknownStringField = { ...valid, unexpected: true };
    const unknownSymbolField = { ...valid, [Symbol("unexpected")]: true };
    const arrayInput = Object.assign([], valid);
    let getterCalls = 0;
    const accessorInput = { ...valid } as Record<string, unknown>;
    Object.defineProperty(accessorInput, "tx", {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        return valid.tx;
      },
    });

    for (const unsafe of [inheritedOnly, customPrototype, classInstance, unknownStringField, unknownSymbolField, arrayInput, accessorInput]) {
      assert.throws(() => api(unsafe), /resource node input must be a plain object with exactly own data fields/);
    }
    assert.equal(getterCalls, 0, "accessor is rejected without invocation");
  }
});

test("wild woods keep to named groves; oak is everywhere; the hall is oak", () => {
  const hallTx = 256;
  const hallTy = 292;
  assert.ok(rawWeightAt(hallTx, hallTy, "tree", "oak") > 0);
  assert.equal(rawWeightAt(hallTx, hallTy, "tree", "willow"), 0);
  assert.equal(rawWeightAt(hallTx, hallTy, "tree", "birch"), 0);
  assert.equal(rawWeightAt(hallTx, hallTy, "tree", "ash"), 0);
  assert.equal(rawWeightAt(hallTx, hallTy, "tree", "yew"), 0);
  assert.equal(rawWeightAt(hallTx, hallTy, "tree", "ghostwood"), 0);

  assert.ok(rawWeightAt(248, 148, "tree", "oak") > 0);
  assert.ok(rawWeightAt(188, 88, "tree", "pine") > rawWeightAt(hallTx, hallTy, "tree", "pine"));
  assert.ok(rawWeightAt(400, 168, "tree", "willow") > 0);
  assert.ok(rawWeightAt(250, 48, "tree", "birch") > 0);
  assert.ok(rawWeightAt(64, 96, "tree", "ash") > 0);
  assert.ok(rawWeightAt(360, 460, "tree", "redwood") > 0);
  assert.ok(rawWeightAt(110, 440, "tree", "yew") > 0);
  assert.ok(rawWeightAt(110, 440, "tree", "ghostwood") > 0);
  assert.equal(rawWeightAt(256, 292, "tree", "ghostwood"), 0);
});

test("biome ordering export preserves representative biomeAt behavior", () => {
  assert.deepEqual(BIOME_IDS, ["vale", "tundra", "taiga", "fen", "jungle", "desert"]);
  assertDeepFrozen(BIOME_IDS);
  assert.deepEqual(
    [
      [256, 292],
      [250, 48],
      [188, 88],
      [400, 168],
      [360, 460],
      [470, 420],
    ].map(([tx, ty]) => biomeAt(tx!, ty!)),
    ["vale", "tundra", "taiga", "fen", "jungle", "desert"],
  );
});
