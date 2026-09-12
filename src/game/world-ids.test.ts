import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createStubWorld, nid, placeBuilding } from "./world.ts";
import { HOUSE_KINDS, HOUSE_DEEDS, houseSiteError, placeHouse, commandHouseItem, commandHouseTake } from "./house.ts";
import type { World } from "./types.ts";

// Derive a collision at the allocator's next candidate without resetting its
// module counter or relying on another test's allocation history.
function collisionCandidate(world: World, prefix: string) {
  const previous = Number(nid(world, "probe").slice("probe-".length));
  return `${prefix}-${previous + 1}`;
}

for (const [field, prefix] of [["buildings", "b"], ["people", "p"], ["people", "you"], ["fauna", "f"], ["piles", "pile"], ["marks", "mk"], ["campfires", "camp"], ["herbs", "herb"], ["plots", "plot"], ["saplings", "sapling"]] as const) {
  test(`nid skips exact existing ${field}/${prefix} IDs without changing stored data`, () => {
    const world = createStubWorld();
    const id = collisionCandidate(world, prefix);
    const records = field === "marks" ? world.player.marks : world[field];
    // Only the id is relevant to this focused allocator unit fixture.
    (records as { id: string }[]).push({ id });
    const before = JSON.stringify(world);
    assert.notEqual(nid(world, prefix), id);
    assert.equal(JSON.stringify(world), before);
  });
}

test("nid produces distinct pending allocations at the same paused tick", () => {
  const world = createStubWorld();
  const ids = Array.from({ length: 30 }, () => nid(world, "b"));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(world.tickCount, 0);
  assert.equal(world.buildings.length, 0);
});

test("nid checks newly inserted/replaced records, not just initial array identity or length", () => {
  const world = createStubWorld();
  world.buildings.push({ id: "old", kind: "rampartV", tx: 10, ty: 10, beds: [] });
  const candidate = collisionCandidate(world, "b");
  world.buildings[0]!.id = candidate;
  assert.notEqual(nid(world, "b"), candidate);
  world.buildings = [{ id: collisionCandidate(world, "b"), kind: "tower", tx: 20, ty: 20, beds: [] }];
  assert.notEqual(nid(world, "b"), world.buildings[0]!.id);
});

test("nid avoids existing IDs after a tick rollback and across world switching", () => {
  const first = createStubWorld();
  first.tickCount = 100;
  const id = nid(first, "b");
  first.buildings.push({ id, kind: "rampartV", tx: 10, ty: 10, beds: [] });
  first.tickCount--;
  assert.notEqual(nid(first, "b"), id);
  const second = structuredClone(first);
  const next = collisionCandidate(second, "b");
  second.buildings.push({ id: next, kind: "tower", tx: 20, ty: 20, beds: [] });
  assert.notEqual(nid(second, "b"), next);
  assert.deepEqual(first.buildings.map(b => b.id), [id]);
});

for (const kind of HOUSE_KINDS) {
  test(`loaded review save ${kind} preserves existing IDs and chest targeting`, () => {
    const stored = JSON.parse(readFileSync(new URL("../../public/art/phase1-review-save.json", import.meta.url), "utf8")) as World;
    // Controlled unit footing, not browser terrain proof. Preserve loaded records
    // and tickCount; only remove owned houses to satisfy the existing one-house rule.
    const world = createStubWorld();
    Object.assign(world, stored, { tiles: world.tiles });
    world.buildings = world.buildings.filter(b => b.ownerId !== world.player.id);
    const p = world.people.find(p => p.isPlayer)!;
    p.x = 100; p.z = 100; p.path = [];
    world.player.ghost = false;
    world.player.pack[HOUSE_DEEDS[kind]] = 1;
    world.player.pack.bandage = 3;
    const collision = collisionCandidate(world, "b");
    world.buildings.push({ id: collision, kind: "rampartV", tx: 10, ty: 10, beds: [] });
    const before = structuredClone(world.buildings), tick = world.tickCount, gold = world.gold;
    assert.equal(houseSiteError(world, kind, 100, 100), null);
    assert.equal(placeHouse(world, kind, 100, 100), null);
    const house = world.buildings.at(-1)!;
    assert.notEqual(house.id, collision);
    assert.equal(new Set(world.buildings.map(b => b.id)).size, world.buildings.length);
    assert.deepEqual(world.buildings.slice(0, -1), before);
    assert.equal(world.tickCount, tick);
    assert.equal(world.gold, gold);
    assert.equal(world.player.pack[HOUSE_DEEDS[kind]], 0);
    assert.equal(commandHouseItem(world, house.id, "bandage", 3), "Into the chest.");
    assert.equal(house.chest?.bandage, 3);
    assert.equal(commandHouseTake(world, house.id, "bandage", 3), "Out of the chest.");
    assert.equal(world.player.pack.bandage, 3);
    assert.deepEqual(world.buildings.slice(0, -1), before);
  });
}

test("nid advances through consecutive collisions before pending allocations", () => {
  const world = createStubWorld();
  const next = Number(collisionCandidate(world, "b").slice(2));
  const occupied = [next, next + 1, next + 2].map(n => `b-${n}`);
  world.buildings = occupied.map(id => ({ id, kind: "rampartV", tx: 10, ty: 10, beds: [] }));
  const first = nid(world, "b"), second = nid(world, "b");
  assert.ok(!occupied.includes(first) && !occupied.includes(second));
  assert.notEqual(first, second);
});

test("nid reserves the player identity before its body is inserted", () => {
  const world = createStubWorld();
  world.player.id = collisionCandidate(world, "you");
  assert.notEqual(nid(world, "you"), world.player.id);
});

test("nid supports partial bootstrap worlds", () => {
  const world = { tickCount: 0 } as World;
  const first = nid(world, "b"), second = nid(world, "b");
  assert.notEqual(first, second);
  assert.deepEqual(world, { tickCount: 0 });
});

test("nid compares literal IDs, not normalized numeric suffixes", () => {
  const world = createStubWorld();
  const next = collisionCandidate(world, "b");
  const literal = `b-00${next.slice(2)}`;
  world.buildings.push({ id: literal, kind: "tower", tx: 10, ty: 10, beds: [] });
  assert.equal(nid(world, "b"), next);
  assert.equal(world.buildings[0]!.id, literal);
});

test("ordinary construction also skips collisions without changing cost or beds", () => {
  const world = createStubWorld();
  const id = collisionCandidate(world, "b");
  world.buildings.push({ id, kind: "rampartV", tx: 10, ty: 10, beds: [] });
  const before = structuredClone(world.buildings), gold = world.gold;
  assert.equal(placeBuilding(world, "dormitory", 100, 100), null);
  assert.notEqual(world.buildings[1]!.id, id);
  assert.equal(world.gold, gold - 40);
  assert.deepEqual(world.buildings[1]!.beds, [{ occupantId: null }, { occupantId: null }]);
  assert.deepEqual(world.buildings.slice(0, 1), before);
  assert.equal(world.tickCount, 0);
});
