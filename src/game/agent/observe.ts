/**
 * Observation builder — what a body perceives, flattened for a brain.
 *
 * `observeWorld` is pure: it reads a World and never mutates it. Phase 0 is
 * player-centric (`you` = the solo player); the multi-body refactor passes a
 * body id instead of scanning for `isPlayer`.
 *
 * `observeLive` is the driver entry point: live world + legal verb menu.
 */
import { isNight } from "../catalog.ts";
import { getWorld } from "../live.ts";
import type { World } from "../types.ts";
import { candidatesForPlayer } from "./candidates.ts";
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

export function bodySheet(world: World): BodySheet {
  const me = world.people.find((p) => p.isPlayer);
  return {
    id: world.player.id,
    name: me?.name ?? "you",
    x: me?.x ?? 0,
    z: me?.z ?? 0,
    hp: me?.hp ?? 0,
    maxHp: me?.maxHp ?? 0,
    hunger: me?.hunger ?? 0,
    energy: me?.energy ?? 0,
    ghost: world.player.ghost,
    mana: world.player.mana,
    notoriety: world.player.notoriety,
    skills: { ...world.player.skills },
    pack: { ...world.player.pack },
    wear: { ...world.player.wear },
    vault: world.player.vault,
  };
}

export function observeWorld(
  world: World,
  opts: { radius?: number; verbs?: VerbCandidate[] } = {},
): Observation {
  const radius = opts.radius ?? AGENT_OBS_RADIUS;
  const me = world.people.find((p) => p.isPlayer);
  const px = me?.x ?? 0;
  const pz = me?.z ?? 0;
  const dist = (x: number, y: number) => Math.round(Math.hypot(x - px, y - pz) * 10) / 10;
  const near = (d: number) => d <= radius;

  const people: ObservedPerson[] = [];
  for (const p of world.people) {
    if (p.isPlayer) continue;
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
    you: bodySheet(world),
    people,
    fauna,
    piles,
    buildings,
    plots,
    herbs,
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
