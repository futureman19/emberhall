import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Box3, BoxGeometry, InstancedMesh, Matrix4, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createTimberBatches, claimTimberSlot, resetTimberBatches, finishTimberBatches } from "./timber-batches.ts";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RESOURCE_CATALOG, RESOURCE_IDS } from "../../game/resources/catalog.ts";
import { TIMBER_IDS, timberAssetUrl, authoredTimberId } from "./timber-renderer-policy.ts";
import { extractTimberGeometry } from "./timber-renderer-data.ts";
const root = new URL("../../../", import.meta.url);

test("every canonical timber routes to its own authored asset worldwide, never unknown ore", () => {
  const canonical = RESOURCE_IDS.filter(id => RESOURCE_CATALOG[id].kind === "timber");
  assert.deepEqual([...TIMBER_IDS], canonical);
  for (const id of canonical) {
    assert.equal(authoredTimberId(id, true), id);
    assert.equal(authoredTimberId(id, false), null);
    assert.match(timberAssetUrl(authoredTimberId(id, true)!), new RegExp(id + "\\.glb$"));
  }
  for (const id of ["iron_ore", "ironwood", "", "__proto__"]) assert.equal(authoredTimberId(id, true), null);
});

test("actual GLTFLoader meshes: eight distinct assets, baked axes, bounded anchors, ground stumps", async () => {
  const manifest = JSON.parse(readFileSync(new URL("public/art/lanternwood/timber-manifest.json", root), "utf8"));
  assert.deepEqual(Object.keys(manifest.assets).sort(), [...TIMBER_IDS].sort());
  const hashes = new Set<string>();
  for (const id of TIMBER_IDS) {
    const bytes = readFileSync(new URL("public" + timberAssetUrl(id), root));
    const hash = createHash("sha256").update(bytes).digest("hex");
    hashes.add(hash);
    assert.equal(hash, manifest.assets[id].sha256);
    assert.equal(bytes.byteLength, manifest.assets[id].bytes);
    if (id === "oak") assert.equal(hash, "e38306e785170da4e66399611d7e1e715d4ccb40b9693883f63abb66055f0f8a");
    const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const geometry = extractTimberGeometry(scene, id);
    for (const part of ["trunk", "crown"] as const) {
      const g = geometry[part]; g.computeBoundingBox();
      const b = g.boundingBox!;
      assert.ok(b.getSize(new Vector3()).y > 1 && b.getSize(new Vector3()).y < 2.61, `${id} ${part} height`);
      assert.ok(Math.abs(b.getCenter(new Vector3()).y) < .08, `${id} ${part} centered at runtime anchor`);
      assert.ok(Math.max(Math.abs(b.min.x), Math.abs(b.max.x), Math.abs(b.min.z), Math.abs(b.max.z)) <= 1.17, `${id} ${part} radius`);
      for (const value of g.attributes.position.array) assert.ok(Number.isFinite(value));
      assert.ok(g.attributes.normal);
    }
    assert.ok(geometry.stump, id + " stump");
    geometry.stump.computeBoundingBox();
    assert.ok(geometry.stump.boundingBox!.min.y >= -.01);
    assert.ok(geometry.stump.boundingBox!.max.y < .36);
    if (id !== "oak") {
      const assembly = new Box3().setFromObject(scene);
      assert.ok(Math.abs(assembly.min.y) < .001, `${id} export ground pivot`);
      assert.ok(assembly.max.y <= 4.21);
      assert.ok(geometry.saplingTrunk && geometry.saplingCrown, id + " separate sapling palette parts");
    }
  }
  assert.equal(hashes.size, TIMBER_IDS.length);
});

