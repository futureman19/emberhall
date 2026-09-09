import { biomeWeights, type BiomeW } from "../../game/biome.ts";

/** Only static atlas/coordinate weights are cached, never mutable tile colors.
 * Recreate this cache if the biome sampler/atlas definition changes.
 * The fixed pixel grid bounds storage; world replacement needs no invalidation.
 */
export function createMinimapBiomeCache(
  mapSize: number,
  pixels: number,
  sample: (x: number, y: number) => BiomeW = biomeWeights,
) {
  if (!Number.isInteger(mapSize) || mapSize < 1 || !Number.isInteger(pixels) || pixels < 1 || pixels > 256) {
    throw new RangeError("Invalid minimap grid");
  }
  const entries = new Array<Readonly<BiomeW> | undefined>(pixels * pixels);
  const step = mapSize / pixels;
  return (px: number, py: number): Readonly<BiomeW> => {
    if (!Number.isInteger(px) || !Number.isInteger(py) || px < 0 || py < 0 || px >= pixels || py >= pixels) {
      throw new RangeError("Minimap pixel outside grid");
    }
    const index = py * pixels + px;
    return (entries[index] ??= Object.freeze({
      ...sample(Math.min(mapSize - 1, Math.floor(px * step)), Math.min(mapSize - 1, Math.floor(py * step))),
    }));
  };
}
