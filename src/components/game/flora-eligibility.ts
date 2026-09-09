/** Necessary, not sufficient: keep synchronized with terrain's biome-specific flora thresholds. */
export function floraRollEligible(wooded: boolean, roll: number): boolean {
  return roll < (wooded ? 0.14 : 0.05);
}
