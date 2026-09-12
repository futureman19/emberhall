import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";
import type { Campfire } from "@/game/types";

/** One burning campfire — stone ring, crossed logs, a flickering flame, warm light. */
function Fire({ fire }: { fire: Campfire }) {
  const y = groundY(getWorld(), fire.tx, fire.ty);
  const flame = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 9 + fire.tx * 3.7 + fire.ty * 1.3;
    const s = 1 + Math.sin(t) * 0.12 + Math.sin(t * 1.7) * 0.06;
    flame.current?.scale.set(s, 1 + Math.sin(t * 1.3) * 0.18, s);
  });
  return (
    <group position={[fire.tx, y, fire.ty]}>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3]} castShadow>
            <dodecahedronGeometry args={[0.09, 0]} />
            <meshStandardMaterial color="#8a8d90" roughness={0.9} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.08, 0]} rotation={[0, 0.6, 0.24]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.5, 6]} />
        <meshStandardMaterial color="#5d4630" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.08, 0]} rotation={[0.24, -0.6, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.5, 6]} />
        <meshStandardMaterial color="#4e3a28" roughness={0.95} />
      </mesh>
      <group ref={flame} position={[0, 0.14, 0]}>
        <mesh position={[0, 0.16, 0]}>
          <coneGeometry args={[0.14, 0.4, 7]} />
          <meshBasicMaterial color="#ff9a3c" transparent opacity={0.92} />
        </mesh>
        <mesh position={[0, 0.12, 0]}>
          <coneGeometry args={[0.08, 0.24, 6]} />
          <meshBasicMaterial color="#ffd76a" transparent opacity={0.95} />
        </mesh>
      </group>
      <pointLight color="#ff9440" intensity={1.6} distance={5.2} position={[0, 0.5, 0]} />
    </group>
  );
}

export function Campfires() {
  const fires = useGame((s) => s.snap.campfires);
  return (
    <group>
      {fires.map((f) => (
        <Fire key={f.id} fire={f} />
      ))}
    </group>
  );
}
