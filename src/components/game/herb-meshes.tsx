import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";
import type { HerbKind, HerbPatch } from "@/game/types";
import { useFloraGeometry } from "./flora-art";
import { noArtRaycast } from "./lanternwood-art";

/** Wild reagent patches. Ready ones glow faintly in their kind's palette;
 *  picked ones slump grey until they regrow. */

const READY_GLOW: Record<HerbKind, string> = {
  moss: "#8a3040",
  mandrake: "#8a6ab8",
  ginseng: "#8ab86a",
  ash: "#e8d89a",
  pearl: "#b8c8e8",
};

function MossMesh({ ready }: { ready: boolean }) {
  const color = ready ? "#7a3040" : "#4a4038";
  return (
    <group>
      <mesh scale={[1, 0.38, 1]} castShadow>
        <sphereGeometry args={[0.3, 8, 6]} />
        <meshStandardMaterial color={color} roughness={0.95} emissive={ready ? READY_GLOW.moss : "#000000"} emissiveIntensity={ready ? 0.25 : 0} />
      </mesh>
      <mesh position={[0.18, 0.02, 0.12]} scale={[1, 0.3, 1]}>
        <sphereGeometry args={[0.18, 7, 5]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
    </group>
  );
}

function MandrakeMesh({ ready }: { ready: boolean }) {
  const color = ready ? "#5a4468" : "#453f3a";
  return (
    <group>
      <mesh position={[-0.07, 0.16, 0]} rotation={[0, 0, 0.28]} castShadow>
        <coneGeometry args={[0.09, 0.4, 6]} />
        <meshStandardMaterial color={color} roughness={0.9} emissive={ready ? READY_GLOW.mandrake : "#000000"} emissiveIntensity={ready ? 0.22 : 0} />
      </mesh>
      <mesh position={[0.08, 0.13, 0.03]} rotation={[0, 0, -0.34]}>
        <coneGeometry args={[0.07, 0.32, 6]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </group>
  );
}

function GinsengMesh({ ready }: { ready: boolean }) {
  const leaf = ready ? "#6a8a54" : "#4a4a3a";
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[Math.cos((i * 2.1) + 0.4) * 0.12, 0.14, Math.sin((i * 2.1) + 0.4) * 0.12]} rotation={[0.5, (i * 2.1) + 0.4, 0]} castShadow={i === 0}>
          <coneGeometry args={[0.08, 0.34, 5]} />
          <meshStandardMaterial color={leaf} roughness={0.92} emissive={ready ? READY_GLOW.ginseng : "#000000"} emissiveIntensity={ready ? 0.18 : 0} />
        </mesh>
      ))}
      {ready && (
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.06, 6, 5]} />
          <meshStandardMaterial color="#c94a3a" emissive="#c94a3a" emissiveIntensity={0.35} roughness={0.6} />
        </mesh>
      )}
    </group>
  );
}

function AshMesh({ ready }: { ready: boolean }) {
  const color = ready ? "#d8d0ba" : "#555048";
  return (
    <group>
      <mesh position={[0, 0.14, 0]} castShadow>
        <octahedronGeometry args={[0.16]} />
        <meshStandardMaterial color={color} roughness={0.55} emissive={ready ? READY_GLOW.ash : "#000000"} emissiveIntensity={ready ? 0.3 : 0} />
      </mesh>
      <mesh position={[0.16, 0.08, 0.08]} rotation={[0.4, 0.8, 0]}>
        <octahedronGeometry args={[0.1]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      <mesh position={[-0.13, 0.06, 0.1]} rotation={[0.2, -0.5, 0.3]}>
        <octahedronGeometry args={[0.08]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
    </group>
  );
}

function PearlMesh({ ready }: { ready: boolean }) {
  const shell = ready ? "#d8cfc0" : "#55504a";
  return (
    <group>
      <mesh scale={[1, 0.42, 1.15]} castShadow>
        <sphereGeometry args={[0.24, 9, 7]} />
        <meshStandardMaterial color={shell} roughness={0.7} />
      </mesh>
      {ready && (
        <mesh position={[0, 0.13, 0]}>
          <sphereGeometry args={[0.09, 8, 6]} />
          <meshStandardMaterial color="#23233a" emissive={READY_GLOW.pearl} emissiveIntensity={0.5} roughness={0.25} />
        </mesh>
      )}
    </group>
  );
}

function Herb({ patch }: { patch: HerbPatch }) {
  const flora = useFloraGeometry();
  const hour = useGame((s) => s.snap.hour);
  const ready = hour >= patch.until;
  const authored = flora?.[`herb_${patch.kind}_${ready ? "ready" : "picked"}`];
  const y = groundY(getWorld(), patch.tx, patch.ty);
  return (
    <group position={[patch.tx, y + 0.06, patch.ty]} scale={ready ? 1 : 0.62}>
      {authored ? <mesh name={`authored-herb-${patch.kind}-${ready ? "ready" : "picked"}`} geometry={authored} raycast={noArtRaycast} castShadow dispose={null}>
        <meshStandardMaterial color="#ffffff" vertexColors roughness={0.9} emissive={ready ? READY_GLOW[patch.kind] : "#000000"} emissiveIntensity={ready ? 0.12 : 0} />
      </mesh> : <>
      {patch.kind === "moss" && <MossMesh ready={ready} />}
      {patch.kind === "mandrake" && <MandrakeMesh ready={ready} />}
      {patch.kind === "ginseng" && <GinsengMesh ready={ready} />}
      {patch.kind === "ash" && <AshMesh ready={ready} />}
      {patch.kind === "pearl" && <PearlMesh ready={ready} />}
      </> }
    </group>
  );
}

export function Herbs() {
  const herbs = useGame((s) => s.snap.herbs);
  return (
    <group>
      {herbs.map((h) => (
        <Herb key={h.id} patch={h} />
      ))}
    </group>
  );
}
