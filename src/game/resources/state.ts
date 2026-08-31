import { MAP } from "../atlas.ts";
import type { ResourceNodeState, ResourceNodeStateMap, TileKind, World } from "../types.ts";
import { resolveResourceNode, type ResourceNodeKind } from "./nodes.ts";

/** Fixed game-hour boundaries; identity is unchanged when the node returns. */
export const RESOURCE_REGROWTH_HOURS = Object.freeze({
  tree: 72,
  rock: 168,
} as const satisfies Readonly<Record<ResourceNodeKind, number>>);

const MAP_INPUT_FIELDS = ["seed", "resourceNodes"] as const;
const MAP_AT_HOUR_INPUT_FIELDS = ["seed", "hour", "resourceNodes"] as const;
const DISCOVERY_INPUT_FIELDS = ["seed", "tx", "ty", "nodeKind", "hour", "resourceNodes"] as const;
const LOOKUP_INPUT_FIELDS = ["seed", "tx", "ty", "nodeKind", "resourceNodes"] as const;
const STATE_FIELDS = ["nodeId", "tx", "ty", "nodeKind", "discoveredAtHour", "depletedAtHour"] as const;

const ANY_RESOURCE_NODE_SEED = Symbol("any-resource-node-seed");
const CANONICAL_RESOURCE_NODE_MAPS = new WeakMap<object, number | typeof ANY_RESOURCE_NODE_SEED>();

type FieldSnapshot<Fields extends readonly string[]> = Readonly<Record<Fields[number], unknown>>;

function fail(message = "resource node state input must contain exactly own data fields"): never {
  throw new Error(message);
}

function snapshotOwnDataFields<const Fields extends readonly string[]>(input: unknown, fields: Fields): FieldSnapshot<Fields> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return fail();
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return fail();
  const keys = Reflect.ownKeys(input);
  if (keys.length !== fields.length || keys.some((key) => typeof key !== "string" || !fields.includes(key))) return fail();

  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const field of fields) {
    const descriptor = Reflect.getOwnPropertyDescriptor(input, field);
    if (descriptor === undefined || !("value" in descriptor)) return fail();
    snapshot[field] = descriptor.value;
  }
  return Object.freeze(snapshot) as FieldSnapshot<Fields>;
}

function validateSeed(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) fail("resource node state seed must be a safe integer");
}

function validateCoordinate(name: "tx" | "ty", value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value >= MAP) {
    fail(`resource node state ${name} must be a safe integer within map bounds`);
  }
}

function validateKind(value: unknown): asserts value is ResourceNodeKind {
  if (value !== "tree" && value !== "rock") fail("resource node state nodeKind must be tree or rock");
}

function validateHour(name: "hour" | "discoveredAtHour" | "depletedAtHour", value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail(`resource node state ${name} must be finite and nonnegative`);
  }
}

function rememberCanonicalMap(
  resourceNodes: ResourceNodeStateMap,
  seed: number | typeof ANY_RESOURCE_NODE_SEED,
): ResourceNodeStateMap {
  CANONICAL_RESOURCE_NODE_MAPS.set(resourceNodes, seed);
  return resourceNodes;
}

function cloneAndFreezeMap(resourceNodes: ResourceNodeStateMap, seed: number): ResourceNodeStateMap {
  const clone = Object.create(null) as ResourceNodeStateMap;
  for (const [key, value] of Object.entries(resourceNodes)) clone[key] = Object.freeze({ ...value });
  return rememberCanonicalMap(Object.freeze(clone), seed);
}

