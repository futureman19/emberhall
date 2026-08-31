import assert from "node:assert/strict";
import test from "node:test";
import {
  RESOURCE_REGROWTH_HOURS,
  createResourceNodeStateMap,
  depleteResourceNode,
  discoverResourceNode,
  hasDiscoveredResourceNode,
  parseResourceNodeStateMap,
  parseResourceNodeStateMapAtHour,
  regrowResourceNodes,
} from "./state.ts";
import { resolveResourceNode } from "./nodes.ts";
import { getWorld, setWorld, snapshot } from "../live.ts";
import { tickWorld } from "../sim.ts";
import { createStubWorld } from "../world.ts";

const tree = { seed: 1_419, tx: 188, ty: 88, nodeKind: "tree" } as const;
const rock = { seed: 532, tx: 470, ty: 420, nodeKind: "rock" } as const;

function nodeId(input: typeof tree | typeof rock): string {
  return resolveResourceNode(input).identity.nodeId;
}

function assertDeepFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  assert.equal(Object.isFrozen(value), true);
  for (const nested of Object.values(value)) assertDeepFrozen(nested);
}

test("resource state - discovery is sparse, canonical, immutable, and idempotently keeps the first hour", () => {
  const empty = createResourceNodeStateMap();
  const once = discoverResourceNode({ ...tree, hour: 12, resourceNodes: empty });
  const twice = discoverResourceNode({ ...tree, hour: 19, resourceNodes: once });
  const id = nodeId(tree);

  assert.deepEqual(Object.keys(once), [id]);
  assert.deepEqual(twice, once);
  assert.deepEqual(once[id], {
    nodeId: id,
    tx: tree.tx,
    ty: tree.ty,
    nodeKind: tree.nodeKind,
    discoveredAtHour: 12,
    depletedAtHour: null,
  });
  assert.equal(hasDiscoveredResourceNode({ ...tree, resourceNodes: twice }), true);
  assert.equal(
    hasDiscoveredResourceNode({ seed: tree.seed, tx: rock.tx, ty: rock.ty, nodeKind: rock.nodeKind, resourceNodes: twice }),
    false,
  );
  assertDeepFrozen(once);
  assertDeepFrozen(twice);
});

test("resource state - depletion preserves discovery and round-trips named finite metadata", () => {
  const discovered = discoverResourceNode({ ...rock, hour: 8, resourceNodes: createResourceNodeStateMap() });
  const depleted = depleteResourceNode({ ...rock, hour: 10.5, resourceNodes: discovered });
  const parsed = parseResourceNodeStateMap({ seed: rock.seed, resourceNodes: JSON.parse(JSON.stringify(depleted)) });
  const id = nodeId(rock);

  assert.deepEqual(parsed[id], {
    nodeId: id,
    tx: rock.tx,
    ty: rock.ty,
    nodeKind: rock.nodeKind,
    discoveredAtHour: 8,
    depletedAtHour: 10.5,
  });
  assertDeepFrozen(parsed);
});

test("resource state - depletion rejects an hour before existing discovery without touching accessors", () => {
  const discovered = discoverResourceNode({ ...tree, hour: 8, resourceNodes: createResourceNodeStateMap() });
  const depleted = depleteResourceNode({ ...tree, hour: 10, resourceNodes: discovered });
  let getterCalls = 0;
  const resourceNodes = new Proxy(depleted, {
    get(target, key, receiver) {
      getterCalls += 1;
      return Reflect.get(target, key, receiver);
    },
  });

  assert.throws(() => depleteResourceNode({ ...tree, hour: 7, resourceNodes }), /before discovery/);
  assert.equal(getterCalls, 0);
  assert.equal(depleted[nodeId(tree)]!.depletedAtHour, 10);
});

test("resource state - at-hour parser rejects future timestamps and returns a detached canonical clone", () => {
  const id = nodeId(tree);
  const valid = {
    [id]: {
      nodeId: id,
      tx: tree.tx,
      ty: tree.ty,
      nodeKind: tree.nodeKind,
      discoveredAtHour: 4,
      depletedAtHour: 7,
    },
  };
  const parsed = parseResourceNodeStateMapAtHour({ seed: tree.seed, hour: 7, resourceNodes: valid });
  assert.deepEqual({ ...parsed }, valid);
  assert.notEqual(parsed, valid);
  assert.notEqual(parsed[id], valid[id]);
  assertDeepFrozen(parsed);

  assert.throws(
    () => parseResourceNodeStateMapAtHour({ seed: tree.seed, hour: 3, resourceNodes: valid }),
    /discovery cannot be in the future/,
  );
  assert.throws(
    () => parseResourceNodeStateMapAtHour({ seed: tree.seed, hour: 6, resourceNodes: valid }),
    /depletion cannot be in the future/,
  );
});

