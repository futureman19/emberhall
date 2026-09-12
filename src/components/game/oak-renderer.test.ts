import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BoxGeometry, Group, Mesh, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { COURT } from "../../game/atlas.ts";
import { usesAuthoredOak } from "./oak-renderer-policy.ts";
import { extractOakGeometry } from "./oak-renderer-data.ts";

const root = new URL("../../../", import.meta.url);
test("oak selection is worldwide, identity-driven, readiness-gated and pure", () => {
  const state = Object.freeze({ resourceId: "oak", tx: COURT.tx, ty: COURT.ty });
  assert.equal(usesAuthoredOak(state.resourceId, state.tx, state.ty, true), true);
  assert.equal(usesAuthoredOak("oak", COURT.tx + 22, COURT.ty, true), true);
  assert.equal(usesAuthoredOak("oak", COURT.tx + 22.001, COURT.ty, true), true);
  assert.equal(usesAuthoredOak("oak", COURT.tx, COURT.ty, false), false);
  for (const id of ["ghostwood", "ash", "yew", "pine", "willow", "ironwood", "elderwood", ""]) {
    assert.equal(usesAuthoredOak(id, COURT.tx, COURT.ty, true), false);
  }
  assert.deepEqual(state, { resourceId: "oak", tx: COURT.tx, ty: COURT.ty });
});
test("extraction bakes ancestors without altering source geometry", () => {
  const scene = new Group();
  scene.rotation.x = Math.PI / 2;
  for (const name of ["oak_trunk", "oak_crown"]) {
    const mesh = new Mesh(new BoxGeometry(1, 2, 3));
    mesh.name = name;
    scene.add(mesh);
  }
  const original = (scene.children[0] as Mesh).geometry;
  const before = Array.from(original.attributes.position.array);
  const geometry = extractOakGeometry(scene);
  assert.notEqual(geometry.trunk, original);
  assert.deepEqual(Array.from(original.attributes.position.array), before);
  geometry.trunk.computeBoundingBox();
  assert.ok(Math.abs(geometry.trunk.boundingBox!.getSize(new Vector3()).y - 3) < 0.00001);
  assert.throws(() => extractOakGeometry(new Group()), /requires/);
});
test("real oak GLB has finite, Y-up, correctly scaled named geometry", async () => {
  const bytes = readFileSync(new URL("public/art/lanternwood/oak.glb", root));
  const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  const geometry = extractOakGeometry(scene);
  for (const [part, height, radius] of [["trunk", 2.1, 0.71], ["crown", 2.5, 1.16]] as const) {
    const g = geometry[part];
    g.computeBoundingBox();
    const box = g.boundingBox!;
    assert.ok(Math.abs(box.getSize(new Vector3()).y - height) < 0.08, `${part} height`);
    assert.ok(Math.abs(box.getCenter(new Vector3()).y) < 0.08, `${part} centered vertically`);
    assert.ok(Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z)) <= radius, `${part} radius`);
    for (const v of g.attributes.position.array) assert.ok(Number.isFinite(v));
    assert.ok(g.attributes.normal);
  }
  assert.ok(geometry.sapling);
  assert.ok(geometry.stump);
  geometry.stump.computeBoundingBox();
  assert.ok(geometry.stump.boundingBox!.max.y < .36);
  assert.ok(geometry.stump.boundingBox!.min.y >= -.01);
});
test("renderer keeps canonical maps, depletion and sapling state; no world writes", () => {
  const terrain = readFileSync(new URL("src/components/game/terrain.tsx", root), "utf8");
  const crop = readFileSync(new URL("src/components/game/crop-meshes.tsx", root), "utf8");
  assert.match(terrain, /const woodId = plantedId \?\? resourceVisual.resourceId/);
  assert.match(terrain, /if \(t.kind === "tree"\)/);
  assert.match(terrain, /lastTimber.current !== timber/);
  for (const name of ["trunks", "crowns", "trunks-faded", "crowns-faded"]) {
    const tag = terrain.split("\n").find(line => line.includes("harvestable-${batch.id}-" + name + "`"))!;
    assert.ok(tag, name);
    assert.match(tag, name.includes("faded") ? /pickMap\(batch.ghostAt\)/ : /pickMap\(batch.solidAt\)/);
  }
  assert.match(crop, /sapling.resourceId \?\? "oak"/);
  assert.match(crop, /sapling.stage === 1/);
  assert.doesNotMatch(terrain + crop, /(?:w|world)\.(?:tiles|scars|plantedTimber|saplings)[^;\n]*(?<![=!<>])=(?!=|>)/);
  assert.doesNotMatch(terrain, /oak_stump/);
  assert.doesNotMatch(terrain.match(/const treeView =[^;]+/)![0], /px|pz/, "walking does not introduce additional full-terrain rebuilds");
  const stumps=readFileSync(new URL("src/components/game/oak-stumps.tsx",root),"utf8");
  assert.ok(/n\.depletedAtHour\s*===\s*null/.test(stumps));
  assert.ok(stumps.includes("saplings.some"));
  assert.ok(stumps.includes("raycast={noArtRaycast}"));
  assert.ok(stumps.includes("resolveResourceNode"));
});
test("stump memo invalidates on in-place sapling occupancy changes, not growth-only updates", () => {
  const source = readFileSync(new URL("src/components/game/oak-stumps.tsx", root), "utf8");
  // Forestry pushes into the existing saplings array without incrementing landRev.
  // Array identity/count alone also misses a same-size replacement at another tile.
  assert.match(source, /const saplingSitesKey = saplings\.map\(s => `\$\{s\.tx\},\$\{s\.ty\}`\)\.join\(";"\)/);
  assert.match(source, /\[nodes, saplings, saplingSitesKey, buildings, land, world, ghost\]/);
});
