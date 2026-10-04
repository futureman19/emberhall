import { useEffect, useMemo, useState } from "react";
import { Mesh, type BufferGeometry, type Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { extractOakGeometry, useOakGeometry, type OakGeometry } from "./oak-renderer-data.ts";
import { TIMBER_IDS, timberAssetUrl, type TimberId } from "./timber-renderer-policy.ts";

export type TimberGeometry = OakGeometry & { saplingTrunk?: BufferGeometry; saplingCrown?: BufferGeometry };
export type TimberGeometryCache = Partial<Record<TimberId, TimberGeometry>>;
/** Bake glTF ancestry once. New exports are ground assembled; preserve the existing terrain part anchors. */
export function extractTimberGeometry(scene: Object3D, id: TimberId): TimberGeometry {
  if (id === "oak") return extractOakGeometry(scene);
  scene.updateMatrixWorld(true);
  const geometries: BufferGeometry[] = [];
  const take = (part: string, offset = 0) => {
    const node = scene.getObjectByName(`${id}_${part}`);
    if (!(node instanceof Mesh)) throw new Error(`${id} requires ${part} mesh`);
    const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld).translate(0, offset, 0);
    geometries.push(geometry);
    const position = geometry.getAttribute("position");
    for (const value of position.array) if (!Number.isFinite(value)) throw new Error(`${id} nonfinite geometry`);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  };
  try {
    return { trunk: take("trunk", -1.05), crown: take("crown", -2.95), stump: take("stump"), saplingTrunk: take("sapling_trunk"), saplingCrown: take("sapling_crown") };
  } catch (error) {
    geometries.forEach(g => g.dispose());
    throw error;
  }
}

let cached: TimberGeometryCache = {};
const pending = new Map<TimberId, Promise<TimberGeometry>>();
/** Shared immutable snapshot, independent failure per species. No suspense or resource writes. */
export function useTimberGeometry() {
  const oak = useOakGeometry();
  const [loaded, setLoaded] = useState(() => cached);
  useEffect(() => {
    let active = true;
    for (const id of TIMBER_IDS) {
      if (id === "oak") continue;
      if (!pending.has(id)) pending.set(id, new GLTFLoader().loadAsync(timberAssetUrl(id)).then(({ scene }) => {
        try {
          const geometry = extractTimberGeometry(scene, id);
          cached = { ...cached, [id]: geometry };
          return geometry;
        } finally {
          scene.traverse(node => {
            if (!(node instanceof Mesh)) return;
            node.geometry.dispose();
            for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose();
          });
        }
      }));
      void pending.get(id)!.then(() => { if (active) setLoaded(cached); }).catch(() => {
        // Keep the original geometry and its exact target on loading/validation failure.
      });
    }
    return () => { active = false; };
  }, []);
  return useMemo<TimberGeometryCache>(() => oak ? { ...loaded, oak } : loaded, [loaded, oak]);
}
