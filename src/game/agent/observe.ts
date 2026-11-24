/**
 * Observation builder — what a body perceives, flattened for a brain.
 *
 * `observeWorld` and `observeBody` are pure: they never mutate the World.
 * Omitted body ids preserve the solo-player observation contract.
 *
 * `observeLive` is the driver entry point: live world + legal verb menu.
 */
import { actorPerson, actorState } from "../actor.ts";
import { isNight } from "../catalog.ts";
import { getWorld } from "../live.ts";
import type { World } from "../types.ts";
import { candidatesForPlayer } from "./candidates.ts";
import { nearestWater, shoreBesideWater, waterStatus } from "../survival.ts";
import type {
  BodySheet,
  Observation,
  ObservedBuilding,
  ObservedFauna,
  ObservedHerb,
  ObservedPerson,
  ObservedPile,
  ObservedPlot,
  VerbCandidate,
} from "./types.ts";

/** Entities beyond this many tiles are somebody else's problem. */
export const AGENT_OBS_RADIUS = 24;
const LOG_TAIL = 20;

export function bodySheet(world: World, bodyId?: string): BodySheet {
  const state = actorState(world, bodyId);
  const me = actorPerson(world, bodyId);
  if (bodyId !== undefined && !me) throw new Error(`Missing actor body: ${bodyId}`);
  const ws = me ? waterStatus(world, me, state.flyUntil) : { inWater: false, drowning: false };
  return {
    id: state.id,
    name: me?.name ?? "you",
    x: me?.x ?? 0,
    z: me?.z ?? 0,
    hp: me?.hp ?? 0,
    maxHp: me?.maxHp ?? 0,
    hunger: me?.hunger ?? 0,
    thirst: me?.thirst ?? 0,
    inWater: ws.inWater,
    drowning: ws.drowning,
    energy: me?.energy ?? 0,
    ghost: state.ghost,
    mana: state.mana,
    notoriety: state.notoriety,
    skills: { ...state.skills },
    pack: { ...state.pack },
    wear: { ...state.wear },
    vault: state.vault,
  };
}

export function observeWorld(
  world: World,
  opts: { radius?: number; verbs?: VerbCandidate[] } = {},
): Observation {
  return observeBody(world, undefined, opts);
}

export function observeBody(
  world: World,
  bodyId?: string,
  opts: { radius?: number; verbs?: VerbCandidate[] } = {},
): Observation {
  const you = bodySheet(world, bodyId);
  const radius = opts.radius ?? AGENT_OBS_RADIUS;
  const me = actorPerson(world, bodyId);
  const px = me?.x ?? 0;
  const pz = me?.z ?? 0;
  const dist = (x: number, y: number) => Math.round(Math.hypot(x - px, y - pz) * 10) / 10;
  const near = (d: number) => d <= radius;

  const people: ObservedPerson[] = [];
  for (const p of world.people) {
    if (p.id === me?.id) continue;
    const d = dist(p.x, p.z);
    if (!near(d)) continue;
    people.push({
      id: p.id,
      name: p.name,
      role: p.role,
      x: p.x,
      z: p.z,
      hp: p.hp,
      maxHp: p.maxHp,
      task: p.task,
      ghost: p.ghost,
      dist: d,
    });
  }

  const fauna: ObservedFauna[] = [];
  for (const c of world.fauna) {
    const d = dist(c.x, c.z);
    if (!near(d)) continue;
    fauna.push({
      id: c.id,
      kind: c.kind,
      name: c.name ?? null,
      x: c.x,
      z: c.z,
      hp: c.hp,
      maxHp: c.maxHp,
      task: c.task,
      ownerId: c.ownerId,
      dist: d,
    });
  }

  const piles: ObservedPile[] = [];
  for (const pile of world.piles) {
    const d = dist(pile.tx, pile.ty);
    if (!near(d)) continue;
    piles.push({ id: pile.id, label: pile.label, tx: pile.tx, ty: pile.ty, dist: d });
  }

  const buildings: ObservedBuilding[] = [];
  for (const b of world.buildings) {
    const d = dist(b.tx, b.ty);
    if (!near(d)) continue;
    buildings.push({ id: b.id, kind: b.kind, tx: b.tx, ty: b.ty, dist: d });
  }

  const plots: ObservedPlot[] = [];
  for (const bed of world.plots) {
    const d = dist(bed.tx, bed.ty);
    if (!near(d)) continue;
    plots.push({ id: bed.id, crop: bed.crop, stage: bed.stage, tx: bed.tx, ty: bed.ty, dist: d });
  }

  const herbs: ObservedHerb[] = [];
  for (const herb of world.herbs ?? []) {
    const d = dist(herb.tx, herb.ty);
    if (!near(d)) continue;
    herbs.push({ id: herb.id, kind: herb.kind, tx: herb.tx, ty: herb.ty, dist: d });
  }

  const water = (() => {
    if (!me) return null;
    const nearest = nearestWater(world, px, pz);
    const shore = nearest ? shoreBesideWater(world, nearest.tx, nearest.ty) : null;
    const escape = you.inWater ? shoreBesideWater(world, Math.round(px), Math.round(pz)) : null;
    return { nearest, shore, escape };
  })();

  return {
    tick: world.tickCount,
    hour: world.hour,
    isNight: isNight(world.hour),
    weather: {
      kind: world.weather.kind,
      cloud: world.weather.cloud,
      wet: world.weather.wet,
      wind: world.weather.wind,
    },
    you,
    people,
    fauna,
    piles,
    buildings,
    plots,
    herbs,
    water,
    verbs: opts.verbs ?? [],
    logTail: world.log.slice(-LOG_TAIL).map((l) => l.text),
  };
}

/** Driver entry: live world, plus the legal verb menu for that world. */
export function observeLive(opts: { radius?: number; menuRadius?: number } = {}): Observation {
  const world = getWorld();
  const verbs = candidatesForPlayer(world, opts.menuRadius);
  return observeWorld(world, { radius: opts.radius, verbs });
}
