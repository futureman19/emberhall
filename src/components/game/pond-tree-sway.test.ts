import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { BoxGeometry, Euler, InstancedMesh, MeshStandardMaterial, Matrix3, Matrix4, ShaderLib, Vector3 } from "three";
import { generateTiles } from "../../game/world.ts";
import type { World } from "../../game/types.ts";
const load = () => import("./pond-tree-sway.ts");

test("selection is deterministic, local, capped at six actual trees and follows current scars", async () => {
  const { selectPondTrees } = await load();
  const w = { tiles: generateTiles(17) } as World;
  const sites = selectPondTrees(w);
  assert.equal(sites.length, 6);
  assert.deepEqual(sites, selectPondTrees(w));
  for (const [x, z] of sites) {
    assert.equal(w.tiles[z]![x]!.kind, "tree");
    assert.ok(x >= 244 && x <= 256 && z >= 300 && z <= 312);
    w.tiles[z]![x]!.kind = "grass";
  }
  assert.ok(selectPondTrees(w).every(([x, z]) => !sites.some(([a, b]) => a === x && b === z)));
});

test("root and low trunk are stiff, crown displacement bounded and phase stable", async () => {
  const { treeDisplacement } = await load();
  for (let t = 0; t < 30; t += 0.19) {
    assert.deepEqual(treeDisplacement(0, t, 247, 307), [0, 0]);
    assert.deepEqual(treeDisplacement(0.3, t, 247, 307), [0, 0]);
    assert.ok(Math.hypot(...treeDisplacement(7, t, 247, 307)) < 0.14);
  }
  assert.notDeepEqual(treeDisplacement(4, 1, 247, 307), treeDisplacement(4, 3, 247, 307));
  assert.notDeepEqual(treeDisplacement(4, 1, 247, 307), treeDisplacement(4, 1, 251, 308));
});

test("existing mesh keeps picking, matrices and source art; color/depth/distance share live uniform and deformation", async () => {
  const { createPondTreeSway } = await load();
  const w = { tiles: generateTiles(17) } as World;
  const geometry = new BoxGeometry(), material = new MeshStandardMaterial({ vertexColors: true });
  const mesh = new InstancedMesh(geometry, material, 4);
  mesh.frustumCulled = false;
  const raycast = mesh.raycast;
  const matrix = new Matrix4().makeScale(0.7, 1.4, 0.7);
  mesh.setMatrixAt(0, matrix);
  const before = mesh.instanceMatrix.array.slice();
  const sway = createPondTreeSway();
  const sites = sway.begin(w);
  const [x, z] = sites[0]!;
  sway.setRoot(mesh, 0, x, 2, z);
  sway.setRoot(mesh, 1, 100, 2, 100);
  sway.flush();
  assert.notEqual(mesh.geometry, geometry);
  assert.equal(mesh.raycast, raycast);
  assert.deepEqual(mesh.instanceMatrix.array, before);
  assert.equal(geometry.getAttribute("pondTreeRoot"), undefined);
  assert.equal(mesh.geometry.getAttribute("pondTreeRoot").getW(0), 1);
  assert.equal(mesh.geometry.getAttribute("pondTreeRoot").getW(1), 0);
  for (const [mat, lib] of [[mesh.material, ShaderLib.standard], [mesh.customDepthMaterial, ShaderLib.depth], [mesh.customDistanceMaterial, ShaderLib.distance]] as const) {
    assert.ok(mat && !Array.isArray(mat));
    const shader = { uniforms: {}, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader };
    mat.onBeforeCompile(shader as never, {} as never);
    assert.equal((shader.uniforms as Record<string, unknown>).uTreeWindTime, sway.uniforms.uTreeWindTime);
    assert.match(shader.vertexShader, /pondTreeSway/);
    assert.match(shader.vertexShader, /inverse\(mat3\(pondTreeMatrix\)\)/);
    assert.match(shader.vertexShader, /transformed \+=/);
    assert.equal(mat.userData.treeWind, sway.uniforms);
  }
  sway.update(1);
  assert.equal(sway.uniforms.uTreeWindTime.value, 0.05);
  sway.update(NaN);
  assert.equal(sway.uniforms.uTreeWindTime.value, 0.05);
  sway.begin(w); sway.flush();
  assert.equal(mesh.geometry.getAttribute("pondTreeRoot").getW(0), 0, "reused slots must not retain eligibility");
  let disposed = 0;
  mesh.geometry.addEventListener("dispose", () => disposed++);
  (mesh.material as MeshStandardMaterial).addEventListener("dispose", () => disposed++);
  mesh.customDepthMaterial!.addEventListener("dispose", () => disposed++);
  mesh.customDistanceMaterial!.addEventListener("dispose", () => disposed++);
  sway.dispose(); sway.dispose();
  assert.equal(disposed, 4);
  assert.equal(mesh.geometry, geometry);
  assert.equal(mesh.material, material);
  assert.equal(mesh.customDepthMaterial, undefined);
  const replay = createPondTreeSway(); replay.begin(w); replay.setRoot(mesh, 0, x, 2, z);
  assert.notEqual(mesh.geometry, geometry);
  replay.dispose();
  geometry.dispose(); material.dispose(); mesh.dispose();
});

