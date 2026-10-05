import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { LIVE_SKILLS } from "./catalog.ts";
import { placeCampfire } from "./campfire.ts";
import { commandCraft } from "./craft.ts";
import { verbsFor } from "./context.ts";
import { setWorld } from "./live.ts";
import { commandFish, tickPlayer, you } from "./player.ts";
import { createPerson, createStubWorld } from "./world.ts";
import type { TileKind, World } from "./types.ts";

const originalRandom = Math.random;
afterEach(() => {
  Math.random = originalRandom;
});

function fishingWorld(kind: TileKind = "water"): { world: World; tx: number; ty: number } {
  const world = createStubWorld();
  const player = createPerson(world, () => 0.5, {
    x: 40,
    z: 40,
    cls: "ranger",
    member: true,
    isPlayer: true,
  });
  world.player.id = player.id;
  world.people.push(player);
  const tx = 41;
  const ty = 40;
  world.tiles[ty]![tx]!.kind = kind;
  return { world, tx, ty };
}

function landCast(world: World, roll: number) {
  you(world)!.path = [];
  Math.random = () => roll;
  return tickPlayer(world, 0.6);
}

test("fishing - the skill is live and water exposes a cast action", () => {
  const { world, tx, ty } = fishingWorld();
  setWorld(world);

  assert.ok(LIVE_SKILLS.includes("fishing"));
  assert.equal(world.player.skills.fishing, 8);
  assert.ok(verbsFor({ kind: "tile", id: `${tx},${ty}`, tx, ty, label: "water" }).some((entry) => entry.verb === "fish"));

  world.tiles[ty]![tx]!.kind = "grass";
  assert.ok(!verbsFor({ kind: "tile", id: `${tx},${ty}`, tx, ty, label: "grass" }).some((entry) => entry.verb === "fish"));
});

test("fishing - a held rod catches one fish and can raise the skill", () => {
  const { world, tx, ty } = fishingWorld();
  world.player.wear.main = "fishing_rod";
  const before = world.player.skills.fishing;

  assert.equal(commandFish(world, tx, ty), null);
  assert.equal(world.player.intent.kind, "fish");
  const note = landCast(world, 0);

  assert.match(note ?? "", /silver fish takes the hook/i);
  assert.equal(world.player.pack.raw_fish, 1);
  assert.ok(world.player.skills.fishing >= before);
  assert.equal(world.player.intent.kind, "none");
  assert.equal(world.tiles[ty]![tx]!.kind, "water", "fishing does not consume the water tile");
});

test("fishing - dry ground, wrong gear, failed casts, and changed targets never yield", () => {
  const dry = fishingWorld("grass");
  dry.world.player.wear.main = "fishing_rod";
  assert.equal(commandFish(dry.world, dry.tx, dry.ty), "Cast into water.");

  const bareHands = fishingWorld();
  assert.match(commandFish(bareHands.world, bareHands.tx, bareHands.ty) ?? "", /hold the fishing rod/i);

  const failed = fishingWorld();
  failed.world.player.wear.main = "fishing_rod";
  failed.world.player.skills.fishing = 0;
  assert.equal(commandFish(failed.world, failed.tx, failed.ty), null);
  assert.equal(landCast(failed.world, 0.99), "The line comes back bare.");
  assert.equal(failed.world.player.pack.raw_fish, 0);
  assert.equal(failed.world.player.intent.kind, "none");

  const changed = fishingWorld();
  changed.world.player.wear.main = "fishing_rod";
  assert.equal(commandFish(changed.world, changed.tx, changed.ty), null);
  changed.world.tiles[changed.ty]![changed.tx]!.kind = "grass";
  assert.equal(landCast(changed.world, 0), "The water is gone.");
  assert.equal(changed.world.player.pack.raw_fish, 0);
});

test("fishing - a fresh catch roasts into proper food", () => {
  const { world } = fishingWorld("grass");
  world.player.pack.raw_fish = 1;
  world.player.skills.cooking = 100;
  placeCampfire(world);
  Math.random = () => 0.5;

  const note = commandCraft(world, "roast_fish");
  assert.match(note ?? "", /cooked fish/i);
  assert.equal(world.player.pack.raw_fish, 0);
  assert.equal(world.player.pack.cooked_fish, 1);
});
