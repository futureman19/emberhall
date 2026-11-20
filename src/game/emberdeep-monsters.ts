import type { Creature, FaunaKind, World } from "./types.ts";
import { EMBERDEEP_ANCHORS, EMBERDEEP_ROOMS, clearEmberdeepRoom, inEmberdeep } from "./emberdeep.ts";
import { spawn, strikePlayer } from "./ecology.ts";
import { astar, walkable } from "./pathfinding.ts";
import { CURSE_SLOW, CHILL_SLOW } from "./catalog.ts";
import { sanctuaryAt, zoneFaunaSlowAt } from "./zones.ts";

export const MONSTER_STATS = {
  slag_golem: { speed: 1.05, aggro: 8, reach: 2.3, windup: 0.9, recovery: 1.8, flight: 0.15 },
} as const;
export type EmberdeepMonsterKind = keyof typeof MONSTER_STATS;
export function isEmberdeepMonster(kind: FaunaKind): kind is EmberdeepMonsterKind { return kind in MONSTER_STATS; }
export const emberdeepSpawns = () => EMBERDEEP_ANCHORS.flatMap(a => {
  const kind: EmberdeepMonsterKind | null = a.role === "chamber" && ["cinder", "cistern", "forge"].includes(a.roomId) ? "slag_golem" : null;
  return kind ? [{ ...a, kind }] : [];
});
export function ensureEmberdeepMonsters(w: World) {
  for (const a of emberdeepSpawns()) {
    if (w.fauna.some(c => c.id === a.id) || w.emberdeep?.cleared.includes(a.roomId)) continue;
    const c = spawn(w, a.kind, a.tx, a.ty); c.id = a.id;
    w.fauna.push(c);
  }
}
export function updateEmberdeepClears(w: World) {
  for (const room of EMBERDEEP_ROOMS) {
    const ids = emberdeepSpawns().filter(a => a.roomId === room.id).map(a => a.id);
    if (ids.length && ids.every(id => w.fauna.some(c => c.id === id && c.task === "dead"))) clearEmberdeepRoom(w, room.id);
  }
}
/** Wall-aware bolt and aggro trace. No damage through the sealed gate. */
export function monsterSight(w: World, x: number, z: number, tx: number, tz: number) {
  const n = Math.ceil(Math.hypot(tx - x, tz - z) * 4);
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    if (!walkable(w, Math.round(x + (tx - x) * t), Math.round(z + (tz - z) * t))) return false;
  }
  return true;
}
const heat = new WeakMap<Creature, number>();
const plans = new WeakMap<Creature, number>();
function move(w: World, c: Creature, x: number, z: number, speed: number, dt: number) {
  const elapsed = (plans.get(c) ?? 1) + dt;
  plans.set(c, elapsed);
  if (elapsed >= 0.35) {
    plans.set(c, 0);
    const path = astar(w, Math.round(c.x), Math.round(c.z), Math.round(x), Math.round(z), 1800);
    c.path = path?.map(n => ({ tx: n.x, ty: n.y })) ?? [];
  }
  const n = c.path[0]; if (!n || !walkable(w, n.tx, n.ty) || sanctuaryAt(w, n.tx, n.ty)) return;
  const d = Math.hypot(n.tx - c.x, n.ty - c.z);
  if (d < 0.05) { c.path.shift(); return; }
  const slow = (c.curseUntil && w.hour < c.curseUntil ? CURSE_SLOW : 1) * (c.chillUntil && w.hour < c.chillUntil ? CHILL_SLOW : 1) * zoneFaunaSlowAt(w, c.x, c.z);
  const step = Math.min(d, speed * dt * slow);
  c.x += (n.tx - c.x) / d * step; c.z += (n.ty - c.z) / d * step;
}
export function tickEmberdeepMonster(w: World, c: Creature, dt: number) {
  if (!isEmberdeepMonster(c.kind) || c.hp <= 0 || c.task === "dead") return;
  const stats = MONSTER_STATS[c.kind];
  const s = c.monster ??= { phase: "patrol", time: 0, targetX: c.x, targetZ: c.z };
  const p = w.people.find(p => p.isPlayer);
  const dist = p ? Math.hypot(p.x - c.x, p.z - c.z) : Infinity;
  const valid = p && !p.ghost && !w.player.ghost && p.hp > 0 && inEmberdeep(p.x, p.z) &&
    w.hour >= w.player.invisUntil && !(c.blindUntil && w.hour < c.blindUntil) &&
    Math.hypot(p.x - c.home.tx, p.z - c.home.ty) < 14 && !sanctuaryAt(w, p.x, p.z);
  const adjacent = valid && dist <= 1.8 && monsterSight(w, c.x, c.z, p.x, p.z);
  const exposure = adjacent ? (heat.get(c) ?? 0) + dt : 0;
  const ticks = Math.floor(exposure + 1e-9);
  if (adjacent && ticks > 0) {
    p.hp = Math.max(0, p.hp - 3 * ticks);
    w.player.lastBittenAt = w.hour;
  }
  heat.set(c, Math.max(0, exposure - ticks));
  if (!valid || (c.task !== "fight" && (dist > stats.aggro || !monsterSight(w, c.x, c.z, p.x, p.z)))) {
    c.task = "wander"; s.phase = "patrol"; s.time += dt;
    const side = Math.floor(s.time / 3) % 2 ? -1 : 1;
    const x = c.home.tx + side * 2;
    move(w, c, walkable(w, x, c.home.ty) ? x : c.home.tx, c.home.ty, stats.speed * 0.5, dt);
    return;
  }
  c.task = "fight";
  if (s.phase === "patrol") {
    if (dist > stats.reach || !monsterSight(w, c.x, c.z, p.x, p.z)) {
      move(w, c, p.x, p.z, stats.speed, dt); return;
    }
    c.path = []; s.phase = "windup"; s.time = 0; s.targetX = p.x; s.targetZ = p.z; return;
  }
  s.time += dt;
  if (s.phase === "windup" && s.time >= stats.windup) { s.phase = "strike"; s.time = 0; }
  else if (s.phase === "strike" && s.time >= stats.flight) {
    if (Math.hypot(p.x - s.targetX, p.z - s.targetZ) < (c.kind === "slag_golem" ? 1.5 : 1) &&
      dist <= stats.reach + 0.4 && monsterSight(w, c.x, c.z, p.x, p.z)) strikePlayer(w, c, p);
    s.phase = "recover"; s.time = 0;
  } else if (s.phase === "recover" && s.time >= stats.recovery) { s.phase = "patrol"; s.time = 0; }
}
