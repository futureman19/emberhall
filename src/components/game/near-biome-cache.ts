import { COURT, placeById } from "../../game/atlas.ts";
import { biomeWeights, type BiomeW } from "../../game/biome.ts";

/** One mounted near-ground grid; begin once before each synchronous rebuild. */
export function createNearBiomeCache(capacity: number) {
  if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error("Invalid biome cache capacity");
  const slots: ({ x: number; z: number; weights: Readonly<BiomeW> } | undefined)[] = new Array(capacity);
  let key: unknown[] = [];
  let size = 0;
  return {
    get size() { return size; },
    begin(world: object) {
      const next: unknown[] = [world, biomeWeights, COURT.tx, COURT.ty];
      for (const id of ["ridgewatch", "wolfhollow", "hearthfen", "brinegate", "southmere"]) {
        const place = placeById(id);
        next.push(place.tx, place.ty);
      }
      if (key.length !== next.length || next.some((value, i) => !Object.is(value, key[i]))) {
        slots.fill(undefined);
        size = 0;
        key = next;
      }
    },
    sample(slot: number, x: number, z: number): Readonly<BiomeW> {
      if (!Number.isSafeInteger(slot) || slot < 0 || slot >= capacity || !Number.isFinite(x) || !Number.isFinite(z)) {
        throw new Error("Invalid biome cache sample");
      }
      const prior = slots[slot];
      if (prior && Object.is(prior.x, x) && Object.is(prior.z, z)) return prior.weights;
      const weights = Object.freeze(biomeWeights(x, z));
      if (!prior) size++;
      slots[slot] = { x, z, weights };
      return weights;
    },
  };
}
