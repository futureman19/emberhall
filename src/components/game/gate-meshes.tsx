import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { STATIONS } from "@/game/atlas";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";

export function Gates() {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.children.forEach((c) => {
      c.rotation.y += dt * 0.6;
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
