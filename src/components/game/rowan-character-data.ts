import { BufferGeometry, Mesh, MeshStandardMaterial, type Object3D } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { FIGURE, HAIR } from "../../game/look/figure.ts";

export type RowanPart = "head" | "torso" | "arm" | "hand" | "leg" | "foot" | "hair_cap" | "belt";
export type RowanDetail = { geometry: BufferGeometry; color: string; tint: "skin" | "hair" | null };
export type RowanAttachment = { geometry: BufferGeometry; details: RowanDetail[] };
export type RowanGeometry = Record<string, RowanAttachment>;

/** Convert the approved assembled rigid model to the EXISTING mesh-local anchors.
 * The source GLB and Blender project stay unchanged. Materials on primary body
 * meshes remain owned by the renderer (appearance, equipment and ghost state).
 */
export function extractRowanGeometry(scene: Object3D): RowanGeometry {
  scene.updateMatrixWorld(true);
  const buckets = new Map<string, { body: BufferGeometry[]; details: Map<string, { geometries: BufferGeometry[]; color: string; tint: RowanDetail["tint"] }> }>();
  scene.traverse(node => {
    if (!(node instanceof Mesh) || !node.name.startsWith("rowan_")) return;
    const name = node.name.slice(6);
    const material = node.material;
    if (!(material instanceof MeshStandardMaterial)) throw new Error(`Unsupported Rowan material: ${node.name}`);
    const side = /_-1(?:_|$)/.test(name) ? -1 : 1;
    let part: RowanPart;
    let anchor: [number, number, number];
    let primary = false;
    if (/^(sleeve|cuff|bracer)_/.test(name)) {
      part = "arm"; anchor = [side * FIGURE.arm.x, FIGURE.arm.y + FIGURE.armMesh.y, 0]; primary = name.startsWith("sleeve_");
    } else if (/^(palm|thumb|knuckle)_/.test(name)) {
      part = "hand"; anchor = [side * FIGURE.arm.x, FIGURE.arm.y + FIGURE.hand.y, 0]; primary = true;
    } else if (name.startsWith("trouser_")) {
      part = "leg"; anchor = [side * FIGURE.leg.x, FIGURE.leg.y, 0]; primary = true;
    } else if (/^(sole|boot)_/.test(name)) {
      part = "foot"; anchor = [side * FIGURE.foot.x, FIGURE.foot.y, FIGURE.foot.z]; primary = /^(sole_|boot_-?1$)/.test(name);
    } else if (/^(hair_crown|temple_|swept_lock_)/.test(name)) {
      part = "hair_cap"; anchor = [0, HAIR.cap.y, 0]; primary = true;
    } else if (node.parent?.name === "rowan_head" || name === "neck") {
      part = "head"; anchor = [0, FIGURE.head.y, 0]; primary = /^(face$|ear_-?1$|nose$|neck$)/.test(name);
    } else {
      part = "torso"; anchor = [0, FIGURE.torso.y, 0]; primary = /^(tunic_body|split_tail_)/.test(name);
    }
    const key = ["arm", "hand", "leg", "foot"].includes(part) ? `${part}:${side}` : part;
    let bucket = buckets.get(key);
    if (!bucket) { bucket = { body: [], details: new Map() }; buckets.set(key, bucket); }
    const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld).translate(-anchor[0], -anchor[1], -anchor[2]);
    // Merge only position/normal: source UVs are unused by this flat palette.
    const flat = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    for (const attribute of Object.keys(flat.attributes)) if (attribute !== "position" && attribute !== "normal") flat.deleteAttribute(attribute);
    if (primary) bucket.body.push(flat);
    else {
      const tint = name.startsWith("expressive_brow_") ? "hair" : /^(ear_inner_|smile_)/.test(name) ? "skin" : null;
      const color = `#${material.color.getHexString()}`;
      const detailKey = `${tint}:${color}`;
      let detail = bucket.details.get(detailKey);
      if (!detail) { detail = { geometries: [], color, tint }; bucket.details.set(detailKey, detail); }
      detail.geometries.push(flat);
    }
  });
  const result: RowanGeometry = {};
  const merge = (items: BufferGeometry[]) => {
    const geometry = mergeGeometries(items);
    items.forEach(item => item.dispose());
    if (!geometry) throw new Error("Incomplete Rowan attachment");
    geometry.userData.rowan = true;
    return geometry;
  };
  try {
    for (const [key, bucket] of buckets) {
      result[key] = { geometry: merge(bucket.body), details: [...bucket.details.values()].map(detail => ({ geometry: merge(detail.geometries), color: detail.color, tint: detail.tint })) };
      result[key].geometry.name = `rowan:${key}`;
    }
    for (const key of ["head", "torso", "hair_cap", "arm:-1", "arm:1", "hand:-1", "hand:1", "leg:-1", "leg:1", "foot:-1", "foot:1"]) {
      if (!result[key]) throw new Error(`Missing Rowan attachment: ${key}`);
    }
    // Rowan's belt is already part of the torso. Do not draw the old gold block.
    result.belt = { geometry: new BufferGeometry(), details: [] };
    result.belt.geometry.name = "rowan:belt";
    return result;
  } catch (error) {
    for (const attachment of Object.values(result)) {
      attachment.geometry.dispose(); attachment.details.forEach(detail => detail.geometry.dispose());
    }
    throw error;
  }
}
