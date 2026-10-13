import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { Matrix4, ShaderLib, Vector3 } from "three";
import { createWorld } from "../../game/world.ts";
import { groundY } from "../../game/height.ts";
import { placedBox } from "../../game/placeables/placement.ts";
import type { World } from "../../game/types.ts";

const load = () => import("./pond-grass.ts");
function fixture(): World {
  const tiles = Array.from({ length: 314 }, () => Array.from({ length: 260 }, () => ({ kind: "grass", h: 1 })));
  return { seed: 17, landRev: 0, tiles, buildings: [], plots: [], herbs: [], saplings: [], campfires: [], piles: [], placedObjects: [] } as unknown as World;
}

test("pond grass roots stay anchored and tip motion is finite, bounded and spatially varied", async () => {
  const { grassDisplacement } = await load();
  for (let t = 0; t < 30; t += 0.17) {
    assert.deepEqual(grassDisplacement(0, t, 248, 308, 0.4), [0, 0]);
    const tip = grassDisplacement(1, t, 248, 308, 0.4);
    assert.ok(tip.every(Number.isFinite));
    assert.ok(Math.hypot(...tip) <= 0.25);
  }
  assert.notDeepEqual(grassDisplacement(1, 2, 248, 308, 0.4), grassDisplacement(1, 2, 251, 309, 2.1));
});

test("placement is deterministic, bounded, ground-conforming and coherent rather than sparse specks", async () => {
  const { buildPondGrassInstances, POND_GRASS_CELLS, POND_GRASS_CAPACITY } = await load();
  const w = fixture();
  const blades = buildPondGrassInstances(w);
  assert.deepEqual(blades, buildPondGrassInstances(w));
  assert.ok(blades.length >= 500 && blades.length <= POND_GRASS_CAPACITY);
  assert.ok(POND_GRASS_CELLS.length <= 24);
  assert.notDeepEqual(blades, buildPondGrassInstances({ ...w, seed: 19 }));
  for (const b of blades) {
    assert.ok(b.height >= 0.3 && b.height <= 0.6);
    assert.equal(b.y, groundY(w, b.x, b.z));
    assert.ok(b.x >= 245 && b.x <= 254 && b.z >= 303 && b.z <= 310);
    assert.ok(!(b.x >= 247 && b.x <= 253.8 && b.z <= 307.8));
  }
});

test("current water, paths, sand, trees and every non-grass corner suppress the entire candidate cell", async () => {
  const { buildPondGrassInstances, POND_GRASS_CELLS } = await load();
  for (const kind of ["water", "road", "dirt", "step", "sand", "tree", "rock", "floor", "pit", "wall"] as const) {
    const w = fixture();
    for (const [x, z] of POND_GRASS_CELLS) w.tiles[z]![x]!.kind = kind;
    assert.equal(buildPondGrassInstances(w).length, 0, kind);
  }
  const w = fixture();
  const [x, z] = POND_GRASS_CELLS[0]!;
  w.tiles[z + 1]![x + 1]!.kind = "water";
  assert.ok(!buildPondGrassInstances(w).some(b => Math.floor(b.x) === x && Math.floor(b.z) === z));
});

test("buildings, plots, herbs, placed objects and other occupied ground stay clear", async () => {
  const { buildPondGrassInstances, POND_GRASS_CELLS } = await load();
  const [tx, ty] = POND_GRASS_CELLS[0]!;
  for (const collection of ["plots", "herbs", "saplings", "campfires", "piles", "buildings", "placedObjects"] as const) {
    const w = fixture();
    (w[collection] as unknown[]).push({ tx, ty, kind: "hut", definitionId: "unknown-retired-object", rotation: 0 });
    assert.ok(!buildPondGrassInstances(w).some(b => Math.floor(b.x) === tx && Math.floor(b.z) === ty), collection);
  }
});

test("rotated known placeables use their canonical footprint and update after an in-place rotation", async () => {
  const { createPondGrass, buildPondGrassInstances } = await load();
  const w = fixture();
  const object = { tx: 249.6, ty: 308.6, definitionId: "wall_straight", rotation: 0 } as World["placedObjects"][number];
  w.placedObjects.push(object);
  const grass = createPondGrass();
  let lastMask = -1, changes = 0;
  for (const rotation of [0, 1, 2, 3] as const) {
    object.rotation = rotation;
    const box = placedBox(object.definitionId, object.tx, object.ty, rotation);
    const blades = buildPondGrassInstances(w);
    assert.ok(!blades.some(b => b.x >= box.x0 - 0.3 && b.x <= box.x1 + 0.3 && b.z >= box.z0 - 0.3 && b.z <= box.z1 + 0.3));
    grass.update(w, 250, 304, 0.25);
    assert.equal(grass.mesh.count, blades.length);
    if (lastMask !== grass.mesh.userData.mask) changes++;
    lastMask = grass.mesh.userData.mask;
  }
  assert.ok(changes > 1, "rotation changes local occupancy without a land revision");
  grass.dispose();
});

