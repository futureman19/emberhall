import assert from "node:assert/strict";
import test from "node:test";
import { commandCraft, commandCraftExact } from "../craft.ts";
import { addResource, makeResourceStackKey, resourceCount } from "../inventory/resources.ts";
import { you } from "../player.ts";
import type { ResourceStackKey, World } from "../types.ts";
import { createWorld } from "../world.ts";
import { executeExactCraftTransaction } from "./transaction.ts";

const ROUGH_OAK = makeResourceStackKey("oak", "log", "rough");
const SOUND_OAK = makeResourceStackKey("oak", "log", "sound");
const CHOICE_REDWOOD = makeResourceStackKey("redwood", "log", "choice");
const SOUND_CLOTH = makeResourceStackKey("common_cloth", "cloth", "sound");
const PRISTINE_LINEN = makeResourceStackKey("fine_linen", "cloth", "pristine");
const IRON_INGOT = makeResourceStackKey("iron_ore", "ingot", "sound");
const HIGHLAND_INGOT = makeResourceStackKey("highland_ore", "ingot", "choice");
const OAK_BOARD = makeResourceStackKey("oak", "board", "sound");

function bowSelections(body: ResourceStackKey = CHOICE_REDWOOD, binding: ResourceStackKey = SOUND_CLOTH) {
  return [
    { role: "body" as const, key: body },
    { role: "binding" as const, key: binding },
  ];
}

function standAtYard(world: World): void {
  const yard = world.buildings.find(({ kind }) => kind === "yard");
  assert.ok(yard);
  const player = you(world)!;
  player.x = yard.tx;
  player.z = yard.ty;
}

function standAtForge(world: World): void {
  const forge = world.buildings.find(({ kind }) => kind === "forge");
  assert.ok(forge);
  const player = you(world)!;
  player.x = forge.tx;
  player.z = forge.ty;
}

function swordSelections(edge: ResourceStackKey) {
  return [
    { role: "edge" as const, key: edge },
    { role: "hilt" as const, key: OAK_BOARD },
    { role: "binding" as const, key: SOUND_CLOTH },
  ];
}

function withRoll<T>(value: number, action: () => T): T {
  const original = Math.random;
  Math.random = () => value;
  try {
    return action();
  } finally {
    Math.random = original;
  }
}

test("exact transaction - consumes only selected stacks and creates the declared output once", () => {
  const world = createWorld();
  addResource(world.player.resources, ROUGH_OAK, 9);
  addResource(world.player.resources, CHOICE_REDWOOD, 5);
  addResource(world.player.resources, SOUND_CLOTH, 1);

  const result = executeExactCraftTransaction(world.player, "bow", bowSelections());

  assert.equal(result.status, "crafted");
  if (result.status !== "crafted") return;
  assert.deepEqual(result.output, { itemId: "bow", quantity: 1 });
  assert.equal(world.player.pack.bow, 1);
  assert.equal(resourceCount(world.player.resources, CHOICE_REDWOOD), 0);
  assert.equal(resourceCount(world.player.resources, SOUND_CLOTH), 0);
  assert.equal(resourceCount(world.player.resources, ROUGH_OAK), 9, "unselected ordinary oak remains untouched");
});

test("exact transaction - all requirements validate before any inventory mutation", () => {
  const world = createWorld();
  addResource(world.player.resources, CHOICE_REDWOOD, 5);
  const before = structuredClone(world.player);

  const result = executeExactCraftTransaction(world.player, "bow", bowSelections());

  assert.deepEqual(result, {
    status: "blocked",
    reason: "materials",
    message: "Not enough Common Cloth · Sound cloth for binding.",
  });
  assert.deepEqual(world.player, before);
});

