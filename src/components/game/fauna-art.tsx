import { useEffect, useState, type ReactNode } from "react";
import type { Group } from "three";
import type { FaunaKind } from "@/game/types";
import { faunaArtEnabled, type FaunaSpellArt } from "./fauna-art-catalog.ts";
import { applyRisenLook, cloneFaunaArt, loadFaunaArt } from "./fauna-art-data.ts";

/** Visual-only child of Beast's original animated root. No new limb timing. */
export function FaunaArtBody({ kind, size, art, children }: {
  kind: FaunaKind;
  size: number;
  art?: FaunaSpellArt;
  children: ReactNode;
}) {
  const enabled = typeof window !== "undefined" && faunaArtEnabled(window.location.search);
  const key = `${kind}:${art ?? ""}`;
  const [loaded, setLoaded] = useState<{ key: string; scene: Group } | null>(null);
  const scene = enabled && loaded?.key === key ? loaded.scene : null;
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void loadFaunaArt(kind, art).then((source) => {
      if (active && source) {
        const cloned = cloneFaunaArt(source);
        setLoaded({ key, scene: art === "risen" ? applyRisenLook(cloned) : cloned });
      }
    });
    return () => { active = false; };
  }, [kind, art, enabled, key]);
  return <>
    {/* Three Raycaster traverses hidden groups; WebGL color/shadow passes do not. */}
    <group name="fauna-original-pick-proxy" visible={!scene}>{children}</group>
    {scene && <primitive object={scene} scale={size} dispose={null} />}
  </>;
}
