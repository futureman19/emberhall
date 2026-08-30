import type { BuildingKind, ClassId, FaunaKind, ItemId, NpcRole, Notoriety, ResourceTag, SkillId, WearSlot } from "./types.ts";

export const SECONDS_PER_HOUR = 36;

export function hourOfDay(hour: number) {
  return ((hour % 24) + 24) % 24;
}
export function isNight(hour: number) {
  const h = hourOfDay(hour);
  return h < 5 || h >= 20;
}
export function isDusk(hour: number) {
  const h = hourOfDay(hour);
  return (h >= 18 && h < 20) || (h >= 5 && h < 7);
}

export const SKILL_META: Record<SkillId, { label: string }> = {
  swords: { label: "Swordsmanship" },
  lumberjack: { label: "Lumberjacking" },
  mining: { label: "Mining" },
  anatomy: { label: "Anatomy" },
  healing: { label: "Healing" },
  cooking: { label: "Cooking" },
  smithing: { label: "Blacksmithing" },
  carpentry: { label: "Carpentry" },
  taming: { label: "Animal Taming" },
  magery: { label: "Magery" },
  farming: { label: "Farming" },
};

export const ITEM_META: Record<
  ItemId,
  { label: string; tool: boolean; slot: WearSlot | null; fill: string; armor: number; buy: number; sell: number; tags: ResourceTag[] }
