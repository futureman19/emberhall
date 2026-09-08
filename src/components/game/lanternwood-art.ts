import { COURT } from "../../game/atlas.ts";
import type { BuildingKind } from "../../game/types.ts";

/** Render-only art direction. Never imported by generation, collision or saves. */
export const LANTERNWOOD = Object.freeze({ inner: 13, outer: 32 });
export const LW_COLOR = Object.freeze({
  cream: "#e6d5a8", honey: "#b98950", beam: "#66503c", jade: "#58876a",
  moss: "#78905a", leaf: "#709766", roof: "#76533b", roofEdge: "#a68157",
  red: "#ad5546", gold: "#d6b46e", paper: "#ffda91", stone: "#aaa68a",
});
export function lanternwoodInfluence(x: number, z: number): number {
  const d = Math.hypot(x - COURT.tx, z - COURT.ty);
  if (!Number.isFinite(d) || d >= LANTERNWOOD.outer) return 0;
  if (d <= LANTERNWOOD.inner) return 1;
  const t = (d - LANTERNWOOD.inner) / (LANTERNWOOD.outer - LANTERNWOOD.inner);
  return 1 - t * t * (3 - 2 * t);
}
export const LANTERNWOOD_BLOCKS: Readonly<Record<string, string>> = Object.freeze({
  timber: LW_COLOR.honey, dark: LW_COLOR.beam, cobble: LW_COLOR.stone,
  stone: LW_COLOR.cream, thatch: LW_COLOR.moss, leaf: LW_COLOR.jade,
});
export function lanternwoodGround(kind: string): string | null {
  if (kind === "grass" || kind === "tree" || kind === "marsh") return LW_COLOR.moss;
  if (kind === "cobble" || kind === "step") return LW_COLOR.stone;
  if (kind === "dirt" || kind === "road") return "#b29b70";
  return null;
}
/** Pure local hash, independent of the world's resource/combat RNG stream. */
export function artNoise(x: number, z: number, salt = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(salt, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export interface ArtPart {
  shape: "box" | "round";
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  glow: boolean;
  roof: boolean;
  rotation?: [number, number, number];
}
function part(out: ArtPart[], x: number, y: number, z: number, sx: number, sy: number, sz: number,
  color: string, shape: ArtPart["shape"] = "box", glow = false, roof = false) {
  out.push({ shape, position: [x, y, z], scale: [sx, sy, sz], color, glow, roof });
}
function lantern(out: ArtPart[], x: number, y: number, z: number, roof = false) {
  part(out, x, y + 0.44, z, 0.045, 0.35, 0.045, LW_COLOR.beam, "box", false, roof);
  part(out, x, y, z, 0.28, 0.36, 0.28, LW_COLOR.paper, "round", true, roof);
  for (const dy of [-0.32, 0.32]) part(out, x, y + dy, z, 0.35, 0.07, 0.35, LW_COLOR.beam, "box", false, roof);
  // Slender ribs make paper lanterns read as crafted objects, not floating orbs.
  for (const dx of [-0.21, 0.21]) part(out, x + dx, y, z + 0.13, 0.025, 0.5, 0.025, LW_COLOR.gold, "box", false, roof);
  part(out, x, y - 0.48, z, 0.045, 0.19, 0.045, LW_COLOR.red, "box", false, roof);
}
function planter(out: ArtPart[], x: number, z: number) {
  part(out, x, 0.22, z, 0.7, 0.4, 0.5, LW_COLOR.honey);
  part(out, x, 0.43, z, 0.76, 0.07, 0.56, LW_COLOR.beam);
  for (let i = -1; i <= 1; i++) {
    part(out, x + i * 0.23, 0.58, z, 0.22, 0.2, 0.24, LW_COLOR.jade, "round");
    part(out, x + i * 0.23, 0.76, z, 0.08, 0.09, 0.08, i === 0 ? LW_COLOR.paper : LW_COLOR.red, "round");
  }
}
/** Architectural ornaments stay on existing hall/bank footprint edges. */
export function buildingDressing(kind: BuildingKind): ArtPart[] {
  const out: ArtPart[] = [];
  if (kind !== "hall" && kind !== "bank") return out;
  const hall = kind === "hall";
  const rows = hall ? 5 : 3;
  // Seat ceramic skins on the existing half-unit voxel roof courses.
  // Hall gable: y=5..9, z=-5..3; bank pyramid: y=4..6, z=-3..3.
  // Bank courses taper in X as well as Z: a full-width ridge would float.
  for (let row = 0; row < rows; row++) {
    const width = hall ? 4.56 : 4.56 - row;
    const depth = (hall ? 4.56 : 3.56) - row;
    const y = (hall ? 3.025 : 2.525) + row * 0.5;
    const z = hall ? -0.25 : 0.25;
    part(out, 0.25, y, z, width, 0.12, depth, LW_COLOR.roof, "box", false, true);
    // Individually sized shingles sit on the stepped roof, with quiet color
    // variation and staggered joints instead of flat ceramic slabs.
    const shingles = Math.ceil(width / 0.34);
    for (const side of [-1, 1]) for (let i = 0; i < shingles; i++) {
      const sx = width / shingles;
      const xx = 0.25 - width / 2 + sx * (i + 0.5);
      const shade = artNoise(i, row, side + 17);
      const color = shade < 0.3 ? "#896247" : shade < 0.7 ? "#79553c" : "#9a7552";
      part(out, xx, y + 0.075 + shade * 0.018, z + side * (depth / 2 - 0.24), sx * 0.94, 0.08, 0.5, color, "box", false, true);
    }
    if (row === 0) for (const side of [-1, 1]) {
      part(out, 0.25, y - 0.04, z + side * (depth / 2 - 0.025), width + 0.08, 0.16, 0.1, LW_COLOR.beam, "box", false, true);
    }
  }
  part(out, 0.25, hall ? 5.12 : 3.62, hall ? -0.25 : 0.25, hall ? 4.56 : 2.56, 0.12, 0.22, LW_COLOR.roofEdge, "box", false, true);
  if (hall) {
    for (const x of [-2, 2.5]) {
      // Substantial stone cornice and open crenellations replace pavilion caps.
      part(out, x, 5.9, 2, 1.38, 0.26, 1.38, "#b5ac91", "box", false, true);
      for (const dx of [-0.47, 0.47]) for (const dz of [-0.47, 0.47]) {
        part(out, x + dx, 6.16, 2 + dz, 0.42, 0.55, 0.42, "#ccc1a0", "box", false, true);
        part(out, x + dx, 6.45, 2 + dz, 0.46, 0.10, 0.46, "#d5cbae", "box", false, true);
      }
      // Shallow dressed-stone faces: align with existing tower mass and leave
      // the lower slit windows clear. No footprint or world-height changes.
      for (let course = 0; course < 11; course++) {
        const y = 0.32 + course * 0.48;
        for (let block = 0; block < 2; block++) {
          const xx = x + (block === 0 ? -0.25 : 0.25);
          if (course === 3 || course === 5) continue;
          const stone = artNoise(course, block, x < 0 ? 40 : 41) > 0.5 ? "#c4b99b" : "#b4aa90";
          part(out, xx, y, 2.51, 0.465, 0.445, 0.06, stone, "box", false, true);
        }
      }
      // Long heraldic banners, not a different architectural vocabulary.
      part(out, x, 4.22, 2.56, 0.65, 1.65, 0.04, "#923f35", "box", false, true);
      for (const dx of [-0.30, 0.30]) part(out, x + dx, 4.22, 2.59, 0.035, 1.65, 0.025, LW_COLOR.gold, "box", false, true);
      for (const y of [3.41, 5.03]) part(out, x, y, 2.59, 0.65, 0.04, 0.025, LW_COLOR.gold, "box", false, true);
      part(out, x, 4.28, 2.62, 0.2, 0.2, 0.03, LW_COLOR.gold, "box", false, true);
      out[out.length - 1]!.rotation = [0, 0, Math.PI / 4];
      part(out, x, 5.16, 2.61, 0.85, 0.06, 0.06, LW_COLOR.beam, "box", false, true);
    }
    // Small ivy clusters at the outer foundation corners, never over the door.
    for (const side of [-1, 1]) for (let i = 0; i < 7; i++) {
      part(out, (side < 0 ? -2.58 : 3.08) + Math.sin(i * 2) * 0.06, 0.3 + i * 0.16, 2.25 + Math.cos(i) * 0.16, 0.13, 0.10, 0.12, i % 2 ? "#7d965e" : "#5f8052", "round", false, true);
    }
  }
  const face = hall ? 2.7 : 1.6;
  const edge = hall ? 1.3 : 1.15;
  for (const x of [-edge, edge + 0.5]) {
    lantern(out, x, hall ? 1.85 : 1.45, face, true);
    planter(out, x, face - 0.22);
  }
  // Short heraldic cloths flank the opening; the centre remains visibly walkable.
  for (const x of [-0.5, 0.9]) {
    part(out, x, hall ? 1.9 : 1.4, face - 0.05, 0.34, 0.52, 0.055, LW_COLOR.red, "box", false, true);
    part(out, x, hall ? 1.92 : 1.42, face, 0.1, 0.1, 0.025, LW_COLOR.gold, "box", false, true);
  }
  part(out, 0.25, hall ? 2.24 : 1.74, face, 2.2, 0.1, 0.12, LW_COLOR.honey, "box", false, true);
  return out;
}
export interface GardenSite { x: number; z: number; variant: number }
/** Side gardens only; never add an apparent obstacle on spawn cobbles or roads. */
export function gardenSites(): GardenSite[] {
  const out: GardenSite[] = [];
  for (let z = -12; z <= 12; z += 3) for (let x = -15; x <= 15; x += 3) {
    if (Math.abs(x) < 10 || lanternwoodInfluence(COURT.tx + x, COURT.ty + z) < 0.55) continue;
    if (artNoise(x, z, 2) < 0.34) out.push({ x: COURT.tx + x + artNoise(x, z, 3) * 0.4, z: COURT.ty + z, variant: Math.floor(artNoise(x, z, 4) * 3) });
  }
  return out;
}
export function gardenDressing(variant: number): ArtPart[] {
  const out: ArtPart[] = [];
  // Moss cushions, cream pebble rims, and tiny mushroom families.
  part(out, 0, 0.09, 0, 0.85, 0.13, 0.62, LW_COLOR.moss, "round");
  for (let i = 0; i < 5; i++) {
    const a = i * 1.7;
    part(out, Math.cos(a) * 0.68, 0.08, Math.sin(a) * 0.48, 0.17, 0.1, 0.14, LW_COLOR.stone, "round");
  }
  if (variant === 0) {
    // A squat stone lantern with a roof, not an interactable shrine/entity.
    part(out, 0, 0.3, 0, 0.3, 0.5, 0.3, LW_COLOR.stone);
    part(out, 0, 0.65, 0, 0.2, 0.2, 0.2, LW_COLOR.paper, "box", true);
    part(out, 0, 0.85, 0, 0.65, 0.12, 0.65, LW_COLOR.roofEdge);
    part(out, 0, 0.97, 0, 0.4, 0.12, 0.4, LW_COLOR.roof);
  } else {
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.33;
      const h = 0.25 + (i % 2) * 0.15;
      part(out, x, h / 2 + 0.12, 0, 0.07, h, 0.07, LW_COLOR.cream);
      part(out, x, h + 0.12, 0, 0.21, 0.1, 0.2, variant === 1 ? LW_COLOR.red : LW_COLOR.paper, "round");
    }
  }
  return out;
}
/** Shared raycast noop is installed on every decorative mesh, not just its group. */
export function noArtRaycast(): void { /* Visual only. */ }
export function fireflyPosition(index: number, time: number): [number, number, number] {
  const angle = artNoise(index, 4, 17) * Math.PI * 2;
  const r = 5 + artNoise(index, 8, 19) * 10;
  return [COURT.tx + Math.cos(angle) * r + Math.sin(time * 0.3 + index) * 0.3,
    0.8 + artNoise(index, 2, 23) * 1.8 + Math.sin(time * 0.6 + index) * 0.17,
    COURT.ty + Math.sin(angle) * r + Math.cos(time * 0.23 + index) * 0.3];
}
