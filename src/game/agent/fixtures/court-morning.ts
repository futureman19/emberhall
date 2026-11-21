/**
 * Golden fixture: a quiet morning at the court. Deterministic (stub world,
 * seeded rng) so candidate sets and observations are byte-stable assertions.
 */
import { COURT } from "../../atlas.ts";
import { mulberry32 } from "../../rng.ts";
import type { World } from "../../types.ts";
import { createPerson, createStubWorld } from "../../world.ts";

export interface CourtMorning {
  world: World;
  youId: string;
  miraId: string;
  treeTx: number;
  treeTy: number;
}

export function buildCourtMorning(): CourtMorning {
  const world = createStubWorld();
  const rng = mulberry32(7);
  const you = createPerson(world, rng, {
    x: COURT.tx,
    z: COURT.ty + 1,
    cls: "ranger",
    isPlayer: true,
    name: "You",
  });
  world.player.id = you.id;
  world.people.push(you);
  const mira = createPerson(world, rng, {
    x: COURT.tx - 1,
    z: COURT.ty + 1,
    cls: "merchant",
    name: "Mira",
  });
  world.people.push(mira);
  const treeTx = COURT.tx + 2;
  const treeTy = COURT.ty + 1;
  const row = world.tiles[treeTy];
  if (!row) throw new Error("fixture tree row missing");
  row[treeTx] = { h: 1, kind: "tree" };
  world.hour = 9;
  return { world, youId: you.id, miraId: mira.id, treeTx, treeTy };
}
