import { useEffect, useState, type ReactNode } from "react";
import type { Group } from "three";
import type { FaunaKind } from "@/game/types";
import { faunaArtEnabled } from "./fauna-art-catalog.ts";
import { cloneFaunaArt, loadFaunaArt } from "./fauna-art-data.ts";

/** Visual-only child of Beast's original animated root. No new limb timing. */
export function FaunaArtBody({ kind, size, children }: {
  kind: FaunaKind;
  size: number;
  children: ReactNode;
}) {
  const enabled = typeof window !== "undefined" && faunaArtEnabled(window.location.search);
  const [loaded, setLoaded] = useState<{ kind: FaunaKind; scene: Group } | null>(null);
  const scene = enabled && loaded?.kind === kind ? loaded.scene : null;
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void loadFaunaArt(kind).then((source) => {
      if (active && source) setLoaded({ kind, scene: cloneFaunaArt(source) });
    });
    return () => { active = false; };
  }, [kind, enabled]);
  return <>
    {/* Three Raycaster traverses hidden groups; WebGL color/shadow passes do not. */}
    <group name="fauna-original-pick-proxy" visible={!scene}>{children}</group>
    {scene && <primitive object={scene} scale={size} dispose={null} />}
  </>;
}
