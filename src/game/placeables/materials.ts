import type { Block } from "./types.ts";

export const PALETTE: Record<
  Block,
  { color: string; roughness: number; metalness: number; opacity: number; emissive?: string; emissiveIntensity?: number }
> = {
  timber: { color: "#6a4a32", roughness: 0.9, metalness: 0, opacity: 1 },
  dark: { color: "#3a2818", roughness: 0.88, metalness: 0, opacity: 1 },
  cobble: { color: "#7a746c", roughness: 0.92, metalness: 0, opacity: 1 },
  wool: { color: "#a85a42", roughness: 0.78, metalness: 0, opacity: 1 },
  gold: { color: "#c9a36a", roughness: 0.42, metalness: 0.35, opacity: 1 },
  glass: { color: "#ece6d8", roughness: 0.2, metalness: 0.05, opacity: 0.42 },
  thatch: { color: "#8a7048", roughness: 0.94, metalness: 0, opacity: 1 },
  stone: { color: "#9a9286", roughness: 0.9, metalness: 0, opacity: 1 },
  coal: { color: "#141210", roughness: 0.95, metalness: 0, opacity: 1 },
  soil: { color: "#4a3424", roughness: 0.96, metalness: 0, opacity: 1 },
  leaf: { color: "#5a7040", roughness: 0.88, metalness: 0, opacity: 1 },
};
