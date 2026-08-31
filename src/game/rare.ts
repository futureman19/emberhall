import { hasTag, ITEM_META, SKILL_META } from "./catalog.ts";
import { RESOURCE_CATALOG } from "./resources/catalog.ts";
import { ITEM_FORM_CATALOG } from "./crafting/forms.ts";
import { resolveItemStats } from "./crafting/resolve.ts";
import { gemEffect } from "./gems.ts";
import type {
  CraftedComponent,
  GemInlay,
  ItemFormId,
  Workmanship,
} from "./crafting/types.ts";
import type { FaunaKind, ItemId, RareItem, SkillId, WearSlot, World } from "./types.ts";

/**
 * Rare attributes — pre-AOS UO magic items. A rare is a mundane base item
 * plus 1–2 affixes: prefixes before the name ("eminently accurate"),
 * suffixes after ("of power"). Affixes are ranked I–V; higher ranks are
 * rarer and come only from greater sources (wight hoards, a master's
 * hands). Sources: dangerous-creature drops and exceptional crafting —
 * UO's "a longsword of power, crafted by Sam" made flesh.
 */

export interface AffixDef {
  /** Display text — prefixes go before the base name, suffixes after. */
  label: string;
  slot: "pre" | "suf";
  /** Only one affix per group per item. */
  group: "accuracy" | "damage" | "slayer" | "protection" | "skill";
  /** What the base item must be. */
  applies: "weapon" | "armor" | "jewelry";
  rank: 1 | 2 | 3 | 4 | 5;
  hit?: number;
  dmg?: number;
  armor?: number;
  skill?: SkillId;
  skillAmt?: number;
  vsKind?: FaunaKind;
  vsMul?: number;
}

const acc = (label: string, rank: AffixDef["rank"], hit: number): [string, AffixDef] => [
  label,
  { label, slot: "pre", group: "accuracy", applies: "weapon", rank, hit },
];
const pow = (label: string, rank: AffixDef["rank"], dmg: number): [string, AffixDef] => [
  label,
  { label, slot: "suf", group: "damage", applies: "weapon", rank, dmg },
];
const ward = (label: string, rank: AffixDef["rank"], armor: number): [string, AffixDef] => [
  label,
  { label, slot: "suf", group: "protection", applies: "armor", rank, armor },
];
const charm = (label: string, skill: SkillId): [string, AffixDef] => [
  label,
  { label, slot: "suf", group: "skill", applies: "jewelry", rank: 3, skill, skillAmt: 5 },
];

export const AFFIXES: Record<string, AffixDef> = Object.fromEntries([
  acc("accurate", 1, 2),
  acc("surpassingly accurate", 2, 4),
  acc("eminently accurate", 3, 6),
  acc("exceedingly accurate", 4, 8),
  acc("supremely accurate", 5, 10),
  pow("of ruin", 1, 1),
  pow("of might", 2, 2),
  pow("of force", 3, 3),
  pow("of power", 4, 4),
  pow("of vanquishing", 5, 5),
  [
    "of wight-slaying",
    { label: "of wight-slaying", slot: "suf", group: "slayer", applies: "weapon", rank: 3, vsKind: "wight", vsMul: 1.5 },
  ],
  [
    "of wolf-slaying",
    { label: "of wolf-slaying", slot: "suf", group: "slayer", applies: "weapon", rank: 2, vsKind: "wolf", vsMul: 1.5 },
  ],
  [
    "of warg-slaying",
    { label: "of warg-slaying", slot: "suf", group: "slayer", applies: "weapon", rank: 3, vsKind: "ridgeback_warg", vsMul: 1.45 },
  ],
  [
    "of orc-slaying",
    { label: "of orc-slaying", slot: "suf", group: "slayer", applies: "weapon", rank: 4, vsKind: "orc_marauder", vsMul: 1.45 },
  ],
  [
    "of ogre-slaying",
    { label: "of ogre-slaying", slot: "suf", group: "slayer", applies: "weapon", rank: 4, vsKind: "stonefang_ogre", vsMul: 1.45 },
  ],
  [
    "of troll-slaying",
    { label: "of troll-slaying", slot: "suf", group: "slayer", applies: "weapon", rank: 4, vsKind: "brine_troll", vsMul: 1.45 },
  ],
  ward("of defense", 1, 1),
  ward("of guarding", 2, 2),
  ward("of hardening", 3, 3),
  ward("of fortification", 4, 4),
  ward("of invulnerability", 5, 5),
  charm("of the woodsman", "lumberjack"),
  charm("of the anvil", "smithing"),
  charm("of the deep", "mining"),
  charm("of the wild", "taming"),
  charm("of the owl", "magery"),
  charm("of mending", "healing"),
]);

