import { countTag, hasTag, ITEM_META, tagConsumeOrder } from "./catalog.ts";
import { litFireNear, placeCampfire } from "./campfire.ts";
import { effSkill, you } from "./player.ts";
import {
  createCraftedItem,
  createWorkmanshipItem,
  rareName,
  workmanshipForCraft,
} from "./rare.ts";
import { ITEM_FORM_CATALOG } from "./crafting/forms.ts";
import { exactRecipeById, type ExactMaterialSelection, type ExactRecipeId } from "./crafting/recipes.ts";
import {
  executeExactCraftTransaction,
  previewExactCraftTransaction,
} from "./crafting/transaction.ts";
import { successChance, tryGain } from "./skills.ts";
import { playSfx, type SfxId } from "./vale-sfx.ts";
import { completeObjective, log } from "./world.ts";
import { countGenericCraftResource, debitGenericCraftResource, type GenericCraftResourceItem } from "./inventory/resources.ts";
import { refineResource } from "./refining.ts";
import type { CraftAnimationKind } from "./crafting-animation.ts";
import type { BuildingKind, ItemId, RareItem, ResourceStackKey, ResourceTag, SkillId, World } from "./types.ts";

export { countTag, hasTag, itemTags, tagConsumeOrder } from "./catalog.ts";
export {
  EXACT_RECIPE_CATALOG,
  exactRecipeById,
  resolveExactRecipeSelection,
  resourceStackMatchesRole,
} from "./crafting/recipes.ts";
export { executeExactCraftTransaction, previewExactCraftTransaction } from "./crafting/transaction.ts";
export type {
  ExactMaterialSelection,
  ExactRecipeDefinition,
  ExactRecipeId,
  ResolvedExactRecipeSelection,
} from "./crafting/recipes.ts";
export type {
  ExactCraftTransactionPreview,
  ExactCraftTransactionResult,
} from "./crafting/transaction.ts";

export type Station = "bench" | "forge" | "fire";

export interface Recipe {
  id: string;
  /** null = field work — no station needed, anywhere in the vale. */
  station: Station | null;
  skill: SkillId;
  diff: number;
  label: string;
  hint: string;
  /** Equipment recipes require an explicit typed-material selection. */
  exactRecipeId?: ExactRecipeId;
  /** Item-specific ingredients (conversions like log→board stay exact). */
  need: Partial<Record<ItemId, number>>;
  /** Tag ingredients — any items carrying the tag fill the quota, cheapest first. */
  needTags?: { tag: ResourceTag; n: number }[];
  /** Requires a blade-tagged item in hand (the UO "bladed" script). */
  needsBlade?: boolean;
  /** Success places a campfire at your feet instead of giving an item. */
  placesFire?: boolean;
  give: Partial<Record<ItemId, number>>;
  sfx: SfxId;
}

export interface CraftFx {
  kind: CraftAnimationKind;
  recipeId: string;
  success: boolean;
  x: number;
  z: number;
  at: number;
}

let craftFx: CraftFx | null = null;

export function getCraftFx() {
  return craftFx;
}

function emitCraftFx(world: World, rec: Recipe, success: boolean) {
  const kind: CraftAnimationKind | null =
    rec.skill === "smithing" ? "smithing" : rec.skill === "carpentry" ? "carpentry" : rec.skill === "cooking" ? "cooking" : null;
  const player = you(world);
  if (!kind || !player) return;
  craftFx = { kind, recipeId: rec.id, success, x: player.x, z: player.z, at: world.hour };
}

/** Held item carries the blade tag (the UO "bladed" script check). */
export function bladeInHand(world: World): boolean {
  const held = world.player.wear.main;
  return Boolean(held && hasTag(held, "blade"));
}

