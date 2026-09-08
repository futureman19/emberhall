import { Color } from "three";
import { useCharacterGeometry, type CharacterPart } from "./authored-character-data.ts";

export function AuthoredCharacterGeometry({ part, size, authored = true }: {
  part: CharacterPart; size: readonly [number, number, number]; authored?: boolean;
}) {
  const geometry = useCharacterGeometry(authored)?.[part];
  return geometry
    ? <primitive object={geometry} attach="geometry" dispose={null} />
    : <boxGeometry args={[...size]} />;
}

const noPick = () => {};
/** Head-local details: the character looks down negative Z, not toward the hair. */
export function AuthoredCharacterFace({ skin, authored = true, ghost = false }: {
  skin: string; authored?: boolean; ghost?: boolean;
}) {
  const geometry = useCharacterGeometry(authored);
  if (!geometry?.head || ghost) return null;
  return (
    <group>
      {[-0.1, 0.1].map(x => (
        <group key={x} position={[x, 0.015, -0.216]}>
          <mesh scale={[0.022, 0.032, 0.012]} raycast={noPick}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color="#29211e" roughness={0.65} />
          </mesh>
          <mesh position={[-0.006, 0.01, -0.011]} raycast={noPick}>
            <sphereGeometry args={[0.006, 8, 6]} />
            <meshBasicMaterial color="#fff3d9" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -0.035, -0.221]} scale={[0.025, 0.025, 0.023]} raycast={noPick}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color={skin} roughness={0.82} />
      </mesh>
    </group>
  );
}

/** Torso-local seams share the selected garb/equipment color and never pick. */
export function AuthoredCharacterTunic({ color, authored = true, ghost = false }: {
  color: string; authored?: boolean; ghost?: boolean;
}) {
  const geometry = useCharacterGeometry(authored);
  if (!geometry?.torso || ghost) return null;
  const seam = new Color(color).multiplyScalar(0.67);
  return (
    <group>
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * 0.04, 0.13, -0.153]} rotation={[0, 0, side * -0.55]} raycast={noPick}>
          <boxGeometry args={[0.018, 0.1, 0.012]} />
          <meshStandardMaterial color={seam} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}
