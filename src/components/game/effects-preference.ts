import { useEffect, useState } from "react";
import { getGraphicsSettings, useGraphicsSettings } from "@/game/graphics-settings";

/**
 * One answer for "should the presentation calm down?": the player's own
 * Reduced effects setting, or their OS-level reduced-motion preference.
 * Weather simulation, sound and text feedback are unaffected — this only
 * gates visual flashes and transient action effects.
 */

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

let media: MediaQueryList | null = null;
function reducedMotionMedia(): MediaQueryList | null {
  if (media || typeof window === "undefined" || typeof window.matchMedia !== "function") return media;
  try {
    media = window.matchMedia(REDUCED_MOTION_QUERY);
  } catch {
    media = null;
  }
  return media;
}

/** Non-reactive read for frame loops; always current. */
export function effectsReduced(): boolean {
  if (getGraphicsSettings().reducedEffects) return true;
  return reducedMotionMedia()?.matches ?? false;
}

/** Reactive read for components: follows the setting and the OS preference. */
export function useEffectsReduced(): boolean {
  const graphics = useGraphicsSettings();
  const [motion, setMotion] = useState(() => reducedMotionMedia()?.matches ?? false);
  useEffect(() => {
    const mql = reducedMotionMedia();
    if (!mql) return;
    const onChange = (e: MediaQueryListEvent) => setMotion(e.matches);
    setMotion(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return graphics.reducedEffects || motion;
}
