// Chibi box folk — stubby legs, big blank head. Shared by people-meshes,
// the looking-glass preview, and part slot anchors so they cannot drift.
export const FIGURE = {
  foot: { size: [0.18, 0.08, 0.24] as const, x: 0.11, y: 0.04, z: 0.02 },
  leg: { size: [0.16, 0.22, 0.18] as const, x: 0.11, y: 0.19 },
  torso: { size: [0.48, 0.36, 0.3] as const, y: 0.48 },
  arm: { size: [0.13, 0.28, 0.13] as const, x: 0.32, y: 0.52 },
  armMesh: { y: -0.1 },
  hand: { size: [0.13, 0.1, 0.13] as const, y: -0.26 },
  head: { size: [0.5, 0.44, 0.44] as const, y: 0.88 },
  cloak: { size: [0.56, 0.5, 0.12] as const, y: 0.5, z: 0.18 },
  helm: { size: [0.54, 0.22, 0.5] as const, y: 1.06 },
  hood: { size: [0.54, 0.26, 0.52] as const, y: 1.06, z: -0.02 },
  belt: { size: [0.26, 0.16, 0.06] as const, y: 0.48, z: -0.16 },
} as const;

export const HAIR = {
  cap: { size: [0.54, 0.16, 0.5] as const, y: 1.14 },
  shagSide: { size: [0.12, 0.3, 0.46] as const, x: 0.26, y: 0.96 },
  shagFront: { size: [0.52, 0.28, 0.12] as const, y: 0.96, z: 0.26 },
  tail: { size: [0.18, 0.3, 0.14] as const, y: 0.88, z: 0.28 },
  long: { size: [0.52, 0.38, 0.14] as const, y: 0.86, z: 0.26 },
} as const;

/** Slot anchors in figure-local space (head top ≈ y1.10). */
export const SLOT_ANCHOR: Record<"hair" | "beard" | "back" | "trinket", { at: [number, number, number]; voxel: number }> =
  {
    hair: { at: [-0.24, 1.1, -0.22], voxel: 0.04 },
    beard: { at: [-0.24, 0.64, -0.34], voxel: 0.04 },
    back: { at: [-0.2, 0.38, 0.18], voxel: 0.04 },
    trinket: { at: [0.26, 0.72, -0.2], voxel: 0.032 },
  };
