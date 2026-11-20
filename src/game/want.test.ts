import assert from "node:assert/strict";
import test from "node:test";
import { COURT } from "./atlas.ts";
import { commandBuy, commandSell, commandTalk } from "./npcs.ts";
import { takeFromPile } from "./piles.ts";
import { you } from "./player.ts";
import { setWorld } from "./live.ts";
import { mulberry32 } from "./rng.ts";
import { SAVE_KEY, encodeSave, loadSave } from "./save.ts";
import {
  BRANN_BANDAGES,
  BRANN_NAME,
  BRANN_PAY,
  BRANN_WANT,
  createWorld,
  ensureRynWain,
  RYN_NAME,
  RYN_PAY,
  RYN_WANT,
  seedTownNpcs,
} from "./world.ts";

test("want - Ryn stands on a new hall and asks for a hide", () => {
  const world = createWorld();
  const ryn = world.people.find((p) => p.name === RYN_NAME);
  assert.ok(ryn);
  assert.equal(ryn.role, null);
  const self = you(world)!;
  self.x = ryn.x;
  self.z = ryn.z;
  const note = commandTalk(world, ryn.id);
  assert.match(note, /Wolfhollow took my last hide/);
  assert.ok(world.quests.some((q) => q.id === RYN_WANT && q.title === "Bring Ryn a hide"));
});

