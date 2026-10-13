import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
} from "three";
import { BUILD_SIZE, VOX } from "../../game/building-size.ts";
import { PLACEABLE_BY_ID } from "../../game/placeables/catalog.ts";
import { groundY } from "../../game/height.ts";
import { hash2 } from "../../game/rng.ts";
import type { World } from "../../game/types.ts";
import { selectPondTrees } from "./pond-tree-sway.ts";

export const POND_AUTUMN_CAPACITY = 24;
const GOLD = new Color("#c69642"),
  RUST = new Color("#b56836");
// Deliberately NOT broadleaf => deciduous. Fantasy timber and evergreen species
// have no seasonal taxonomy; only ordinary oak is opted into this local demo.
export function isPondAutumnSpecies(id: string) {
  return id === "oak";
}

function blocked(w: World, x: number, z: number) {
  // Entire trajectory plus leaf radius lives in this one cell. Reserve a margin
  // around canonical rotated footprints; suppress the source, not just landing.
  const overlaps = (x0: number, z0: number, x1: number, z1: number) =>
    x + 1.15 > x0 && x - 0.15 < x1 && z + 1.15 > z0 && z - 0.15 < z1;
  for (const b of w.buildings) {
    const f = BUILD_SIZE[b.kind];
    if (
      overlaps(
        b.tx + f.x0 * VOX,
        b.ty + f.z0 * VOX,
        b.tx + (f.x1 + 1) * VOX,
        b.ty + (f.z1 + 1) * VOX,
      )
    )
      return true;
  }
  for (const p of w.placedObjects) {
    const f = PLACEABLE_BY_ID[p.definitionId]?.footprint;
    if (!f) {
      if (overlaps(p.tx - 0.5, p.ty - 0.5, p.tx + 0.5, p.ty + 0.5)) return true;
      continue;
    }
    let { x0, x1, z0, z1 } = f;
    if (p.rotation === 1) {
      x0 = f.z0;
      x1 = f.z1;
      z0 = -f.x1;
      z1 = -f.x0;
    } else if (p.rotation === 2) {
      x0 = -f.x1;
      x1 = -f.x0;
      z0 = -f.z1;
      z1 = -f.z0;
    } else if (p.rotation === 3) {
      x0 = -f.z1;
      x1 = -f.z0;
      z0 = f.x0;
      z1 = f.x1;
    }
    if (overlaps(p.tx + x0 * VOX, p.ty + z0 * VOX, p.tx + (x1 + 1) * VOX, p.ty + (z1 + 1) * VOX))
      return true;
  }
  for (let dz = 0; dz <= 1; dz++)
    for (let dx = 0; dx <= 1; dx++) {
      const t = w.tiles[z + dz]?.[x + dx];
      if (
        !t ||
        !Number.isFinite(t.h) ||
        t.h <= 0 ||
        ["floor", "wall", "water", "pit"].includes(t.kind)
      )
        return true;
    }
  return false;
}

const GLSL = `
// pondAutumnLeaves: 24 recycled leaves, independent of world/calendar time.
uniform float uAutumnLeafTime;
uniform float uAutumnLeafVisibility;
attribute vec4 autumnSource;
attribute vec4 autumnGround;
attribute float autumnAlive;
float autumnAge() { return mod(uAutumnLeafTime + autumnSource.w, 14.0); }
mat3 autumnTurn() {
  float a = autumnAge() * 2.3 + autumnSource.w;
  float settle = smoothstep(6.5,8.0,autumnAge());
  float b = mix(sin(autumnAge() * 1.7 + autumnSource.w) * 0.9, 1.5707963, settle);
  return mat3(cos(a),0.,sin(a),0.,1.,0.,-sin(a),0.,cos(a)) * mat3(1.,0.,0.,0.,cos(b),sin(b),0.,-sin(b),cos(b));
}
`;

