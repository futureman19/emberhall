import { RiverBridge } from "./river-bridge";
import { useEffect, useMemo, useState } from "react";
import type { Group } from "three";
import { FRONTIER_CHUNK, visibleFrontierArt, type FrontierArt } from "@/game/frontier";
import { getWorld } from "@/game/live";
import { groundY } from "@/game/height";
import { useGame } from "@/game/store";
import { cloneFrontierArt, loadFrontierArt } from "./frontier-art-data";

const noPick = () => {};
function Landmark({ placement: p }: { placement: FrontierArt }) {
  const [scene, setScene] = useState<Group | null>(null);
  useEffect(() => {
    let active = true;
    void loadFrontierArt(p.url).then((source) => {
      if (active && source) setScene(cloneFrontierArt(source));
    });
    return () => {
      active = false;
    };
  }, [p.url]);
  const y = "y" in p ? p.y : groundY(getWorld(), p.x, p.z);
  return (
    <group name={`frontier-${p.id}`} position={[p.x, y, p.z]}>
      {scene ? (
        <primitive object={scene} dispose={null} />
      ) : p.id === "reedwake-crossing" ? (
        <group name="waterfront-fallback">
          {/* Static wreck/deck at their authored waterline, not another display slab. */}
          <mesh raycast={noPick} position={[-3, 0.62, -0.95]}>
            <boxGeometry args={[1.55, 0.5, 5.5]} />
            <meshStandardMaterial color="#685039" />
          </mesh>
          <mesh raycast={noPick} position={[-0.95, 1.335, 0.7]}>
            <boxGeometry args={[2.976, 0.13, 1.78]} />
            <meshStandardMaterial color="#826341" />
          </mesh>
          {[-2.2, 0.3].flatMap((x) =>
            [-0.0, 1.4].map((z) => (
              <mesh key={`${x},${z}`} raycast={noPick} position={[x, 0.82, z]}>
                <boxGeometry args={[0.23, 1, 0.23]} />
                <meshStandardMaterial color="#685039" />
              </mesh>
            )),
          )}
          {p.blocks.slice(4).map(([x0, z0, x1, z1], i) => (
            <mesh key={i} raycast={noPick} position={[(x0 + x1) / 2, 1.1, (z0 + z1) / 2]}>
              <boxGeometry args={[x1 - x0, 0.6, z1 - z0]} />
              <meshStandardMaterial color="#766b55" />
            </mesh>
          ))}
        </group>
      ) : (
        <group name="frontier-fallback">
          {/* Low stone silhouettes exactly preserve blocked footprints; openings stay open. */}
          {p.blocks.map(([x0, z0, x1, z1], i) => (
            <mesh key={i} raycast={noPick} position={[(x0 + x1) / 2, 0.3, (z0 + z1) / 2]}>
              <boxGeometry args={[x1 - x0, 0.6, z1 - z0]} />
              <meshStandardMaterial color="#766b55" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

/** Bounded chunk membership; smooth motion does not rescan terrain or rebuild clones. */
export function FrontierScenery() {
  const cx = useGame((s) => Math.floor(s.snap.youX / FRONTIER_CHUNK));
  const cz = useGame((s) => Math.floor(s.snap.youZ / FRONTIER_CHUNK));
  const placements = useMemo(
    () => visibleFrontierArt(cx * FRONTIER_CHUNK, cz * FRONTIER_CHUNK),
    [cx, cz],
  );
  return (
    <group name="frontier-scenery">
      {Math.abs(cx * FRONTIER_CHUNK - 952) < 96 && Math.abs(cz * FRONTIER_CHUNK - 560) < 96 && (
        <RiverBridge />
      )}
      {placements.map((p) => (
        <Landmark key={p.id} placement={p} />
      ))}
    </group>
  );
}
