import { Box3, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedBufferAttribute, InstancedMesh, MeshStandardMaterial, Object3D, Sphere, Vector3 } from "three";
import { BUILD_SIZE, VOX } from "../../game/building-size.ts";
import { PLACEABLE_BY_ID } from "../../game/placeables/catalog.ts";
import { groundY } from "../../game/height.ts";
import { hash2 } from "../../game/rng.ts";
import type { World } from "../../game/types.ts";

// A small south/west crescent, never the bank or northern approach. These are
// bilinear cells, not tile centers: all FOUR terrain samples must remain grass.
export const POND_GRASS_CELLS = [
  [247, 308], [248, 308], [249, 308], [250, 308], [251, 308], [252, 308], [253, 308],
  [248, 309], [249, 309], [250, 309], [251, 309], [252, 309],
  [246, 303], [246, 304], [246, 305], [246, 306], [246, 307],
  [245, 304], [245, 305], [245, 306],
] as const;
const CLUMPS = [[0.25, 0.25], [0.72, 0.28], [0.49, 0.5], [0.28, 0.75], [0.74, 0.74]] as const;
const BLADES = 9;
export const POND_GRASS_CAPACITY = POND_GRASS_CELLS.length * CLUMPS.length * BLADES;
const POINT_OCCUPANTS = ["plots", "herbs", "saplings", "campfires", "piles"] as const;

function clearBox(mask: number, x0: number, z0: number, x1: number, z1: number) {
  // Conservative 0.3-unit breathing room also covers the moving blade tips.
  if (x1 < 244.7 || x0 > 254.3 || z1 < 302.7 || z0 > 310.3) return mask;
  for (let i = 0; i < POND_GRASS_CELLS.length; i++) {
    const [x, z] = POND_GRASS_CELLS[i]!;
    if (x + 1 > x0 - 0.3 && x < x1 + 0.3 && z + 1 > z0 - 0.3 && z < z1 + 0.3) mask &= ~(1 << i);
  }
  return mask;
}

/** Local bit mask; no tile-map scan and no allocation. Includes in-place edits. */
function grassMask(w: World) {
  let mask = 0;
  for (let i = 0; i < POND_GRASS_CELLS.length; i++) {
    const [x, z] = POND_GRASS_CELLS[i]!;
    let dry = true;
    for (let dz = 0; dz <= 1; dz++) for (let dx = 0; dx <= 1; dx++) {
      const tile = w.tiles[z + dz]?.[x + dx];
      if (tile?.kind !== "grass" || !Number.isFinite(tile.h) || tile.h <= 0) dry = false;
    }
    if (dry) mask |= 1 << i;
  }
  for (const key of POINT_OCCUPANTS) for (const p of w[key]) {
    mask = clearBox(mask, p.tx - 0.5, p.ty - 0.5, p.tx + 0.5, p.ty + 0.5);
  }
  for (const b of w.buildings) {
    const s = BUILD_SIZE[b.kind];
    mask = clearBox(mask, b.tx + s.x0 * VOX, b.ty + s.z0 * VOX, b.tx + (s.x1 + 1) * VOX, b.ty + (s.z1 + 1) * VOX);
  }
  for (const p of w.placedObjects) {
    const f = PLACEABLE_BY_ID[p.definitionId]?.footprint;
    // Unknown legacy definitions still reserve their anchor, never grow through them.
    if (!f) { mask = clearBox(mask, p.tx - 0.5, p.ty - 0.5, p.tx + 0.5, p.ty + 0.5); continue; }
    let x0 = f.x0, x1 = f.x1, z0 = f.z0, z1 = f.z1;
    if (p.rotation === 1) { x0 = f.z0; x1 = f.z1; z0 = -f.x1; z1 = -f.x0; }
    else if (p.rotation === 2) { x0 = -f.x1; x1 = -f.x0; z0 = -f.z1; z1 = -f.z0; }
    else if (p.rotation === 3) { x0 = -f.z1; x1 = -f.z0; z0 = f.x0; z1 = f.x1; }
    mask = clearBox(mask, p.tx + x0 * VOX, p.ty + z0 * VOX, p.tx + (x1 + 1) * VOX, p.ty + (z1 + 1) * VOX);
  }
  return mask;
}

