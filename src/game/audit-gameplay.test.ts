import assert from "node:assert/strict";
import test from "node:test";
import { inGreybarrow, inPlace } from "./atlas.ts";
import { FAUNA_META } from "./catalog.ts";
import { seedFauna, spawn, tickEcology } from "./ecology.ts";
import { commandTill, plotAt } from "./farm.ts";
import { commandPlantTree, saplingAt } from "./forestry.ts";
import { makeResourceStackKey, resourceCount } from "./inventory/resources.ts";
import { commandCast } from "./magery.ts";
import { commandBuy, commandSell, commandSellRare } from "./npcs.ts";
import { addToPile, spawnCorpsePile, takeFromPile, tickPiles } from "./piles.ts";
import {
  commandChop,
  commandHunt,
  commandMine,
  resurrect,
  tickPlayer,
} from "./player.ts";
import { mulberry32 } from "./rng.ts";
import { tickWorld } from "./sim.ts";
import type { Creature, FaunaKind, RareItem, SpellId, World } from "./types.ts";
import { createPerson, createStubWorld, createWorld } from "./world.ts";

/**
 * Emberhall audit — gameplay lane (G1–G7). Cross-system probes against the
 * real release modules: controlled fixtures, not natural-play estimates.
 * Registered separately with Hermes; run:
 *   node --experimental-strip-types --test src/game/audit-gameplay.test.ts
 */

const originalRandom = Math.random;

function withRandom<T>(value: number, fn: () => T): T {
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = originalRandom;
  }
}

function playerWorld() {
  const world = createStubWorld();
  const player = createPerson(world, () => 0.5, {
    x: 30,
    z: 30,
    isPlayer: true,
    member: true,
  });
  world.people.push(player);
  world.player.id = player.id;
  return { world, player };
}

function creature(kind: FaunaKind, x: number, z: number): Creature {
  const hp = FAUNA_META[kind].hp;
  return {
    id: `audit-${kind}-${x}-${z}`,
    kind,
    x,
    z,
    hp,
    maxHp: hp,
    path: [],
    task: "wander",
    taskUntil: 0,
    corpseUntil: 0,
    home: { tx: Math.round(x), ty: Math.round(z) },
    ownerId: null,
    loyalty: 0,
    stay: false,
  };
}

function enclose(world: World, tx: number, ty: number, kind: "rock" | "tree" | "grass") {
  for (let y = ty - 3; y <= ty + 3; y++) {
    for (let x = tx - 3; x <= tx + 3; x++) {
      world.tiles[y]![x]!.kind = "wall";
    }
  }
  world.tiles[ty]![tx]!.kind = kind;
}

// ---------------------------------------------------------------------------
// G1 — hostile fight state must deal damage and keep bounded pursuit; spider
// venom must be reachable; ghost/invisible/paralyzed exclusions; no doubles.
// ---------------------------------------------------------------------------

test("G1 - a night hunter wounds a passive player and pursues a moved target", () => {
  const { world, player } = playerWorld();
  player.maxHp = 1000;
  player.hp = 1000;
  world.hour = 22;
  const wolf = creature("wolf", 31, 30);
  world.fauna.push(wolf);
  for (let i = 0; i < 600; i++) tickWorld(world, 0.1);
  assert.equal(wolf.task, "fight");
  assert.ok(player.hp < 1000, `a passive player takes predator damage (hp ${player.hp})`);

  player.x = 38;
  player.z = 30;
  player.path = [];
  for (let i = 0; i < 200; i++) tickWorld(world, 0.1);
  assert.equal(wolf.task, "fight", "the hunter keeps hunting a moved target in bounds");
  assert.ok(
    Math.hypot(wolf.x - player.x, wolf.z - player.z) < 2.5,
    `the hunter closes again (dist ${Math.hypot(wolf.x - player.x, wolf.z - player.z).toFixed(2)})`,
  );
  assert.ok(player.hp < 1000);
});

test("G1 - a fighting beast lets go of a ghost", () => {
  const { world, player } = playerWorld();
  world.hour = 22;
  player.ghost = true;
  world.player.ghost = true;
  player.hp = 0;
  const wolf = creature("wolf", 31, 30);
  wolf.task = "fight";
  world.fauna.push(wolf);
  for (let i = 0; i < 30; i++) tickWorld(world, 0.1);
  assert.notEqual(wolf.task, "fight", "the dead are left to walk pale");
});

test("G1 - the unseen are not hunted (control)", () => {
  const { world, player } = playerWorld();
  world.hour = 22;
  world.player.invisUntil = world.hour + 5;
  const wolf = creature("wolf", 31, 30);
  world.fauna.push(wolf);
  for (let i = 0; i < 30; i++) tickWorld(world, 0.1);
  assert.notEqual(wolf.task, "fight");
  assert.equal(player.hp, 40);
});

