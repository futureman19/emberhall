/** Necessary, not sufficient: keep synchronized with terrain's biome-specific flora thresholds. */
export function floraRollEligible(wooded: boolean, roll: number): boolean {
  return roll < (wooded ? 0.14 : 0.05);
}

/** Ruins keep bramble, not meadow flowers. */
export function ruinsThornInstead(flora: number): number {
  return flora >= 0 ? 0 : flora;
}

/** Extra thorn on ruin grass, beyond the vale meadow budget. */
export function ruinsExtraThorn(wooded: boolean, roll: number): boolean {
  return roll < (wooded ? 0.22 : 0.1);
}
