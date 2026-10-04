import assert from "node:assert/strict";
import test from "node:test";
import { godModeEnabled, setGodOverride } from "./god.ts";
import { tickMana, maxMana } from "./magery.ts";
import { createStubWorld } from "./world.ts";
import type { Person, World } from "./types.ts";

function worldWithSelf(): { world: World; person: Person } {
  const world = createStubWorld();
  const person = { id: world.player.id, isPlayer: true, int: 20, x: 30, z: 30, path: [], hp: 50, maxHp: 50, kind: "human", task: "idle", taskUntil: 0, member: true, ghost: false } as unknown as Person;
  world.people.push(person);
  return { world, person };
}

function storage(): { get(k: string): string | null; set(k: string, v: string): void; clear(k: string): void } {
  const bag = new Map<string, string>();
  return {
    get: (k) => bag.get(k) ?? null,
    set: (k, v) => void bag.set(k, v),
    clear: (k) => void bag.delete(k),
  };
}

test("god mode - off by default", () => {
  setGodOverride(null);
  assert.equal(godModeEnabled("", storage()), false);
});

test("god mode - ?god=1 turns it on and it sticks", () => {
  const store = storage();
  assert.equal(godModeEnabled("?god=1", store), true);
  assert.equal(store.get("ember-god"), "1", "it is written down");
  assert.equal(godModeEnabled("", store), true, "a plain refresh keeps it");
});

test("god mode - ?god=0 lays it down", () => {
  const store = storage();
  godModeEnabled("?god=1", store);
  assert.equal(godModeEnabled("?god=0", store), false);
  assert.equal(godModeEnabled("", store), false, "and it stays down");
});

test("god mode - the pool never empties", () => {
  setGodOverride(true);
  try {
    const { world, person } = worldWithSelf();
    world.player.skills.magery = 100;
    world.player.mana = 1;
    tickMana(world, 0.016);
    const max = maxMana(person.int, 100);
    assert.equal(world.player.mana, max, "the well is always full");
    tickMana(world, 0.016);
    assert.equal(world.player.mana, max, "and stays full");
  } finally {
    setGodOverride(null);
  }
});

test("god mode - without it the well refills as ever", () => {
  setGodOverride(false);
  try {
    const { world, person } = worldWithSelf();
    world.player.skills.magery = 100;
    world.player.mana = 1;
    const max = maxMana(person.int, 100);
    tickMana(world, 0.016);
    assert.ok(world.player.mana < max, "mortals wait on the well");
    assert.ok(world.player.mana > 1, "but it does refill");
  } finally {
    setGodOverride(null);
  }
});
