import { InstancedBufferAttribute, MeshDepthMaterial, MeshDistanceMaterial, RGBADepthPacking, type InstancedMesh, type Material } from "three";
import type { World } from "../../game/types.ts";

/** Only six existing resource trees nearest the pond, inside this explicit local box.
 * Current tiles (including save scars/chopping) are authoritative; never spawn art. */
export function selectPondTrees(world: Pick<World, "tiles">): [number, number][] {
  const sites: [number, number][] = [];
  for (let z = 300; z <= 312; z++) for (let x = 244; x <= 256; x++) {
    if (world.tiles[z]?.[x]?.kind === "tree") sites.push([x, z]);
  }
  return sites.sort(([ax, az], [bx, bz]) =>
    ((ax - 250) ** 2 + (az - 304) ** 2) - ((bx - 250) ** 2 + (bz - 304) ** 2) || az - bz || ax - bx).slice(0, 6);
}

/** CPU reference; world-unit displacement, independent of part scale and yaw. */
export function treeDisplacement(height: number, time: number, x: number, z: number): [number, number] {
  const h = Math.max(0, Math.min(1, (height - 0.35) / 4.15));
  const weight = h * h * (3 - 2 * h);
  if (!weight) return [0, 0];
  const phase = x * 1.73 + z * 2.31;
  const gust = 0.55 + 0.45 * Math.sin(time * 0.71 - x * 0.43 - z * 0.31);
  return [weight * (0.025 + 0.065 * gust + 0.025 * Math.sin(time * 1.1 + phase)),
    weight * (0.012 + 0.025 * Math.sin(time * 1.13 - x * 0.27 + z * 0.39 + phase))];
}

/** Crown masses, not individual leaves. A small height-varying world shear has
 * an exact normal derivative and stays consistent across separately scaled parts. */
export function leafFlutter(height: number, time: number, x: number, z: number, strength = 1) {
  const h = Math.max(0, Math.min(1, (height - 0.35) / 4.15));
  const weight = h * h * (3 - 2 * h) * Math.max(0, Math.min(1, strength));
  const gradient = 6 * h * (1 - h) / 4.15 * Math.max(0, Math.min(1, strength));
  const phase = x * 1.73 + z * 2.31;
  const a = time * 7.7 + height * 5.1 + phase, b = time * 9.3 - height * 4.3 + phase;
  if (!weight) return { offset: [0, 0], slope: [0, 0] };
  return {
    offset: [0.012 * weight * Math.sin(a), 0.009 * weight * Math.sin(b)],
    slope: [0.012 * (gradient * Math.sin(a) + weight * 5.1 * Math.cos(a)),
      0.009 * (gradient * Math.sin(b) - weight * 4.3 * Math.cos(b))],
  };
}

const GLSL = `
// pondTreeSway: world-space anchored shear, same travelling gust as pondGrass.
uniform float uTreeWindTime;
attribute vec4 pondTreeRoot;
attribute float pondTreeFoliage;
uniform float uLeafFlutterTime;
uniform float uLeafFlutterStrength;
vec2 pondLeafPhase(float height) {
  float phase = pondTreeRoot.x * 1.73 + pondTreeRoot.z * 2.31;
  return vec2(uLeafFlutterTime * 7.7 + height * 5.1 + phase,
    uLeafFlutterTime * 9.3 - height * 4.3 + phase);
}
vec2 pondLeafFlutter(float height) {
  float h = clamp((height - 0.35) / 4.15, 0.0, 1.0);
  return vec2(0.012, 0.009) * sin(pondLeafPhase(height)) * (h * h * (3.0 - 2.0 * h))
    * pondTreeFoliage * clamp(uLeafFlutterStrength, 0.0, 1.0);
}
vec2 pondLeafFlutterSlope(float height) {
  float h = clamp((height - 0.35) / 4.15, 0.0, 1.0);
  vec2 phase = pondLeafPhase(height);
  return vec2(0.012, 0.009) * (sin(phase) * (6.0 * h * (1.0 - h) / 4.15)
    + cos(phase) * vec2(5.1, -4.3) * (h * h * (3.0 - 2.0 * h)))
    * pondTreeFoliage * clamp(uLeafFlutterStrength, 0.0, 1.0);
}
vec2 pondTreeWind() {
  vec2 root = pondTreeRoot.xz;
  float phase = root.x * 1.73 + root.y * 2.31;
  float gust = 0.55 + 0.45 * sin(uTreeWindTime * 0.71 - root.x * 0.43 - root.y * 0.31);
  return vec2(0.025 + 0.065 * gust + 0.025 * sin(uTreeWindTime * 1.1 + phase),
    0.012 + 0.025 * sin(uTreeWindTime * 1.13 - root.x * 0.27 + root.y * 0.39 + phase));
}
`;

