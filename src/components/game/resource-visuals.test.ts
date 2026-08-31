import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as THREE from "three";
import { RESOURCE_CATALOG, RESOURCE_IDS } from "../../game/resources/catalog.ts";
import { resolveResourceNode, type ResourceNodeInput, type ResourceNodeResolution } from "../../game/resources/nodes.ts";
import { defineResourceNodeIdentity, type ResourceId } from "../../game/resources/types.ts";
import { BIOME_IDS, type BiomeW } from "../../game/biome.ts";
import {
  RESOURCE_VISUAL_CACHE_CAP,
  RESOURCE_VISUAL_PROFILES,
  TREE_CLIMATE_SHAPE_SCALES,
  TREE_WORLD_SILHOUETTE,
  createResourceVisualCache,
  getVisibleResourceVisual,
  resolveResourceVisual,
  resourceVisualFromResolution,
  treeClimateShapeScale,
  visibleResourceVisualKey,
  type ResourceVisualCache,
  type ResourceRendererVisual,
} from "./resource-visuals.ts";

const HEX = /^#[0-9a-f]{6}$/i;
const SPAWNED_IDS = RESOURCE_IDS.filter((id) => RESOURCE_CATALOG[id].spawn !== undefined);

function assertDeepFrozen(value: unknown, path = "root"): void {
  if (typeof value !== "object" || value === null) return;
  assert.equal(Object.isFrozen(value), true, `${path} is frozen`);
  for (const [key, nested] of Object.entries(value)) assertDeepFrozen(nested, `${path}.${key}`);
}

function findSpawnedInputs(): ReadonlyMap<ResourceId, ResourceNodeInput> {
  const found = new Map<ResourceId, ResourceNodeInput>();
  const locations = [
    { tx: 188, ty: 88, nodeKind: "tree" },
    { tx: 250, ty: 48, nodeKind: "rock" },
    { tx: 470, ty: 420, nodeKind: "rock" },
  ] as const;
  for (let seed = 0; seed < 20_000 && found.size < SPAWNED_IDS.length; seed += 1) {
    for (const location of locations) {
      const input = { seed, ...location } as const;
      const resourceId = resolveResourceNode(input).identity.resourceId;
      if (!found.has(resourceId)) found.set(resourceId, input);
    }
  }
  assert.deepEqual([...found.keys()].filter((id) => SPAWNED_IDS.includes(id)).sort(), [...SPAWNED_IDS].sort());
  return found;
}

const INPUT_BY_RESOURCE = findSpawnedInputs();

function visualFor(resourceId: ResourceId): ResourceRendererVisual {
  const input = INPUT_BY_RESOURCE.get(resourceId);
  assert.ok(input, `found deterministic fixture for ${resourceId}`);
  return resolveResourceVisual(input);
}

function pureWeights(biome: keyof BiomeW): Readonly<BiomeW> {
  return Object.freeze({
    vale: Number(biome === "vale"),
    tundra: Number(biome === "tundra"),
    taiga: Number(biome === "taiga"),
    fen: Number(biome === "fen"),
    jungle: Number(biome === "jungle"),
    desert: Number(biome === "desert"),
  });
}

function syntheticResolution(resourceId: ResourceId, nodeId: string, biomeWeights = pureWeights("vale")): ResourceNodeResolution {
  const definition = RESOURCE_CATALOG[resourceId];
  const identity = definition.qualityType === "clarity"
    ? defineResourceNodeIdentity(nodeId, resourceId as "ruby" | "sapphire", "cracked")
    : defineResourceNodeIdentity(nodeId, resourceId as Exclude<ResourceId, "ruby" | "sapphire">, "rough");
  return Object.freeze({
    nodeKind: definition.spawn!.nodeKind,
    biome: "vale",
    biomeWeights,
    identity,
  }) as ResourceNodeResolution;
}

function channels(hex: string): readonly number[] {
  return [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)];
}

