import { useLayoutEffect, useMemo, useRef } from "react";
import { beginWorldTouch } from "./use-world-touch";
import { architectureKitName, retainArchitectureInteriorVoxel } from "./architecture-kit.ts";
import { signageKitName } from "./signage-kit.ts";
import { interiorKitName, replaceInteriorVoxel } from "./interior-kit.ts";
import * as THREE from "three";
import { COURT } from "@/game/atlas";
import { stationOf } from "@/game/craft";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { KEEP_STORY_VOX } from "@/game/keep-story";
import { keepStairCut } from "./keep-presentation.ts";
import { placementPreviewError } from "@/game/placement-preview";
import { useGame } from "@/game/store";
import { hitAt, hoverAt, leftAt, liftAt } from "@/game/world-pointer";
import type { Building, BuildingKind } from "@/game/types";

import { LANTERNWOOD_BLOCKS, lanternwoodInfluence } from "./lanternwood-art";
import { LanternwoodBuilding } from "./lanternwood-dressing";
import { useArtistKit, usesBlenderHall } from "./lanternwood-kit";
import { settlementKitName, retainSettlementInteriorVoxel } from "./settlement-kit";
import { hospitalityKitName, retainHospitalityInteriorVoxel } from "./hospitality-kit";
import { commonsKitName, retainCommonsInteriorVoxel, keepCommonsExteriorOnEntry } from "./commons-kit";

import { VOX } from "@/game/placeables/types";
import type { Block } from "@/game/placeables/types";
import { PALETTE } from "@/game/placeables/materials";
import { SPECS } from "@/game/placeables/legacy-buildings";

const B = VOX;
/** Default cube scale. 1.04 fuses faces — only the hut preview uses it. */
const GAP = 0.96;
const FUSE = 1.04;

const KINDS = Object.keys(PALETTE) as Block[];

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
  pickOnly = false,
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
  pickOnly?: boolean;
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
      castShadow={!ghost && !pickOnly}
      receiveShadow={!ghost && !pickOnly}
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
        colorWrite={!pickOnly}
        depthWrite={!pickOnly && fade >= 1}
      />
    </instancedMesh>
  );
}

