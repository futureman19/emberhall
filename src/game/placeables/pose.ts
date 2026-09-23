import { PLACEABLE_BY_ID } from "./catalog.ts";
import { rotateCell } from "./placement.ts";
import type { Rotation } from "./schema.ts";
import { VOX, type Block } from "./types.ts";

export const GHOST_OK = "#c9a36a";
export const GHOST_BAD = "#a85a42";

export function ghostTint(ok: boolean) {
  return ok ? GHOST_OK : GHOST_BAD;
}

export function worldVoxels(
  definitionId: string,
  tx: number,
  ty: number,
  rotation: Rotation,
  y0: number,
  materials?: Record<string, string>,
) {
  const def = PLACEABLE_BY_ID[definitionId];
  if (!def) return [];
  return def.voxels.map((v) => {
    const [rx, rz] = rotateCell(v.x, v.z, rotation);
    const painted = materials?.[v.t] as Block | undefined;
    return {
      x: tx + (rx + 0.5) * VOX,
      y: y0 + (v.y + 0.5) * VOX,
      z: ty + (rz + 0.5) * VOX,
      t: painted ?? v.t,
    };
  });
}
