import { useDeathGeometry } from "./death-geometry.ts";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";
import { useFieldPropGeometry } from "./field-prop-art";
import { noArtRaycast } from "./lanternwood-art";

function DeathBody({ tx, ty }: { tx: number; ty: number }) {
  const parts = useDeathGeometry();
  const y = groundY(getWorld(), tx, ty);
  return (
    <group position={[tx, y + 0.16, ty]} rotation={[Math.PI / 2, 0.35, 0]}>
      <mesh position={[0, 0.22, 0]} castShadow={!parts}>
        <boxGeometry args={[0.4, 0.72, 0.26]} />
        <meshStandardMaterial color="#6a3a32" roughness={0.92} colorWrite={!parts} depthWrite={!parts} />
      </mesh>
      <mesh position={[0, 0.64, 0.02]} castShadow={!parts}>
        <boxGeometry args={[0.28, 0.26, 0.24]} />
        <meshStandardMaterial color="#c9c3b6" roughness={0.85} colorWrite={!parts} depthWrite={!parts} />
      </mesh>
      <mesh position={[0, 0.2, 0.14]} castShadow={!parts}>
        <boxGeometry args={[0.48, 0.78, 0.1]} />
        <meshStandardMaterial color="#4a322c" roughness={0.95} colorWrite={!parts} depthWrite={!parts} />
      </mesh>
      {parts && <group>
        <mesh name="authored-death-tunic" geometry={parts.death_tunic} position={[0, 0.22, 0]} castShadow raycast={noArtRaycast} dispose={null}><meshStandardMaterial color="#6a3a32" roughness={0.92} /></mesh>
        <mesh name="authored-death-head" geometry={parts.death_head} position={[0, 0.64, 0.02]} castShadow raycast={noArtRaycast} dispose={null}><meshStandardMaterial color="#c9c3b6" roughness={0.85} /></mesh>
        <mesh name="authored-death-shroud" geometry={parts.death_shroud} position={[0, 0.2, 0.14]} castShadow raycast={noArtRaycast} dispose={null}><meshStandardMaterial color="#4a322c" roughness={0.95} /></mesh>
      </group>}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.08]}>
        <ringGeometry args={[0.28, 0.42, 12]} />
        <meshBasicMaterial color="#a85a42" transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

export function Piles() {
  const props = useFieldPropGeometry();
  const piles = useGame((s) => s.snap.piles);
  return (
    <group>
      {piles.map((p) => {
        if (p.source === "death") return <DeathBody key={p.id} tx={p.tx} ty={p.ty} />;
        const y = groundY(getWorld(), p.tx, p.ty);
        return (
          <group key={p.id}>
            {props && <mesh name={`authored-loot-${p.id}`} geometry={props.field_pouch} position={[p.tx, y + 0.04, p.ty]} castShadow raycast={noArtRaycast} dispose={null}>
              <meshStandardMaterial color={p.source === "corpse" ? "#997367" : "#ffffff"} vertexColors roughness={0.95} />
            </mesh>}
            <mesh position={[p.tx, y + 0.12, p.ty]} castShadow={!props}>
              <boxGeometry args={[0.42, 0.16, 0.36]} />
              <meshStandardMaterial color={p.source === "corpse" ? "#6a4a42" : "#c9c3b6"} roughness={0.95} colorWrite={!props} depthWrite={!props} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
