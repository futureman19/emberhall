import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { COURT } from "@/game/atlas";
import { groundClump } from "./lanternwood-ground";
import { useArtistKit, gardenTreeTransform } from "./lanternwood-kit";
import { buildingBox } from "@/game/building-size";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";
import type { BuildingKind } from "@/game/types";
import { type ArtPart, LW_COLOR, buildingDressing, gardenSites, gardenDressing, lanternwoodInfluence, fireflyPosition, noArtRaycast } from "./lanternwood-art";

/** Four instanced draw calls per assembly, independent of the number of ornaments. */
function ArtBatch({ parts, shape, glow }: { parts: ArtPart[]; shape: ArtPart["shape"]; glow: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const bevelledBox = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 1, 0.045), []);
  useEffect(() => () => bevelledBox.dispose(), [bevelledBox]);
  const list = useMemo(() => parts.filter(p => p.shape === shape && p.glow === glow), [parts, shape, glow]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    list.forEach((p, i) => {
      dummy.position.set(...p.position);
      dummy.scale.set(...p.scale);
      dummy.rotation.set(...(p.rotation ?? [0, 0, 0]));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.set(p.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [list]);
  if (!list.length) return null;
  return <instancedMesh name={`lanternwood-${shape}-${glow ? "paper" : "craft"}`} ref={ref} args={[undefined, undefined, list.length]} raycast={noArtRaycast} castShadow={!glow} receiveShadow={!glow}>
    {shape === "box" ? <primitive object={bevelledBox} attach="geometry" /> : <dodecahedronGeometry args={[1, 0]} />}
    <meshStandardMaterial roughness={0.92} metalness={0} emissive={glow ? LW_COLOR.paper : "#000000"} emissiveIntensity={glow ? 0.75 : 0} />
  </instancedMesh>;
}
function Assembly({ parts }: { parts: ArtPart[] }) {
  return <group name="lanternwood-decoration" userData={{ decorative: true }}>
    <ArtBatch parts={parts} shape="box" glow={false} /><ArtBatch parts={parts} shape="round" glow={false} />
    <ArtBatch parts={parts} shape="box" glow /><ArtBatch parts={parts} shape="round" glow />
  </group>;
}
export function LanternwoodBuilding({ kind, x, z, y, inside }: { kind: BuildingKind; x: number; z: number; y: number; inside: boolean }) {
  const influence = lanternwoodInfluence(x, z);
  const parts = useMemo(() => buildingDressing(kind).filter(p => !inside || !p.roof), [kind, inside]);
  if (influence <= 0 || !parts.length) return null;
  // Shrink adornments smoothly at the art boundary; no cutover in far towns.
  return <group position={[x, y, z]} scale={influence}><Assembly parts={parts} /></group>;
}
function Fireflies() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const world = getWorld();
    const you = world.people.find(p => p.isPlayer);
    const near = you ? lanternwoodInfluence(you.x, you.z) : 0;
    mesh.visible = near > 0;
    if (!mesh.visible) return;
    const time = clock.elapsedTime;
    const evening = world.hour >= 17 || world.hour < 7;
    if (material.current) material.current.opacity = evening ? 0.8 : 0.35;
    for (let i = 0; i < 28; i++) {
      const [x, y, z] = fireflyPosition(i, time);
      dummy.position.set(x, groundY(world, x, z) + y, z);
      dummy.scale.setScalar(0.025 + (Math.sin(time * 1.4 + i * 2) + 1) * 0.012);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh name="lanternwood-fireflies" ref={ref} args={[undefined, undefined, 28]} raycast={noArtRaycast} frustumCulled={false}>
    <octahedronGeometry args={[1, 0]} /><meshBasicMaterial ref={material} color={LW_COLOR.paper} transparent opacity={0.35} depthWrite={false} toneMapped={false} />
  </instancedMesh>;
}
function GardenTree({ x, y, z, variant }: { x: number; y: number; z: number; variant: number }) {
  const scene = useArtistKit(variant % 2 ? "tree-1" : "tree-0");
  const transform = gardenTreeTransform(x, z);
  return scene ? <primitive name="blender-garden-tree" object={scene} position={[x, y, z]} rotation={[0, transform.yaw, 0]} scale={transform.scale} dispose={null} /> : null;
}

export function LanternwoodDressing() {
  const buildings = useGame(s => s.snap.buildings);
  const landRev = useGame(s => s.snap.landKey);
  const gardenTrees = useMemo(() => {
    if (!landRev) return [];
    const w = getWorld();
    return gardenSites().filter(site => {
      // Ornamental side-garden saplings only, never replace harvestable nodes.
      const tx = Math.round(site.x), tz = Math.round(site.z);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (w.tiles[tz + dz]?.[tx + dx]?.kind !== "grass") return false;
      }
      if (w.plots?.some(p => Math.hypot(p.tx - site.x, p.ty - site.z) < 3)) return false;
      return !buildings.some(b => {
        const box = buildingBox(b.kind, b.tx, b.ty);
        return site.x > box.x0 - 2 && site.x < box.x1 + 2 && site.z > box.z0 - 2 && site.z < box.z1 + 2;
      });
    }).slice(0, 8).map(site => ({ ...site, y: groundY(w, site.x, site.z) }));
  }, [buildings, landRev]);
  const parts = useMemo(() => {
    // The terrain revision is a render cache key for external mutable world data.
    if (!landRev) return [];
    const world = getWorld();
    const out: ArtPart[] = [];
    for (const site of gardenSites()) {
      const tile = world.tiles[Math.round(site.z)]?.[Math.round(site.x)];
      if (!tile || tile.kind !== "grass") continue;
      if (world.plots?.some(p => Math.hypot(p.tx - site.x, p.ty - site.z) < 2)) continue;
      if (buildings.some(b => {
        const box = buildingBox(b.kind, b.tx, b.ty);
        return site.x > box.x0 - 1.2 && site.x < box.x1 + 1.2 && site.z > box.z0 - 1.2 && site.z < box.z1 + 1.2;
      })) continue;
      const y = groundY(world, site.x, site.z);
      for (const p of gardenDressing(site.variant)) out.push({ ...p, position: [site.x + p.position[0], y + p.position[1], site.z + p.position[2]] });
    }
    // Sparse grass-only verge accents; no extra render batches or pick targets.
    for (let z = COURT.ty - 21; z <= COURT.ty + 21; z++) for (let x = COURT.tx - 21; x <= COURT.tx + 21; x++) {
      if (world.tiles[z]?.[x]?.kind !== "grass") continue;
      const nearPath = [[x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]].some(([tx, tz]) => {
        const k = world.tiles[tz]?.[tx]?.kind;
        return k === "dirt" || k === "road" || k === "cobble";
      });
      if (!nearPath || world.plots?.some(p => Math.hypot(p.tx - x, p.ty - z) < 2)) continue;
      if (buildings.some(b => { const box = buildingBox(b.kind, b.tx, b.ty); return x > box.x0 - 1 && x < box.x1 + 1 && z > box.z0 - 1 && z < box.z1 + 1; })) continue;
      const y = groundY(world, x, z);
      for (const p of groundClump(x, z)) out.push({ ...p, position: [x + p.position[0], y + p.position[1], z + p.position[2]] });
    }
    return out;
  }, [buildings, landRev]);
  return <group name="lanternwood-starting-town"><Assembly parts={parts} />{gardenTrees.map(site => <GardenTree key={`${site.x}:${site.z}`} {...site} />)}<Fireflies /></group>;
}
