import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as THREE from "three";
import { biomeAt, biomeWeights } from "../../game/biome.ts";
import { groundY } from "../../game/height.ts";
import { createWorld } from "../../game/world.ts";
import {
  createHorizonFrameTracker,
  createTerrainCalculationCache,
  sharedBlockGeometry,
  sharedBlockMaterial,
} from "./terrain-performance.ts";

test("terrain calculation cache preserves exact results and invalidates world-derived samples", () => {
  const world = createWorld();
  const cache = createTerrainCalculationCache();
  const x = 251.25;
  const z = 287.75;

  const firstWeights = cache.biomeWeights(x, z);
  assert.deepEqual(firstWeights, biomeWeights(x, z));
  assert.equal(
    cache.biomeWeights(x, z),
    firstWeights,
    "identical deterministic coordinates reuse one result",
  );
  assert.equal(cache.biomeAt(x, z), biomeAt(x, z));

  const firstHeight = cache.groundY(world, x, z);
  assert.equal(firstHeight, groundY(world, x, z));
  assert.equal(cache.groundY(world, x, z), firstHeight);

  const tx = Math.floor(x);
  const ty = Math.floor(z);
  world.tiles[ty]![tx]!.h += 4;
  world.landRev += 1;
  assert.equal(
    cache.groundY(world, x, z),
    groundY(world, x, z),
    "land revision invalidates cached heights",
  );
});

test("terrain blocked-tile cache preserves building and plot occupancy with revision invalidation", () => {
  const world = createWorld();
  const cache = createTerrainCalculationCache();
  const tx = 12;
  const ty = 12;
  assert.equal(cache.blocked(world, tx, ty), false);
  assert.equal(cache.blocked(world, tx, ty), false);

  world.plots.push({ id: "perf-plot", tx, ty, crop: null, plantedHour: 0, stage: 0 });
  world.landRev += 1;
  assert.equal(cache.blocked(world, tx, ty), true);
});

test("horizon frame tracker invalidates on every matrix source and skips only exact repeats", () => {
  const tracker = createHorizonFrameTracker();
  const base = { px: 256, pz: 292, seed: 7, landRev: 1, stockVersion: 1 };
  assert.equal(tracker.changed(base), true);
  assert.equal(tracker.changed({ ...base }), false);
  for (const [field, value] of [
    ["px", 256.01],
    ["pz", 292.01],
    ["seed", 8],
    ["landRev", 2],
    ["stockVersion", 2],
  ] as const) {
    const isolated = createHorizonFrameTracker();
    isolated.changed(base);
    assert.equal(
      isolated.changed({ ...base, [field]: value }),
      true,
      `${field} invalidates matrices`,
    );
  }
});

test("shared block resources reuse only exactly equivalent immutable GPU resources", () => {
  const geometry = sharedBlockGeometry(0.48);
  assert.equal(sharedBlockGeometry(0.48), geometry);
  assert.notEqual(sharedBlockGeometry(0.5), geometry);

  const material = sharedBlockMaterial({
    color: "#6a4a32",
    roughness: 0.9,
    metalness: 0,
    opacity: 1,
    kind: "standard",
  });
  assert.equal(
    sharedBlockMaterial({
      color: "#6a4a32",
      roughness: 0.9,
      metalness: 0,
      opacity: 1,
      kind: "standard",
    }),
    material,
  );
  assert.notEqual(
    sharedBlockMaterial({
      color: "#6a4a32",
      roughness: 0.9,
      metalness: 0,
      opacity: 0.42,
      kind: "standard",
    }),
    material,
  );
  assert.equal(material instanceof THREE.MeshStandardMaterial, true);
});

test("production renderers use guarded horizon uploads, deterministic caches, and shared block resources", () => {
  const terrain = readFileSync(new URL("./terrain.tsx", import.meta.url), "utf8");
  const buildings = readFileSync(new URL("./building-meshes.tsx", import.meta.url), "utf8");

  assert.match(terrain, /createTerrainCalculationCache\(\)/);
  assert.match(terrain, /farFrame\.current\.changed\(/);
  assert.match(terrain, /if \(!farChanged\) return;/);
  assert.match(terrain, /geometry=\{sharedBlockGeometry\(/);
  assert.match(buildings, /geometry=\{sharedBlockGeometry\(/);
  assert.match(buildings, /const material = sharedBlockMaterial\(/);
  assert.match(buildings, /material=\{material\}/);
});