> = {
  hatchet: { label: "Hatchet", tool: true, slot: "main", fill: "var(--color-muted)", armor: 0, buy: 12, sell: 4, tags: ["tool", "blade"] },
  knife: { label: "Skinning knife", tool: true, slot: "main", fill: "var(--color-muted)", armor: 0, buy: 8, sell: 3, tags: ["tool", "blade"] },
  pick: { label: "Pick", tool: true, slot: "main", fill: "var(--color-muted)", armor: 0, buy: 14, sell: 5, tags: ["tool"] },
  hoe: { label: "Hoe", tool: true, slot: "main", fill: "var(--color-muted)", armor: 0, buy: 12, sell: 4, tags: ["tool"] },
  log: { label: "Log", tool: false, slot: null, fill: "var(--color-gold)", armor: 0, buy: 0, sell: 2, tags: ["wood", "fuel"] },
  board: { label: "Board", tool: false, slot: null, fill: "var(--color-gold)", armor: 0, buy: 0, sell: 3, tags: ["wood", "fuel"] },
  ore: { label: "Iron ore", tool: false, slot: null, fill: "var(--color-muted)", armor: 0, buy: 0, sell: 3, tags: ["metal"] },
  ingot: { label: "Ingot", tool: false, slot: null, fill: "var(--color-muted)", armor: 0, buy: 8, sell: 5, tags: ["metal"] },
  club: { label: "Club", tool: true, slot: "main", fill: "var(--color-gold)", armor: 0, buy: 10, sell: 6, tags: ["wood", "weapon"] },
  shield: { label: "Wooden shield", tool: false, slot: "off", fill: "var(--color-gold)", armor: 2, buy: 18, sell: 10, tags: ["wood", "armor"] },
  staff: { label: "Staff", tool: true, slot: "main", fill: "var(--color-gold)", armor: 0, buy: 16, sell: 8, tags: ["wood", "weapon"] },
  bow: { label: "Bow", tool: true, slot: "main", fill: "var(--color-gold)", armor: 0, buy: 22, sell: 10, tags: ["wood", "weapon"] },
  torch: { label: "Torch", tool: false, slot: "main", fill: "var(--color-accent)", armor: 0, buy: 4, sell: 2, tags: ["wood", "fuel"] },
  crate: { label: "Crate", tool: false, slot: null, fill: "var(--color-gold)", armor: 0, buy: 12, sell: 7, tags: ["wood"] },
  cap: { label: "Wooden cap", tool: false, slot: "head", fill: "var(--color-gold)", armor: 1, buy: 14, sell: 6, tags: ["wood", "armor"] },
  cuirass: { label: "Wooden cuirass", tool: false, slot: "chest", fill: "var(--color-gold)", armor: 2, buy: 28, sell: 12, tags: ["wood", "armor"] },
  sword: { label: "Sword", tool: true, slot: "main", fill: "var(--color-muted)", armor: 0, buy: 36, sell: 16, tags: ["metal", "blade", "weapon"] },
  mace: { label: "Mace", tool: true, slot: "main", fill: "var(--color-muted)", armor: 0, buy: 28, sell: 12, tags: ["metal", "weapon"] },
  gauntlets: { label: "Gauntlets", tool: false, slot: "hands", fill: "var(--color-muted)", armor: 2, buy: 24, sell: 10, tags: ["metal", "armor"] },
  gorget: { label: "Gorget", tool: false, slot: "neck", fill: "var(--color-muted)", armor: 1, buy: 20, sell: 8, tags: ["metal", "armor"] },
  heater: { label: "Iron shield", tool: false, slot: "off", fill: "var(--color-muted)", armor: 4, buy: 32, sell: 14, tags: ["metal", "armor"] },
  meat: { label: "Raw meat", tool: false, slot: null, fill: "var(--color-accent)", armor: 0, buy: 4, sell: 2, tags: ["meat", "food"] },
  hide: { label: "Hide", tool: false, slot: null, fill: "var(--color-gold)", armor: 0, buy: 0, sell: 4, tags: ["hide"] },
  bandage: { label: "Bandage", tool: false, slot: null, fill: "var(--color-fg)", armor: 0, buy: 3, sell: 1, tags: ["cloth"] },
  tunic: { label: "Tunic", tool: false, slot: "chest", fill: "var(--color-gold)", armor: 1, buy: 18, sell: 6, tags: ["cloth", "armor"] },
  leather: { label: "Leather tunic", tool: false, slot: "chest", fill: "var(--color-accent)", armor: 3, buy: 40, sell: 14, tags: ["leather", "armor"] },
  mail: { label: "Mail", tool: false, slot: "chest", fill: "var(--color-muted)", armor: 5, buy: 80, sell: 28, tags: ["metal", "armor"] },
  hood: { label: "Hood", tool: false, slot: "head", fill: "var(--color-accent)", armor: 1, buy: 10, sell: 3, tags: ["cloth", "armor"] },
  helm: { label: "Helm", tool: false, slot: "head", fill: "var(--color-muted)", armor: 3, buy: 36, sell: 12, tags: ["metal", "armor"] },
  cloak: { label: "Travel cloak", tool: false, slot: "cloak", fill: "var(--color-accent)", armor: 1, buy: 32, sell: 12, tags: ["cloth", "armor"] },
  gloves: { label: "Gloves", tool: false, slot: "hands", fill: "var(--color-gold)", armor: 1, buy: 12, sell: 4, tags: ["cloth", "armor"] },
  hose: { label: "Hose", tool: false, slot: "legs", fill: "var(--color-muted)", armor: 1, buy: 14, sell: 5, tags: ["cloth", "armor"] },
  greaves: { label: "Greaves", tool: false, slot: "legs", fill: "var(--color-muted)", armor: 3, buy: 40, sell: 14, tags: ["metal", "armor"] },
  boots: { label: "Boots", tool: false, slot: "feet", fill: "var(--color-accent)", armor: 1, buy: 16, sell: 6, tags: ["leather", "armor"] },
  pendant: { label: "Pendant", tool: false, slot: "neck", fill: "var(--color-gold)", armor: 0, buy: 22, sell: 8, tags: ["gem"] },
  ring: { label: "Ring", tool: false, slot: "finger", fill: "var(--color-gold)", armor: 0, buy: 18, sell: 7, tags: ["metal", "gem"] },
  relic: { label: "Barrow relic", tool: false, slot: "neck", fill: "var(--color-fg)", armor: 0, buy: 0, sell: 40, tags: ["magic", "gem"] },
  spellbook: { label: "Spellbook", tool: false, slot: null, fill: "var(--color-accent)", armor: 0, buy: 60, sell: 20, tags: ["magic"] },
  rune: { label: "Blank rune", tool: false, slot: null, fill: "var(--color-muted)", armor: 0, buy: 18, sell: 6, tags: ["magic"] },
  garlic: { label: "Garlic", tool: false, slot: null, fill: "var(--color-fg)", armor: 0, buy: 3, sell: 1, tags: ["reagent", "plant", "food"] },
  ginseng: { label: "Ginseng", tool: false, slot: null, fill: "var(--color-gold)", armor: 0, buy: 3, sell: 1, tags: ["reagent", "plant"] },
  silk: { label: "Spider silk", tool: false, slot: null, fill: "var(--color-muted)", armor: 0, buy: 4, sell: 1, tags: ["reagent", "cloth"] },
  nightshade: { label: "Nightshade", tool: false, slot: null, fill: "var(--color-accent)", armor: 0, buy: 5, sell: 2, tags: ["reagent", "plant"] },
  pearl: { label: "Black pearl", tool: false, slot: null, fill: "var(--color-muted)", armor: 0, buy: 5, sell: 2, tags: ["reagent", "gem"] },
  moss: { label: "Blood moss", tool: false, slot: null, fill: "var(--color-accent)", armor: 0, buy: 5, sell: 2, tags: ["reagent", "plant"] },
  mandrake: { label: "Mandrake", tool: false, slot: null, fill: "var(--color-gold)", armor: 0, buy: 6, sell: 2, tags: ["reagent", "plant"] },
  ash: { label: "Sulfurous ash", tool: false, slot: null, fill: "var(--color-gold)", armor: 0, buy: 4, sell: 1, tags: ["reagent"] },
  cabbage: { label: "Cabbage", tool: false, slot: null, fill: "var(--color-gold)", armor: 0, buy: 4, sell: 2, tags: ["plant", "food"] },
  wheat: { label: "Wheat", tool: false, slot: null, fill: "var(--color-gold)", armor: 0, buy: 3, sell: 1, tags: ["plant", "food"] },
  cabbage_seed: { label: "Cabbage seed", tool: false, slot: null, fill: "var(--color-gold)", armor: 0, buy: 2, sell: 1, tags: ["seed", "plant"] },
  wheat_seed: { label: "Wheat seed", tool: false, slot: null, fill: "var(--color-gold)", armor: 0, buy: 2, sell: 1, tags: ["seed", "plant"] },
  garlic_seed: { label: "Garlic seed", tool: false, slot: null, fill: "var(--color-gold)", armor: 0, buy: 3, sell: 1, tags: ["seed", "plant"] },
};

