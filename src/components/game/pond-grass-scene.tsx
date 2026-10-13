import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { COURT } from "../../game/atlas.ts";
import { getWorld } from "../../game/live.ts";
import { createPondGrass } from "./pond-grass.ts";

export function PondGrass() {
  const group = useRef<Group>(null);
  const runtime = useRef<ReturnType<typeof createPondGrass> | null>(null);
  // Effect ownership recreates GPU resources on StrictMode replay; nothing is
  // constructed in an abandoned render, and no disposed memo is reused.
  useEffect(() => {
    const grass = createPondGrass();
    const parent = group.current;
    parent?.add(grass.mesh);
    runtime.current = grass;
    return () => {
      runtime.current = null;
      parent?.remove(grass.mesh);
      grass.dispose();
    };
  }, []);
  useFrame((_, delta) => {
    const w = getWorld();
    let x = COURT.tx, z = COURT.ty;
    for (const person of w.people) if (person.isPlayer) { x = person.x; z = person.z; break; }
    runtime.current?.update(w, x, z, delta);
  });
  return <group ref={group} dispose={null} />;
}