export const RECIPES: Recipe[] = [
  { id: "board", station: "bench", skill: "carpentry", diff: -18, label: "Boards", hint: "Split a log.", need: { log: 1 }, give: { board: 2 }, sfx: "chop" },
  { id: "torch", station: "bench", skill: "carpentry", diff: -8, label: "Torch", hint: "One board, a pitch.", need: { board: 1 }, give: { torch: 2 }, sfx: "chop" },
  { id: "club", station: "bench", skill: "carpentry", diff: 6, label: "Club", hint: "Any two wood — a heavy stick.", need: {}, needTags: [{ tag: "wood", n: 2 }], give: { club: 1 }, sfx: "chop" },
  { id: "crate", station: "bench", skill: "carpentry", diff: 8, label: "Crate", hint: "Any six wood, nailed.", need: {}, needTags: [{ tag: "wood", n: 6 }], give: { crate: 1 }, sfx: "chop" },
  { id: "staff", station: "bench", skill: "carpentry", diff: 10, label: "Staff", hint: "Any three wood, a ferrule.", need: {}, needTags: [{ tag: "wood", n: 3 }], give: { staff: 1 }, sfx: "chop" },
  { id: "cap", station: "bench", skill: "carpentry", diff: 12, label: "Wooden cap", hint: "Any three wood, a crown.", need: {}, needTags: [{ tag: "wood", n: 3 }], give: { cap: 1 }, sfx: "chop" },
  { id: "shield", station: "bench", skill: "carpentry", diff: 14, label: "Wooden shield", hint: "Any four wood, a boss.", need: {}, needTags: [{ tag: "wood", n: 4 }], give: { shield: 1 }, sfx: "chop" },
  { id: "bow", station: "bench", skill: "carpentry", diff: 18, label: "Bow", hint: "Choose five timber for the body and one cloth binding.", exactRecipeId: "bow", need: {}, give: { bow: 1 }, sfx: "chop" },
  { id: "cuirass", station: "bench", skill: "carpentry", diff: 22, label: "Wooden cuirass", hint: "Any eight wood, bound.", need: {}, needTags: [{ tag: "wood", n: 8 }], give: { cuirass: 1 }, sfx: "chop" },
  { id: "deed_porch", station: "bench", skill: "carpentry", diff: 8, label: "Porch deed", hint: "Eight boards. A roof on posts.", need: { board: 8 }, give: { deed_porch: 1 }, sfx: "chop" },
  { id: "deed_hut", station: "bench", skill: "carpentry", diff: 20, label: "Hut deed", hint: "Eighteen boards. A door and a chest.", need: { board: 18 }, give: { deed_hut: 1 }, sfx: "chop" },
  { id: "deed_homestead", station: "bench", skill: "carpentry", diff: 36, label: "Homestead deed", hint: "Thirty-six boards. A proper house.", need: { board: 36 }, give: { deed_homestead: 1 }, sfx: "chop" },
  { id: "smelt", station: "forge", skill: "smithing", diff: -22, label: "Smelt ore", hint: "Ore to ingot — only raw ore will do.", need: { ore: 1 }, give: { ingot: 1 }, sfx: "fire" },
  { id: "ring", station: "forge", skill: "smithing", diff: 4, label: "Ring", hint: "Any two metal, a band.", need: {}, needTags: [{ tag: "metal", n: 2 }], give: { ring: 1 }, sfx: "smith" },
  { id: "knife", station: "forge", skill: "smithing", diff: 6, label: "Skinning knife", hint: "Any three metal.", need: {}, needTags: [{ tag: "metal", n: 3 }], give: { knife: 1 }, sfx: "smith" },
  { id: "hatchet", station: "forge", skill: "smithing", diff: 8, label: "Hatchet", hint: "Any four metal.", need: {}, needTags: [{ tag: "metal", n: 4 }], give: { hatchet: 1 }, sfx: "smith" },
  { id: "pick", station: "forge", skill: "smithing", diff: 10, label: "Pick", hint: "Any four metal.", need: {}, needTags: [{ tag: "metal", n: 4 }], give: { pick: 1 }, sfx: "smith" },
  { id: "hoe", station: "forge", skill: "smithing", diff: 8, label: "Hoe", hint: "Any four metal, a blade.", need: {}, needTags: [{ tag: "metal", n: 4 }], give: { hoe: 1 }, sfx: "smith" },
  { id: "gorget", station: "forge", skill: "smithing", diff: 12, label: "Gorget", hint: "Any four metal, a collar.", need: {}, needTags: [{ tag: "metal", n: 4 }], give: { gorget: 1 }, sfx: "smith" },
  { id: "boots", station: "forge", skill: "smithing", diff: 14, label: "Iron-shod boots", hint: "Any five metal.", need: {}, needTags: [{ tag: "metal", n: 5 }], give: { boots: 1 }, sfx: "smith" },
  { id: "gauntlets", station: "forge", skill: "smithing", diff: 16, label: "Gauntlets", hint: "Any five metal.", need: {}, needTags: [{ tag: "metal", n: 5 }], give: { gauntlets: 1 }, sfx: "smith" },
  { id: "mace", station: "forge", skill: "smithing", diff: 18, label: "Mace", hint: "Any six metal, a head.", need: {}, needTags: [{ tag: "metal", n: 6 }], give: { mace: 1 }, sfx: "smith" },
  { id: "sword", station: "forge", skill: "smithing", diff: 20, label: "Sword", hint: "Choose five ingots, one timber hilt, and one cloth binding.", exactRecipeId: "sword", need: {}, give: { sword: 1 }, sfx: "smith" },
  { id: "helm", station: "forge", skill: "smithing", diff: 22, label: "Helm", hint: "Any eight metal.", need: {}, needTags: [{ tag: "metal", n: 8 }], give: { helm: 1 }, sfx: "smith" },
  { id: "heater", station: "forge", skill: "smithing", diff: 24, label: "Iron shield", hint: "Any eight metal, a face.", need: {}, needTags: [{ tag: "metal", n: 8 }], give: { heater: 1 }, sfx: "smith" },
  { id: "greaves", station: "forge", skill: "smithing", diff: 28, label: "Greaves", hint: "Any ten metal.", need: {}, needTags: [{ tag: "metal", n: 10 }], give: { greaves: 1 }, sfx: "smith" },
  { id: "mail", station: "forge", skill: "smithing", diff: 36, label: "Mail", hint: "Any fourteen metal.", need: {}, needTags: [{ tag: "metal", n: 14 }], give: { mail: 1 }, sfx: "smith" },
  // Field work — the "bladed" script: a sharp edge in hand, no station.
  { id: "cut_bandage", station: null, skill: "healing", diff: -20, label: "Cut bandages", hint: "Any cloth, a blade. Two dressings.", need: {}, needTags: [{ tag: "cloth", n: 1 }], needsBlade: true, give: { bandage: 2 }, sfx: "chop" },
  { id: "cut_leather", station: null, skill: "carpentry", diff: 10, label: "Stitch a hide shirt", hint: "Two hides, a blade. Leather armor.", need: {}, needTags: [{ tag: "hide", n: 2 }], needsBlade: true, give: { leather: 1 }, sfx: "chop" },
  // Camping — three wood buys a fire that burns three hours.
  { id: "campfire", station: null, skill: "cooking", diff: -25, label: "Build a campfire", hint: "Any three wood. Cooks like a hearth, dies in three hours.", need: {}, needTags: [{ tag: "wood", n: 3 }], placesFire: true, give: {}, sfx: "fire" },
  // The fire — roast, bake, stew. A campfire or the kitchen hearth both serve.
  { id: "roast_meat", station: "fire", skill: "cooking", diff: -15, label: "Roast meat", hint: "Raw meat to a proper meal.", need: { meat: 1 }, give: { cooked_meat: 1 }, sfx: "fire" },
  { id: "bake_bread", station: "fire", skill: "cooking", diff: 8, label: "Bake bread", hint: "Two wheat, one loaf.", need: { wheat: 2 }, give: { bread: 1 }, sfx: "fire" },
  { id: "stew_pot", station: "fire", skill: "cooking", diff: 22, label: "Venison stew", hint: "A cabbage and a cut of meat, simmered.", need: { cabbage: 1, meat: 1 }, give: { stew: 1 }, sfx: "fire" },
];

