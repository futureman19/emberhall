import { actorPerson, actorState } from "./actor.ts";
import { STATIONS, stationById, stationNear } from "./atlas.ts";
import { nearestWalkable } from "./pathfinding.ts";
import { playSfx } from "./vale-sfx.ts";
import { completeObjective, revealAround } from "./world.ts";
import type { World } from "./types.ts";
import { emitMoongateFx } from "./moongate-animation.ts";

export function phaseName(hour: number) {
  const p = Math.floor((hour / 24) % 8);
  return ["New", "Waxing crescent", "First quarter", "Waxing gibbous", "Full", "Waning gibbous", "Last quarter", "Waning crescent"][p]!;
}

export function trammelPhase(hour: number) {
  return phaseName(hour);
}

export function commandTravel(world: World, destId: string, actorId?: string): string | null {
  const actor = actorState(world, actorId);
  const st = stationById(destId);
  if (!st) return "No such ring.";
  const p = actorPerson(world, actorId);
  if (!p) return "You are not in the vale.";
  const source = stationNear(p.x, p.z, 2.5);
  const from = { x: p.x, z: p.z };
  const dest = nearestWalkable(world, st.tx, st.ty + 2);
  if (!dest) return "The swirl will not take you.";
  p.x = dest.x;
  p.z = dest.y;
  p.path = [];
  actor.intent.kind = "none";
  actor.gateCoolUntil = world.hour + 0.05;
  revealAround(world, dest.x, dest.y, 22);
  completeObjective(world, "gate");
  playSfx("gate", 0.5);
  const companions: { id: string; x: number; z: number }[] = [];
  for (const c of world.fauna) {
    if (c.ownerId !== actor.id || c.stay || c.task === "dead") continue;
    c.x = dest.x + (Math.random() - 0.5) * 1.6;
    c.z = dest.y + (Math.random() - 0.5) * 1.6;
    c.path = [];
    companions.push({ id: c.id, x: c.x, z: c.z });
  }
  emitMoongateFx(world, {
    sourceId: source?.id ?? null,
    destinationId: st.id,
    destinationName: st.name,
    x: from.x,
    z: from.z,
    tx: dest.x,
    tz: dest.y,
    companions,
  });
  return null;
}

export { STATIONS };
