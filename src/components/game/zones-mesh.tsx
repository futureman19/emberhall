import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getWorld } from "@/game/live";
import { ZONE_CAP } from "@/game/catalog";
import { visitZones, writeZoneMatrix, ZONE_VISUALS } from "@/game/zones";

/** Standing ground workings (batch two): one instanced draw call, fixed
 * capacity, one full ring per working. Static geometry per frame — the ring
 * is the meaning (fire, tar, stone, hallow, fault, swarm), so it stays
 * visible in reduced-effects mode like the status seals do. */
export function ZoneMesh() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const scratch = useMemo(() => ({ pose: new THREE.Object3D(), color: new THREE.Color() }), []);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const w = getWorld();
    let i = 0;
    visitZones(w, (x, z, kind, radius) => {
      if (i >= ZONE_CAP) return;
      writeZoneMatrix(w, x, z, radius, scratch.pose.matrix.elements);
      scratch.pose.matrixAutoUpdate = false;
      mesh.setMatrixAt(i, scratch.pose.matrix);
      mesh.setColorAt(i, scratch.color.set(ZONE_VISUALS[kind].color));
      i++;
    });
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  return <instancedMesh name="ground-zones" ref={ref} args={[undefined, undefined, ZONE_CAP]} frustumCulled={false}>
    <ringGeometry args={[0.92, 1, 32]} />
    <meshBasicMaterial transparent opacity={0.75} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
  </instancedMesh>;
}