function dist(world: World, tx: number, ty: number) {
  const p = you(world);
  if (!p) return Infinity;
  return Math.hypot(p.x - tx, p.z - ty);
}

export function craftReach(kind: BuildingKind) {
  if (kind === "forge" || kind === "kitchen") return 4.6;
  if (kind === "yard" || kind === "hall") return 6.2;
  return 0;
}

export function stationOf(kind: BuildingKind): Station | null {
  if (kind === "forge") return "forge";
  if (kind === "kitchen") return "fire";
  if (kind === "yard" || kind === "hall") return "bench";
  return null;
}

export function buildingAt(world: World, tx: number, ty: number, reach = 2.8) {
  let best: World["buildings"][number] | null = null;
  let d = reach;
  for (const b of world.buildings) {
    if (!stationOf(b.kind)) continue;
    const dd = Math.hypot(b.tx - tx, b.ty - ty);
    if (dd < d) {
      d = dd;
      best = b;
    }
  }
  return best;
}

export function stationsHere(world: World): Station[] {
  const p = you(world);
  if (!p) return [];
  const out = new Set<Station>();
  for (const b of world.buildings) {
    const st = stationOf(b.kind);
    if (!st) continue;
    if (dist(world, b.tx, b.ty) <= craftReach(b.kind)) out.add(st);
  }
  if (litFireNear(world)) out.add("fire");
  return [...out];
}