function parseMapFromSnapshot(
  seed: number,
  input: unknown,
  atHour?: number,
  trustCanonical = false,
): ResourceNodeStateMap {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return fail("resource node state map must be a plain record");
  const knownSeed = CANONICAL_RESOURCE_NODE_MAPS.get(input);
  if (trustCanonical && (knownSeed === seed || knownSeed === ANY_RESOURCE_NODE_SEED)) {
    return input as ResourceNodeStateMap;
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return fail("resource node state map must be a plain record");

  const parsed = Object.create(null) as ResourceNodeStateMap;
  const occupiedTiles = new Set<string>();
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== "string") fail("resource node state map keys must be strings");
    const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
    if (descriptor === undefined || !("value" in descriptor)) fail("resource node state map values must be own data fields");
    const record = snapshotOwnDataFields(descriptor.value, STATE_FIELDS);
    if (typeof record.nodeId !== "string" || record.nodeId !== key) fail("resource node state key must equal nodeId");
    validateCoordinate("tx", record.tx);
    validateCoordinate("ty", record.ty);
    validateKind(record.nodeKind);
    const tileKey = `${record.tx},${record.ty}`;
    if (occupiedTiles.has(tileKey)) fail("resource node state cannot contain multiple nodes at one tile");
    occupiedTiles.add(tileKey);
    validateHour("discoveredAtHour", record.discoveredAtHour);
    if (atHour !== undefined && record.discoveredAtHour > atHour) {
      fail("resource node state discovery cannot be in the future");
    }
    if (record.depletedAtHour !== null) {
      validateHour("depletedAtHour", record.depletedAtHour);
      if (record.depletedAtHour < record.discoveredAtHour) fail("resource node state discovery must not follow depletion");
      if (atHour !== undefined && record.depletedAtHour > atHour) {
        fail("resource node state depletion cannot be in the future");
      }
    }
    const canonical = resolveResourceNode({ seed, tx: record.tx, ty: record.ty, nodeKind: record.nodeKind }).identity.nodeId;
    if (canonical !== key) fail("resource node state nodeId is not canonical for seed and location");
    parsed[key] = Object.freeze({
      nodeId: key,
      tx: record.tx,
      ty: record.ty,
      nodeKind: record.nodeKind,
      discoveredAtHour: record.discoveredAtHour,
      depletedAtHour: record.depletedAtHour,
    });
  }
  return rememberCanonicalMap(Object.freeze(parsed), seed);
}

/** Empty sparse state; no tile receives an entry until it is identified. */
export function createResourceNodeStateMap(): ResourceNodeStateMap {
  return rememberCanonicalMap(
    Object.freeze(Object.create(null) as ResourceNodeStateMap),
    ANY_RESOURCE_NODE_SEED,
  );
}

/** Validate, canonicalize, deeply clone, and freeze persisted node metadata. */
export function parseResourceNodeStateMap(input: { readonly seed: number; readonly resourceNodes: unknown }): ResourceNodeStateMap {
  const snapshot = snapshotOwnDataFields(input, MAP_INPUT_FIELDS);
  validateSeed(snapshot.seed);
  return parseMapFromSnapshot(snapshot.seed, snapshot.resourceNodes);
}

/** Strict persisted/runtime boundary: node events cannot postdate the world. */
export function parseResourceNodeStateMapAtHour(input: {
  readonly seed: number;
  readonly hour: number;
  readonly resourceNodes: unknown;
}): ResourceNodeStateMap {
  const snapshot = snapshotOwnDataFields(input, MAP_AT_HOUR_INPUT_FIELDS);
  validateSeed(snapshot.seed);
  validateHour("hour", snapshot.hour);
  return parseMapFromSnapshot(snapshot.seed, snapshot.resourceNodes, snapshot.hour);
}

function parsedLocation<Fields extends typeof DISCOVERY_INPUT_FIELDS | typeof LOOKUP_INPUT_FIELDS>(
  input: unknown,
  fields: Fields,
): { seed: number; tx: number; ty: number; nodeKind: ResourceNodeKind; resourceNodes: ResourceNodeStateMap; hour?: number } {
  const snapshot = snapshotOwnDataFields(input, fields);
  const values = snapshot as Readonly<Record<string, unknown>>;
  validateSeed(values.seed);
  validateCoordinate("tx", values.tx);
  validateCoordinate("ty", values.ty);
  validateKind(values.nodeKind);
  if (fields === DISCOVERY_INPUT_FIELDS) validateHour("hour", values.hour);
  return {
    seed: values.seed,
    tx: values.tx,
    ty: values.ty,
    nodeKind: values.nodeKind,
    resourceNodes: parseMapFromSnapshot(values.seed, values.resourceNodes, undefined, true),
    ...(fields === DISCOVERY_INPUT_FIELDS ? { hour: values.hour as number } : {}),
  };
}

function nodeIdAt(input: { seed: number; tx: number; ty: number; nodeKind: ResourceNodeKind }): string {
  return resolveResourceNode({
    seed: input.seed,
    tx: input.tx,
    ty: input.ty,
    nodeKind: input.nodeKind,
  }).identity.nodeId;
}

export function hasDiscoveredResourceNode(input: {
  readonly seed: number;
  readonly tx: number;
  readonly ty: number;
  readonly nodeKind: ResourceNodeKind;
  readonly resourceNodes: unknown;
}): boolean {
  const parsed = parsedLocation(input, LOOKUP_INPUT_FIELDS);
  const id = nodeIdAt(parsed);
  return Object.hasOwn(parsed.resourceNodes, id);
}

