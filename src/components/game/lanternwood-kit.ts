import { useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { lanternwoodInfluence, artNoise, noArtRaycast } from "./lanternwood-art.ts";

export type KitName = "hall" | "tree-0" | "tree-1" | "bank" | "forge";
const loads = new Map<KitName, Promise<THREE.Group>>();
/** Cache shared GPU geometry/materials; only the object hierarchy is per placement. */
export function useArtistKit(name: KitName | null): THREE.Group | null {
  const [loaded, setLoaded] = useState<{ name: KitName; scene: THREE.Group } | null>(null);
  useEffect(() => {
    if (!name) return;
    let active = true;
    let promise = loads.get(name);
    if (!promise) {
      promise = new GLTFLoader().loadAsync(`/art/lanternwood/${name}.glb`).then(gltf => gltf.scene);
      loads.set(name, promise);
    }
    void promise.then(source => {
      if (!active) return;
      const scene = source.clone(true);
      scene.traverse(o => {
        o.raycast = noArtRaycast;
        if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      scene.userData.decorative = true;
      setLoaded({ name, scene });
    }).catch(error => {
      // Keep the original presentation if an optional art asset cannot load.
      console.warn(`Lanternwood ${name} unavailable; retaining original art`, error);
      loads.delete(name);
    });
    return () => { active = false; };
  }, [name]);
  return loaded?.name === name ? loaded.scene : null;
}
export function usesBlenderHall(kind: string, x: number, z: number): boolean {
  return kind === "hall" && lanternwoodInfluence(x, z) === 1;
}
/** Small non-resource garden trees; deterministic, no gameplay RNG consumed. */
export function gardenTreeTransform(x: number, z: number) {
  return { yaw: artNoise(x, z, 701) * Math.PI * 2, scale: .68 + artNoise(x, z, 702) * .16 };
}
