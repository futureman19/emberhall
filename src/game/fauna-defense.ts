import type { FaunaKind } from "./types.ts";
/** Basalt plating resists physical strikes; spells and ailments bypass it. */
export function faunaPhysicalDamage(kind: FaunaKind, damage: number) {
  return damage <= 0 ? 0 : kind === "slag_golem" ? Math.max(1, damage - 4) : damage;
}