export function recipeById(id: string) {
  return RECIPES.find((r) => r.id === id) ?? null;
}

/** A recipe's own products — they must never feed their own making
 *  (bandages are cloth, clubs are wood: without this, a batch eats
 *  what it just produced). */
function selfIds(rec: Recipe): Set<string> {
  return new Set(Object.keys(rec.give));
}

export function haveNeed(pack: Partial<Record<ItemId, number>> | undefined, rec: Recipe) {
  if (rec.exactRecipeId) return false;
  for (const [k, n] of Object.entries(rec.need)) {
    if ((pack?.[k as ItemId] ?? 0) < (n ?? 0)) return false;
  }
  const self = selfIds(rec);
  for (const nt of rec.needTags ?? []) {
    if (countTag(pack, nt.tag, self) < nt.n) return false;
  }
  return true;
}

function genericCraftItem(id: ItemId): GenericCraftResourceItem | null {
  return id === "log" || id === "ore" ? id : null;
}

function exactNeedCount(world: World, id: ItemId): number {
  const generic = genericCraftItem(id);
  return generic ? countGenericCraftResource(world.player, generic) : (world.player.pack[id] ?? 0);
}

/** World-aware exact requirements; public pack-only haveNeed remains backward compatible. */
function haveWorldNeed(world: World, rec: Recipe): boolean {
  if (rec.exactRecipeId) return false;
  for (const [k, n] of Object.entries(rec.need)) {
    if (exactNeedCount(world, k as ItemId) < (n ?? 0)) return false;
  }
  const self = selfIds(rec);
  for (const nt of rec.needTags ?? []) {
    if (countTag(world.player.pack, nt.tag, self) < nt.n) return false;
  }
  return true;
}

/** Clone-plan-commit exact ingredients so aggregate shortage never partially debits. */
function debitExactNeeds(world: World, rec: Recipe): boolean {
  const pack = structuredClone(world.player.pack);
  const planned = { resources: structuredClone(world.player.resources), pack };
  for (const [k, n] of Object.entries(rec.need)) {
    const id = k as ItemId;
    const amount = n ?? 0;
    if (amount <= 0) continue;
    const generic = genericCraftItem(id);
    if (generic) {
      if (!debitGenericCraftResource(planned, generic, amount)) return false;
      continue;
    }
    const have = pack[id] ?? 0;
    if (have < amount) return false;
    pack[id] = have - amount;
  }
  world.player.pack = pack;
  world.player.resources = planned.resources;
  return true;
}

export function canMake(world: World, rec: Recipe) {
  if (rec.needsBlade && !bladeInHand(world)) return false;
  return haveWorldNeed(world, rec);
}

