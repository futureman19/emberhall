import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { BUILD_SIZE, buildingBox } from "../../game/building-size.ts";
import { COURT, EMBERHALL_BANK } from "../../game/atlas.ts";
import { settlementKitName, retainSettlementInteriorVoxel } from "./settlement-kit.ts";

const root = new URL("../../../", import.meta.url);
const text = (file: string) => readFileSync(new URL(file, root), "utf8");
const load = async (name: string) => {
  const bytes = readFileSync(new URL(`public/art/lanternwood/${name}.glb`, root));
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  gltf.scene.updateMatrixWorld(true);
  return { ...gltf, bytes: bytes.length };
};

test("settlement routing covers existing bank and forge worldwide", () => {
  assert.equal(settlementKitName("bank", EMBERHALL_BANK.tx, EMBERHALL_BANK.ty), "bank");
  assert.equal(settlementKitName("bank", EMBERHALL_BANK.tx + 1, EMBERHALL_BANK.ty), "bank");
  assert.equal(settlementKitName("forge", COURT.tx - 7, COURT.ty + 3), "forge");
  assert.equal(settlementKitName("forge", 192, 344), "forge");
  assert.equal(settlementKitName("forge", COURT.tx + 20, COURT.ty), "forge");
  for (const kind of Object.keys(BUILD_SIZE).filter(k => k !== "bank" && k !== "forge")) {
    assert.equal(settlementKitName(kind, COURT.tx, COURT.ty), null);
  }
});

test("original footprint and voxel-centered door/anchor contracts stay fixed", () => {
  assert.deepEqual(BUILD_SIZE.bank, { x0: -3, x1: 3, z0: -2, z1: 2 });
  assert.deepEqual(BUILD_SIZE.forge, { x0: -3, x1: 3, z0: -3, z1: 3 });
  assert.deepEqual(buildingBox("bank", 0, 0), { x0: -1.5, x1: 2, z0: -1, z1: 1.5 });
  const source = text("src/components/game/building-meshes.tsx");
  assert.match(source, /door: \{ x: -1, w: 2, h: 2 \}/);
  assert.match(source, /const open = z === 3;/);
  assert.match(source, /const z1 = b.ty \+ \(s.z1 \+ 1\) \* B \+ 0.45;/);
  assert.match(source, /useGame.getState\(\).useStation\(b.id\)/);
  assert.match(source, /if \(pell\) useGame.getState\(\).select\(pell.id\)/);
});

test("original floor/counter/hearth contents remain visible under exterior shells", () => {
  assert.ok(retainSettlementInteriorVoxel("bank", { x: 0, y: 1, z: 0, cut: false }));
  assert.ok(retainSettlementInteriorVoxel("forge", { x: 0, y: 1, z: 1, cut: false }));
  assert.ok(retainSettlementInteriorVoxel("bank", { x: 0, y: 0, z: 0, cut: false }));
  assert.equal(retainSettlementInteriorVoxel("bank", { x: -3, y: 1, z: 0, cut: false }), false);
  assert.equal(retainSettlementInteriorVoxel("forge", { x: 0, y: 4, z: 0, cut: true }), false);
  assert.equal(retainSettlementInteriorVoxel("hall", { x: 0, y: 1, z: 0, cut: false }), false);
});

