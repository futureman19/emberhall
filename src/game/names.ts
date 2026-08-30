import { pick } from "./rng.ts";

const GIVEN = [
  "Neris", "Fen", "Ione", "Brann", "Wren", "Pell", "Odra", "Calder", "Mira", "Tamsin",
  "Rowan", "Sable", "Edric", "Lute", "Ysolde", "Harth", "Kip", "Aelis", "Tor", "Nessa",
];
const SURNAMES = [
  "Crowe", "Moss", "Hale", "Reed", "Ash", "Vale", "Thorn", "Pike", "Wain", "Holt",
  "Quill", "Bramble", "Dusk", "Flint", "Marsh",
];

export function personName(rng: () => number) {
  return `${pick(rng, GIVEN)} ${pick(rng, SURNAMES)}`;
}

/** Companion names — gentler than the folk of the vale. */
const PET_NAMES = [
  "Bramble", "Cinder", "Moss", "Pippin", "Rye", "Soot", "Tansy", "Willow",
  "Nettle", "Barley", "Cricket", "Fen", "Thistle", "Ash", "Burrow", "Wisp",
];

/** A name no other companion of yours carries yet. */
export function pickPetName(rng: () => number, taken: Set<string>): string {
  for (let i = 0; i < 24; i++) {
    const n = pick(rng, PET_NAMES);
    if (!taken.has(n)) return n;
  }
  return `${pick(rng, PET_NAMES)} ${pick(rng, GIVEN)}`;
}
