import { EH, inGreybarrow } from "./atlas.ts";
import { FAUNA_META, hasTag, ITEM_META, armorOf, tagConsumeOrder } from "./catalog.ts";
import { harvestNow, plantNow, tillNow } from "./farm.ts";
import { ARROW_RANGE, FIREBALL_RANGE, burstDeath, castNow, maxMana, tickMana } from "./magery.ts";
import { pickPetName } from "./names.ts";
import { petLabel } from "./pets.ts";
import { astar, nearestWalkable, tileOf } from "./pathfinding.ts";
import { addToPile, takeFromPile } from "./piles.ts";
import { mulberry32 } from "./rng.ts";
import { successChance, tryGain } from "./skills.ts";
import { playSfx } from "./vale-sfx.ts";
import { completeObjective, log } from "./world.ts";
import { effectiveMain, rareMods, rareName, rollKillRare, weaponDmg } from "./rare.ts";
import type { ItemId, Person, RareItem, SkillId, WearSlot, World } from "./types.ts";

export function you(world: World) {
  return world.people.find((p) => p.isPlayer) ?? world.people.find((p) => p.id === world.player.id) ?? null;
}

export function isGhost(world: World) {
  const p = you(world);
  return Boolean(world.player.ghost) || Boolean(p?.ghost);
}

export function nearestHealer(world: World) {
  const p = you(world);
  if (!p) return null;
  let best: Person | null = null;
  let d = Infinity;
  for (const n of world.people) {
    if (n.role !== "healer") continue;
    const dd = Math.hypot(n.x - p.x, n.z - p.z);
    if (dd < d) {
      d = dd;
      best = n;
    }
  }
  return best;
}

function hands(world: World) {
  if (isGhost(world)) return "A ghost cannot.";
  return null;
}

const SPILL: ItemId[] = [
  "log", "board", "ore", "meat", "hide", "ingot", "club", "shield",
  "garlic", "ginseng", "silk", "pearl", "moss", "mandrake", "ash", "nightshade",
  "cabbage", "wheat", "cabbage_seed", "wheat_seed", "garlic_seed",
];

const TAME_RETALIATE: ReadonlySet<string> = new Set([
  "wolf",
  "wight",
  "ridgeback_warg",
  "barrow_hound",
  "reedback_stalker",
  "brine_hound",
  "brine_troll",
  "stonefang_ogre",
  "orc_marauder",
  "pine_lynx",
]);

const RETALIATE_KINDS: ReadonlySet<string> = new Set([
  "wolf",
  "wight",
  "ridgeback_warg",
  "barrow_hound",
  "reedback_stalker",
  "brine_hound",
  "brine_troll",
  "stonefang_ogre",
  "orc_marauder",
  "pine_lynx",
  "greybarrow_wightling",
  "ashen_banshee",
  "bonecrow",
]);

export function resurrect(world: World, at?: { x: number; z: number }) {
  const p = you(world);
  if (!p) return "You are not in the vale.";
  if (!isGhost(world)) return "You still bleed.";
  p.ghost = false;
  world.player.ghost = false;
  p.hp = Math.max(1, Math.floor(p.maxHp * 0.4));
  world.player.mana = Math.floor(maxMana(p.int, world.player.skills.magery ?? 0) * 0.4);
  world.player.intent.kind = "none";
  world.player.armedSpell = null;
  if (at) {
    p.x = at.x;
    p.z = at.z;
    p.path = [];
  }
  completeObjective(world, "rise");
  log(world, "Blood remembers. Go find your body.");
  return "Blood remembers. Go find your body.";
}

function dieAsGhost(world: World, p: Person) {
  const tx = Math.round(p.x);
  const ty = Math.round(p.z);
  const spill: Partial<Record<ItemId, number>> = {};
  for (const id of SPILL) {
    const n = Math.floor((world.player.pack[id] ?? 0) / 2);
    if (n > 0) {
      world.player.pack[id] -= n;
      spill[id] = n;
    }
  }
  const goldDrop = Math.floor(world.gold / 3);
  world.gold -= goldDrop;
  addToPile(world, tx, ty, spill, "death", world.hour + 48, "your corpse", goldDrop);
  world.player.corpseAt = { tx, ty };
  burstDeath(p.x, p.z, world.hour);
  playSfx("die", 0.55);
  p.ghost = true;
  p.hp = 0;
  p.path = [];
  world.player.ghost = true;
  world.player.intent.kind = "none";
  world.player.armedSpell = null;
  world.player.nightSightUntil = 0;
  completeObjective(world, "die");
  return "You die. The dirt keeps your body. Walk to a healer — Ione stands at the hall.";
}

