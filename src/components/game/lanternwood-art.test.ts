import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { groundClump, LANTERNWOOD_GROUND_GLSL } from "./lanternwood-ground.ts";
import { COURT, PLACES } from "../../game/atlas.ts";
import { LANTERNWOOD, LANTERNWOOD_BLOCKS, artNoise, buildingDressing, fireflyPosition, gardenDressing, gardenSites, lanternwoodGround, lanternwoodInfluence, noArtRaycast } from "./lanternwood-art.ts";

test("ground dressing stays sparse, low, deterministic and excludes distant towns", () => {
  let clumps = 0;
  for (let z = COURT.ty - 21; z <= COURT.ty + 21; z++) for (let x = COURT.tx - 21; x <= COURT.tx + 21; x++) {
    const parts = groundClump(x, z);
    assert.deepEqual(parts, groundClump(x, z));
    if (parts.length) clumps++;
    assert.ok(parts.length <= 6);
    assert.ok(parts.every(p => !p.glow && !p.roof && p.position[1] + p.scale[1] < 0.4));
  }
  assert.ok(clumps > 0 && clumps < 450);
  for (const place of PLACES.filter(p => p.id !== "emberhall")) assert.deepEqual(groundClump(place.tx, place.ty), []);
});
test("ground shader uses bounded world-space masks and no geometry displacement", () => {
  assert.ok(LANTERNWOOD_GROUND_GLSL.includes(`vec2(${COURT.tx.toFixed(1)}, ${COURT.ty.toFixed(1)})`));
  assert.ok(LANTERNWOOD_GROUND_GLSL.includes("fwidth(edge)"));
  assert.ok(LANTERNWOOD_GROUND_GLSL.includes("stoneMask * lwArea"));
  for (const word of ["gl_Position", "transformed", "discard", "uOrigin"]) assert.ok(!LANTERNWOOD_GROUND_GLSL.includes(word));
});

test("preview is centred on the real starting town and excludes every other settlement", () => {
  assert.equal(lanternwoodInfluence(COURT.tx, COURT.ty), 1);
  assert.equal(lanternwoodInfluence(COURT.tx + LANTERNWOOD.inner, COURT.ty), 1);
  assert.equal(lanternwoodInfluence(COURT.tx + LANTERNWOOD.outer, COURT.ty), 0);
  assert.equal(lanternwoodInfluence(NaN, 0), 0);
  for (const p of PLACES.filter(p => p.id !== "emberhall")) assert.equal(lanternwoodInfluence(p.tx, p.ty), 0, p.id);
});
test("world-coordinate feather is continuous, radial and monotonic", () => {
  let last = 1;
  for (let d = 0; d <= 40; d += 0.125) {
    const a = lanternwoodInfluence(COURT.tx + d, COURT.ty);
    const b = lanternwoodInfluence(COURT.tx, COURT.ty - d);
    assert.equal(a, b);
    assert.ok(a <= last && a >= 0 && a <= 1);
    assert.ok(last - a < 0.012);
    last = a;
  }
});
test("red cloth and gold identity, water and dangerous terrain retain their palette", () => {
  assert.equal(LANTERNWOOD_BLOCKS.wool, undefined);
  assert.equal(LANTERNWOOD_BLOCKS.gold, undefined);
  for (const kind of ["water", "pit", "wall", "snow", "rock"]) assert.equal(lanternwoodGround(kind), null);
});
test("dressing is repeatable, bounded, independently allocated and never consumes global RNG", () => {
  const random = Math.random;
  Math.random = () => { throw new Error("art must not consume gameplay randomness"); };
  try {
    const a = gardenSites();
    assert.ok(a.length > 5 && a.length < 40);
    assert.deepEqual(a, gardenSites());
    assert.ok(a.every(s => Math.abs(s.x - COURT.tx) >= 10 && lanternwoodInfluence(s.x, s.z) > 0));
    for (const kind of ["hall", "bank"] as const) {
      const parts = buildingDressing(kind);
      assert.deepEqual(parts, buildingDressing(kind));
      assert.ok(parts.some(p => p.glow) && parts.some(p => p.roof));
      parts[0]!.position[0] = 999;
      assert.notEqual(buildingDressing(kind)[0]!.position[0], 999);
    }
    assert.deepEqual(buildingDressing("keep"), []);
    for (let v = 0; v < 3; v++) assert.deepEqual(gardenDressing(v), gardenDressing(v));
    for (let i = 0; i < 28; i++) {
      assert.deepEqual(fireflyPosition(i, 10), fireflyPosition(i, 10));
      const [x, y, z] = fireflyPosition(i, 10);
      assert.ok(lanternwoodInfluence(x, z) > 0 && y > 0 && y < 3);
      assert.ok(artNoise(i, 7) >= 0 && artNoise(i, 7) < 1);
    }
  } finally { Math.random = random; }
});
test("handcrafted hall keeps brown shingles, twin battlements and readable heraldry", () => {
  const parts = buildingDressing("hall");
  assert.ok(parts.length < 350, "bounded instanced ornament count");
  assert.equal(parts.filter(p => p.color === "#ccc1a0").length, 8, "four battlements per tower");
  assert.equal(parts.filter(p => p.color === "#923f35").length, 2, "two tower banners");
  assert.ok(parts.filter(p => p.scale[1] === 0.08 && p.scale[2] === 0.5).length > 100, "individual roof shingles");
  assert.ok(parts.every(p => p.position.every(Number.isFinite) && p.scale.every(v => Number.isFinite(v) && v > 0)));
  assert.ok(!parts.some(p => p.color === "#426b62"), "no jade pavilion roof");
});

test("roof skins sit on voxel courses and bank ridge tapers with its support", () => {
  for (const kind of ["hall", "bank"] as const) {
    const skins = buildingDressing(kind).filter(p => p.color === "#76533b" && p.scale[1] === 0.12);
    assert.equal(skins.length, kind === "hall" ? 5 : 3);
    for (const [i, skin] of skins.entries()) {
      const voxelTop = (kind === "hall" ? 3 : 2.5) + i * 0.5;
      assert.ok(skin.position[1] - skin.scale[1] / 2 <= voxelTop);
      assert.ok(skin.position[1] + skin.scale[1] / 2 > voxelTop);
      assert.equal(skin.scale[0], kind === "hall" ? 4.56 : 4.56 - i);
    }
  }
});

test("decorations cannot be raycast targets and renderers keep gameplay seams unchanged", () => {
  assert.equal(noArtRaycast(), undefined);
  const renderer = readFileSync(new URL("./lanternwood-dressing.tsx", import.meta.url), "utf8");
  assert.equal((renderer.match(/raycast=\{noArtRaycast\}/g) ?? []).length, 2);
  assert.ok(renderer.includes('tile.kind !== "grass"'));
  assert.ok(renderer.includes("world.plots?.some"));
  assert.ok(renderer.includes("buildingBox(b.kind, b.tx, b.ty)"));
  assert.ok(renderer.includes("!inside || !p.roof"));
  for (const forbidden of ["world.buildings.push", "world.tiles[site", "Math.random", "pointLight", "onPointerDown"]) assert.ok(!renderer.includes(forbidden), forbidden);
  const terrain = readFileSync(new URL("./terrain.tsx", import.meta.url), "utf8");
  assert.ok(terrain.includes('woodId === "ghostwood" && !w.player.ghost'));
  assert.ok(terrain.includes("local > 0 && !under && softCanopy.current"));
  assert.ok(terrain.includes("raycast={noArtRaycast}"));
});
