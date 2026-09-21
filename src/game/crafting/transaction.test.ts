import assert from "node:assert/strict";
import test from "node:test";
import { commandCraft, commandCraftExact } from "../craft.ts";
import { addResource, makeResourceStackKey, resourceCount } from "../inventory/resources.ts";
import { commandEquipRare, you } from "../player.ts";
import type { ResourceStackKey, World } from "../types.ts";
import { createWorld } from "../world.ts";
import { executeExactCraftTransaction } from "./transaction.ts";

const ROUGH_OAK = makeResourceStackKey("oak", "log", "rough");
const SOUND_OAK = makeResourceStackKey("oak", "log", "sound");
const CHOICE_REDWOOD = makeResourceStackKey("redwood", "log", "choice");
const CHOICE_IRONWOOD = makeResourceStackKey("ironwood", "log", "choice");
const SOUND_CLOTH = makeResourceStackKey("common_cloth", "cloth", "sound");
const PRISTINE_LINEN = makeResourceStackKey("fine_linen", "cloth", "pristine");
const IRON_INGOT = makeResourceStackKey("iron_ore", "ingot", "sound");
const HIGHLAND_INGOT = makeResourceStackKey("highland_ore", "ingot", "choice");
const EMBERITE_INGOT = makeResourceStackKey("emberite", "ingot", "choice");
const COPPER_INGOT = makeResourceStackKey("copper_ore", "ingot", "choice");
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
  assert.equal(bow.workmanship, "fine", "mastery on choice redwood floors ordinary work out");
  assert.equal(bow.maker, you(world)!.name);
  assert.deepEqual(bow.affixes, [], "materials and workmanship never invent gem magic");
  assert.deepEqual(bow.inlays, []);
  assert.equal(bow.resolvedStats?.damage, 8);
  assert.equal(bow.resolvedStats?.hitBonus, 3, "choice redwood accuracy trait plus fine workmanship");
  assert.deepEqual(bow.components, [
    { role: "body", resourceId: "redwood", form: "log", grade: "choice", amount: 5 },
    { role: "binding", resourceId: "common_cloth", form: "cloth", grade: "sound", amount: 1 },
  ]);
});