function pathBeside(world: World, p: Person, tx: number, ty: number) {
  const dest = nearestWalkable(world, tx, ty);
  if (!dest) return false;
  const from = tileOf(p.x, p.z);
  const path = astar(world, from.tx, from.ty, dest.x, dest.y);
  if (!path) return false;
  p.path = path.map((n) => ({ tx: n.x, ty: n.y }));
  return true;
}

export function commandWalk(world: World, tx: number, ty: number, cap = 9000): string | null {
  const p = you(world);
  if (!p) return "You are not in the vale.";
  world.player.armedSpell = null;
  const dest = nearestWalkable(world, tx, ty);
  if (!dest) return "No footing.";
  const from = tileOf(p.x, p.z);
  const path = astar(world, from.tx, from.ty, dest.x, dest.y, cap);
  if (!path) return "The way is closed.";
  p.path = path.map((n) => ({ tx: n.x, ty: n.y }));
  world.player.intent = { kind: "walk", tx: dest.x, ty: dest.y, targetId: null, spell: null };
  return null;
}

export function inHand(world: World) {
  return effectiveMain(world);
}

/** A worn charm lifts the skill it blesses. */
export function effSkill(world: World, id: SkillId) {
  return (world.player.skills[id] ?? 0) + (rareMods(world).skills[id] ?? 0);
}

export function needHeld(world: World, item: ItemId) {
  if (world.player.wear.main === item) return null;
  return `Hold the ${ITEM_META[item].label.toLowerCase()} — tap it in You.`;
}

export function commandChop(world: World, tx: number, ty: number) {
  const p = you(world);
  if (!p) return "You are not in the vale.";
  const dead = hands(world);
  if (dead) return dead;
  const held = inHand(world);
  if (!held || !hasTag(held, "blade")) return "Hold a blade — hatchet, knife, or sword.";
  world.player.intent = { kind: "chop", tx, ty, targetId: null, spell: null };
  pathBeside(world, p, tx, ty);
  return null;
}

export function commandMine(world: World, tx: number, ty: number) {
  const p = you(world);
  if (!p) return "You are not in the vale.";
  const dead = hands(world);
  if (dead) return dead;
  const held = needHeld(world, "pick");
  if (held) return held;
  world.player.intent = { kind: "mine", tx, ty, targetId: null, spell: null };
  pathBeside(world, p, tx, ty);
  return null;
}

export function commandHunt(world: World, id: string) {
  const dead = hands(world);
  if (dead) return dead;
  const p = you(world);
  const c = world.fauna.find((x) => x.id === id);
  if (!p || !c || c.task === "dead") return "Nothing to hunt.";
  world.player.intent = { kind: "hunt", tx: Math.round(c.x), ty: Math.round(c.z), targetId: c.id, spell: null };
  pathBeside(world, p, Math.round(c.x), Math.round(c.z));
  return null;
}

export function commandTame(world: World, id: string) {
  const dead = hands(world);
  if (dead) return dead;
  const p = you(world);
  const c = world.fauna.find((x) => x.id === id);
  if (!p || !c || c.task === "dead") return "Nothing to tame.";
  if (FAUNA_META[c.kind].tameDiff >= 90) return "It will not be tamed.";
  if (world.fauna.filter((x) => x.ownerId === world.player.id).length >= 3) return "Three is enough.";
  world.player.intent = { kind: "tame", tx: Math.round(c.x), ty: Math.round(c.z), targetId: c.id, spell: null };
  p.path = [];
  return null;
}

export function commandStay(world: World, id: string) {
  const c = world.fauna.find((x) => x.id === id);
  if (!c || c.ownerId !== world.player.id) return "It is not yours.";
  c.stay = true;
  c.task = "idle";
  c.path = [];
  const note = `${petLabel(c)} stays.`;
  log(world, note);
  return note;
}

export function commandFollow(world: World, id: string) {
  const c = world.fauna.find((x) => x.id === id);
  if (!c || c.ownerId !== world.player.id) return "It is not yours.";
  c.stay = false;
  c.task = "follow";
  const note = `${petLabel(c)} follows.`;
  log(world, note);
  return note;
}