test("resource state - deterministic regrowth waits until the exact kind boundary and is idempotent", () => {
  assert.deepEqual(RESOURCE_REGROWTH_HOURS, { tree: 72, rock: 168 });
  const world = createStubWorld();
  world.seed = tree.seed;
  world.hour = 20;
  world.tiles[tree.ty]![tree.tx]!.kind = "dirt";
  world.scars[`${tree.tx},${tree.ty}`] = { kind: "dirt" };
  world.resourceNodes = depleteResourceNode({ ...tree, hour: 20, resourceNodes: world.resourceNodes });
  const beforeRev = world.landRev;

  world.hour = 20 + RESOURCE_REGROWTH_HOURS.tree - Number.EPSILON * 64;
  assert.equal(regrowResourceNodes(world), 0);
  assert.equal(world.tiles[tree.ty]![tree.tx]!.kind, "dirt");
  assert.notEqual(world.resourceNodes[nodeId(tree)]!.depletedAtHour, null);

  world.hour = 20 + RESOURCE_REGROWTH_HOURS.tree;
  assert.equal(regrowResourceNodes(world), 1);
  assert.equal(world.tiles[tree.ty]![tree.tx]!.kind, "tree");
  assert.equal(Object.hasOwn(world.scars, `${tree.tx},${tree.ty}`), false);
  assert.equal(world.resourceNodes[nodeId(tree)]!.depletedAtHour, null);
  assert.equal(world.resourceNodes[nodeId(tree)]!.discoveredAtHour, 20);
  assert.equal(world.landRev, beforeRev + 1);

  assert.equal(regrowResourceNodes(world), 0);
  assert.equal(world.landRev, beforeRev + 1);
  assert.equal(resolveResourceNode(tree).identity.nodeId, nodeId(tree));
});

test("resource state - rock regrowth uses the exact 168 hour boundary", () => {
  const world = createStubWorld();
  world.seed = rock.seed;
  world.tiles[rock.ty]![rock.tx]!.kind = "dirt";
  world.scars[`${rock.tx},${rock.ty}`] = { kind: "dirt" };
  world.resourceNodes = depleteResourceNode({ ...rock, hour: 4, resourceNodes: world.resourceNodes });

  world.hour = 4 + RESOURCE_REGROWTH_HOURS.rock - 0.001;
  assert.equal(regrowResourceNodes(world), 0);
  assert.equal(world.tiles[rock.ty]![rock.tx]!.kind, "dirt");

  world.hour = 4 + RESOURCE_REGROWTH_HOURS.rock;
  assert.equal(regrowResourceNodes(world), 1);
  assert.equal(world.tiles[rock.ty]![rock.tx]!.kind, "rock");
});

test("resource state - one sparse regrowth batch restores every due owned node and bumps landRev once", () => {
  const world = createStubWorld();
  const second = { seed: tree.seed, tx: 470, ty: 420, nodeKind: "rock" } as const;
  world.seed = tree.seed;
  for (const node of [tree, second] as const) {
    world.tiles[node.ty]![node.tx]!.kind = "dirt";
    world.scars[`${node.tx},${node.ty}`] = { kind: "dirt" };
    world.resourceNodes = depleteResourceNode({ ...node, hour: 0, resourceNodes: world.resourceNodes });
  }
  world.hour = RESOURCE_REGROWTH_HOURS.rock;
  const beforeRev = world.landRev;

  assert.equal(regrowResourceNodes(world), 2);
  assert.equal(world.tiles[tree.ty]![tree.tx]!.kind, "tree");
  assert.equal(world.tiles[second.ty]![second.tx]!.kind, "rock");
  assert.equal(world.landRev, beforeRev + 1);
});

test("resource state - setWorld, snapshot, and advancing time run sparse regrowth", () => {
  const dueOnSet = createStubWorld();
  dueOnSet.seed = tree.seed;
  dueOnSet.hour = RESOURCE_REGROWTH_HOURS.tree;
  dueOnSet.tiles[tree.ty]![tree.tx]!.kind = "dirt";
  dueOnSet.scars[`${tree.tx},${tree.ty}`] = { kind: "dirt" };
  dueOnSet.resourceNodes = depleteResourceNode({ ...tree, hour: 0, resourceNodes: dueOnSet.resourceNodes });
  setWorld(dueOnSet);
  assert.equal(getWorld().tiles[tree.ty]![tree.tx]!.kind, "tree");

  const live = getWorld();
  live.tiles[tree.ty]![tree.tx]!.kind = "dirt";
  live.scars[`${tree.tx},${tree.ty}`] = { kind: "dirt" };
  live.resourceNodes = depleteResourceNode({ ...tree, hour: live.hour, resourceNodes: live.resourceNodes });
  live.hour += RESOURCE_REGROWTH_HOURS.tree;
  snapshot(live);
  assert.equal(live.tiles[tree.ty]![tree.tx]!.kind, "tree");

  live.tiles[tree.ty]![tree.tx]!.kind = "dirt";
  live.scars[`${tree.tx},${tree.ty}`] = { kind: "dirt" };
  live.resourceNodes = depleteResourceNode({ ...tree, hour: live.hour, resourceNodes: live.resourceNodes });
  live.hour += RESOURCE_REGROWTH_HOURS.tree - 0.001;
  live.speed = 1;
  tickWorld(live, 0.1);
  assert.equal(live.tiles[tree.ty]![tree.tx]!.kind, "tree");
});