test("G1 - a held beast cannot bite, and answers again once the lock lets go", () => {
  const { world, player } = playerWorld();
  world.hour = 22;
  const wolf = creature("wolf", 31, 30);
  wolf.task = "fight";
  wolf.paralyzeUntil = world.hour + 0.5;
  world.fauna.push(wolf);
  for (let i = 0; i < 30; i++) tickWorld(world, 0.1);
  assert.equal(player.hp, 40, "a paralyzed beast deals no damage");

  for (let i = 0; i < 400; i++) tickWorld(world, 0.1);
  assert.ok(wolf.paralyzeUntil === 0 || wolf.paralyzeUntil === undefined);
  assert.ok(player.hp < 40, `the released beast presses the attack (hp ${player.hp})`);
});

test("G1 - a stonecrawl spider's fangs carry venom; a held spider's do not", () => {
  const { world, player } = playerWorld();
  player.maxHp = 500;
  player.hp = 500;
  world.hour = 22;
  const spider = creature("stonecrawl_spider", 31, 30);
  spider.hp = 1000;
  spider.maxHp = 1000;
  world.fauna.push(spider);
  withRandom(0.1, () => {
    for (let i = 0; i < 120; i++) tickWorld(world, 0.1);
  });
  assert.ok(world.player.poisonUntil > world.hour, "venom in the blood from a living spider");

  const held = playerWorld();
  held.world.hour = 22;
  const heldSpider = creature("stonecrawl_spider", 31, 30);
  heldSpider.task = "fight";
  heldSpider.paralyzeUntil = held.world.hour + 1;
  held.world.fauna.push(heldSpider);
  withRandom(0.1, () => {
    for (let i = 0; i < 60; i++) tickWorld(held.world, 0.1);
  });
  assert.equal(held.world.player.poisonUntil, 0, "a held spider's venom stays behind its teeth");
});

test("G1 - melee aggression draws a bounded counter, never a double", () => {
  const { world, player } = playerWorld();
  player.maxHp = 500;
  player.hp = 500;
  world.player.skills.swords = 100;
  const wolf = creature("wolf", 31, 30);
  wolf.hp = 10000;
  wolf.maxHp = 10000;
  world.fauna.push(wolf);
  assert.equal(commandHunt(world, wolf.id), null);
  withRandom(0.5, () => {
    for (let i = 0; i < 12; i++) tickWorld(world, 0.1);
  });
  const lost = 500 - player.hp;
  const bite = FAUNA_META.wolf.dmg;
  assert.ok(lost >= 1, "the wolf answers the swing");
  assert.ok(lost <= 3 * bite, `no double retaliation over two beats (lost ${lost}, bite ${bite})`);
});

// ---------------------------------------------------------------------------
// G2 — a rejected route must never deplete/grant/gain; reach is validated at
// impact for resource, farm, and forestry work.
// ---------------------------------------------------------------------------

test("G2 - an unreachable rock is never mined", () => {
  const { world, player } = playerWorld();
  world.player.wear.main = "pick";
  world.player.skills.mining = 75;
  enclose(world, 50, 50, "rock");
  const note = commandMine(world, 50, 50);
  assert.ok(typeof note === "string", "the rejected route says so");
  withRandom(0.01, () => {
    for (let i = 0; i < 25; i++) tickWorld(world, 0.1);
  });
  assert.equal(world.tiles[50]![50]!.kind, "rock", "the rock stands");
  assert.equal(resourceCount(world.player.resources, makeResourceStackKey("iron_ore", "ore", "rough")), 0);
  assert.deepEqual({ x: player.x, z: player.z }, { x: 30, z: 30 }, "no traversal took place");
  assert.equal(world.player.intent.kind, "none", "no lingering work order");
});

test("G2 - an unreachable tree is never chopped", () => {
  const { world, player } = playerWorld();
  world.player.skills.lumberjack = 75;
  enclose(world, 50, 50, "tree");
  const note = commandChop(world, 50, 50);
  assert.ok(typeof note === "string", "the rejected route says so");
  withRandom(0.01, () => {
    for (let i = 0; i < 25; i++) tickWorld(world, 0.1);
  });
  assert.equal(world.tiles[50]![50]!.kind, "tree", "the tree stands");
  assert.equal(resourceCount(world.player.resources, makeResourceStackKey("oak", "log", "rough")), 0);
  assert.deepEqual({ x: player.x, z: player.z }, { x: 30, z: 30 });
  assert.equal(world.player.intent.kind, "none");
});

