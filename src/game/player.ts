import { EH, inGreybarrow } from "./atlas.ts";
import { FAUNA_META, hasTag, ITEM_META, armorOf, tagConsumeOrder } from "./catalog.ts";
import { harvestNow, plantNow, tillNow } from "./farm.ts";
import { GHOSTWOOD_LUMBERJACK } from "./resources/catalog.ts";
import { isGhostwoodTree, isTimberId, plantTreeNow } from "./forestry.ts";
import { ARROW_RANGE, FIREBALL_RANGE, burstDeath, castNow, maxMana, tickMana } from "./magery.ts";
import { pickPetName } from "./names.ts";
import { petLabel } from "./pets.ts";
import { astar, astarToRange, nearestWalkable, tileOf } from "./pathfinding.ts";
import { addToPile, spawnCorpsePile, takeFromPile } from "./piles.ts";
import { mulberry32 } from "./rng.ts";
import { successChance, tryGain } from "./skills.ts";
import { addResource, parseResourceInventory } from "./inventory/resources.ts";
import { COMBAT_BEAT } from "./combat-animation.ts";
import { assessPlantedTimberHarvest, assessResourceHarvest, harvestToolTier, type HarvestAssessment } from "./resources/harvest.ts";
import { depleteResourceNode, discoverResourceNode, hasDiscoveredResourceNode } from "./resources/state.ts";
import { playSfx } from "./vale-sfx.ts";
import { emitCorpseFx } from "./corpse-animation.ts";
import { emitExtractionFx, EXTRACTION_BEAT, EXTRACTION_IMPACT } from "./extraction-animation.ts";
import { emitCompanionFx } from "./companion-animation.ts";
import { emitPersonalActionFx } from "./personal-action-animation.ts";
import { completeObjective, log } from "./world.ts";
import { effectiveMain, rareMods, rareName, rollKillRare, weaponDmg } from "./rare.ts";
import type { ItemId, Person, ResourceInventory, ResourceNodeStateMap, SkillId, WearSlot, World } from "./types.ts";

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
  "cabbage", "wheat", "cabbage_seed", "wheat_seed", "garlic_seed", "acorn",
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

function pathWithin(world: World, p: Person, tx: number, ty: number, range: number, cap = 9000) {
  const from = tileOf(p.x, p.z);
  const path = astarToRange(world, from.tx, from.ty, tx, ty, range, cap);
  if (!path) return false;
  p.path = path.map((n) => ({ tx: n.x, ty: n.y }));
  return true;
}

function pathBeside(world: World, p: Person, tx: number, ty: number) {
  return pathWithin(world, p, tx, ty, 1.5);
}

/** Rebuild the player's active route after terrain invalidates a waypoint. */
export function replanIntentPath(world: World, p: Person) {
  const intent = world.player.intent;
  if (intent.kind === "none") return false;
  if (intent.kind === "walk") {
    const from = tileOf(p.x, p.z);
    const path = astar(world, from.tx, from.ty, intent.tx, intent.ty);
    if (!path) return false;
    p.path = path.map((node) => ({ tx: node.x, ty: node.y }));
    return true;
  }
  if (intent.kind === "hunt" || intent.kind === "tame") {
    const creature = world.fauna.find((candidate) => candidate.id === intent.targetId && candidate.task !== "dead");
    if (!creature) return false;
    const bow = intent.kind === "hunt" && effectiveMain(world) === "bow";
    return pathWithin(world, p, creature.x, creature.z, bow ? BOW_RANGE - 0.75 : 1.5, 2500);
  }
  if (intent.kind === "cast" && (intent.spell === "magicarrow" || intent.spell === "fireball")) {
    const creature = world.fauna.find((candidate) => candidate.id === intent.targetId && candidate.task !== "dead");
    if (!creature) return false;
    const range = intent.spell === "fireball" ? FIREBALL_RANGE : ARROW_RANGE;
    return pathWithin(world, p, creature.x, creature.z, range - 0.75, 2500);
  }
  return pathBeside(world, p, intent.tx, intent.ty);
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
  if (isGhost(world)) {
    if (effSkill(world, "lumberjack") < GHOSTWOOD_LUMBERJACK) return "A ghost cannot.";
    if (!isGhostwoodTree(world, tx, ty)) return "The axe passes through.";
  } else {
    const dead = hands(world);
    if (dead) return dead;
    if (isGhostwoodTree(world, tx, ty)) return "You see no tree.";
  }
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
  pathWithin(world, p, c.x, c.z, effectiveMain(world) === "bow" ? BOW_RANGE - 0.75 : 1.5);
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
  pathWithin(world, p, c.x, c.z, 1.5);
  return null;
}

