import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";
import type { Creature, FaunaKind } from "@/game/types";

const COLOR: Record<FaunaKind, string> = {
  hare: "#c4a882",
  hart: "#8a6a42",
  wolf: "#6a6a68",
  wight: "#c9c3b6",
};

function Beast({ c }: { c: Creature }) {
  const dead = c.task === "dead";
  const s = c.kind === "hare" ? 0.35 : c.kind === "hart" ? 0.7 : c.kind === "wolf" ? 0.55 : 0.8;
  const color = COLOR[c.kind];
  return (
    <group position={[c.x, groundY(getWorld(), c.x, c.z), c.z]} rotation={dead ? [Math.PI / 2, 0, 0] : [0, 0, 0]}>
      {c.kind === "hare" && (
        <>
          <mesh position={[0, s * 0.42, 0]} castShadow>
            <boxGeometry args={[s * 0.9, s * 0.7, s * 1.15]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
          <mesh position={[0, s * 0.72, s * 0.42]} castShadow>
            <boxGeometry args={[s * 0.55, s * 0.45, s * 0.5]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
          <mesh position={[-s * 0.12, s * 1.08, s * 0.36]} castShadow>
            <boxGeometry args={[s * 0.12, s * 0.42, s * 0.08]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
          <mesh position={[s * 0.12, s * 1.08, s * 0.36]} castShadow>
            <boxGeometry args={[s * 0.12, s * 0.42, s * 0.08]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
        </>
      )}
      {c.kind === "hart" && (
        <>
          <mesh position={[0, s * 0.5, 0]} castShadow>
            <boxGeometry args={[s * 0.7, s * 0.65, s * 1.35]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
          <mesh position={[0, s * 0.95, s * 0.55]} castShadow>
            <boxGeometry args={[s * 0.28, s * 0.55, s * 0.28]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
          <mesh position={[0, s * 1.2, s * 0.72]} castShadow>
            <boxGeometry args={[s * 0.38, s * 0.32, s * 0.42]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
          <mesh position={[-s * 0.12, s * 1.5, s * 0.62]} castShadow>
            <boxGeometry args={[s * 0.08, s * 0.38, s * 0.08]} />
            <meshStandardMaterial color="#d8c8a8" roughness={0.85} />
          </mesh>
          <mesh position={[s * 0.12, s * 1.5, s * 0.62]} castShadow>
            <boxGeometry args={[s * 0.08, s * 0.38, s * 0.08]} />
            <meshStandardMaterial color="#d8c8a8" roughness={0.85} />
          </mesh>
        </>
      )}
      {c.kind === "wolf" && (
        <>
          <mesh position={[0, s * 0.48, 0]} castShadow>
            <boxGeometry args={[s * 0.7, s * 0.55, s * 1.3]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
          <mesh position={[0, s * 0.7, s * 0.62]} castShadow>
            <boxGeometry args={[s * 0.5, s * 0.42, s * 0.5]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
          <mesh position={[0, s * 0.55, -s * 0.8]} castShadow>
            <boxGeometry args={[s * 0.16, s * 0.16, s * 0.5]} />
            <meshStandardMaterial color="#4a4a48" roughness={0.9} />
          </mesh>
        </>
      )}
      {c.kind === "wight" && (
        <>
          <mesh position={[0, 0.7, 0]} castShadow>
            <boxGeometry args={[0.32, 1.1, 0.22]} />
            <meshStandardMaterial color={color} roughness={0.7} transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, 1.35, 0]} castShadow>
            <boxGeometry args={[0.28, 0.28, 0.24]} />
            <meshStandardMaterial color="#ece6d8" roughness={0.6} />
          </mesh>
        </>
      )}
      {c.ownerId && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[0.22, 0.3, 12]} />
          <meshBasicMaterial color="#c9a36a" transparent opacity={0.7} />
        </mesh>
      )}
    </group>
  );
}

export function Fauna() {
  const fauna = useGame((s) => s.snap.fauna);
  return (
    <group>
      {fauna.map((c) => (
        <Beast key={c.id} c={c} />
      ))}
    </group>
  );
}