/** Return a complete replacement map; duplicate discovery preserves its first hour. */
export function discoverResourceNode(input: {
  readonly seed: number;
  readonly tx: number;
  readonly ty: number;
  readonly nodeKind: ResourceNodeKind;
  readonly hour: number;
  readonly resourceNodes: unknown;
}): ResourceNodeStateMap {
  const parsed = parsedLocation(input, DISCOVERY_INPUT_FIELDS);
  const id = nodeIdAt(parsed);
  if (Object.hasOwn(parsed.resourceNodes, id)) return parsed.resourceNodes;
  if (Object.values(parsed.resourceNodes).some((state) => state.tx === parsed.tx && state.ty === parsed.ty)) {
    fail("resource node state cannot contain multiple nodes at one tile");
  }
  const next = Object.create(null) as ResourceNodeStateMap;
  Object.assign(next, parsed.resourceNodes);
  next[id] = {
    nodeId: id,
    tx: parsed.tx,
    ty: parsed.ty,
    nodeKind: parsed.nodeKind,
    discoveredAtHour: parsed.hour!,
    depletedAtHour: null,
  };
  return cloneAndFreezeMap(next, parsed.seed);
}

/** Return an atomic replacement map with discovery and first depletion recorded. */
export function depleteResourceNode(input: {
  readonly seed: number;
  readonly tx: number;
  readonly ty: number;
  readonly nodeKind: ResourceNodeKind;
  readonly hour: number;
  readonly resourceNodes: unknown;
}): ResourceNodeStateMap {
  const parsed = parsedLocation(input, DISCOVERY_INPUT_FIELDS);
  const id = nodeIdAt(parsed);
  const existing = parsed.resourceNodes[id];
  if (existing && parsed.hour! < existing.discoveredAtHour) {
    fail("resource node state depletion cannot occur before discovery");
  }
  const discovered = discoverResourceNode({ ...parsed, hour: parsed.hour!, resourceNodes: parsed.resourceNodes });
  if (discovered[id]!.depletedAtHour !== null) return discovered;
  const next = Object.create(null) as ResourceNodeStateMap;
  Object.assign(next, discovered);
  next[id] = { ...discovered[id]!, depletedAtHour: parsed.hour! };
  return cloneAndFreezeMap(next, parsed.seed);
}

function cloneScars(scars: World["scars"]): World["scars"] {
  if (typeof scars !== "object" || scars === null || Array.isArray(scars)) fail("resource node state requires a plain scars record");
  const prototype = Object.getPrototypeOf(scars);
  if (prototype !== Object.prototype && prototype !== null) fail("resource node state requires a plain scars record");
  const clone = Object.create(null) as World["scars"];
  for (const key of Reflect.ownKeys(scars)) {
    if (typeof key !== "string") fail("resource node state scars cannot contain symbols");
    const descriptor = Reflect.getOwnPropertyDescriptor(scars, key);
    if (descriptor === undefined || !("value" in descriptor)) fail("resource node state scars must use data properties");
    const scar = descriptor.value as { kind?: unknown; h?: unknown };
    if (typeof scar !== "object" || scar === null || Array.isArray(scar)) fail("resource node state scar is malformed");
    const scarPrototype = Object.getPrototypeOf(scar);
    if (scarPrototype !== Object.prototype && scarPrototype !== null) fail("resource node state scar is malformed");
    const scarKeys = Reflect.ownKeys(scar);
    if (scarKeys.some((field) => typeof field !== "string" || (field !== "kind" && field !== "h"))) fail("resource node state scar is malformed");
    const kindDescriptor = Reflect.getOwnPropertyDescriptor(scar, "kind");
    const heightDescriptor = Reflect.getOwnPropertyDescriptor(scar, "h");
    if (!kindDescriptor || !("value" in kindDescriptor) || (heightDescriptor && !("value" in heightDescriptor))) fail("resource node state scar is malformed");
    clone[key] = {
      kind: kindDescriptor.value as TileKind,
      ...(heightDescriptor ? { h: heightDescriptor.value as number } : {}),
    };
  }
  return clone;
}

