import assert from "node:assert/strict";
import test from "node:test";
import { commandCraft } from "./craft.ts";
import { commandBuy } from "./npcs.ts";
import { commandHunt, tickPlayer, you } from "./player.ts";
import { createPerson, createWorld } from "./world.ts";
import type { World } from "./types.ts";

function withRoll<T>(value: number, action: () => T): T {
  const random = Math.random;
  Math.random = () => value;
  try {
    return action();
  } finally {
    Math.random = random;
  }
}

function standAtBench(world: World): void {
  const bench = world.buildings.find(({ kind }) => kind === "yard" || kind === "hall");
  assert.ok(bench, "the fixture world needs a yard or hall (the bench station)");
  const player = you(world)!;
  player.x = bench.tx;
  player.z = bench.ty;
}

function liveHare(world: World): void {
  const player = you(world)!;
  world.fauna.push({
    id: "quiver-hare",
    kind: "hare",
    x: player.x + 2,
    z: player.z,
    hp: 40,
    maxHp: 40,
    path: [],
    task: "idle",
    taskUntil: world.hour + 99,
    corpseUntil: 0,
    home: { tx: Math.round(player.x + 2), ty: Math.round(player.z) },
    ownerId: null,
    loyalty: 0,
    stay: false,
  });
}

/** Tick the real loop until the swing lands and a note comes back. */
function tickUntilNote(world: World): string {
  for (let i = 0; i < 40; i++) {
    const note = tickPlayer(world, 0.1);
    if (note !== null) return note;
    if (world.player.intent.kind === "none") return "intent cleared without a note";
  }
  return "no note after 40 ticks";
}

test("fletch - one board becomes five arrows at the bench", () => {
  const world = createWorld();
  standAtBench(world);
  world.player.skills.carpentry = 100;
  world.player.pack.board = 1;
  world.player.pack.arrows = 0;
  const note = withRoll(0.5, () => commandCraft(world, "fletch"));
  assert.match(note ?? "", /arrow/i);
  assert.equal(world.player.pack.board ?? 0, 0);
  assert.equal(world.player.pack.arrows ?? 0, 5);
});

test("arrows - a bow looses one arrow per swing and stops when the quiver runs dry", () => {
  const world = createWorld();
  world.player.skills.archery = 60;
  world.player.wear.main = "bow";
  world.player.pack.arrows = 1;
  liveHare(world);
  const hare = world.fauna.find((c) => c.id === "quiver-hare")!;

  assert.equal(commandHunt(world, hare.id), null);
  const note = withRoll(0.5, () => tickUntilNote(world));
  assert.equal(world.player.pack.arrows ?? 0, 0, `the swing loosed the last arrow (note: ${note})`);
  assert.ok(hare.hp < 40, "the loosed arrow bit");

  // Dry quiver: the hunt stops with a note, no damage, intent cleared.
  hare.hp = 40;
  assert.equal(commandHunt(world, hare.id), null);
  const dry = withRoll(0.5, () => tickUntilNote(world));
  assert.match(dry, /arrows/i);
  assert.equal(hare.hp, 40, "no arrows, no bite");
  assert.equal(world.player.intent.kind, "none", "the hunt stops when the quiver runs dry");
});

test("arrows - a melee swing never touches the quiver", () => {
  const world = createWorld();
  world.player.skills.swords = 60;
  world.player.wear.main = "hatchet";
  world.player.pack.arrows = 3;
  liveHare(world);
  const hare = world.fauna.find((c) => c.id === "quiver-hare")!;

  assert.equal(commandHunt(world, hare.id), null);
  withRoll(0.5, () => tickUntilNote(world));
  assert.equal(world.player.pack.arrows, 3, "melee leaves the quiver alone");
});

test("arrows - the provisioner keeps a quiver's worth in stock", () => {
  const world = createWorld();
  world.gold = 20;
  const keeper = createPerson(world, () => 0.5, {
    x: world.player.x + 1,
    z: world.player.z,
    role: "provisioner",
    name: "Quill",
  });
  world.people.push(keeper);
  world.player.pack.arrows = 0;
  assert.equal(commandBuy(world, "arrows"), "Bought arrows.");
  assert.equal(world.player.pack.arrows, 1);
  assert.equal(world.gold, 18);
});