export function commandStay(world: World, id: string) {
  const c = world.fauna.find((x) => x.id === id);
  if (!c || c.ownerId !== world.player.id) return "It is not yours.";
  c.stay = true;
  c.task = "idle";
  c.path = [];
  emitCompanionFx(world, { kind: "stay", targetId: c.id, x: c.x, z: c.z });
  const note = `${petLabel(c)} stays.`;
  log(world, note);
  return note;
}

export function commandFollow(world: World, id: string) {
  const c = world.fauna.find((x) => x.id === id);
  if (!c || c.ownerId !== world.player.id) return "It is not yours.";
  c.stay = false;
  c.task = "follow";
  emitCompanionFx(world, { kind: "follow", targetId: c.id, x: c.x, z: c.z });
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
  emitCompanionFx(world, { kind: "release", targetId: c.id, x: c.x, z: c.z });
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
  emitCompanionFx(world, { kind: "feed", targetId: c.id, x: c.x, z: c.z, item: give });
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

function resolveLootTarget(world: World, id: string): string | null {
  const byId = world.piles.find((p) => p.id === id);
  if (byId) return byId.id;
  const corpse = world.fauna.find((x) => x.id === id && x.task === "dead");
  if (!corpse) return null;
  const tx = Math.round(corpse.x);
  const ty = Math.round(corpse.z);
  const nearby = world.piles.filter((p) => p.tx === tx && p.ty === ty);
  if (nearby.length === 0) return null;
  const corpsePile = nearby.find((p) => p.source === "corpse" || p.source === "death");
  return (corpsePile ?? nearby[0]).id;
}

export function commandLoot(world: World, id: string) {
  const dead = hands(world);
  if (dead) return dead;
  const pileId = resolveLootTarget(world, id);
  if (!pileId) return "Nothing to loot.";
  return takeFromPile(world, pileId);
}

export function commandDrop(world: World, item: ItemId) {
  const dead = hands(world);
  if (dead) return dead;
  const p = you(world);
  const n = world.player.pack[item] ?? 0;
  if (!p || n < 1) return "You do not carry that.";
  world.player.pack[item] = n - 1;
  const pile = addToPile(world, Math.round(p.x), Math.round(p.z), { [item]: 1 }, "drop", world.hour + 24, "sack");
  completeObjective(world, "pile");
  emitPersonalActionFx(world, { kind: "ground", direction: "drop", item, count: 1, gold: 0, x: pile.tx, z: pile.ty });
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
  const p = you(world);
  if (prev !== item || Boolean(rareUidThere)) emitPersonalActionFx(world, { kind: "equipment", direction: "equip", item, slot: meta.slot, rare: false, uid: null, x: p?.x ?? null, z: p?.z ?? null });
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
  const p = you(world);
  emitPersonalActionFx(world, { kind: "equipment", direction: "equip", item: rare.base, slot, rare: true, uid, x: p?.x ?? null, z: p?.z ?? null });
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
    const rare = world.player.rares.find((candidate) => candidate.uid === rareUidThere);
    world.player.wearRare[slot] = undefined;
    const p = you(world);
    emitPersonalActionFx(world, { kind: "equipment", direction: "unequip", item: rare?.base ?? null, slot, rare: true, uid: rareUidThere, x: p?.x ?? null, z: p?.z ?? null });
    return slot === "main" || slot === "off" ? "You put it away." : "Off.";
  }
  const id = world.player.wear[slot];
  if (!id) return "Nothing there.";
  world.player.wear[slot] = undefined;
  world.player.pack[id] = (world.player.pack[id] ?? 0) + 1;
  const p = you(world);
  emitPersonalActionFx(world, { kind: "equipment", direction: "unequip", item: id, slot, rare: false, uid: null, x: p?.x ?? null, z: p?.z ?? null });
  return slot === "main" || slot === "off" ? "You put it away." : "Off.";
}