export function commandRelease(world: World, id: string) {
  const c = world.fauna.find((x) => x.id === id);
  if (!c || c.ownerId !== world.player.id) return "It is not yours.";
  const who = petLabel(c);
  c.ownerId = null;
  c.stay = false;
  c.task = "wander";
  const note = `${who} is gone.`;
  log(world, note);
  return note;
}

export function commandFeed(world: World, id: string) {
  const dead = hands(world);
  if (dead) return dead;
  const c = world.fauna.find((x) => x.id === id);
  if (!c || c.ownerId !== world.player.id) return "It is not yours.";
  const eats = FAUNA_META[c.kind].eats;
  const cands = [...new Set(eats.flatMap((t) => tagConsumeOrder(t)))];
  const give = cands.find((it) => (world.player.pack[it] ?? 0) > 0);
  if (!give) {
    const wants = new Set(eats);
    if (wants.has("plant")) return "It wants greens.";
    if (wants.has("meat")) return "It wants meat.";
    return "It wants a proper feed.";
  }
  world.player.pack[give] = (world.player.pack[give] ?? 0) - 1;
  c.loyalty = Math.min(100, c.loyalty + 12);
  if (c.loyalty >= 15) c.warnedLoyal = false; // a fed friend forgives
  const note = `${petLabel(c)} eats.`;
  log(world, note);
  return note;
}

export function commandSkin(world: World, id: string) {
  const dead = hands(world);
  if (dead) return dead;
  const p = you(world);
  const c = world.fauna.find((x) => x.id === id);
  if (!p || !c) return "Nothing to dress.";
  const held = inHand(world);
  if (!held || !hasTag(held, "blade")) return "Hold a blade — hatchet, knife, or sword.";
  world.player.intent = { kind: "skin", tx: Math.round(c.x), ty: Math.round(c.z), targetId: c.id, spell: null };
  pathBeside(world, p, Math.round(c.x), Math.round(c.z));
  return null;
}

export function commandLoot(world: World, id: string) {
  const dead = hands(world);
  if (dead) return dead;
  return takeFromPile(world, id);
}

export function commandDrop(world: World, item: ItemId) {
  const dead = hands(world);
  if (dead) return dead;
  const p = you(world);
  const n = world.player.pack[item] ?? 0;
  if (!p || n < 1) return "You do not carry that.";
  world.player.pack[item] = n - 1;
  addToPile(world, Math.round(p.x), Math.round(p.z), { [item]: 1 }, "drop", world.hour + 24, "sack");
  completeObjective(world, "pile");
  return `Dropped ${ITEM_META[item].label.toLowerCase()}.`;
}

export function commandEquip(world: World, item: ItemId) {
  const dead = hands(world);
  if (dead) return dead;
  const meta = ITEM_META[item];
  if (!meta.slot) return "You cannot hold or wear that.";
  if ((world.player.pack[item] ?? 0) < 1) return "You do not carry that.";
  const rareUidThere = world.player.wearRare[meta.slot];
  if (rareUidThere) {
    // A rare already graces that slot — it comes back to the pack.
    world.player.wearRare[meta.slot] = undefined;
    void rareUidThere; // the rare itself stays in player.rares; only its wear-link clears
  }
  const prev = world.player.wear[meta.slot];
  if (prev) world.player.pack[prev] = (world.player.pack[prev] ?? 0) + 1;
  world.player.pack[item] -= 1;
  world.player.wear[meta.slot] = item;
  completeObjective(world, "dress");
  if (meta.slot === "main") return `You take the ${meta.label.toLowerCase()}.`;
  if (meta.slot === "off") return `You raise the ${meta.label.toLowerCase()}.`;
  return `You wear the ${meta.label.toLowerCase()}.`;
}

export function commandEquipRare(world: World, uid: string) {
  const dead = hands(world);
  if (dead) return dead;
  const rare = world.player.rares.find((r) => r.uid === uid);
  if (!rare) return "No such wonder.";
  const meta = ITEM_META[rare.base];
  if (!meta.slot) return "You cannot hold or wear that.";
  const slot = meta.slot;
  const prevRare = world.player.wearRare[slot];
  if (prevRare === uid) return "Already worn.";
  world.player.wearRare[slot] = undefined;
  const prev = world.player.wear[slot];
  if (prev) {
    world.player.pack[prev] = (world.player.pack[prev] ?? 0) + 1;
    world.player.wear[slot] = undefined;
  }
  world.player.wearRare[slot] = uid;
  void prevRare; // swapped-out rares stay in player.rares — wearRare is only a link
  const name = rareName(rare);
  if (slot === "main") return `You take ${name}.`;
  if (slot === "off") return `You raise ${name}.`;
  return `You wear ${name}.`;
}

