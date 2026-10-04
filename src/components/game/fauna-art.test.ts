import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import { Box3, Group, Mesh, MeshStandardMaterial, BoxGeometry, Raycaster, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FAUNA_ART_URLS, faunaArtEnabled } from "./fauna-art-catalog.ts";
import { cloneFaunaArt } from "./fauna-art-data.ts";
import { FAUNA_META } from "../../game/catalog.ts";

const art = new URL("../../../public/art/lanternwood/", import.meta.url);
const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const hash = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const manifest = JSON.parse(readFileSync(new URL("fauna-manifest.json", art), "utf8"));
type Entry = { kind: keyof typeof FAUNA_ART_URLS; family: string; file: string; bytes: number; sha256: string; triangles: number; materials: number; parts: string[]; bounds: { min: number[]; max: number[] } };

test("52 current fauna type/catalog/renderer/export IDs match exactly, worldwide", () => {
  const types = read("../../game/types.ts").match(/export type FaunaKind\s*=([\s\S]*?);/)![1];
  const ids = [...types.matchAll(/"(\w+)"/g)].map((m) => m[1]).sort();
  assert.equal(ids.length, 52);
  assert.deepEqual(Object.keys(FAUNA_META).sort(), ids);
  assert.deepEqual(Object.keys(FAUNA_ART_URLS).sort(), ids);
  assert.deepEqual(manifest.species.map((s: Entry) => s.kind).sort(), ids);
  assert.equal(manifest.speciesCount, ids.length);
  assert.deepEqual(readdirSync(art).filter((s) => /^fauna-.*\.glb$/.test(s)).sort(), ids.map((id) => `fauna-${id}.glb`).sort());
  assert.equal(new Set(manifest.species.map((s: Entry) => s.sha256)).size, ids.length);
  assert.ok(new Set(manifest.species.map((s: Entry) => s.family)).size >= 15);
});

for (const entry of manifest.species as Entry[]) {
  test(`${entry.kind}: actual GLTFLoader finite Y-up ground/front geometry, palette and budget`, async () => {
    const bytes = readFileSync(new URL(entry.file, art));
    assert.equal(bytes.length, entry.bytes); assert.equal(hash(bytes), entry.sha256);
    const { scene, animations } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    assert.equal(animations.length, 0, "existing Beast root is the only animation owner");
    scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(scene);
    assert.ok(Math.abs(bounds.min.y) < 0.00001, `ground pivot ${bounds.min.y}`);
    assert.ok(bounds.max.y > .2 && bounds.max.y < 2.7);
    assert.ok(bounds.max.x < 1.6 && bounds.min.x > -1.6 && bounds.min.z > -1.8 && bounds.max.z < 1.7);
    if (entry.kind === "cavern_bat") assert.ok(bounds.max.x > 1.3 && bounds.min.x < -1.3, "bat wings retain readable spread without changing gameplay SIZE");
    bounds.min.toArray().forEach((v, i) => assert.ok(Math.abs(v - entry.bounds.min[i]) < 0.00001));
    bounds.max.toArray().forEach((v, i) => assert.ok(Math.abs(v - entry.bounds.max[i]) < 0.00001));
    let marker = false; let triangles = 0; let meshCount = 0; let colored = 0;
    const materials = new Set();
    scene.traverse((object) => {
      if (object.userData.front_axis === "+Z" && !(object instanceof Mesh) && object.name.includes("front_axis")) {
        const p = object.getWorldPosition(new Vector3()); assert.ok(p.z > .9 && Math.abs(p.x) < .00001); marker = true;
      }
      if (!(object instanceof Mesh)) return;
      meshCount++;
      const p = object.geometry.getAttribute("position");
      for (let i = 0; i < p.count; i++) assert.ok([p.getX(i), p.getY(i), p.getZ(i)].every(Number.isFinite));
      triangles += (object.geometry.index?.count ?? p.count) / 3;
      if (object.geometry.getAttribute("color")) colored++;
      for (const m of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(m); assert.equal(m.transparent, false); assert.equal(m.opacity, 1);
      }
    });
    assert.ok(marker, "exported +Z front marker"); assert.ok(colored > 0, "opaque vertex-colored merged body");
    assert.equal(triangles, entry.triangles); assert.ok(triangles < 2500);
    assert.ok(meshCount <= 3 && materials.size <= 3, `${meshCount} meshes / ${materials.size} materials`);
    assert.ok(entry.parts.length >= 8, "semantic editable source parts");
    const a = cloneFaunaArt(scene); const b = cloneFaunaArt(scene);
    assert.notEqual(a, b);
    const meshes: Mesh[] = []; const others: Mesh[] = [];
    a.traverse((o) => { if (o instanceof Mesh) meshes.push(o); }); b.traverse((o) => { if (o instanceof Mesh) others.push(o); });
    assert.equal(meshes[0].geometry, others[0].geometry); assert.equal(meshes[0].material, others[0].material);
    const ray = new Raycaster(new Vector3(0, bounds.max.y / 2, 5), new Vector3(0, 0, -1));
    assert.equal(ray.intersectObject(a, true).length, 0, "decorative hierarchy cannot intercept picks");
  });
}