test("world shear and its inverse-transpose normals survive nonuniform scale, yaw and chopping tilt", async () => {
  const { treeDisplacement } = await load();
  for (const yaw of [0, 1.2, 2.9]) {
    const matrix = new Matrix4().makeRotationFromEuler(new Euler(0.04, yaw, 0.08));
    matrix.scale(new Vector3(0.7, 1.8, 1.2)).setPosition(247, 3, 307);
    const linear = new Matrix3().setFromMatrix4(matrix);
    const local = new Vector3(0.3, 0.6, -0.2), world = local.clone().applyMatrix4(matrix);
    const bend = (p: Vector3) => {
      const d = treeDisplacement(p.y - 1, 2.3, 247, 307);
      return p.clone().add(new Vector3(d[0], 0, d[1]));
    };
    const offset = bend(world).sub(world);
    const fromLocal = local.clone().add(offset.clone().applyMatrix3(linear.clone().invert())).applyMatrix4(matrix);
    assert.ok(fromLocal.distanceTo(bend(world)) < 1e-10);
    const normal = new Vector3(1, 0.4, 0.2).normalize();
    const tangent = new Vector3(-0.4, 1, 0).normalize();
    const worldNormal = normal.clone().applyMatrix3(new Matrix3().getNormalMatrix(matrix));
    const h = Math.max(0, Math.min(1, (world.y - 1 - 0.35) / 4.15));
    const wind = treeDisplacement(10, 2.3, 247, 307);
    worldNormal.y -= (worldNormal.x * wind[0] + worldNormal.z * wind[1]) * 6 * h * (1 - h) / 4.15;
    const dt = tangent.clone().multiplyScalar(1e-5).add(local).applyMatrix4(matrix);
    const deformedTangent = bend(dt).sub(bend(world)).normalize();
    assert.ok(Math.abs(worldNormal.normalize().dot(deformedTangent)) < 1e-6);
  }
});

test("empty local patch allocates nothing; terrain tags existing parts only and leaves horizon untouched", async () => {
  const { createPondTreeSway } = await load();
  const sway = createPondTreeSway();
  const geometry = new BoxGeometry(), material = new MeshStandardMaterial();
  const mesh = new InstancedMesh(geometry, material, 1);
  assert.deepEqual(sway.begin({ tiles: [] }), []);
  sway.setRoot(mesh, 0, 247, 0, 307); sway.update(1);
  assert.equal(mesh.material, material); assert.equal(mesh.geometry, geometry);
  assert.equal(sway.uniforms.uTreeWindTime.value, 0);
  sway.dispose(); geometry.dispose(); material.dispose(); mesh.dispose();
  const terrain = readFileSync(new URL("./terrain.tsx", import.meta.url), "utf8");
  for (const target of ["customTrunk, treeIndex", "customCrown, treeIndex", "tkg, gi", "tk, si", "gh, gi", "cn, si", "softCanopy.current, li"]) {
    assert.ok(terrain.includes(`setRoot(${target}, tx, gy, ty)`), target);
  }
  assert.ok(terrain.includes("treeSway.current?.begin(w)"));
  assert.ok(terrain.includes("treeSway.current?.flush()"));
  assert.ok(terrain.includes("sway.dispose(); treeSway.current = null"));
  assert.ok(!terrain.slice(terrain.indexOf("const HORIZON =")).includes("treeSway"));
});
