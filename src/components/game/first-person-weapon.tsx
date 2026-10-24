import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, PerspectiveCamera } from "three";
import { useGame } from "@/game/store";
import { useGraphicsSettings } from "@/game/graphics-settings";
import { Held } from "./people-meshes";

/** Mounted after Rig so camera-relative placement uses this frame's pose. */
export function FirstPersonWeapon() {
  const root = useRef<Group>(null);
  const firstPerson = useGraphicsSettings().firstPerson;
  const id = useGame(s => s.snap.player.rares.find(r => r.uid === s.snap.player.wearRare.main)?.base ?? s.snap.player.wear.main);
  const ghost = useGame(s => s.snap.player.ghost);
  const playing = useGame(s => s.phase === "playing");
  useFrame(({ camera }) => {
    if (!root.current) return;
    root.current.position.copy(camera.position);
    root.current.quaternion.copy(camera.quaternion);
    // Scale the horizontal offset for portrait FOV, not just desktop width.
    const aspect = camera instanceof PerspectiveCamera ? camera.aspect : 1;
    root.current.scale.setScalar(Math.min(1, aspect / .9));
  });
  if (!firstPerson || ghost || !playing || !id) return null;
  return <group ref={root} name="emberhall-first-person-weapon">
    <group position={[.08, -.06, -.85]} rotation={[.12, -.22, -.24]} scale={.65}>
      <Held id={id} ghost={false} />
    </group>
  </group>;
}