test("same Task 5 node produces deterministic deeply immutable renderer data without catalog aliasing", () => {
  const input = INPUT_BY_RESOURCE.get("redwood")!;
  const first = resolveResourceVisual(input);
  const second = resolveResourceVisual({ ...input });

  assert.deepEqual(second, first);
  assert.notEqual(second, first);
  assert.notEqual(first.palette, RESOURCE_CATALOG[first.resourceId].visual);
  assertDeepFrozen(first);
  assertDeepFrozen(RESOURCE_VISUAL_PROFILES);
  assert.throws(() => {
    (first.palette as { primary: string }).primary = "#ffffff";
  }, TypeError);
});

test("every catalog-spawned definition maps to its catalog node kind and family with bounded finite parameters", () => {
  assert.equal(SPAWNED_IDS.length, 6, "all six of the eight current definitions that have world spawns are covered");
  for (const resourceId of SPAWNED_IDS) {
    const definition = RESOURCE_CATALOG[resourceId];
    const visual = visualFor(resourceId);
    assert.equal(visual.resourceId, resourceId);
    assert.equal(visual.nodeKind, definition.spawn!.nodeKind);
    assert.equal(visual.family, definition.visual.family);
    assert.match(visual.palette.primary, HEX);
    assert.match(visual.palette.secondary, HEX);

    const profile = RESOURCE_VISUAL_PROFILES[visual.family];
    if (visual.shape.kind === "tree") {
      assert.equal(profile.nodeKind, "tree");
      if (profile.nodeKind !== "tree") continue;
      for (const [value, range] of [
        [visual.shape.trunkRadius, profile.trunkRadius],
        [visual.shape.trunkHeight, profile.trunkHeight],
        [visual.shape.crownRadius, profile.crownRadius],
        [visual.shape.crownHeight, profile.crownHeight],
      ] as const) {
        assert.ok(Number.isFinite(value) && value > 0 && value >= range[0] && value <= range[1]);
      }
    } else {
      assert.equal(profile.nodeKind, "rock");
      if (profile.nodeKind !== "rock") continue;
      for (const [value, range] of [
        [visual.shape.width, profile.width],
        [visual.shape.height, profile.height],
        [visual.shape.depth, profile.depth],
      ] as const) {
        assert.ok(Number.isFinite(value) && value > 0 && value >= range[0] && value <= range[1]);
      }
      assert.ok(Math.abs(visual.shape.tiltX) <= profile.maximumTilt);
      assert.ok(Math.abs(visual.shape.tiltZ) <= profile.maximumTilt);
    }
  }
});

test("family profiles guarantee a broad sturdy oak and a taller slimmer conifer silhouette", () => {
  const broadleaf = RESOURCE_VISUAL_PROFILES.broadleaf;
  const conifer = RESOURCE_VISUAL_PROFILES.conifer;
  assert.ok(conifer.trunkHeight[0] > broadleaf.trunkHeight[1]);
  assert.ok(conifer.crownHeight[0] > broadleaf.crownHeight[1]);
  assert.ok(conifer.trunkRadius[1] < broadleaf.trunkRadius[0]);
  assert.ok(conifer.crownRadius[1] < broadleaf.crownRadius[0]);

  const oak = visualFor("oak");
  const redwood = visualFor("redwood");
  assert.equal(oak.family, "broadleaf");
  assert.equal(redwood.family, "conifer");
  assert.equal(oak.shape.kind, "tree");
  assert.equal(redwood.shape.kind, "tree");
  if (oak.shape.kind === "tree" && redwood.shape.kind === "tree") {
    assert.ok(redwood.shape.trunkHeight > oak.shape.trunkHeight);
    assert.ok(redwood.shape.crownHeight > oak.shape.crownHeight);
    assert.ok(redwood.shape.crownRadius < oak.shape.crownRadius);
  }
});

