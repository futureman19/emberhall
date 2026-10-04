import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { buildingBox } from "@/game/building-size";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { resolveResourceNode } from "@/game/resources/nodes";
import { RESOURCE_CATALOG } from "@/game/resources/catalog";
import { useGame } from "@/game/store";
import { useTimberGeometry } from "./timber-renderer-data";
import { authoredTimberId, TIMBER_IDS, type TimberId } from "./timber-renderer-policy";
import { noArtRaycast } from "./lanternwood-art";

type Site = readonly [number, number, number];
function StumpBatch({ id, geometry, sites }: { id: TimberId; geometry?: THREE.BufferGeometry; sites: Site[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const dummy = new THREE.Object3D();
    sites.forEach((p, i) => {
      dummy.position.set(p[0], p[1] + (geometry ? 0 : .14), p[2]);
      dummy.updateMatrix(); mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.count = sites.length;
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [sites, geometry]);
  if (!sites.length) return null;
  return <instancedMesh name={`depleted-${id}-stumps`} ref={mesh} args={[geometry, undefined, sites.length]} dispose={null} raycast={noArtRaycast} castShadow receiveShadow>
    {!geometry && <cylinderGeometry args={[.14, .19, .28, 8]} />}
    <meshStandardMaterial color={id === "oak" && geometry ? "#ffffff" : RESOURCE_CATALOG[id].visual.primary} vertexColors={Boolean(geometry?.getAttribute("color"))} roughness={.96} />
  </instancedMesh>;
}

/** Kept export name for scene compatibility; all timber depletion records, worldwide.
 * No invented scars, no harvestable stump targets, no gameplay/random writes.
 */
export function OakStumps() {
  const timber = useTimberGeometry();
  const snap = useGame(s => s.snap);
  const world = getWorld();
  const nodes = world.resourceNodes;
  const saplings = snap.saplings;
  // Forestry mutates this array in place without changing landRev. Track occupied
  // tiles, not identity/count or growth stage, to remove stumps after planting.
  const saplingSitesKey = saplings.map(s => `${s.tx},${s.ty}`).join(";");
  const buildings = snap.buildings;
  const land = snap.landKey;
  const ghost = snap.player.ghost;
  const sites = useMemo(() => {
    void land;
    void saplingSitesKey;
    const grouped = Object.fromEntries(TIMBER_IDS.map(id => [id, [] as Site[]])) as Record<TimberId, Site[]>;
    for (const n of Object.values(nodes)) {
      if (n.nodeKind !== "tree" || n.depletedAtHour === null) continue;
      if (world.tiles[n.ty]?.[n.tx]?.kind !== "dirt") continue;
      if (saplings.some(s => s.tx === n.tx && s.ty === n.ty) || world.plots.some(p => p.tx === n.tx && p.ty === n.ty)) continue;
      if (buildings.some(b => { const box = buildingBox(b.kind, b.tx, b.ty); return n.tx >= box.x0 && n.tx <= box.x1 && n.ty >= box.z0 && n.ty <= box.z1; })) continue;
      const id = authoredTimberId(world.plantedTimber?.[`${n.tx},${n.ty}`] ?? resolveResourceNode({ seed: world.seed, tx: n.tx, ty: n.ty, nodeKind: "tree" }).identity.resourceId, true);
      if (!id || (id === "ghostwood" && !ghost)) continue;
      grouped[id].push([n.tx, groundY(world, n.tx, n.ty), n.ty]);
    }
    return grouped;
  }, [nodes, saplings, saplingSitesKey, buildings, land, world, ghost]);
  return <group>{TIMBER_IDS.map(id => <StumpBatch key={id} id={id} geometry={timber[id]?.stump} sites={sites[id]} />)}</group>;
}
