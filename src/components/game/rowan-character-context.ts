import { createContext, useContext, useEffect, useState } from "react";
import { Mesh } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { extractRowanGeometry, type RowanGeometry } from "./rowan-character-data.ts";

export const RowanContext = createContext<{ geometry: RowanGeometry | null; skin: string; hair: string; ghost: boolean }>({ geometry: null, skin: "#ffffff", hair: "#ffffff", ghost: false });
export const useRowan = () => useContext(RowanContext);
let cached: RowanGeometry | null = null;
let pending: Promise<RowanGeometry> | null = null;
export function useRowanGeometry(enabled: boolean) {
  const [geometry, setGeometry] = useState(cached);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    pending ??= new GLTFLoader().loadAsync("/art/character-reimagined/rowan.glb").then(({ scene }) => {
      try { cached = extractRowanGeometry(scene); return cached; }
      finally {
        scene.traverse(node => {
          if (!(node instanceof Mesh)) return;
          node.geometry.dispose();
          for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose();
        });
      }
    });
    void pending.then(value => { if (active) setGeometry(value); }).catch(() => {
      // A failed or incomplete optional model leaves the original authored body.
      // Share the rejected request: mounting parts never creates a retry storm.
    });
    return () => { active = false; };
  }, [enabled]);
  return enabled ? geometry : null;
}