export function createPondAutumn() {
  const geometry = new BufferGeometry();
  // Small folded pointed leaf, not a billboard or square confetti.
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute([0, 0.1, 0, -0.045, 0, 0, 0, 0, 0.012, 0.045, 0, 0, 0, -0.1, 0], 3),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3, 1, 4, 2, 2, 4, 3]);
  geometry.computeVertexNormals();
  const sources = new InstancedBufferAttribute(new Float32Array(POND_AUTUMN_CAPACITY * 4), 4);
  const grounds = new InstancedBufferAttribute(new Float32Array(POND_AUTUMN_CAPACITY * 4), 4);
  const alive = new InstancedBufferAttribute(new Float32Array(POND_AUTUMN_CAPACITY), 1);
  geometry.setAttribute("autumnSource", sources);
  geometry.setAttribute("autumnGround", grounds);
  geometry.setAttribute("autumnAlive", alive);
  const uniforms = { uAutumnLeafTime: { value: 0 }, uAutumnLeafVisibility: { value: 1 } };
  const material = new MeshStandardMaterial({ roughness: 1, side: DoubleSide });
  material.name = "emberhall-pond-autumn-leaves";
  material.userData.autumn = uniforms;
  material.customProgramCacheKey = () => "pondAutumnLeaves-v1";
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${GLSL}`)
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>\nobjectNormal = autumnTurn() * objectNormal;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
float age = autumnAge();
float progress = clamp(age / 8.0, 0.0, 1.0);
float flight = 1.0 - progress;
vec2 drift = vec2(.24 + .38 * progress, .32 + .26 * progress)
  + vec2(sin(age * 1.3 + autumnSource.w), cos(age * 1.1 + autumnSource.w)) * (.09 * flight);
float floorY = mix(mix(autumnGround.x, autumnGround.y, drift.x), mix(autumnGround.z, autumnGround.w, drift.x), drift.y);
float size = smoothstep(0.0,.5,age) * (1.0-smoothstep(9.0,10.0,age)) * autumnAlive * uAutumnLeafVisibility;
transformed = autumnTurn() * position * size;
transformed += vec3(autumnSource.x + drift.x, mix(floorY + .025, max(autumnSource.y,floorY+.2),flight), autumnSource.z + drift.y);
`,
      );
  };
  const mesh = new InstancedMesh(geometry, material, POND_AUTUMN_CAPACITY);
  mesh.name = "emberhall-pond-autumn-leaves";
  mesh.count = 0;
  mesh.visible = false;
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.autumn = uniforms;
  mesh.userData.maxLeaves = POND_AUTUMN_CAPACITY;
  mesh.userData.patchBounds = { x0: 244, x1: 257, z0: 300, z1: 313 };
  const identity = new Matrix4(),
    tint = new Color(),
    leafTint = new Color();
  for (let i = 0; i < POND_AUTUMN_CAPACITY; i++) mesh.setMatrixAt(i, identity);
  let selected = new Set<string>(),
    disposed = false;
  const registered = new Set<string>();
  return {
    mesh,
    material,
    uniforms,
    begin(w: Pick<World, "tiles">) {
      selected = new Set(selectPondTrees(w).map(([x, z]) => `${x},${z}`));
      registered.clear();
      mesh.count = 0;
    },
    tint(id: string, x: number, z: number, original: Color) {
      if (!isPondAutumnSpecies(id) || !selected.has(`${x},${z}`)) return original;
      return tint.copy(GOLD).lerp(RUST, hash2(x, z, 719));
    },
    crown(w: World, id: string, x: number, y: number, z: number) {
      const key = `${x},${z}`;
      if (
        disposed ||
        !isPondAutumnSpecies(id) ||
        !selected.has(key) ||
        registered.has(key) ||
        mesh.count + 4 > POND_AUTUMN_CAPACITY
      )
        return;
      registered.add(key);
      for (let leaf = 0; leaf < 4; leaf++) {
        const i = mesh.count++;
        sources.setXYZW(i, x, y, z, hash2(x * 7 + leaf, z, w.seed + 947) * 14);
        grounds.setXYZW(
          i,
          groundY(w, x, z),
          groundY(w, x + 1, z),
          groundY(w, x, z + 1),
          groundY(w, x + 1, z + 1),
        );
        mesh.setColorAt(i, leafTint.copy(GOLD).lerp(RUST, hash2(x * 7 + leaf, z, w.seed + 953)));
      }
    },
    flush() {
      sources.needsUpdate = true;
      grounds.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    update(w: World, x: number, z: number, delta: number) {
      if (disposed) return;
      const distance = Math.hypot(x - 250, z - 304);
      mesh.visible = distance < 44 && mesh.count > 0;
      if (!mesh.visible) return;
      uniforms.uAutumnLeafVisibility.value = Math.min(1, Math.max(0, (44 - distance) / 12));
      if (Number.isFinite(delta))
        uniforms.uAutumnLeafTime.value += Math.max(0, Math.min(0.05, delta));
      // Six sources only. Check same-array removal/occupancy every frame; no stale
      // emission after chopping, no growing particle queues or simulation items.
      for (let i = 0; i < mesh.count; i += 4) {
        const tx = sources.getX(i),
          tz = sources.getZ(i);
        const enabled = w.tiles[tz]?.[tx]?.kind === "tree" && !blocked(w, tx, tz);
        for (let j = 0; j < 4; j++) alive.setX(i + j, enabled ? 1 : 0);
      }
      alive.needsUpdate = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mesh.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
