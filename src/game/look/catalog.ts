// The look catalog — the palette of selves the looking glass offers.
// Every hex answers to the vale's existing vocabulary (people-meshes.tsx).
// Labels are player-facing; ids are frozen once shipped.
import type { HairStyleId, LookRecipeV1 } from "./types.ts";

export interface Swatch {
  id: string;
  hex: string;
  label: string;
}

export const SKIN_TONES: readonly Swatch[] = [
  { id: "dawn", hex: "#e3d7c6", label: "Dawn" },
  { id: "vale", hex: "#c9c3b6", label: "Vale" },
  { id: "field", hex: "#b5a48d", label: "Field" },
  { id: "ember", hex: "#96795d", label: "Ember" },
  { id: "bark", hex: "#6f5240", label: "Bark" },
  { id: "night", hex: "#4a352a", label: "Night" },
] as const;

export const HAIR_COLORS: readonly Swatch[] = [
  { id: "wood", hex: "#2e241c", label: "Dark wood" },
  { id: "loam", hex: "#3a322c", label: "Loam" },
  { id: "chestnut", hex: "#5a4a3a", label: "Chestnut" },
  { id: "oak", hex: "#8a6a4a", label: "Oak" },
  { id: "sandy", hex: "#a8894a", label: "Sandy" },
  { id: "ash", hex: "#c9c3b6", label: "Ash" },
  { id: "steel", hex: "#8a8680", label: "Steel" },
  { id: "auburn", hex: "#a85a42", label: "Auburn" },
] as const;

export const GARB_TINTS: readonly Swatch[] = [
  { id: "rust", hex: "#a85a42", label: "Rust" },
  { id: "ranger", hex: "#6a7a48", label: "Ranger green" },
  { id: "warrior", hex: "#8a6a4a", label: "Warrior brown" },
  { id: "mage", hex: "#6a5a78", label: "Mage purple" },
  { id: "rogue", hex: "#5a5a52", label: "Rogue grey" },
  { id: "merchant", hex: "#a88848", label: "Merchant gold" },
  { id: "slate", hex: "#4a6a7a", label: "Slate blue" },
  { id: "berry", hex: "#7a4a5a", label: "Berry" },
] as const;

export const HAIR_STYLES: readonly { id: HairStyleId; label: string; hint: string }[] = [
  { id: "bald", label: "Bare", hint: "The wind knows your thoughts." },
  { id: "crop", label: "Crop", hint: "Short and sensible." },
  { id: "shag", label: "Shag", hint: "Unbothered by combs." },
  { id: "tail", label: "Tail", hint: "Tied back for the road." },
  { id: "long", label: "Long", hint: "Down past the shoulders." },
] as const;

// Bit-for-bit parity with people-meshes.tsx today:
// SKIN #c9c3b6, HAIR #3a322c, player chest #a85a42.
export const DEFAULT_LOOK = {
  skin: "#c9c3b6",
  hairStyle: "crop",
  hairColor: "#3a322c",
  garb: "#a85a42",
} as const satisfies Required<Omit<LookRecipeV1, "schema" | "cls">>;
