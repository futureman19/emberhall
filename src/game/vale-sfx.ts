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
  | "smith";

const SRC: Record<SfxId, string> = {
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
};

const POOL = 3;
const bags = new Map<SfxId, HTMLAudioElement[]>();
const cursor = new Map<SfxId, number>();

function bag(id: SfxId) {
  let b = bags.get(id);
  if (!b) {
    b = Array.from({ length: POOL }, () => {
      const a = new Audio(SRC[id]);
      a.preload = "auto";
      return a;
    });
    bags.set(id, b);
    cursor.set(id, 0);
  }
  return b;
}

export function warmSfx() {
  (Object.keys(SRC) as SfxId[]).forEach((id) => bag(id));
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