export interface HealingFx {
  x: number;
  z: number;
  at: number;
  amount: number;
}

let healingFx: HealingFx | null = null;

export function getHealingFx() {
  return healingFx;
}

export function commandHeal(world: World) {
  const dead = hands(world);
  if (dead) return dead;
  const p = you(world);
  if (!p) return "You are not in the vale.";
  if ((world.player.pack.bandage ?? 0) < 1) return "Need a bandage.";
  world.player.pack.bandage -= 1;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + 8 + Math.floor(effSkill(world, "healing") / 10));
  healingFx = { x: p.x, z: p.z, at: world.hour, amount: p.hp - before };
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
      const before = p.hunger;
      world.player.pack[id] -= 1;
      p.hunger = Math.min(100, p.hunger + fill);
      emitPersonalActionFx(world, { kind: "eat", item: id, fill: p.hunger - before, x: p.x, z: p.z });
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

interface PreparedResourceHarvest {
  readonly assessment: HarvestAssessment | null;
  readonly resourcesAfterSuccess: ResourceInventory;
  readonly resourceNodesAfterIdentification: ResourceNodeStateMap;
  readonly resourceNodesAfterSuccess: ResourceNodeStateMap;
}

function prepareResourceHarvest(world: World, nodeKind: "tree" | "rock"): PreparedResourceHarvest {
  const resourcesAfterSuccess = parseResourceInventory(world.player.resources);
  const { tx, ty } = world.player.intent;
  const t = world.tiles[ty]?.[tx];
  if (!t || t.kind !== nodeKind) {
    return {
      assessment: null,
      resourcesAfterSuccess,
      resourceNodesAfterIdentification: world.resourceNodes,
      resourceNodesAfterSuccess: world.resourceNodes,
    };
  }
  const skill = nodeKind === "tree" ? "lumberjack" : "mining";
  const discovered = hasDiscoveredResourceNode({
    seed: world.seed,
    tx,
    ty,
    nodeKind,
    resourceNodes: world.resourceNodes,
  });
  const planted = nodeKind === "tree" ? world.plantedTimber?.[`${tx},${ty}`] : undefined;
  const harvestInput = {
    seed: world.seed,
    tx,
    ty,
    nodeKind,
    effectiveSkill: effSkill(world, skill),
    discovered,
    toolTier: harvestToolTier({ nodeKind, tool: inHand(world) }),
  };
  const assessment =
    planted && isTimberId(planted)
      ? assessPlantedTimberHarvest({ ...harvestInput, resourceId: planted })
      : assessResourceHarvest(harvestInput);
  const resourceNodesAfterIdentification =
    assessment.status === "unknown"
      ? world.resourceNodes
      : discoverResourceNode({
          seed: world.seed,
          tx,
          ty,
          nodeKind,
          hour: world.hour,
          resourceNodes: world.resourceNodes,
        });
  let resourceNodesAfterSuccess = resourceNodesAfterIdentification;
  if (assessment.status === "ready") {
    addResource(resourcesAfterSuccess, assessment.yield.key, assessment.yield.quantity);
    resourceNodesAfterSuccess = depleteResourceNode({
      seed: world.seed,
      tx,
      ty,
      nodeKind,
      hour: world.hour,
      resourceNodes: resourceNodesAfterIdentification,
    });
  }
  return {
    assessment,
    resourcesAfterSuccess,
    resourceNodesAfterIdentification,
    resourceNodesAfterSuccess,
  };
}

