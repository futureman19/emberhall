import { Group, Mesh, Box3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { FaunaKind } from "@/game/types";
import { FAUNA_ART_URLS } from "./fauna-art-catalog.ts";
import { noArtRaycast } from "./lanternwood-art.ts";

const loads = new Map<FaunaKind, Promise<Group | null>>();
/** One network request and shared GPU resources per species, including failed loads. */
export function loadFaunaArt(kind: FaunaKind): Promise<Group | null> {
  let pending = loads.get(kind);
  if (!pending) {
    pending = new GLTFLoader().loadAsync(FAUNA_ART_URLS[kind])
      .then(({ scene }) => {
        const bounds = new Box3().setFromObject(scene);
        if (bounds.isEmpty() || ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)) {
          throw new Error(`Invalid fauna geometry: ${kind}`);
        }
        return scene;
      })
      .catch((error: unknown) => {
        console.warn(`Fauna ${kind} unavailable; retaining original body`, error);
        return null;
      });
    loads.set(kind, pending);
  }
  return pending;
}

/** Clones transforms only; source geometry and materials remain shared. */
export function cloneFaunaArt(source: Group): Group {
  const scene = source.clone(true);
  scene.name = `authored-${source.name || "fauna"}`;
  scene.userData.decorative = true;
  scene.traverse((object) => {
    object.raycast = noArtRaycast;
    if (object instanceof Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return scene;
}

