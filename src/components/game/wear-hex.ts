import type { ItemId } from "@/game/types";

/**
 * Worn-item fabric/metal colors, shared by the in-world figure
 * (people-meshes) and the You drawer's living doll — one wardrobe,
 * two mirrors. ITEM_META's fill is a CSS var for flat UI; Three.js
 * materials need real hexes.
 */
export const WEAR_HEX: Partial<Record<ItemId, string>> = {
  tunic: "#c9a36a",
  leather: "#a85a42",
  mail: "#8a8680",
  cuirass: "#6a4a32",
  hood: "#6a3a32",
  helm: "#9a9286",
  cap: "#6a4a32",
  cloak: "#a85a42",
  hose: "#4a443c",
  greaves: "#7a7670",
  boots: "#4a3228",
  gloves: "#c9a36a",
  gauntlets: "#8a8680",
  gorget: "#9a9286",
};
