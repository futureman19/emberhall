import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ShaderLib, LinearFilter, NoColorSpace } from "three";
import type { Tile } from "../../game/types.ts";
import { stampEmberhallPond } from "../../game/emberhall-pond.ts";

// Dynamic import makes the absent implementation an explicit RED assertion.
const water = await import("./pond-water.ts").catch(() => null);
function fixture() {
  const tiles: Tile[][] = [];
  for (let z = 299; z <= 308; z++) {
    tiles[z] = [];
    for (let x = 246; x <= 254; x++) tiles[z]![x] = { kind: "grass", h: 1 } as Tile;
  }
  stampEmberhallPond(tiles);
  return { tiles, landRev: 0, seed: 11 };
}

test("pond water module exists", () => assert.ok(water, "starter pond shader implementation missing"));
test("mask uses only the authored wet footprint, with continuous bilinear shore falloff", () => {
  assert.ok(water);
  const w = fixture();
  const state = water.createPondWater();
  state.update(w, 250, 304, 0);
  assert.ok(state.texture.image.data);
  assert.equal(state.texture.image.data.filter((n: number) => n === 255).length, 19);
  assert.equal(state.sampleMask(250, 304), 1);
  assert.equal(state.sampleMask(247, 304), 0);
  assert.equal(state.sampleMask(100, 100), 0);
  assert.equal(state.sampleMask(248, 302), 0); // bounding-box corner is dry
  const edge = state.sampleMask(248.9, 302);
  assert.ok(edge > 0 && edge < 1);
  w.tiles[304]![247] = { kind: "water", h: 0 } as Tile;
  w.landRev++;
  state.update(w, 250, 304, 0);
  assert.equal(state.sampleMask(247, 304), 0, "new water outside stencil is not animated");
  assert.equal(state.texture.minFilter, LinearFilter);
  assert.equal(state.texture.colorSpace, NoColorSpace);
  assert.equal(state.texture.generateMipmaps, false);
  state.dispose();
});
test("scar edits, raised water, tile replacement and same-seed world replacement invalidate the mask", () => {
  assert.ok(water);
  const w = fixture();
  const state = water.createPondWater();
  state.update(w, 250, 304, 0);
  const version = state.texture.version;
  state.update(w, 250, 304, 0.016);
  assert.equal(state.texture.version, version, "no per-frame texture upload");
  w.tiles[304]![250]!.kind = "dirt";
  w.landRev++;
  state.update(w, 250, 304, 0);
  assert.equal(state.sampleMask(250, 304), 0);
  w.tiles[304]![250]!.kind = "water";
  w.tiles[304]![250]!.h = 2;
  w.landRev++;
  state.update(w, 250, 304, 0);
  assert.equal(state.sampleMask(250, 304), 0);
  const replacement = fixture();
  replacement.landRev = w.landRev;
  state.update(replacement, 250, 304, 0);
  assert.equal(state.sampleMask(250, 304), 1);
  replacement.tiles = fixture().tiles;
  replacement.tiles[304]![250]!.kind = "sand";
  state.update(replacement, 250, 304, 0);
  assert.equal(state.sampleMask(250, 304), 0);
  state.dispose();
});
test("visual clock is capped, independent of simulation, dormant outside vicinity, and disposable", () => {
  assert.ok(water);
  const w = fixture();
  const state = water.createPondWater();
  state.update(w, 250, 304, 0.02);
  const before = state.uniforms.uPondTime.value;
  state.update(w, 250, 304, 999);
  assert.ok(Math.abs(state.uniforms.uPondTime.value - before - 0.05) < 1e-8);
  const time = state.uniforms.uPondTime.value;
  const version = state.texture.version;
  w.landRev++;
  state.update(w, 700, 700, 1);
  assert.equal(state.uniforms.uPondEnabled.value, 0);
  assert.equal(state.uniforms.uPondTime.value, time);
  assert.equal(state.texture.version, version);
  state.update(w, 250, 304, NaN);
  assert.equal(state.uniforms.uPondTime.value, time);
  assert.equal(state.uniforms.uPondEnabled.value, 1);
  let disposed = 0;
  state.texture.addEventListener("dispose", () => disposed++);
  state.dispose();
  assert.equal(disposed, 1);
});
test("ambient ring envelope expands, is bounded and fully expires before recurrence", () => {
  assert.ok(water);
  assert.equal(water.pondRippleEnvelope(-1), 0);
  assert.equal(water.pondRippleEnvelope(0), 0);
  assert.ok(water.pondRippleEnvelope(1) > 0);
  assert.equal(water.pondRippleEnvelope(4.8), 0);
  assert.equal(water.pondRippleEnvelope(100), 0);
  assert.equal(water.pondRippleHeight(5, 1), 0);
  assert.notEqual(water.pondRippleHeight(0.58, 1), water.pondRippleHeight(0.58, 2));
  assert.equal(water.pondRippleHeight(1, 5), 0);
  for (let age = 0; age <= 6; age += 0.1) {
    for (let r = 0; r <= 5; r += 0.1) assert.ok(Math.abs(water.pondRippleHeight(r, age)) <= 0.018);
  }
});
test("shader changes actual normals and roughness on existing ground only, with defined smoothsteps", () => {
  assert.ok(water);
  const shader = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader, uniforms: {} };
  const originalVertex = shader.vertexShader;
  const state = water.createPondWater();
  state.inject(shader);
  assert.equal(shader.vertexShader, originalVertex, "no geometry/picking displacement");
  assert.match(shader.fragmentShader, /normal = normalize/);
  assert.match(shader.fragmentShader, /roughnessFactor = mix/);
  assert.match(shader.fragmentShader, /if \(pondWet > 0\.0\)/);
  assert.match(shader.fragmentShader, /viewMatrix \* vec4/);
  assert.match(shader.fragmentShader, /texture2D\(uPondMask/);
  const steps = [...shader.fragmentShader.matchAll(/smoothstep\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/g)];
  assert.ok(steps.length >= 4);
  for (const m of steps) assert.ok(Number(m[1]) < Number(m[2]), m[0]);
  const terrain = readFileSync(new URL("./terrain.tsx", import.meta.url), "utf8");
  assert.match(terrain, /emberhall-starter-pond-water/);
  assert.match(terrain, /if \(!far\) pondWater\.inject\(shader\)/);
  assert.match(terrain, /pondWater\.dispose\(\)/);
  state.dispose();
});
