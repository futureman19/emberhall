import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { COURT } from "../../game/atlas.ts";
import { gardenTreeTransform, usesBlenderHall } from "./lanternwood-kit.ts";

const root = new URL("../../../", import.meta.url);
const source = (file: string) => readFileSync(new URL(file, root), "utf8");
const load = async (name: string) => {
  const bytes = readFileSync(new URL(`public/art/lanternwood/${name}.glb`, root));
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
};

test("editable Blender source accompanies bounded valid exported hall/tree meshes", async () => {
  const blend = readFileSync(new URL("art/blender/lanternwood-kit.blend", root));
  assert.equal(blend.toString("ascii", 0, 7), "BLENDER");
  for (const name of ["hall", "tree-0", "tree-1"]) {
    const { scene } = await load(name);
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = bounds.getSize(new THREE.Vector3());
    assert.ok(size.x > 1 && size.x < 7);
    assert.ok(size.y > 3 && size.y < 6.7, `${name}: Y-up height ${size.y}`);
    assert.ok(size.z > 1 && size.z < 6);
    assert.ok(bounds.min.y > -.05 && bounds.min.y < .1, "grounded pivot");
    let meshes = 0, vertices = 0;
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      meshes++;
      const position = object.geometry.getAttribute("position");
      vertices += position.count;
      assert.ok(object.geometry.getAttribute("normal"));
      for (const v of position.array) assert.ok(Number.isFinite(v));
    });
    assert.ok(meshes <= 14, `material batching: ${meshes}`);
    assert.ok(vertices < 60000, `bounded vertex budget: ${vertices}`);
  }
});

test("hall export contains chestnut roofs, red cloth and emissive honey glass", async () => {
  const { scene } = await load("hall");
  const names: string[] = [];
  let glow = false;
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      names.push(material.name);
      if (material instanceof THREE.MeshStandardMaterial && material.emissiveIntensity > 0 && material.emissive.r > .1) glow = true;
    }
  });
  assert.ok(names.some(n => n.includes("chestnut")));
  assert.ok(names.some(n => n.includes("oxblood")));
  assert.ok(names.some(n => n.includes("lime plaster")));
  assert.ok(glow);
});

test("kit placement is deterministic and hall swap restricted to original starting-town interior", () => {
  assert.ok(usesBlenderHall("hall", COURT.tx, COURT.ty - 2));
  assert.equal(usesBlenderHall("bank", COURT.tx, COURT.ty), false);
  assert.equal(usesBlenderHall("hall", COURT.tx + 40, COURT.ty), false);
  for (let i = 0; i < 20; i++) {
    const value = gardenTreeTransform(i, i + 2);
    assert.deepEqual(value, gardenTreeTransform(i, i + 2));
    assert.ok(value.scale >= .68 && value.scale <= .84);
  }
});

test("original building pick layers and inside presentation remain; kit never raycasts or mutates world", () => {
  const building = source("src/components/game/building-meshes.tsx");
  const kit = source("src/components/game/lanternwood-kit.ts");
  const dressing = source("src/components/game/lanternwood-dressing.tsx");
  assert.match(building, /Boolean\(authored && !inside\)/);
  assert.equal((building.match(/pickOnly=\{exterior\}/g) ?? []).length, 2);
  assert.match(building, /colorWrite=\{!pickOnly\}/);
  assert.match(building, /depthWrite=\{!pickOnly && fade >= 1\}/);
  assert.match(building, /!inside &&\s*KINDS\.map/);
  assert.match(kit, /o\.raycast = noArtRaycast/);
  assert.doesNotMatch(kit, /getWorld|useGame|Math\.random/);
  assert.match(dressing, /kind !== "grass"/);
  assert.match(dressing, /slice\(0, 8\)/);
});