test("terrain routing preserves instance index maps and chunk invalidation with no invisible duplicate solids", () => {
  const source = readFileSync(new URL("src/components/game/terrain.tsx", root), "utf8");
  assert.match(source, /authoredTimberId\(woodId/);
  assert.match(source, /claimTimberSlot\(batch, under, \{ tx, ty \}\)/);
  assert.match(source, /pickMap\(solidAt\)/);
  assert.match(source, /pickMap\(ghostAt\)/);
  assert.match(source, /resetTimberBatches/);
  assert.equal((source.match(/pickMap\(batch.solidAt\)/g) ?? []).length, 2);
  assert.equal((source.match(/pickMap\(batch.ghostAt\)/g) ?? []).length, 2);
  assert.match(source, /finishTimberBatches\(timberBatches\)/);
  assert.match(source, /customTimber \? HIDDEN_TIMBER : dummy.matrix/);
  assert.match(source, /woodId === "ghostwood" && !w.player.ghost/);
  assert.doesNotMatch(source.match(/const treeView =[^;]+/)![0], /px|pz/);
  assert.doesNotMatch(source, /Math.random\(/);
});

// Exercise real Three instance counts/rays, not only renderer source strings.
test("dense timber batches retain species-local picks through swaps, fading, depletion and regrowth", () => {
  const batches = createTimberBatches();
  const geometry = new BoxGeometry(1, 2, 1), material = new MeshBasicMaterial();
  for (const batch of batches) {
    for (const ref of [batch.trunk, batch.crown, batch.trunkGhost, batch.crownGhost]) {
      ref.current = new InstancedMesh(geometry, material, 8);
    }
  }
  const oak = batches.find(b => b.id === "oak")!;
  const pine = batches.find(b => b.id === "pine")!;
  const add = (batch: typeof oak, faded: boolean, tx: number, ty: number) => {
    const index = claimTimberSlot(batch, faded, { tx, ty });
    const matrix = new Matrix4().makeTranslation(tx, 1, ty);
    for (const ref of faded ? [batch.trunkGhost, batch.crownGhost] : [batch.trunk, batch.crown]) ref.current!.setMatrixAt(index, matrix);
    return index;
  };
  const hit = (batch: typeof oak, faded: boolean, tx: number, ty: number) => {
    const mesh = (faded ? batch.trunkGhost : batch.trunk).current!;
    mesh.updateMatrixWorld(true);
    const hits = new Raycaster(new Vector3(tx, 1, ty + 4), new Vector3(0, 0, -1)).intersectObject(mesh);
    return hits.map(h => (faded ? batch.ghostAt : batch.solidAt).current[h.instanceId!]);
  };
  try {
    resetTimberBatches(batches);
    assert.equal(add(oak, false, 10, 10), 0);
    assert.equal(add(pine, false, 20, 10), 0);
    assert.equal(add(oak, false, 12, 10), 1);
    assert.equal(add(pine, true, 22, 10), 0);
    finishTimberBatches(batches);
    assert.equal(oak.trunk.current!.count, 2); assert.equal(pine.trunk.current!.count, 1);
    assert.equal(pine.trunkGhost.current!.count, 1);
    for (const batch of batches.filter(b => b !== oak && b !== pine)) {
      assert.equal(batch.trunk.current!.count, 0); assert.equal(batch.crown.current!.count, 0);
      assert.equal(batch.trunkGhost.current!.count, 0); assert.equal(batch.crownGhost.current!.count, 0);
    }
    assert.ok(hit(oak, false, 12, 10).length > 0);
    assert.ok(hit(oak, false, 12, 10).every(site => site.tx === 12 && site.ty === 10));
    assert.ok(hit(pine, true, 22, 10).every(site => site.tx === 22 && site.ty === 10));
    // Swap one species at the same tile and move the remaining oak to the faded map.
    resetTimberBatches(batches);
    assert.equal(add(pine, false, 10, 10), 0);
    assert.equal(add(oak, true, 12, 10), 0);
    finishTimberBatches(batches);
    assert.equal(oak.trunk.current!.count, 0); assert.deepEqual(oak.solidAt.current, []);
    assert.equal(pine.trunkGhost.current!.count, 0); assert.deepEqual(pine.ghostAt.current, []);
    assert.deepEqual(hit(oak, false, 12, 10), [], "stale matrices outside active prefix cannot steal picks");
    assert.ok(hit(pine, false, 10, 10).length > 0);
    assert.ok(hit(pine, false, 10, 10).every(site => site.tx === 10));
    // Full depletion followed by regrowth starts again at index zero.
    resetTimberBatches(batches); finishTimberBatches(batches);
    for (const batch of batches) assert.equal(batch.trunk.current!.count + batch.crown.current!.count + batch.trunkGhost.current!.count + batch.crownGhost.current!.count, 0);
    assert.deepEqual(hit(pine, false, 10, 10), []);
    assert.equal(add(oak, false, 30, 10), 0); finishTimberBatches(batches);
    assert.ok(hit(oak, false, 30, 10).length > 0);
    assert.ok(hit(oak, false, 30, 10).every(site => site.tx === 30 && site.ty === 10));
  } finally {
    for (const batch of batches) for (const ref of [batch.trunk, batch.crown, batch.trunkGhost, batch.crownGhost]) ref.current!.dispose();
    geometry.dispose(); material.dispose();
  }
});

// Runtime rejected-download control exposed cached bounds at the hidden pool.
test("primitive timber pick bounds invalidate after matrix updates", () => {
  const source = readFileSync(new URL("src/components/game/terrain.tsx", root), "utf8");
  const reset = source.match(/for \(const mesh of \[tk, tkg, cn, gh\]\) \{[^}]+\}/)?.[0];
  assert.ok(reset, "all four primitive solid/faded tree pools reset their bounds");
  assert.match(reset, /mesh\.boundingSphere = null/);
  const geometry = new BoxGeometry(1, 2, 1), material = new MeshBasicMaterial();
  const mesh = new InstancedMesh(geometry, material, 1);
  const ray = new Raycaster(new Vector3(20, 1, 25), new Vector3(0, 0, -1));
  try {
    mesh.setMatrixAt(0, new Matrix4().makeTranslation(0, -40, 0));
    mesh.computeBoundingSphere();
    mesh.setMatrixAt(0, new Matrix4().makeTranslation(20, 1, 20));
    assert.equal(ray.intersectObject(mesh).length, 0, "stale hidden-pool bounds reproduce miss");
    // Execute the same simple renderer invalidation block, not a test-only replacement.
    new Function("tk", "tkg", "cn", "gh", reset)(mesh, null, null, null);
    assert.ok(ray.intersectObject(mesh).length > 0, "fresh bounds restore the actual hit");
  } finally { mesh.dispose(); geometry.dispose(); material.dispose(); }
});
