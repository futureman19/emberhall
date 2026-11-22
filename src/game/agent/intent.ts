/**
 * Intent wire — the ONLY way a brain acts.
 *
 * Validate before dispatching to the sim. Walk uses the same command and
 * path planner as local input; other work stays in the intent/tick pipeline.
 * No transport gets a separate movement policy or direct position writes.
 *
 * Kind set is shared with save.ts (single export) so a kind the save loader
 * would reject can never pass harness validation either.
 */
import { actorPerson, actorState } from "../actor.ts";
import { MAP } from "../atlas.ts";
import { commandWalk } from "../player.ts";
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
export function submitIntent(world: World, intent: Intent, actorId?: string): string | null {
  const actor = actorState(world, actorId);
  const err = validateIntent(world, intent);
  if (err) return err;
  if (intent.kind === "walk") {
    const body = actorPerson(world, actorId);
    if (!body) return "You are not in the vale.";
    // commandWalk clears armedSpell even on failure. Stage only its write
    // targets so rejected routes never touch live state (or need rollback).
    const plannedActor = { ...actor };
    const plannedBody = { ...body };
    const planningWorld: World = {
      ...world,
      people: world.people.map((person) => person === body ? plannedBody : person),
      player: actorId === undefined ? plannedActor : world.player,
      playerStates: actorId === undefined ? world.playerStates : {
        ...world.playerStates,
        [actorId]: plannedActor,
      },
    };
    const reason = commandWalk(planningWorld, intent.tx, intent.ty, 9000, actorId);
    if (reason) return reason;
    body.path = plannedBody.path;
    actor.intent = plannedActor.intent;
    actor.armedSpell = plannedActor.armedSpell;
    return null;
  }
  if (intent.kind === "none") {
    const body = actorPerson(world, actorId);
    if (body) body.path = [];
  }
  actor.intent = {
    kind: intent.kind,
    tx: intent.tx,
    ty: intent.ty,
    targetId: intent.targetId ?? null,
    spell: intent.spell ?? null,
  };
  return null;
}