export function missingNeed(world: World, rec: Recipe): string | null {
  if (rec.exactRecipeId) return "Choose exact materials for this equipment recipe.";
  for (const [k, n] of Object.entries(rec.need)) {
    const id = k as ItemId;
    const have = exactNeedCount(world, id);
    if (have < (n ?? 0)) return `Need ${ITEM_META[id].label.toLowerCase()}.`;
  }
  const self = selfIds(rec);
  for (const nt of rec.needTags ?? []) {
    if (countTag(world.player.pack, nt.tag, self) < nt.n) return `Need ${nt.n} ${nt.tag} — anything ${nt.tag} will do.`;
  }
  return null;
}

/** Consume tag ingredients cheapest-first; returns a short "what was used" list. */
function consumeTags(world: World, rec: Recipe): ItemId[] {
  const used: ItemId[] = [];
  const self = selfIds(rec);
  for (const nt of rec.needTags ?? []) {
    let left = nt.n;
    for (const id of tagConsumeOrder(nt.tag)) {
      if (self.has(id)) continue;
      if (left <= 0) break;
      const have = world.player.pack[id] ?? 0;
      if (have <= 0) continue;
      const take = Math.min(have, left);
      world.player.pack[id] = have - take;
      left -= take;
      for (let i = 0; i < take; i++) used.push(id);
    }
  }
  return used;
}

export function commandCraft(world: World, recipeId: string): string | null {
  if (world.player.ghost) return "A ghost cannot.";
  const rec = recipeById(recipeId);
  if (!rec) return "No such work.";
  if (rec.exactRecipeId) return "Choose exact materials for this equipment recipe.";
  if (rec.station !== null) {
    const here = stationsHere(world);
    if (!here.includes(rec.station)) {
      if (rec.station === "forge") return "The ore wants a fire. Raise a forge.";
      if (rec.station === "fire") return "The pot wants a fire — build a campfire, or find a hearth.";
      return "The wood wants a bench. The yard, or the hall.";
    }
  }
  if (rec.needsBlade && !bladeInHand(world)) {
    return "The work wants an edge. Hold a blade — hatchet, knife, or sword.";
  }
  if (rec.placesFire && litFireNear(world)) return "A fire already crackles here.";
  const miss = missingNeed(world, rec);
  if (miss) return miss;
  playSfx(rec.sfx, rec.sfx === "fire" ? 0.48 : 0.52);
  const { ok, gain, wonder } = craftOnce(world, rec);
  emitCraftFx(world, rec, ok);
  if (!ok) {
    const note = gain ? `The work splits. ${gain}.` : "The work splits.";
    log(world, note);
    return note;
  }
  const made = rec.placesFire ? "A fire crackles to life" : madeList(rec, 1);
  const maker = you(world)?.name ?? "an unknown hand";
  const wonderNote = wonder ? ` The maker's mark holds — ${rareName(wonder)}, crafted by ${maker}!` : "";
  const note = gain ? `${made}.${wonderNote} ${gain}.` : `${made}.${wonderNote}`;
  log(world, note);
  return note;
}

