/**
 * Reflex events — the trigger vocabulary that decides when a body thinks.
 *
 * Phase 3 contract (docs/agent-harness-contract.md §5): reflexes fire on
 * events, never on a polling timer. The host shell (src/server, Phase 2)
 * pushes one Observation per body per tick over WS (welcome + obs frames,
 * hash-gated — ws.ts); the solo-vale driver can push the same shape via
 * autopilot.step. `deriveEvents` diffs consecutive pushed observations into
 * discrete triggers; the scheduler is purely push-driven — it contains no
 * timers and never polls; if nothing changes, nothing fires.
 *
 * Trigger classes:
 * - survival: fire through the quiet window and are never dropped silently
 *   (deferred at most one push by cooldown/concurrency bounds).
 * - normal:   dropped during the quiet window (22:00–06:00 default cadence).
 *
 * Thresholds are sim-derived where the sim has a rule (hp from combat/poison)
 * and from sim.ts decay (hunger 3.2 and energy 2.4 per vale hour).
 * Crossings remain useful diagnostics; risk.ts selects paid admission and
 * also detects unresolved danger from the current observation.
 */
import type { Observation } from "./types.ts";

export type ReflexEventKind =
  | "boot"
  | "danger.unresolved"
  | "activity.heartbeat"
  | "vitals.hp_drop"
  | "vitals.hp_critical"
  | "vitals.hunger_low"
  | "vitals.hunger_critical"
  | "vitals.energy_low"
  | "vitals.energy_critical"
  | "vitals.ghost"
  | "vitals.resurrected"
  | "danger.hostile_engaged"
  | "danger.hostile_gone"
  | "activity.idle"
  | "world.nightfall"
  | "world.daybreak"
  | "world.weather_shift"
  | "social.person_arrived"
  | "social.fauna_arrived"
  | "opportunity.pile_arrived";

export interface ReflexEvent {
  kind: ReflexEventKind;
  /** Survival events bypass the quiet window and are retained across cooldown. */
  survival: boolean;
  /** One-line human detail for logs and replay tooling. */
  detail: string;
}

export interface EventDeriveConfig {
  /** hp/maxHp at or below this fraction raises hp_critical on crossing. */
  hpCriticalFraction: number;
  /** Hunger/energy warning and critical crossings; see risk cadence docs. */
  hungerLow: number;
  hungerCritical: number;
  energyLow: number;
  energyCritical: number;
  /** Unowned fauna within this many tiles on task "fight" counts as engaged. */
  hostileRadius: number;
  /** Consecutive movement-free pushes after an action that count as idle. */
  idleStasisPushes: number;
}

export const DEFAULT_EVENT_CONFIG: EventDeriveConfig = {
  hpCriticalFraction: 0.25,
  hungerLow: 25,
  hungerCritical: 10,
  energyLow: 25,
  energyCritical: 10,
  hostileRadius: 8,
  idleStasisPushes: 3,
};

/**
 * Tick-independent digest of the decision surface. The contract's
 * hashObservation includes the tick — right for a replay key, wrong for
 * dedupe, since it never repeats. Dedupe needs "same situation, different
 * tick" to collapse, so this digest covers the body sheet, the verb menu,
 * and nearby entity ids/tasks only. Both digests travel on attempt records.
 */
