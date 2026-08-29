import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { COURT } from "@/game/atlas";
import { stationOf } from "@/game/craft";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { siteError } from "@/game/building-size";
import { useGame } from "@/game/store";
import { hoverAt, leftAt, liftAt } from "@/game/world-pointer";
import type { Building, BuildingKind } from "@/game/types";

const B = 0.5;
const GAP = 0.96;

type Block = "timber" | "dark" | "cobble" | "wool" | "gold" | "glass" | "thatch" | "stone" | "coal";

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
}

const PALETTE: Record<Block, { color: string; roughness: number; metalness: number; opacity: number }> = {
  timber: { color: "#6a4a32", roughness: 0.9, metalness: 0, opacity: 1 },
  dark: { color: "#3a2818", roughness: 0.88, metalness: 0, opacity: 1 },
  cobble: { color: "#7a746c", roughness: 0.92, metalness: 0, opacity: 1 },
  wool: { color: "#a85a42", roughness: 0.78, metalness: 0, opacity: 1 },
  gold: { color: "#c9a36a", roughness: 0.42, metalness: 0.35, opacity: 1 },
  glass: { color: "#ece6d8", roughness: 0.2, metalness: 0.05, opacity: 0.42 },
  thatch: { color: "#8a7048", roughness: 0.94, metalness: 0, opacity: 1 },
  stone: { color: "#9a9286", roughness: 0.9, metalness: 0, opacity: 1 },
  coal: { color: "#141210", roughness: 0.95, metalness: 0, opacity: 1 },
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
  return { voxels: out, x0, x1, z0, z1, enterable: true };
}

function makeHall(): Spec {
  return house({
    x0: -5,
    x1: 5,
    z0: -4,
    z1: 4,
    h: 4,
    door: { x: -1, w: 3, h: 3 },
    windows: [
      { x: -4, z: 4, w: 1, h: 2 },
      { x: 4, z: 4, w: 1, h: 2 },
      { x: -3, z: -4, w: 2, h: 2 },
      { x: 2, z: -4, w: 2, h: 2 },
      { x: -5, z: -1, w: 1, h: 2 },
      { x: 5, z: -1, w: 1, h: 2 },
    ],
    chimney: { x: 4, z: -2 },
    banners: [-3, 3],
  });
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

function makeBoard(): Spec {
  const out: Vox[] = [];
  fill(out, -3, 0, 0, -3, 3, 0, "timber");
  fill(out, 3, 0, 0, 3, 3, 0, "timber");
  fill(out, -3, 3, 0, 3, 3, 0, "timber");
  fill(out, -2, 1, 1, 2, 3, 1, "gold");
  fill(out, -2, 1, 2, 2, 3, 2, "glass");
  return { voxels: out, x0: -3, x1: 3, z0: 0, z1: 2, enterable: false };
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
  ghost,
}: {
  items: THREE.Vector3[];
  color: string;
  roughness: number;
  metalness: number;
  opacity: number;
  ghost?: boolean;
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
      <boxGeometry args={[B * GAP, B * GAP, B * GAP]} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
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
    };
    for (const v of spec.voxels) {
      const p = new THREE.Vector3(b.tx + (v.x + 0.5) * B, y0 + (v.y + 0.5) * B, b.ty + (v.z + 0.5) * B);
      (v.cut ? cut : solid)[v.t].push(p);
    }
    return { solid, cut };
  }, [spec, b.tx, b.ty, y0]);

  return (
    <group
      onPointerDown={(e) => {
        if (useGame.getState().buildKind) {
          e.stopPropagation();
          leftAt(Math.round(e.point.x), Math.round(e.point.z));
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
        <BlockLayer key={`${k}-s`} items={layers.solid[k]} {...PALETTE[k]} />
      ))}
      {!inside &&
        KINDS.map((k) => (
          <BlockLayer key={`${k}-c`} items={layers.cut[k]} {...PALETTE[k]} />
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

function PreviewLayer({ items, color }: { items: THREE.Vector3[]; color: string }) {
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
      <boxGeometry args={[B * GAP, B * GAP, B * GAP]} />
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
      <PreviewLayer items={items} color={color} />
    </group>
  );
}