test("resource state - regrowth only restores its own matching dirt scar", () => {
  for (const changed of [
    { tile: "grass" as const, scar: { kind: "dirt" as const } },
    { tile: "dirt" as const, scar: { kind: "road" as const } },
    { tile: "dirt" as const, scar: undefined },
  ]) {
    const world = createStubWorld();
    world.seed = rock.seed;
    world.hour = RESOURCE_REGROWTH_HOURS.rock;
    world.tiles[rock.ty]![rock.tx]!.kind = changed.tile;
    if (changed.scar) world.scars[`${rock.tx},${rock.ty}`] = changed.scar;
    world.resourceNodes = depleteResourceNode({ ...rock, hour: 0, resourceNodes: world.resourceNodes });
    const before = structuredClone({ state: world.resourceNodes, scars: world.scars, rev: world.landRev });

    assert.equal(regrowResourceNodes(world), 0);
    assert.equal(world.tiles[rock.ty]![rock.tx]!.kind, changed.tile);
    assert.deepEqual({ ...world.resourceNodes }, before.state);
    assert.deepEqual({ ...world.scars }, before.scars);
    assert.equal(world.landRev, before.rev);
    assert.notEqual(
      world.resourceNodes[nodeId(rock)]!.depletedAtHour,
      null,
      "ownership mismatch stays pending for a safe retry",
    );
  }
});

test("resource state - an active farm bed owns depleted dirt across the regrowth boundary", () => {
  const world = createStubWorld();
  world.seed = tree.seed;
  world.tiles[tree.ty]![tree.tx]!.kind = "dirt";
  world.scars[`${tree.tx},${tree.ty}`] = { kind: "dirt" };
  world.resourceNodes = depleteResourceNode({ ...tree, hour: 0, resourceNodes: world.resourceNodes });
  world.plots.push({
    id: "bed-over-depleted-tree",
    tx: tree.tx,
    ty: tree.ty,
    crop: null,
    plantedHour: 0,
    stage: 0,
  });
  world.landRev += 1;
  world.hour = RESOURCE_REGROWTH_HOURS.tree;
  const scarBefore = world.scars[`${tree.tx},${tree.ty}`];

  assert.equal(regrowResourceNodes(world), 0);
  assert.equal(regrowResourceNodes(world), 0);
  assert.equal(world.tiles[tree.ty]![tree.tx]!.kind, "dirt");
  assert.equal(world.scars[`${tree.tx},${tree.ty}`], scarBefore);
  assert.equal(world.resourceNodes[nodeId(tree)]!.depletedAtHour, 0);
  assert.equal(world.plots.some((plot) => plot.tx === tree.tx && plot.ty === tree.ty), true);
});

