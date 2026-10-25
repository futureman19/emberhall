import assert from "node:assert/strict";
import test from "node:test";
import { RECIPES, commandCraft, commandCraftBatch, commandCraftExact, craftBlocker, stationsHere } from "../craft.ts";
import { verbsFor } from "../context.ts";
import { setWorld } from "../live.ts";
import { createPerson, createStubWorld } from "../world.ts";
import { placeObject } from "./commands.ts";
import { PLACEABLE_BY_ID } from "./catalog.ts";

function fixture() {
  const world = createStubWorld();
  const player = createPerson(world, () => 0.5, { x: 100, z: 100, isPlayer: true, member: true });
  world.people.push(player);
  world.player.id = player.id;
  world.player.ghost = false;
  Object.assign(world.player.pack, { board: 100, ingot: 100, silk: 20, garlic: 20, ginseng: 20 });
  Object.assign(world.player.skills, { smithing: 100, tailoring: 100, alchemy: 100 });
  world.player.wear.main = "knife";
  setWorld(world);
  return world;
}

for (const [id, station, recipe, product] of [
  ["smith_working_forge", "forge", "smelt", "ingot"],
  ["loom", "loom", "sew_hood", "hood"],
  ["alchemy_bench", "alchemy", "potion_heal", "potion_heal"],
] as const) {
  test(`${id}: placeable, dedicated station, context action and recipe dispatch`, () => {
    const world = fixture();
    world.player.pack.ore = 3;
    const rec = RECIPES.find((r) => r.id === recipe)!;
    assert.equal(rec.station, station);
    const before = structuredClone(world.player);
    assert.match(craftBlocker(world, rec)!, new RegExp(station));
    assert.match(commandCraft(world, recipe)!, new RegExp(station));
    assert.match(commandCraftBatch(world, recipe, 2)!, new RegExp(station));
    assert.deepEqual(world.player, before, "wrong station spends nothing");
    assert.ok(PLACEABLE_BY_ID[id]);
    assert.equal(placeObject(world, id, 102, 100, 1), null);
    assert.deepEqual(stationsHere(world), [station], "construction station is not a provided bench");
    const obj = world.placedObjects[0]!;
    assert.ok(verbsFor({ kind: "building", id: obj.id, tx: obj.tx, ty: obj.ty, label: id }).some((v) => v.verb === "use"));
    assert.equal(craftBlocker(world, rec), null);
    const count = world.player.pack[product];
    const roll = Math.random;
    try { Math.random = () => 0.5; commandCraft(world, recipe); } finally { Math.random = roll; }
    assert.equal(world.player.pack[product], count + 1);
    world.people[0]!.x = 120;
    assert.deepEqual(stationsHere(world), [], "stations have bounded reach");
  });
}

test("all tailoring and alchemy recipes require their specialty station; carpentry stays at bench", () => {
  for (const rec of RECIPES) {
    if (rec.skill === "tailoring") assert.equal(rec.station, "loom", rec.id);
    if (rec.skill === "alchemy") assert.equal(rec.station, "alchemy", rec.id);
    if (rec.skill === "carpentry") assert.equal(rec.station, "bench", rec.id);
  }
  const world = fixture();
  const before = structuredClone(world.player);
  assert.match(commandCraftExact(world, "leather", [])!, /loom/);
  assert.deepEqual(world.player, before);
  assert.equal(placeObject(world, "loom", 102, 100, 0), null);
  assert.doesNotMatch(commandCraftExact(world, "leather", [
    { role: "body", key: "hide:hide:sound" },
    { role: "binding", key: "common_cloth:cloth:sound" },
  ])!, /loom/);
});
