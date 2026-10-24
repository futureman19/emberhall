import { RESOURCE_CATALOG } from '../../game/resources/catalog.ts';
import { ITEM_FORM_CATALOG } from '../../game/crafting/forms.ts';
import type { RareItem } from '../../game/types.ts';

/** Shared appearance for world, paperdoll and camera-held forged weapons. */
export function exactWeaponSurfaces(id: 'dagger' | 'spear' | 'war_axe', item?: RareItem | null) {
  const matching = item?.base === id && item.formId === id ? item : null;
  const edge = matching?.components?.find(c => c.role === 'edge');
  const hilt = matching?.components?.find(c => c.role === 'hilt');
  const metal = edge && RESOURCE_CATALOG[edge.resourceId];
  const timber = hilt && RESOURCE_CATALOG[hilt.resourceId];
  const inlay = matching?.inlays?.[0];
  const gem = inlay && RESOURCE_CATALOG[inlay.resourceId];
  const allowed = gem?.traitIds.some(t => ITEM_FORM_CATALOG[id].allowedGemFamilies.some(f => f === t));
  return {
    edge: { color: metal?.kind === 'ore' ? metal.visual.primary : '#c9c3b6', metalness: .65,
      roughness: edge ? ({ rough: .5, sound: .34, choice: .26, pristine: .18 })[edge.grade] : .34 },
    hilt: { color: timber?.kind === 'timber' ? timber.visual.primary : '#5a3e28', roughness: .8 },
    gem: gem && allowed ? { color: gem.visual.primary, metalness: .2, roughness: .16 } : null,
  };
}

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