function OneBuilding({ b, inside }: { b: Building; inside: boolean }) {
  const settlement = settlementKitName(b.kind, b.tx, b.ty) ?? hospitalityKitName(b.kind, b.tx, b.ty) ?? commonsKitName(b.kind, b.tx, b.ty) ?? signageKitName(b.kind, b.tx, b.ty) ?? architectureKitName(b.kind, b.tx, b.ty);
  const kitName = usesBlenderHall(b.kind, b.tx, b.ty) ? "hall" : settlement;
  const authored = useArtistKit(kitName);
  const interiorName = interiorKitName(b.kind, b.tx, b.ty);
  const furnishings = useArtistKit(interiorName);
  const exterior = Boolean(authored && !inside) || Boolean(authored && keepCommonsExteriorOnEntry(kitName));
  const settlementExterior = exterior && settlement !== null;
  const spec = SPECS[b.kind];
  const palette = useMemo(() => {
    const influence = lanternwoodInfluence(b.tx, b.ty);
    return Object.fromEntries(KINDS.map(k => [k, { ...PALETTE[k], color: influence && LANTERNWOOD_BLOCKS[k] ? `#${new THREE.Color(PALETTE[k].color).lerp(new THREE.Color(LANTERNWOOD_BLOCKS[k]), influence).getHexString()}` : PALETTE[k].color }])) as typeof PALETTE;
  }, [b.tx, b.ty]);
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
    const interior = Object.fromEntries(KINDS.map(k => [k, [] as THREE.Vector3[]])) as Record<Block, THREE.Vector3[]>;
    const furnitureProxies = Object.fromEntries(KINDS.map(k => [k, [] as THREE.Vector3[]])) as Record<Block, THREE.Vector3[]>;
    const cap = inside && b.kind === "keep" ? Math.round(story) * KEEP_STORY_VOX + KEEP_STORY_VOX + 1 : Infinity;
    for (const v of spec.voxels) {
      if (v.y > cap) continue;
      if (inside && b.kind === "keep" && keepStairCut(v, story)) continue;
      // The next timber deck is this room's ceiling, not its walking floor.
      // Cut only overhead decks; preserve walls, stairs and the occupied floor.
      if (inside && b.kind === "keep" && v.t === "timber" && v.y % KEEP_STORY_VOX === 0 && v.y > Math.round(story) * KEEP_STORY_VOX) continue;
      const p = new THREE.Vector3(b.tx + (v.x + 0.5) * B, y0 + (v.y + 0.5) * B, b.ty + (v.z + 0.5) * B);
      if (furnishings && replaceInteriorVoxel(b.kind, v)) {
        furnitureProxies[v.t].push(p);
        continue;
      }
      (v.cut ? cut : solid)[v.t].push(p);
      if (retainSettlementInteriorVoxel(b.kind, v) || retainHospitalityInteriorVoxel(b.kind, v) || retainCommonsInteriorVoxel(b.kind, v) || retainArchitectureInteriorVoxel(b.kind, v)) interior[v.t].push(p);
    }
    return { solid, cut, interior, furnitureProxies };
  }, [spec, b.tx, b.ty, b.kind, y0, inside, story, furnishings]);

  return (
    <group
      onPointerDown={(e) => {
        const floor = inside && b.kind === "keep";
        if (floor || b.kind === "bank" || stationOf(b.kind)) {
          const tx = floor ? Math.round(e.point.x) : b.tx;
          const ty = floor ? Math.round(e.point.z) : b.ty;
          if (beginWorldTouch(e.nativeEvent, { tx, ty,
            tap: () => {
              if (floor) leftAt(tx, ty);
              else if (b.kind === "bank") {
                const pell = getWorld().people.find((p) => p.role === "banker" && Math.hypot(p.x - b.tx, p.z - b.ty) < 10);
                if (pell) useGame.getState().select(pell.id);
              } else useGame.getState().useStation(b.id);
            },
            secondary: (point) => {
              if (floor) hitAt(tx, ty, point.clientX, point.clientY);
              else useGame.getState().openCtx(point.clientX, point.clientY, { kind: "building", id: b.id, tx: b.tx, ty: b.ty, label: b.kind });
            },
          })) { e.stopPropagation(); return; }
        }
        if (useGame.getState().buildKind) {
          e.stopPropagation();
          leftAt(Math.round(e.point.x), Math.round(e.point.z));
          return;
        }
        // Inside the keep, use the visible floor/stair hit rather than letting
        // the same ray reach a displaced terrain point below the current story.
        if (inside && b.kind === "keep" && useGame.getState().phase === "playing" && (e.button === 0 || e.button === 2)) {
          e.stopPropagation();
          const tx = Math.round(e.point.x);
          const ty = Math.round(e.point.z);
          if (e.button === 2) hitAt(tx, ty, e.clientX, e.clientY);
          else leftAt(tx, ty);
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
      {exterior && authored && <primitive name={`blender-${kitName}-exterior`} object={authored} position={[b.tx, y0, b.ty]} dispose={null} />}
      {furnishings && <primitive name={`blender-interior-${b.kind}`} object={furnishings} position={[b.tx, y0, b.ty]} dispose={null} />}
      {furnishings && KINDS.map(k => (
        <BlockLayer key={`${k}-furniture-proxy`} items={layers.furnitureProxies[k]} pickOnly {...palette[k]} scale={B * (spec.fuse ? FUSE : GAP)} />
      ))}
      {settlementExterior && KINDS.map(k => (
        <BlockLayer key={`${k}-retained-interior`} items={layers.interior[k]} {...palette[k]} scale={B * GAP} />
      ))}
      {!exterior && <LanternwoodBuilding kind={b.kind} x={b.tx} z={b.ty} y={y0} inside={inside} />}
      {KINDS.map((k) => (
        <BlockLayer
          key={`${k}-s`}
          items={layers.solid[k]}
          pickOnly={exterior}
          {...palette[k]}
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
            pickOnly={exterior}
            {...palette[k]}
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
  // Placement appends to the mutable array; redraw insertions even while paused.
  useGame((s) => s.snap.buildings.length);
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
  // Validity can change without moving the pointer (deed, ownership or body state).
  const ok = useGame(() => !placementPreviewError(getWorld(), kind, tx, ty));
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
