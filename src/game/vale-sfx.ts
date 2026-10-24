const KEY = "emberhall-mute-sfx";
const LEGACY = "emberhall-mute";

function flag(key: string) {
  try {
    const v = localStorage.getItem(key);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    /* ignore */
  }
  return null;
}

export function sfxMuted() {
  return flag(KEY) ?? flag(LEGACY) === true;
}

export function toggleSfx() {
  const mute = !sfxMuted();
  try {
    localStorage.setItem(KEY, mute ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (mute) {
    for (const group of bags.values()) for (const audio of group) audio.pause();
    rainEl?.pause();
    dungeonEl?.pause();
  }
  return mute;
}

export type SfxId =
  | "chop"
  | "mine"
  | "hunt"
  | "cast"
  | "fire"
  | "spark"
  | "fizzle"
  | "die"
  | "loot"
  | "gate"
  | "smith"
  | "thunder"
  | "spell_nightsight"
  | "spell_heal"
  | "spell_magicarrow"
  | "spell_fireball"
  | "spell_teleport"
  | "spell_mark"
  | "spell_recall"
  | "spell_cure"
  | "spell_poison"
  | "spell_bless"
  | "spell_lightning"
  | "spell_summon"
  | "spell_paralyze"
  | "spell_invisibility"
  | "spell_curse"
  | "spell_thornsnare"
  | "spell_ironwood"
  | "spell_leech"
  | "spell_flash"
  | "spell_fireblast"
  | "spell_blizzard"
  | "spell_chainlightning"
  | "spell_sleep"
  | "spell_meteor"
  | "spell_flamewall"
  | "spell_tarpit"
  | "spell_stonewall"
  | "spell_sanctuary"
  | "spell_earthquake"
  | "spell_naturesfury"
  | "spell_jump"
  | "spell_mirrorimage"
  | "spell_gate"
  | "spell_fly"
  | "spell_necromancy"
  | "spell_resurrect"
  | "spell_summonelemental"
  | "spell_polymorph"
  | "slag_golem_aggro"
  | "slag_golem_attack"
  | "slag_golem_hit"
  | "slag_golem_death"
  | "embercrawler_aggro"
  | "embercrawler_attack"
  | "embercrawler_hit"
  | "embercrawler_death"
  | "gloomwraith_aggro"
  | "gloomwraith_attack"
  | "gloomwraith_hit"
  | "gloomwraith_death"
  | "emberdeep_ambience"
  | "emberdeep_door";

export const SFX_SOURCES: Record<SfxId, string> = {
  slag_golem_aggro: "/audio/sfx/slag-golem-aggro.mp3",
  slag_golem_attack: "/audio/sfx/slag-golem-attack.mp3",
  slag_golem_hit: "/audio/sfx/slag-golem-hit.mp3",
  slag_golem_death: "/audio/sfx/slag-golem-death.mp3",
  embercrawler_aggro: "/audio/sfx/embercrawler-aggro.mp3",
  embercrawler_attack: "/audio/sfx/embercrawler-attack.mp3",
  embercrawler_hit: "/audio/sfx/embercrawler-hit.mp3",
  embercrawler_death: "/audio/sfx/embercrawler-death.mp3",
  gloomwraith_aggro: "/audio/sfx/gloomwraith-aggro.mp3",
  gloomwraith_attack: "/audio/sfx/gloomwraith-attack.mp3",
  gloomwraith_hit: "/audio/sfx/gloomwraith-hit.mp3",
  gloomwraith_death: "/audio/sfx/gloomwraith-death.mp3",
  emberdeep_ambience: "/audio/sfx/emberdeep-ambience.mp3",
  emberdeep_door: "/audio/sfx/emberdeep-door.mp3",
  chop: "/audio/sfx/chop.mp3",
  mine: "/audio/sfx/mine.mp3",
  hunt: "/audio/sfx/hunt.mp3",
  cast: "/audio/sfx/cast.mp3",
  fire: "/audio/sfx/fire.mp3",
  spark: "/audio/sfx/spark.mp3",
  fizzle: "/audio/sfx/fizzle.mp3",
  die: "/audio/sfx/die.mp3",
  loot: "/audio/sfx/loot.mp3",
  gate: "/audio/sfx/gate.mp3",
  smith: "/audio/sfx/smith.mp3",
  thunder: "/audio/sfx/thunder.wav",
  spell_nightsight: "/audio/sfx/spell-nightsight.mp3",
  spell_heal: "/audio/sfx/spell-heal.mp3",
  spell_magicarrow: "/audio/sfx/spell-magicarrow.mp3",
  spell_fireball: "/audio/sfx/spell-fireball.mp3",
  spell_teleport: "/audio/sfx/spell-teleport.mp3",
  spell_mark: "/audio/sfx/spell-mark.mp3",
  spell_recall: "/audio/sfx/spell-recall.mp3",
  spell_cure: "/audio/sfx/spell-cure.mp3",
  spell_poison: "/audio/sfx/spell-poison.mp3",
  spell_bless: "/audio/sfx/spell-bless.mp3",
  spell_lightning: "/audio/sfx/spell-lightning.mp3",
  spell_summon: "/audio/sfx/spell-summon.mp3",
  spell_paralyze: "/audio/sfx/spell-paralyze.mp3",
  spell_invisibility: "/audio/sfx/spell-invisibility.mp3",
  spell_curse: "/audio/sfx/spell-curse.mp3",
  spell_thornsnare: "/audio/sfx/spell-thornsnare.mp3",
  spell_ironwood: "/audio/sfx/spell-ironwood.mp3",
  spell_leech: "/audio/sfx/spell-leech.mp3",
  spell_flash: "/audio/sfx/spell-flash.mp3",
  spell_fireblast: "/audio/sfx/spell-fireblast.mp3",
  spell_blizzard: "/audio/sfx/spell-blizzard.mp3",
  spell_chainlightning: "/audio/sfx/spell-chainlightning.mp3",
  spell_sleep: "/audio/sfx/spell-sleep.mp3",
  spell_meteor: "/audio/sfx/spell-meteor.mp3",
  spell_flamewall: "/audio/sfx/spell-flamewall.mp3",
  spell_tarpit: "/audio/sfx/spell-tarpit.mp3",
  spell_stonewall: "/audio/sfx/spell-stonewall.mp3",
  spell_sanctuary: "/audio/sfx/spell-sanctuary.mp3",
  spell_earthquake: "/audio/sfx/spell-earthquake.mp3",
  spell_naturesfury: "/audio/sfx/spell-naturesfury.mp3",
  spell_jump: "/audio/sfx/spell-jump.mp3",
  spell_mirrorimage: "/audio/sfx/spell-mirrorimage.mp3",
  spell_gate: "/audio/sfx/spell-gate.mp3",
  spell_fly: "/audio/sfx/spell-fly.mp3",
  spell_necromancy: "/audio/sfx/spell-necromancy.mp3",
  spell_resurrect: "/audio/sfx/spell-resurrect.mp3",
  spell_summonelemental: "/audio/sfx/spell-summonelemental.mp3",
  spell_polymorph: "/audio/sfx/spell-polymorph.mp3",
};

const POOL = 3;
const bags = new Map<SfxId, HTMLAudioElement[]>();
const cursor = new Map<SfxId, number>();

function bag(id: SfxId) {
  let b = bags.get(id);
  if (!b) {
    b = Array.from({ length: POOL }, () => {
      const a = new Audio(SFX_SOURCES[id]);
      a.preload = "auto";
      return a;
    });
    bags.set(id, b);
    cursor.set(id, 0);
  }
  return b;
}

export function warmSfx() {
  (Object.keys(SFX_SOURCES) as SfxId[]).forEach((id) => bag(id));
}

export function playSfx(id: SfxId, vol = 0.5) {
  if (typeof Audio === "undefined") return;
  if (sfxMuted()) return;
  const b = bag(id);
  const i = cursor.get(id) ?? 0;
  cursor.set(id, (i + 1) % b.length);
  const a = b[i]!;
  a.volume = Math.max(0, Math.min(1, vol));
  try {
    a.currentTime = 0;
  } catch {
    /* ignore */
  }
  a.play().catch(() => {});
}

/* --- Rain loop: one long buffer, volume rides the actual rainfall. --- */

let dungeonEl: HTMLAudioElement | null = null;
let dungeonPending = false;
/** One reusable bed; a blocked play is not retried until the next user gesture. */
export function setDungeonAmbience(inside: boolean) {
  if (typeof Audio === "undefined") return;
  const active = inside && !sfxMuted();
  if (!active) {
    dungeonEl?.pause();
    return;
  }
  dungeonEl ??= new Audio(SFX_SOURCES.emberdeep_ambience);
  dungeonEl.loop = true;
  dungeonEl.volume = 0.22;
  if (!dungeonEl.paused || dungeonPending) return;
  dungeonPending = true;
  dungeonEl
    .play()
    .then(() => {
      dungeonPending = false;
    })
    .catch((error: unknown) => {
      if (
        typeof window === "undefined" ||
        !(error instanceof DOMException) ||
        error.name !== "NotAllowedError"
      ) {
        dungeonPending = false;
        return;
      }
      const retry = () => {
        dungeonPending = false;
        window.removeEventListener("pointerdown", retry);
        window.removeEventListener("keydown", retry);
      };
      window.addEventListener("pointerdown", retry, { once: true });
      window.addEventListener("keydown", retry, { once: true });
    });
}

let rainEl: HTMLAudioElement | null = null;
let rainVol = 0;

export function setRainLevel(level: number) {
  if (typeof Audio === "undefined") return;
  const target = sfxMuted() ? 0 : Math.max(0, Math.min(1, level)) * 0.34;
  if (!rainEl) {
    if (target <= 0.01) return;
    rainEl = new Audio("/audio/sfx/rain.wav");
    rainEl.loop = true;
    rainEl.volume = 0;
  }
  rainVol = target;
  rainEl.volume = rainVol;
  if (rainVol > 0.01) {
    if (rainEl.paused) rainEl.play().catch(() => {});
  } else if (!rainEl.paused) {
    rainEl.pause();
  }
}
