const KEY = "emberhall-mute-music";
const LEGACY = "emberhall-mute";
const TRACKS = ["/audio/vale-air.mp3", "/audio/vale-market.mp3"];
const VOL = 0.18;

let el: HTMLAudioElement | null = null;
let idx = 0;
let wanted = true;

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

export function musicMuted() {
  return flag(KEY) ?? flag(LEGACY) === true;
}

function getEl() {
  if (el) return el;
  el = new Audio(TRACKS[idx] ?? TRACKS[0]!);
  el.preload = "auto";
  el.loop = false;
  el.volume = VOL;
  el.addEventListener("ended", () => {
    idx = (idx + 1) % TRACKS.length;
    if (!el) return;
    el.src = TRACKS[idx]!;
    el.volume = VOL;
    if (wanted && !musicMuted()) el.play().catch(() => {});
  });
  return el;
}

export function startValeMusic() {
  wanted = true;
  if (musicMuted()) return;
  const a = getEl();
  a.volume = VOL;
  a.play().catch(() => {});
}

export function toggleValeMusic() {
  const mute = !musicMuted();
  try {
    localStorage.setItem(KEY, mute ? "1" : "0");
  } catch {
    /* ignore */
  }
  const a = getEl();
  if (mute) a.pause();
  else {
    wanted = true;
    a.volume = VOL;
    a.play().catch(() => {});
  }
  return mute;
}
