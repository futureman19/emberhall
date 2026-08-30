import { countTag, hasTag, ITEM_META, tagConsumeOrder } from "./catalog.ts";
import { you } from "./player.ts";
import { successChance, tryGain } from "./skills.ts";
import { playSfx, type SfxId } from "./vale-sfx.ts";
import { completeObjective, log } from "./world.ts";
import type { BuildingKind, ItemId, ResourceTag, SkillId, World } from "./types.ts";

export { countTag, hasTag, itemTags, tagConsumeOrder } from "./catalog.ts";

export type Station = "bench" | "forge";

export interface Recipe {
  id: string;
  /** null = field work — no station needed, anywhere in the vale. */
  station: Station | null;
  skill: SkillId;
  diff: number;
  label: string;
  hint: string;
  /** Item-specific ingredients (conversions like log→board stay exact). */
  need: Partial<Record<ItemId, number>>;
  /** Tag ingredients — any items carrying the tag fill the quota, cheapest first. */
  needTags?: { tag: ResourceTag; n: number }[];
  /** Requires a blade-tagged item in hand (the UO "bladed" script). */
  needsBlade?: boolean;
  give: Partial<Record<ItemId, number>>;
  sfx: SfxId;
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
  { id: "bow", station: "bench", skill: "carpentry", diff: 18, label: "Bow", hint: "Any five wood, a curve.", need: {}, needTags: [{ tag: "wood", n: 5 }], give: { bow: 1 }, sfx: "chop" },
  { id: "cuirass", station: "bench", skill: "carpentry", diff: 22, label: "Wooden cuirass", hint: "Any eight wood, bound.", need: {}, needTags: [{ tag: "wood", n: 8 }], give: { cuirass: 1 }, sfx: "chop" },
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
  { id: "sword", station: "forge", skill: "smithing", diff: 20, label: "Sword", hint: "Any eight metal, an edge.", need: {}, needTags: [{ tag: "metal", n: 8 }], give: { sword: 1 }, sfx: "smith" },
  { id: "helm", station: "forge", skill: "smithing", diff: 22, label: "Helm", hint: "Any eight metal.", need: {}, needTags: [{ tag: "metal", n: 8 }], give: { helm: 1 }, sfx: "smith" },
  { id: "heater", station: "forge", skill: "smithing", diff: 24, label: "Iron shield", hint: "Any eight metal, a face.", need: {}, needTags: [{ tag: "metal", n: 8 }], give: { heater: 1 }, sfx: "smith" },
  { id: "greaves", station: "forge", skill: "smithing", diff: 28, label: "Greaves", hint: "Any ten metal.", need: {}, needTags: [{ tag: "metal", n: 10 }], give: { greaves: 1 }, sfx: "smith" },
  { id: "mail", station: "forge", skill: "smithing", diff: 36, label: "Mail", hint: "Any fourteen metal.", need: {}, needTags: [{ tag: "metal", n: 14 }], give: { mail: 1 }, sfx: "smith" },
  // Field work — the "bladed" script: a sharp edge in hand, no station.
  { id: "cut_bandage", station: null, skill: "healing", diff: -20, label: "Cut bandages", hint: "Any cloth, a blade. Two dressings.", need: {}, needTags: [{ tag: "cloth", n: 1 }], needsBlade: true, give: { bandage: 2 }, sfx: "chop" },
  { id: "cut_leather", station: null, skill: "carpentry", diff: 10, label: "Stitch a hide shirt", hint: "Two hides, a blade. Leather armor.", need: {}, needTags: [{ tag: "hide", n: 2 }], needsBlade: true, give: { leather: 1 }, sfx: "chop" },
];

function dist(world: World, tx: number, ty: number) {
  const p = you(world);
  if (!p) return Infinity;
  return Math.hypot(p.x - tx, p.z - ty);
}

export function craftReach(kind: BuildingKind) {
  if (kind === "forge") return 4.6;
  if (kind === "yard" || kind === "hall") return 6.2;
  return 0;
}

export function stationOf(kind: BuildingKind): Station | null {
  if (kind === "forge") return "forge";
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
  return [...out];
}

export function recipeById(id: string) {
  return RECIPES.find((r) => r.id === id) ?? null;
}

export function haveNeed(pack: Partial<Record<ItemId, number>> | undefined, rec: Recipe) {
  for (const [k, n] of Object.entries(rec.need)) {
    if ((pack?.[k as ItemId] ?? 0) < (n ?? 0)) return false;
  }
  for (const nt of rec.needTags ?? []) {
    if (countTag(pack, nt.tag) < nt.n) return false;
  }
  return true;
}

export function canMake(world: World, rec: Recipe) {
  if (rec.needsBlade && !bladeInHand(world)) return false;
  return haveNeed(world.player.pack, rec);
}

export function missingNeed(world: World, rec: Recipe): string | null {
  for (const [k, n] of Object.entries(rec.need)) {
    const id = k as ItemId;
    const have = world.player.pack[id] ?? 0;
    if (have < (n ?? 0)) return `Need ${ITEM_META[id].label.toLowerCase()}.`;
  }
  for (const nt of rec.needTags ?? []) {
    if (countTag(world.player.pack, nt.tag) < nt.n) return `Need ${nt.n} ${nt.tag} — anything ${nt.tag} will do.`;
  }
  return null;
}

/** Consume tag ingredients cheapest-first; returns a short "what was used" list. */
function consumeTags(world: World, rec: Recipe): ItemId[] {
  const used: ItemId[] = [];
  for (const nt of rec.needTags ?? []) {
    let left = nt.n;
    for (const id of tagConsumeOrder(nt.tag)) {
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
  if (rec.station !== null) {
    const here = stationsHere(world);
    if (!here.includes(rec.station)) {
      return rec.station === "forge" ? "The ore wants a fire. Raise a forge." : "The wood wants a bench. The yard, or the hall.";
    }
  }
  if (rec.needsBlade && !bladeInHand(world)) {
    return "The work wants an edge. Hold a blade — hatchet, knife, or sword.";
  }
  const miss = missingNeed(world, rec);
  if (miss) return miss;
  for (const [k, n] of Object.entries(rec.need)) {
    const id = k as ItemId;
    world.player.pack[id] = Math.max(0, (world.player.pack[id] ?? 0) - (n ?? 0));
  }
  consumeTags(world, rec);
  const skill = world.player.skills[rec.skill] ?? 0;
  const chance = successChance(skill, rec.diff);
  const ok = Math.random() < chance;
  playSfx(rec.sfx, rec.sfx === "fire" ? 0.48 : 0.52);
  const gain = tryGain(world, rec.skill, true, chance >= 0.35 && chance <= 0.85);
  if (!ok) {
    const note = gain ? `The work splits. ${gain}.` : "The work splits.";
    log(world, note);
    return note;
  }
  for (const [k, n] of Object.entries(rec.give)) {
    const id = k as ItemId;
    world.player.pack[id] = (world.player.pack[id] ?? 0) + (n ?? 0);
  }
  if (rec.id === "board") completeObjective(world, "plank");
  if (rec.id === "smelt") completeObjective(world, "smelt");
  if (rec.station === "forge" && rec.id !== "smelt") completeObjective(world, "smith");
  const made = Object.entries(rec.give)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([k, n]) => `${n} ${ITEM_META[k as ItemId].label.toLowerCase()}`)
    .join(", ");
  const note = gain ? `${made}. ${gain}.` : `${made}.`;
  log(world, note);
  return note;
}
