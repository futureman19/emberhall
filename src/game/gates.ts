import { STATIONS, stationById } from "./atlas.ts";
import { nearestWalkable } from "./pathfinding.ts";
import { playSfx } from "./vale-sfx.ts";
import { completeObjective, revealAround } from "./world.ts";
import type { World } from "./types.ts";

export function phaseName(hour: number) {
  const p = Math.floor((hour / 24) % 8);
  return ["New", "Waxing crescent", "First quarter", "Waxing gibbous", "Full", "Waning gibbous", "Last quarter", "Waning crescent"][p]!;
}

export function trammelPhase(hour: number) {
  return phaseName(hour);
}

export function commandTravel(world: World, destId: string): string | null {
  const st = stationById(destId);
  if (!st) return "No such ring.";
  const p = world.people.find((x) => x.isPlayer);
  if (!p) return "You are not in the vale.";
  const dest = nearestWalkable(world, st.tx, st.ty + 2);
  if (!dest) return "The swirl will not take you.";
  p.x = dest.x;
  p.z = dest.y;
  p.path = [];
  world.player.intent.kind = "none";
  world.player.gateCoolUntil = world.hour + 0.05;
  revealAround(world, dest.x, dest.y, 22);
  completeObjective(world, "gate");
  playSfx("gate", 0.5);
  for (const c of world.fauna) {
    if (c.ownerId !== world.player.id || c.stay || c.task === "dead") continue;
    c.x = dest.x + (Math.random() - 0.5) * 1.6;
    c.z = dest.y + (Math.random() - 0.5) * 1.6;
    c.path = [];
  }
  return null;
}

export { STATIONS };
