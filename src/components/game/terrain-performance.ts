import * as THREE from "three";
import {
  BIOME_IDS,
  biomeWeights as calculateBiomeWeights,
  type BiomeId,
  type BiomeW,
} from "../../game/biome.ts";
import { buildingBox } from "../../game/building-size.ts";
import { groundY as calculateGroundY } from "../../game/height.ts";
import type { World } from "../../game/types.ts";

const CACHE_CAPACITY = 65_536;

function coordinateKey(x: number, z: number) {
  return `${x},${z}`;
}

function putBounded<T>(cache: Map<string, T>, key: string, value: T) {
  if (cache.size >= CACHE_CAPACITY) cache.clear();
  cache.set(key, value);
  return value;
}

export function createTerrainCalculationCache() {
  const weights = new Map<string, BiomeW>();
  const heights = new Map<string, number>();
  const occupancy = new Map<string, boolean>();
  let worldRef: World | null = null;
  let landRev = -1;

  function syncWorld(world: World) {
    const nextRev = world.landRev ?? 0;
    if (worldRef === world && landRev === nextRev) return;
    worldRef = world;
    landRev = nextRev;
    heights.clear();
    occupancy.clear();
  }

  function cachedWeights(x: number, z: number) {
    const key = coordinateKey(x, z);
    const cached = weights.get(key);
    if (cached) return cached;
    return putBounded(weights, key, calculateBiomeWeights(x, z));
  }

  return {
    biomeWeights: cachedWeights,
    biomeAt(x: number, z: number): BiomeId {
      const sample = cachedWeights(x, z);
      let best: BiomeId = BIOME_IDS[0];
      let value = sample[best];
      for (const id of BIOME_IDS.slice(1)) {
        if (sample[id] > value) {
          best = id;
          value = sample[id];
        }
      }
      return best;
    },
    groundY(world: World, x: number, z: number) {
      syncWorld(world);
      const key = coordinateKey(x, z);
      const cached = heights.get(key);
      if (cached !== undefined) return cached;
      return putBounded(heights, key, calculateGroundY(world, x, z));
    },
    blocked(world: World, tx: number, ty: number) {
      syncWorld(world);
      const key = coordinateKey(tx, ty);
      const cached = occupancy.get(key);
      if (cached !== undefined) return cached;
      let value = false;
      if (world.plots) value = world.plots.some((plot) => plot.tx === tx && plot.ty === ty);
      if (!value) {
        value = world.buildings.some((building) => {
          const box = buildingBox(building.kind, building.tx, building.ty);
          return tx + 0.5 > box.x0 && tx + 0.5 < box.x1 && ty + 0.5 > box.z0 && ty + 0.5 < box.z1;
        });
      }
      return putBounded(occupancy, key, value);
    },
  };
}

export type TerrainCalculationCache = ReturnType<typeof createTerrainCalculationCache>;

export interface HorizonFrameState {
  px: number;
  pz: number;
  seed: number;
  landRev: number;
  stockVersion: number;
}

export function createHorizonFrameTracker() {
  let previous: HorizonFrameState | null = null;
  return {
    changed(next: HorizonFrameState) {
      const changed =
        previous === null ||
        previous.px !== next.px ||
        previous.pz !== next.pz ||
        previous.seed !== next.seed ||
        previous.landRev !== next.landRev ||
        previous.stockVersion !== next.stockVersion;
      if (changed) previous = { ...next };
      return changed;
    },
  };
}

const blockGeometries = new Map<string, THREE.BoxGeometry>();

export function sharedBlockGeometry(width: number, height = width, depth = width) {
  const key = `${width}|${height}|${depth}`;
  let geometry = blockGeometries.get(key);
  if (!geometry) {
    geometry = new THREE.BoxGeometry(width, height, depth);
    blockGeometries.set(key, geometry);
  }
  return geometry;
}

export interface SharedBlockMaterialOptions {
  color: string;
  roughness: number;
  metalness: number;
  opacity: number;
  kind: "standard" | "basic";
  emissive?: string;
  emissiveIntensity?: number;
  toneMapped?: boolean;
}

const blockMaterials = new Map<string, THREE.MeshStandardMaterial | THREE.MeshBasicMaterial>();

export function sharedBlockMaterial(options: SharedBlockMaterialOptions) {
  const emissive = options.emissive ?? "#000000";
  const emissiveIntensity = options.emissiveIntensity ?? 1;
  const toneMapped = options.toneMapped ?? true;
  const key = `${options.kind}|${options.color}|${options.roughness}|${options.metalness}|${options.opacity}|${emissive}|${emissiveIntensity}|${toneMapped}`;
  let material = blockMaterials.get(key);
  if (material) return material;
  const transparent = options.opacity < 1;
  material =
    options.kind === "basic"
      ? new THREE.MeshBasicMaterial({
          color: options.color,
          transparent,
          opacity: options.opacity,
          depthWrite: !transparent,
          toneMapped,
        })
      : new THREE.MeshStandardMaterial({
          color: options.color,
          roughness: options.roughness,
          metalness: options.metalness,
          emissive,
          emissiveIntensity,
          transparent,
          opacity: options.opacity,
          depthWrite: !transparent,
          toneMapped,
        });
  blockMaterials.set(key, material);
  return material;
}
