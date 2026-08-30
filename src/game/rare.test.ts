import assert from "node:assert/strict";
import test from "node:test";
import { ITEM_META } from "./catalog.ts";
import { commandCraft, recipeById } from "./craft.ts";
import {
  AFFIXES,
  affixesFor,
  bornRare,
  equippedRares,
  exceptionalRank,
  rareClassOf,
  rareMods,
  rareName,
  rollExceptional,
  rollKillRare,
  rollRare,
  weaponDmg,
} from "./rare.ts";
import { mulberry32 } from "./rng.ts";
import { gearCompare, statLines, tagLine, worthLine } from "./iteminfo.ts";
import { describeAffix } from "./rare.ts";
import { commandEquip, commandEquipRare, commandUnequip, you } from "./player.ts";
import { applyMintRare, applyRedeem, decodeBase64Json, decodeItemInscription, encodeRareInscription, inscriptionBase64 } from "./vault.ts";
import { createWorld } from "./world.ts";
import type { ItemId, RareItem, World } from "./types.ts";

function givePack(w: World, items: Partial<Record<ItemId, number>>) {
  w.player.pack = { ...items } as World["player"]["pack"];
}

function standAt(w: World, kind: string) {
  const p = you(w)!;
  const b = w.buildings.find((x) => x.kind === kind)!;
  assert.ok(b, `world has a ${kind}`);
  p.x = b.tx;
  p.z = b.ty;
  p.path = [];
}

function makeRare(w: World, base: ItemId, affixes: string[]): RareItem {
  return bornRare({ uid: "tmp", base, affixes, seed: 0, hour: 0 }, w, "Testhand");
}

test("rare - classification: weapons, armor, jewelry; logs are mundane", () => {
  assert.equal(rareClassOf("sword"), "weapon");
  assert.equal(rareClassOf("club"), "weapon");
  assert.equal(rareClassOf("hatchet"), "weapon", "a bladed tool can bear a war-affix");
  assert.equal(rareClassOf("cuirass"), "armor");
  assert.equal(rareClassOf("heater"), "armor");
  assert.equal(rareClassOf("ring"), "jewelry");
  assert.equal(rareClassOf("pendant"), "jewelry");
  assert.equal(rareClassOf("log"), null);
  assert.equal(rareClassOf("bandage"), null);
});

test("rare - the name reads like UO: prefixes before, of-suffixes after", () => {
  const w = createWorld();
  const sword = makeRare(w, "sword", ["eminently accurate", "of power"]);
  assert.equal(rareName(sword), "an eminently accurate sword of power");
  const ring = makeRare(w, "ring", ["of the owl"]);
  assert.equal(rareName(ring), "a ring of the owl");
  const helm = makeRare(w, "helm", ["of invulnerability"]);
  assert.equal(rareName(helm), "a helm of invulnerability");
});

test("rare - rolls respect rank caps and never stack a group", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const rng = mulberry32(seed);
    const r = rollRare("sword", rng, { maxRank: 1, affixes: 2 });
    assert.ok(r, `seed ${seed} rolls a rare`);
    for (const a of r!.affixes) assert.equal(AFFIXES[a]!.rank, 1, `rank cap held: ${a}`);
    const groups = r!.affixes.map((a) => AFFIXES[a]!.group);
    assert.equal(new Set(groups).size, groups.length, "one affix per group");
  }
  const pool = affixesFor("sword", 5);
  assert.ok(pool.some((a) => a.group === "slayer"), "slayers in the weapon pool");
  assert.ok(affixesFor("ring", 5).every((a) => a.applies === "jewelry"), "rings only take charms");
});

test("rare - kill drops: wights hoard, hares never", () => {
  const w = createWorld();
  const found = rollKillRare(w, "wight", () => 0.01); // every gate passes
  assert.ok(found, "a wight drop with lucky dice");
  assert.ok(rareClassOf(found!.base), "drop base can bear its affixes");
  assert.ok(found!.affixes.every((a) => AFFIXES[a]!.rank <= 3), "wight hoard caps at rank III");
  assert.equal(rollKillRare(w, "hare", () => 0.01), null);
  assert.equal(rollKillRare(w, "wight", () => 0.99), null, "unlucky dice, no hoard");
});

test("rare - exceptional crafting: the work sings, the maker is marked", () => {
  const w = createWorld();
  standAt(w, "yard");
  givePack(w, { log: 2 });
  w.player.skills.carpentry = 100;
  const old = Math.random;
  Math.random = () => 0.01; // success AND the exceptional gate
  let note: string | null = null;
  try {
    note = commandCraft(w, "club");
  } finally {
    Math.random = old;
  }
  assert.ok(note?.includes("The work sings"), `sang: ${note}`);
  assert.equal(w.player.rares.length, 1, "a wonder was born");
  const wonder = w.player.rares[0]!;
  assert.equal(wonder.base, "club");
  assert.equal(wonder.maker, you(w)!.name);
  assert.equal(w.player.pack.club ?? 0, 0, "the stack yielded its piece to the wonder");
});