export const CLASS_META: Record<ClassId, { label: string; color: string }> = {
  ranger: { label: "Ranger", color: "#6a7a48" },
  warrior: { label: "Warrior", color: "#8a6a4a" },
  mage: { label: "Mage", color: "#6a5a78" },
  rogue: { label: "Rogue", color: "#5a5a52" },
  merchant: { label: "Merchant", color: "#a88848" },
};

export const FAUNA_META: Record<FaunaKind, { label: string; tameDiff: number; hp: number; dmg: number; eats: ResourceTag[] }> = {
  hare: { label: "Hare", tameDiff: 8, hp: 8, dmg: 1, eats: ["plant"] },
  hart: { label: "Hart", tameDiff: 22, hp: 22, dmg: 4, eats: ["plant"] },
  wolf: { label: "Wolf", tameDiff: 40, hp: 28, dmg: 8, eats: ["meat"] },
  wight: { label: "Wight", tameDiff: 99, hp: 36, dmg: 10, eats: ["meat"] },
};

/** Tag lookup on the catalog — the single place items declare what they ARE. */
export function itemTags(id: ItemId): ResourceTag[] {
  return ITEM_META[id].tags;
}

export function hasTag(id: ItemId, tag: ResourceTag): boolean {
  return ITEM_META[id].tags.includes(tag);
}

/** How many tag-matching items a pack holds (sum across all matching ids). */
export function countTag(pack: Partial<Record<ItemId, number>> | undefined, tag: ResourceTag): number {
  if (!pack) return 0;
  let n = 0;
  for (const [k, v] of Object.entries(pack)) {
    if (v && hasTag(k as ItemId, tag)) n += v;
  }
  return n;
}

/**
 * Deterministic consumption order for a tag: cheapest sell value first,
 * ties broken by item id. Raw materials (log) get consumed before refined
 * ones (board) because they sell for less — and tests/saves stay reproducible.
 */
export function tagConsumeOrder(tag: ResourceTag): ItemId[] {
  return (Object.keys(ITEM_META) as ItemId[])
    .filter((id) => hasTag(id, tag))
    .sort((a, b) => ITEM_META[a].sell - ITEM_META[b].sell || a.localeCompare(b));
}

export const NPC_META: Record<NpcRole, { label: string }> = {
  banker: { label: "Banker" },
  provisioner: { label: "Provisioner" },
  healer: { label: "Healer" },
};

export const BUILDING_META: Record<BuildingKind, { label: string }> = {
  hall: { label: "Hall" },
  dormitory: { label: "Dormitory" },
  kitchen: { label: "Kitchen" },
  yard: { label: "Yard" },
  board: { label: "Board" },
  market: { label: "Market" },
  forge: { label: "Forge" },
  tavern: { label: "Tavern" },
  notice: { label: "Notice" },
  farm: { label: "Farm" },
  keep: { label: "Keep" },
  rampart: { label: "Rampart" },
  rampartV: { label: "Rampart" },
  tower: { label: "Tower" },
  gatehouse: { label: "Gatehouse" },
  shop: { label: "Shop" },
  townhome: { label: "Townhome" },
  townhouse: { label: "Townhouse" },
  cottage: { label: "Cottage" },
};