function ownsDirtScar(scars: World["scars"], key: string): boolean {
  if (typeof scars !== "object" || scars === null || Array.isArray(scars)) fail("resource node state requires a plain scars record");
  const prototype = Object.getPrototypeOf(scars);
  if (prototype !== Object.prototype && prototype !== null) fail("resource node state requires a plain scars record");
  const descriptor = Reflect.getOwnPropertyDescriptor(scars, key);
  if (descriptor === undefined) return false;
  if (!("value" in descriptor)) fail("resource node state scars must use data properties");
  const scar = descriptor.value as { kind?: unknown; h?: unknown };
  if (typeof scar !== "object" || scar === null || Array.isArray(scar)) fail("resource node state scar is malformed");
  const scarPrototype = Object.getPrototypeOf(scar);
  if (scarPrototype !== Object.prototype && scarPrototype !== null) fail("resource node state scar is malformed");
  const scarKeys = Reflect.ownKeys(scar);
  if (scarKeys.some((field) => typeof field !== "string" || (field !== "kind" && field !== "h"))) fail("resource node state scar is malformed");
  const kindDescriptor = Reflect.getOwnPropertyDescriptor(scar, "kind");
  const heightDescriptor = Reflect.getOwnPropertyDescriptor(scar, "h");
  if (!kindDescriptor || !("value" in kindDescriptor) || (heightDescriptor && !("value" in heightDescriptor))) {
    fail("resource node state scar is malformed");
  }
  return kindDescriptor.value === "dirt" && (!heightDescriptor || heightDescriptor.value === undefined);
}

interface RegrowthSchedule {
  resourceNodesRef: ResourceNodeStateMap;
  landRev: number;
  lastHour: number;
  nextDueHour: number;
}

const REGROWTH_SCHEDULES = new WeakMap<World, RegrowthSchedule>();

function isDeepFrozenMapSource(resourceNodes: ResourceNodeStateMap): boolean {
  if (!Object.isFrozen(resourceNodes)) return false;
  for (const key of Reflect.ownKeys(resourceNodes)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(resourceNodes, key);
    if (!descriptor || !("value" in descriptor) || !Object.isFrozen(descriptor.value)) return false;
  }
  return true;
}

/**
 * Normalize due entries by scanning only sparse state. A node owns its dirt
 * only while the tile, exact dirt scar, and farm occupancy still agree. The
 * batch increments landRev once; unchanged worlds take the allocation-free
 * schedule path until the next sparse depletion boundary.
 */
export function regrowResourceNodes(world: World): number {
  validateSeed(world.seed);
  validateHour("hour", world.hour);
  const resourceNodesRef = world.resourceNodes;
  const cached = REGROWTH_SCHEDULES.get(world);
  if (
    cached &&
    cached.resourceNodesRef === resourceNodesRef &&
    cached.landRev === world.landRev &&
    world.hour >= cached.lastHour &&
    world.hour < cached.nextDueHour
  ) {
    cached.lastHour = world.hour;
    return 0;
  }

  const current = parseMapFromSnapshot(world.seed, resourceNodesRef, undefined, true);
  const due: ResourceNodeState[] = [];
  let nextDueHour = Number.POSITIVE_INFINITY;

  for (const state of Object.values(current)) {
    if (state.depletedAtHour === null) continue;
    const dueAt = state.depletedAtHour + RESOURCE_REGROWTH_HOURS[state.nodeKind];
    if (dueAt > world.hour) {
      nextDueHour = Math.min(nextDueHour, dueAt);
      continue;
    }
    if (world.plots.some((plot) => plot.tx === state.tx && plot.ty === state.ty)) continue;
    const tile = world.tiles[state.ty]?.[state.tx];
    const scarKey = `${state.tx},${state.ty}`;
    if (!tile || tile.kind !== "dirt" || !ownsDirtScar(world.scars, scarKey)) continue;
    due.push(state);
  }

  if (due.length === 0) {
    if (isDeepFrozenMapSource(resourceNodesRef)) {
      REGROWTH_SCHEDULES.set(world, {
        resourceNodesRef,
        landRev: world.landRev,
        lastHour: world.hour,
        nextDueHour,
      });
    } else {
      REGROWTH_SCHEDULES.delete(world);
    }
    return 0;
  }

  const scarsAfter = cloneScars(world.scars);
  const next = Object.create(null) as ResourceNodeStateMap;
  Object.assign(next, current);
  for (const state of due) {
    delete scarsAfter[`${state.tx},${state.ty}`];
    next[state.nodeId] = { ...state, depletedAtHour: null };
  }
  const resourceNodesAfter = cloneAndFreezeMap(next, world.seed);

  for (const state of due) world.tiles[state.ty]![state.tx]!.kind = state.nodeKind;
  world.scars = scarsAfter;
  world.resourceNodes = resourceNodesAfter;
  world.landRev += 1;
  REGROWTH_SCHEDULES.set(world, {
    resourceNodesRef: resourceNodesAfter,
    landRev: world.landRev,
    lastHour: world.hour,
    nextDueHour,
  });
  return due.length;
}