test("rare - exceptional respects class and rank ladders", () => {
  const w = createWorld();
  assert.equal(rollExceptional(w, "board", 100, 10, "X", () => 0.01), null, "boards stay mundane");
  assert.equal(exceptionalRank(100), 5);
  assert.equal(exceptionalRank(45), 1);
  const gm = rollExceptional(w, "sword", 100, 10, "X", mulberry32(7));
  assert.ok(gm, "a GM roll lands");
  assert.ok(gm!.affixes.every((a) => AFFIXES[a]!.rank <= 5));
});

test("rare - equipping a wonder swaps with the mundane; mods flow to combat", () => {
  const w = createWorld();
  givePack(w, { sword: 1 });
  const wonder = makeRare(w, "sword", ["supremely accurate", "of vanquishing"]);
  w.player.rares.push(wonder);
  // Mundane sword in hand first.
  assert.ok(commandEquip(w, "sword")?.includes("sword"));
  assert.equal(w.player.wear.main, "sword");
  // The wonder takes the hand; the mundane returns to the pack.
  assert.ok(commandEquipRare(w, wonder.uid)?.includes("sword"));
  assert.equal(w.player.wearRare.main, wonder.uid);
  assert.equal(w.player.wear.main, undefined);
  assert.equal(w.player.pack.sword, 1);
  const mods = rareMods(w);
  assert.equal(mods.hit, 10);
  assert.equal(mods.dmg, 5);
  // Unequip clears the link, the wonder stays in the keeping.
  assert.ok(commandUnequip(w, "main"));
  assert.equal(w.player.wearRare.main, undefined);
  assert.equal(w.player.rares.length, 1);
  assert.equal(rareMods(w).dmg, 0);
});

test("rare - weapon affixes count only from the hand; wards count anywhere worn", () => {
  const w = createWorld();
  const sword = makeRare(w, "sword", ["of vanquishing"]);
  const mail = makeRare(w, "mail", ["of fortification"]);
  w.player.rares.push(sword, mail);
  // Sword unequipped (in the keeping) — its damage must not count.
  assert.equal(rareMods(w).dmg, 0);
  assert.ok(commandEquipRare(w, mail.uid));
  assert.equal(rareMods(w).armor, 4, "the ward counts worn");
  assert.equal(rareMods(w).dmg, 0, "the blade still sleeps in the keeping");
});

test("rare - vault v2: a wonder mints with its identity and returns whole", () => {
  const w = createWorld();
  const wonder = makeRare(w, "mace", ["of force"]);
  w.player.rares.push(wonder);
  const payload = encodeRareInscription(w, wonder);
  assert.ok(payload?.rare, "rare block rides the inscription");
  assert.equal(payload!.v, 2);
  assert.equal(payload!.rare!.name, "a mace of force");
  assert.deepEqual(payload!.rare!.affixes, ["of force"]);
  assert.equal(payload!.rare!.maker, "Testhand");
  // Round-trip through base64 as the chain would carry it.
  const b64 = inscriptionBase64(w, wonder.base, wonder)!;
  const decoded = decodeItemInscription(decodeBase64Json(b64));
  assert.deepEqual(decoded!.rare!.affixes, ["of force"]);
  // Mint: the keeping loses the wonder; redeem: it returns whole.
  assert.equal(applyMintRare(w, wonder.uid), `${"a mace of force"} passes into the chain. It is yours — truly.`);
  assert.equal(w.player.rares.length, 0);
  const note = applyRedeem(w, decoded!.item, decoded!.rare);
  assert.ok(note.includes("returns from the chain"));
  assert.equal(w.player.rares.length, 1);
  assert.deepEqual(w.player.rares[0]!.affixes, ["of force"]);
  assert.equal(w.player.rares[0]!.base, "mace");
  assert.equal(w.player.rares[0]!.maker, "Testhand");
  assert.notEqual(w.player.rares[0]!.uid, wonder.uid, "a fresh local uid — the affixes are the identity");
});

test("rare - vault v1 payloads still read; mundane redeem unchanged", () => {
  const w = createWorld();
  const v1 = { app: "emberhall", v: 1, type: "item", item: "log", label: "Log", world: 1, hour: 1 };
  const decoded = decodeItemInscription(v1);
  assert.ok(decoded);
  assert.equal(decoded!.rare, undefined);
  givePack(w, { log: 0 });
  applyRedeem(w, "log");
  assert.equal(w.player.pack.log, 1);
});

