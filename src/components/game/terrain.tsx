import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import { COURT, MAP, VIEW } from "@/game/atlas";
import { biomeAt } from "@/game/biome";
import { buildingBox } from "@/game/building-size";
import { GROUND_SHADER, makeDirtTex, makeGrassTex } from "@/game/ground-tex";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { hash2 } from "@/game/rng";
import { useGame } from "@/game/store";
import { leftAt, hitAt, hoverAt, liftAt } from "@/game/world-pointer";
import type { TileKind, World } from "@/game/types";

const KIND_COLOR: Record<TileKind, string> = {
  grass: "#4a5a32",
  dirt: "#6a5438",
  cobble: "#6e685c",
  road: "#8a7050",
  tree: "#3f5230",
  rock: "#5a584c",
  water: "#3a4a58",
  sand: "#c4b48a",
  floor: "#5a4a3a",
  wall: "#4a4640",
  step: "#7a6a58",
  pit: "#1a1612",
  snow: "#d8d2c6",
  marsh: "#3a4a36",
};

const COVER: Record<TileKind, [number, number, number]> = {
  grass: [1, 0.12, 0],
  tree: [0.92, 0.18, 0.05],
  rock: [0.4, 0.3, 0.45],
  dirt: [0.22, 0.88, 0.04],
  road: [0.12, 0.55, 0.4],
  step: [0.1, 0.4, 0.5],
  cobble: [0.04, 0.18, 0.9],
  floor: [0.02, 0.2, 0.85],
  wall: [0, 0.1, 0.7],
  sand: [0.12, 0.7, 0.18],
  water: [0, 0, 0],
  pit: [0, 0, 0],
  snow: [0.08, 0.06, 0.04],
  marsh: [0.55, 0.5, 0.08],
};

const SEGS = VIEW * 2;
const VERTS = SEGS + 1;
const VERT_COUNT = VERTS * VERTS;
const STEP = VIEW / SEGS;
const TRUNK_H = 2.1;
const CANOPY_H = 2.5;
const CANOPY_R = 1.15;
const UNDER = 1.45;
const dummy = new THREE.Object3D();
const pal = new THREE.Color();
const COL_TRUNK = new THREE.Color("#5a3e28");
const COL_CANOPY = new THREE.Color("#3d4e2c");
const COL_CANOPY_COLD = new THREE.Color("#5a6458");
const COL_CANOPY_FEN = new THREE.Color("#2c3a26");
const COL_CANOPY_DRY = new THREE.Color("#6a6a40");
const COL_CANOPY_PINE = new THREE.Color("#2f3e2c");
const COL_CANOPY_JUNGLE = new THREE.Color("#244028");
const COL_GROUND_TAIGA = new THREE.Color("#3a4634");
const COL_GROUND_JUNGLE = new THREE.Color("#2a4228");
const COL_ROCK = new THREE.Color("#7a7268");
const COL_ROCK_2 = new THREE.Color("#5c574e");
const COL_ROCK_3 = new THREE.Color("#8a8478");
const COL_MARK = new THREE.Color("#e0b56a");
const COL_MARK_WOOD = new THREE.Color("#c48a4a");
const COL_SHRUB = new THREE.Color("#354626");
const COL_SHRUB_2 = new THREE.Color("#4a5a32");
const COL_THORN = new THREE.Color("#6a5a38");
const COL_FLOWER_RUST = new THREE.Color("#a85a42");
const COL_FLOWER_GOLD = new THREE.Color("#c9a36a");
const COL_FLOWER_PALE = new THREE.Color("#ece6d8");
const COL_SAPLING = new THREE.Color("#4d6234");
const COL_TUFT = new THREE.Color("#5a6a38");
const FLORA = 400;

function blocked(world: World, tx: number, ty: number) {
  if (world.plots) {
    for (const p of world.plots) if (p.tx === tx && p.ty === ty) return true;
  }
  for (const b of world.buildings) {
    const box = buildingBox(b.kind, b.tx, b.ty);
    if (tx + 0.5 > box.x0 && tx + 0.5 < box.x1 && ty + 0.5 > box.z0 && ty + 0.5 < box.z1) return true;
  }
  return false;
}