test("G2 - unreachable farm and forestry work commit nothing", () => {
  const { world } = playerWorld();
  world.player.wear.main = "hoe";
  enclose(world, 50, 50, "grass");
  const note = commandTill(world, 50, 50);
  assert.ok(typeof note === "string");
  withRandom(0.01, () => {
    for (let i = 0; i < 25; i++) tickWorld(world, 0.1);
  });
  assert.equal(plotAt(world, 50, 50), null, "no bed appears at a distance");

  const grove = playerWorld();
  grove.world.player.pack.acorn = 1;
  enclose(grove.world, 50, 50, "grass");
  const treeNote = commandPlantTree(grove.world, 50, 50);
  assert.ok(typeof treeNote === "string");
  withRandom(0.01, () => {
    for (let i = 0; i < 25; i++) tickWorld(grove.world, 0.1);
  });
  assert.equal(saplingAt(grove.world, 50, 50), null, "no sapling appears at a distance");
  assert.equal(grove.world.player.pack.acorn, 1, "the acorn is kept");
});

test("G2 - impact without reach is refused at commit time", () => {
  const { world } = playerWorld();
  world.player.wear.main = "pick";
  world.player.skills.mining = 75;
  world.tiles[40]![40]!.kind = "rock";
  // A work order whose travel never happened (target/tool changed en route).
  world.player.intent = { kind: "mine", tx: 40, ty: 40, targetId: null, spell: null };
  const note = withRandom(0.01, () => tickPlayer(world, 0.6));
  assert.equal(note, "Too far.");
  assert.equal(world.tiles[40]![40]!.kind, "rock");
  assert.equal(resourceCount(world.player.resources, makeResourceStackKey("iron_ore", "ore", "rough")), 0);
  assert.equal(world.player.intent.kind, "none");
});

// ---------------------------------------------------------------------------
// G3 — every harmful spell keeps its approach and releases only in range.
// ---------------------------------------------------------------------------

const HARMFUL: { spell: SpellId; effect: (w: World, c: Creature) => boolean }[] = [
  { spell: "magicarrow", effect: (_w, c) => c.hp < c.maxHp },
  { spell: "fireball", effect: (_w, c) => c.hp < c.maxHp },
  { spell: "poison", effect: (w, c) => (c.poisonUntil ?? 0) > w.hour },
  { spell: "lightning", effect: (_w, c) => c.hp < c.maxHp },
  { spell: "paralyze", effect: (w, c) => (c.paralyzeUntil ?? 0) > w.hour },
  { spell: "curse", effect: (w, c) => (c.curseUntil ?? 0) > w.hour },
];

for (const { spell, effect } of HARMFUL) {
  test(`G3 - ${spell} closes range continuously and releases`, () => {
    const { world, player } = playerWorld();
    world.player.pack.spellbook = 1;
    world.player.skills.magery = 50;
    world.player.mana = 30;
    for (const id of ["pearl", "mandrake", "nightshade", "ash", "garlic", "silk"] as const) {
      world.player.pack[id] = 4;
    }
    const wolf = creature("wolf", 60, 30);
    world.fauna.push(wolf);
    assert.equal(commandCast(world, spell, { kind: "fauna", id: wolf.id }), null);

    withRandom(0.5, () => {
      for (let i = 0; i < 4; i++) tickWorld(world, 0.1);
    });
    assert.ok(world.player.mana >= 30, "no mana spent before valid release");
    assert.equal(world.player.pack.pearl, 4, "no reagent spent before valid release");

    let ticks = 0;
    withRandom(0.5, () => {
      while (world.player.intent.kind !== "none" && ticks < 400) {
        tickWorld(world, 0.1);
        ticks += 1;
      }
    });
    assert.equal(world.player.intent.kind, "none", `the cast completes (${ticks} ticks)`);
    assert.ok(effect(world, wolf), `${spell} took effect on the target`);
    assert.ok(
      Math.hypot(player.x - 30, player.z - 30) > 10,
      `the caster truly closed ground (${Math.hypot(player.x - 30, player.z - 30).toFixed(2)} tiles)`,
    );
  });
}