test("hidden parent skips visible traversal while retaining exact picking and original materials", () => {
  const group = new Group(); const material = new MeshStandardMaterial();
  const mesh = new Mesh(new BoxGeometry(1, 2, 1), material); mesh.position.y = 1; mesh.castShadow = true; group.add(mesh); group.updateMatrixWorld(true);
  const ray = new Raycaster(new Vector3(0, 1, 4), new Vector3(0, 0, -1));
  const before = ray.intersectObject(group, true).map((hit) => hit.distance);
  group.visible = false;
  const visibleMeshes: Mesh[] = [];
  group.traverseVisible(o => { if (o instanceof Mesh) visibleMeshes.push(o); });
  assert.equal(visibleMeshes.length, 0);
  assert.deepEqual(ray.intersectObject(group, true).map((hit) => hit.distance), before);
  assert.equal(mesh.material, material); assert.equal(mesh.castShadow, true);
  group.visible = true;
  assert.deepEqual(ray.intersectObject(group, true).map(hit => hit.distance), before);
  assert.equal(faunaArtEnabled("?faunaArt=off"), false); assert.equal(faunaArtEnabled("?faunaArtFail=1"), false);
  assert.equal(faunaArtEnabled("?x=100000&z=-999999"), true);
});

test("fallback Body and Beast boundary stay byte-preserved except explicit live death-read fix", () => {
  const renderer = read("./fauna-meshes.tsx");
  assert.equal(hash(renderer.slice(renderer.indexOf("function Body"), renderer.indexOf("function Beast"))), "98d6c6563e9222bbefe429bd049ff28940e8ccd36c772d604ed3cf5780a194d2");
  const root = renderer.slice(renderer.indexOf("function Beast")).replace('      <FaunaArtBody kind={c.kind} size={SIZE[c.kind]}>\n        <Body c={c} />\n      </FaunaArtBody>', '      <Body c={c} />');
  // Normalize only the verified stale-death-read fix, not any animation/effect formula.
  const preservedRoot = root.replace('    const deadNow = c.task === "dead";\n', '').replaceAll('      deadNow ?', '      dead ?');
  assert.equal(hash(preservedRoot), "7c8661a100b5321414f0ff3bbb6a469baa0be049d6caaee07faaeb97f3fc58d1");
  const integration = read("./fauna-art.tsx");
  assert.ok(integration.includes("dispose={null}")); assert.ok(integration.includes("active && source"));
  assert.ok(!integration.includes("useFrame")); assert.ok(integration.includes("scale={size}"));
  assert.match(integration, /name="fauna-original-pick-proxy" visible=\{!scene\}/, "old bodies never submit color or shadow draws once art loads");
  assert.doesNotMatch(integration, /retainFaunaPickProxy|useLayoutEffect/, "do not mutate React-owned materials");
});

test("lynx export retains one bobtail without the previous extra canid tail", () => {
  const lynx = manifest.species.find((entry: Entry) => entry.kind === "pine_lynx") as Entry;
  assert.ok(lynx.parts.some(part => part.includes("bobtail")));
  assert.ok(!lynx.parts.some(part => /(?:^|_)tail_[01]$/.test(part)));
});

test("Beast death pose reads mutable creature task inside the frame callback", () => {
  const source = read("./fauna-meshes.tsx");
  const beast = source.slice(source.indexOf("function Beast"), source.indexOf("function TamingBillboard"));
  const frame = beast.slice(beast.indexOf("useFrame(() => {"), beast.indexOf("  return ("));
  assert.match(frame, /const deadNow = c.task === "dead";/);
  assert.match(frame, /deadNow \? Math.PI \/ 2/);
  assert.match(frame, /deadNow \? 0 : pulse/);
});
