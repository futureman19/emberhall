import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";
import { getHoldBuild } from "@/game/placeables/build-mode";
import { PALETTE } from "@/game/placeables/materials";
import { ghostTint, worldVoxels } from "@/game/placeables/pose";
import { VOX, type Block } from "@/game/placeables/types";

const GAP = 0.96;
const KINDS = Object.keys(PALETTE) as Block[];

function Layer({
  items,
  color,
  roughness,
  metalness,
  opacity,
  ghost,
  highlight,
}: {
  items: THREE.Vector3[];
  color: string;
  roughness: number;
  metalness: number;
  opacity: number;
  ghost?: boolean;
  highlight?: boolean;
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
  const fade = ghost ? 0.34 : opacity;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} frustumCulled={false} raycast={() => {}} castShadow={!ghost} receiveShadow={!ghost}>
      <boxGeometry args={[VOX * GAP, VOX * GAP, VOX * GAP]} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={highlight ? "#c9a36a" : "#000000"}
        emissiveIntensity={highlight ? 0.35 : 0}
        transparent={fade < 1}
        opacity={fade}
        depthWrite={!ghost && fade >= 1}
      />
    </instancedMesh>
  );
}

function Piece({
  definitionId,
  tx,
  ty,
  rotation,
  materials,
  ghost,
  highlight,
}: {
  definitionId: string;
  tx: number;
  ty: number;
  rotation: 0 | 1 | 2 | 3;
  materials?: Record<string, string>;
  ghost?: boolean;
  highlight?: boolean;
}) {
  const y0 = groundY(getWorld(), tx, ty);
  const voxels = useMemo(
    () => worldVoxels(definitionId, tx, ty, rotation, y0, materials),
    [definitionId, tx, ty, rotation, y0, materials],
  );
  const layers = useMemo(() => {
    const bins = Object.fromEntries(KINDS.map((k) => [k, [] as THREE.Vector3[]])) as Record<Block, THREE.Vector3[]>;
    for (const v of voxels) bins[v.t].push(new THREE.Vector3(v.x, v.y, v.z));
    return bins;
  }, [voxels]);
  const tint = ghost ? ghostTint(!getHoldBuild().reason) : null;
  return (
    <group>
      {KINDS.map((k) => (
        <Layer
          key={k}
          items={layers[k]}
          color={tint ?? PALETTE[k].color}
          roughness={PALETTE[k].roughness}
          metalness={PALETTE[k].metalness}
          opacity={PALETTE[k].opacity}
          ghost={ghost}
          highlight={highlight}
        />
      ))}
    </group>
  );
}

export function Placeables() {
  const holdRev = useGame((s) => s.holdRev);
  const snap = useGame((s) => s.snap.landKey);
  void holdRev;
  void snap;
  const world = getWorld();
  const hold = getHoldBuild();
  return (
    <group>
      {world.placedObjects.map((o) => (
        <Piece
          key={o.id}
          definitionId={o.definitionId}
          tx={o.tx}
          ty={o.ty}
          rotation={o.rotation}
          materials={o.materialSlots}
          highlight={hold.instanceId === o.id}
        />
      ))}
      {hold.active && hold.definitionId && hold.tx != null && hold.ty != null ? (
        <Piece definitionId={hold.definitionId} tx={hold.tx} ty={hold.ty} rotation={hold.rotation} materials={hold.materials} ghost />
      ) : null}
    </group>
  );
}