export function commandUnequip(world: World, slot: WearSlot) {
  const dead = hands(world);
  if (dead) return dead;
  const rareUidThere = world.player.wearRare[slot];
  if (rareUidThere) {
    world.player.wearRare[slot] = undefined;
    return slot === "main" || slot === "off" ? "You put it away." : "Off.";
  }
  const id = world.player.wear[slot];
  if (!id) return "Nothing there.";
  world.player.wear[slot] = undefined;
  world.player.pack[id] = (world.player.pack[id] ?? 0) + 1;
  return slot === "main" || slot === "off" ? "You put it away." : "Off.";
}

export function commandHeal(world: World) {
  const dead = hands(world);
  if (dead) return dead;
  const p = you(world);
  if (!p) return "You are not in the vale.";
  if ((world.player.pack.bandage ?? 0) < 1) return "Need a bandage.";
  world.player.pack.bandage -= 1;
  p.hp = Math.min(p.maxHp, p.hp + 8 + Math.floor(effSkill(world, "healing") / 10));
  tryGain(world, "healing", true, true);
  return "The cloth holds.";
}

export function commandCook(world: World) {
  const dead = hands(world);
  if (dead) return dead;
  const p = you(world);
  if (!p) return "You are not in the vale.";
  // A good meal first — cooked food fills far more than raw.
  const meals: [ItemId, number, string][] = [
    ["stew", 52, "The stew warms you through."],
    ["cooked_meat", 40, "Hot meat. Proper food."],
    ["bread", 32, "Fresh bread."],
    ["cabbage", 34, "The cabbage holds."],
    ["wheat", 22, "The wheat fills."],
    ["meat", 14, "You force the raw meat down."],
  ];
  for (const [id, fill, note] of meals) {
    if ((world.player.pack[id] ?? 0) > 0) {
      world.player.pack[id] -= 1;
      p.hunger = Math.min(100, p.hunger + fill);
      return note;
    }
  }
  return "Need meat, cabbage, or wheat.";
}

export function commandEat(world: World) {
  return commandCook(world);
}

function isAdjacent(ax: number, ay: number, bx: number, by: number) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by)) <= 1;
}

function chopNow(world: World, p: Person) {
  const { tx, ty } = world.player.intent;
  const t = world.tiles[ty]?.[tx];
  if (!t || t.kind !== "tree") {
    world.player.intent.kind = "none";
    return "No tree.";
  }
  const chance = successChance(effSkill(world, "lumberjack"), 12);
  const ok = Math.random() < chance;
  const gain = tryGain(world, "lumberjack", ok, true);
  if (!ok) return gain ? `The axe glances. ${gain}.` : "The axe glances.";
  t.kind = "dirt";
  world.scars[`${tx},${ty}`] = { kind: "dirt" };
  world.landRev += 1;
  world.player.pack.log = (world.player.pack.log ?? 0) + 1;
  completeObjective(world, "chop");
  world.player.intent.kind = "none";
  return gain ? `A log. ${gain}.` : "A log.";
}

function mineNow(world: World, p: Person) {
  const { tx, ty } = world.player.intent;
  const t = world.tiles[ty]?.[tx];
  if (!t || t.kind !== "rock") {
    world.player.intent.kind = "none";
    return "No stone.";
  }
  const chance = successChance(effSkill(world, "mining"), 14);
  const ok = Math.random() < chance;
  const gain = tryGain(world, "mining", ok, true);
  if (!ok) return gain ? `Dust. ${gain}.` : "Dust.";
  t.kind = "dirt";
  world.scars[`${tx},${ty}`] = { kind: "dirt" };
  world.landRev += 1;
  world.player.pack.ore = (world.player.pack.ore ?? 0) + 1;
  world.player.intent.kind = "none";
  return gain ? `Ore. ${gain}.` : "Ore.";
}

