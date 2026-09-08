import { COURT } from "../../game/atlas.ts";
import { LANTERNWOOD, artNoise, lanternwoodInfluence, type ArtPart } from "./lanternwood-art.ts";

/** Fragment-only surfaces: no new geometry, elevations, collision or tile writes. */
export const LANTERNWOOD_GROUND_GLSL = `
float lwArea = 1.0 - smoothstep(${LANTERNWOOD.inner.toFixed(1)}, ${LANTERNWOOD.outer.toFixed(1)}, length(vWp.xz - vec2(${COURT.tx.toFixed(1)}, ${COURT.ty.toFixed(1)})));
if (lwArea > 0.0) {
  vec2 p = vWp.xz;
  float patches = noise(p * 0.28 + 13.7);
  float softPatch = smoothstep(0.28, 0.75, patches);
  float grassMask = smoothstep(0.30, 0.80, vCover.x);
  float earthMask = smoothstep(0.28, 0.7, vCover.y) * (1.0 - grassMask);
  float stoneMask = smoothstep(0.68, 0.86, vCover.z);
  // Broad, low-frequency color islands rather than high-frequency visual grit.
  vec3 meadow = mix(vec3(0.17, 0.27, 0.10), vec3(0.32, 0.40, 0.18), softPatch);
  meadow *= 0.92 + noise(p * 1.1) * 0.13;
  close = mix(close, meadow, grassMask * lwArea * 0.72);
  // Interpolated terrain cover keeps the worn route centre exposed. Only the
  // shoulders pick up irregular moss; no path coordinates or widths change.
  float verge = smoothstep(0.12, 0.43, vCover.x) * (1.0 - smoothstep(0.55, 0.82, vCover.x));
  float moss = smoothstep(0.40, 0.67, noise(p * 1.65 + 7.0));
  vec3 earth = mix(vec3(0.38, 0.29, 0.17), vec3(0.49, 0.40, 0.25), noise(p * 0.45));
  earth = mix(earth, meadow * 0.86, verge * moss * 0.7);
  close = mix(close, earth, earthMask * lwArea * 0.62);
  // Staggered hand-laid pavers with a softly bevelled edge and thin moss joints.
  vec2 row = vec2(p.x / 0.92 + mod(floor(p.y / 0.68), 2.0) * 0.5, p.y / 0.68);
  vec2 cell = floor(row);
  vec2 q = abs(fract(row) - 0.5);
  float edge = max(q.x, q.y);
  float aa = max(fwidth(edge), 0.008);
  float inset = 0.432 + hash(cell + 2.0) * 0.025;
  float face = 1.0 - smoothstep(inset - aa, inset + aa, edge);
  float bevel = smoothstep(0.32, inset, edge);
  vec3 stone = mix(vec3(0.38, 0.39, 0.30), vec3(0.58, 0.55, 0.42), hash(cell));
  stone *= 1.0 - bevel * 0.14;
  vec3 joint = mix(vec3(0.20, 0.22, 0.14), vec3(0.24, 0.32, 0.14), smoothstep(0.35, 0.68, noise(p * 0.9)));
  close = mix(close, mix(joint, stone, face), stoneMask * lwArea * 0.86);
}
`;

/** Compact clover, low grass and flat pebbles. No flowers/reagents or tall obstacles. */
export function groundClump(x: number, z: number): ArtPart[] {
  if (lanternwoodInfluence(x, z) < 0.25 || artNoise(x, z, 101) > 0.23) return [];
  const out: ArtPart[] = [];
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3;
    out.push({ shape: "round", position: [Math.cos(angle) * 0.09, 0.035, Math.sin(angle) * 0.09], scale: [0.085, 0.025, 0.075], color: i === 0 ? "#a2b875" : "#7d9f5e", glow: false, roof: false });
  }
  if (artNoise(x, z, 103) > 0.55) {
    out.push({ shape: "round", position: [0.26, 0.035, 0.1], scale: [0.11, 0.045, 0.085], color: "#b0aa8a", glow: false, roof: false });
  } else {
    for (let i = 0; i < 3; i++) out.push({ shape: "box", position: [0.2 + i * 0.04, 0.07 + i * 0.018, -0.1], scale: [0.023, 0.14 + i * 0.036, 0.026], color: "#95a963", glow: false, roof: false });
  }
  return out;
}
