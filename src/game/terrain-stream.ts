import { CHUNK, VIEW } from "./atlas.ts";

/**
 * Keep the streamed terrain window on stable world chunks. The extra chunk of
 * total width is a symmetric buffer, so the complete VIEW radius remains
 * rendered while the player moves between adjacent chunk centers.
 */
export const TERRAIN_STREAM_SPAN = CHUNK * 2;
export const TERRAIN_STREAM_WINDOW = VIEW + TERRAIN_STREAM_SPAN;

export function terrainStreamOrigin(position: number) {
  if (!Number.isFinite(position)) return 0;
  return Math.round(position / TERRAIN_STREAM_SPAN) * TERRAIN_STREAM_SPAN;
}