function resourceHarvestNow(world: World, nodeKind: "tree" | "rock", prepared: PreparedResourceHarvest) {
  const { tx, ty } = world.player.intent;
  const t = world.tiles[ty]?.[tx];
  if (!t || t.kind !== nodeKind) {
    world.player.intent.kind = "none";
    return nodeKind === "tree" ? "No tree." : "No stone.";
  }

  const skill = nodeKind === "tree" ? "lumberjack" : "mining";
  const effectiveSkill = effSkill(world, skill);
  const {
    assessment,
    resourcesAfterSuccess,
    resourceNodesAfterIdentification,
    resourceNodesAfterSuccess,
  } = prepared;
  if (!assessment) throw new Error("prepared harvest target changed before commit");
  if (assessment.status !== "ready") {
    // Permanent gates stop this work order once, instead of journaling the
    // same rejection every beat. Identification persists independently; scar,
    // inventory, depletion, and revision remain untouched, with no chance roll.
    world.resourceNodes = resourceNodesAfterIdentification;
    world.player.intent.kind = "none";
    return assessment.message;
  }

  playSfx(nodeKind === "tree" ? "chop" : "mine", 0.55);
  burstChips(world, tx, ty, nodeKind === "tree" ? "chop" : "mine");
  const chance = successChance(effectiveSkill, nodeKind === "tree" ? 12 : 14);
  const ok = Math.random() < chance;
  emitExtractionFx(world, nodeKind === "tree" ? "lumberjacking" : "mining", ok, tx, ty);
  if (!ok) {
    world.resourceNodes = resourceNodesAfterIdentification;
    const gain = tryGain(world, skill, false, true);
    const failure = nodeKind === "tree" ? "The axe glances." : "Dust.";
    return gain ? `${failure.slice(0, -1)}. ${gain}.` : failure;
  }

  world.player.resources = resourcesAfterSuccess;
  world.resourceNodes = resourceNodesAfterSuccess;
  t.kind = "dirt";
  world.scars[`${tx},${ty}`] = { kind: "dirt" };
  world.landRev += 1;
  if (nodeKind === "tree") {
    completeObjective(world, "chop");
    if (Math.random() < 0.28) world.player.pack.acorn = (world.player.pack.acorn ?? 0) + 1;
  }
  world.player.intent.kind = "none";
  const gain = tryGain(world, skill, true, true);
  return gain ? `${assessment.message} ${gain}.` : assessment.message;
}

function chopNow(world: World, prepared: PreparedResourceHarvest) {
  return resourceHarvestNow(world, "tree", prepared);
}

function mineNow(world: World, prepared: PreparedResourceHarvest) {
  return resourceHarvestNow(world, "rock", prepared);
}

function huntNow(world: World, p: Person) {
  const c = world.fauna.find((x) => x.id === world.player.intent.targetId);
  if (!c || c.task === "dead") {
    world.player.intent.kind = "none";
    return "It fled.";
  }
  const bow = effectiveMain(world) === "bow";
  const dist = Math.hypot(p.x - c.x, p.z - c.z);
  playSfx("hunt", 0.52);
  const blade = weaponDmg(effectiveMain(world));
  const mods = rareMods(world);
  const skill = bow ? world.player.skills.archery : world.player.skills.swords;
  const chance = successChance(skill, 10 + FAUNA_META[c.kind].hp / 2);
  const ok = Math.random() < chance + 0.2 + mods.hit / 100;
  combatFx = {
    kind: bow ? "arrow" : "melee",
    x: p.x,
    z: p.z,
    tx: c.x,
    tz: c.z,
    targetId: c.id,
    clean: ok,
    at: world.hour,
  };
  let dmg = ok ? blade + Math.floor(skill / 12) : Math.max(1, Math.floor(blade / 3));
  dmg += mods.dmg;
  const slayerMul = mods.vs[c.kind];
  if (slayerMul) dmg = Math.floor(dmg * slayerMul);
  const arm = armorOf(world.player.wear) + mods.armor;
  c.hp -= dmg;
  // Teeth only answer when they can reach you — an arrow from afar draws none.
  if (RETALIATE_KINDS.has(c.kind) && (!bow || dist < 1.8)) p.hp = Math.max(0, p.hp - Math.max(1, FAUNA_META[c.kind].dmg - Math.floor(arm / 2)));
  if (bow) {
    p.facing = Math.atan2(c.x - p.x, c.z - p.z);
    tryGain(world, "archery", ok, true);
  } else {
    tryGain(world, "swords", ok, true);
    tryGain(world, "anatomy", ok, true);
  }
  if (c.hp <= 0) {
    c.hp = 0;
    c.task = "dead";
    c.path = [];
    c.corpseUntil = world.hour + 8;
    world.player.intent.kind = "none";
    completeObjective(world, "hunt");
    spawnCorpsePile(world, c);
    const found = rollKillRare(world, c.kind, Math.random);
    if (found) {
      world.player.rares.push(found);
      return `The ${FAUNA_META[c.kind].label.toLowerCase()} falls. Something glints in the kill — ${rareName(found)}!`;
    }
    return `The ${FAUNA_META[c.kind].label.toLowerCase()} falls.`;
  }
  if (bow) return ok ? `Your arrow finds the ${FAUNA_META[c.kind].label.toLowerCase()}.` : `Your arrow grazes the ${FAUNA_META[c.kind].label.toLowerCase()}.`;
  return `You strike the ${FAUNA_META[c.kind].label.toLowerCase()}.`;
}

