import * as THREE from "three";

/**
 * Where the sun (or moon) hangs, by vale hour. The sun rises in the east
 * around 05:30, stands high at mid-day, sets west near 20:30; night keeps a
 * fixed pale moon. Renderer-only — sim code never sees THREE.
 */

const MOON_DIR = new THREE.Vector3(-0.3, 0.72, 0.42).normalize();

export function sunDirFor(hour: number): THREE.Vector3 {
  const h = ((hour % 24) + 24) % 24;
  if (h < 5.5 || h > 20.5) return MOON_DIR.clone();
  const f = (h - 5.5) / 15;
  const az = Math.PI * f;
  const elev = Math.sin(az);
  return new THREE.Vector3(
    Math.cos(az) * 0.9,
    Math.max(elev, 0.12) * 0.95,
    Math.sin(az) * 0.5 - 0.3,
  ).normalize();
}

/** 0 at dawn/dusk rim, 1 at mid-day — drives sun color and strength. */
export function sunHeight(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (h < 5.5 || h > 20.5) return 0;
  return Math.sin((Math.PI * (h - 5.5)) / 15);
}

/** Warm low sun → pale noon. */
export function sunColorFor(hour: number, out: THREE.Color): THREE.Color {
  const t = Math.min(1, sunHeight(hour) * 1.6);
  return out.set("#f0a05c").lerp(NOON, t);
}

const NOON = new THREE.Color("#fff1c8");

/**
 * Lightning flash amount 0..1, decayed in lighting.tsx, read by the sky dome
 * and cloud layer so the whole heavens answer the same strike.
 */
export const skyFlash = { v: 0 };
