import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { cemeteryHaze, placeById } from "@/game/atlas";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { effectsReduced } from "./effects-preference";

const GRAVE = placeById("greybarrow");
const PATCHES = 18;
const GRAVE_MIST = new THREE.Color("#c4cdc4");

/** Low cemetery breath on Greybarrow's dirt. Not the tomb pit fog. */
export function CemeteryMist() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const sites = useMemo(() => {
    const out: { x: number; z: number; scale: number }[] = [];
    for (let i = 0; i < PATCHES; i++) {
      const a = i * 2.399;
      const r = 4 + (i % 6) * 2.1;
      out.push({ x: GRAVE.tx + Math.cos(a) * r, z: GRAVE.ty + Math.sin(a) * r, scale: 5.2 + (i % 4) * 1.4 });
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    m.count = PATCHES;
  }, []);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    if (effectsReduced()) {
      m.visible = false;
      return;
    }
    const w = getWorld();
    const you = w.people.find((p) => p.isPlayer);
    const haze = cemeteryHaze(you?.x ?? GRAVE.tx, you?.z ?? GRAVE.ty);
    m.visible = haze > 0.04;
    if (!m.visible) return;
    const mat = m.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.05 + haze * 0.1;
    for (let i = 0; i < sites.length; i++) {
      const s = sites[i]!;
      dummy.position.set(s.x, groundY(w, s.x, s.z) + 0.42, s.z);
      dummy.scale.set(s.scale, 0.08, s.scale * 0.85);
      dummy.rotation.set(0, i * 0.4, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, PATCHES]} frustumCulled={false} raycast={() => {}} name="cemetery-mist">
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color={GRAVE_MIST} transparent opacity={0.08} depthWrite={false} fog />
    </instancedMesh>
  );
}