test("G3 - a harmful spell follows a moving target (control: magicarrow)", () => {
  const { world, player } = playerWorld();
  world.player.pack.spellbook = 1;
  world.player.skills.magery = 50;
  world.player.mana = 30;
  world.player.pack.pearl = 4;
  const wolf = creature("wolf", 46, 30);
  world.fauna.push(wolf);
  assert.equal(commandCast(world, "magicarrow", { kind: "fauna", id: wolf.id }), null);
  let ticks = 0;
  withRandom(0.5, () => {
    while (world.player.intent.kind !== "none" && ticks < 80) {
      tickWorld(world, 0.1);
      if (ticks === 10) wolf.z = 36; // the quarry breaks sideways mid-approach
      ticks += 1;
    }
  });
  assert.equal(world.player.intent.kind, "none");
  assert.ok(wolf.hp < wolf.maxHp, "the arrow finds the moved target");
  assert.ok(Math.hypot(player.x - 30, player.z - 30) > 1, "the caster closed ground");
});

// ---------------------------------------------------------------------------
// G4 — a terrain revision invalidating a later waypoint stops the route.
// ---------------------------------------------------------------------------

function stagedRoute(world: World, player: ReturnType<typeof playerWorld>["player"]) {
  world.player.intent = { kind: "walk", tx: 32, ty: 35, targetId: null, spell: null };
  player.x = 30;
  player.z = 30;
  player.path = [
    { tx: 32, ty: 30 },
    { tx: 32, ty: 35 },
  ];
}

test("G4 - a later waypoint blocked mid-travel is never crossed", () => {
  const { world, player } = playerWorld();
  stagedRoute(world, player);
  tickWorld(world, 0.1); // the first segment is underway
  world.tiles[34]![32]!.kind = "wall";
  world.landRev += 1;
  let crossed = false;
  for (let i = 0; i < 80; i++) {
    tickWorld(world, 0.1);
    if (Math.hypot(player.x - 32, player.z - 34) < 0.51) crossed = true;
  }
  assert.equal(crossed, false, "the blocked tile is never entered");
});

test("G4 - a route invalidated before the first tick is never crossed", () => {
  const { world, player } = playerWorld();
  stagedRoute(world, player);
  world.tiles[34]![32]!.kind = "wall";
  world.landRev += 1;
  let crossed = false;
  for (let i = 0; i < 80; i++) {
    tickWorld(world, 0.1);
    if (Math.hypot(player.x - 32, player.z - 34) < 0.51) crossed = true;
  }
  assert.equal(crossed, false, "the blocked tile is never entered");
});

// ---------------------------------------------------------------------------
// G5 — dying on an existing pile keeps corpse identity and recovery.
// ---------------------------------------------------------------------------

test("G5 - dying atop an ordinary sack keeps the corpse, marker, goods, and recovery", () => {
  const { world, player } = playerWorld();
  addToPile(world, 30, 30, { log: 2 }, "drop", world.hour + 24, "sack");
  world.gold = 90;
  world.player.pack.log = 4;
  player.hp = 0;
  tickPlayer(world, 0.1);

  const pile = world.piles.find((p) => p.tx === 30 && p.ty === 30);
  assert.ok(pile, "the pile remains");
  assert.equal(pile.source, "death", "the merged pile is the corpse");
  assert.equal(pile.label, "your corpse");
  assert.equal(pile.items.log, 4, "sack logs and spilled logs are both kept");
  assert.equal(pile.gold, 30, "the death gold is kept");
  assert.equal(player.ghost, true);

  tickPiles(world);
  assert.deepEqual(world.player.corpseAt, { tx: 30, ty: 30 }, "the corpse marker survives the pile tick");

  resurrect(world, { x: 31, z: 30 });
  assert.equal(takeFromPile(world, pile.id), null);
  assert.equal(world.objectives.find((o) => o.id === "recover")?.done, true, "recovery completes");
  assert.equal(world.player.corpseAt, null);
  assert.equal(world.player.pack.log, 6, "the goods come home (2 kept + 4 recovered)");
  assert.equal(world.gold, 90);
});

test("G5 - dying atop a creature corpse keeps both the spoils and the corpse identity", () => {
  const { world, player } = playerWorld();
  const squirrel = creature("redtail_squirrel", 30, 30);
  squirrel.task = "dead";
  world.fauna.push(squirrel);
  withRandom(0.01, () => spawnCorpsePile(world, squirrel));
  const spoils = world.piles.find((p) => p.tx === 30 && p.ty === 30);
  assert.ok(spoils && spoils.source === "corpse", "the squirrel spilled");
  const acorns = spoils.items.acorn ?? 0;
  assert.ok(acorns > 0, "the spoils hold the acorn drop");

  world.gold = 90;
  player.hp = 0;
  tickPlayer(world, 0.1);
  const pile = world.piles.find((p) => p.tx === 30 && p.ty === 30)!;
  assert.equal(pile.source, "death");
  assert.equal(pile.label, "your corpse");
  assert.equal(pile.gold, 30);
  assert.ok((pile.items.acorn ?? 0) >= acorns, "the spoils survive the merge");
  tickPiles(world);
  assert.deepEqual(world.player.corpseAt, { tx: 30, ty: 30 });

  resurrect(world, { x: 31, z: 30 });
  takeFromPile(world, pile.id);
  assert.equal(world.objectives.find((o) => o.id === "recover")?.done, true);
});