export interface TamingFx {
  targetId: string;
  x: number;
  z: number;
  at: number;
  success: boolean;
}

let tamingFx: TamingFx | null = null;

export function getTamingFx() {
  return tamingFx;
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
  tamingFx = { targetId: c.id, x: c.x, z: c.z, at: world.hour, success: ok };
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
    emitCorpseFx(world, "skinning", c.id, c.x, c.z);
    world.fauna = world.fauna.filter((x) => x.id !== c.id);
    world.player.intent.kind = "none";
    return `You dress the ${FAUNA_META[c.kind].label.toLowerCase()}, but nothing sticks to the knife.`;
  }
  world.player.pack.hide = (world.player.pack.hide ?? 0) + (meta.hide ?? 1);
  world.player.pack.meat = (world.player.pack.meat ?? 0) + (meta.meat ?? 2);
  emitCorpseFx(world, "skinning", c.id, c.x, c.z);
  world.fauna = world.fauna.filter((x) => x.id !== c.id);
  completeObjective(world, "skin");
  world.player.intent.kind = "none";
  void p;
  return `You dress the ${FAUNA_META[c.kind].label.toLowerCase()}.`;
}

/** Arrow-shot for a hunting bow — shorter than a mage's reach, longer than a blade's. */
const BOW_RANGE = 10;
const targetReplans = new WeakMap<World, { tick: number; targetId: string | null }>();

export interface CombatFx {
  kind: "melee" | "arrow";
  x: number;
  z: number;
  tx: number;
  tz: number;
  targetId: string;
  clean: boolean;
  at: number;
}

let combatFx: CombatFx | null = null;

export function getCombatFx() {
  return combatFx;
}

export const WORK_BEAT = EXTRACTION_BEAT;
export const CAST_WINDUP = 0.92;

