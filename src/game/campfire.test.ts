import assert from "node:assert/strict";
import test from "node:test";
import { FIRE_HOURS, litFireNear, placeCampfire, tickCampfires } from "./campfire.ts";
import { commandCraft, commandCraftBatch, stationsHere } from "./craft.ts";
import { commandCook, you } from "./player.ts";
import { createWorld } from "./world.ts";
import type { ItemId, World } from "./types.ts";

function givePack(w: World, items: Partial<Record<ItemId, number>>) {
  w.player.pack = { ...items } as World["player"]["pack"];
}

/** Mid-roll stub: success passes, nothing else interesting happens. */
function withRoll<T>(v: number, fn: () => T): T {
  const old = Math.random;
  Math.random = () => v;
  try {
    return fn();
  } finally {
    Math.random = old;
  }
}

test("campfire - three wood buys a fire that burns three hours", () => {
  const w = createWorld();
  givePack(w, { log: 3 });
  const p = you(w)!;
  const note = withRoll(0.5, () => commandCraft(w, "campfire"));
  assert.ok(note?.includes("crackles"), `note: ${note}`);
  assert.equal(w.campfires.length, 1);
  assert.equal(w.campfires[0].tx, Math.round(p.x));
  assert.equal(w.campfires[0].until, w.hour + FIRE_HOURS);
  assert.equal(w.player.pack.log ?? 0, 0, "the wood went into the fire");
  assert.ok(litFireNear(w));
  assert.ok(stationsHere(w).includes("fire"));
});

test("campfire - one fire is plenty near at hand", () => {
  const w = createWorld();
  givePack(w, { log: 6 });
  withRoll(0.5, () => commandCraft(w, "campfire"));
  const again = withRoll(0.5, () => commandCraft(w, "campfire"));
  assert.equal(again, "A fire already crackles here.");
  assert.equal(w.campfires.length, 1);
  assert.equal(w.player.pack.log, 3, "the refused fire burns no wood");
  // Even a batch refuses to stack fires.
  const batched = withRoll(0.5, () => commandCraftBatch(w, "campfire", 5));
  assert.equal(batched, "A fire already crackles here.");
});

test("campfire - the fire dies to embers when its hour is spent", () => {
  const w = createWorld();
  placeCampfire(w);
  assert.equal(w.campfires.length, 1);
  w.hour += FIRE_HOURS + 0.1;
  tickCampfires(w);
  assert.equal(w.campfires.length, 0, "burned out");
  assert.ok(!litFireNear(w), "a dead fire is no station");
  assert.ok(w.log.some((l) => l.text.includes("embers")), "the world tells of it");
});

test("cooking - the pot wants a fire, and the fire feeds you", () => {
  const w = createWorld();
  givePack(w, { meat: 2, wheat: 2, cabbage: 1 });
  assert.equal(commandCraft(w, "roast_meat"), "The pot wants a fire — build a campfire, or find a hearth.");
  placeCampfire(w);
  w.player.skills.cooking = 100;
  const roast = withRoll(0.5, () => commandCraft(w, "roast_meat"));
  assert.ok(roast?.includes("cooked meat"), `note: ${roast}`);
  assert.equal(w.player.pack.cooked_meat, 1);
  assert.equal(w.player.pack.meat, 1);
  const bread = withRoll(0.5, () => commandCraft(w, "bake_bread"));
  assert.ok(bread?.includes("1 bread"), `note: ${bread}`);
  assert.equal(w.player.pack.bread, 1);
  const stew = withRoll(0.5, () => commandCraft(w, "stew_pot"));
  assert.ok(stew?.includes("1 bowl of stew"), `note: ${stew}`);
  assert.equal(w.player.pack.stew, 1);
});

test("cooking - batch roasting works the whole pile", () => {
  const w = createWorld();
  givePack(w, { meat: 3 });
  placeCampfire(w);
  w.player.skills.cooking = 100;
  const note = withRoll(0.5, () => commandCraftBatch(w, "roast_meat", 10));
  assert.ok(note?.includes("3 cooked meats"), `note: ${note}`);
  assert.equal(w.player.pack.cooked_meat, 3);
  assert.equal(w.player.pack.meat ?? 0, 0);
});

test("cooking - the kitchen hearth counts as a fire", () => {
  const w = createWorld();
  const p = you(w)!;
  w.buildings.push({ id: "kit1", kind: "kitchen", tx: Math.round(p.x), ty: Math.round(p.z), beds: [] });
  assert.ok(stationsHere(w).includes("fire"));
});

test("eating - cooked food first, raw meat last", () => {
  const w = createWorld();
  const p = you(w)!;
  p.hunger = 40;
  givePack(w, { cooked_meat: 1, cabbage: 1, meat: 1 });
  assert.equal(commandCook(w), "Hot meat. Proper food.");
  assert.equal(p.hunger, 80);
  assert.equal(w.player.pack.cooked_meat ?? 0, 0);
  assert.equal(commandCook(w), "The cabbage holds.");
  assert.equal(p.hunger, 100, "capped at full");
  assert.equal(commandCook(w), "You force the raw meat down.");
  assert.equal(p.hunger, 100, "still capped");
  assert.equal(commandCook(w), "Need meat, cabbage, or wheat.");
});

test("eating - a stew outfills everything", () => {
  const w = createWorld();
  const p = you(w)!;
  p.hunger = 40;
  givePack(w, { stew: 1, bread: 1 });
  assert.equal(commandCook(w), "The stew warms you through.");
  assert.equal(p.hunger, 92);
  assert.equal(commandCook(w), "Fresh bread.");
  assert.equal(p.hunger, 100);
});