test("family-aware climate composition preserves historical tree envelopes and family distinction", () => {
  const envelopeCaps = {
    vale: {
      broadleaf: { radius: 1.05, height: 1.05, worldCrownRadius: 1.5, worldTop: 5.4 },
      conifer: { radius: 1.05, height: 1.1, worldCrownRadius: 1.45, worldTop: 5.6 },
    },
    tundra: {
      broadleaf: { radius: 1.05, height: 1.05, worldCrownRadius: 1.5, worldTop: 5.4 },
      conifer: { radius: 1.05, height: 1.1, worldCrownRadius: 1.45, worldTop: 5.6 },
    },
    taiga: {
      broadleaf: { radius: 0.58, height: 1.3, worldCrownRadius: 0.83, worldTop: 6.7 },
      conifer: { radius: 0.58, height: 1.52, worldCrownRadius: 0.83, worldTop: 7.9 },
    },
    fen: {
      broadleaf: { radius: 1.05, height: 1.05, worldCrownRadius: 1.5, worldTop: 5.4 },
      conifer: { radius: 1.05, height: 1.1, worldCrownRadius: 1.45, worldTop: 5.6 },
    },
    jungle: {
      broadleaf: { radius: 1.3, height: 1.05, worldCrownRadius: 1.86, worldTop: 4.7 },
      conifer: { radius: 1.28, height: 1.15, worldCrownRadius: 1.83, worldTop: 4.9 },
    },
    desert: {
      broadleaf: { radius: 1.05, height: 1.05, worldCrownRadius: 1.5, worldTop: 5.4 },
      conifer: { radius: 1.05, height: 1.1, worldCrownRadius: 1.45, worldTop: 5.6 },
    },
  } as const;

  const composedMaximum = (family: "broadleaf" | "conifer", biome: (typeof BIOME_IDS)[number]) => {
    const profile = RESOURCE_VISUAL_PROFILES[family];
    const scale = treeClimateShapeScale(family, biome);
    const grow = TREE_WORLD_SILHOUETTE.maximumGrow;
    return {
      radius: Math.max(profile.trunkRadius[1] * scale.radius, profile.crownRadius[1] * scale.crownRadius),
      height: Math.max(profile.trunkHeight[1], profile.crownHeight[1]) * scale.height,
      worldCrownRadius: TREE_WORLD_SILHOUETTE.canopyRadius * grow * profile.crownRadius[1] * scale.crownRadius,
      worldTop: grow * scale.height * (
        TREE_WORLD_SILHOUETTE.trunkHeight * profile.trunkHeight[1]
        + TREE_WORLD_SILHOUETTE.canopyHeight * profile.crownHeight[1] * (profile.crownLift + 0.5)
      ),
    };
  };

  for (const biome of BIOME_IDS) {
    const broadleaf = composedMaximum("broadleaf", biome);
    const conifer = composedMaximum("conifer", biome);
    for (const [family, maximum] of [["broadleaf", broadleaf], ["conifer", conifer]] as const) {
      const cap = envelopeCaps[biome][family];
      assert.ok(maximum.radius <= cap.radius, `${biome} ${family} maximum radius ${maximum.radius} stays within ${cap.radius}`);
      assert.ok(maximum.height <= cap.height, `${biome} ${family} maximum height ${maximum.height} stays within ${cap.height}`);
      assert.ok(
        maximum.worldCrownRadius <= cap.worldCrownRadius,
        `${biome} ${family} world crown radius ${maximum.worldCrownRadius} stays within ${cap.worldCrownRadius}`,
      );
      assert.ok(maximum.worldTop <= cap.worldTop, `${biome} ${family} world top ${maximum.worldTop} stays within ${cap.worldTop}`);
    }
    assert.ok(
      broadleaf.radius >= conifer.radius * 1.02,
      `${biome} broadleaf maximum remains measurably broader than conifer maximum`,
    );
    assert.ok(
      broadleaf.height <= conifer.height * 0.98,
      `${biome} broadleaf maximum remains measurably shorter than conifer maximum`,
    );
  }

  assertDeepFrozen(TREE_CLIMATE_SHAPE_SCALES);
  assertDeepFrozen(TREE_WORLD_SILHOUETTE);
  assert.equal(
    TREE_WORLD_SILHOUETTE.minimumGrow
      + (TREE_WORLD_SILHOUETTE.growVariants - 1) * TREE_WORLD_SILHOUETTE.growStep,
    TREE_WORLD_SILHOUETTE.maximumGrow,
  );
});

