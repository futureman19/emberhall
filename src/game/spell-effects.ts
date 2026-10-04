import { SECONDS_PER_HOUR } from "./catalog.ts";
import { groundY } from "./height.ts";
import { TERRAIN_STREAM_WINDOW } from "./terrain-stream.ts";
import { spellFxProfile } from "./magery-animation.ts";
import type { SpellId, World } from "./types.ts";

/** Gameplay's existing resolution boundary. Flight occupies the last 300ms of
 * anticipation, never delays damage/loot/status ticks or consumes RNG early.
 * A failed roll dissipates at the caster, with no target impact. */
export const CAST_WINDUP = 0.92;
export const SPELL_EFFECT_CAP = 6;
export const SPELL_STATUS_CAP = 32;
export interface SpellEffect {
  readonly spell: SpellId;
  readonly x: number;
  readonly z: number;
  readonly tx: number;
  readonly tz: number;
  readonly at: number;
  readonly outcome: "success" | "fizzle";
}
const effects = new WeakMap<World, SpellEffect[]>();
const EMPTY: readonly SpellEffect[] = Object.freeze([]);
/** Stable array, compacted in place: no array creation in renderer frame loops.
 * Backwards clocks discard future events; replacement worlds have no entry. */
export function spellEffects(world: World): readonly SpellEffect[] {
  const list = effects.get(world);
  if (!list) return EMPTY;
  let n = 0;
  for (const fx of list) {
    const age = (world.hour - fx.at) * SECONDS_PER_HOUR;
    const duration = fx.outcome === "fizzle" ? 0.6 : spellFxProfile(fx.spell).duration;
    if (age >= 0 && age < duration) list[n++] = fx;
  }
  list.length = n;
  return list;
}
export function clearSpellEffects(world: World): void {
  effects.delete(world);
  statuses.delete(world);
}
export function emitSpellEffect(world: World, event: SpellEffect): void {
  spellEffects(world);
  let list = effects.get(world);
  if (!list) { list = []; effects.set(world, list); }
  if (list.length === SPELL_EFFECT_CAP) list.shift();
  list.push(Object.freeze({ ...event }));
  refreshSpellStatuses(world);
}
/** Share the translucent body-flash budget at crowded destinations. Ground
 * rings remain independently visible; a pile of flashes must not paint over
 * the creature. Called with the already-pruned bounded list, without allocation. */
export function spellImpactOpacityScale(live: readonly SpellEffect[], effect: SpellEffect): number {
  let neighbors = 0;
  for (const other of live) {
    if (other.outcome === "success" && Math.hypot(other.tx - effect.tx, other.tz - effect.tz) < 1) neighbors++;
  }
  return 1 / Math.max(1, neighbors);
}

export function spellFlightProgress(spell: SpellId, workSeconds: number): number | null {
  const kind = spellFxProfile(spell).kind;
  if ((kind !== "dart" && kind !== "burst") || workSeconds < 0.62 || workSeconds >= CAST_WINDUP) return null;
  return (workSeconds - 0.62) / (CAST_WINDUP - 0.62);
}
/** Label ownership is independent of the oldest-first impact mesh pool. */
export function selectSpellLabel(world: World): { spell: SpellId; x: number; z: number; phase: "windup" | "release" } | null {
  const intent = world.player.intent;
  if (intent.kind === "cast" && intent.spell) {
    const caster = world.people.find(p => p.isPlayer);
    if (caster && !caster.path.length) return { spell: intent.spell, x: caster.x, z: caster.z, phase: "windup" };
  }
  const latest = spellEffects(world).at(-1);
  return latest ? { spell: latest.spell, x: latest.x, z: latest.z, phase: "release" } : null;
}

/** Shear the open seal along the local slope. Bound the residual over every
 * bilinear cell corner beneath its footprint, expanded by one rendered terrain
 * cell so triangle interpolation cannot bury it. Fixed local work, no allocation,
 * and ordinary depth testing still lets creatures/props occlude the seal. */
export function writeSpellStatusMatrix(world: World, x: number, z: number, lane: number, m: number[]): void {
  const radius = 0.9;
  const step = TERRAIN_STREAM_WINDOW / Math.min(TERRAIN_STREAM_WINDOW * 2, 180);
  const sx = (groundY(world, x + 1, z) - groundY(world, x - 1, z)) / 2;
  const sz = (groundY(world, x, z + 1) - groundY(world, x, z - 1)) / 2;
  const reach = radius + step;
  let y = -Infinity;
  // Bilinear height minus an affine plane attains its maximum at cell corners.
  for (let tz = Math.floor(z - reach); tz <= Math.ceil(z + reach); tz++) {
    for (let tx = Math.floor(x - reach); tx <= Math.ceil(x + reach); tx++) {
      y = Math.max(y, groundY(world, tx, tz) - sx * (tx - x) - sz * (tz - z));
    }
  }
  const c = Math.cos(lane * Math.PI / 2), s = Math.sin(lane * Math.PI / 2);
  m[0] = radius * c; m[2] = -radius * s; m[3] = 0;
  m[4] = -radius * s; m[6] = -radius * c; m[7] = 0;
  m[1] = sx * m[0] + sz * m[2]; m[5] = sx * m[4] + sz * m[6];
  m[8] = 0; m[9] = radius; m[10] = 0; m[11] = 0;
  m[12] = x; m[13] = y + 0.08; m[14] = z; m[15] = 1;
}

