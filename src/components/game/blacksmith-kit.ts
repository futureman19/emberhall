import { useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { BLACKSMITH_IDS } from "@/game/placeables/kits/blacksmith";

const cache = new Map<string, Promise<THREE.Group>>();
const noPick = () => {};
function load(id: string) {
  let pending = cache.get(id);
  if (!pending) {
    pending = new GLTFLoader().loadAsync(`/art/blacksmith/${id}.glb`).then(({ scene }) => {
      scene.traverse((o) => {
        o.raycast = noPick;
        if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      return scene;
    }).catch((error: unknown) => { cache.delete(id); throw error; });
    cache.set(id, pending);
  }
  return pending;
}

/** Shares immutable cached GPU assets, but owns each placement's scene transforms. */
export function useBlacksmithScene(id: string, enabled: boolean) {
  const [loaded, setLoaded] = useState<{ id: string; scene: THREE.Group } | null>(null);
  useEffect(() => {
    if (!enabled || !(BLACKSMITH_IDS as readonly string[]).includes(id)) return;
    let alive = true;
    load(id).then((source) => {
      if (alive) setLoaded({ id, scene: source.clone(true) });
    }).catch(() => { /* Ordinary voxel presentation remains usable on failure. */ });
    return () => { alive = false; };
  }, [id, enabled]);
  return enabled && loaded?.id === id ? loaded.scene : null;
}
