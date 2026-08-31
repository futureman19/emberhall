import { BIOME_IDS, type BiomeW } from "../../game/biome.ts";
import { MAP } from "../../game/atlas.ts";
import { RESOURCE_CATALOG } from "../../game/resources/catalog.ts";
import {
  resolveResourceNode,
  type ResourceNodeInput,
  type ResourceNodeKind,
  type ResourceNodeResolution,
} from "../../game/resources/nodes.ts";
import type { ResourceId, ResourceVisual } from "../../game/resources/types.ts";
import type { BiomeId } from "../../game/types.ts";

export type ResourceRendererFamily = "broadleaf" | "conifer" | "stone" | "gem";

type Range = readonly [minimum: number, maximum: number];

export interface TreeVisualProfile {
  readonly nodeKind: "tree";
  readonly trunkRadius: Range;
  readonly trunkHeight: Range;
  readonly crownRadius: Range;
  readonly crownHeight: Range;
  readonly crownLift: number;
  readonly barkBase: string;
  readonly crownBase: string;
}

export interface RockVisualProfile {
  readonly nodeKind: "rock";
  readonly width: Range;
  readonly height: Range;
  readonly depth: Range;
  readonly paletteHeightInfluence: number;
  readonly maximumTilt: number;
  readonly stoneBase: string;
}

export type ResourceVisualProfile = TreeVisualProfile | RockVisualProfile;

export interface TreeRendererParameters {
  readonly kind: "tree";
  readonly trunkRadius: number;
  readonly trunkHeight: number;
  readonly crownRadius: number;
  readonly crownHeight: number;
  readonly crownLift: number;
  readonly yaw: number;
}

export interface RockRendererParameters {
  readonly kind: "rock";
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly yaw: number;
  readonly tiltX: number;
  readonly tiltZ: number;
}

export interface ResourceRendererPalette {
  readonly primary: string;
  readonly secondary: string;
}

export interface ResourceRendererVisual {
  readonly nodeKind: ResourceNodeKind;
  readonly resourceId: ResourceId;
  readonly family: ResourceRendererFamily;
  readonly palette: ResourceRendererPalette;
  readonly shape: TreeRendererParameters | RockRendererParameters;
}

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value as DeepReadonly<T>;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value) as DeepReadonly<T>;
}

/**
 * Shared geometry profiles. Catalog families choose a profile; node identity
 * only varies values inside these deliberately narrow renderer-safe bounds.
 */
export const RESOURCE_VISUAL_PROFILES = deepFreeze({
  broadleaf: {
    nodeKind: "tree",
    trunkRadius: [0.94, 1.14],
    trunkHeight: [0.92, 1.1],
    crownRadius: [1.04, 1.24],
    crownHeight: [0.88, 1.08],
    crownLift: 0.38,
    barkBase: "#59412d",
    crownBase: "#3d4e2c",
  },
  conifer: {
    nodeKind: "tree",
    trunkRadius: [0.76, 0.9],
    trunkHeight: [1.18, 1.42],
    crownRadius: [0.82, 0.96],
    crownHeight: [1.16, 1.4],
    crownLift: 0.35,
    barkBase: "#633d31",
    crownBase: "#293b2c",
  },
  stone: {
    nodeKind: "rock",
    width: [0.22, 1.7],
    height: [0.14, 1.3],
    depth: [0.2, 1.5],
    paletteHeightInfluence: 0.18,
    maximumTilt: 0.08,
    stoneBase: "#6c6961",
  },
  gem: {
    nodeKind: "rock",
    width: [0.26, 1.5],
    height: [0.18, 1.22],
    depth: [0.24, 1.38],
    paletteHeightInfluence: 0.08,
    maximumTilt: 0.1,
    stoneBase: "#625f5a",
  },
} as const satisfies Record<ResourceRendererFamily, ResourceVisualProfile>);

export const RESOURCE_VISUAL_CACHE_CAP = 4096;

export interface TreeClimateShapeScale {
  readonly radius: number;
  readonly height: number;
  readonly crownRadius: number;
}

/** Shared by Terrain and envelope tests so world-space caps follow production geometry. */
export const TREE_WORLD_SILHOUETTE = deepFreeze({
  minimumGrow: 0.86,
  growStep: 0.038,
  growVariants: 11,
  maximumGrow: 1.24,
  trunkHeight: 2.1,
  canopyHeight: 2.5,
  canopyRadius: 1.15,
});