test("exact transaction - mixed role selections and malformed inventory roll back without chance", () => {
  const mixed = createWorld();
  addResource(mixed.player.resources, ROUGH_OAK, 5);
  addResource(mixed.player.resources, CHOICE_REDWOOD, 5);
  addResource(mixed.player.resources, SOUND_CLOTH, 1);
  const mixedBefore = structuredClone(mixed.player);
  assert.throws(
    () => executeExactCraftTransaction(mixed.player, "bow", [
      { role: "body", key: ROUGH_OAK },
      { role: "body", key: CHOICE_REDWOOD },
      { role: "binding", key: SOUND_CLOTH },
    ]),
    /multiple material stacks for role body/,
  );
  assert.deepEqual(mixed.player, mixedBefore);

  const malformed = createWorld();
  addResource(malformed.player.resources, CHOICE_REDWOOD, 5);
  addResource(malformed.player.resources, SOUND_CLOTH, 1);
  malformed.player.resources.stacks["ruby:log:rough" as ResourceStackKey] = 1;
  const malformedBefore = structuredClone(malformed.player);
  assert.throws(
    () => executeExactCraftTransaction(malformed.player, "bow", bowSelections()),
    /form log is incompatible with resource ruby/,
  );
  assert.deepEqual(malformed.player, malformedBefore);
});

test("exact transaction - output overflow rejects before selected resources are debited", () => {
  const world = createWorld();
  addResource(world.player.resources, CHOICE_REDWOOD, 5);
  addResource(world.player.resources, SOUND_CLOTH, 1);
  world.player.pack.bow = Number.MAX_SAFE_INTEGER;
  const before = structuredClone(world.player);

  assert.throws(
    () => executeExactCraftTransaction(world.player, "bow", bowSelections()),
    /craft output count exceeds safe integer range/,
  );
  assert.deepEqual(world.player, before);
});

test("exact transaction - legacy baseline log can satisfy an exact sound-oak selection", () => {
  const world = createWorld();
  world.player.pack.log = 5;
  addResource(world.player.resources, SOUND_OAK, 2);
  addResource(world.player.resources, PRISTINE_LINEN, 1);

  const result = executeExactCraftTransaction(world.player, "bow", bowSelections(SOUND_OAK, PRISTINE_LINEN));

  assert.equal(result.status, "crafted");
  assert.equal(world.player.pack.log, 0, "legacy baseline is spent before typed sound oak");
  assert.equal(resourceCount(world.player.resources, SOUND_OAK), 2);
  assert.equal(world.player.pack.bow, 1);
});

test("exact transaction - existing utility recipes retain deterministic compatibility behavior", () => {
  const world = createWorld();
  standAtYard(world);
  world.player.pack.log = 0;
  addResource(world.player.resources, ROUGH_OAK, 1);
  addResource(world.player.resources, CHOICE_REDWOOD, 5);
  world.player.skills.carpentry = 100;

  assert.match(withRoll(0.5, () => commandCraft(world, "board")) ?? "", /2 boards/);
  assert.equal(resourceCount(world.player.resources, ROUGH_OAK), 0);
  assert.equal(resourceCount(world.player.resources, CHOICE_REDWOOD), 5);
});

test("exact bowcraft - five oak and one cloth produce one generic mundane bow", () => {
  const world = createWorld();
  standAtYard(world);
  world.player.skills.carpentry = 100;
  addResource(world.player.resources, ROUGH_OAK, 5);
  addResource(world.player.resources, SOUND_CLOTH, 1);

  const note = withRoll(0.5, () => commandCraftExact(world, "bow", bowSelections(ROUGH_OAK, SOUND_CLOTH)));

  assert.match(note ?? "", /bow/i);
  assert.equal(world.player.pack.bow, 1);
  assert.equal(world.player.rares.length, 0);
  assert.equal(resourceCount(world.player.resources, ROUGH_OAK), 0);
  assert.equal(resourceCount(world.player.resources, SOUND_CLOTH), 0);
});