function workBeatLands(previous: number, next: number): boolean {
  return previous % WORK_BEAT < EXTRACTION_IMPACT && next % WORK_BEAT >= EXTRACTION_IMPACT;
}

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
  const intent = world.player.intent;
  // Only an impact frame validates and plans the complete typed-inventory
  // transaction. It still runs before facing, timers, effects, random, skills,
  // logs, intent, or world state, while animation-only frames remain O(1).
  const preparedHarvest =
    (intent.kind === "chop" || intent.kind === "mine")
      && p.path.length === 0
      && workBeatLands(world.player.workT, world.player.workT + dt)
      ? prepareResourceHarvest(world, intent.kind === "chop" ? "tree" : "rock")
      : null;
  if (inGreybarrow(Math.round(p.x), Math.round(p.z))) completeObjective(world, "barrow");
  if (world.player.notoriety === "criminal" && world.hour > world.player.criminalUntil) world.player.notoriety = "innocent";
  if (p.hp <= 0 && !p.ghost && !world.player.ghost) return dieAsGhost(world, p);
  if (p.ghost || world.player.ghost) {
    p.ghost = true;
    world.player.ghost = true;
    p.hp = 0;
    if (intent.kind !== "chop") return null;
  } else {
    tickMana(world, dt);
  }
  tickChips(dt);
  if (intent.kind === "none" || intent.kind === "walk") {
    world.player.workT = 0;
    return null;
  }
  if (intent.kind === "tame" || intent.kind === "hunt") {
    const c = world.fauna.find((x) => x.id === intent.targetId);
    if (!c || c.task === "dead") {
      const wasHunting = intent.kind === "hunt";
      intent.kind = "none";
      p.path = [];
      return wasHunting ? "It fled." : "Gone.";
    }
    // A bow stops at arrow-shot; anything else must close to arm's reach.
    const reach = intent.kind === "hunt" && effectiveMain(world) === "bow" ? BOW_RANGE : 1.8;
    const distance = Math.hypot(p.x - c.x, p.z - c.z);
    if (distance < reach) {
      p.path = [];
    } else {
      const targetTx = Math.round(c.x);
      const targetTy = Math.round(c.z);
      const targetMoved = targetTx !== intent.tx || targetTy !== intent.ty;
      const previousReplan = targetReplans.get(world);
      const canReplan =
        !previousReplan
        || previousReplan.targetId !== intent.targetId
        || world.tickCount - previousReplan.tick >= 6;
      // Moving and temporarily unreachable targets are both bounded to one
      // path search per six simulation ticks.
      if ((!p.path.length || targetMoved) && canReplan) {
        intent.tx = targetTx;
        intent.ty = targetTy;
        targetReplans.set(world, { tick: world.tickCount, targetId: intent.targetId });
        pathWithin(world, p, c.x, c.z, reach === BOW_RANGE ? BOW_RANGE - 0.75 : 1.5, 2500);
      }
      // A closed route must never turn into an out-of-range attack or tame.
      if (p.path.length || distance >= reach) {
        world.player.workT = 0;
        return null;
      }
    }
  }
  if (intent.kind === "cast") {
    if (intent.spell === "magicarrow" || intent.spell === "fireball") {
      const c = world.fauna.find((x) => x.id === intent.targetId);
      if (!c || c.task === "dead") {
        intent.kind = "none";
        p.path = [];
        return "The target is gone.";
      }
      const range = intent.spell === "fireball" ? FIREBALL_RANGE : ARROW_RANGE;
      const distance = Math.hypot(p.x - c.x, p.z - c.z);
      if (distance < range) {
        p.path = [];
      } else {
        const targetTx = Math.round(c.x);
        const targetTy = Math.round(c.z);
        const targetMoved = targetTx !== intent.tx || targetTy !== intent.ty;
        const previousReplan = targetReplans.get(world);
        const canReplan =
          !previousReplan
          || previousReplan.targetId !== intent.targetId
          || world.tickCount - previousReplan.tick >= 6;
        if ((!p.path.length || targetMoved) && canReplan) {
          intent.tx = targetTx;
          intent.ty = targetTy;
          targetReplans.set(world, { tick: world.tickCount, targetId: intent.targetId });
          pathWithin(world, p, c.x, c.z, range - 0.75, 2500);
        }
        if (p.path.length || distance >= range) {
          world.player.workT = 0;
          return null;
        }
      }
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
  if (intent.kind === "chop" || intent.kind === "mine" || intent.kind === "plant" || intent.kind === "harvest" || intent.kind === "till" || intent.kind === "forest") {
    p.facing = Math.atan2(intent.tx - p.x, intent.ty - p.z);
    const prev = world.player.workT;
    world.player.workT += dt;
    const hit = workBeatLands(prev, world.player.workT);
    if (!hit) return null;
    if (intent.kind === "till") {
      burstChips(world, intent.tx, intent.ty, "chop");
      return tillNow(world);
    }
    if (intent.kind === "plant") {
      burstChips(world, intent.tx, intent.ty, "chop");
      return plantNow(world);
    }
    if (intent.kind === "forest") {
      burstChips(world, intent.tx, intent.ty, "chop");
      return plantTreeNow(world);
    }
    if (intent.kind === "harvest") {
      burstChips(world, intent.tx, intent.ty, "chop");
      return harvestNow(world);
    }
    if (!preparedHarvest) throw new Error("harvest work reached commit without a validated inventory");
    if (intent.kind === "chop") return chopNow(world, preparedHarvest);
    return mineNow(world, preparedHarvest);
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
  world.player.workT += dt;
  if (world.player.workT < COMBAT_BEAT) return null;
  world.player.workT = 0;
  if (intent.kind === "hunt") return huntNow(world, p);
  if (intent.kind === "tame") return tameNow(world, p);
  if (intent.kind === "skin") return skinNow(world, p);
  if (intent.kind === "loot") {
    const err = commandLoot(world, intent.targetId ?? "");
    intent.kind = "none";
    return err;
  }
  void isAdjacent;
  return null;
}