test("G5 - a clean-ground death is unchanged (control)", () => {
  const { world, player } = playerWorld();
  world.gold = 90;
  world.player.pack.log = 4;
  player.hp = 0;
  tickPlayer(world, 0.1);
  const pile = world.piles.find((p) => p.tx === 30 && p.ty === 30)!;
  assert.equal(pile.source, "death");
  assert.equal(pile.items.log, 2);
  assert.equal(pile.gold, 30);
  tickPiles(world);
  assert.deepEqual(world.player.corpseAt, { tx: 30, ty: 30 });
  resurrect(world, { x: 31, z: 30 });
  takeFromPile(world, pile.id);
  assert.equal(world.objectives.find((o) => o.id === "recover")?.done, true);
});

// ---------------------------------------------------------------------------
// G6 — regional wardens keep their regions; Greybarrow keeps its dead.
// ---------------------------------------------------------------------------

test("G6 - the Cairn keeps its hounds and crows after an ecology tick; the lich stays leashed", () => {
  const world = createWorld();
  world.fauna = [];
  seedFauna(world, mulberry32(1313));
  const cairnCarrion = () =>
    world.fauna.filter(
      (c) =>
        (c.kind === "barrow_hound" || c.kind === "bonecrow") &&
        inPlace(Math.round(c.x), Math.round(c.z), "cairnash"),
    );
  assert.ok(cairnCarrion().length >= 2, "the Cairn spawns its hound and crow");

  const stray = spawn(world, "grave_lich", 64, 96);
  world.fauna.push(stray);
  tickEcology(world, 0.016);
  assert.ok(cairnCarrion().length >= 2, "the Cairn keeps its wardens after the tick");
  assert.ok(
    inGreybarrow(Math.round(stray.x), Math.round(stray.z)),
    "Greybarrow's own dead are still leashed to the tomb",
  );
});

// ---------------------------------------------------------------------------
// G7 — provisioner trade requires the keeper at hand, at transaction time.
// ---------------------------------------------------------------------------

test("G7 - no keeper anywhere near means no trade", () => {
  const { world } = playerWorld();
  world.gold = 80;
  assert.notEqual(commandBuy(world, "hatchet"), "Bought hatchet.");
  assert.equal(world.gold, 80);
  assert.equal(world.player.pack.hatchet ?? 0, 0);
});

test("G7 - a distant keeper means no trade; walking up restores it", () => {
  const { world, player } = playerWorld();
  world.gold = 80;
  const keeper = createPerson(world, () => 0.5, {
    x: 100,
    z: 100,
    role: "provisioner",
    name: "Far Quinn",
  });
  world.people.push(keeper);

  assert.notEqual(commandBuy(world, "hatchet"), "Bought hatchet.");
  assert.equal(world.gold, 80);
  world.player.pack.log = 1;
  assert.notEqual(commandSell(world, "log"), "Sold log.");
  assert.equal(world.player.pack.log, 1);
  const rare: RareItem = { uid: "r1", base: "sword", affixes: [], seed: 0, hour: 0 };
  world.player.rares.push(rare);
  const goldBeforeRare = world.gold;
  const refused = commandSellRare(world, "r1");
  assert.equal(world.gold, goldBeforeRare, `the rare sale is refused at range (${refused})`);
  assert.equal(world.player.rares.length, 1);

  player.x = 99.5;
  player.z = 100;
  assert.equal(commandBuy(world, "hatchet"), "Bought hatchet.");
  assert.equal(world.gold, 68);
  assert.equal(commandSell(world, "log"), "Sold log.");
  assert.equal(world.player.pack.log, 0);
  const note = commandSellRare(world, "r1");
  assert.ok(note?.includes("gold"), "the keeper studies the wonder up close");
  assert.equal(world.player.rares.length, 0);
});

test("G7 - a ghost cannot trade even at the counter (control)", () => {
  const { world, player } = playerWorld();
  world.gold = 80;
  const keeper = createPerson(world, () => 0.5, {
    x: 31,
    z: 30,
    role: "provisioner",
    name: "Near Quinn",
  });
  world.people.push(keeper);
  player.ghost = true;
  world.player.ghost = true;
  assert.equal(commandBuy(world, "hatchet"), "A ghost cannot.");
  assert.equal(world.gold, 80);
});
