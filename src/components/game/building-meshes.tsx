import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { COURT } from "@/game/atlas";
import { stationOf } from "@/game/craft";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { KEEP_STORY_VOX } from "@/game/keep-story";
import { siteError } from "@/game/building-size";
import { useGame } from "@/game/store";
import { hoverAt, leftAt, liftAt } from "@/game/world-pointer";
import type { Building, BuildingKind } from "@/game/types";

const B = 0.5;
/** Default cube scale. 1.04 fuses faces — only the hut preview uses it. */
const GAP = 0.96;
const FUSE = 1.04;

type Block = "timber" | "dark" | "cobble" | "wool" | "gold" | "glass" | "thatch" | "stone" | "coal" | "soil" | "leaf";

interface Vox {
  x: number;
  y: number;
  z: number;
  t: Block;
  cut?: boolean;
}

interface Spec {
  voxels: Vox[];
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  enterable: boolean;
  fuse?: boolean;
}

const PALETTE: Record<
  Block,
  { color: string; roughness: number; metalness: number; opacity: number; emissive?: string; emissiveIntensity?: number }
> = {
  timber: { color: "#6a4a32", roughness: 0.9, metalness: 0, opacity: 1 },
  dark: { color: "#3a2818", roughness: 0.88, metalness: 0, opacity: 1 },
  cobble: { color: "#7a746c", roughness: 0.92, metalness: 0, opacity: 1 },
  wool: { color: "#a85a42", roughness: 0.78, metalness: 0, opacity: 1 },
  gold: { color: "#c9a36a", roughness: 0.42, metalness: 0.35, opacity: 1 },
  glass: { color: "#ece6d8", roughness: 0.2, metalness: 0.05, opacity: 0.42 },
  thatch: { color: "#8a7048", roughness: 0.94, metalness: 0, opacity: 1 },
  stone: { color: "#9a9286", roughness: 0.9, metalness: 0, opacity: 1 },
  coal: { color: "#141210", roughness: 0.95, metalness: 0, opacity: 1 },
  soil: { color: "#4a3424", roughness: 0.96, metalness: 0, opacity: 1 },
  leaf: { color: "#5a7040", roughness: 0.88, metalness: 0, opacity: 1 },
};

const KINDS = Object.keys(PALETTE) as Block[];

function put(out: Vox[], x: number, y: number, z: number, t: Block) {
  out.push({ x, y, z, t });
}

function fill(
  out: Vox[],
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  t: Block,
  skip?: (x: number, y: number, z: number) => boolean,
) {
  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (skip?.(x, y, z)) continue;
        put(out, x, y, z, t);
      }
    }
  }
}

function key(x: number, y: number, z: number) {
  return `${x},${y},${z}`;
}

function markRoof(out: Vox[], h: number, x0: number, x1: number, z0: number, z1: number) {
  for (const v of out) {
    if (v.y > h) v.cut = true;
    else if (v.z >= z1) v.cut = true;
    else if (v.x >= x1) v.cut = true;
    void z0;
    void x0;
  }
}

function bake(out: Vox[]): Vox[] {
  const m = new Map<string, Vox>();
  for (const v of out) m.set(key(v.x, v.y, v.z), v);
  return [...m.values()];
}

/** Ridge along X, slope in Z — hall silhouette, not a Minecraft pyramid. */
function gableRoof(out: Vox[], x0: number, x1: number, z0: number, z1: number, h: number, t: Block) {
  const ox0 = x0 - 1;
  const ox1 = x1 + 1;
  const oz0 = z0 - 1;
  const oz1 = z1 + 1;
  const steps = Math.max(2, Math.floor((oz1 - oz0) / 2) + 1);
  for (let i = 0; i < steps; i++) {
    const za = oz0 + i;
    const zb = oz1 - i;
    if (za > zb) break;
    fill(out, ox0, h + 1 + i, za, ox1, h + 1 + i, zb, t);
  }
}

function halfTimber(out: Vox[], x0: number, x1: number, z0: number, z1: number, h: number, doorZ: number) {
  const posts: [number, number][] = [
    [x0, z0],
    [x0, z1],
    [x1, z0],
    [x1, z1],
  ];
  if (x1 - x0 >= 6) {
    posts.push([Math.round((x0 + x1) / 2), z0], [Math.round((x0 + x1) / 2), z1]);
  }
  for (const [x, z] of posts) {
    for (let y = 1; y <= h; y++) put(out, x, y, z, "dark");
  }
  for (let x = x0; x <= x1; x++) {
    put(out, x, h, z0, "dark");
    put(out, x, h, z1, "dark");
    put(out, x, 1, z0, "stone");
    if (z1 !== doorZ || x === x0 || x === x1) put(out, x, 1, z1, "stone");
  }
  for (let z = z0; z <= z1; z++) {
    put(out, x0, h, z, "dark");
    put(out, x1, h, z, "dark");
    put(out, x0, 1, z, "stone");
    put(out, x1, 1, z, "stone");
  }
}