/** Task 10 exact bow path; the staged selector UI arrives in Task 13. */
export function commandCraftExact(
  world: World,
  recipeId: string,
  selections: readonly ExactMaterialSelection[],
): string | null {
  if (world.player.ghost) return "A ghost cannot.";
  const exactRecipe = exactRecipeById(recipeId);
  const rec = recipeById(recipeId);
  if (!exactRecipe || !rec || rec.exactRecipeId !== exactRecipe.id) return "No such exact work.";
  if (rec.station !== null && !stationsHere(world).includes(rec.station)) {
    if (rec.station === "forge") return "The ore wants a fire. Raise a forge.";
    if (rec.station === "fire") return "The pot wants a fire — build a campfire, or find a hearth.";
    return "The wood wants a bench. The yard, or the hall.";
  }

  const preview = previewExactCraftTransaction(world.player, exactRecipe.id, selections);
  if (preview.status === "blocked") return preview.message;
  const skill = effSkill(world, rec.skill);
  const chance = successChance(skill, rec.diff);
  playSfx(rec.sfx, 0.52);
  const ok = Math.random() < chance;
  const gain = tryGain(world, rec.skill, ok, chance >= 0.35 && chance <= 0.85);
  emitCraftFx(world, rec, ok);
  if (!ok) {
    const note = gain ? `The work splits. ${gain}.` : "The work splits.";
    log(world, note);
    return note;
  }

  const workmanship = workmanshipForCraft(skill, rec.diff, Math.random());
  const form = ITEM_FORM_CATALOG[exactRecipe.formId];
  const maker = you(world)?.name ?? "an unknown hand";
  const specialty = preview.components.some(
    ({ resourceId }) => !["oak", "common_cloth", "iron_ore"].includes(resourceId),
  );
  const unique = specialty || workmanship !== "ordinary";
  const crafted = unique
    ? createCraftedItem(world, {
        formId: form.id,
        base: form.baseItem,
        workmanship,
        components: preview.components,
        inlays: [],
        maker,
        recipeId: exactRecipe.id,
        recipeVersion: exactRecipe.recipeVersion,
      })
    : null;

  const transaction = executeExactCraftTransaction(world.player, exactRecipe.id, selections);
  if (transaction.status !== "crafted") throw new Error("exact bow materials changed after successful preflight");
  if (crafted) {
    world.player.pack[crafted.base] -= transaction.output.quantity;
    world.player.rares.push(crafted);
  }

  const made = crafted ? rareName(crafted) : "a bow";
  const note = gain ? `Made ${made}, crafted by ${maker}. ${gain}.` : `Made ${made}, crafted by ${maker}.`;
  log(world, note);
  return note;
}

export function commandRefineExact(world: World, key: ResourceStackKey): string {
  if (world.player.ghost) return "A ghost cannot.";
  if (!stationsHere(world).includes("forge")) return "The ore wants a fire. Raise a forge.";
  const result = refineResource(world.player, key, "forge", effSkill(world, "smithing"));
  if (result.status === "blocked") return result.message;
  playSfx("fire", 0.48);
  const player = you(world);
  if (player) craftFx = { kind: "smithing", recipeId: "refine", success: true, x: player.x, z: player.z, at: world.hour };
  const note = `Refined ${result.quantity} ${result.output.replaceAll("_", " ")}.`;
  log(world, note);
  return note;
}

/** The give list rendered ("2 boards"), scaled by successes. */
function madeList(rec: Recipe, times: number): string {
  return Object.entries(rec.give)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([k, n]) => {
      const total = (n ?? 0) * times;
      const label = ITEM_META[k as ItemId].label.toLowerCase();
      return `${total} ${total > 1 && !label.endsWith("s") ? `${label}s` : label}`;
    })
    .join(", ");
}

/**
 * One attempt at the work: consume, roll, learn, produce. No sound, no
 * log — callers own the telling. Every attempt rolls its own success and
 * its own gain, so batches keep the skill sim honest.
 */
function craftOnce(world: World, rec: Recipe): { ok: boolean; gain: string | null; wonder: RareItem | null } {
  if (!debitExactNeeds(world, rec)) throw new Error("craft ingredients changed during atomic debit");
  consumeTags(world, rec);
  const skill = effSkill(world, rec.skill);
  const chance = successChance(skill, rec.diff);
  const ok = Math.random() < chance;
  const gain = tryGain(world, rec.skill, true, chance >= 0.35 && chance <= 0.85);
  if (!ok) return { ok: false, gain, wonder: null };
  for (const [k, n] of Object.entries(rec.give)) {
    const id = k as ItemId;
    world.player.pack[id] = (world.player.pack[id] ?? 0) + (n ?? 0);
  }
  if (rec.placesFire) placeCampfire(world);
  // Fine/exceptional work may become singular, but ordinary materials never invent magic.
  const maker = you(world)?.name ?? "an unknown hand";
  const workmanship = workmanshipForCraft(skill, rec.diff, Math.random());
  const wonder = workmanship === "ordinary"
    ? null
    : Object.keys(rec.give)
        .map((k) => createWorkmanshipItem(world, k as ItemId, workmanship, maker, rec.id))
        .find((r) => r !== null) ?? null;
  if (wonder) {
    // The stack loses one of the piece; the singular wonder takes its place.
    world.player.pack[wonder.base] = Math.max(0, (world.player.pack[wonder.base] ?? 1) - 1);
    world.player.rares.push(wonder);
  }
  if (rec.id === "board") completeObjective(world, "plank");
  if (rec.id === "smelt") completeObjective(world, "smelt");
  if (rec.station === "forge" && rec.id !== "smelt") completeObjective(world, "smith");
  return { ok: true, gain, wonder };
}

