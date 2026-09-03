import assert from "node:assert/strict";
import test from "node:test";
import { COMPANION_DURATION, companionLabel, companionPose, getCompanionFx } from "./companion-animation.ts";
import { commandNamePet } from "./pets.ts";
import { commandFeed, commandFollow, commandRelease, commandStay, you } from "./player.ts";
import { createWorld } from "./world.ts";
import type { Creature, World } from "./types.ts";

function givePet(world: World, over: Partial<Creature> = {}) {
  const player = you(world)!;
  const pet: Creature = {
    id: "phase10-pet",
    kind: "wolf",
    x: player.x + 1,
    z: player.z,
    hp: 28,
    maxHp: 28,
    path: [],
    task: "follow",
    taskUntil: 0,
    corpseUntil: 0,
    home: { tx: Math.round(player.x), ty: Math.round(player.z) },
    ownerId: world.player.id,
    loyalty: 40,
    stay: false,
    name: "Soot",
    warnedLoyal: false,
    ...over,
  };
  world.fauna.push(pet);
  return pet;
}

test("companion animation - five reactions are deterministic and distinct", () => {
  const at = COMPANION_DURATION / 2;
  const poses = ["feed", "stay", "follow", "release", "name"].map((kind) => companionPose(kind as "feed" | "stay" | "follow" | "release" | "name", at));
  assert.equal(new Set(poses.map((pose) => JSON.stringify(pose))).size, 5);
  assert.deepEqual(companionPose("feed", 0), { hop: 0, bow: 0, turn: 0, stretch: 0 });
  assert.deepEqual(companionPose("feed", COMPANION_DURATION), { hop: 0, bow: 0, turn: 0, stretch: 0 });
  assert.equal(companionLabel("release"), "Released");
});

test("companion animation - stay, follow, and release emit after their exact mutations", () => {
  const world = createWorld();
  const pet = givePet(world);
  assert.equal(commandStay(world, pet.id), "Soot stays.");
  assert.equal(pet.stay, true);
  assert.equal(pet.task, "idle");
  assert.deepEqual(getCompanionFx(world), { kind: "stay", targetId: pet.id, x: pet.x, z: pet.z, at: world.hour });

  assert.equal(commandFollow(world, pet.id), "Soot follows.");
  assert.equal(pet.stay, false);
  assert.equal(pet.task, "follow");
  assert.deepEqual(getCompanionFx(world), { kind: "follow", targetId: pet.id, x: pet.x, z: pet.z, at: world.hour });

  assert.equal(commandRelease(world, pet.id), "Soot is gone.");
  assert.equal(pet.ownerId, null);
  assert.equal(pet.task, "wander");
  assert.deepEqual(getCompanionFx(world), { kind: "release", targetId: pet.id, x: pet.x, z: pet.z, at: world.hour });
});

test("companion animation - feeding snapshots the consumed item and preserves loyalty", () => {
  const world = createWorld();
  const pet = givePet(world, { loyalty: 10, warnedLoyal: true });
  world.player.pack = { meat: 1 } as World["player"]["pack"];
  assert.equal(commandFeed(world, pet.id), "Soot eats.");
  assert.equal(world.player.pack.meat, 0);
  assert.equal(pet.loyalty, 22);
  assert.equal(pet.warnedLoyal, false);
  assert.deepEqual(getCompanionFx(world), { kind: "feed", targetId: pet.id, x: pet.x, z: pet.z, at: world.hour, item: "meat" });
});

test("companion animation - naming emits the accepted canonical name", () => {
  const world = createWorld();
  const pet = givePet(world, { name: null });
  assert.equal(commandNamePet(world, pet.id, "  Ember   Paw  "), "wolf is Ember Paw now.");
  assert.equal(pet.name, "Ember Paw");
  assert.deepEqual(getCompanionFx(world), { kind: "name", targetId: pet.id, x: pet.x, z: pet.z, at: world.hour, name: "Ember Paw" });
  assert.equal(getCompanionFx(createWorld()), null, "events cannot leak between worlds");
});

test("companion animation - rejected commands emit nothing", () => {
  const world = createWorld();
  assert.equal(commandStay(world, "missing"), "It is not yours.");
  assert.equal(commandFollow(world, "missing"), "It is not yours.");
  assert.equal(commandRelease(world, "missing"), "It is not yours.");
  assert.equal(commandFeed(world, "missing"), "It is not yours.");
  assert.equal(commandNamePet(world, "missing", "Soot"), "It is not yours.");
  assert.equal(getCompanionFx(world), null);
});
