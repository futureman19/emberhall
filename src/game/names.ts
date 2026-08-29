import { pick } from "./rng";

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