/** What a base item can bear — weapons take accuracy/damage/slayers, armor takes wards, jewelry takes charms. */
export function rareClassOf(base: ItemId): "weapon" | "armor" | "jewelry" | null {
  if (hasTag(base, "weapon") || hasTag(base, "blade")) return "weapon";
  if (hasTag(base, "armor")) return "armor";
  if (base === "pendant" || base === "ring" || base === "relic") return "jewelry";
  return null;
}

export function affixesFor(base: ItemId, maxRank: number): AffixDef[] {
  const cls = rareClassOf(base);
  if (!cls) return [];
  return Object.values(AFFIXES).filter((a) => a.applies === cls && a.rank <= maxRank);
}

export interface RollOpts {
  maxRank: number;
  affixes?: number;
  maker?: string;
}

let uidSeq = 0;
export function rareUid(seed: number, hour: number): string {
  uidSeq = (uidSeq + 1) % 0xffff;
  return `r${seed.toString(36)}-${Math.floor(hour).toString(36)}-${uidSeq.toString(36)}-${Math.floor(Math.random() * 0xffff).toString(36)}`;
}

/**
 * Roll a rare for a base item. rng injected for tests. Higher ranks are
 * exponentially scarcer; at most one affix per group (accuracy + damage +
 * slayer can coexist — "a supremely accurate silver sword of vanquishing").
 */
export function rollRare(base: ItemId, rng: () => number, opts: RollOpts): RareItem | null {
  const pool = affixesFor(base, opts.maxRank);
  if (pool.length === 0) return null;
  const want = Math.max(1, Math.min(opts.affixes ?? 1, 3));
  const taken = new Set<string>();
  const chosen: AffixDef[] = [];
  for (let i = 0; i < want; i++) {
    const open = pool.filter((a) => !taken.has(a.group));
    if (open.length === 0) break;
    const weights = open.map((a) => 1 / 2 ** (a.rank - 1));
    const total = weights.reduce((s, w) => s + w, 0);
    let roll = rng() * total;
    let pick = open[open.length - 1]!;
    for (let j = 0; j < open.length; j++) {
      roll -= weights[j]!;
      if (roll <= 0) {
        pick = open[j]!;
        break;
      }
    }
    taken.add(pick.group);
    chosen.push(pick);
  }
  if (chosen.length === 0) return null;
  return {
    uid: rareUid(0, 0),
    base,
    affixes: chosen.map((a) => a.label),
    maker: opts.maker,
    seed: 0,
    hour: 0,
  };
}

/** Stamp a rolled rare with its provenance. */
export function bornRare(rare: RareItem, world: World, maker?: string): RareItem {
  rare.uid = rareUid(world.seed, world.hour);
  rare.seed = world.seed;
  rare.hour = Math.floor(world.hour);
  if (maker) rare.maker = maker;
  return rare;
}

/** A separate physical-quality roll for exact crafting; it never chooses magic. */
export function workmanshipChances(skill: number, difficulty: number): Readonly<Record<Workmanship, number>> {
  if (!Number.isFinite(skill) || !Number.isFinite(difficulty)) throw new Error("craft skill and difficulty must be finite");
  const margin = skill - difficulty;
  if (margin < 25) return Object.freeze({ ordinary: 1, fine: 0, exceptional: 0 });
  const exceptional = margin >= 60 ? Math.min(0.2, margin / 500) : 0;
  const fineThreshold = Math.min(0.45, margin / 250);
  return Object.freeze({
    ordinary: 1 - fineThreshold,
    fine: Math.max(0, fineThreshold - exceptional),
    exceptional,
  });
}

export function workmanshipForCraft(skill: number, difficulty: number, roll: number): Workmanship {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new Error("workmanship roll must be within 0..<1");
  const chances = workmanshipChances(skill, difficulty);
  if (roll < chances.exceptional) return "exceptional";
  return roll < chances.exceptional + chances.fine ? "fine" : "ordinary";
}