test("want - a hide pays; she will not pay twice", () => {
  const world = createWorld();
  const ryn = world.people.find((p) => p.name === RYN_NAME)!;
  const self = you(world)!;
  self.x = ryn.x;
  self.z = ryn.z;
  world.player.pack.hide = 2;
  const gold = world.gold;
  const note = commandTalk(world, ryn.id);
  assert.match(note, /Don't sleep in the hollow/);
  assert.equal(world.player.pack.hide, 1);
  assert.equal(world.gold, gold + RYN_PAY);
  assert.equal(world.rep[RYN_WANT], 1);
  assert.match(commandTalk(world, ryn.id), /I remember/);
  assert.equal(world.player.pack.hide, 1);
  assert.equal(world.gold, gold + RYN_PAY);
});

test("want - a ghost cannot bargain", () => {
  const world = createWorld();
  const ryn = world.people.find((p) => p.name === RYN_NAME)!;
  const self = you(world)!;
  self.x = ryn.x;
  self.z = ryn.z;
  world.player.ghost = true;
  self.ghost = true;
  world.player.pack.hide = 1;
  assert.match(commandTalk(world, ryn.id), /dead keep no bargains/);
  assert.equal(world.player.pack.hide, 1);
});

test("want - old halls still get Ryn, and only once", () => {
  const world = createWorld();
  world.people = world.people.filter((p) => p.name !== RYN_NAME);
  assert.equal(world.people.some((p) => p.name === RYN_NAME), false);
  ensureRynWain(world);
  ensureRynWain(world);
  assert.equal(world.people.filter((p) => p.name === RYN_NAME).length, 1);
  setWorld(world);
  assert.equal(world.people.filter((p) => p.name === RYN_NAME).length, 1);
});

// ---- Brann Wain's fish want: the court provisioner, one supper, once ----

function brannVale() {
  const world = createWorld();
  const brann = world.people.find((p) => p.name === BRANN_NAME);
  assert.ok(brann, "a fresh vale must seed Brann Wain");
  const self = you(world)!;
  self.x = brann.x;
  self.z = brann.z;
  return { world, brann, self };
}

test("want - fresh vale seeds Brann at the court and his first Talk offers the fish want", () => {
  const { world, brann } = brannVale();
  assert.equal(brann.role, "provisioner");
  assert.equal(brann.x, COURT.tx - 4);
  assert.equal(brann.z, COURT.ty + 2);
  assert.equal(world.rep[BRANN_WANT] ?? 0, 0);
  const gold = world.gold;
  const note = commandTalk(world, brann.id);
  assert.match(note, /pond south of the court/);
  assert.ok(world.quests.some((q) => q.id === BRANN_WANT && q.title === "Bring Brann two cooked fish"));
  assert.equal(world.rep[BRANN_WANT] ?? 0, 0);
  assert.equal(world.player.pack.cooked_fish ?? 0, 0);
  assert.equal(world.gold, gold);
});

test("want - one cooked fish only progresses the want", () => {
  const { world, brann } = brannVale();
  commandTalk(world, brann.id); // the offer, so the quest is on the books
  world.player.pack.cooked_fish = 1;
  const note = commandTalk(world, brann.id);
  assert.match(note, /One more and the hall eats/);
  assert.equal(world.player.pack.cooked_fish, 1);
  assert.equal(world.rep[BRANN_WANT] ?? 0, 0);
  assert.ok(world.quests.some((q) => q.id === BRANN_WANT && q.title === "Bring Brann two cooked fish"));
});

test("want - two cooked fish pay 30 gold and 2 bandages once", () => {
  const { world, brann } = brannVale();
  world.player.pack.cooked_fish = 2;
  const gold = world.gold;
  const bandages = world.player.pack.bandage ?? 0;
  const note = commandTalk(world, brann.id);
  assert.match(note, /You have my thanks/);
  assert.equal(world.player.pack.cooked_fish, 0);
  assert.equal(world.gold, gold + BRANN_PAY);
  assert.equal(world.player.pack.bandage, bandages + BRANN_BANDAGES);
  assert.equal(world.rep[BRANN_WANT], 1);
  assert.ok(world.quests.some((q) => q.id === BRANN_WANT && q.title === "Brann has his supper"));
  assert.ok(world.log.some((l) => l.text.includes("takes the fish") && l.text.includes(`${BRANN_PAY} gold`)));
});

test("want - three cooked fish surrender exactly two", () => {
  const { world, brann } = brannVale();
  world.player.pack.cooked_fish = 3;
  const gold = world.gold;
  const bandages = world.player.pack.bandage ?? 0;
  commandTalk(world, brann.id);
  assert.equal(world.player.pack.cooked_fish, 1);
  assert.equal(world.gold, gold + BRANN_PAY);
  assert.equal(world.player.pack.bandage, bandages + BRANN_BANDAGES);
  assert.equal(world.rep[BRANN_WANT], 1);
});

test("want - a second Talk remembers and pays nothing more", () => {
  const { world, brann } = brannVale();
  world.player.pack.cooked_fish = 2;
  commandTalk(world, brann.id);
  const gold = world.gold;
  const pack = { ...world.player.pack };
  const note = commandTalk(world, brann.id);
  assert.match(note, /I remember/);
  assert.equal(world.gold, gold);
  assert.deepEqual(world.player.pack, pack);
  assert.equal(world.rep[BRANN_WANT], 1);
});

test("want - ghosts keep no suppers", () => {
  const { world, brann, self } = brannVale();
  world.player.pack.cooked_fish = 2;
  world.player.ghost = true;
  self.ghost = true;
  const gold = world.gold;
  const note = commandTalk(world, brann.id);
  assert.match(note, /The dead keep no suppers/);
  assert.equal(world.player.pack.cooked_fish, 2);
  assert.equal(world.gold, gold);
  assert.equal(world.rep[BRANN_WANT] ?? 0, 0);
  assert.equal(world.quests.some((q) => q.id === BRANN_WANT), false);
});

test("want - old saves keep exactly one Brann through load hydration", () => {
  const world = createWorld();
  seedTownNpcs(world, mulberry32(world.seed + 91));
  seedTownNpcs(world, mulberry32(world.seed + 91));
  assert.equal(world.people.filter((p) => p.name === BRANN_NAME).length, 1);
  setWorld(world);
  assert.equal(world.people.filter((p) => p.name === BRANN_NAME).length, 1);
  // A save old enough to lack every role-holder re-seeds the court on load.
  world.people = world.people.filter((p) => !p.role);
  setWorld(world);
  const branns = world.people.filter((p) => p.name === BRANN_NAME);
  assert.equal(branns.length, 1);
  assert.equal(branns[0]!.role, "provisioner");
});

test("want - rejected bandages wait in a pile at Brann's tile and recover", () => {
  const { world, brann } = brannVale();
  const pack = world.player.pack;
  world.player.pack.cooked_fish = 2;
  // The pack refuses bandages outright — the overflow-safe reward must pile them.
  Object.defineProperty(pack, "bandage", {
    configurable: true,
    enumerable: true,
    get: () => 0,
    set: () => {},
  });
  const gold = world.gold;
  const note = commandTalk(world, brann.id);
  assert.match(note, /You have my thanks/);
  assert.equal(world.player.pack.cooked_fish, 0);
  assert.equal(world.gold, gold + BRANN_PAY);
  assert.equal(world.rep[BRANN_WANT], 1);
  const pile = world.piles.find(
    (p) => p.tx === Math.round(brann.x) && p.ty === Math.round(brann.z) && (p.items.bandage ?? 0) === BRANN_BANDAGES,
  );
  assert.ok(pile, "the rejected bandages must wait at Brann's tile");
  assert.equal(pile.source, "drop");
  assert.ok(pile.until > world.hour);
  delete (pack as Record<string, unknown>)["bandage"];
  assert.equal(takeFromPile(world, pile.id), null);
  assert.equal(pack.bandage, BRANN_BANDAGES);
});

test("want - Brann's shop stays intact and cooked fish stay unbuyable", () => {
  const { world } = brannVale();
  const gold = world.gold;
  const bandages = world.player.pack.bandage ?? 0;
  assert.equal(commandBuy(world, "bandage"), "Bought bandage.");
  assert.equal(world.gold, gold - 3);
  assert.equal(world.player.pack.bandage, bandages + 1);
  assert.equal(commandBuy(world, "cooked_fish"), "They do not keep that.");
  world.player.pack.cooked_fish = 1;
  const afterBuy = world.gold;
  assert.equal(commandSell(world, "cooked_fish"), "Sold cooked fish.");
  assert.equal(world.gold, afterBuy + 4);
  assert.equal(world.player.pack.cooked_fish, 0);
});

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

test("want - Brann's rep and quest survive a save roundtrip", () => {
  const storage = new MemoryStorage();
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  try {
    const { world, brann } = brannVale();
    world.player.pack.cooked_fish = 2;
    commandTalk(world, brann.id);
    assert.equal(world.rep[BRANN_WANT], 1);
    localStorage.setItem(SAVE_KEY, encodeSave(world));
    const loaded = loadSave();
    assert.ok(loaded, "the completed want must survive save validation");
    setWorld(loaded);
    assert.equal(loaded.rep[BRANN_WANT], 1);
    assert.equal(loaded.gold, world.gold);
    assert.ok(loaded.quests.some((q) => q.id === BRANN_WANT && q.title === "Brann has his supper"));
    const self = you(loaded)!;
    const brann2 = loaded.people.find((p) => p.name === BRANN_NAME)!;
    self.x = brann2.x;
    self.z = brann2.z;
    assert.match(commandTalk(loaded, brann2.id), /I remember/);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});

test("want - Brann's branch precedes the provisioner early-return", () => {
  const { world, brann } = brannVale();
  const note = commandTalk(world, brann.id);
  assert.doesNotMatch(note, /Dust, steel, and a blank rune/);
  assert.match(note, /pond south of the court/);
  // Other provisioners keep the generic counter line.
  const kip = world.people.find((p) => p.name === "Kip Reed");
  assert.ok(kip, "the vale still seeds its second provisioner");
  const self = you(world)!;
  self.x = kip.x;
  self.z = kip.z;
  assert.match(commandTalk(world, kip.id), /Dust, steel, and a blank rune/);
});
