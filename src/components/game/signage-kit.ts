export type SignageKit = 'notice' | 'board';
/** Presentation routing only; construction ghosts and world generation stay original. */
export function signageKitName(kind: string, x: number, z: number): SignageKit | null {
  if (kind !== 'notice' && kind !== 'board') return null;
  return Number.isFinite(x) && Number.isFinite(z) ? kind : null;
}