type GrassBlade = { x: number; y: number; z: number; height: number; yaw: number; phase: number; tint: number };
export function buildPondGrassInstances(w: World, mask = grassMask(w)): GrassBlade[] {
  const result: GrassBlade[] = [];
  for (let i = 0; i < POND_GRASS_CELLS.length; i++) {
    if (!(mask & (1 << i))) continue;
    const [tx, tz] = POND_GRASS_CELLS[i]!;
    for (let clump = 0; clump < CLUMPS.length; clump++) {
      const [cx, cz] = CLUMPS[clump]!;
      const phase = hash2(tx * 7 + clump, tz, w.seed + 823) * Math.PI * 2;
      const jx = (hash2(tx, tz * 7 + clump, w.seed + 827) - 0.5) * 0.12;
      const jz = (hash2(tx, tz * 7 + clump, w.seed + 829) - 0.5) * 0.12;
      for (let blade = 0; blade < BLADES; blade++) {
        const angle = phase + blade * 2.399963;
        const radius = blade === 0 ? 0 : 0.025 + 0.065 * hash2(tx * 53 + blade, tz * 7 + clump, w.seed + 831);
        const x = tx + cx + jx + Math.cos(angle) * radius;
        const z = tz + cz + jz + Math.sin(angle) * radius;
        result.push({ x, z, y: groundY(w, x, z),
          height: 0.34 + hash2(tx * 53 + blade, tz * 7 + clump, w.seed + 839) * 0.24,
          yaw: angle, phase: phase + blade * 0.13,
          tint: 0.88 + hash2(tx, tz * 53 + blade + clump, w.seed + 853) * 0.24,
        });
      }
    }
  }
  return result;
}

/** CPU reference: displacement in normalized blade units (world scale <= 0.58). */
export function grassDisplacement(height: number, time: number, x: number, z: number, phase: number, wind = 1): [number, number] {
  const h = Math.max(0, Math.min(1, height));
  if (h === 0) return [0, 0];
  const bend = h * h * (3 - 2 * h) * Math.max(0, Math.min(1, wind));
  const gust = 0.55 + 0.45 * Math.sin(time * 0.71 - x * 0.43 - z * 0.31);
  return [bend * (0.07 + 0.11 * gust + 0.035 * Math.sin(time * 1.8 + phase)),
    bend * (0.025 + 0.045 * Math.sin(time * 1.13 - x * 0.27 + z * 0.39 + phase))];
}

const GRASS_GLSL = `
// pondGrass: anchored, spatially travelling gusts with independent clump phases.
uniform float uGrassTime;
uniform float uGrassWind;
uniform float uGrassVisibility;
attribute float grassPhase;
vec2 pondGrassWind(vec2 root) {
  float gust = 0.55 + 0.45 * sin(uGrassTime * 0.71 - root.x * 0.43 - root.y * 0.31);
  return clamp(uGrassWind, 0.0, 1.0) * vec2(
    0.07 + 0.11 * gust + 0.035 * sin(uGrassTime * 1.8 + grassPhase),
    0.025 + 0.045 * sin(uGrassTime * 1.13 - root.x * 0.27 + root.y * 0.39 + grassPhase));
}
`;

function bladeGeometry() {
  const geo = new BufferGeometry();
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const dark = new Color("#344825"), light = new Color("#9aaa58"), color = new Color();
  const levels = [0, 0.34, 0.7, 1];
  for (const h of levels) {
    const halfWidth = 0.095 * (1 - h) + 0.025 * Math.sin(h * Math.PI);
    color.copy(dark).lerp(light, h * 0.86);
    for (let edge = -1; edge <= 1; edge++) {
      positions.push(edge * halfWidth + 0.16 * h * h, h, edge === 0 ? 0.022 * Math.sin(h * Math.PI) : 0);
      const shade = edge === -1 ? 0.9 : 1;
      colors.push(color.r * shade, color.g * shade, color.b * shade);
    }
  }
  for (let row = 0; row < 3; row++) for (let side = 0; side < 2; side++) {
    const a = row * 3 + side, b = a + 1, c = a + 3, d = c + 1;
    indices.push(a, b, c, b, d, c);
  }
  geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  // Include maximal curvature + wind in every yaw before instanced bounds union.
  geo.boundingBox = new Box3(new Vector3(-0.45, 0, -0.45), new Vector3(0.45, 1, 0.45));
  geo.boundingSphere = new Sphere(new Vector3(0, 0.5, 0), 0.85);
  return geo;
}

