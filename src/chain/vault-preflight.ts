import type { World } from "../game/types.ts";
import { applyRedeem, decodeItemInscription } from "../game/vault.ts";
import { encodeSave } from "../game/save.ts";

/** Reject invalid identity/duplicates/unsaveable outcomes before any signature request. */
export function preflightItemRedeem(world: World, raw: unknown): void {
  if (world.player.ghost) throw new Error("A ghost cannot redeem.");
  const payload = decodeItemInscription(raw);
  if (!payload) throw new Error("This Vault inscription is invalid or unsupported.");
  const projected = structuredClone(world);
  applyRedeem(projected, payload.item, payload.rare);
  encodeSave(projected);
}
