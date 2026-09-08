/** The authored figure's front is local -Z; simulation headings face local +Z. */
export function playerVisualYaw(facing: number): number {
  return facing + Math.PI;
}
