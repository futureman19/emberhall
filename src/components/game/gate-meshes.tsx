import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { STATIONS } from "@/game/atlas";
import { SECONDS_PER_HOUR } from "@/game/catalog";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { MOONGATE_DURATION, getMoongateFx, moongatePhase } from "@/game/moongate-animation";

export function Gates() {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!group.current) return;
    const world = getWorld();
    const fx = getMoongateFx(world);
    const age = fx ? (world.hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const active = Boolean(fx && age >= 0 && age < MOONGATE_DURATION);
    const phase = moongatePhase(age);
    group.current.children.forEach((c, index) => {
      c.rotation.y += dt * 0.6;
      const station = STATIONS[index];
      const pulse = active && fx && station?.id === fx.destinationId ? phase.arrival * 0.72 : active && fx && station?.id === fx.sourceId ? phase.departure * 0.35 : 0;
      c.scale.setScalar(1 + pulse);
    });
  });
  return (
    <group ref={group}>
      {STATIONS.map((s) => {
        const y = groundY(getWorld(), s.tx, s.ty);
        return (
          <group key={s.id} position={[s.tx, y + 0.9, s.ty]}>
            <mesh>
              <torusGeometry args={[0.7, 0.08, 8, 18]} />
              <meshStandardMaterial color="#c9a36a" emissive="#a85a42" emissiveIntensity={0.35} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.55, 16]} />
              <meshBasicMaterial color="#ece6d8" transparent opacity={0.22} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