test("resource state - 10k pre-boundary frame and snapshot checks reuse one sparse schedule", () => {
  const world = createStubWorld();
  world.seed = tree.seed;
  const depleted = depleteResourceNode({ ...tree, hour: 10, resourceNodes: world.resourceNodes });
  let mapOwnKeyReads = 0;
  let mapDescriptorReads = 0;
  let scarOwnKeyReads = 0;
  let scarDescriptorReads = 0;
  const resourceNodes = new Proxy(depleted, {
    ownKeys(target) {
      mapOwnKeyReads += 1;
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(target, key) {
      mapDescriptorReads += 1;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const scars = new Proxy({ [`${tree.tx},${tree.ty}`]: { kind: "dirt" as const } }, {
    ownKeys(target) {
      scarOwnKeyReads += 1;
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(target, key) {
      scarDescriptorReads += 1;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  world.resourceNodes = resourceNodes;
  world.scars = scars;
  world.tiles[tree.ty]![tree.tx]!.kind = "dirt";
  world.hour = 10;

  assert.equal(regrowResourceNodes(world), 0);
  const mapOwnKeyReadsAfterMiss = mapOwnKeyReads;
  const mapDescriptorReadsAfterMiss = mapDescriptorReads;
  for (let index = 0; index < 5_000; index += 1) regrowResourceNodes(world);
  for (let index = 0; index < 5_000; index += 1) snapshot(world);

  assert.equal(world.resourceNodes, resourceNodes);
  assert.equal(world.scars, scars);
  assert.ok(mapOwnKeyReadsAfterMiss > 0);
  assert.ok(mapDescriptorReadsAfterMiss > 0);
  assert.equal(mapOwnKeyReads, mapOwnKeyReadsAfterMiss);
  assert.equal(mapDescriptorReads, mapDescriptorReadsAfterMiss);
  assert.equal(scarOwnKeyReads, 0);
  assert.equal(scarDescriptorReads, 0);
});

test("resource state - parser rejects noncanonical, malformed, inherited, symbol, and accessor state without invoking getters", () => {
  const id = nodeId(tree);
  const validRecord = {
    nodeId: id,
    tx: tree.tx,
    ty: tree.ty,
    nodeKind: tree.nodeKind,
    discoveredAtHour: 1,
    depletedAtHour: null,
  };
  const parseUnsafe = parseResourceNodeStateMap as (input: unknown) => unknown;
  const invalidRecords = [
    { ...validRecord, nodeId: `${id}:rerolled` },
    { ...validRecord, tx: -1 },
    { ...validRecord, tx: tree.tx + 1 },
    { ...validRecord, ty: 512 },
    { ...validRecord, nodeKind: "ore" },
    { ...validRecord, discoveredAtHour: -1 },
    { ...validRecord, discoveredAtHour: Number.NaN },
    { ...validRecord, discoveredAtHour: Number.POSITIVE_INFINITY },
    { ...validRecord, depletedAtHour: 0 },
    { ...validRecord, extra: true },
  ];
  for (const record of invalidRecords) {
    assert.throws(() => parseUnsafe({ seed: tree.seed, resourceNodes: { [id]: record } }), /resource node state/);
  }

  let getterCalls = 0;
  const accessor = { ...validRecord };
  Object.defineProperty(accessor, "tx", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return tree.tx;
    },
  });
  for (const resourceNodes of [
    Object.assign(Object.create({ inherited: true }), { [id]: validRecord }),
    { [id]: Object.assign(Object.create({ inherited: true }), validRecord) },
    { [id]: { ...validRecord, [Symbol("extra")]: true } },
    { [id]: accessor },
  ]) {
    assert.throws(() => parseUnsafe({ seed: tree.seed, resourceNodes }), /resource node state/);
  }
  const mapAccessor = {};
  Object.defineProperty(mapAccessor, id, {
    enumerable: true,
    get() {
      getterCalls += 1;
      return validRecord;
    },
  });
  const inputAccessor = { seed: tree.seed } as Record<string, unknown>;
  Object.defineProperty(inputAccessor, "resourceNodes", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return { [id]: validRecord };
    },
  });
  assert.throws(() => parseUnsafe({ seed: tree.seed, resourceNodes: mapAccessor }), /resource node state/);
  assert.throws(() => parseUnsafe(inputAccessor), /resource node state/);
  assert.equal(getterCalls, 0);
});

test("resource state - parser returns a canonical deep clone detached from writable input", () => {
  const id = nodeId(tree);
  const source = {
    [id]: {
      nodeId: id,
      tx: tree.tx,
      ty: tree.ty,
      nodeKind: tree.nodeKind,
      discoveredAtHour: 3,
      depletedAtHour: null,
    },
  };
  const parsed = parseResourceNodeStateMap({ seed: tree.seed, resourceNodes: source });
  source[id].discoveredAtHour = 99;
  assert.equal(parsed[id]!.discoveredAtHour, 3);
  assert.notEqual(parsed, source);
  assert.notEqual(parsed[id], source[id]);
  assertDeepFrozen(parsed);
});

test("resource state - parser rejects tree and rock ownership of the same world tile", () => {
  const seed = 77;
  const tx = 10;
  const ty = 10;
  const resourceNodes: Record<string, unknown> = {};
  for (const nodeKind of ["tree", "rock"] as const) {
    const id = resolveResourceNode({ seed, tx, ty, nodeKind }).identity.nodeId;
    resourceNodes[id] = {
      nodeId: id,
      tx,
      ty,
      nodeKind,
      discoveredAtHour: 0,
      depletedAtHour: null,
    };
  }

  assert.throws(
    () => parseResourceNodeStateMap({ seed, resourceNodes }),
    /resource node state cannot contain multiple nodes at one tile/,
  );

  const discoveredTree = discoverResourceNode({
    seed,
    tx,
    ty,
    nodeKind: "tree",
    hour: 0,
    resourceNodes: createResourceNodeStateMap(),
  });
  assert.throws(
    () => discoverResourceNode({ seed, tx, ty, nodeKind: "rock", hour: 0, resourceNodes: discoveredTree }),
    /resource node state cannot contain multiple nodes at one tile/,
  );
});
