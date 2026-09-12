export type EquipmentSurface = {
  color: string; metalness?: number; roughness?: number;
  emissive?: string; emissiveIntensity?: number; ghostIntensity?: number;
};
/** Explicit both directions: R3F reuses materials across invisibility changes. */
export function equipmentMaterial(ghost: boolean, surface: EquipmentSurface) {
  return {
    color: ghost ? '#ece6d8' : surface.color,
    metalness: ghost ? 0 : (surface.metalness ?? 0),
    roughness: ghost ? .4 : (surface.roughness ?? 1),
    emissive: ghost ? '#c9c3b6' : (surface.emissive ?? '#000000'),
    emissiveIntensity: ghost ? (surface.ghostIntensity ?? .55) : (surface.emissiveIntensity ?? 1),
    opacity: ghost ? .58 : 1,
    transparent: ghost,
    depthWrite: !ghost,
  };
}