test("catalog palettes distinguish ordinary, highland, ruby, and sapphire stone without emissive neon", () => {
  const nodeId = "resource-node:v1:visual-comparison";
  const iron = resourceVisualFromResolution(syntheticResolution("iron_ore", nodeId));
  const highland = resourceVisualFromResolution(syntheticResolution("highland_ore", nodeId));
  const ruby = resourceVisualFromResolution(syntheticResolution("ruby", nodeId));
  const sapphire = resourceVisualFromResolution(syntheticResolution("sapphire", nodeId));

  assert.equal(iron.family, "stone");
  assert.equal(highland.family, "stone");
  assert.equal(ruby.family, "gem");
  assert.equal(sapphire.family, "gem");
  assert.notEqual(iron.palette.primary, highland.palette.primary);
  assert.notEqual(ruby.palette.primary, sapphire.palette.primary);
  assert.notEqual(ruby.palette.secondary, sapphire.palette.secondary);
  assert.equal(iron.shape.kind, "rock");
  assert.equal(highland.shape.kind, "rock");
  if (iron.shape.kind === "rock" && highland.shape.kind === "rock") {
    assert.ok(highland.shape.height > iron.shape.height, "darker catalog stone palette yields a slightly taller silhouette");
    assert.ok(Math.abs(highland.shape.tiltX) > Math.abs(iron.shape.tiltX), "darker catalog stone palette yields a more angular stance");
  }
  for (const visual of [iron, highland, ruby, sapphire]) {
    assert.equal(Object.hasOwn(visual.palette, "emissive"), false);
    assert.ok(Math.max(...channels(visual.palette.primary), ...channels(visual.palette.secondary)) < 210);
  }
});

test("climate weights blend with rather than replace the resource catalog palette", () => {
  const nodeId = "resource-node:v1:climate-comparison";
  const tundraOak = resourceVisualFromResolution(syntheticResolution("oak", nodeId, pureWeights("tundra")));
  const jungleOak = resourceVisualFromResolution(syntheticResolution("oak", nodeId, pureWeights("jungle")));
  const tundraRedwood = resourceVisualFromResolution(syntheticResolution("redwood", nodeId, pureWeights("tundra")));

  assert.notEqual(tundraOak.palette.primary, jungleOak.palette.primary, "climate changes bark blend");
  assert.notEqual(tundraOak.palette.secondary, jungleOak.palette.secondary, "climate changes crown blend");
  assert.notEqual(tundraOak.palette.primary, tundraRedwood.palette.primary, "catalog palette remains visible in one climate");
  assert.notEqual(tundraOak.palette.secondary, tundraRedwood.palette.secondary, "family palette remains visible in one climate");
});

