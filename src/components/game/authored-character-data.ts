import { useEffect, useState } from "react";
import { Mesh, type BufferGeometry, type Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const CHARACTER_PARTS = ["head", "torso", "arm", "hand", "leg", "foot", "cloak", "helm", "hood", "belt", "hair_cap", "hair_shagSide", "hair_shagFront", "hair_tail", "hair_long"] as const;
export type CharacterPart = typeof CHARACTER_PARTS[number];
export type CharacterGeometry = Partial<Record<CharacterPart, BufferGeometry>>;

/** Bake glTF's node/ancestor axis transforms, never mutate source geometry. */
export function extractCharacterGeometry(scene: Object3D): CharacterGeometry {
  scene.updateMatrixWorld(true);
  const result: CharacterGeometry = {};
  scene.traverse(node => {
    if (!(node instanceof Mesh) || !CHARACTER_PARTS.includes(node.name as CharacterPart)) return;
    const name = node.name as CharacterPart;
    if (result[name]) return;
    result[name] = node.geometry.clone().applyMatrix4(node.matrixWorld);
  });
  return result;
}

let cached: CharacterGeometry | null = null;
let pending: Promise<CharacterGeometry> | null = null;
function loadCharacter() {
  pending ??= new GLTFLoader().loadAsync("/art/lanternwood/character.glb")
    .then(({ scene }) => {
      cached = extractCharacterGeometry(scene);
      // Only cloned geometry is used; authored materials never override appearance.
      scene.traverse(node => {
        if (!(node instanceof Mesh)) return;
        node.geometry.dispose();
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose();
      });
      return cached;
    });
  return pending;
}

/** Optional art never suspends the world. A failed load retains the box folk. */
export function useCharacterGeometry(authored: boolean) {
  const [geometry, setGeometry] = useState<CharacterGeometry | null>(() => cached);
  useEffect(() => {
    if (!authored) return;
    let active = true;
    void loadCharacter().then(value => { if (active) setGeometry(value); }).catch(() => {
      // Cache the failed request too: mounting many parts must not hammer a missing asset.
    });
    return () => { active = false; };
  }, [authored]);
  return authored ? geometry : null;
}
