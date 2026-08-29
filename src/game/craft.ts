import { ITEM_META } from "./catalog";
import { you } from "./player";
import { successChance, tryGain } from "./skills";
import { playSfx, type SfxId } from "./vale-sfx";
import { completeObjective, log } from "./world";
import type { BuildingKind, ItemId, SkillId, World } from "./types";

export type Station = "bench" | "forge";

export interface Recipe {
  id: string;
  station: Station;
  skill: SkillId;
  diff: number;
  label: string;
  hint: string;
  need: Partial<Record<ItemId, number>>;
  give: Partial<Record<ItemId, number>>;
  sfx: SfxId;
}

export const RECIPES: Recipe[] = [
  { id: "board", station: "bench", skill: "carpentry", diff: -18, label: "Boards", hint: "Split a log.", need: { log: 1 }, give: { board: 2 }, sfx: "chop" },
  { id: "torch", station: "bench", skill: "carpentry", diff: -8, label: "Torch", hint: "One board, a pitch.", need: { board: 1 }, give: { torch: 2 }, sfx: "chop" },
  { id: "club", station: "bench", skill: "carpentry", diff: 6, label: "Club", hint: "A heavy stick.", need: { board: 2 }, give: { club: 1 }, sfx: "chop" },
  { id: "crate", station: "bench", skill: "carpentry", diff: 8, label: "Crate", hint: "Six boards, nailed.", need: { board: 6 }, give: { crate: 1 }, sfx: "chop" },
  { id: "staff", station: "bench", skill: "carpentry", diff: 10, label: "Staff", hint: "Three boards, a ferrule.", need: { board: 3 }, give: { staff: 1 }, sfx: "chop" },
  { id: "cap", station: "bench", skill: "carpentry", diff: 12, label: "Wooden cap", hint: "Three boards, a crown.", need: { board: 3 }, give: { cap: 1 }, sfx: "chop" },
  { id: "shield", station: "bench", skill: "carpentry", diff: 14, label: "Wooden shield", hint: "Four boards, a boss.", need: { board: 4 }, give: { shield: 1 }, sfx: "chop" },
  { id: "bow", station: "bench", skill: "carpentry", diff: 18, label: "Bow", hint: "Five boards, a curve.", need: { board: 5 }, give: { bow: 1 }, sfx: "chop" },
  { id: "cuirass", station: "bench", skill: "carpentry", diff: 22, label: "Wooden cuirass", hint: "Eight boards, bound.", need: { board: 8 }, give: { cuirass: 1 }, sfx: "chop" },
  { id: "smelt", station: "forge", skill: "smithing", diff: -22, label: "Smelt ore", hint: "Ore to ingot.", need: { ore: 1 }, give: { ingot: 1 }, sfx: "fire" },
  { id: "ring", station: "forge", skill: "smithing", diff: 4, label: "Ring", hint: "Two ingots, a band.", need: { ingot: 2 }, give: { ring: 1 }, sfx: "smith" },
  { id: "knife", station: "forge", skill: "smithing", diff: 6, label: "Skinning knife", hint: "Three ingots.", need: { ingot: 3 }, give: { knife: 1 }, sfx: "smith" },
  { id: "hatchet", station: "forge", skill: "smithing", diff: 8, label: "Hatchet", hint: "Four ingots.", need: { ingot: 4 }, give: { hatchet: 1 }, sfx: "smith" },
  { id: "pick", station: "forge", skill: "smithing", diff: 10, label: "Pick", hint: "Four ingots.", need: { ingot: 4 }, give: { pick: 1 }, sfx: "smith" },
  { id: "hoe", station: "forge", skill: "smithing", diff: 8, label: "Hoe", hint: "Four ingots, a blade.", need: { ingot: 4 }, give: { hoe: 1 }, sfx: "smith" },
  { id: "gorget", station: "forge", skill: "smithing", diff: 12, label: "Gorget", hint: "Four ingots, a collar.", need: { ingot: 4 }, give: { gorget: 1 }, sfx: "smith" },
  { id: "boots", station: "forge", skill: "smithing", diff: 14, label: "Iron-shod boots", hint: "Five ingots.", need: { ingot: 5 }, give: { boots: 1 }, sfx: "smith" },
  { id: "gauntlets", station: "forge", skill: "smithing", diff: 16, label: "Gauntlets", hint: "Five ingots.", need: { ingot: 5 }, give: { gauntlets: 1 }, sfx: "smith" },
  { id: "mace", station: "forge", skill: "smithing", diff: 18, label: "Mace", hint: "Six ingots, a head.", need: { ingot: 6 }, give: { mace: 1 }, sfx: "smith" },
  { id: "sword", station: "forge", skill: "smithing", diff: 20, label: "Sword", hint: "Eight ingots, an edge.", need: { ingot: 8 }, give: { sword: 1 }, sfx: "smith" },
  { id: "helm", station: "forge", skill: "smithing", diff: 22, label: "Helm", hint: "Eight ingots.", need: { ingot: 8 }, give: { helm: 1 }, sfx: "smith" },
  { id: "heater", station: "forge", skill: "smithing", diff: 24, label: "Iron shield", hint: "Eight ingots, a face.", need: { ingot: 8 }, give: { heater: 1 }, sfx: "smith" },
  { id: "greaves", station: "forge", skill: "smithing", diff: 28, label: "Greaves", hint: "Ten ingots.", need: { ingot: 10 }, give: { greaves: 1 }, sfx: "smith" },
  { id: "mail", station: "forge", skill: "smithing", diff: 36, label: "Mail", hint: "Fourteen ingots.", need: { ingot: 14 }, give: { mail: 1 }, sfx: "smith" },
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
  return true;
}

export function canMake(world: World, rec: Recipe) {
  return haveNeed(world.player.pack, rec);
}

export function missingNeed(world: World, rec: Recipe): string | null {
  for (const [k, n] of Object.entries(rec.need)) {
    const id = k as ItemId;
    const have = world.player.pack[id] ?? 0;
    if (have < (n ?? 0)) return `Need ${ITEM_META[id].label.toLowerCase()}.`;
  }
  return null;
}

export function commandCraft(world: World, recipeId: string): string | null {
  if (world.player.ghost) return "A ghost cannot.";
  const rec = recipeById(recipeId);
  if (!rec) return "No such work.";
  const here = stationsHere(world);
  if (!here.includes(rec.station)) {
    return rec.station === "forge" ? "The ore wants a fire. Raise a forge." : "The wood wants a bench. The yard, or the hall.";
  }
  const miss = missingNeed(world, rec);
  if (miss) return miss;
  for (const [k, n] of Object.entries(rec.need)) {
    const id = k as ItemId;
    world.player.pack[id] = Math.max(0, (world.player.pack[id] ?? 0) - (n ?? 0));
  }
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