const BROADLEAF_BASE_CLIMATE_SCALE = { radius: 0.88, height: 0.92, crownRadius: 0.82 } as const;
const CONIFER_BASE_CLIMATE_SCALE = { radius: 1.1, height: 0.75, crownRadius: 1 } as const;

/**
 * Profile composition preserves each climate's pre-Task-6 world envelope.
 * Family differences come from bounded proportions rather than larger trees.
 * Frozen shared records avoid allocations in Terrain's animated scan.
 */
export const TREE_CLIMATE_SHAPE_SCALES = deepFreeze({
  broadleaf: {
    vale: BROADLEAF_BASE_CLIMATE_SCALE,
    tundra: BROADLEAF_BASE_CLIMATE_SCALE,
    taiga: { radius: 0.5, height: 1.15, crownRadius: 0.46 },
    fen: BROADLEAF_BASE_CLIMATE_SCALE,
    jungle: { radius: 1.1, height: 0.8, crownRadius: 1.04 },
    desert: BROADLEAF_BASE_CLIMATE_SCALE,
  },
  conifer: {
    vale: CONIFER_BASE_CLIMATE_SCALE,
    tundra: CONIFER_BASE_CLIMATE_SCALE,
    taiga: { radius: 0.6, height: 1.05, crownRadius: 0.56 },
    fen: CONIFER_BASE_CLIMATE_SCALE,
    jungle: { radius: 1.28, height: 0.65, crownRadius: 1.28 },
    desert: CONIFER_BASE_CLIMATE_SCALE,
  },
} as const satisfies Record<"broadleaf" | "conifer", Record<BiomeId, TreeClimateShapeScale>>);

export function treeClimateShapeScale(
  family: "broadleaf" | "conifer",
  biome: BiomeId,
): TreeClimateShapeScale {
  return TREE_CLIMATE_SHAPE_SCALES[family][biome];
}

const CLIMATE_PALETTE = deepFreeze({
  vale: { bark: "#5a432f", foliage: "#3d4e2c", stone: "#716b61" },
  tundra: { bark: "#5b5148", foliage: "#5a6458", stone: "#7c7f82" },
  taiga: { bark: "#513d31", foliage: "#2f3e2c", stone: "#60676a" },
  fen: { bark: "#4d4030", foliage: "#2c3a26", stone: "#625f58" },
  jungle: { bark: "#4b3828", foliage: "#244028", stone: "#655f55" },
  desert: { bark: "#654c34", foliage: "#666640", stone: "#80715b" },
} as const satisfies Record<BiomeId, { readonly bark: string; readonly foliage: string; readonly stone: string }>);

type Rgb = readonly [red: number, green: number, blue: number];

