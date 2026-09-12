import { FAUNA_META } from "./catalog.ts";
import { isGhost, you, effSkill } from "./player.ts";
import { tryGain } from "./skills.ts";
import { log } from "./world.ts";
import type { World } from "./types.ts";

/** Tiles you can read. 12 at 0, 37 at 100. */
export function trackingRange(skill: number) {
  return 12 + Math.floor(Math.max(0, skill) / 4);
}

/** Souls (people) join the trail once the skill is taught in the body. */
export const TRACK_SOUL = 40;

const BEARINGS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"] as const;

/** +x is east, −z is north (Ridgewatch sits on smaller ty). */
export function compassOf(dx: number, dz: number) {
  if (dx * dx + dz * dz < 0.16) return "here";
  const a = Math.atan2(dx, -dz);
  const oct = Math.round((((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  return BEARINGS[oct]!;
}

function paces(distance: number) {
  return Math.max(1, Math.round(distance));
}

export function commandTrack(world: World) {
  if (isGhost(world)) return "A ghost cannot.";
  const self = you(world);
  if (!self) return "You are not in the vale.";
  const skill = effSkill(world, "tracking");
  const range = trackingRange(skill);
  let best: { name: string; x: number; z: number; d: number } | null = null;

  const consider = (name: string, x: number, z: number) => {
    const d = Math.hypot(x - self.x, z - self.z);
    if (d > range || d < 0.45) return;
    if (!best || d < best.d) best = { name, x, z, d };
  };

  for (const c of world.fauna) {
    if (c.task === "dead" || c.ownerId) continue;
    consider(FAUNA_META[c.kind].label, c.x, c.z);
  }
  if (skill >= TRACK_SOUL) {
    for (const person of world.people) {
      if (person.isPlayer || person.id === world.player.id) continue;
      consider(person.name, person.x, person.z);
    }
  }

  tryGain(world, "tracking", true, Boolean(best));
  if (!best) {
    const note = "The trail is cold.";
    log(world, note);
    return note;
  }
  const mark = best;
  self.facing = Math.atan2(mark.x - self.x, mark.z - self.z);
  const bearing = compassOf(mark.x - self.x, mark.z - self.z);
  const n = paces(mark.d);
  const note =
    bearing === "here" ? `${mark.name}, at your feet.` : `${mark.name}, ${bearing}, ${n} pace${n === 1 ? "" : "s"}.`;
  log(world, note);
  return note;
}
