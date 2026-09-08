import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "./ecology.ts";
import { getWorld, setWorld } from "./live.ts";
import { you } from "./player.ts";
import type { FaunaKind } from "./types.ts";
import { createWorld } from "./world.ts";

const EXPANSION_KINDS = [
  "oak_bear",
  "frosthorn_ram",
  "fen_leech",
  "tideclaw_crab",
  "cavern_bat",
  "tomb_sentinel",
  "cinder_drake",
  "willow_wisp",
  "blackbriar_hag",
  "rime_revenant",
  "fen_ghoul",
  "drowned_reaver",
  "deepmaw_basilisk",
  "ossuary_knight",
  "ash_demon",
  "grave_lich",
  "redtail_squirrel",
  "whiteback_elk",
  "highland_aurochs",
  "reed_heron",
  "river_otter",
  "brine_seal",
  "cave_mole",
  "dusk_owl",
] as const satisfies readonly FaunaKind[];

test("continued worlds gain every missing expansion kind exactly once", () => {
  const oldWorld = createWorld();
  const player = you(oldWorld)!;
  oldWorld.fauna = [spawn(oldWorld, "hare", player.x + 2, player.z)];

  setWorld(oldWorld);
  const hydrated = getWorld();
  assert.ok(hydrated.fauna.some((creature) => creature.kind === "hare"), "existing fauna survives hydration");
  for (const kind of EXPANSION_KINDS) {
    assert.equal(hydrated.fauna.filter((creature) => creature.kind === kind).length, 1, `${kind} is added once`);
  }

  const count = hydrated.fauna.length;
  setWorld(hydrated);
  assert.equal(getWorld().fauna.length, count, "repeated hydration is idempotent");
});