function treeGrow(tx: number, ty: number) {
  return 0.86 + ((tx * 13 + ty * 7) % 11) * 0.038;
}

function hideRest(mesh: THREE.InstancedMesh | null, from: number, total: number) {
  if (!mesh) return;
  for (let i = from; i < total; i++) {
    dummy.position.set(0, -40, 0);
    dummy.scale.set(0.01, 0.01, 0.01);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

function ensureColor(mesh: THREE.InstancedMesh | null, n: number) {
  if (!mesh) return;
  if (!mesh.instanceColor || mesh.instanceColor.count !== n) {
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  }
}

function paint(mesh: THREE.InstancedMesh | null, i: number, c: THREE.Color) {
  if (!mesh) return;
  mesh.setColorAt(i, c);
}
const c00 = new THREE.Color();
const c10 = new THREE.Color();
const c01 = new THREE.Color();
const c11 = new THREE.Color();
const tmp = new THREE.Color();

function kindAt(world: World, tx: number, ty: number): TileKind {
  return world.tiles[ty]?.[tx]?.kind ?? "grass";
}

function colorAt(world: World, x: number, z: number, out: THREE.Color) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  c00.set(KIND_COLOR[kindAt(world, x0, z0)]);
  c10.set(KIND_COLOR[kindAt(world, x0 + 1, z0)]);
  c01.set(KIND_COLOR[kindAt(world, x0, z0 + 1)]);
  c11.set(KIND_COLOR[kindAt(world, x0 + 1, z0 + 1)]);
  out.copy(c00).lerp(c10, fx);
  tmp.copy(c01).lerp(c11, fx);
  out.lerp(tmp, fz);
  const climate = biomeAt(x, z);
  if (climate === "jungle") out.lerp(COL_GROUND_JUNGLE, 0.42);
  else if (climate === "taiga") out.lerp(COL_GROUND_TAIGA, 0.38);
}

function coverAt(world: World, x: number, z: number, dest: Float32Array, i: number) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const a = COVER[kindAt(world, x0, z0)];
  const b = COVER[kindAt(world, x0 + 1, z0)];
  const c = COVER[kindAt(world, x0, z0 + 1)];
  const d = COVER[kindAt(world, x0 + 1, z0 + 1)];
  const sx0 = a[0] + (b[0] - a[0]) * fx;
  const sx1 = c[0] + (d[0] - c[0]) * fx;
  const sy0 = a[1] + (b[1] - a[1]) * fx;
  const sy1 = c[1] + (d[1] - c[1]) * fx;
  const sz0 = a[2] + (b[2] - a[2]) * fx;
  const sz1 = c[2] + (d[2] - c[2]) * fx;
  dest[i] = sx0 + (sx1 - sx0) * fz;
  dest[i + 1] = sy0 + (sy1 - sy0) * fz;
  dest[i + 2] = sz0 + (sz1 - sz0) * fz;
}