type StatusEntry = { creature: World["fauna"][number]; index: number };
type StatusCache = {
  fauna: World["fauna"]; length: number; active: StatusEntry[];
  candidates: World["fauna"]; indices: number[]; at: number; revision: number;
};
// Observe the structural mutation boundary without proxying the saved array:
// Proxies break structuredClone(world), used by Vault preflight. A non-enumerable
// splice method retains ordinary array/serialization behavior and adds no read
// overhead. Raw inactive-slot assignments still require refreshSpellStatuses.
const faunaRevisions = new WeakMap<World["fauna"], { value: number }>();
function observeFaunaSplices(fauna: World["fauna"]): number {
  let revision = faunaRevisions.get(fauna);
  if (!revision) {
    revision = { value: 0 };
    faunaRevisions.set(fauna, revision);
    const original = fauna.splice;
    Object.defineProperty(fauna, "splice", {
      configurable: true, writable: true, enumerable: false,
      value: function (this: World["fauna"], ...args: Parameters<typeof original>) {
        try { return Reflect.apply(original, this, args); }
        finally { const changed = faunaRevisions.get(this); if (changed) changed.value++; }
      },
    });
  }
  return revision.value;
}
const statuses = new WeakMap<World, StatusCache>();
function hasLiveStatus(c: World["fauna"][number], hour: number): boolean {
  return c.task !== "dead" && c.hp > 0 &&
    Math.max(c.poisonUntil ?? 0, c.paralyzeUntil ?? 0, c.curseUntil ?? 0, c.boundUntil ?? 0) > hour;
}
/** Rebuild only at load/cast/membership boundaries. Retain ALL active creatures,
 * including distant ones and overflow: movement must not lose their indicators.
 * This transient index changes neither saved data, gameplay deadlines nor RNG. */
export function refreshSpellStatuses(world: World): void {
  let cache = statuses.get(world);
  if (!cache) {
    cache = { fauna: world.fauna, length: 0, active: [], candidates: [], indices: [], at: world.hour, revision: 0 };
    statuses.set(world, cache);
  }
  cache.fauna = world.fauna;
  cache.revision = observeFaunaSplices(world.fauna);
  cache.length = world.fauna.length;
  cache.active.length = 0;
  for (let index = 0; index < world.fauna.length; index++) {
    const creature = world.fauna[index];
    if (hasLiveStatus(creature, world.hour)) cache.active.push({ creature, index });
  }
  collectStatusCandidates(world, cache);
}
/** Routine simulation work is proportional to active statuses, not population.
 * Structural changes and rewinds rebuild once; render visits never rebuild. */
export function updateSpellStatuses(world: World): void {
  const cache = statuses.get(world);
  if (!cache || cache.fauna !== world.fauna || cache.length !== world.fauna.length || world.hour < cache.at ||
      cache.revision !== faunaRevisions.get(world.fauna)?.value ||
      cache.active.some(entry => world.fauna[entry.index] !== entry.creature)) {
    refreshSpellStatuses(world);
    return;
  }
  collectStatusCandidates(world, cache);
}
function collectStatusCandidates(world: World, cache: StatusCache): void {
  cache.at = world.hour;
  cache.candidates.length = 0;
  cache.indices.length = 0;
  const p = world.people.find(p => p.isPlayer);
  let n = 0;
  for (const entry of cache.active) {
    const c = entry.creature;
    if (!hasLiveStatus(c, world.hour)) continue;
    cache.active[n++] = entry;
    if (cache.candidates.length >= SPELL_STATUS_CAP || (p && Math.hypot(c.x - p.x, c.z - p.z) > 28)) continue;
    cache.candidates.push(c);
    cache.indices.push(entry.index);
  }
  cache.active.length = n;
}
/** Bounded visitor avoids per-frame fauna scans. These are semantic indicators,
 * not release particles: reduced effects keeps them, without motion/pulsing. */
export function visitSpellStatuses(world: World, visit: (x: number, z: number, spell: SpellId, lane: number) => void): number {
  let count = 0;
  const add = (x: number, z: number, spell: SpellId, until: number | undefined, lane: number) => {
    if (count < SPELL_STATUS_CAP && (until ?? 0) > world.hour) { visit(x, z, spell, lane); count++; }
  };
  const p = world.people.find(p => p.isPlayer);
  if (p && p.hp > 0 && !p.ghost && !world.player.ghost) {
    add(p.x, p.z, "poison", world.player.poisonUntil, 0);
    add(p.x, p.z, "bless", world.player.blessUntil, 1);
    add(p.x, p.z, "nightsight", world.player.nightSightUntil, 2);
    add(p.x, p.z, "invisibility", world.player.invisUntil, 3);
  }
  const cache = statuses.get(world);
  if (!cache || cache.fauna !== world.fauna || world.hour < cache.at) return count;
  for (let i = 0; i < cache.candidates.length; i++) {
    const c = cache.candidates[i];
    if (world.fauna[cache.indices[i]] !== c) continue;
    if (count >= SPELL_STATUS_CAP) break;
    if (c.task === "dead" || c.hp <= 0 || (p && Math.hypot(c.x - p.x, c.z - p.z) > 28)) continue;
    add(c.x, c.z, "poison", c.poisonUntil, 0);
    add(c.x, c.z, "paralyze", c.paralyzeUntil, 1);
    add(c.x, c.z, "curse", c.curseUntil, 2);
    add(c.x, c.z, "summon", c.boundUntil, 3);
  }
  return count;
}