test("production visual selection delegates to the canonical resolver and has no resource-ID roll branches", () => {
  const source = readFileSync(new URL("./resource-visuals.ts", import.meta.url), "utf8");
  assert.match(source, /resourceVisualFromResolution\(resolveResourceNode\(input\)\)/);
  assert.match(source, /RESOURCE_CATALOG\[resolution\.identity\.resourceId\]/);
  assert.doesNotMatch(source, /resourceId\s*===\s*["'](?:oak|redwood|iron_ore|highland_ore|ruby|sapphire)["']/);
});

test("component-local visual cache is bounded, clearable, and preserves immutable hits", () => {
  assert.equal(RESOURCE_VISUAL_CACHE_CAP, 4096);
  const cache = createResourceVisualCache(2);
  const base = INPUT_BY_RESOURCE.get("oak")!;
  const first = cache.get(base);
  assert.equal(cache.get({ ...base }), first);
  cache.get({ ...base, seed: base.seed + 1 });
  cache.get({ ...base, seed: base.seed + 2 });
  assert.equal(cache.size, 2);
  assert.notEqual(cache.get(base), first, "oldest entry was evicted");
  assert.equal(cache.size, 2);
  cache.clear();
  assert.equal(cache.size, 0);
  assert.throws(() => createResourceVisualCache(0), /positive safe integer/);
});

test("visible work-frame lookup uses a numeric coordinate hit without repeated strict cache gets", () => {
  const cache = createResourceVisualCache();
  let strictGets = 0;
  const countedCache: ResourceVisualCache = {
    capacity: cache.capacity,
    get size() {
      return cache.size;
    },
    get(input) {
      strictGets += 1;
      return cache.get(input);
    },
    clear() {
      cache.clear();
    },
  };
  const visible = new Map<number, ResourceRendererVisual>();
  const input = INPUT_BY_RESOURCE.get("oak")!;
  const key = visibleResourceVisualKey(input.tx, input.ty);
  assert.equal(typeof key, "number");

  const first = getVisibleResourceVisual(visible, countedCache, input.seed, input.tx, input.ty, input.nodeKind);
  for (let frame = 0; frame < 10_000; frame += 1) {
    assert.equal(getVisibleResourceVisual(visible, countedCache, input.seed, input.tx, input.ty, input.nodeKind), first);
  }
  assert.equal(strictGets, 1, "10,000 work-frame hits never re-enter strict validation or string-key creation");
  assert.equal(Object.isFrozen(first), true, "the visible lookup retains the prevalidated frozen visual");

  visible.clear();
  assert.equal(getVisibleResourceVisual(visible, countedCache, input.seed, input.tx, input.ty, input.nodeKind), first);
  assert.equal(strictGets, 2, "a genuine absence after a static clear falls back exactly once");
});

test("same origin and land revision still rebuild on seed change with new colors and matrices", () => {
  const source = readFileSync(new URL("./terrain.tsx", import.meta.url), "utf8");
  const seedSnapshot = source.indexOf("const seedChanged = resourceSeed.current !== w.seed;");
  const rebuildPredicate = source.indexOf("const landMoved = seedChanged ||");
  const seedCommit = source.indexOf("resourceSeed.current = w.seed;", rebuildPredicate);
  assert.ok(seedSnapshot >= 0, "seed change is snapshotted");
  assert.ok(rebuildPredicate > seedSnapshot, "seed change participates in the static instance rebuild predicate");
  assert.ok(seedCommit > rebuildPredicate, "seed ref updates only after the rebuild decision");
  assert.match(source, /if \(seedChanged\) resourceVisuals\.clear\(\);/);
  assert.match(source, /if \(landMoved\) visibleResourceVisuals\.current\.clear\(\);/);

  const base = INPUT_BY_RESOURCE.get("oak")!;
  const before = resolveResourceVisual(base);
  let after: ResourceRendererVisual | undefined;
  for (let seed = base.seed + 1; seed < base.seed + 10_000; seed += 1) {
    const candidate = resolveResourceVisual({ ...base, seed });
    if (candidate.palette.primary !== before.palette.primary || candidate.palette.secondary !== before.palette.secondary) {
      after = candidate;
      break;
    }
  }
  assert.ok(after, "found a deterministic replacement seed with a different resource palette at the same tile");
  assert.notDeepEqual(after.palette, before.palette, "seed replacement changes instance colors at unchanged coordinates");
  assert.equal(before.shape.kind, "tree");
  assert.equal(after.shape.kind, "tree");
  if (before.shape.kind === "tree" && after.shape.kind === "tree") {
    const matrixFor = (visual: ResourceRendererVisual) => {
      assert.equal(visual.shape.kind, "tree");
      if (visual.shape.kind !== "tree") throw new Error("expected tree fixture");
      return new THREE.Matrix4().compose(
        new THREE.Vector3(base.tx, visual.shape.trunkHeight * 0.5, base.ty),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), visual.shape.yaw),
        new THREE.Vector3(visual.shape.trunkRadius, visual.shape.trunkHeight, visual.shape.trunkRadius),
      ).toArray();
    };
    assert.notDeepEqual(matrixFor(after), matrixFor(before), "seed replacement changes the instance transform matrix");
  }
});

