import { COURT } from '../../game/atlas.ts';

/** Stable home-based scope: wandering never changes an NPC's visual family. */
export function civicCharacterArt(p: {
  isPlayer: boolean; role: string | null; home: { tx: number; ty: number } | null;
}): boolean {
  if (p.isPlayer) return true;
  return p.home !== null && ['banker', 'provisioner', 'healer'].includes(p.role ?? '') &&
    Math.hypot(p.home.tx - COURT.tx, p.home.ty - COURT.ty) <= 18;
}

/** Approved Blender character front is local -Z; simulation facing is +Z. */
export function civicVisualYaw(facing: number, authored: boolean): number {
  return authored ? facing + Math.PI : facing;
}
