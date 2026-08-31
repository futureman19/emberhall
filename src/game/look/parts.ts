// Custom voxel parts — `emberhall.part/1`.
//
// A part is a small sculpture of cubes that attaches to a slot on the vale's
// boxy figures (hair, beard, back, trinket). Pure data, sparse voxel list,
// mint-ready for the launch flip (Phase 5). Local-first per the beta rule:
// parts live in localStorage until the save wiring lands at merge.
import type { LookRecipeV1 } from "./types.ts";

export const PART_SCHEMA = "emberhall.part/1" as const;
export const PART_GRID = 8; // 8×8×8 voxels
export const PART_MAX_VOXELS = 160;
export const PART_MAX_COLORS = 16;

export type PartSlot = "hair" | "beard" | "back" | "trinket";
export type PartRarity = "common" | "uncommon" | "rare" | "masterwork";
export const PART_SLOTS: readonly PartSlot[] = ["hair", "beard", "back", "trinket"] as const;

export interface Voxel {
  x: number;
  y: number;
  z: number;
  c: string;
}

export interface VoxelPartV1 {
  schema: typeof PART_SCHEMA;
  id: string;
  name: string;
  slot: PartSlot;
  voxels: Voxel[];
  createdAt: number;
  /** Crafted identity; optional only for pre-Phase-5 local parts. */
  author?: string;
  rarity?: PartRarity;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const int = (n: number) => Number.isInteger(n) && n >= 0 && n < PART_GRID;

export function validatePart(p: VoxelPartV1): string[] {
  const errs: string[] = [];
  if (p.schema !== PART_SCHEMA) errs.push(`schema must be ${PART_SCHEMA}`);
  if (!p.id || p.id.length < 4) errs.push("id missing");
  if (!p.name.trim()) errs.push("name the part");
  if (!PART_SLOTS.includes(p.slot)) errs.push(`unknown slot ${p.slot}`);
  if (p.voxels.length === 0) errs.push("place at least one voxel");
  if (p.voxels.length > PART_MAX_VOXELS) errs.push(`at most ${PART_MAX_VOXELS} voxels`);
  const seen = new Set<string>();
  const colors = new Set<string>();
  for (const v of p.voxels) {
    if (!int(v.x) || !int(v.y) || !int(v.z)) errs.push(`voxel out of bounds (${v.x},${v.y},${v.z})`);
    if (!HEX.test(v.c)) errs.push(`bad color ${v.c}`);
    const key = `${v.x},${v.y},${v.z}`;
    if (seen.has(key)) errs.push(`duplicate voxel at ${key}`);
    seen.add(key);
    colors.add(v.c.toLowerCase());
  }
  if (colors.size > PART_MAX_COLORS) errs.push(`at most ${PART_MAX_COLORS} colors`);
  if (p.author !== undefined && (!p.author.trim() || p.author.length > 24)) errs.push("author must be 1–24 characters");
  if (p.rarity !== undefined && !["common", "uncommon", "rare", "masterwork"].includes(p.rarity)) errs.push("unknown rarity");
  return errs;
}

/** Stable identity from sculptural complexity; never randomly rerolled. */
export function partRarity(part: Pick<VoxelPartV1, "voxels">): PartRarity {
  const colors = new Set(part.voxels.map(({ c }) => c.toLowerCase())).size;
  const score = part.voxels.length + colors * 4;
  if (score >= 112) return "masterwork";
  if (score >= 64) return "rare";
  if (score >= 28) return "uncommon";
  return "common";
}

export function newPartId(): string {
  return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// — registry (localStorage in the browser, memory shim under tests) —

interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const KEY = "emberhall.parts";
const memory = new Map<string, string>();
const store: Store =
  typeof localStorage !== "undefined"
    ? localStorage
    : { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v) };

let cache: VoxelPartV1[] | null = null; // renderers ask every frame; parse once

export function listParts(): VoxelPartV1[] {
  if (cache) return cache;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return (cache = []);
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return (cache = []);
    return (cache = arr.filter((part): part is VoxelPartV1 => {
      try {
        return validatePart(part as VoxelPartV1).length === 0;
      } catch {
        return false;
      }
    }));
  } catch {
    return (cache = []);
  }
}

export function savePart(p: VoxelPartV1): VoxelPartV1[] {
  const errs = validatePart(p);
  if (errs.length) throw new Error(errs.join("; "));
  const all = [...listParts().filter((q) => q.id !== p.id), p];
  store.setItem(KEY, JSON.stringify(all));
  cache = all;
  return all;
}

export function removePart(id: string): VoxelPartV1[] {
  const all = listParts().filter((p) => p.id !== id);
  store.setItem(KEY, JSON.stringify(all));
  cache = all;
  return all;
}

export function partsById(ids: string[] | undefined): VoxelPartV1[] {
  if (!ids?.length) return [];
  const all = new Map(listParts().map((p) => [p.id, p]));
  return ids.map((id) => all.get(id)).filter((p): p is VoxelPartV1 => Boolean(p));
}

// Slot anchors in figure-local space (head top ≈ y1.12; see people-meshes.tsx).
export const SLOT_ANCHOR: Record<PartSlot, { at: [number, number, number]; voxel: number }> = {
  hair: { at: [-0.16, 1.12, -0.16], voxel: 0.04 },
  beard: { at: [-0.16, 0.72, -0.3], voxel: 0.04 },
  back: { at: [-0.16, 0.34, 0.15], voxel: 0.04 },
  trinket: { at: [0.18, 0.86, -0.16], voxel: 0.032 },
};

// LookRecipeV1.parts carries part ids (optional — never bumps the save).
export function partIdsOf(look: LookRecipeV1 | undefined | null): string[] {
  return look?.parts?.filter((id): id is string => typeof id === "string") ?? [];
}
