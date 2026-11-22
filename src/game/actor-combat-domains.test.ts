import assert from "node:assert/strict";
import test from "node:test";
import { createPerson, createStubWorld } from "./world.ts";
import { commandArmTechnique, armedTechniqueFor, techniqueCooldownLeft, techniqueUnlocked, techniqueWeaponOf } from "./techniques.ts";
import { commandNamePet, tickPets } from "./pets.ts";
import { commandTrack } from "./tracking.ts";
import { SECONDS_PER_HOUR } from "./catalog.ts";
import type { Creature } from "./types.ts";

function fixture() {
  const world = createStubWorld();
  const solo = createPerson(world, () => 0.5, { x: 10, z: 10, isPlayer: true });
  const body = createPerson(world, () => 0.5, { x: 100, z: 100 });
  world.people.push(solo, body);
  world.player.id = solo.id;
  const actor = structuredClone(world.player);
  actor.id = body.id;
  world.playerStates = { [body.id]: actor };
  world.hour = 100;
  return { world, solo, body, actor };
}

function pet(id: string, ownerId: string): Creature {
  return { id, ownerId, kind: "wolf", x: 101, z: 100, hp: 28, maxHp: 28,
    path: [], task: "follow", taskUntil: 0, corpseUntil: 0,
    home: { tx: 101, ty: 100 }, loyalty: 40, stay: false };
}

test("actor technique uses its own equipment, skill, armed state and cooldown", () => {
  const { world, actor } = fixture();
  world.player.wear.main = "bow";
  actor.wear.main = "sword";
  actor.skills.swords = 25;
  const before = structuredClone(world.player);
  assert.equal(techniqueWeaponOf(world, actor.id), "sword");
  assert.equal(techniqueUnlocked(world, "lunge", actor.id), true);
  assert.equal(commandArmTechnique(world, "lunge", actor.id), null);
  assert.equal(armedTechniqueFor(world, actor.id)?.id, "lunge");
  assert.equal(commandArmTechnique(world, "lunge", actor.id), null);
  actor.techniqueCoolUntil.lunge = world.hour + 2;
  assert.equal(techniqueCooldownLeft(world, "lunge", actor.id), 2);
  assert.match(commandArmTechnique(world, "lunge", actor.id)!, /catching/);
  assert.deepEqual(world.player, before);
});

test("actor technique resolves rare weapon and clears only actor stale arm", () => {
  const { world, actor } = fixture();
  actor.wear.main = "bow";
  actor.rares.push({ uid: "actor-sword", base: "sword", affixes: [], seed: 1, hour: 0 });
  actor.wearRare.main = "actor-sword";
  actor.armedTechnique = "lunge";
  world.player.armedTechnique = "bash";
  assert.equal(armedTechniqueFor(world, actor.id)?.id, "lunge");
  actor.wearRare.main = undefined;
  assert.equal(armedTechniqueFor(world, actor.id), null);
  assert.equal(actor.armedTechnique, null);
  assert.equal(world.player.armedTechnique, "bash");
});

test("actor ghost technique checks its selected body rather than solo body", () => {
  const { world, actor, solo, body } = fixture();
  actor.wear.main = "sword";
  actor.skills.swords = 100;
  solo.ghost = true;
  assert.equal(commandArmTechnique(world, "lunge", actor.id), null);
  actor.armedTechnique = null;
  solo.ghost = false;
  body.ghost = true;
  assert.match(commandArmTechnique(world, "lunge", actor.id)!, /dead/);
  assert.equal(actor.armedTechnique, null);
});

test("actor naming and loyalty affect only selected owner's pets", () => {
  const { world, actor } = fixture();
  const own = pet("actor-pet", actor.id);
  const other = pet("solo-pet", world.player.id);
  world.fauna.push(own, other);
  assert.match(commandNamePet(world, own.id, "Soot", actor.id), /Soot now/);
  assert.equal(commandNamePet(world, other.id, "Stolen", actor.id), "It is not yours.");
  tickPets(world, SECONDS_PER_HOUR, actor.id);
  assert.equal(own.loyalty, 39.5);
  assert.equal(other.loyalty, 40);
  tickPets(world, SECONDS_PER_HOUR);
  assert.equal(other.loyalty, 39.5);
  assert.equal(own.loyalty, 39.5);
});

test("unknown actors fail closed even with missing targets or no pets", () => {
  const { world } = fixture();
  const before = structuredClone(world);
  for (const id of ["missing", "", "__proto__"]) {
    for (const run of [
      () => techniqueWeaponOf(world, id),
      () => techniqueUnlocked(world, "lunge", id),
      () => techniqueCooldownLeft(world, "lunge", id),
      () => armedTechniqueFor(world, id),
      () => commandArmTechnique(world, "lunge", id),
      () => commandNamePet(world, "missing", "Soot", id),
      () => tickPets(world, 1, id),
      () => commandTrack(world, id),
    ]) assert.throws(run, /Unknown actor/);
  }
  assert.deepEqual(structuredClone(world), before);
});

test("actor tracking trains only selected sheet and turns selected body", () => {
  const { world, actor, solo, body } = fixture();
  solo.x = 102; solo.z = 100;
  actor.skills.tracking = 50;
  const before = structuredClone(world.player);
  assert.match(commandTrack(world, actor.id), /east, 2 paces/);
  assert.equal(body.facing, Math.PI / 2);
  assert.equal(actor.skills.tracking, 50.1);
  assert.deepEqual(world.player, before);
});
