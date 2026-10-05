import { useEffect, useState } from "react";
import { BufferAttribute, BufferGeometry, DoubleSide, type Group } from "three";
import { REEDWAKE_BRIDGE as bridge } from "@/game/river-bridge";
import { cloneFrontierArt, loadFrontierArt } from "./frontier-art-data";

const noPick = () => {};
const approach = new BufferGeometry();
approach.setAttribute(
  "position",
  new BufferAttribute(
    new Float32Array([3.5, 0.6, -1.5, 5.5, 0.2, -1.5, 3.5, 0.6, 1.5, 5.5, 0.2, 1.5]),
    3,
  ),
);
approach.setIndex([0, 2, 1, 1, 2, 3]);
approach.computeVertexNormals();
/** Art never owns collision or input; Terrain owns the canonical deck picking plane. */
export function RiverBridge() {
  const [scene, setScene] = useState<Group | null>(null);
  useEffect(() => {
    let active = true;
    void loadFrontierArt(bridge.url).then((source) => {
      if (active && source) setScene(cloneFrontierArt(source));
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <group name="reedwake-river-bridge" position={[bridge.x, bridge.waterY, bridge.z]}>
      {scene ? (
        <primitive object={scene} dispose={null} />
      ) : (
        <group name="river-bridge-fallback">
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              geometry={approach}
              scale={[side, 1, 1]}
              raycast={noPick}
              dispose={null}
            >
              <meshStandardMaterial color="#77775f" side={DoubleSide} />
            </mesh>
          ))}
          <mesh raycast={noPick} position={[0, 0.54, 0]} receiveShadow>
            <boxGeometry args={[7, 0.12, 3.2]} />
            <meshStandardMaterial color="#936d41" roughness={0.95} />
          </mesh>
          {[-1.7, 1.7].map((z) => (
            <mesh key={z} raycast={noPick} position={[0, 1.1, z]}>
              <boxGeometry args={[6.8, 0.12, 0.15]} />
              <meshStandardMaterial color="#62472e" />
            </mesh>
          ))}
          {[-3.5, 3.5].map((x) => (
            <mesh key={x} raycast={noPick} position={[x, 0.25, 0]}>
              <boxGeometry args={[1, 0.5, 3.7]} />
              <meshStandardMaterial color="#77775f" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