test("actual GLBs have finite Y-up geometry, grounded pivots and measured bounded cost", async () => {
  const blend = readFileSync(new URL("art/blender/settlement-kit.blend", root));
  assert.equal(blend.toString("ascii", 0, 7), "BLENDER");
  const manifest = JSON.parse(text("public/art/lanternwood/settlement-manifest.json"));
  for (const name of ["bank", "forge"]) {
    const { scene, bytes } = await load(name);
    const bounds = new THREE.Box3().setFromObject(scene);
    assert.ok(bounds.min.y >= -0.03 && bounds.min.y <= 0.06);
    assert.ok(bounds.max.y > 2 && bounds.max.y < 4.7);
    assert.ok(bounds.min.x >= -2 && bounds.max.x <= 2.5);
    assert.ok(bounds.min.z >= -2 && bounds.max.z <= 2.5);
    let triangles = 0, vertices = 0, meshes = 0;
    const materials = new Set<string>();
    scene.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      meshes++;
      const p = o.geometry.getAttribute("position");
      vertices += p.count;
      assert.ok(o.geometry.getAttribute("normal"));
      for (const v of p.array) assert.ok(Number.isFinite(v));
      triangles += (o.geometry.index?.count ?? p.count) / 3;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m.name);
    });
    assert.ok(triangles <= 12000 && vertices <= 30000 && meshes <= 10 && bytes <= 600000);
    assert.equal(manifest[name].bytes, bytes);
    assert.equal(manifest[name].triangles, triangles);
    assert.equal(manifest[name].vertices, vertices);
    assert.equal(manifest[name].materialSlots, materials.size);
    for (const [i, axis] of ["x", "y", "z"].entries()) {
      assert.ok(Math.abs(manifest[name].boundsYUp[0][i] - bounds.min[axis as "x" | "y" | "z"]) < 0.001);
      assert.ok(Math.abs(manifest[name].boundsYUp[1][i] - bounds.max[axis as "x" | "y" | "z"]) < 0.001);
    }
  }
});

test("exported bank doorway and open forge front do not acquire decorative obstruction", async () => {
  for (const name of ["bank", "forge"]) {
    const { scene } = await load(name);
    for (const x of name === "bank" ? [-0.35, 0, 0.35] : [-0.8, 0, 0.8]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, 1, name === "bank" ? 2 : 2.4), new THREE.Vector3(0, 0, -1), 0, 1.2);
      assert.equal(ray.intersectObject(scene, true).length, 0, `${name} entrance at x=${x}`);
    }
    const roof = new THREE.Raycaster(new THREE.Vector3(0.25, 5, 0), new THREE.Vector3(0, -1, 0));
    assert.ok(roof.intersectObject(scene, true).some(h => h.point.y > 2), `${name} roof faces upward`);
  }
});

test("bank and forge retain chestnut/timber/stone palette with restrained emissive accents", async () => {
  for (const name of ["bank", "forge"]) {
    const { scene } = await load(name);
    const names: string[] = [];
    let glow = false;
    scene.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        names.push(m.name);
        if (m instanceof THREE.MeshStandardMaterial && (m.emissive.r + m.emissive.g + m.emissive.b) > 0 && m.emissiveIntensity > 0) glow = true;
      }
    });
    for (const word of ["chestnut", "timber", "stone"]) assert.ok(names.some(n => n.includes(word)), `${name} ${word}`);
    assert.ok(glow, `${name} warm light`);
  }
});

test("integration reuses guarded shared loader and preserves cutaway/pick proxies", () => {
  const source = text("src/components/game/building-meshes.tsx");
  const policy = text("src/components/game/settlement-kit.ts");
  const loader = text("src/components/game/lanternwood-kit.ts");
  assert.match(source, /settlementKitName\(b.kind, b.tx, b.ty\)/);
  assert.match(source, /retainSettlementInteriorVoxel/);
  assert.match(source, /Boolean\(authored && !inside\)/);
  assert.equal((source.match(/pickOnly=\{exterior\}/g) ?? []).length, 2);
  assert.match(source, /dispose=\{null\}/);
  assert.match(loader, /o.raycast = noArtRaycast/);
  assert.match(loader, /if \(!active\) return/);
  assert.doesNotMatch(policy, /Math.random|getWorld|useGame|setWorld/);
});


test("forge trade pictogram uses restrained readable gold on its existing seven triangles", async () => {
  const { scene } = await load("forge");
  let triangles = 0;
  scene.traverse(o => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
    const m = o.material;
    if (!(m instanceof THREE.MeshStandardMaterial) || m.name !== "forge readable gold sign") return;
    assert.ok(m.color.r > .94 && m.color.g > .71 && m.color.b > .29);
    assert.ok(m.emissive.r > 0 && m.emissive.r < .09);
    assert.equal(m.transparent, false);
    assert.equal(m.side, THREE.DoubleSide);
    triangles += (o.geometry.index?.count ?? o.geometry.getAttribute("position").count) / 3;
  });
  assert.equal(triangles, 7);
});