export const BUILD_ORDER: BuildingKind[] = ["dormitory", "kitchen", "farm", "market", "forge", "tavern"];

export const NOTORIETY_META: Record<Notoriety, { label: string }> = {
  innocent: { label: "Innocent" },
  criminal: { label: "Criminal" },
  murderer: { label: "Murderer" },
};

export const SHOP_STOCK: ItemId[] = [
  "hatchet", "pick", "hoe", "knife", "bandage", "tunic", "hood", "cloak", "boots",
  "rune", "garlic", "ginseng", "silk", "pearl", "moss", "mandrake", "ash", "cabbage", "wheat",
  "cabbage_seed", "wheat_seed", "garlic_seed",
];

export function emptySkills(): Record<SkillId, number> {
  return {
    swords: 12,
    lumberjack: 14,
    mining: 8,
    anatomy: 10,
    healing: 8,
    cooking: 6,
    smithing: 8,
    carpentry: 12,
    taming: 14,
    magery: 8,
    farming: 10,
  };
}

export function emptyLastGain(): Record<SkillId, number> {
  return {
    swords: 0, lumberjack: 0, mining: 0, anatomy: 0, healing: 0,
    cooking: 0, smithing: 0, carpentry: 0, taming: 0, magery: 0, farming: 0,
  };
}

export function emptyPack(): Record<ItemId, number> {
  return {
    hatchet: 1, knife: 1, pick: 1, hoe: 1, log: 0, board: 0, ore: 0, ingot: 0, club: 0, shield: 0,
    staff: 0, bow: 0, torch: 0, crate: 0, cap: 0, cuirass: 0, sword: 0, mace: 0, gauntlets: 0, gorget: 0, heater: 0,
    meat: 1, hide: 0, bandage: 3,
    tunic: 0, leather: 0, mail: 0, hood: 1, helm: 0, cloak: 0, gloves: 1, hose: 0, greaves: 0,
    boots: 0, pendant: 1, ring: 1, relic: 0, spellbook: 1, rune: 4, garlic: 12, ginseng: 12,
    silk: 16, nightshade: 4, pearl: 14, moss: 10, mandrake: 10, ash: 12, cabbage: 2, wheat: 0,
    cabbage_seed: 8, wheat_seed: 6, garlic_seed: 4,
  };
}

export function emptyChest(): Record<ItemId, number> {
  const p = emptyPack();
  for (const k of Object.keys(p) as ItemId[]) p[k] = 0;
  return p;
}

export function settleGear(player: {
  pack: Record<ItemId, number>;
  wear: Partial<Record<WearSlot, ItemId>>;
  chest: Record<ItemId, number>;
  skills: Record<SkillId, number>;
  lastGain?: Record<SkillId, number>;
}) {
  if (!player.pack) player.pack = emptyPack();
  if (!player.chest) player.chest = emptyChest();
  if (!player.wear) player.wear = {};
  if (!player.skills) player.skills = emptySkills();
  if (!player.lastGain) player.lastGain = emptyLastGain();
  const base = emptySkills();
  const last = emptyLastGain();
  for (const id of Object.keys(base) as SkillId[]) {
    if (player.skills[id] == null) player.skills[id] = base[id];
    if (player.lastGain[id] == null) player.lastGain[id] = last[id];
  }
  for (const id of Object.keys(emptyPack()) as ItemId[]) {
    if (player.pack[id] == null) player.pack[id] = 0;
    if (player.chest[id] == null) player.chest[id] = 0;
  }
}

export function armorOf(wear: Partial<Record<WearSlot, ItemId>>) {
  let n = 0;
  for (const id of Object.values(wear)) if (id) n += ITEM_META[id].armor;
  return n;
}

export function recruitCost(members: number) {
  return 20 + members * 12;
}

export const CLASS_LIST: ClassId[] = ["ranger", "warrior", "mage", "rogue", "merchant"];
export const VOCATION_META = {
  cook: { label: "Cook" },
  armourer: { label: "Armourer" },
  trader: { label: "Trader" },
  recruiter: { label: "Recruiter" },
  guard: { label: "Guard" },
};
export const QUEST_META: Record<string, { label: string }> = {};
export const QUEST_ORDER: string[] = [];
export const FACTION_META: Record<string, { label: string }> = {};