/** How many attempts the carried materials allow right now (hard cap 25). */
export function maxCraftable(world: World, rec: Recipe): number {
  if (rec.exactRecipeId) return 0;
  let max = 25;
  for (const [k, n] of Object.entries(rec.need)) {
    if (!n) continue;
    max = Math.min(max, Math.floor(exactNeedCount(world, k as ItemId) / n));
  }
  const self = selfIds(rec);
  for (const nt of rec.needTags ?? []) {
    max = Math.min(max, Math.floor(countTag(world.player.pack, nt.tag, self) / nt.n));
  }
  return Math.max(0, max);
}

/**
 * Craft ×N — one long stint at the bench or fire. Materials are checked
 * before every attempt (the stint ends when they run out); every attempt
 * rolls success, gain, and the maker's mark on its own. One sound, one
 * summary line: "6 boards. 1 split. The maker's mark holds — an exceptional club!"
 */
export function commandCraftBatch(world: World, recipeId: string, times: number): string | null {
  if (world.player.ghost) return "A ghost cannot.";
  const rec = recipeById(recipeId);
  if (!rec) return "No such work.";
  if (rec.exactRecipeId) return "Exact-material equipment is made one piece at a time.";
  if (rec.station !== null) {
    const here = stationsHere(world);
    if (!here.includes(rec.station)) {
      if (rec.station === "forge") return "The ore wants a fire. Raise a forge.";
      if (rec.station === "fire") return "The pot wants a fire — build a campfire, or find a hearth.";
      return "The wood wants a bench. The yard, or the hall.";
    }
  }
  if (rec.needsBlade && !bladeInHand(world)) {
    return "The work wants an edge. Hold a blade — hatchet, knife, or sword.";
  }
  if (rec.placesFire && litFireNear(world)) return "A fire already crackles here.";
  // One fire is plenty — a batch of campfires makes no sense.
  const want = rec.placesFire ? 1 : Math.max(1, Math.min(Math.floor(times), maxCraftable(world, rec)));
  if (want < 1) return missingNeed(world, rec);
  playSfx(rec.sfx, rec.sfx === "fire" ? 0.48 : 0.52);
  let made = 0;
  let failed = 0;
  const gains = new Set<string>();
  const wonders: RareItem[] = [];
  for (let i = 0; i < want; i++) {
    if (missingNeed(world, rec)) break; // the pile ran short mid-stint
    const { ok, gain, wonder } = craftOnce(world, rec);
    if (gain) gains.add(gain);
    if (ok) made++;
    else failed++;
    if (wonder) wonders.push(wonder);
  }
  emitCraftFx(world, rec, made > 0);
  const bits: string[] = [];
  if (made > 0) bits.push(rec.placesFire ? "A fire crackles to life." : madeList(rec, made) + ".");
  if (failed > 0) bits.push(`${failed} split.`);
  if (made === 0 && failed === 0) bits.push("Nothing to work with.");
  const maker = you(world)?.name ?? "an unknown hand";
  for (const w of wonders) bits.push(`The maker's mark holds — ${rareName(w)}, crafted by ${maker}!`);
  const gainText = [...gains].join(" ");
  const note = gainText ? `${bits.join(" ")} ${gainText}.` : bits.join(" ");
  log(world, note);
  return note;
}
