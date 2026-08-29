import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";

function DeathBody({ tx, ty }: { tx: number; ty: number }) {
  const y = groundY(getWorld(), tx, ty);
  return (
    <group position={[tx, y + 0.16, ty]} rotation={[Math.PI / 2, 0.35, 0]}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[0.4, 0.72, 0.26]} />
        <meshStandardMaterial color="#6a3a32" roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.64, 0.02]} castShadow>
        <boxGeometry args={[0.28, 0.26, 0.24]} />
        <meshStandardMaterial color="#c9c3b6" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.2, 0.14]} castShadow>
        <boxGeometry args={[0.48, 0.78, 0.1]} />
        <meshStandardMaterial color="#4a322c" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.08]}>
        <ringGeometry args={[0.28, 0.42, 12]} />
        <meshBasicMaterial color="#a85a42" transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

export function Piles() {
  const piles = useGame((s) => s.snap.piles);
  return (
    <group>
      {piles.map((p) => {
        if (p.source === "death") return <DeathBody key={p.id} tx={p.tx} ty={p.ty} />;
        const y = groundY(getWorld(), p.tx, p.ty);
        return (
          <mesh key={p.id} position={[p.tx, y + 0.12, p.ty]} castShadow>
            <boxGeometry args={[0.42, 0.16, 0.36]} />
            <meshStandardMaterial color={p.source === "corpse" ? "#6a4a42" : "#c9c3b6"} roughness={0.95} />
          </mesh>
        );
      })}
    </group>
  );
}