test("real seeded pond keeps sand, approach and water clear without changing the world", async () => {
  const { buildPondGrassInstances } = await load();
  for (const seed of [1, 7, 19]) {
    const w = createWorld(seed);
    const before = JSON.stringify(w.tiles.slice(300, 312).map(row => row.slice(244, 256)));
    const blades = buildPondGrassInstances(w);
    assert.ok(blades.length >= 180, `readable patch for seed ${seed}: ${blades.length}`);
    assert.equal(JSON.stringify(w.tiles.slice(300, 312).map(row => row.slice(244, 256))), before);
    for (const b of blades) assert.equal(w.tiles[Math.round(b.z)]![Math.round(b.x)]!.kind, "grass");
  }
});

test("lifecycle invalidates world, tiles, seed, landRev and in-place same-length occupancy changes", async () => {
  const { createPondGrass, POND_GRASS_CELLS } = await load();
  const grass = createPondGrass();
  let w = fixture();
  grass.update(w, 250, 304, 1);
  const initial = grass.mesh.count;
  assert.ok(initial > 0);
  assert.equal(grass.uniforms.uGrassTime.value, 0.05);
  const firstVersion = grass.mesh.instanceMatrix.version;
  grass.update(w, 250, 304, 0);
  assert.equal(grass.mesh.instanceMatrix.version, firstVersion, "no redundant upload");
  const [tx, ty] = POND_GRASS_CELLS[0]!;
  w.plots.push({ tx, ty } as World["plots"][number]);
  grass.update(w, 250, 304, 0.25);
  assert.ok(grass.mesh.count < initial);
  w.plots[0]!.tx = 0;
  grass.update(w, 250, 304, 0.25);
  assert.equal(grass.mesh.count, initial);
  for (const replacement of [() => { w = { ...w }; }, () => { w.tiles = w.tiles.slice(); }, () => { w.seed++; }, () => { w.landRev++; }]) {
    const version = grass.mesh.instanceMatrix.version;
    replacement();
    grass.update(w, 250, 304, 0);
    assert.ok(grass.mesh.instanceMatrix.version > version);
  }
  w.tiles[ty]![tx]!.kind = "water";
  w.landRev++;
  grass.update(w, 250, 304, 0);
  assert.ok(grass.mesh.count < initial);
  const time = grass.uniforms.uGrassTime.value;
  grass.update(w, 400, 400, 1);
  assert.equal(grass.mesh.visible, false);
  assert.equal(grass.uniforms.uGrassTime.value, time);
  let disposed = 0;
  grass.mesh.addEventListener("dispose", () => disposed++);
  grass.mesh.geometry.addEventListener("dispose", () => disposed++);
  grass.material.addEventListener("dispose", () => disposed++);
  grass.dispose();
  grass.dispose();
  assert.equal(disposed, 3, "all resources disposed once");
});

test("shader has anchored smoothstep wind, bent normals, QA metadata and conservative bounds", async () => {
  const { createPondGrass, POND_GRASS_CAPACITY } = await load();
  const grass = createPondGrass();
  grass.update(fixture(), 250, 304, 0);
  assert.equal(grass.mesh.name, "emberhall-pond-grass");
  assert.equal(grass.material.name, "emberhall-pond-grass");
  assert.equal(grass.material.userData.grassWind, grass.uniforms);
  assert.equal(grass.mesh.castShadow, false);
  assert.ok(grass.mesh.count <= POND_GRASS_CAPACITY);
  const hits: unknown[] = [];
  grass.mesh.raycast({} as never, hits as never);
  assert.deepEqual(hits, []);
  const shader = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader, uniforms: {} as Record<string, { value: unknown }> };
  grass.material.onBeforeCompile(shader as never, {} as never);
  assert.match(shader.vertexShader, /pondGrass/);
  assert.match(shader.vertexShader, /smoothstep\(0\.0, 1\.0,/);
  assert.match(shader.vertexShader, /objectNormal\.y -=/);
  assert.match(shader.vertexShader, /uGrassWind/);
  assert.equal(shader.uniforms.uGrassTime, grass.uniforms.uGrassTime);
  const matrix = new Matrix4(), p = new Vector3();
  for (let i = 0; i < grass.mesh.count; i++) {
    grass.mesh.getMatrixAt(i, matrix);
    p.set(0.4, 1, 0.4).applyMatrix4(matrix);
    assert.ok(grass.mesh.boundingSphere!.containsPoint(p));
  }
  grass.dispose();
});

test("terrain mounts the isolated grass component without replacing pond water", () => {
  const terrain = readFileSync(new URL("./terrain.tsx", import.meta.url), "utf8");
  assert.match(terrain, /<PondGrass\s*\/>/);
  assert.match(terrain, /pondWater\.inject\(shader\)/);
});
