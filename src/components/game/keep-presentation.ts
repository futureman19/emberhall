import { KEEP } from "../../game/city.ts";
import { insideKeep, onKeepStairs } from "../../game/keep-story.ts";

/** Inside-only opening at the south mouth of the original east staircase. */
export function keepStairCut(v: { x: number; y: number; z: number; t: string }, story: number) {
  const floor = Math.round(story) * 4;
  const foregroundTower = v.x >= 18 && v.z >= 12 && v.y > floor;
  const stairMouth = v.t === "timber" && v.x >= 15 && v.x <= 18 && v.z >= 11 && v.z <= 14 && v.y > 0;
  // The east lip of the occupied deck sits in front of lower tread centres
  // in the fixed southeast view. Remove it visually AND from raycasting;
  // retaining an invisible pick proxy would still command the deck tile.
  const stairEastLip = v.t === "timber" && v.x >= 19 && v.x <= 20 && v.z >= -9 && v.z <= 14 && v.y > 0;
  return foregroundTower || stairMouth || stairEastLip;
}

/** Presentation only: retain the authoritative story and simulation position. */
export function keepPlayerOffset(x: number, z: number) {
  if (!insideKeep(x, z)) return 0;
  if (!onKeepStairs(x, z)) return .51;
  // Original makeKeep uses half-tile treads, fused boxes and a 19-row rise.
  let tread = 0;
  for (let vz = -9; vz <= 10; vz++) {
    if (Math.abs(KEEP.ty + (vz + .5) * .5 - z) <= .26001) {
      tread = Math.max(tread, Math.round((10 - vz) / 19 * 12) * .5);
    }
  }
  const slope = Math.min(6, Math.max(0, (325 - z) * 2 / 3));
  return .51 + tread - slope;
}
