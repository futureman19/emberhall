import type { Creature, World } from "./types.ts";
import { inEmberdeep } from "./emberdeep.ts";
import { playSfx, setDungeonAmbience, type SfxId } from "./vale-sfx.ts";

const SOUNDS = {
  furnace_warden: { aggro: "warden_roar", attack: "warden_slam", hit: "slag_golem_hit", death: "warden_death" },
  slag_golem: {
    aggro: "slag_golem_aggro",
    attack: "slag_golem_attack",
    hit: "slag_golem_hit",
    death: "slag_golem_death",
  },
  embercrawler: {
    aggro: "embercrawler_aggro",
    attack: "embercrawler_attack",
    hit: "embercrawler_hit",
    death: "embercrawler_death",
  },
  gloomwraith: {
    aggro: "gloomwraith_aggro",
    attack: "gloomwraith_attack",
    hit: "gloomwraith_hit",
    death: "gloomwraith_death",
  },
} satisfies Record<string, Record<string, SfxId>>;
type Snapshot = { hp: number; fighting: boolean; strike: boolean; dead: boolean; enraged: boolean };
const history = new WeakMap<World, Map<Creature, Snapshot>>();
const doors = new WeakMap<World, boolean>();
/** Sample at both simulation boundaries, not render frames: fast strikes cannot
 * be dropped at low FPS. History is transient, never serialized or replayed. */
export function syncMonsterAudio(world: World) {
  const previous = history.get(world) ?? new Map<Creature, Snapshot>();
  const next = new Map<Creature, Snapshot>();
  const player = world.people.find((p) => p.isPlayer);
  for (const c of world.fauna) {
    if (!(c.kind in SOUNDS)) continue;
    const sounds = SOUNDS[c.kind as keyof typeof SOUNDS];
    const phase = c.monster?.phase ?? c.crawler?.phase ?? c.gloom?.phase;
    const state = {
      hp: c.hp,
      fighting: c.task === "fight",
      strike: phase === "strike" || phase === "lunge" || phase === "bolt",
      dead: c.hp <= 0 || c.task === "dead",
      enraged: c.kind === "furnace_warden" && c.hp <= c.maxHp * .5,
    };
    const old = previous.get(c);
    next.set(c, state);
    if (
      !old ||
      !player ||
      !inEmberdeep(player.x, player.z) ||
      Math.hypot(player.x - c.x, player.z - c.z) > 18
    )
      continue;
    const volume = 0.6 * Math.max(0.15, 1 - Math.hypot(player.x - c.x, player.z - c.z) / 20);
    if (state.dead) {
      if (!old.dead) playSfx(sounds.death, volume);
      continue;
    }
    if (old.dead) continue;
    if(state.enraged && !old.enraged) playSfx("warden_phase", volume);
    if (state.fighting && !old.fighting) playSfx(sounds.aggro, volume);
    if (state.strike && !old.strike) playSfx(sounds.attack, volume);
    if (state.hp < old.hp) playSfx(sounds.hit, volume * 0.8);
  }
  history.set(world, next);
}
/** Render-owned environment audio also follows teleports, pause and saved entry. */
export function syncDungeonAudio(world: World) {
  const player = world.people.find((p) => p.isPlayer);
  const inside = !!player && inEmberdeep(player.x, player.z);
  setDungeonAmbience(inside);
  const open = world.emberdeep?.bossDoorOpen === true;
  if (inside && open && doors.get(world) === false) playSfx("emberdeep_door", 0.65);
  doors.set(world, open);
}