function parseHex(hex: string): Rgb {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`invalid resource visual color: ${hex}`);
  return [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)];
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((channel) => Math.round(Math.max(0, Math.min(255, channel))).toString(16).padStart(2, "0")).join("")}`;
}

function mix(a: string, b: string, amount: number): string {
  const left = parseHex(a);
  const right = parseHex(b);
  const t = Math.max(0, Math.min(1, amount));
  return toHex([
    left[0] + (right[0] - left[0]) * t,
    left[1] + (right[1] - left[1]) * t,
    left[2] + (right[2] - left[2]) * t,
  ]);
}

function weightedClimate(weights: Readonly<BiomeW>, channel: keyof (typeof CLIMATE_PALETTE)[BiomeId]): string {
  const sum = BIOME_IDS.reduce<[number, number, number]>(
    (rgb, biomeId) => {
      const climate = parseHex(CLIMATE_PALETTE[biomeId][channel]);
      rgb[0] += climate[0] * weights[biomeId];
      rgb[1] += climate[1] * weights[biomeId];
      rgb[2] += climate[2] * weights[biomeId];
      return rgb;
    },
    [0, 0, 0],
  );
  return toHex(sum);
}

/** FNV-1a channels keep visual variation tied to the immutable Task 5 node ID. */
function deterministicUnit(key: string): number {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= BigInt(key.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return Number(hash >> 11n) / 9_007_199_254_740_992;
}

function inRange(range: Range, roll: number): number {
  return range[0] + (range[1] - range[0]) * roll;
}

function clampRange(range: Range, value: number): number {
  return Math.max(range[0], Math.min(range[1], value));
}

function luminance(hex: string): number {
  const [red, green, blue] = parseHex(hex).map((channel) => channel / 255);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function rendererFamily(visual: ResourceVisual): ResourceRendererFamily {
  if (visual.family === "broadleaf" || visual.family === "conifer" || visual.family === "stone" || visual.family === "gem") {
    return visual.family;
  }
  throw new Error(`resource visual family ${visual.family} cannot render as a world node`);
}

function treeParameters(
  resolution: ResourceNodeResolution,
  visual: ResourceVisual,
  family: "broadleaf" | "conifer",
): ResourceRendererVisual {
  const profile = RESOURCE_VISUAL_PROFILES[family];
  const nodeId = resolution.identity.nodeId;
  const climateBark = weightedClimate(resolution.biomeWeights, "bark");
  const climateCrown = weightedClimate(resolution.biomeWeights, "foliage");
  const bark = mix(mix(profile.barkBase, visual.primary, 0.58), climateBark, 0.22);
  const crown = mix(mix(profile.crownBase, visual.secondary, 0.14), climateCrown, 0.3);

  return {
    nodeKind: "tree",
    resourceId: resolution.identity.resourceId,
    family,
    palette: { primary: bark, secondary: crown },
    shape: {
      kind: "tree",
      trunkRadius: inRange(profile.trunkRadius, deterministicUnit(`${nodeId}|trunk-radius`)),
      trunkHeight: inRange(profile.trunkHeight, deterministicUnit(`${nodeId}|trunk-height`)),
      crownRadius: inRange(profile.crownRadius, deterministicUnit(`${nodeId}|crown-radius`)),
      crownHeight: inRange(profile.crownHeight, deterministicUnit(`${nodeId}|crown-height`)),
      crownLift: profile.crownLift,
      yaw: deterministicUnit(`${nodeId}|yaw`) * Math.PI * 2,
    },
  };
}

function rockSize(roll: number): readonly [number, number, number] {
  if (roll < 0.4) {
    const size = roll / 0.4;
    return [0.22 + size * 0.28, 0.14 + size * 0.18, 0.2 + size * 0.26];
  }
  if (roll < 0.82) {
    const size = (roll - 0.4) / 0.42;
    return [0.52 + size * 0.38, 0.34 + size * 0.28, 0.48 + size * 0.32];
  }
  const size = (roll - 0.82) / 0.18;
  return [0.95 + size * 0.75, 0.72 + size * 0.58, 0.88 + size * 0.62];
}

function rockParameters(
  resolution: ResourceNodeResolution,
  visual: ResourceVisual,
  family: "stone" | "gem",
): ResourceRendererVisual {
  const profile = RESOURCE_VISUAL_PROFILES[family];
  const nodeId = resolution.identity.nodeId;
  const [baseWidth, baseHeight, baseDepth] = rockSize(deterministicUnit(`${nodeId}|mass`));
  const darkness = Math.max(-0.08, Math.min(0.16, 0.48 - luminance(visual.primary)));
  const familyScale = family === "gem" ? 0.9 : 1;
  const climateStone = weightedClimate(resolution.biomeWeights, "stone");
  const mineral = mix(visual.primary, visual.secondary, 0.28);
  const mineralAmount = family === "gem" ? 0.42 : 0.58;
  const stone = mix(mix(profile.stoneBase, mineral, mineralAmount), climateStone, family === "gem" ? 0.22 : 0.28);
  const accent = mix(stone, visual.secondary, family === "gem" ? 0.24 : 0.12);
  const angularity = family === "stone" ? Math.min(1, 0.72 + Math.max(0, darkness) * 1.5) : 0.9;
  const tilt = profile.maximumTilt * angularity;

  return {
    nodeKind: "rock",
    resourceId: resolution.identity.resourceId,
    family,
    palette: { primary: stone, secondary: accent },
    shape: {
      kind: "rock",
      width: clampRange(profile.width, baseWidth * familyScale),
      height: clampRange(profile.height, baseHeight * familyScale * (1 + darkness * profile.paletteHeightInfluence)),
      depth: clampRange(profile.depth, baseDepth * familyScale),
      yaw: deterministicUnit(`${nodeId}|yaw`) * Math.PI * 2,
      tiltX: (deterministicUnit(`${nodeId}|tilt-x`) * 2 - 1) * tilt,
      tiltZ: (deterministicUnit(`${nodeId}|tilt-z`) * 2 - 1) * tilt,
    },
  };
}

/** Convert the canonical Task 5 resolution and catalog palette into renderer-only data. */
export function resourceVisualFromResolution(resolution: ResourceNodeResolution): ResourceRendererVisual {
  const definition = RESOURCE_CATALOG[resolution.identity.resourceId];
  const family = rendererFamily(definition.visual);
  if (definition.spawn?.nodeKind !== resolution.nodeKind) {
    throw new Error(`${definition.id} cannot render on a ${resolution.nodeKind} node`);
  }
  const result = family === "broadleaf" || family === "conifer"
    ? treeParameters(resolution, definition.visual, family)
    : rockParameters(resolution, definition.visual, family);
  return deepFreeze(result) as ResourceRendererVisual;
}

/** Resolve once through Task 5; this layer never performs a second family roll. */
export function resolveResourceVisual(input: ResourceNodeInput): ResourceRendererVisual {
  return resourceVisualFromResolution(resolveResourceNode(input));
}

export interface ResourceVisualCache {
  readonly capacity: number;
  readonly size: number;
  get(input: ResourceNodeInput): ResourceRendererVisual;
  clear(): void;
}

export type VisibleResourceVisualLookup = Map<number, ResourceRendererVisual>;

/** Numeric map-coordinate key: one world tile can contain at most one resource node. */
export function visibleResourceVisualKey(tx: number, ty: number): number {
  return ty * MAP + tx;
}

/**
 * Animated work scans hit this prevalidated component-local lookup directly.
 * The strict bounded resolver is a genuine-miss fallback used while rebuilding.
 */
export function getVisibleResourceVisual(
  visible: VisibleResourceVisualLookup,
  cache: ResourceVisualCache,
  seed: number,
  tx: number,
  ty: number,
  nodeKind: ResourceNodeKind,
): ResourceRendererVisual {
  const key = visibleResourceVisualKey(tx, ty);
  const visual = visible.get(key);
  if (visual !== undefined) return visual;
  const resolved = cache.get({ seed, tx, ty, nodeKind });
  visible.set(key, resolved);
  return resolved;
}

const CACHE_INPUT_FIELDS = ["seed", "tx", "ty", "nodeKind"] as const;

/**
 * Cache keys are a public input boundary too. Snapshot exact own data fields
 * before key construction so malformed lookalikes cannot hit a valid entry,
 * and so each accepted value is observed exactly once.
 */
function snapshotCacheInput(input: unknown): ResourceNodeInput {
  const fail = (): never => {
    throw new Error("resource visual cache input must be a plain object with exactly own data fields: seed, tx, ty, nodeKind");
  };
  if (typeof input !== "object" || input === null || Array.isArray(input)) return fail();
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return fail();

  const ownKeys = Reflect.ownKeys(input);
  if (
    ownKeys.length !== CACHE_INPUT_FIELDS.length
    || ownKeys.some((key) => typeof key !== "string" || !(CACHE_INPUT_FIELDS as readonly string[]).includes(key))
  ) {
    return fail();
  }

  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const field of CACHE_INPUT_FIELDS) {
    const descriptor = Reflect.getOwnPropertyDescriptor(input, field);
    if (descriptor === undefined || !("value" in descriptor)) return fail();
    snapshot[field] = descriptor.value;
  }

  if (typeof snapshot.seed !== "number" || !Number.isSafeInteger(snapshot.seed)) throw new Error("seed must be a safe integer");
  for (const field of ["tx", "ty"] as const) {
    const value = snapshot[field];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value >= MAP) {
      throw new Error(`${field} must be a safe integer within map bounds 0..${MAP - 1}`);
    }
  }
  if (snapshot.nodeKind !== "tree" && snapshot.nodeKind !== "rock") throw new Error("nodeKind must be tree or rock");
  return Object.freeze(snapshot) as unknown as ResourceNodeInput;
}

/** Component-local FIFO cache: bounded, seed-addressed, and free of global state. */
export function createResourceVisualCache(capacity = RESOURCE_VISUAL_CACHE_CAP): ResourceVisualCache {
  if (!Number.isSafeInteger(capacity) || capacity <= 0) throw new Error("resource visual cache capacity must be a positive safe integer");
  const entries = new Map<string, ResourceRendererVisual>();
  const keyFor = (input: ResourceNodeInput) => `${input.seed}:${input.tx}:${input.ty}:${input.nodeKind}`;
  return Object.freeze({
    capacity,
    get size() {
      return entries.size;
    },
    get(input: ResourceNodeInput) {
      const snapshot = snapshotCacheInput(input);
      const key = keyFor(snapshot);
      const cached = entries.get(key);
      if (cached) return cached;
      const visual = resolveResourceVisual(snapshot);
      entries.set(key, visual);
      if (entries.size > capacity) entries.delete(entries.keys().next().value!);
      return visual;
    },
    clear() {
      entries.clear();
    },
  });
}
