import { useEffect, useState } from "react";
import { Mesh, type BufferGeometry, type Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export type OakGeometry = { trunk: BufferGeometry; crown: BufferGeometry; sapling?: BufferGeometry; stump?: BufferGeometry };

/** Clone once per asset, baking all glTF ancestor transforms (including export axes). */
export function extractOakGeometry(scene: Object3D): OakGeometry {
  scene.updateMatrixWorld(true);
  const take = (name: string) => {
    const node = scene.getObjectByName(name);
    return node instanceof Mesh ? node.geometry.clone().applyMatrix4(node.matrixWorld) : undefined;
  };
  const trunk = take("oak_trunk");
  const crown = take("oak_crown");
  if (!trunk || !crown) {
    trunk?.dispose();
    crown?.dispose();
    throw new Error("Oak asset requires oak_trunk and oak_crown meshes");
  }
  return { trunk, crown, sapling: take("oak_sapling"), stump: take("oak_stump") };
}

let cached: OakGeometry | null = null;
let pending: Promise<OakGeometry> | null = null;
export function useOakGeometry() {
  const [geometry, setGeometry] = useState<OakGeometry | null>(() => cached);
  useEffect(() => {
    let active = true;
    pending ??= new GLTFLoader().loadAsync("/art/lanternwood/oak.glb").then(({ scene }) => {
      try {
        cached = extractOakGeometry(scene);
        return cached;
      } finally {
        scene.traverse(node => {
          if (!(node instanceof Mesh)) return;
          node.geometry.dispose();
          for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose();
        });
      }
    });
    void pending.then(value => { if (active) setGeometry(value); }).catch(() => {
      // Optional art must never suspend/crash terrain or hide the procedural fallback.
    });
    return () => { active = false; };
  }, []);
  return geometry;
}
