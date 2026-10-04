import { BackSide, Box3, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { FaunaKind } from "@/game/types";
import { faunaArtUrl, type FaunaSpellArt } from "./fauna-art-catalog.ts";
import { noArtRaycast } from "./lanternwood-art.ts";

const loads = new Map<string, Promise<Group | null>>();
/** One network request and shared GPU resources per URL, including failed loads. */
export function loadFaunaArt(kind: FaunaKind, art?: FaunaSpellArt): Promise<Group | null> {
  const url = faunaArtUrl(kind, art);
  let pending = loads.get(url);
  if (!pending) {
    pending = new GLTFLoader().loadAsync(url)
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
    loads.set(url, pending);
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

function desat(r: number, g: number, b: number): [number, number, number] {
  const l = 0.21 * r + 0.72 * g + 0.07 * b;
  return [l * 0.62 + 0.08, l * 0.70 + 0.10, l * 0.82 + 0.16];
}

function risenMaterial(source: Mesh["material"]): MeshStandardMaterial {
  const base = Array.isArray(source) ? source[0] : source;
  const m = base instanceof MeshStandardMaterial ? base.clone() : new MeshStandardMaterial();
  if (base instanceof MeshStandardMaterial) {
    const [r, g, b] = desat(base.color.r, base.color.g, base.color.b);
    m.color.setRGB(r, g, b);
  } else {
    m.color.setRGB(0.42, 0.50, 0.58);
  }
  m.emissive.set("#6e8494");
  m.emissiveIntensity = 0.2;
  m.roughness = 0.96;
  m.metalness = 0.04;
  m.transparent = true;
  m.opacity = 0.78;
  m.vertexColors = true;
  return m;
}

/** Visual-only. Unique materials/geometry so the shared species cache stays living. */
export function applyRisenLook(scene: Group): Group {
  const marker = new Group();
  marker.name = "risen-ghost-edge";
  scene.add(marker);
  const meshes: Mesh[] = [];
  scene.traverse((object) => { if (object instanceof Mesh) meshes.push(object); });
  for (const object of meshes) {
    const geom = object.geometry.clone();
    const color = geom.getAttribute("color");
    if (color) {
      const next = color.clone();
      for (let i = 0; i < next.count; i++) {
        const [r, g, b] = desat(next.getX(i), next.getY(i), next.getZ(i));
        next.setXYZ(i, r, g, b);
      }
      geom.setAttribute("color", next);
    }
    object.geometry = geom;
    object.material = risenMaterial(object.material);
    const halo = new Mesh(geom, new MeshBasicMaterial({
      color: "#b7c8d4",
      transparent: true,
      opacity: 0.28,
      side: BackSide,
      depthWrite: false,
    }));
    halo.name = "risen-ghost-edge";
    halo.raycast = noArtRaycast;
    halo.scale.setScalar(1.08);
    object.add(halo);
  }
  scene.rotation.z = 0.06;
  scene.rotation.x = 0.035;
  return scene;
}