export interface CraftedItemInput {
  readonly formId: ItemFormId;
  readonly base: ItemId;
  readonly workmanship: Workmanship;
  readonly components: readonly CraftedComponent[];
  readonly inlays: readonly GemInlay[];
  readonly maker: string;
  readonly recipeId: string;
  readonly recipeVersion: number;
}

/** Fine/exceptional legacy work uses the same singular path without magic. */
export function createWorkmanshipItem(
  world: World,
  base: ItemId,
  workmanship: Exclude<Workmanship, "ordinary">,
  maker: string,
  recipeId: string,
): RareItem | null {
  const itemClass = rareClassOf(base);
  if (!itemClass) return null;
  const exceptional = workmanship === "exceptional";
  const weapon = itemClass === "weapon";
  const armor = itemClass === "armor";
  return {
    uid: rareUid(world.seed, world.hour),
    base,
    affixes: [],
    maker,
    seed: world.seed,
    hour: Math.floor(world.hour),
    workmanship,
    inlays: [],
    resolvedStats: {
      damage: weapon ? weaponDmg(base) + (exceptional ? 1 : 0) : 0,
      hitBonus: weapon ? (exceptional ? 2 : 1) : 0,
      armor: ITEM_META[base].armor + (armor && exceptional ? 1 : 0),
      skillBonuses: {},
      slayerMultipliers: {},
    },
    recipeId,
    recipeVersion: 1,
    source: "crafted",
  };
}

/** Material/workmanship identity stored on the existing singular-item path. */
export function createCraftedItem(world: World, input: CraftedItemInput): RareItem {
  const form = ITEM_FORM_CATALOG[input.formId];
  if (!form || input.base !== form.baseItem) throw new Error("crafted item base must match its canonical form");
  if (input.recipeId !== form.id || input.recipeVersion !== form.recipeVersion) {
    throw new Error("crafted item recipe identity must match its canonical form version");
  }
  if (typeof input.maker !== "string" || input.maker.trim().length === 0) throw new Error("crafted item maker is required");
  if (!Number.isSafeInteger(input.recipeVersion) || input.recipeVersion <= 0) {
    throw new Error("crafted item recipe version must be a positive safe integer");
  }
  const resolution = resolveItemStats(form, {
    workmanship: input.workmanship,
    components: input.components,
    inlays: input.inlays,
  });
  return {
    uid: rareUid(world.seed, world.hour),
    base: input.base,
    affixes: [],
    maker: input.maker,
    seed: world.seed,
    hour: Math.floor(world.hour),
    formId: input.formId,
    workmanship: input.workmanship,
    components: structuredClone([...input.components]),
    inlays: structuredClone([...input.inlays]),
    resolvedStats: structuredClone(resolution.stats),
    recipeId: input.recipeId,
    recipeVersion: input.recipeVersion,
    source: "crafted",
  };
}

/** "an eminently accurate sword of power" / "a ring of the owl". */
export function rareName(rare: RareItem): string {
  const body = rare.components?.find(({ role }) => role === "body");
  const material = body ? RESOURCE_CATALOG[body.resourceId].label.toLowerCase() : null;
  const quality = rare.workmanship && rare.workmanship !== "ordinary" ? `${rare.workmanship} ` : "";
  const base = `${quality}${material ? `${material} ` : ""}${ITEM_META[rare.base].label.toLowerCase()}`;
  const pre = rare.affixes.filter((a) => AFFIXES[a]?.slot === "pre");
  const suf = rare.affixes.filter((a) => AFFIXES[a]?.slot === "suf");
  const head = [...pre, base].join(" ");
  const gems = (rare.inlays ?? []).map(({ resourceId, clarity }) => `of ${gemEffect(resourceId, clarity).label}`);
  const suffixes = [...suf, ...gems];
  const name = suffixes.length > 0 ? `${head} ${suffixes.join(" ")}` : head;
  const article = /^[aeiou]/.test(name) ? "an" : "a";
  return `${article} ${name}`;
}

/** The rares a player currently has equipped, slot by slot. */
export function equippedRares(world: World): { slot: WearSlot; rare: RareItem }[] {
  const out: { slot: WearSlot; rare: RareItem }[] = [];
  for (const [slot, uid] of Object.entries(world.player.wearRare)) {
    if (!uid) continue;
    const rare = world.player.rares.find((r) => r.uid === uid);
    if (rare) out.push({ slot: slot as WearSlot, rare });
  }
  return out;
}