test("exact bowcraft - ironwood always creates one material-specific item with deterministic physical stats", () => {
  const world = createWorld();
  standAtYard(world);
  world.player.skills.carpentry = 100;
  addResource(world.player.resources, CHOICE_IRONWOOD, 5);
  addResource(world.player.resources, SOUND_CLOTH, 1);

  const note = withRoll(0.5, () => commandCraftExact(world, "bow", bowSelections(CHOICE_IRONWOOD)));

  assert.match(note ?? "", /ironwood bow/i);
  assert.equal(world.player.pack.bow, 0, "the unique bow leaves no duplicate mundane stack output");
  assert.equal(world.player.rares.length, 1);
  const bow = world.player.rares[0]!;
  assert.equal(bow.base, "bow");
  assert.equal(bow.formId, "bow");
  assert.equal(bow.recipeId, "bow");
  assert.equal(bow.recipeVersion, 1);
  assert.equal(bow.source, "crafted");
  assert.equal(bow.workmanship, "fine", "mastery on choice ironwood floors ordinary work out");
  assert.equal(bow.maker, you(world)!.name);
  assert.deepEqual(bow.affixes, [], "materials and workmanship never invent gem magic");
  assert.deepEqual(bow.inlays, []);
  assert.equal(bow.resolvedStats?.damage, 9.5, "base bow plus the choice ironwood damage trait");
  assert.equal(bow.resolvedStats?.hitBonus, 1, "fine workmanship only - ironwood grants no accuracy");
  assert.deepEqual(bow.components, [
    { role: "body", resourceId: "ironwood", form: "log", grade: "choice", amount: 5 },
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

test("exact swordcraft - emberite carries its ember trait into the blade", () => {
  const world = createWorld();
  standAtForge(world);
  world.player.skills.smithing = 100;
  addResource(world.player.resources, EMBERITE_INGOT, 5);
  addResource(world.player.resources, OAK_BOARD, 1);
  addResource(world.player.resources, SOUND_CLOTH, 1);
  const note = withRoll(0.5, () => commandCraftExact(world, "sword", swordSelections(EMBERITE_INGOT)));
  assert.match(note ?? "", /emberite sword/i);
  assert.equal(world.player.pack.sword, 0);
  assert.equal(world.player.rares.length, 1);
  assert.equal(world.player.rares[0]!.resolvedStats?.damage, 13);
  assert.equal(world.player.rares[0]!.resolvedStats?.hitBonus, 1);
  assert.deepEqual(world.player.rares[0]!.affixes, []);
});

test("exact swordcraft - copper becomes a unique handling blade with no damage trait", () => {
  const world = createWorld();
  standAtForge(world);
  world.player.skills.smithing = 100;
  addResource(world.player.resources, COPPER_INGOT, 5);
  addResource(world.player.resources, OAK_BOARD, 1);
  addResource(world.player.resources, SOUND_CLOTH, 1);

  const note = withRoll(0.5, () => commandCraftExact(world, "sword", swordSelections(COPPER_INGOT)));

  assert.match(note ?? "", /copper ore sword/i);
  assert.equal(world.player.pack.sword, 0, "specialty metal always crafts unique");
  assert.equal(world.player.rares.length, 1);
  const sword = world.player.rares[0]!;
  assert.equal(sword.workmanship, "fine", "mastery on choice stock floors to fine");
  assert.equal(sword.resolvedStats?.damage, 10, "copper contributes no damage trait");
  assert.equal(sword.resolvedStats?.hitBonus, 1.75, "choice handling edge plus fine workmanship");
  assert.deepEqual(sword.affixes, []);
  assert.deepEqual(sword.components?.[0], { role: "edge", resourceId: "copper_ore", form: "ingot", grade: "choice", amount: 5 });
});

test("exact swordcraft - bronze carries its keen trait through the alloy chain", () => {
  const world = createWorld();
  standAtForge(world);
  world.player.skills.smithing = 100;
  const BRONZE_INGOT = makeResourceStackKey("bronze", "ingot", "choice");
  addResource(world.player.resources, BRONZE_INGOT, 5);
  addResource(world.player.resources, OAK_BOARD, 1);
  addResource(world.player.resources, SOUND_CLOTH, 1);

  const note = withRoll(0.5, () => commandCraftExact(world, "sword", swordSelections(BRONZE_INGOT)));

  assert.match(note ?? "", /bronze sword/i);
  assert.equal(world.player.pack.sword, 0, "specialty metal always crafts unique");
  assert.equal(world.player.rares.length, 1);
  const blade = world.player.rares[0]!;
  assert.equal(blade.workmanship, "fine", "mastery on choice stock floors to fine");
  assert.equal(blade.resolvedStats?.damage, 10.75, "choice keen edge adds 0.75 damage");
  assert.equal(blade.resolvedStats?.hitBonus, 1, "common cloth adds no handling; fine workmanship only");
  assert.deepEqual(blade.affixes, []);
  assert.deepEqual(blade.components?.[0], { role: "edge", resourceId: "bronze", form: "ingot", grade: "choice", amount: 5 });
});

test("exact shieldcraft - iron plates carry the sturdy trait into armor", () => {
  const world = createWorld();
  standAtForge(world);
  world.player.skills.smithing = 100;
  const IRON_PLATES = makeResourceStackKey("iron_ore", "ingot", "choice");
  addResource(world.player.resources, IRON_PLATES, 3);
  addResource(world.player.resources, OAK_BOARD, 2);
  addResource(world.player.resources, SOUND_CLOTH, 1);
  const note = withRoll(0.5, () => commandCraftExact(world, "shield", [
    { role: "plate", key: IRON_PLATES },
    { role: "frame", key: OAK_BOARD },
    { role: "binding", key: SOUND_CLOTH },
  ]));
  assert.match(note ?? "", /shield/i);
  const shield = world.player.rares[0]!;
  assert.equal(shield.base, "shield");
  assert.equal(shield.resolvedStats?.armor, 3.5, "2 base + 1.5 choice sturdy plates; workmanship adds no armor");
  assert.equal(shield.resolvedStats?.damage, 0);
  assert.equal(shield.resolvedStats?.hitBonus, 0, "fine hit bonus clamps against the armor form's zero hit cap");
  assert.deepEqual(shield.components?.[0], { role: "plate", resourceId: "iron_ore", form: "ingot", grade: "choice", amount: 3 });
});

test("exact helmcraft - two plates and a lining, iron sturdy carries into head armor", () => {
  const world = createWorld();
  standAtForge(world);
  world.player.skills.smithing = 100;
  const IRON_PLATES = makeResourceStackKey("iron_ore", "ingot", "choice");
  addResource(world.player.resources, IRON_PLATES, 2);
  addResource(world.player.resources, SOUND_CLOTH, 1);
  const note = withRoll(0.5, () => commandCraftExact(world, "helm", [
    { role: "plate", key: IRON_PLATES },
    { role: "lining", key: SOUND_CLOTH },
  ]));
  assert.match(note ?? "", /helm/i);
  const helm = world.player.rares[0]!;
  assert.equal(helm.base, "helm");
  assert.equal(helm.resolvedStats?.armor, 3.5, "2 base + 1.5 choice sturdy plates; workmanship adds no armor");
  assert.equal(helm.resolvedStats?.damage, 0);
  assert.equal(helm.resolvedStats?.hitBonus, 0, "sound cloth handling clamps against the armor form's zero hit cap");
  assert.deepEqual(helm.components?.[0], { role: "plate", resourceId: "iron_ore", form: "ingot", grade: "choice", amount: 2 });
  const equipped = commandEquipRare(world, helm.uid);
  assert.ok(equipped, "helm rare equips generically through ITEM_META");
  assert.equal(world.player.wearRare.head, helm.uid, "helm slots into the head");
});

test("exact leathercraft - three hides and a binding, the tunic outclasses the tag shirt", () => {
  const world = createWorld();
  world.player.skills.tailoring = 100;
  world.player.wear.main = "knife"; // field work — the hides want a blade
  const CHOICE_HIDES = makeResourceStackKey("hide", "hide", "choice");
  addResource(world.player.resources, CHOICE_HIDES, 3);
  addResource(world.player.resources, SOUND_CLOTH, 1);
  const note = withRoll(0.5, () => commandCraftExact(world, "leather", [
    { role: "body", key: CHOICE_HIDES },
    { role: "binding", key: SOUND_CLOTH },
  ]));
  assert.match(note ?? "", /leather/i);
  const tunic = world.player.rares[0]!;
  assert.equal(tunic.base, "leather");
  assert.equal(tunic.resolvedStats?.armor, 3.5, "2 base + 1.5 choice supple hides; workmanship adds no armor");
  assert.deepEqual(tunic.components?.[0], { role: "body", resourceId: "hide", form: "hide", grade: "choice", amount: 3 });
  const equipped = commandEquipRare(world, tunic.uid);
  assert.ok(equipped, "the tunic equips generically through ITEM_META");
  assert.equal(world.player.wearRare.chest, tunic.uid, "the tunic slots into the chest");
});

test("exact leathercraft - the hides want a blade in hand", () => {
  const world = createWorld();
  world.player.skills.tailoring = 100;
  world.player.wear.main = undefined; // fresh hands — no blade
  const CHOICE_HIDES = makeResourceStackKey("hide", "hide", "choice");
  addResource(world.player.resources, CHOICE_HIDES, 3);
  addResource(world.player.resources, SOUND_CLOTH, 1);
  const note = withRoll(0.5, () => commandCraftExact(world, "leather", [
    { role: "body", key: CHOICE_HIDES },
    { role: "binding", key: SOUND_CLOTH },
  ]));
  assert.match(note ?? "", /blade/i);
  assert.equal(world.player.rares.length, 0, "no tunic without the blade");
});

test("exact leather set - hood, gloves, and hose carry supple into their slots", () => {
  const world = createWorld();
  world.player.skills.tailoring = 100;
  world.player.wear.main = "knife";
  const CHOICE_HIDES = makeResourceStackKey("hide", "hide", "choice");
  addResource(world.player.resources, CHOICE_HIDES, 7);
  addResource(world.player.resources, SOUND_CLOTH, 4);
  const cases = [
    { recipe: "hood", base: "hood", slot: "head", armor: 2.5, hides: 2 },
    { recipe: "gloves", base: "gloves", slot: "hands", armor: 2.5, hides: 2 },
    { recipe: "hose", base: "hose", slot: "legs", armor: 3.5, hides: 3 },
  ] as const;
  for (const { recipe, base, slot, armor, hides } of cases) {
    const before = world.player.rares.length;
    const note = withRoll(0.5, () => commandCraftExact(world, recipe, [
      { role: "body", key: CHOICE_HIDES },
      { role: "binding", key: SOUND_CLOTH },
    ]));
    assert.match(note ?? "", new RegExp(base, "i"));
    assert.equal(world.player.rares.length, before + 1, recipe);
    const piece = world.player.rares[world.player.rares.length - 1]!;
    assert.equal(piece.base, base);
    assert.equal(piece.resolvedStats?.armor, armor, `${recipe}: base + 1.5 choice supple`);
    assert.equal(piece.components?.[0]?.amount, hides);
    commandEquipRare(world, piece.uid);
    assert.equal(world.player.wearRare[slot], piece.uid, `${recipe} wears into ${slot}`);
  }
});

test("exact mailcraft - four plates and two lining, the chest piece outclasses the tag mail", () => {
  const world = createWorld();
  standAtForge(world);
  world.player.skills.smithing = 100;
  const IRON_PLATES = makeResourceStackKey("iron_ore", "ingot", "choice");
  addResource(world.player.resources, IRON_PLATES, 4);
  addResource(world.player.resources, SOUND_CLOTH, 2);
  const note = withRoll(0.5, () => commandCraftExact(world, "mail", [
    { role: "plate", key: IRON_PLATES },
    { role: "lining", key: SOUND_CLOTH },
  ]));
  assert.match(note ?? "", /mail/i);
  const mail = world.player.rares[0]!;
  assert.equal(mail.base, "mail");
  assert.equal(mail.resolvedStats?.armor, 5.5, "4 base + 1.5 choice sturdy plates; workmanship adds no armor");
  assert.equal(mail.resolvedStats?.damage, 0);
  assert.equal(mail.resolvedStats?.hitBonus, 0, "sound cloth handling clamps against the armor form's zero hit cap");
  assert.deepEqual(mail.components?.[0], { role: "plate", resourceId: "iron_ore", form: "ingot", grade: "choice", amount: 4 });
  const equipped = commandEquipRare(world, mail.uid);
  assert.ok(equipped, "mail rare equips generically through ITEM_META");
  assert.equal(world.player.wearRare.chest, mail.uid, "mail slots into the chest");
});

test("exact armor set - boots, gauntlets, and greaves carry sturdy into their slots", () => {
  const world = createWorld();
  standAtForge(world);
  world.player.skills.smithing = 100;
  const IRON_PLATES = makeResourceStackKey("iron_ore", "ingot", "choice");
  addResource(world.player.resources, IRON_PLATES, 7);
  addResource(world.player.resources, SOUND_CLOTH, 4);
  const cases = [
    { form: "boots", slot: "feet", armor: 3.5 },
    { form: "gauntlets", slot: "hands", armor: 3.5 },
    { form: "greaves", slot: "legs", armor: 4.5 },
  ] as const;
  for (const { form, slot, armor } of cases) {
    const note = withRoll(0.5, () => commandCraftExact(world, form, [
      { role: "plate", key: IRON_PLATES },
      { role: "lining", key: SOUND_CLOTH },
    ]));
    assert.ok(note && note.toLowerCase().includes(form), `${form} crafts through its exact recipe`);
    const piece = world.player.rares.find((r) => r.base === form)!;
    assert.equal(piece.resolvedStats?.armor, armor, `${form}: base + 1.5 choice sturdy plates`);
    const equipped = commandEquipRare(world, piece.uid);
    assert.ok(equipped, `${form} equips generically through ITEM_META`);
    assert.equal(world.player.wearRare[slot], piece.uid, `${form} slots into ${slot}`);
  }
});
