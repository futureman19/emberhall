/**
 * Intent wire — the ONLY way a brain acts.
 *
 * The sim's own pipeline already executes intents (`world.player.intent`,
 * same field the UI writes on click). The harness never calls `command*`
 * directly and never writes pack/state: it validates, then submits to the
 * same pipeline. Server-authoritative for free once the host owns the tick.
 *
 * Kind set is shared with save.ts (single export) so a kind the save loader
 * would reject can never pass harness validation either.
 */
import { MAP } from "../atlas.ts";
import { INTENT_KINDS } from "../save.ts";
import type { Intent, World } from "../types.ts";

/** Shape + bounds only. Reach, legality, and failure messages stay the
 *  sim's job — the pipeline already walks toward distant targets and
 *  refuses impossible work with its own log lines. */
export function validateIntent(world: World, intent: Intent): string | null {
  if (!intent || typeof intent !== "object") return "intent is not an object";
  if (!INTENT_KINDS.has(intent.kind)) return `unknown intent kind: ${String(intent.kind)}`;
  if (!Number.isInteger(intent.tx) || !Number.isInteger(intent.ty)) {
    return "intent target must be integer tile coords";
  }
  if (intent.tx < 0 || intent.ty < 0 || intent.tx >= MAP || intent.ty >= MAP) {
    return `intent target (${intent.tx},${intent.ty}) is outside the map`;
  }
  if (intent.targetId !== null && typeof intent.targetId !== "string") {
    return "targetId must be a string or null";
  }
  if (intent.spell !== null && typeof intent.spell !== "string") {
    return "spell must be a SpellId or null";
  }
  void world; // reserved for actor-scoped checks after the multi-body refactor
  return null;
}

/** Validate, then hand to the sim pipeline. Returns null on accept, a
 *  one-line reason on reject. Reject NEVER mutates the world. */
export function submitIntent(world: World, intent: Intent): string | null {
  const err = validateIntent(world, intent);
  if (err) return err;
  world.player.intent = {
    kind: intent.kind,
    tx: intent.tx,
    ty: intent.ty,
    targetId: intent.targetId ?? null,
    spell: intent.spell ?? null,
  };
  return null;
}
