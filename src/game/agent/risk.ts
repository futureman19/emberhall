/** Paid admission policy, not an action planner. See docs/phase-3.6-risk-cadence.md. */
import type { EventDeriveConfig, ReflexEvent } from "./events.ts";
import type { Observation } from "./types.ts";

export const IDLE_HEARTBEAT_TICKS = 36_000; // one nominal host wall hour (10 Hz)

export function unresolvedRisk(obs: Observation, config: EventDeriveConfig): string[] {
  if (obs.you.ghost) return [];
  const reasons: string[] = [];
  if (obs.you.hunger <= config.hungerLow) reasons.push("hunger needs food");
  if (obs.you.hp <= obs.you.maxHp * config.hpCriticalFraction) reasons.push("critical hp");
  if (obs.fauna.some(f => f.hp > 0 && f.task === "fight" && f.ownerId !== obs.you.id && f.dist <= config.hostileRadius)) {
    reasons.push("engaged hostile");
  }
  // Low energy has no restorative action in the current reflex wire. Notify
  // on crossings, not every cooldown: 'idle' does not restore energy.
  return reasons;
}

/** Revalidate condition-based reminders, preserving discrete damage/arrival events. */
export function riskStillRelevant(event: ReflexEvent, obs: Observation, config: EventDeriveConfig): boolean {
  switch (event.kind) {
    case "danger.unresolved": return unresolvedRisk(obs, config).length > 0;
    case "vitals.hunger_low": return !obs.you.ghost && obs.you.hunger <= config.hungerLow;
    case "vitals.hunger_critical": return !obs.you.ghost && obs.you.hunger <= config.hungerCritical;
    case "vitals.energy_low": return !obs.you.ghost && obs.you.energy <= config.energyLow;
    case "vitals.energy_critical": return !obs.you.ghost && obs.you.energy <= config.energyCritical;
    case "vitals.hp_critical": return !obs.you.ghost && obs.you.hp <= obs.you.maxHp * config.hpCriticalFraction;
    default: return true;
  }
}

export function riskGatedEvents(
  obs: Observation,
  events: ReflexEvent[],
  config: EventDeriveConfig,
  lastAttemptTick: number | null,
  heartbeatTicks: number,
): ReflexEvent[] {
  const meaningful = events.filter(e => e.survival || e.kind === "boot" ||
    e.kind === "opportunity.pile_arrived" || e.kind === "danger.hostile_gone" ||
    e.kind === "vitals.energy_low" || e.kind === "vitals.hunger_low");
  // Energy/food warnings must not wait for morning. Boot and actionable
  // changes likewise must not depend on the director or a quiet window.
  const result = meaningful.map(e => ({ ...e, survival: true }));
  const risk = unresolvedRisk(obs, config);
  if (risk.length) result.push({ kind: "danger.unresolved", survival: true, detail: risk.join("; ") });
  if (lastAttemptTick !== null && obs.tick - lastAttemptTick >= heartbeatTicks) {
    result.push({ kind: "activity.heartbeat", survival: true, detail: "rare idle heartbeat" });
  }
  return result;
}
