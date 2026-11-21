import type { PlayerState, World } from "./types.ts";

/** No id keeps the solo contract. Explicit ids never fall back to the player. */
export function actorState(world: World, actorId?: string): PlayerState {
  if (actorId === undefined) return world.player;
  const states = world.playerStates;
  const state = states && Object.hasOwn(states, actorId) ? states[actorId] : undefined;
  if (!state || state.id !== actorId) throw new Error(`Unknown actor: ${actorId}`);
  return state;
}

/** Preserve legacy isPlayer-first selection only for the omitted-id path. */
export function actorPerson(world: World, actorId?: string) {
  const state = actorState(world, actorId);
  return (actorId === undefined ? world.people.find((p) => p.isPlayer) : undefined)
    ?? world.people.find((p) => p.id === state.id) ?? null;
}