function house(opts: {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  h: number;
  wall?: Block;
  roof?: Block;
  base?: Block;
  door?: { x: number; w: number; h: number };
  windows?: { x: number; z: number; w: number; h: number }[];
  chimney?: { x: number; z: number };
  banners?: number[];
}): Spec {
  const out: Vox[] = [];
  const wall = opts.wall ?? "timber";
  const roof = opts.roof ?? "dark";
  const base = opts.base ?? "cobble";
  const { x0, x1, z0, z1, h } = opts;
  const holes = new Set<string>();
  fill(out, x0 - 1, 0, z0 - 1, x1 + 1, 0, z1 + 1, base, (x, _y, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
  fill(out, x0, 0, z0, x1, 0, z1, "timber");
  if (opts.door) {
    for (let x = opts.door.x; x < opts.door.x + opts.door.w; x++) {
      for (let y = 1; y <= opts.door.h; y++) holes.add(key(x, y, z1));
    }
  }
  for (const w of opts.windows ?? []) {
    for (let x = w.x; x < w.x + w.w; x++) {
      for (let y = 2; y < 2 + w.h; y++) {
        holes.add(key(x, y, w.z));
        put(out, x, y, w.z, "glass");
      }
      put(out, x, 1, w.z, "gold");
    }
  }
  fill(out, x0, 1, z0, x1, h, z1, wall, (x, y, z) => {
    const edge = x === x0 || x === x1 || z === z0 || z === z1;
    if (!edge) return true;
    return holes.has(key(x, y, z));
  });
  if (opts.door) {
    for (let x = opts.door.x; x < opts.door.x + opts.door.w; x++) put(out, x, opts.door.h + 1, z1, "gold");
    put(out, opts.door.x, 1, z1, "wool");
    put(out, opts.door.x + opts.door.w - 1, 1, z1, "wool");
  }
  for (const bx of opts.banners ?? []) {
    for (let y = 2; y <= h; y++) put(out, bx, y, z1 + 1, "wool");
    put(out, bx, h, z1 + 1, "gold");
  }
  const layers = 3;
  for (let i = 0; i < layers; i++) {
    fill(out, x0 - 1 + i, h + 1 + i, z0 - 1 + i, x1 + 1 - i, h + 1 + i, z1 + 1 - i, roof);
  }
  if (opts.chimney) {
    for (let y = h + 1; y <= h + 4; y++) put(out, opts.chimney.x, y, opts.chimney.z, "dark");
    put(out, opts.chimney.x, h + 5, opts.chimney.z, "coal");
    put(out, opts.chimney.x, 1, opts.chimney.z, "wool");
    put(out, opts.chimney.x, 1, opts.chimney.z + 1, "coal");
  }
  fill(out, -1, 1, -1, 1, 1, 0, "dark");
  put(out, 0, 2, -1, "gold");
  markRoof(out, h, x0, x1, z0, z1);
  return { voxels: bake(out), x0, x1, z0, z1, enterable: true };
}

function hallTower(out: Vox[], x0: number, z0: number) {
  const x1 = x0 + 1;
  const z1 = z0 + 1;
  const top = 8;
  fill(out, x0, 0, z0, x1, 0, z1, "cobble");
  fill(out, x0, 1, z0, x1, top, z1, "stone");
  for (const [x, z] of [
    [x0, z0],
    [x1, z0],
    [x0, z1],
    [x1, z1],
  ] as const) {
    put(out, x, top + 1, z, "stone");
  }
  fill(out, x0, top + 2, z0, x1, top + 2, z1, "dark");
  put(out, x0, top + 3, z0, "dark");
  put(out, x1, top + 3, z1, "dark");
  put(out, x0, 3, z1, "glass");
  put(out, x1, 3, z1, "glass");
  put(out, x0, 5, z1, "glass");
  put(out, x1, 5, z1, "glass");
  const pole = x0 < 0 ? x0 : x1;
  for (let y = 3; y <= 7; y++) put(out, pole, y, z1 + 1, "wool");
  put(out, pole, 7, z1 + 1, "gold");
}

function makeHall(): Spec {
  const x0 = -5;
  const x1 = 5;
  const z0 = -4;
  const z1 = 4;
  const h = 4;
  const out: Vox[] = [];
  fill(out, x0 - 1, 0, z0 - 1, x1 + 1, 0, z1 + 1, "cobble", (x, _y, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
  fill(out, x0, 0, z0, x1, 0, z1, "timber");
  const holes = new Set<string>();
  for (let x = -1; x <= 1; x++) {
    for (let y = 1; y <= 3; y++) holes.add(key(x, y, z1));
  }
  for (const w of [
    { x: -3, z: z1, w: 1, hh: 2 },
    { x: 3, z: z1, w: 1, hh: 2 },
    { x: -3, z: z0, w: 2, hh: 2 },
    { x: 2, z: z0, w: 2, hh: 2 },
    { x: x0, z: -1, w: 1, hh: 2 },
    { x: x1, z: -1, w: 1, hh: 2 },
  ]) {
    for (let x = w.x; x < w.x + w.w; x++) {
      for (let y = 2; y < 2 + w.hh; y++) {
        holes.add(key(x, y, w.z));
        put(out, x, y, w.z, "glass");
      }
      put(out, x, 1, w.z, "gold");
      put(out, x, 2 + w.hh, w.z, "dark");
    }
  }
  fill(out, x0, 1, z0, x1, h, z1, "timber", (x, y, z) => {
    const edge = x === x0 || x === x1 || z === z0 || z === z1;
    if (!edge) return true;
    if ((x <= x0 + 1 && z >= z1 - 1) || (x >= x1 - 1 && z >= z1 - 1)) return true;
    return holes.has(key(x, y, z));
  });
  halfTimber(out, x0, x1, z0, z1, h, z1);
  for (let x = -1; x <= 1; x++) put(out, x, 4, z1, "gold");
  put(out, -2, 1, z1, "wool");
  put(out, 2, 1, z1, "wool");
  hallTower(out, -5, 3);
  hallTower(out, 4, 3);
  gableRoof(out, -3, 3, z0, 2, h, "dark");
  for (let y = h + 1; y <= h + 4; y++) put(out, 2, y, -2, "dark");
  put(out, 2, h + 5, -2, "coal");
  fill(out, -1, 1, -1, 1, 1, 0, "dark");
  put(out, 0, 2, -1, "gold");
  markRoof(out, h, x0, x1, z0, z1);
  return { voxels: bake(out), x0, x1, z0, z1, enterable: true, fuse: true };
}

function makeDorm(): Spec {
  return house({
    x0: -6,
    x1: 6,
    z0: -3,
    z1: 3,
    h: 3,
    door: { x: -1, w: 2, h: 2 },
    windows: [
      { x: -5, z: 3, w: 1, h: 1 },
      { x: -3, z: 3, w: 1, h: 1 },
      { x: 2, z: 3, w: 1, h: 1 },
      { x: 4, z: 3, w: 1, h: 1 },
    ],
    roof: "thatch",
  });
}

function makeKitchen(): Spec {
  const spec = house({
    x0: -3,
    x1: 3,
    z0: -3,
    z1: 3,
    h: 3,
    door: { x: 0, w: 2, h: 2 },
    windows: [{ x: -2, z: 3, w: 1, h: 1 }],
    chimney: { x: -2, z: -2 },
    wall: "timber",
    roof: "thatch",
  });
  fill(spec.voxels, -2, 3, 4, 2, 3, 5, "wool");
  markRoof(spec.voxels, 3, -3, 3, -3, 3);
  spec.voxels = bake(spec.voxels);
  return spec;
}

function makeYard(): Spec {
  const out: Vox[] = [];
  for (let x = -5; x <= 5; x++) {
    for (let z = -5; z <= 5; z++) {
      const edge = x === -5 || x === 5 || z === -5 || z === 5;
      const gate = z === 5 && x >= -1 && x <= 1;
      if (!edge || gate) continue;
      const post = x % 2 === 0 && z % 2 === 0;
      put(out, x, 0, z, "cobble");
      put(out, x, 1, z, post ? "timber" : "dark");
      if (post) put(out, x, 2, z, "timber");
    }
  }
  fill(out, -1, 0, -1, 1, 0, 1, "cobble");
  put(out, 0, 1, 0, "stone");
  put(out, 0, 2, 0, "stone");
  return { voxels: out, x0: -5, x1: 5, z0: -5, z1: 5, enterable: true };
}

function makeMarket(): Spec {
  const out: Vox[] = [];
  for (const x of [-3, 3]) {
    for (const z of [-2, 2]) {
      fill(out, x, 0, z, x, 3, z, "timber");
      put(out, x, 4, z, "gold");
    }
  }
  fill(out, -4, 4, -3, 4, 4, 3, "wool");
  fill(out, -2, 1, -1, 2, 1, 1, "dark");
  put(out, 0, 2, 0, "gold");
  for (const v of out) if (v.y >= 4) v.cut = true;
  return { voxels: out, x0: -4, x1: 4, z0: -3, z1: 3, enterable: true };
}

function makeForge(): Spec {
  const out: Vox[] = [];
  fill(out, -3, 0, -3, 3, 0, 3, "stone");
  fill(out, -3, 1, -3, 3, 3, 3, "stone", (x, y, z) => {
    const edge = x === -3 || x === 3 || z === -3;
    const open = z === 3;
    if (open) return true;
    return !edge;
  });
  fill(out, -2, 4, -2, 2, 4, 2, "dark");
  fill(out, 2, 4, -2, 2, 7, -2, "dark");
  put(out, 2, 8, -2, "coal");
  put(out, 0, 1, 0, "wool");
  put(out, 0, 1, 1, "coal");
  put(out, -1, 1, 0, "gold");
  markRoof(out, 3, -3, 3, -3, 3);
  return { voxels: out, x0: -3, x1: 3, z0: -3, z1: 3, enterable: true };
}

function makeTavern(): Spec {
  return house({
    x0: -4,
    x1: 4,
    z0: -3,
    z1: 3,
    h: 4,
    door: { x: -1, w: 2, h: 3 },
    windows: [
      { x: -3, z: 3, w: 1, h: 2 },
      { x: 2, z: 3, w: 1, h: 2 },
    ],
    chimney: { x: 3, z: -2 },
    banners: [-2, 2],
    roof: "dark",
  });
}

function makeNotice(): Spec {
  const out: Vox[] = [];
  fill(out, 0, 0, 0, 0, 4, 0, "timber");
  fill(out, -1, 2, 1, 1, 4, 1, "gold");
  fill(out, -1, 2, 2, 1, 4, 2, "glass");
  put(out, 0, 5, 0, "wool");
  return { voxels: out, x0: -1, x1: 1, z0: 0, z1: 2, enterable: false };
}

function makeFarm(): Spec {
  const out: Vox[] = [];
  for (let x = -5; x <= 5; x++) {
    for (let z = -5; z <= 5; z++) {
      const edge = x === -5 || x === 5 || z === -5 || z === 5;
      const gate = z === 5 && x >= -1 && x <= 1;
      if (!edge || gate) continue;
      const post = x % 2 === 0 && z % 2 === 0;
      const corner = (x === -5 || x === 5) && (z === -5 || z === 5);
      put(out, x, 0, z, "cobble");
      put(out, x, 1, z, post ? "timber" : "dark");
      if (post) put(out, x, 2, z, corner ? "wool" : "timber");
      if (corner) put(out, x, 3, z, "gold");
    }
  }
  put(out, -2, 1, 5, "timber");
  put(out, 2, 1, 5, "timber");
  put(out, -2, 2, 5, "gold");
  put(out, 2, 2, 5, "gold");
  const beds = [
    [-4, -4],
    [0, -4],
    [4, -4],
    [-4, 0],
    [4, 0],
    [-4, 4],
    [0, 4],
    [4, 4],
  ];
  for (const [bx, bz] of beds) {
    fill(out, bx - 1, 0, bz - 1, bx, 0, bz, "soil");
  }
  fill(out, -2, 0, -5, 2, 0, -5, "cobble");
  fill(out, -2, 1, -5, 2, 2, -5, "timber", (x, y, z) => y === 1 && x === 0 && z === -5);
  fill(out, -3, 3, -5, 3, 3, -4, "thatch");
  put(out, 0, 1, -5, "wool");
  return { voxels: out, x0: -5, x1: 5, z0: -5, z1: 5, enterable: true };
}

function makeBoard(): Spec {
  const out: Vox[] = [];
  fill(out, -3, 0, 0, -3, 3, 0, "timber");
  fill(out, 3, 0, 0, 3, 3, 0, "timber");
  fill(out, -3, 3, 0, 3, 3, 0, "timber");
  fill(out, -2, 1, 1, 2, 3, 1, "gold");
  fill(out, -2, 1, 2, 2, 3, 2, "glass");
  return { voxels: out, x0: -3, x1: 3, z0: 0, z1: 2, enterable: false };
}

/** The King's keep: a massive fused castle — four towers, south gate, inner hall. */
function keepTower(out: Vox[], x0: number, z0: number) {
  const x1 = x0 + 3;
  const z1 = z0 + 3;
  const top = 28;
  fill(out, x0, 0, z0, x1, 0, z1, "cobble");
  fill(out, x0, 1, z0, x1, top, z1, "stone", (x, _y, z) => x > x0 && x < x1 && z > z0 && z < z1);
  for (let x = x0; x <= x1; x += 3) {
    put(out, x, top + 1, z0, "stone");
    put(out, x, top + 1, z1, "stone");
  }
  for (let z = z0; z <= z1; z += 3) {
    put(out, x0, top + 1, z, "stone");
    put(out, x1, top + 1, z, "stone");
  }
  fill(out, x0 + 1, top + 1, z0 + 1, x1 - 1, top + 1, z1 - 1, "dark");
  put(out, x0 + 1, top + 2, z0 + 1, "dark");
  put(out, x1 - 1, top + 2, z1 - 1, "gold");
  for (const y of [4, 8, 12, 16, 20, 24]) {
    put(out, x0 + 1, y, z1, "glass");
    put(out, x1 - 1, y, z1, "glass");
    put(out, x0, y, z0 + 1, "glass");
    put(out, x1, y, z0 + 1, "glass");
  }
  const pole = x0 < 0 ? x0 : x1;
  for (let y = 10; y <= 22; y++) put(out, pole, y, z1 + 1, "wool");
  put(out, pole, 22, z1 + 1, "gold");
}

function makeKeep(): Spec {
  const x0 = -20;
  const x1 = 21;
  const z0 = -16;
  const z1 = 15;
  const h = 16;
  const out: Vox[] = [];
  fill(out, x0 - 1, 0, z0 - 1, x1 + 1, 0, z1 + 1, "cobble", (x, _y, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
  fill(out, x0, 0, z0, x1, 0, z1, "stone");
  const holes = new Set<string>();
  for (let x = -2; x <= 2; x++) {
    for (let y = 1; y <= 5; y++) holes.add(key(x, y, z1));
  }
  const bands = [3, 8, 13];
  const wins: { x: number; z: number; w: number; hh: number }[] = [];
  for (const y0 of bands) {
    wins.push(
      { x: -12, z: z1, w: 2, hh: 2 },
      { x: 10, z: z1, w: 2, hh: 2 },
      { x: -10, z: z0, w: 3, hh: 2 },
      { x: 8, z: z0, w: 3, hh: 2 },
      { x: x0, z: -4, w: 1, hh: 2 },
      { x: x1, z: -4, w: 1, hh: 2 },
      { x: x0, z: 4, w: 1, hh: 2 },
      { x: x1, z: 4, w: 1, hh: 2 },
    );
    for (const w of wins.slice(-8)) {
      for (let x = w.x; x < w.x + w.w; x++) {
        for (let y = y0; y < y0 + w.hh; y++) {
          holes.add(key(x, y, w.z));
          put(out, x, y, w.z, "glass");
        }
        put(out, x, y0 - 1, w.z, "gold");
      }
    }
  }
  const inTower = (x: number, z: number) =>
    (x <= x0 + 3 && z <= z0 + 3) ||
    (x >= x1 - 3 && z <= z0 + 3) ||
    (x <= x0 + 3 && z >= z1 - 3) ||
    (x >= x1 - 3 && z >= z1 - 3);
  fill(out, x0, 1, z0, x1, h, z1, "stone", (x, y, z) => {
    const edge = x === x0 || x === x1 || z === z0 || z === z1;
    if (!edge) return true;
    if (inTower(x, z)) return true;
    return holes.has(key(x, y, z));
  });
  keepTower(out, x0, z0);
  keepTower(out, x1 - 3, z0);
  keepTower(out, x0, z1 - 3);
  keepTower(out, x1 - 3, z1 - 3);
  for (let x = -2; x <= 2; x++) put(out, x, 6, z1, "gold");
  put(out, -3, 1, z1, "wool");
  put(out, 3, 1, z1, "wool");
  for (let x = x0 + 4; x <= x1 - 4; x += 2) {
    put(out, x, h + 1, z0, "stone");
    put(out, x, h + 1, z1, "stone");
  }
  for (let z = z0 + 4; z <= z1 - 4; z += 2) {
    put(out, x0, h + 1, z, "stone");
    put(out, x1, h + 1, z, "stone");
  }
  const ix0 = -8;
  const ix1 = 8;
  const iz0 = -14;
  const iz1 = -1;
  const ih = 20;
  fill(out, ix0, 1, iz0, ix1, ih, iz1, "stone", (x, y, z) => {
    const edge = x === ix0 || x === ix1 || z === iz0 || z === iz1;
    if (!edge) return true;
    if (z === iz1 && x >= -1 && x <= 1 && y <= 4) return true;
    return false;
  });
  for (const x of [-5, 4]) {
    for (const y0 of [4, 9, 14]) {
      for (let y = y0; y <= y0 + 2; y++) put(out, x, y, iz1, "glass");
      put(out, x, y0 - 1, iz1, "gold");
    }
  }
  gableRoof(out, ix0, ix1, iz0, iz1, ih, "dark");
  fill(out, -2, 1, iz0 + 1, 2, 2, iz0 + 3, "cobble");
  put(out, 0, 3, iz0 + 1, "wool");
  put(out, 0, 3, iz0 + 2, "gold");
  put(out, -1, 3, iz0 + 3, "gold");
  put(out, 1, 3, iz0 + 3, "gold");
  fill(out, -6, 1, 2, -4, 1, 6, "dark");
  put(out, -5, 2, 4, "gold");
  fill(out, -1, 1, 3, 1, 1, 4, "coal");
  const well = (x: number, z: number) => x >= 15 && x <= 18 && z >= -9 && z <= 10;
  for (const fy of [4, 8, 12, 16]) {
    fill(out, x0 + 1, fy, z0 + 1, x1 - 1, fy, z1 - 1, "timber", (x, _y, z) => well(x, z));
  }
  for (let z = -9; z <= 10; z++) {
    const t = (10 - z) / 19;
    const y = Math.max(0, Math.round(t * 12));
    fill(out, 15, y, z, 18, y, z, "stone");
    if (y > 0) fill(out, 15, y - 1, z, 16, y - 1, z, "dark");
  }
  markRoof(out, h, x0, x1, z0, z1);
  return { voxels: bake(out), x0, x1, z0, z1, enterable: true, fuse: true };
}

/** Curtain wall, x-run: an eight-tile stretch with merlons on the outer face. */
function makeRampart(): Spec {
  const out: Vox[] = [];
  fill(out, -8, 0, -1, 7, 0, 0, "cobble");
  fill(out, -8, 1, -1, 7, 4, 0, "stone");
  for (let x = -8; x <= 7; x += 2) put(out, x, 5, -1, "stone");
  return { voxels: out, x0: -8, x1: 7, z0: -1, z1: 0, enterable: false };
}

/** Curtain wall, z-run. */
function makeRampartV(): Spec {
  const out: Vox[] = [];
  fill(out, -1, 0, -8, 0, 0, 7, "cobble");
  fill(out, -1, 1, -8, 0, 4, 7, "stone");
  for (let z = -8; z <= 7; z += 2) put(out, -1, 5, z, "stone");
  return { voxels: out, x0: -1, x1: 0, z0: -8, z1: 7, enterable: false };
}

/** Corner tower: squat stone drum with a brazier crown. */
function makeTower(): Spec {
  const out: Vox[] = [];
  fill(out, -2, 0, -2, 2, 0, 2, "cobble");
  fill(out, -2, 1, -2, 2, 8, 2, "stone", (x, _y, z) => x > -2 && x < 2 && z > -2 && z < 2);
  for (let x = -2; x <= 2; x += 2) {
    put(out, x, 9, -2, "stone");
    put(out, x, 9, 2, "stone");
  }
  for (let z = -2; z <= 2; z += 2) {
    put(out, -2, 9, z, "stone");
    put(out, 2, 9, z, "stone");
  }
  put(out, 0, 9, 0, "coal");
  put(out, 0, 10, 0, "gold");
  return { voxels: out, x0: -2, x1: 2, z0: -2, z1: 2, enterable: false };
}

/** Gatehouse: twin drums flanking an x-run passage under a stone arch. */
function makeGatehouse(): Spec {
  const out: Vox[] = [];
  fill(out, -2, 0, -4, 2, 0, 4, "cobble");
  fill(out, -2, 1, -4, 2, 7, -2, "stone");
  fill(out, -2, 1, 2, 2, 7, 4, "stone");
  fill(out, -2, 4, -1, 2, 5, 0, "stone");
  for (const x of [-2, 2]) {
    put(out, x, 2, -1, "dark");
    put(out, x, 3, -1, "dark");
    put(out, x, 2, 0, "dark");
    put(out, x, 3, 0, "dark");
  }
  for (const z of [-4, -3, -2, 2, 3, 4]) {
    put(out, -2, 8, z, "stone");
    put(out, 2, 8, z, "stone");
  }
  put(out, 0, 6, -1, "wool");
  put(out, 0, 6, 0, "wool");
  put(out, 0, 6, 1, "gold");
  return { voxels: out, x0: -2, x1: 2, z0: -4, z1: 4, enterable: false };
}

/** A shopfront: wide windows, a wool awning, and a counter within. */
function makeShop(): Spec {
  const spec = house({
    x0: -4,
    x1: 4,
    z0: -3,
    z1: 3,
    h: 3,
    door: { x: -1, w: 2, h: 3 },
    windows: [
      { x: -4, z: 3, w: 2, h: 2 },
      { x: 2, z: 3, w: 2, h: 2 },
    ],
    roof: "dark",
    banners: [3],
  });
  fill(spec.voxels, -3, 3, 4, 1, 3, 5, "wool");
  fill(spec.voxels, -2, 1, 1, 2, 1, 1, "dark");
  put(spec.voxels, 0, 2, 1, "gold");
  markRoof(spec.voxels, 3, -4, 4, -3, 3);
  spec.voxels = bake(spec.voxels);
  return spec;
}

function makeTownhome(): Spec {
  return house({
    x0: -4,
    x1: 4,
    z0: -3,
    z1: 3,
    h: 3,
    door: { x: 0, w: 2, h: 2 },
    windows: [
      { x: -3, z: 3, w: 1, h: 1 },
      { x: 2, z: 3, w: 1, h: 1 },
    ],
    chimney: { x: -3, z: -2 },
    roof: "thatch",
  });
}

function makeTownhouse(): Spec {
  return house({
    x0: -3,
    x1: 3,
    z0: -3,
    z1: 3,
    h: 5,
    door: { x: -1, w: 2, h: 2 },
    windows: [
      { x: -2, z: 3, w: 1, h: 2 },
      { x: 1, z: 3, w: 1, h: 2 },
      { x: -2, z: -3, w: 1, h: 2 },
      { x: 1, z: -3, w: 1, h: 2 },
    ],
    base: "stone",
    roof: "dark",
  });
}

function makeCottage(): Spec {
  return house({
    x0: -3,
    x1: 3,
    z0: -2,
    z1: 2,
    h: 2,
    door: { x: 0, w: 1, h: 2 },
    windows: [{ x: -2, z: 2, w: 1, h: 1 }],
    chimney: { x: 2, z: -1 },
    roof: "thatch",
  });
}

function makeBank(): Spec {
  const spec = house({
    x0: -3,
    x1: 3,
    z0: -2,
    z1: 2,
    h: 3,
    wall: "stone",
    base: "stone",
    roof: "dark",
    door: { x: -1, w: 2, h: 2 },
    windows: [
      { x: -3, z: 2, w: 1, h: 1 },
      { x: 2, z: 2, w: 1, h: 1 },
    ],
    banners: [2],
  });
  fill(spec.voxels, -1, 1, -1, 1, 1, 0, "dark");
  put(spec.voxels, 0, 2, 0, "gold");
  markRoof(spec.voxels, 3, -3, 3, -2, 2);
  spec.voxels = bake(spec.voxels);
  return spec;
}

function makePorch(): Spec {
  return house({
    x0: -2,
    x1: 2,
    z0: -1,
    z1: 1,
    h: 2,
    door: { x: 0, w: 1, h: 2 },
    roof: "thatch",
  });
}

function makeHut(): Spec {
  const x0 = -3;
  const x1 = 3;
  const z0 = -2;
  const z1 = 2;
  const h = 3;
  const out: Vox[] = [];
  fill(out, x0 - 1, 0, z0 - 1, x1 + 1, 0, z1 + 1, "cobble", (x, _y, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
  fill(out, x0, 0, z0, x1, 0, z1, "timber");
  const holes = new Set<string>();
  for (let y = 1; y <= 2; y++) holes.add(key(0, y, z1));
  for (const w of [
    { x: -2, z: z1, w: 1, hh: 2 },
    { x: 2, z: z1, w: 1, hh: 2 },
    { x: -2, z: z0, w: 1, hh: 1 },
    { x: 1, z: z0, w: 1, hh: 1 },
  ]) {
    for (let x = w.x; x < w.x + w.w; x++) {
      for (let y = 2; y < 2 + w.hh; y++) {
        holes.add(key(x, y, w.z));
        put(out, x, y, w.z, "glass");
      }
      put(out, x, 1, w.z, "gold");
      put(out, x, 2 + w.hh, w.z, "dark");
    }
  }
  fill(out, x0, 1, z0, x1, h, z1, "timber", (x, y, z) => {
    const edge = x === x0 || x === x1 || z === z0 || z === z1;
    if (!edge) return true;
    return holes.has(key(x, y, z));
  });
  halfTimber(out, x0, x1, z0, z1, h, z1);
  put(out, 0, 3, z1, "gold");
  put(out, 0, 1, z1, "wool");
  for (const bx of [-2, 2]) {
    for (let y = 2; y <= h + 1; y++) put(out, bx, y, z1 + 1, "wool");
    put(out, bx, h + 1, z1 + 1, "gold");
  }
  gableRoof(out, x0, x1, z0, z1, h, "dark");
  for (let y = h + 1; y <= h + 4; y++) put(out, 2, y, -1, "dark");
  put(out, 2, h + 5, -1, "coal");
  fill(out, -1, 1, -1, 1, 1, 0, "dark");
  put(out, 0, 2, -1, "gold");
  markRoof(out, h, x0, x1, z0, z1);
  return { voxels: bake(out), x0, x1, z0, z1, enterable: true, fuse: true };
}

function makeHomestead(): Spec {
  return makeTownhouse();
}

const SPECS: Record<BuildingKind, Spec> = {
  hall: makeHall(),
  dormitory: makeDorm(),
  kitchen: makeKitchen(),
  yard: makeYard(),
  market: makeMarket(),
  forge: makeForge(),
  tavern: makeTavern(),
  notice: makeNotice(),
  board: makeBoard(),
  farm: makeFarm(),
  keep: makeKeep(),
  rampart: makeRampart(),
  rampartV: makeRampartV(),
  tower: makeTower(),
  gatehouse: makeGatehouse(),
  shop: makeShop(),
  townhome: makeTownhome(),
  townhouse: makeTownhouse(),
  cottage: makeCottage(),
  porch: makePorch(),
  hut: makeHut(),
  homestead: makeHomestead(),
  bank: makeBank(),
};

function occupant(buildings: Building[], x: number, z: number) {
  for (const b of buildings) {
    const s = SPECS[b.kind];
    if (!s.enterable) continue;
    const x0 = b.tx + s.x0 * B;
    const x1 = b.tx + (s.x1 + 1) * B;
    const z0 = b.ty + s.z0 * B;
    const z1 = b.ty + (s.z1 + 1) * B + 0.45;
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return b;
  }
  return null;
}

// This geometry query intentionally shares the canonical private SPECS table.
// eslint-disable-next-line react-refresh/only-export-components
export function insideLabel(buildings: Building[], x: number, z: number) {
  const b = occupant(buildings, x, z);
  return b ? b.kind : null;
}

function BlockLayer({
  items,
  color,
  roughness,
  metalness,
  opacity,
  emissive,
  emissiveIntensity,
  ghost,
  scale,
}: {
  items: THREE.Vector3[];
  color: string;
  roughness: number;
  metalness: number;
  opacity: number;
  emissive?: string;
  emissiveIntensity?: number;
  ghost?: boolean;
  scale: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((p, i) => {
      dummy.position.copy(p);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = items.length;
    mesh.computeBoundingSphere();
  }, [items, dummy]);
  if (items.length === 0) return null;
  const fade = ghost ? 0.11 : opacity;
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, items.length]}
      castShadow={!ghost}
      receiveShadow={!ghost}
      renderOrder={ghost ? 2 : 0}
    >
      <boxGeometry args={[scale, scale, scale]} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive ?? "#000000"}
        emissiveIntensity={ghost ? 0 : (emissiveIntensity ?? 0)}
        transparent={fade < 1}
        opacity={fade}
        depthWrite={fade >= 1}
      />
    </instancedMesh>
  );
}

function OneBuilding({ b, inside }: { b: Building; inside: boolean }) {
  const spec = SPECS[b.kind];
  const y0 = groundY(getWorld(), b.tx, b.ty);
  const story = getWorld().people.find((p) => p.isPlayer)?.story ?? 0;
  const layers = useMemo(() => {
    const solid: Record<Block, THREE.Vector3[]> = {
      timber: [],
      dark: [],
      cobble: [],
      wool: [],
      gold: [],
      glass: [],
      thatch: [],
      stone: [],
      coal: [],
      soil: [],
      leaf: [],
    };
    const cut: Record<Block, THREE.Vector3[]> = {
      timber: [],
      dark: [],
      cobble: [],
      wool: [],
      gold: [],
      glass: [],
      thatch: [],
      stone: [],
      coal: [],
      soil: [],
      leaf: [],
    };
    const cap = inside && b.kind === "keep" ? Math.round(story) * KEEP_STORY_VOX + KEEP_STORY_VOX + 1 : Infinity;
    for (const v of spec.voxels) {
      if (v.y > cap) continue;
      const p = new THREE.Vector3(b.tx + (v.x + 0.5) * B, y0 + (v.y + 0.5) * B, b.ty + (v.z + 0.5) * B);
      (v.cut ? cut : solid)[v.t].push(p);
    }
    return { solid, cut };
  }, [spec, b.tx, b.ty, b.kind, y0, inside, story]);

  return (
    <group
      onPointerDown={(e) => {
        if (useGame.getState().buildKind) {
          e.stopPropagation();
          leftAt(Math.round(e.point.x), Math.round(e.point.z));
          return;
        }
        if (b.kind === "bank") {
          e.stopPropagation();
          if (e.button === 2) {
            useGame.getState().openCtx(e.clientX, e.clientY, {
              kind: "building",
              id: b.id,
              tx: b.tx,
              ty: b.ty,
              label: b.kind,
            });
            return;
          }
          if (e.button !== 0) return;
          const pell = getWorld().people.find((p) => p.role === "banker" && Math.hypot(p.x - b.tx, p.z - b.ty) < 10);
          if (pell) useGame.getState().select(pell.id);
          return;
        }
        if (!stationOf(b.kind)) return;
        if (e.button === 2) {
          e.stopPropagation();
          useGame.getState().openCtx(e.clientX, e.clientY, {
            kind: "building",
            id: b.id,
            tx: b.tx,
            ty: b.ty,
            label: b.kind,
          });
          return;
        }
        if (e.button !== 0) return;
        e.stopPropagation();
        useGame.getState().useStation(b.id);
      }}
      onPointerMove={(e) => {
        if (!useGame.getState().buildKind) return;
        hoverAt(Math.round(e.point.x), Math.round(e.point.z));
      }}
      onPointerUp={(e) => {
        if (!useGame.getState().buildKind) return;
        e.stopPropagation();
        liftAt(Math.round(e.point.x), Math.round(e.point.z));
      }}
    >
      {KINDS.map((k) => (
        <BlockLayer
          key={`${k}-s`}
          items={layers.solid[k]}
          {...PALETTE[k]}
          {...(spec.fuse && k === "glass"
            ? { color: "#e8b96a", opacity: 0.92, emissive: "#e8b96a", emissiveIntensity: 0.62 }
            : spec.fuse && k === "gold"
              ? { emissive: "#a88848", emissiveIntensity: 0.18 }
              : { emissiveIntensity: 0 })}
          scale={B * (spec.fuse ? FUSE : GAP)}
        />
      ))}
      {!inside &&
        KINDS.map((k) => (
          <BlockLayer
            key={`${k}-c`}
            items={layers.cut[k]}
            {...PALETTE[k]}
            {...(spec.fuse && k === "glass"
              ? { color: "#e8b96a", opacity: 0.92, emissive: "#e8b96a", emissiveIntensity: 0.62 }
              : spec.fuse && k === "gold"
                ? { emissive: "#a88848", emissiveIntensity: 0.18 }
                : { emissiveIntensity: 0 })}
            scale={B * (spec.fuse ? FUSE : GAP)}
          />
        ))}
    </group>
  );
}

export function Buildings() {
  const buildings = useGame((s) => s.snap.buildings);
  const youX = useGame((s) => s.snap.youX);
  const youZ = useGame((s) => s.snap.youZ);
  const here = occupant(buildings, youX, youZ);
  const list = buildings.length ? buildings : [{ id: "hall", kind: "hall" as const, tx: COURT.tx, ty: COURT.ty - 2, beds: [] }];
  return (
    <group>
      {list.map((b) => (
        <OneBuilding key={b.id} b={b} inside={here?.id === b.id} />
      ))}
      <PlaceGhost />
    </group>
  );
}

function PreviewLayer({ items, color, scale }: { items: THREE.Vector3[]; color: string; scale: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((p, i) => {
      dummy.position.copy(p);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = items.length;
    mesh.computeBoundingSphere();
  }, [items, dummy]);
  if (items.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} frustumCulled={false} raycast={() => {}}>
      <boxGeometry args={[scale, scale, scale]} />
      <meshBasicMaterial color={color} transparent opacity={0.34} depthWrite={false} />
    </instancedMesh>
  );
}

function PlaceGhost() {
  const kind = useGame((s) => s.buildKind);
  const at = useGame((s) => s.buildAt);
  if (!kind || !at) return null;
  return <GhostAt kind={kind} tx={at.tx} ty={at.ty} />;
}

function GhostAt({ kind, tx, ty }: { kind: BuildingKind; tx: number; ty: number }) {
  const spec = SPECS[kind];
  const y0 = groundY(getWorld(), tx, ty);
  const ok = !siteError(getWorld(), kind, tx, ty);
  const color = ok ? "#c9a36a" : "#a85a42";
  const items = useMemo(() => {
    return spec.voxels.map((v) => new THREE.Vector3(tx + (v.x + 0.5) * B, y0 + (v.y + 0.5) * B, ty + (v.z + 0.5) * B));
  }, [spec, tx, ty, y0]);
  const box = useMemo(() => {
    const w = (spec.x1 - spec.x0 + 1) * B;
    const d = (spec.z1 - spec.z0 + 1) * B;
    let mh = 0;
    for (const v of spec.voxels) if (v.y > mh) mh = v.y;
    const h = (mh + 1) * B;
    const cx = tx + (spec.x0 + spec.x1 + 1) * B * 0.5;
    const cz = ty + (spec.z0 + spec.z1 + 1) * B * 0.5;
    return { w, d, h, cx, cz, geo: new THREE.BoxGeometry(w, h, d) };
  }, [spec, tx, ty]);
  return (
    <group>
      <mesh position={[box.cx, y0 + 0.05, box.cz]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
        <planeGeometry args={[box.w, box.d]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <mesh position={[box.cx, y0 + box.h / 2, box.cz]} raycast={() => {}}>
        <boxGeometry args={[box.w, box.h, box.d]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <lineSegments position={[box.cx, y0 + box.h / 2, box.cz]} raycast={() => {}}>
        <edgesGeometry args={[box.geo]} />
        <lineBasicMaterial color={color} transparent opacity={0.95} />
      </lineSegments>
      <mesh position={[box.cx, y0 + 0.06, box.cz + box.d / 2]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
        <planeGeometry args={[Math.min(box.w * 0.35, 1.4), 0.42]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <PreviewLayer items={items} color={color} scale={B * (spec.fuse ? FUSE : GAP)} />
    </group>
  );
}