function huntNow(world: World, p: Person) {
  const c = world.fauna.find((x) => x.id === world.player.intent.targetId);
  if (!c || c.task === "dead") {
    world.player.intent.kind = "none";
    return "It fled.";
  }
  playSfx("hunt", 0.52);
  const blade = weaponDmg(effectiveMain(world));
  const mods = rareMods(world);
  const chance = successChance(world.player.skills.swords, 10 + FAUNA_META[c.kind].hp / 2);
  const ok = Math.random() < chance + 0.2 + mods.hit / 100;
  let dmg = ok ? blade + Math.floor(world.player.skills.swords / 12) : Math.max(1, Math.floor(blade / 3));
  dmg += mods.dmg;
  const slayerMul = mods.vs[c.kind];
  if (slayerMul) dmg = Math.floor(dmg * slayerMul);
  const arm = armorOf(world.player.wear) + mods.armor;
  c.hp -= dmg;
  if (RETALIATE_KINDS.has(c.kind)) p.hp = Math.max(0, p.hp - Math.max(1, FAUNA_META[c.kind].dmg - Math.floor(arm / 2)));
  tryGain(world, "swords", ok, true);
  tryGain(world, "anatomy", ok, true);
  if (c.hp <= 0) {
    c.hp = 0;
    c.task = "dead";
    c.path = [];
    c.corpseUntil = world.hour + 8;
    world.player.intent.kind = "none";
    completeObjective(world, "hunt");
    const found = rollKillRare(world, c.kind, Math.random);
    if (found) {
      world.player.rares.push(found);
      return `The ${FAUNA_META[c.kind].label.toLowerCase()} falls. Something glints in the kill — ${rareName(found)}!`;
    }
    return `The ${FAUNA_META[c.kind].label.toLowerCase()} falls.`;
  }
  return `You strike the ${FAUNA_META[c.kind].label.toLowerCase()}.`;
}

function tameNow(world: World, p: Person) {
  const c = world.fauna.find((x) => x.id === world.player.intent.targetId);
  if (!c || c.task === "dead") {
    world.player.intent.kind = "none";
    return "Gone.";
  }
  const diff = FAUNA_META[c.kind].tameDiff;
  const chance = successChance(effSkill(world, "taming"), diff);
  const ok = Math.random() < chance;
  tryGain(world, "taming", ok, chance > 0.3 && chance < 0.8);
  world.player.intent.kind = "none";
  if (!ok) {
    if (TAME_RETALIATE.has(c.kind)) p.hp = Math.max(0, p.hp - 4);
    c.task = "flee";
    return "It will not yield.";
  }
  c.ownerId = world.player.id;
  c.loyalty = 40;
  c.stay = false;
  c.task = "follow";
  c.warnedLoyal = false;
  const taken = new Set(world.fauna.filter((x) => x.ownerId === world.player.id && x.id !== c.id && x.name).map((x) => x.name!));
  c.name = pickPetName(mulberry32(world.seed + Math.floor(world.hour * 97) + c.id.length), taken);
  completeObjective(world, "tame");
  return `The ${FAUNA_META[c.kind].label.toLowerCase()} is yours. You name it ${c.name}.`;
}

function skinNow(world: World, p: Person) {
  const c = world.fauna.find((x) => x.id === world.player.intent.targetId);
  if (!c) {
    world.player.intent.kind = "none";
    return "Gone.";
  }
  const meta = FAUNA_META[c.kind];
  if (meta.hasCorpse === false) {
    world.fauna = world.fauna.filter((x) => x.id !== c.id);
    world.player.intent.kind = "none";
    return `You dress the ${FAUNA_META[c.kind].label.toLowerCase()}, but nothing sticks to the knife.`;
  }
  world.player.pack.hide = (world.player.pack.hide ?? 0) + (meta.hide ?? 1);
  world.player.pack.meat = (world.player.pack.meat ?? 0) + (meta.meat ?? 2);
  world.fauna = world.fauna.filter((x) => x.id !== c.id);
  completeObjective(world, "skin");
  world.player.intent.kind = "none";
  void p;
  return `You dress the ${FAUNA_META[c.kind].label.toLowerCase()}.`;
}

let swingAcc = 0;

export const WORK_BEAT = 0.72;
export const CAST_WINDUP = 0.92;

export type Chip = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  color: string;
};

let chips: Chip[] = [];

export function getChips() {
  return chips;
}

export function workPitch(workT: number) {
  const phase = (workT % WORK_BEAT) / WORK_BEAT;
  if (phase < 0.42) return 0.28 - (phase / 0.42) * 1.75;
  if (phase < 0.55) return -1.47 + ((phase - 0.42) / 0.13) * 2.75;
  return 1.28 * (1 - (phase - 0.55) / 0.45);
}