export function createPondGrass() {
  const geometry = bladeGeometry();
  const phases = new InstancedBufferAttribute(new Float32Array(POND_GRASS_CAPACITY), 1);
  geometry.setAttribute("grassPhase", phases);
  const uniforms = { uGrassTime: { value: 0 }, uGrassWind: { value: 1 }, uGrassVisibility: { value: 1 } };
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: DoubleSide });
  material.name = "emberhall-pond-grass";
  material.userData.grassWind = uniforms;
  material.customProgramCacheKey = () => "pondGrass-v1";
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${GRASS_GLSL}`)
      .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
vec2 pondGrassWorldWind = pondGrassWind(instanceMatrix[3].xz);
// Inverse yaw into blade space; instance scaling is uniform, so normals remain valid.
vec2 pondGrassBend = vec2(dot(pondGrassWorldWind, normalize(instanceMatrix[0].xz)), dot(pondGrassWorldWind, normalize(instanceMatrix[2].xz)));
float pondGrassH = clamp(position.y, 0.0, 1.0);
objectNormal.y -= dot(objectNormal.xz, pondGrassBend) * (6.0 * pondGrassH * (1.0 - pondGrassH));`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
transformed.xz += pondGrassBend * smoothstep(0.0, 1.0, pondGrassH);
transformed *= uGrassVisibility;`);
  };
  const mesh = new InstancedMesh(geometry, material, POND_GRASS_CAPACITY);
  mesh.name = "emberhall-pond-grass";
  mesh.count = 0;
  mesh.visible = false;
  mesh.castShadow = false; // Small blades do not need a second deformed depth pass.
  mesh.receiveShadow = true;
  mesh.raycast = () => {};
  mesh.userData.patchBounds = { x0: 245, x1: 254, z0: 303, z1: 310 };
  mesh.userData.maxBlades = POND_GRASS_CAPACITY;
  mesh.userData.mask = 0;
  mesh.userData.rebuilds = 0;
  const dummy = new Object3D(), tint = new Color();
  let previousWorld: World | null = null;
  let previousTiles: World["tiles"] | null = null;
  let previousSeed = -1, previousRev = -1, previousMask = -1;
  let poll = 0;
  let disposed = false;
  return {
    mesh, material, uniforms,
    update(w: World, playerX: number, playerZ: number, delta: number) {
      if (disposed) return;
      const distance = Math.hypot(playerX - 250, playerZ - 306);
      if (distance >= 44) { mesh.visible = false; poll = 0.2; return; }
      const changed = w !== previousWorld || w.tiles !== previousTiles || w.seed !== previousSeed || w.landRev !== previousRev;
      // Occupancy has no canonical revision. A 5 Hz no-allocation mask catches
      // same-array moves/rotations/removals; terrain/world changes are immediate.
      poll += Number.isFinite(delta) ? Math.max(0, Math.min(delta, 0.25)) : 0;
      const mask = changed || poll >= 0.2 ? grassMask(w) : previousMask;
      if (changed || poll >= 0.2) poll = 0;
      if (changed || mask !== previousMask) {
        const blades = buildPondGrassInstances(w, mask);
        mesh.count = blades.length;
        for (let i = 0; i < blades.length; i++) {
          const b = blades[i]!;
          dummy.position.set(b.x, b.y, b.z);
          dummy.rotation.set(0, b.yaw, 0);
          dummy.scale.setScalar(b.height);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          mesh.setColorAt(i, tint.setRGB(b.tint, b.tint, b.tint));
          phases.setX(i, b.phase);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        phases.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.computeBoundingBox();
        mesh.userData.mask = mask;
        mesh.userData.rebuilds++;
        previousWorld = w; previousTiles = w.tiles; previousSeed = w.seed; previousRev = w.landRev; previousMask = mask;
      }
      const fade = Math.max(0, Math.min(1, (distance - 32) / 12));
      uniforms.uGrassVisibility.value = 1 - fade * fade * (3 - 2 * fade);
      mesh.visible = mesh.count > 0;
      if (mesh.visible && Number.isFinite(delta)) uniforms.uGrassTime.value += Math.max(0, Math.min(delta, 0.05));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mesh.visible = false;
      mesh.dispose(); geometry.dispose(); material.dispose();
    },
  };
}