export function surfaceDigest(obs: Observation): string {
  const nearby = [
    ...obs.people.map((p) => `p:${p.id}`),
    ...obs.fauna.map((f) => `f:${f.id}:${f.task}`),
    ...obs.piles.map((p) => `l:${p.id}`),
  ].sort();
  const s = JSON.stringify({
    you: obs.you,
    verbs: obs.verbs.map((v) => `${v.verb}@${v.target.id}`),
    nearby,
    night: obs.isNight,
    weather: obs.weather.kind,
  });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export interface DeriveState {
  prev: Observation | null;
  /** Movement stasis bookkeeping for activity.idle. */
  stasis: number;
  lastX: number;
  lastZ: number;
  /** True once the driver has acted at least once; idle only fires armed. */
  idleArmed: boolean;
  /** Ids currently in view (arrived-events diff against the last push). */
  seenPeople: Set<string>;
  seenFauna: Set<string>;
  seenPiles: Set<string>;
  seenHostiles: Set<string>;
}

export function createDeriveState(): DeriveState {
  return {
    prev: null,
    stasis: 0,
    lastX: 0,
    lastZ: 0,
    idleArmed: false,
    seenPeople: new Set(),
    seenFauna: new Set(),
    seenPiles: new Set(),
    seenHostiles: new Set(),
  };
}

function hostileIds(obs: Observation, radius: number, youId: string): Set<string> {
  const out = new Set<string>();
  for (const f of obs.fauna) {
    if (f.task !== "fight") continue;
    if (f.ownerId !== null && f.ownerId === youId) continue;
    if (f.dist <= radius) out.add(f.id);
  }
  return out;
}

/** The driver acted on the body; re-arm idle detection from zero stasis. */
export function noteAction(state: DeriveState): void {
  state.idleArmed = true;
  state.stasis = 0;
}

/**
 * Diff two consecutive pushed observations into discrete events.
 * Pure apart from advancing the caller-owned DeriveState.
 */
export function deriveEvents(
  state: DeriveState,
  obs: Observation,
  config: EventDeriveConfig = DEFAULT_EVENT_CONFIG,
): ReflexEvent[] {
  const prev = state.prev;
  const events: ReflexEvent[] = [];
  const push = (kind: ReflexEventKind, survival: boolean, detail: string) =>
    events.push({ kind, survival, detail });

  if (prev === null) {
    // First observation after (re)start: the body needs an initial decision
    // or it stands forever. One-shot per session — not a periodic poll.
    push("boot", false, "autopilot engaged");
  } else {
    if (obs.you.hp < prev.you.hp) {
      push("vitals.hp_drop", true, `hp ${prev.you.hp} -> ${obs.you.hp}`);
    }
    const wasCrit = prev.you.hp <= prev.you.maxHp * config.hpCriticalFraction;
    const isCrit = obs.you.hp <= obs.you.maxHp * config.hpCriticalFraction;
    if (!wasCrit && isCrit) {
      push("vitals.hp_critical", true, `hp ${obs.you.hp}/${obs.you.maxHp}`);
    }
    if (prev.you.hunger > config.hungerLow && obs.you.hunger <= config.hungerLow) {
      push("vitals.hunger_low", false, `hunger ${prev.you.hunger} -> ${obs.you.hunger}`);
    }
    if (prev.you.hunger > config.hungerCritical && obs.you.hunger <= config.hungerCritical) {
      push("vitals.hunger_critical", true, `hunger ${obs.you.hunger}`);
    }
    if (prev.you.energy > config.energyLow && obs.you.energy <= config.energyLow) {
      push("vitals.energy_low", false, `energy ${prev.you.energy} -> ${obs.you.energy}`);
    }
    if (prev.you.energy > config.energyCritical && obs.you.energy <= config.energyCritical) {
      push("vitals.energy_critical", true, `energy ${obs.you.energy}`);
    }
    if (!prev.you.ghost && obs.you.ghost) push("vitals.ghost", true, "body died");
    if (prev.you.ghost && !obs.you.ghost) push("vitals.resurrected", true, "body lives");

    if (!prev.isNight && obs.isNight) push("world.nightfall", false, `hour ${obs.hour}`);
    if (prev.isNight && !obs.isNight) push("world.daybreak", false, `hour ${obs.hour}`);
    if (prev.weather.kind !== obs.weather.kind) {
      push("world.weather_shift", false, `${prev.weather.kind} -> ${obs.weather.kind}`);
    }

    // Movement stasis: a body that stopped moving after acting wants a
    // fresh decision — one event per action, re-armed by noteAction.
    const moved = obs.you.x !== state.lastX || obs.you.z !== state.lastZ;
    state.stasis = moved ? 0 : state.stasis + 1;
    if (state.idleArmed && state.stasis >= config.idleStasisPushes) {
      state.idleArmed = false;
      push("activity.idle", false, "body standing idle");
    }
  }
  state.lastX = obs.you.x;
  state.lastZ = obs.you.z;

  const peopleNow = new Set(obs.people.map((p) => p.id));
  for (const id of peopleNow) {
    if (prev !== null && !state.seenPeople.has(id)) {
      const p = obs.people.find((x) => x.id === id);
      push("social.person_arrived", false, `${p?.name ?? id} at ${p?.dist ?? "?"} tiles`);
    }
  }
  state.seenPeople = peopleNow;

  const faunaNow = new Set(obs.fauna.map((f) => f.id));
  for (const id of faunaNow) {
    if (prev !== null && !state.seenFauna.has(id)) push("social.fauna_arrived", false, id);
  }
  state.seenFauna = faunaNow;

  const pilesNow = new Set(obs.piles.map((p) => p.id));
  for (const id of pilesNow) {
    if (prev !== null && !state.seenPiles.has(id)) {
      const p = obs.piles.find((x) => x.id === id);
      push("opportunity.pile_arrived", false, p?.label ?? id);
    }
  }
  state.seenPiles = pilesNow;

  const hostileNow = hostileIds(obs, config.hostileRadius, obs.you.id);
  for (const id of hostileNow) {
    if (!state.seenHostiles.has(id)) push("danger.hostile_engaged", true, id);
  }
  if (state.seenHostiles.size > 0 && hostileNow.size === 0) {
    push("danger.hostile_gone", false, "no hostiles in range");
  }
  state.seenHostiles = hostileNow;

  state.prev = obs;
  return events;
}