test("rare - weaponDmg table intact; slayer multiplies only its kind", () => {
  assert.equal(weaponDmg("sword"), 10);
  assert.equal(weaponDmg(null), 2);
  const w = createWorld();
  const slayer = makeRare(w, "sword", ["of wight-slaying"]);
  w.player.rares.push(slayer);
  assert.ok(commandEquipRare(w, slayer.uid));
  const mods = rareMods(w);
  assert.equal(mods.vs.wight, 1.5);
  assert.equal(mods.vs.wolf, undefined);
  assert.ok(equippedRares(w).some((e) => e.rare.uid === slayer.uid));
});

test("rare - every affix id in the table is well-formed", () => {
  for (const [id, a] of Object.entries(AFFIXES)) {
    assert.equal(id, a.label, `key matches label: ${id}`);
    assert.ok(a.rank >= 1 && a.rank <= 5, `${id} ranked`);
    assert.ok(["weapon", "armor", "jewelry"].includes(a.applies), `${id} applies somewhere`);
  }
  assert.ok(ITEM_META.sword, "catalog still sane");
});

test("tips - describeAffix spells every affix out in human lines", () => {
  assert.equal(describeAffix("supremely accurate"), "+10% to hit");
  assert.equal(describeAffix("of vanquishing"), "+5 damage");
  assert.equal(describeAffix("of fortification"), "+4 armor");
  assert.equal(describeAffix("of wight-slaying"), "half again the bite against wights");
  assert.match(describeAffix("of the owl"), /^\+5 /);
  assert.equal(describeAffix("nonsense"), "nonsense", "unknown text passes through");
});

test("tips - iteminfo: stats, tags, and shop worth lines", () => {
  assert.deepEqual(statLines("sword"), ["10 damage", "a tool"]);
  assert.deepEqual(statLines("cuirass"), ["2 armor"]);
  assert.ok(statLines("hatchet").includes("6 damage"));
  assert.ok(statLines("hatchet").includes("a tool"));
  assert.deepEqual(statLines("cabbage"), [], "a cabbage has no combat stats");
  assert.equal(tagLine("log"), "wood · fuel");
  assert.equal(worthLine("relic"), "shops pay 40g");
  assert.equal(worthLine("hide") !== null, true);
});

test("compare - weapons measure damage against the hand you have", () => {
  const w = createWorld();
  // A new adventurer starts with a hatchet in hand (6 damage).
  assert.deepEqual(gearCompare(w, "sword"), { stat: "damage", delta: 4, vsLabel: "your hatchet" });
  w.player.wear.main = undefined;
  assert.deepEqual(gearCompare(w, "sword"), { stat: "damage", delta: 8, vsLabel: "bare hands" });
  w.player.wear.main = "sword";
  assert.deepEqual(gearCompare(w, "club"), { stat: "damage", delta: -3, vsLabel: "your sword" });
  assert.deepEqual(gearCompare(w, "sword"), { stat: "damage", delta: 0, vsLabel: "your sword" }, "a twin is an even trade");
});

test("compare - armor measures the slot it would fill", () => {
  const w = createWorld();
  assert.deepEqual(gearCompare(w, "cuirass"), { stat: "armor", delta: 2, vsLabel: "nothing" });
  w.player.wear.chest = "cuirass";
  assert.equal(gearCompare(w, "cuirass")?.delta, 0);
  assert.equal(gearCompare(w, "ring"), null, "a bare ring against a bare ring is no story");
});

test("compare - rares count their affixes, worn or hovered", () => {
  const w = createWorld();
  const wonder: RareItem = { uid: "r1", base: "sword", affixes: ["of power"], seed: 1, hour: 0 };
  // Hovered wonder vs bare hands: 10 + 4 - 2 = +12
  w.player.wear.main = undefined;
  assert.deepEqual(gearCompare(w, "sword", wonder), { stat: "damage", delta: 12, vsLabel: "bare hands" });
  // Wear the wonder; a mundane sword now looks sad: 10 - 14 = -4
  w.player.rares.push(wonder);
  w.player.wearRare.main = "r1";
  assert.deepEqual(gearCompare(w, "sword"), { stat: "damage", delta: -4, vsLabel: rareName(wonder) });
  // Hovering the very wonder you wear says nothing
  assert.equal(gearCompare(w, "sword", wonder), null);
});

test("compare - warded armor rares tip the armor line", () => {
  const w = createWorld();
  const bulwark: RareItem = { uid: "r2", base: "cuirass", affixes: ["of fortification"], seed: 1, hour: 0 };
  assert.deepEqual(gearCompare(w, "cuirass", bulwark), { stat: "armor", delta: 6, vsLabel: "nothing" });
});