export interface RareMods {
  hit: number;
  dmg: number;
  armor: number;
  skills: Partial<Record<SkillId, number>>;
  vs: Partial<Record<FaunaKind, number>>;
}

/** Aggregate the magical effects of everything equipped. */
export function rareMods(world: World): RareMods {
  const mods: RareMods = { hit: 0, dmg: 0, armor: 0, skills: {}, vs: {} };
  for (const { slot, rare } of equippedRares(world)) {
    if (rare.resolvedStats) {
      if (slot === "main") {
        mods.hit += rare.resolvedStats.hitBonus;
        mods.dmg += rare.resolvedStats.damage - weaponDmg(rare.base);
      }
      mods.armor += rare.resolvedStats.armor;
      for (const [skill, amount] of Object.entries(rare.resolvedStats.skillBonuses)) {
        if (amount !== undefined) mods.skills[skill as SkillId] = (mods.skills[skill as SkillId] ?? 0) + amount;
      }
      for (const [kind, multiplier] of Object.entries(rare.resolvedStats.slayerMultipliers)) {
        if (multiplier !== undefined) mods.vs[kind as FaunaKind] = Math.max(mods.vs[kind as FaunaKind] ?? 1, multiplier);
      }
    } else if (rareClassOf(rare.base) === "armor") {
      mods.armor += ITEM_META[rare.base].armor;
    }
    for (const id of rare.affixes) {
      const a = AFFIXES[id];
      if (!a) continue;
      // Weapon effects only count from the main hand; wards/charms count anywhere worn.
      if ((a.group === "accuracy" || a.group === "damage" || a.group === "slayer") && slot !== "main") continue;
      if (a.hit) mods.hit += a.hit;
      if (a.dmg) mods.dmg += a.dmg;
      if (a.armor) mods.armor += a.armor;
      if (a.skill && a.skillAmt) mods.skills[a.skill] = (mods.skills[a.skill] ?? 0) + a.skillAmt;
      if (a.vsKind && a.vsMul) mods.vs[a.vsKind] = Math.max(mods.vs[a.vsKind] ?? 1, a.vsMul);
    }
  }
  return mods;
}

/** The effective main-hand item id — a rare's base when a rare is held. */
export function effectiveMain(world: World): ItemId | null {
  const uid = world.player.wearRare.main;
  if (uid) {
    const rare = world.player.rares.find((r) => r.uid === uid);
    if (rare) return rare.base;
  }
  return world.player.wear.main ?? null;
}

/** Base weapon damage — the hunt table, extracted so rares inherit their base's bite. */
export function weaponDmg(id: ItemId | null): number {
  if (id === "sword") return 10;
  if (id === "mace") return 9;
  if (id === "bow") return 8;
  if (id === "club") return 7;
  if (id === "hatchet") return 6;
  if (id === "staff") return 5;
  if (id === "knife") return 4;
  return 2;
}

/** One human line for an affix's effect — tooltips spell the magic out. */
export function describeAffix(label: string): string {
  const a = AFFIXES[label];
  if (!a) return label;
  if (a.hit) return `+${a.hit}% to hit`;
  if (a.dmg) return `+${a.dmg} damage`;
  if (a.armor) return `+${a.armor} armor`;
  if (a.skill && a.skillAmt) return `+${a.skillAmt} ${SKILL_META[a.skill].label}`;
  if (a.vsKind && a.vsMul) return `half again the bite against ${a.vsKind}s`;
  return a.label;
}

/** Weighted loot table for creature drops — steel common, jewelry precious. */
export const LOOT_BASES: { id: ItemId; w: number }[] = [
  { id: "sword", w: 10 },
  { id: "mace", w: 8 },
  { id: "club", w: 8 },
  { id: "bow", w: 6 },
  { id: "knife", w: 8 },
  { id: "hatchet", w: 6 },
  { id: "shield", w: 6 },
  { id: "heater", w: 4 },
  { id: "cuirass", w: 5 },
  { id: "mail", w: 4 },
  { id: "helm", w: 4 },
  { id: "pendant", w: 3 },
  { id: "ring", w: 3 },
];

export function rollLootBase(rng: () => number): ItemId {
  const total = LOOT_BASES.reduce((s, e) => s + e.w, 0);
  let roll = rng() * total;
  for (const e of LOOT_BASES) {
    roll -= e.w;
    if (roll <= 0) return e.id;
  }
  return "club";
}

