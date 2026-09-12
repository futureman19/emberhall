/**
 * The approved character kit is the world-wide presentation default.
 * Keep this boundary independent of home, role, class and wandering position:
 * appearance colors, equipment and custom parts remain owned by Figure.
 */
export function civicCharacterArt(_person: {
  isPlayer: boolean; role: string | null; home: { tx: number; ty: number } | null;
}): boolean {
  return true;
}

/** Approved Blender character front is local -Z; simulation facing is +Z. */
export function civicVisualYaw(facing: number, authored: boolean): number {
  return authored ? facing + Math.PI : facing;
}