export function createPondTreeSway() {
  const uniforms = { uTreeWindTime: { value: 0 }, uLeafFlutterTime: { value: 0 }, uLeafFlutterStrength: { value: 1 } };
  function patchMaterial(material: Material) {
    material.name = `emberhall-pond-tree-sway-${material.type}`;
    material.userData.treeWind = uniforms;
    material.customProgramCacheKey = () => "pondTreeSway-leafFlutter-v2";
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${GLSL}`)
        .replace("#include <defaultnormal_vertex>", `#include <defaultnormal_vertex>
if (pondTreeRoot.w > 0.5) {
  // Three has already applied inverse-transpose instance/model scaling.
  vec3 pondTreeNormalWorld = transpose(mat3(viewMatrix)) * transformedNormal;
  float pondTreeNormalHeight = (modelMatrix * instanceMatrix * vec4(position, 1.0)).y - pondTreeRoot.y;
  float pondTreeNormalH = clamp((pondTreeNormalHeight - 0.35) / 4.15, 0.0, 1.0);
  pondTreeNormalWorld.y -= dot(pondTreeNormalWorld.xz, pondTreeWind() * (6.0 * pondTreeNormalH * (1.0 - pondTreeNormalH) / 4.15) + pondLeafFlutterSlope(pondTreeNormalHeight));
  transformedNormal = mat3(viewMatrix) * pondTreeNormalWorld;
}`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>
if (pondTreeRoot.w > 0.5) {
  mat4 pondTreeMatrix = modelMatrix * instanceMatrix;
  float pondTreeHeight = (pondTreeMatrix * vec4(transformed, 1.0)).y - pondTreeRoot.y;
  float pondTreeH = clamp((pondTreeHeight - 0.35) / 4.15, 0.0, 1.0);
  vec2 pondTreeOffset = pondTreeWind() * (pondTreeH * pondTreeH * (3.0 - 2.0 * pondTreeH)) + pondLeafFlutter(pondTreeHeight);
  // Convert world displacement back to geometry space, including nonuniform
  // instance scale and chopping tilt. Standard projection AND shadow chunks
  // then consume exactly the same deformed position (also in depth/distance).
  transformed += inverse(mat3(pondTreeMatrix)) * vec3(pondTreeOffset.x, 0.0, pondTreeOffset.y);
}`);
    };
  }
  function bind(mesh: InstancedMesh) {
    if (Array.isArray(mesh.material)) throw new Error("pondTreeSway requires a single tree material");
    const original = { geometry: mesh.geometry, material: mesh.material, depth: mesh.customDepthMaterial, distance: mesh.customDistanceMaterial };
    const geometry = original.geometry.clone();
    const roots = new InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count * 4), 4);
    geometry.setAttribute("pondTreeRoot", roots);
    const foliage = new InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count), 1);
    geometry.setAttribute("pondTreeFoliage", foliage);
    const material = original.material.clone();
    const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
    const distance = new MeshDistanceMaterial();
    for (const m of [material, depth, distance]) patchMaterial(m);
    mesh.geometry = geometry; mesh.material = material;
    mesh.customDepthMaterial = depth; mesh.customDistanceMaterial = distance;
    // Existing near-tree batches explicitly disable frustum culling. Preserve
    // original CPU bounds/raycast geometry for gameplay, not GPU deformed picks.
    return { mesh, original, geometry, roots, foliage, material, depth, distance };
  }
  const bindings = new Map<InstancedMesh, ReturnType<typeof bind>>();
  let selected = new Set<string>();
  let disposed = false;
  return {
    uniforms,
    begin(world: Pick<World, "tiles">) {
      const sites = selectPondTrees(world);
      selected = new Set(sites.map(([x, z]) => `${x},${z}`));
      for (const b of bindings.values()) { b.roots.array.fill(0); b.foliage.array.fill(0); }
      return sites;
    },
    setRoot(mesh: InstancedMesh | null | undefined, slot: number, x: number, y: number, z: number, foliage = false) {
      if (disposed || !mesh || x < 244 || x > 256 || z < 300 || z > 312 || !selected.has(`${x},${z}`)) return;
      let b = bindings.get(mesh);
      if (!b) { b = bind(mesh); bindings.set(mesh, b); }
      b.roots.setXYZW(slot, x, y, z, 1);
      b.foliage.setX(slot, foliage ? 1 : 0);
    },
    flush() { for (const b of bindings.values()) { b.roots.needsUpdate = true; b.foliage.needsUpdate = true; } },
    update(delta: number) {
      if (!disposed && bindings.size && Number.isFinite(delta)) {
        const step = Math.max(0, Math.min(delta, 0.05));
        uniforms.uTreeWindTime.value += step;
        uniforms.uLeafFlutterTime.value += step;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const b of bindings.values()) {
        b.mesh.geometry = b.original.geometry; b.mesh.material = b.original.material;
        b.mesh.customDepthMaterial = b.original.depth; b.mesh.customDistanceMaterial = b.original.distance;
        b.geometry.dispose(); b.material.dispose(); b.depth.dispose(); b.distance.dispose();
      }
      bindings.clear();
    },
  };
}