test("exact bowcraft - redwood always creates one material-specific item with deterministic physical stats", () => {
  const world = createWorld();
  standAtYard(world);
  world.player.skills.carpentry = 100;
  addResource(world.player.resources, CHOICE_REDWOOD, 5);
  addResource(world.player.resources, SOUND_CLOTH, 1);

  const note = withRoll(0.5, () => commandCraftExact(world, "bow", bowSelections()));

  assert.match(note ?? "", /redwood bow/i);
  assert.equal(world.player.pack.bow, 0, "the unique bow leaves no duplicate mundane stack output");
  assert.equal(world.player.rares.length, 1);
  const bow = world.player.rares[0]!;
  assert.equal(bow.base, "bow");
  assert.equal(bow.formId, "bow");
  assert.equal(bow.recipeId, "bow");
  assert.equal(bow.recipeVersion, 1);
  assert.equal(bow.source, "crafted");
  assert.equal(bow.workmanship, "ordinary");
  assert.equal(bow.maker, you(world)!.name);
  assert.deepEqual(bow.affixes, [], "materials and workmanship never invent gem magic");
  assert.deepEqual(bow.inlays, []);
  assert.equal(bow.resolvedStats?.damage, 8);
  assert.equal(bow.resolvedStats?.hitBonus, 2, "choice redwood contributes its stable accuracy trait");
  assert.deepEqual(bow.components, [
    { role: "body", resourceId: "redwood", form: "log", grade: "choice", amount: 5 },
    { role: "binding", resourceId: "common_cloth", form: "cloth", grade: "sound", amount: 1 },
  ]);
});

test("exact bowcraft - exceptional oak becomes one maker-marked physical item without magic", () => {
  const world = createWorld();
  standAtYard(world);
  world.player.skills.carpentry = 100;
  addResource(world.player.resources, ROUGH_OAK, 5);
  addResource(world.player.resources, SOUND_CLOTH, 1);

  withRoll(0.01, () => commandCraftExact(world, "bow", bowSelections(ROUGH_OAK, SOUND_CLOTH)));

  assert.equal(world.player.pack.bow, 0);
  assert.equal(world.player.rares.length, 1);
  const bow = world.player.rares[0]!;
  assert.equal(bow.workmanship, "exceptional");
  assert.equal(bow.maker, you(world)!.name);
  assert.deepEqual(bow.affixes, []);
  assert.equal(bow.resolvedStats?.damage, 9);
  assert.equal(bow.resolvedStats?.hitBonus, 2);
});

test("exact bowcraft - material rejection happens before chance and changes no carried value", () => {
  const world = createWorld();
  standAtYard(world);
  addResource(world.player.resources, CHOICE_REDWOOD, 5);
  const before = structuredClone(world.player);
  const original = Math.random;
  Math.random = () => {
    throw new Error("invalid exact craft must not roll");
  };
  try {
    assert.equal(
      commandCraftExact(world, "bow", bowSelections()),
      "Not enough Common Cloth · Sound cloth for binding.",
    );
  } finally {
    Math.random = original;
  }
  assert.deepEqual(world.player, before);
});

test("exact bowcraft - legacy bow command cannot bypass explicit material selection", () => {
  const world = createWorld();
  standAtYard(world);
  world.player.pack.log = 5;
  const before = structuredClone(world.player);

  assert.equal(commandCraft(world, "bow"), "Choose exact materials for this equipment recipe.");
  assert.deepEqual(world.player, before);
});

test("exact swordcraft - ordinary iron remains fungible while Highland steel becomes unique", () => {
  const iron = createWorld();
  standAtForge(iron);
  iron.player.skills.smithing = 100;
  addResource(iron.player.resources, IRON_INGOT, 5);
  addResource(iron.player.resources, OAK_BOARD, 1);
  addResource(iron.player.resources, SOUND_CLOTH, 1);
  withRoll(0.5, () => commandCraftExact(iron, "sword", swordSelections(IRON_INGOT)));
  assert.equal(iron.player.pack.sword, 1);
  assert.equal(iron.player.rares.length, 0);

  const highland = createWorld();
  standAtForge(highland);
  highland.player.skills.smithing = 100;
  addResource(highland.player.resources, HIGHLAND_INGOT, 5);
  addResource(highland.player.resources, OAK_BOARD, 1);
  addResource(highland.player.resources, SOUND_CLOTH, 1);
  const note = withRoll(0.5, () => commandCraftExact(highland, "sword", swordSelections(HIGHLAND_INGOT)));
  assert.match(note ?? "", /highland ore sword/i);
  assert.equal(highland.player.pack.sword, 0);
  assert.equal(highland.player.rares.length, 1);
  assert.equal(highland.player.rares[0]!.resolvedStats?.damage, 11.5);
  assert.deepEqual(highland.player.rares[0]!.affixes, []);
});