function burstChips(world: World, tx: number, ty: number, kind: "chop" | "mine") {
  const t = world.tiles[ty]?.[tx];
  const y = (t?.h ?? 0) * EH + (kind === "chop" ? 1.1 : 0.55);
  const color = kind === "chop" ? "#6a5438" : "#8a8680";
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    chips.push({
      x: tx + (Math.random() - 0.5) * 0.3,
      y,
      z: ty + (Math.random() - 0.5) * 0.3,
      vx: Math.cos(a) * (1.4 + Math.random()),
      vy: 1.6 + Math.random() * 1.8,
      vz: Math.sin(a) * (1.4 + Math.random()),
      age: 0,
      color,
    });
  }
}

function tickChips(dt: number) {
  for (const c of chips) {
    c.age += dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.z += c.vz * dt;
    c.vy -= 9 * dt;
  }
  chips = chips.filter((c) => c.age < 0.6 && c.y > -1);
}

export function tickPlayer(world: World, dt: number): string | null {
  const p = you(world);
  if (!p) return null;
  if (inGreybarrow(Math.round(p.x), Math.round(p.z))) completeObjective(world, "barrow");
  if (world.player.notoriety === "criminal" && world.hour > world.player.criminalUntil) world.player.notoriety = "innocent";
  if (p.hp <= 0 && !p.ghost && !world.player.ghost) return dieAsGhost(world, p);
  if (p.ghost || world.player.ghost) {
    p.ghost = true;
    world.player.ghost = true;
    p.hp = 0;
    return null;
  }
  tickMana(world, dt);
  tickChips(dt);
  const intent = world.player.intent;
  if (intent.kind === "none" || intent.kind === "walk") {
    world.player.workT = 0;
    return null;
  }
  if (intent.kind === "tame" || intent.kind === "hunt") {
    const c = world.fauna.find((x) => x.id === intent.targetId);
    if (c && Math.hypot(p.x - c.x, p.z - c.z) < 1.8) p.path = [];
  }
  if (intent.kind === "cast") {
    if (intent.spell === "magicarrow" || intent.spell === "fireball") {
      const c = world.fauna.find((x) => x.id === intent.targetId);
      const range = intent.spell === "fireball" ? FIREBALL_RANGE : ARROW_RANGE;
      if (c && Math.hypot(p.x - c.x, p.z - c.z) < range) p.path = [];
    } else p.path = [];
  }
  if (p.path.length) {
    world.player.workT = 0;
    return null;
  }
  if (intent.kind === "gate") {
    intent.kind = "none";
    return null;
  }
  if (intent.kind === "chop" || intent.kind === "mine" || intent.kind === "plant" || intent.kind === "harvest" || intent.kind === "till") {
    p.facing = Math.atan2(intent.tx - p.x, intent.ty - p.z);
    const prev = world.player.workT;
    world.player.workT += dt;
    const hit = prev % WORK_BEAT < 0.52 && world.player.workT % WORK_BEAT >= 0.52;
    if (!hit) return null;
    if (intent.kind === "till") {
      burstChips(world, intent.tx, intent.ty, "chop");
      return tillNow(world);
    }
    if (intent.kind === "plant") {
      burstChips(world, intent.tx, intent.ty, "chop");
      return plantNow(world);
    }
    if (intent.kind === "harvest") {
      burstChips(world, intent.tx, intent.ty, "chop");
      return harvestNow(world);
    }
    playSfx(intent.kind === "chop" ? "chop" : "mine", 0.55);
    burstChips(world, intent.tx, intent.ty, intent.kind);
    if (intent.kind === "chop") return chopNow(world, p);
    return mineNow(world, p);
  }
  if (intent.kind === "cast") {
    const c = world.fauna.find((x) => x.id === intent.targetId);
    if (c) p.facing = Math.atan2(c.x - p.x, c.z - p.z);
    else if (intent.tx || intent.ty) p.facing = Math.atan2(intent.tx - p.x, intent.ty - p.z);
    const prev = world.player.workT;
    world.player.workT += dt;
    if (prev === 0) playSfx("cast", 0.42);
    if (world.player.workT < CAST_WINDUP) return null;
    world.player.workT = 0;
    return castNow(world);
  }
  world.player.workT = 0;
  swingAcc += dt;
  if (swingAcc < 0.55) return null;
  swingAcc = 0;
  if (intent.kind === "hunt") return huntNow(world, p);
  if (intent.kind === "tame") return tameNow(world, p);
  if (intent.kind === "skin") return skinNow(world, p);
  if (intent.kind === "loot") {
    const err = takeFromPile(world, intent.targetId ?? "");
    intent.kind = "none";
    return err;
  }
  void isAdjacent;
  return null;
}