test("visual cache snapshots exact own data fields before lookup without invoking rejected getters", () => {
  const cache = createResourceVisualCache(2);
  const valid = INPUT_BY_RESOURCE.get("oak")!;
  const expected = cache.get(valid);
  const getUnsafe = cache.get as (input: unknown) => ResourceRendererVisual;

  const nullPrototypeInput = Object.assign(Object.create(null) as Record<string, unknown>, valid);
  assert.equal(getUnsafe(nullPrototypeInput), expected, "exact null-prototype records may hit the cache");

  class CustomInput {
    constructor(values: ResourceNodeInput) {
      Object.assign(this, values);
    }
  }

  const inheritedOnly = Object.create(valid) as Record<string, unknown>;
  const customPrototype = Object.assign(Object.create({ custom: true }) as Record<string, unknown>, valid);
  const classInstance = new CustomInput(valid);
  const unknownStringField = { ...valid, unexpected: true };
  const unknownSymbolField = { ...valid, [Symbol("unexpected")]: true };
  let getterCalls = 0;
  const accessorInput = { ...valid } as Record<string, unknown>;
  Object.defineProperty(accessorInput, "seed", {
    configurable: true,
    enumerable: true,
    get() {
      getterCalls += 1;
      return valid.seed;
    },
  });

  for (const unsafe of [inheritedOnly, customPrototype, classInstance, unknownStringField, unknownSymbolField, accessorInput]) {
    assert.throws(() => getUnsafe(unsafe), /resource visual cache input must be a plain object with exactly own data fields/);
  }
  assert.equal(getterCalls, 0, "rejected cache accessors are never invoked, even when their apparent key is cached");
  assert.equal(cache.size, 1, "rejected lookalikes neither resolve nor populate entries");
});

test("visual cache validates primitive values before cache-key lookup", () => {
  const cache = createResourceVisualCache();
  const getUnsafe = cache.get as (input: unknown) => ResourceRendererVisual;
  const base = INPUT_BY_RESOURCE.get("oak")!;
  cache.get(base);

  for (const seed of [Number.NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => getUnsafe({ ...base, seed }), /seed must be a safe integer/);
  }
  for (const [field, value] of [["tx", -1], ["tx", 512], ["ty", 1.5], ["ty", Infinity]] as const) {
    assert.throws(
      () => getUnsafe({ ...base, [field]: value }),
      new RegExp(`${field} must be a safe integer within map bounds`),
    );
  }
  assert.throws(() => getUnsafe({ ...base, nodeKind: "ore" }), /nodeKind must be tree or rock/);
  assert.equal(cache.size, 1);
});

test("terrain keeps selection assignment ordering, animations, and instanced batch count", () => {
  const source = readFileSync(new URL("./terrain.tsx", import.meta.url), "utf8");
  const ordered = (assignment: string, increment: string) => {
    const assignmentIndex = source.indexOf(assignment);
    assert.ok(assignmentIndex >= 0, `${assignment} remains`);
    const incrementIndex = source.indexOf(increment, assignmentIndex);
    assert.ok(incrementIndex > assignmentIndex, `${assignment} happens before ${increment}`);
  };
  ordered("ghostAt.current[gi] = { tx, ty };", "gi++;");
  ordered("solidAt.current[si] = { tx, ty };", "si++;");
  ordered("rockAt.current[ri] = { tx, ty };", "ri++;");
  assert.equal(source.match(/getVisibleResourceVisual\(/g)?.length, 2, "tree and rock scans use the visible-instance lookup");
  assert.equal(source.match(/resourceVisuals\.get\(/g)?.length ?? 0, 0, "work scan never calls the strict resolver cache directly");
  assert.equal(source.match(/<instancedMesh\b/g)?.length, 10, "Task 6 adds no instanced batches or draw calls");
  assert.match(source, /const wobble = strike \? Math\.sin\(w\.player\.workT \* 28\)/);
  assert.match(source, /Math\.sin\(w\.player\.workT \* 32\)/);
  assert.match(source, /marked \? COL_MARK_WOOD/);
  assert.match(source, /marked\s*\? COL_MARK/);
  const horizon = source.slice(source.indexOf("export function Horizon"));
  assert.doesNotMatch(horizon, /resolveResourceVisual|resourceVisuals\.get/);
});