/**
 * A kill yields a rare? Wights hoard rank III relics a quarter of the
 * time; wolves drag rank II prizes from old camps one time in twelve.
 */
export function rollKillRare(world: World, kind: FaunaKind, rng: () => number): RareItem | null {
  const cfg =
    kind === "wight" ? { chance: 0.25, maxRank: 3, two: 0.2 } :
    kind === "wolf" ? { chance: 1 / 12, maxRank: 2, two: 0 } :
    kind === "ridgeback_warg" || kind === "barrow_hound" ? { chance: 0.14, maxRank: 2, two: 0.1 } :
    kind === "brine_troll" || kind === "stonefang_ogre" || kind === "orc_marauder" ? { chance: 1 / 9, maxRank: 4, two: 0.25 } :
    null;
  if (!cfg || rng() >= cfg.chance) return null;
  const base = rollLootBase(rng);
  const rare = rollRare(base, rng, { maxRank: cfg.maxRank, affixes: cfg.two > 0 && rng() < cfg.two ? 2 : 1 });
  return rare ? bornRare(rare, world) : null;
}

/**
 * Exceptional crafting — UO's maker's mark. A crafter working well above
 * the difficulty can produce a piece beyond the ordinary: one affix (two
 * for a grandmaster's rare touch), rank scaling with skill.
 */
export function exceptionalRank(skill: number): number {
  if (skill >= 100) return 5;
  if (skill >= 90) return 4;
  if (skill >= 70) return 3;
  if (skill >= 50) return 2;
  return 1;
}

export function rollExceptional(world: World, base: ItemId, skill: number, diff: number, maker: string, rng: () => number): RareItem | null {
  if (!rareClassOf(base)) return null;
  const chance = Math.min(0.3, 0.05 + Math.max(0, skill - diff) / 300);
  if (rng() >= chance) return null;
  const two = skill >= 100 && rng() < 0.15 ? 2 : 1;
  const rare = rollRare(base, rng, { maxRank: exceptionalRank(skill), affixes: two, maker });
  return rare ? bornRare(rare, world, maker) : null;
}

/** The keeper's quote, line by line — an appraisal you can argue with. */
export interface Appraisal {
  total: number;
  lines: { label: string; gold: number }[];
}

/**
 * What a shopkeeper will pay for a wonder, itemized: the base's trade
 * price, each affix by its rank and bite, and a little extra for a
 * maker's mark. Never less than five gold — sentiment has a floor.
 */
export function appraiseRare(rare: RareItem): Appraisal {
  const lines: Appraisal["lines"] = [];
  const baseGold = Math.max(2, ITEM_META[rare.base].sell);
  lines.push({ label: ITEM_META[rare.base].label, gold: baseGold });
  let total = baseGold;
  for (const a of rare.affixes) {
    const def = AFFIXES[a];
    if (!def) continue;
    const gold =
      def.rank * 6 +
      (def.dmg ?? 0) * 4 +
      (def.armor ?? 0) * 4 +
      (def.hit ?? 0) +
      (def.skillAmt ?? 0) * 2 +
      (def.vsKind ? 10 : 0);
    lines.push({ label: def.label, gold });
    total += gold;
  }
  if (rare.workmanship && rare.workmanship !== "ordinary") {
    const gold = rare.workmanship === "exceptional" ? 14 : 6;
    lines.push({ label: `${rare.workmanship} workmanship`, gold });
    total += gold;
  }
  const gradeOrder = ["rough", "sound", "choice", "pristine"] as const;
  for (const component of rare.components ?? []) {
    const definition = RESOURCE_CATALOG[component.resourceId];
    const specialty = definition.traitIds.length > 0 ? 4 : 0;
    const gold = Math.max(1, (gradeOrder.indexOf(component.grade) + 1) * component.amount + specialty);
    lines.push({ label: `${definition.label} ${component.role}`, gold });
    total += gold;
  }
  for (const inlay of rare.inlays ?? []) {
    const effect = gemEffect(inlay.resourceId, inlay.clarity);
    if (effect.family === "fortune") continue;
    const gold = effect.rank * 8;
    lines.push({ label: effect.label, gold });
    total += gold;
  }
  if (rare.maker) {
    lines.push({ label: `a maker's mark — ${rare.maker}`, gold: 8 });
    total += 8;
  }
  return { total: Math.max(5, total), lines };
}
