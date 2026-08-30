import assert from "node:assert/strict";
import test from "node:test";
import { SECONDS_PER_HOUR } from "./catalog.ts";
import { pickPetName } from "./names.ts";
import { commandNamePet, tickPets } from "./pets.ts";
import { commandFeed, commandFollow, commandRelease, commandStay, you } from "./player.ts";
import { mulberry32 } from "./rng.ts";
import { createWorld } from "./world.ts";
import type { Creature, ItemId, World } from "./types.ts";

function givePack(w: World, items: Partial<Record<ItemId, number>>) {
  w.player.pack = { ...items } as World["player"]["pack"];
}

function givePet(w: World, over: Partial<Creature> = {}): Creature {
  const p = you(w)!;
  const c: Creature = {
    id: over.id ?? "pet1",
    kind: over.kind ?? "wolf",
    x: p.x,
    z: p.z,
    hp: 28,
    maxHp: 28,
    path: [],
    task: "follow",
    taskUntil: 0,
    corpseUntil: 0,
    home: { tx: Math.round(p.x), ty: Math.round(p.z) },
    ownerId: w.player.id,
    loyalty: 40,
    stay: false,
    name: null,
    warnedLoyal: false,
    ...over,
  };
  w.fauna.push(c);
  return c;
}

test("pets - a companion takes a name and answers to it", () => {
  const w = createWorld();
  const c = givePet(w);
  const note = commandNamePet(w, c.id, "Soot");
  assert.equal(note, "wolf is Soot now.");
  assert.equal(c.name, "Soot");
  assert.equal(commandNamePet(w, c.id, "Soot"), "Soot already answers to it.");
});

test("pets - naming has manners: yours, alive, short, plain", () => {
  const w = createWorld();
  const c = givePet(w);
  assert.equal(commandNamePet(w, "nope", "Soot"), "It is not yours.");
  assert.equal(commandNamePet(w, c.id, "   "), "A name, then — say something.");
  assert.equal(commandNamePet(w, c.id, "Supercalifragilisticx"), "Twenty letters is plenty.");
  assert.equal(commandNamePet(w, c.id, "S00t"), "Plain letters for a name.");
  const dead = givePet(w, { id: "pet2", task: "dead" });
  assert.equal(commandNamePet(w, dead.id, "Soot"), "The dead keep their names.");
});

test("pets - auto-naming avoids names already taken", () => {
  const rng = mulberry32(42);
  const first = pickPetName(rng, new Set());
  const second = pickPetName(mulberry32(42), new Set([first]));
  assert.notEqual(second, first);
});

test("pets - loyalty ebbs, the restless speak once, a feed re-arms", () => {
  const w = createWorld();
  const c = givePet(w, { loyalty: 16 });
  // One game hour passes: -0.5 loyalty.
  tickPets(w, SECONDS_PER_HOUR);
  assert.equal(c.loyalty, 15.5);
  // Cross into restless: speaks once.
  tickPets(w, SECONDS_PER_HOUR * 2);
  assert.ok(c.loyalty < 15);
  assert.equal(c.warnedLoyal, true);
  const warns = w.log.filter((l) => l.text.includes("restless")).length;
  tickPets(w, SECONDS_PER_HOUR * 2);
  assert.equal(w.log.filter((l) => l.text.includes("restless")).length, warns, "no nagging twice");
  // A feed restores and re-arms the voice.
  givePack(w, { meat: 2 });
  assert.equal(commandFeed(w, c.id), "wolf eats.");
  assert.equal(c.warnedLoyal, false);
  assert.ok(c.loyalty > 15);
});

test("pets - a forgotten friend slips back into the wild", () => {
  const w = createWorld();
  const c = givePet(w, { name: "Soot", loyalty: 0.2 });
  tickPets(w, SECONDS_PER_HOUR);
  assert.equal(c.ownerId, null);
  assert.equal(c.task, "wander");
  assert.ok(w.log.some((l) => l.text === "Soot slips back into the wild."));
  // Wild again — pet commands refuse.
  assert.equal(commandStay(w, c.id), "It is not yours.");
});

test("pets - the little orders speak their name", () => {
  const w = createWorld();
  const c = givePet(w, { name: "Bramble" });
  assert.equal(commandStay(w, c.id), "Bramble stays.");
  assert.equal(c.stay, true);
  assert.equal(commandFollow(w, c.id), "Bramble follows.");
  assert.equal(c.stay, false);
  assert.equal(commandRelease(w, c.id), "Bramble is gone.");
  assert.equal(c.ownerId, null);
});
