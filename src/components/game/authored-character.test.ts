import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BoxGeometry, Group, Mesh, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CHARACTER_PARTS, extractCharacterGeometry } from "./authored-character-data.ts";
import { FIGURE, HAIR } from "../../game/look/figure.ts";

const root = new URL("../../../", import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), "utf8");
test("extraction bakes ancestor transforms into independent geometry", () => {
  const scene = new Group();
  scene.rotation.x = Math.PI / 2;
  const mesh = new Mesh(new BoxGeometry(1, 2, 3));
  mesh.name = "head";
  scene.add(mesh);
  const before = Array.from(mesh.geometry.attributes.position.array);
  const result = extractCharacterGeometry(scene);
  assert.notEqual(result.head, mesh.geometry);
  assert.deepEqual(Array.from(mesh.geometry.attributes.position.array), before);
  result.head!.computeBoundingBox();
  const size = result.head!.boundingBox!.getSize(new Vector3());
  assert.ok(Math.abs(size.y - 3) < 0.00001);
  assert.ok(Math.abs(size.z - 2) < 0.00001);
  assert.deepEqual(extractCharacterGeometry(new Group()), {});
});

test("real modular GLB has every named part centered and sized in runtime Y-up space", async () => {
  const bytes = readFileSync(new URL("public/art/lanternwood/character.glb", root));
  const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  const geometry = extractCharacterGeometry(scene);
  assert.deepEqual(Object.keys(geometry).sort(), [...CHARACTER_PARTS].sort());
  for (const part of CHARACTER_PARTS) {
    const g = geometry[part]!;
    g.computeBoundingBox();
    const box = g.boundingBox!;
    assert.ok(box.getCenter(new Vector3()).length() < 0.02, `${part}: centered pivot`);
    const actual = box.getSize(new Vector3()).toArray();
    const expected = part.startsWith("hair_") ? HAIR[part.slice(5) as keyof typeof HAIR].size : FIGURE[part as Exclude<keyof typeof FIGURE, "armMesh">].size;
    actual.forEach((size, i) => assert.ok(Math.abs(size - (part === "hair_cap" && i === 1 ? 0.228 : part === "torso" && i === 0 ? 0.605 : expected[i])) < 0.025, `${part}: axis ${i} size ${size}, expected ${expected[i]}`));
    assert.ok(g.attributes.normal);
    for (const value of g.attributes.position.array) assert.ok(Number.isFinite(value));
  }
});

test("player-only runtime, shared mirror, guarded fallback and non-picking face", () => {
  const people = source("src/components/game/people-meshes.tsx");
  const mirror = source("src/components/game/look-preview.tsx");
  const shared = source("src/components/game/authored-character.tsx");
  const data = source("src/components/game/authored-character-data.ts");
  for (const match of people.matchAll(/<AuthoredCharacterGeometry[^>]+/g)) {
    assert.match(match[0], /authored=\{(?:p.isPlayer|authored)\}/);
  }
  assert.match(people, /<HairMeshes[^>]+authored=\{p.isPlayer\}/);
  for (const text of [people, mirror]) {
    assert.match(text, /<AuthoredCharacterFace/);
    assert.match(text, /<AuthoredCharacterTunic/);
    assert.doesNotMatch(text, /boxGeometry args=\{\[\.\.\.(FIGURE|HAIR)/);
    assert.match(text, /boxGeometry args=\{\[voxel, voxel, voxel\]/);
  }
  assert.match(shared, /dispose=\{null\}/);
  assert.match(shared, /<boxGeometry args=\{\[\.\.\.size\]\}/);
  assert.match(shared, /raycast=\{noPick\}/);
  assert.match(shared, /!geometry\?\.head \|\| ghost/);
  assert.match(data, /if \(!authored\) return/);
  assert.match(data, /if \(active\) setGeometry/);
  assert.match(data, /\.catch\(/);
  assert.doesNotMatch(shared + data, /Suspense|getWorld|useGame|Math.random/);
});