function GroundMaterial() {
  const maps = useMemo(() => ({ grass: makeGrassTex(), dirt: makeDirtTex() }), []);
  return (
    <meshStandardMaterial
      vertexColors
      map={maps.grass}
      roughness={0.96}
      metalness={0.02}
      customProgramCacheKey={() => "vale-ground-v2"}
      onBeforeCompile={(shader) => {
        shader.uniforms.uDirt = { value: maps.dirt };
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            `#include <common>
attribute vec3 cover;
varying vec3 vCover;
varying vec3 vWp;`,
          )
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
vCover = cover;
vWp = transformed;`,
          );
        shader.fragmentShader = GROUND_SHADER + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `
vec2 wuv = vWp.xz * 0.29 + 0.14 * vec2(fbm(vWp.xz * 0.33), fbm(vWp.xz * 0.33 + 9.0));
vec4 sampledDiffuseColor = texture2D(map, wuv);
vec3 dirt = texture2D(uDirt, wuv * 0.71 + 0.17).rgb;
float n = fbm(vWp.xz * 0.19);
float n2 = fbm(vWp.xz * 0.73 + 4.0);
vec3 nature = mix(sampledDiffuseColor.rgb, dirt, clamp(vCover.y, 0.0, 1.0) * 0.82);
nature = mix(nature, vec3(0.42, 0.40, 0.36), clamp(vCover.z, 0.0, 1.0) * 0.7);
nature *= 0.78 + n * 0.34 + n2 * 0.12;
float living = clamp(vCover.x + vCover.y, 0.0, 1.0);
sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb * 0.35 + diffuseColor.rgb * 0.7, nature, living);
diffuseColor *= sampledDiffuseColor;
`,
        );
      }}
    />
  );
}

export function Terrain() {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const trunksGhost = useRef<THREE.InstancedMesh>(null);
  const canopy = useRef<THREE.InstancedMesh>(null);
  const canopyGhost = useRef<THREE.InstancedMesh>(null);
  const rocks = useRef<THREE.InstancedMesh>(null);
  const shrubs = useRef<THREE.InstancedMesh>(null);
  const flowers = useRef<THREE.InstancedMesh>(null);
  const saplings = useRef<THREE.InstancedMesh>(null);
  const tufts = useRef<THREE.InstancedMesh>(null);
  const solidAt = useRef<{ tx: number; ty: number }[]>([]);
  const ghostAt = useRef<{ tx: number; ty: number }[]>([]);
  const rockAt = useRef<{ tx: number; ty: number }[]>([]);
  const origin = useRef({ x: COURT.tx, z: COURT.ty, rev: -1 });
  const count = VIEW * VIEW;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(VERT_COUNT * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(VERT_COUNT * 3), 3));
    g.setAttribute("cover", new THREE.BufferAttribute(new Float32Array(VERT_COUNT * 3), 3));
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(VERT_COUNT * 3), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(VERT_COUNT * 2), 2));
    const index: number[] = [];
    for (let j = 0; j < SEGS; j++) {
      for (let i = 0; i < SEGS; i++) {
        const a = j * VERTS + i;
        const b = a + 1;
        const c = a + VERTS;
        const d = c + 1;
        index.push(a, c, b, b, c, d);
      }
    }
    g.setIndex(index);
    return g;
  }, []);

  useFrame(() => {
    const w = getWorld();
    const you = w.people.find((p) => p.isPlayer);
    const ox = Math.round(you?.x ?? COURT.tx);
    const oz = Math.round(you?.z ?? COURT.ty);
    const rev = w.landRev ?? 0;
    const half = Math.floor(VIEW / 2);
    const tk = trunks.current;
    const tkg = trunksGhost.current;
    const cn = canopy.current;
    const gh = canopyGhost.current;
    const rk = rocks.current;
    const shb = shrubs.current;
    const flw = flowers.current;
    const sap = saplings.current;
    const tft = tufts.current;
    ensureColor(tk, count);
    ensureColor(tkg, count);
    ensureColor(cn, count);
    ensureColor(gh, count);
    ensureColor(rk, count);
    ensureColor(shb, FLORA);
    ensureColor(flw, FLORA);
    ensureColor(sap, FLORA);
    ensureColor(tft, FLORA);
    if (origin.current.x !== ox || origin.current.z !== oz || origin.current.rev !== rev) {
      origin.current = { x: ox, z: oz, rev };
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const col = geo.attributes.color as THREE.BufferAttribute;
      const cov = geo.attributes.cover as THREE.BufferAttribute;
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const car = col.array as Float32Array;
      const karr = cov.array as Float32Array;
      const uarr = uv.array as Float32Array;
      for (let iz = 0; iz < VERTS; iz++) {
        for (let ix = 0; ix < VERTS; ix++) {
          const wx = ox - half + ix * STEP;
          const wz = oz - half + iz * STEP;
          const i = (iz * VERTS + ix) * 3;
          const t = w.tiles[Math.round(wz)]?.[Math.round(wx)];
          arr[i] = wx;
          arr[i + 1] = t ? groundY(w, wx, wz) : -2;
          arr[i + 2] = wz;
          colorAt(w, wx, wz, pal);
          car[i] = pal.r;
          car[i + 1] = pal.g;
          car[i + 2] = pal.b;
          coverAt(w, wx, wz, karr, i);
          const ui = (iz * VERTS + ix) * 2;
          uarr[ui] = wx * 0.29;
          uarr[ui + 1] = wz * 0.29;
        }
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
      cov.needsUpdate = true;
      uv.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
    }
    let si = 0;
    let gi = 0;
    let ri = 0;
    let shi = 0;
    let fli = 0;
    let sai = 0;
    let tui = 0;
    const px = you?.x ?? ox;
    const pz = you?.z ?? oz;
    for (let iz = 0; iz < VIEW; iz++) {
      for (let ix = 0; ix < VIEW; ix++) {
        const tx = ox - half + ix;
        const ty = oz - half + iz;
        if (tx < 0 || ty < 0 || tx >= MAP || ty >= MAP) continue;
        const t = w.tiles[ty]![tx]!;
        if (t.kind === "tree") {
          const grow = treeGrow(tx, ty);
          const gy = groundY(w, tx, ty);
          const climate = biomeAt(tx, ty);
          const gx = climate === "taiga" ? grow * 0.58 : climate === "jungle" ? grow * 1.28 : grow;
          const gsy = climate === "taiga" ? grow * 1.48 : climate === "jungle" ? grow * 0.92 : grow;
          const trunkH = TRUNK_H * gsy;
          const under =
            Math.hypot(tx - px, ty - pz) < UNDER * (climate === "jungle" ? 1.25 : 1) * Math.min(1.15, grow);
          const marked = w.player.intent.kind === "chop" && w.player.intent.tx === tx && w.player.intent.ty === ty;
          const strike = marked && !you?.path.length;
          const wobble = strike ? Math.sin(w.player.workT * 28) * 0.1 : 0;
          dummy.rotation.set(0, 0, wobble);
          dummy.position.set(tx, gy + trunkH * 0.5, ty);
          dummy.scale.set(gx, gsy, gx);
          dummy.updateMatrix();
          const trunkCol = marked ? COL_MARK_WOOD : COL_TRUNK;
          const leafCol = marked
            ? COL_MARK
            : climate === "tundra"
              ? COL_CANOPY_COLD
              : climate === "taiga"
                ? COL_CANOPY_PINE
                : climate === "fen"
                  ? COL_CANOPY_FEN
                  : climate === "desert"
                    ? COL_CANOPY_DRY
                    : climate === "jungle"
                      ? COL_CANOPY_JUNGLE
                      : COL_CANOPY;
          if (under) {
            tkg?.setMatrixAt(gi, dummy.matrix);
            paint(tkg, gi, trunkCol);
          } else {
            tk?.setMatrixAt(si, dummy.matrix);
            paint(tk, si, trunkCol);
          }
          dummy.position.set(tx, gy + trunkH + CANOPY_H * gsy * (climate === "jungle" ? 0.28 : 0.38), ty);
          dummy.scale.set(climate === "jungle" ? gx * 1.12 : gx, gsy, climate === "jungle" ? gx * 1.12 : gx);
          dummy.rotation.set(wobble * 0.6, 0, wobble);
          dummy.updateMatrix();
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          if (under) {
            gh?.setMatrixAt(gi, dummy.matrix);
            paint(gh, gi, leafCol);
            ghostAt.current[gi] = { tx, ty };
            gi++;
          } else {
            cn?.setMatrixAt(si, dummy.matrix);
            paint(cn, si, leafCol);
            solidAt.current[si] = { tx, ty };
            si++;
          }
        }
        if (t.kind === "rock" && rk) {
          const marked = w.player.intent.kind === "mine" && w.player.intent.tx === tx && w.player.intent.ty === ty;
          const strike = marked && !you?.path.length;
          const szRoll = hash2(tx, ty, w.seed + 23);
          const yaw = hash2(tx, ty, w.seed + 29) * Math.PI * 2;
          let sx: number;
          let sy: number;
          let sz: number;
          if (szRoll < 0.4) {
            const k = szRoll / 0.4;
            sx = 0.22 + k * 0.28;
            sy = 0.14 + k * 0.18;
            sz = 0.2 + k * 0.26;
          } else if (szRoll < 0.82) {
            const k = (szRoll - 0.4) / 0.42;
            sx = 0.52 + k * 0.38;
            sy = 0.34 + k * 0.28;
            sz = 0.48 + k * 0.32;
          } else {
            const k = (szRoll - 0.82) / 0.18;
            sx = 0.95 + k * 0.75;
            sy = 0.72 + k * 0.58;
            sz = 0.88 + k * 0.62;
          }
          dummy.rotation.set(strike ? Math.sin(w.player.workT * 32) * 0.08 : 0, yaw, strike ? 0.05 : 0);
          dummy.position.set(tx, groundY(w, tx, ty) + 0.42 * sy * 0.55, ty);
          dummy.scale.set(sx, sy, sz);
          dummy.updateMatrix();
          dummy.rotation.set(0, 0, 0);
          rk.setMatrixAt(ri, dummy.matrix);
          const tint = hash2(tx, ty, w.seed + 31);
          paint(rk, ri, marked ? COL_MARK : tint < 0.33 ? COL_ROCK : tint < 0.66 ? COL_ROCK_2 : COL_ROCK_3);
          rockAt.current[ri] = { tx, ty };
          ri++;
        }
        const wooded = t.kind === "tree";
        const open = t.kind === "grass" || t.kind === "sand" || t.kind === "snow" || t.kind === "marsh";
        if ((wooded || open) && !blocked(w, tx, ty)) {
          const climate = biomeAt(tx, ty);
          const roll = hash2(tx, ty, w.seed + 41);
          let flora = -1;
          if (wooded) flora = hash2(tx, ty, w.seed + 51) < (climate === "tundra" ? 0.08 : climate === "taiga" ? 0.1 : 0.14) ? 0 : -1;
          else if (climate === "tundra") flora = roll < 0.012 ? 3 : -1;
          else if (climate === "taiga") flora = roll < 0.016 ? 0 : roll < 0.022 ? 3 : -1;
          else if (climate === "fen") flora = roll < 0.028 ? 3 : roll < 0.034 ? 0 : -1;
          else if (climate === "jungle") flora = roll < 0.018 ? 0 : roll < 0.03 ? 2 : roll < 0.04 ? 1 : roll < 0.05 ? 3 : -1;
          else if (climate === "desert" || t.kind === "sand") flora = roll < 0.01 ? 0 : -1;
          else if (roll < 0.011) flora = 0;
          else if (roll < 0.019) flora = 1;
          else if (roll < 0.025) flora = 2;
          else if (roll < 0.031) flora = 3;
          if (flora >= 0) {
            const gy = groundY(w, tx, ty);
            const jx = (hash2(tx, ty, w.seed + 71) - 0.5) * (wooded ? 0.72 : 0.52);
            const jz = (hash2(tx, ty, w.seed + 91) - 0.5) * (wooded ? 0.72 : 0.52);
            const grow = 0.72 + hash2(tx, ty, w.seed + 5) * 0.5;
            dummy.rotation.set(0, hash2(tx, ty, w.seed + 8) * Math.PI * 2, 0);
            if (flora === 0 && shi < FLORA && shb) {
              dummy.position.set(tx + jx, gy + 0.22 * grow, ty + jz);
              dummy.scale.set(grow, grow, grow);
              dummy.updateMatrix();
              shb.setMatrixAt(shi, dummy.matrix);
              paint(shb, shi, climate === "desert" ? COL_THORN : hash2(tx, ty, w.seed + 3) > 0.5 ? COL_SHRUB_2 : COL_SHRUB);
              shi++;
            } else if (flora === 1 && fli < FLORA && flw) {
              dummy.position.set(tx + jx, gy + 0.14, ty + jz);
              dummy.scale.set(grow * 0.9, grow * 0.9, grow * 0.9);
              dummy.updateMatrix();
              const hue = hash2(tx, ty, w.seed + 11);
              paint(flw, fli, hue < 0.34 ? COL_FLOWER_RUST : hue < 0.67 ? COL_FLOWER_GOLD : COL_FLOWER_PALE);
              flw.setMatrixAt(fli, dummy.matrix);
              fli++;
            } else if (flora === 2 && sai < FLORA && sap) {
              dummy.position.set(tx + jx, gy + 0.52 * grow, ty + jz);
              dummy.scale.set(grow, grow, grow);
              dummy.updateMatrix();
              sap.setMatrixAt(sai, dummy.matrix);
              paint(sap, sai, COL_SAPLING);
              sai++;
            } else if (flora === 3 && tui < FLORA && tft) {
              dummy.position.set(tx + jx, gy + 0.16 * grow, ty + jz);
              dummy.scale.set(grow * 0.85, grow, grow * 0.85);
              dummy.updateMatrix();
              tft.setMatrixAt(tui, dummy.matrix);
              paint(tft, tui, COL_TUFT);
              tui++;
            }
            dummy.rotation.set(0, 0, 0);
          }
        }
      }
    }
    hideRest(tk, si, count);
    hideRest(tkg, gi, count);
    hideRest(cn, si, count);
    hideRest(gh, gi, count);
    hideRest(rk, ri, count);
    hideRest(shb, shi, FLORA);
    hideRest(flw, fli, FLORA);
    hideRest(sap, sai, FLORA);
    hideRest(tft, tui, FLORA);
    if (tk?.instanceColor) tk.instanceColor.needsUpdate = true;
    if (tkg?.instanceColor) tkg.instanceColor.needsUpdate = true;
    if (cn?.instanceColor) cn.instanceColor.needsUpdate = true;
    if (gh?.instanceColor) gh.instanceColor.needsUpdate = true;
    if (rk?.instanceColor) rk.instanceColor.needsUpdate = true;
    if (shb?.instanceColor) shb.instanceColor.needsUpdate = true;
    if (flw?.instanceColor) flw.instanceColor.needsUpdate = true;
    if (sap?.instanceColor) sap.instanceColor.needsUpdate = true;
    if (tft?.instanceColor) tft.instanceColor.needsUpdate = true;
  });

  function fromEvent(e: ThreeEvent<PointerEvent>) {
    return { tx: Math.round(e.point.x), ty: Math.round(e.point.z) };
  }

  function tileOf(e: ThreeEvent<PointerEvent>, map?: MutableRefObject<{ tx: number; ty: number }[]>) {
    const mapped = map && e.instanceId != null ? map.current[e.instanceId] : null;
    return mapped ?? fromEvent(e);
  }

  function onDown(e: ThreeEvent<PointerEvent>, map?: MutableRefObject<{ tx: number; ty: number }[]>) {
    e.stopPropagation();
    const t = tileOf(e, map);
    if (e.button === 2) hitAt(t.tx, t.ty, e.clientX, e.clientY);
    else if (e.button === 0 && useGame.getState().phase === "playing") leftAt(t.tx, t.ty);
  }

  function onMove(e: ThreeEvent<PointerEvent>, map?: MutableRefObject<{ tx: number; ty: number }[]>) {
    if (!useGame.getState().buildKind) return;
    const t = tileOf(e, map);
    hoverAt(t.tx, t.ty);
  }

  function onUp(e: ThreeEvent<PointerEvent>, map?: MutableRefObject<{ tx: number; ty: number }[]>) {
    if (e.button !== 0) return;
    if (!useGame.getState().buildKind) return;
    e.stopPropagation();
    const t = tileOf(e, map);
    liftAt(t.tx, t.ty);
  }

  function pickMap(map: MutableRefObject<{ tx: number; ty: number }[]>) {
    return {
      onPointerDown: (e: ThreeEvent<PointerEvent>) => onDown(e, map),
      onPointerMove: (e: ThreeEvent<PointerEvent>) => onMove(e, map),
      onPointerUp: (e: ThreeEvent<PointerEvent>) => onUp(e, map),
    };
  }

  return (
    <group>
      <mesh
        geometry={geo}
        castShadow
        receiveShadow
        frustumCulled={false}
        onPointerDown={(e) => onDown(e)}
        onPointerMove={(e) => onMove(e)}
        onPointerUp={(e) => onUp(e)}
      >
        <GroundMaterial />
      </mesh>
      <instancedMesh
        ref={trunks}
        args={[undefined, undefined, count]}
        castShadow
        frustumCulled={false}
        {...pickMap(solidAt)}
      >
        <cylinderGeometry args={[0.1, 0.14, TRUNK_H, 5]} />
        <meshStandardMaterial color="#ffffff" roughness={0.94} />
      </instancedMesh>
      <instancedMesh
        ref={canopy}
        args={[undefined, undefined, count]}
        castShadow
        frustumCulled={false}
        {...pickMap(solidAt)}
      >
        <coneGeometry args={[CANOPY_R, CANOPY_H, 5]} />
        <meshStandardMaterial color="#ffffff" roughness={0.95} />
      </instancedMesh>
      <instancedMesh
        ref={trunksGhost}
        args={[undefined, undefined, count]}
        frustumCulled={false}
        {...pickMap(ghostAt)}
      >
        <cylinderGeometry args={[0.1, 0.14, TRUNK_H, 5]} />
        <meshStandardMaterial color="#ffffff" roughness={0.94} transparent opacity={0.2} depthWrite={false} />
      </instancedMesh>
      <instancedMesh
        ref={canopyGhost}
        args={[undefined, undefined, count]}
        frustumCulled={false}
        {...pickMap(ghostAt)}
      >
        <coneGeometry args={[CANOPY_R, CANOPY_H, 5]} />
        <meshStandardMaterial color="#ffffff" roughness={0.95} transparent opacity={0.2} depthWrite={false} />
      </instancedMesh>
      <instancedMesh
        ref={rocks}
        args={[undefined, undefined, count]}
        castShadow
        frustumCulled={false}
        {...pickMap(rockAt)}
      >
        <dodecahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={shrubs} args={[undefined, undefined, FLORA]} castShadow frustumCulled={false} raycast={() => {}}>
        <boxGeometry args={[0.42, 0.4, 0.36]} />
        <meshStandardMaterial color="#ffffff" roughness={0.96} />
      </instancedMesh>
      <instancedMesh ref={flowers} args={[undefined, undefined, FLORA]} frustumCulled={false} raycast={() => {}}>
        <boxGeometry args={[0.14, 0.1, 0.14]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={saplings} args={[undefined, undefined, FLORA]} castShadow frustumCulled={false} raycast={() => {}}>
        <coneGeometry args={[0.32, 1.05, 4]} />
        <meshStandardMaterial color="#ffffff" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={tufts} args={[undefined, undefined, FLORA]} frustumCulled={false} raycast={() => {}}>
        <boxGeometry args={[0.1, 0.32, 0.1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.96} />
      </instancedMesh>
    </group>
  );
}

const HORIZON = 400;
const HSEGS = 50;
const HVERTS = HSEGS + 1;
const HCOUNT = HVERTS * HVERTS;
const HSTEP = HORIZON / HSEGS;
const INNER = VIEW / 2 - 2;
const FAR_TREES = 1600;
const FAR_STEP = 3;
const COL_FAR = new THREE.Color("#2a3828");

export function Horizon() {
  const far = useRef<THREE.InstancedMesh>(null);
  const origin = useRef({ x: COURT.tx, z: COURT.ty, rev: -1 });
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(HCOUNT * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(HCOUNT * 3), 3));
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(HCOUNT * 3), 3));
    const index: number[] = [];
    for (let j = 0; j < HSEGS; j++) {
      for (let i = 0; i < HSEGS; i++) {
        const a = j * HVERTS + i;
        const b = a + 1;
        const c = a + HVERTS;
        const d = c + 1;
        index.push(a, c, b, b, c, d);
      }
    }
    g.setIndex(index);
    return g;
  }, []);

  useFrame(() => {
    const w = getWorld();
    const you = w.people.find((p) => p.isPlayer);
    const ox = Math.round(you?.x ?? COURT.tx);
    const oz = Math.round(you?.z ?? COURT.ty);
    const rev = w.landRev ?? 0;
    if (origin.current.x === ox && origin.current.z === oz && origin.current.rev === rev) return;
    origin.current = { x: ox, z: oz, rev };
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = geo.attributes.color as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const car = col.array as Float32Array;
    const half = HORIZON / 2;
    for (let iz = 0; iz < HVERTS; iz++) {
      for (let ix = 0; ix < HVERTS; ix++) {
        const wx = ox - half + ix * HSTEP;
        const wz = oz - half + iz * HSTEP;
        const i = (iz * HVERTS + ix) * 3;
        const hole = Math.abs(wx - ox) < INNER && Math.abs(wz - oz) < INNER;
        const off = wx < 0 || wz < 0 || wx >= MAP || wz >= MAP;
        const dist = Math.hypot(wx - ox, wz - oz);
        const lift = 1 + Math.max(0, dist - 50) / 320 * 0.5;
        arr[i] = wx;
        arr[i + 1] = hole || off ? -8 : groundY(w, wx, wz) * lift - 0.08;
        arr[i + 2] = wz;
        if (off) pal.set("#1a1c18");
        else {
          colorAt(w, wx, wz, pal);
          pal.multiplyScalar(0.88);
        }
        car[i] = pal.r;
        car[i + 1] = pal.g;
        car[i + 2] = pal.b;
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const mesh = far.current;
    ensureColor(mesh, FAR_TREES);
    let fi = 0;
    if (mesh) {
      for (let ty = oz - half; ty <= oz + half && fi < FAR_TREES; ty += FAR_STEP) {
        for (let tx = ox - half; tx <= ox + half && fi < FAR_TREES; tx += FAR_STEP) {
          if (tx < 0 || ty < 0 || tx >= MAP || ty >= MAP) continue;
          const d = Math.hypot(tx - ox, ty - oz);
          if (d < INNER + 4) continue;
          if (w.tiles[ty]?.[tx]?.kind !== "tree") continue;
          const grow = 0.7 + hash2(tx, ty, w.seed + 5) * 0.55;
          dummy.position.set(
            tx,
            groundY(w, tx, ty) * (1 + Math.max(0, d - 50) / 320 * 0.5) + CANOPY_H * grow * 0.42,
            ty,
          );
          dummy.scale.set(grow * 1.05, grow * 1.15, grow * 1.05);
          dummy.updateMatrix();
          mesh.setMatrixAt(fi, dummy.matrix);
          paint(mesh, fi, COL_FAR);
          fi++;
        }
      }
    }
    hideRest(mesh, fi, FAR_TREES);
    if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <mesh geometry={geo} frustumCulled={false} raycast={() => {}}>
        <meshStandardMaterial vertexColors roughness={0.98} metalness={0.02} />
      </mesh>
      <instancedMesh ref={far} args={[undefined, undefined, FAR_TREES]} frustumCulled={false} raycast={() => {}}>
        <coneGeometry args={[1.05, 2.4, 4]} />
        <meshStandardMaterial color="#ffffff" roughness={0.96} />
      </instancedMesh>
    </group>
  );
}
