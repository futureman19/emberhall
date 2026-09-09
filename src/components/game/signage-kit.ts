import { COURT } from '../../game/atlas.ts';
export type SignageKit = 'notice' | 'board';
/** Presentation routing only; construction ghosts and world generation stay original. */
export function signageKitName(kind: string, x: number, z: number): SignageKit | null {
  if (kind !== 'notice' && kind !== 'board') return null;
  return Math.hypot(x - COURT.tx, z - COURT.ty) <= 18 ? kind : null;
}
