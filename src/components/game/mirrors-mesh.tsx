import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { SECONDS_PER_HOUR } from "@/game/catalog";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";

/**
 * Quas Xen — the images are no hares: pale, not-quite-there copies of a
 * person standing where you stood. The beasts' renderer skips mirrors
 * (fauna-meshes.tsx); this sibling draws them instead.
 */
const SHIMMER = "#c0d0e8";

function MirrorFigure({ id }: { id: string }) {
  const root = useRef<Group>(null);
  useFrame(() => {
    const w = getWorld();
    const c = w.fauna.find((x) => x.id === id);
    if (!root.current) return;
    if (!c || c.task === "dead" || c.taskUntil <= w.hour) {
      root.current.visible = false;
      return;
    }
    root.current.visible = true;
    const bob = Math.sin(w.hour * SECONDS_PER_HOUR * 1.7 + c.x * 3.1) * 0.05;
    root.current.position.set(c.x, groundY(w, c.x, c.z) + 0.04 + bob, c.z);
  });
  return (
    <group ref={root}>
      {/* body */}
      <mesh position={[0, 0.92, 0]}>
        <capsuleGeometry args={[0.26, 0.78, 6, 12]} />
        <meshBasicMaterial color={SHIMMER} transparent opacity={0.38} depthWrite={false} />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.62, 0]}>
        <sphereGeometry args={[0.19, 12, 10]} />
        <meshBasicMaterial color={SHIMMER} transparent opacity={0.44} depthWrite={false} />
      </mesh>
      {/* arms — folded close, the shimmer does not swing */}
      <mesh position={[-0.34, 0.95, 0]} rotation={[0, 0, 0.18]}>
        <capsuleGeometry args={[0.07, 0.5, 4, 8]} />
        <meshBasicMaterial color={SHIMMER} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <mesh position={[0.34, 0.95, 0]} rotation={[0, 0, -0.18]}>
        <capsuleGeometry args={[0.07, 0.5, 4, 8]} />
        <meshBasicMaterial color={SHIMMER} transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function MirrorImages() {
  const fauna = useGame((s) => s.snap.fauna);
  return (
    <group>
      {fauna.filter((c) => c.mirror).map((c) => (
        <MirrorFigure key={c.id} id={c.id} />
      ))}
    </group>
  );
}
