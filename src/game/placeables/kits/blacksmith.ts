import type { PlaceableDefinition, Vox } from "../types.ts";

export const BLACKSMITH_IDS = ["smith_anvil", "smith_forge", "smith_trough", "smith_grindstone", "smith_rack", "smith_bellows"] as const;
const labels = ["Smith's anvil", "Banked forge", "Quench trough", "Grindstone", "Weapon rack", "Forge bellows"];
/** Decorative only: ordinary Hold placement/cost/save rules, no new crafting stations. */
export const BLACKSMITH_KIT: PlaceableDefinition[] = BLACKSMITH_IDS.map((id, i) => {
  const voxels: Vox[] = [];
  const height = id === "smith_forge" || id === "smith_rack" ? 3 : 2;
  for (let y = 0; y < height; y++) for (let x = 0; x < 2; x++) for (let z = 0; z < 2; z++) {
    if (y === 0 || z === 1) voxels.push({ x, y, z, t: id === "smith_forge" ? "stone" : y === 0 ? "timber" : "dark" });
  }
  return {
    id, schemaVersion: 1, category: "work", label: labels[i]!,
    description: "A decorative smith-yard furnishing. Does not provide a crafting station.",
    rotations: [0, 1, 2, 3], footprint: { x0: 0, x1: 1, z0: 0, z1: 1 },
    snaps: [{ x: 0, y: 0, z: 0 }], materialSlots: {}, voxels,
    cost: [{ item: "board", n: 2 }, { item: "ingot", n: 1 }],
    skill: "carpentry", station: null, weight: voxels.length,
  };
});
