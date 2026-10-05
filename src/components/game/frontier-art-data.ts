import { Box3, Group, Mesh } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loads = new Map<string, Promise<Group | null>>();
/** One request per distinct asset, including failures; only nearby placements request art. */
export function loadFrontierArt(url: string): Promise<Group | null> {
  let pending = loads.get(url);
  if (!pending) {
    pending = new GLTFLoader()
      .loadAsync(url)
      .then(({ scene }) => {
        const box = new Box3().setFromObject(scene);
        if (box.isEmpty() || ![...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite))
          throw new Error("Invalid frontier art");
        return scene;
      })
      .catch(() => null);
    loads.set(url, pending);
  }
  return pending;
}

export function cloneFrontierArt(source: Group): Group {
  const scene = source.clone(true);
  scene.traverse((o) => {
    o.raycast = () => {};
    if (o instanceof Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return scene;
}
