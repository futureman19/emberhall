import { SECONDS_PER_HOUR } from "./catalog.ts";
import { mulberry32 } from "./rng.ts";
import type { WeatherKind, WeatherState, World } from "./types.ts";

/**
 * The vale's weather. A slow regime machine — clear, fair, cloudy, rain,
 * storm — plus three eased analogues the renderer reads every frame:
 * cloud cover, ground wetness, wind.
 *
 * Determinism: regime rolls draw from mulberry32(seed + rolls), so a world
 * replays the same sky after a save/load round-trip. The state lives on
 * World.weather and rides the existing save blob untouched.
 *
 * Gameplay teeth live here too (torch dousing); crops, fauna and the HUD
 * read the state from their own ticks.
 */

export const WEATHER_META: Record<
  WeatherKind,
  { cloud: number; rain: number; wind: number; label: string; bark: string | null }
> = {
  clear: { cloud: 0.06, rain: 0, wind: 0.12, label: "Clear", bark: "The sky clears." },
  fair: { cloud: 0.32, rain: 0, wind: 0.2, label: "Fair", bark: "Small clouds drift the blue." },
  cloudy: { cloud: 0.78, rain: 0, wind: 0.38, label: "Clouds", bark: "Clouds gather over the vale." },
  rain: { cloud: 0.95, rain: 0.65, wind: 0.5, label: "Rain", bark: "The first drops fall — the beds drink." },
  storm: { cloud: 1, rain: 1, wind: 1, label: "Storm", bark: "The storm breaks. The vale roars." },
};

/** Where each regime can go, with weights. Rain follows grey skies; storms are rare and short. */
const NEXT: Record<WeatherKind, [WeatherKind, number][]> = {
  clear: [
    ["fair", 5],
    ["cloudy", 2],
    ["clear", 2],
  ],
  fair: [
    ["clear", 4],
    ["cloudy", 3],
    ["fair", 1],
  ],
  cloudy: [
    ["rain", 4],
    ["fair", 3],
    ["clear", 2],
    ["storm", 1],
  ],
  rain: [
    ["cloudy", 4],
    ["storm", 1],
    ["fair", 1],
  ],
  storm: [
    ["rain", 5],
    ["cloudy", 3],
  ],
};

/** Regime length in world hours [min, max]. A world hour is 36s at 1x. */
const DURATION: Record<WeatherKind, [number, number]> = {
  clear: [4, 10],
  fair: [3, 8],
  cloudy: [2, 5],
  rain: [1.5, 4],
  storm: [0.5, 1.5],
};

/** How fast the analogues chase their targets, per world hour. */
const CLOUD_EASE = 2.2;
const WIND_EASE = 1.6;
/** Wetness gain per hour at full rain; drying per hour (sun adds more). */
const WET_RATE = 1.5;
const DRY_RATE = 0.14;

/** Torch survival once the rain is real: 0.3–0.5 world hours (~11–18s at 1x). */
const DOUSE_MIN = 0.3;
const DOUSE_SPAN = 0.2;

function weatherLog(world: World, text: string) {
  world.log.unshift({ t: world.hour, text });
  if (world.log.length > 48) world.log.length = 48;
}

/**
 * A world's opening sky, drawn from its seed: most lives open under open
 * sky, some under grey, a few to rain on the roof. The first regime is
 * short (1.5–3.5h) so the weather introduces itself within minutes.
 */
export function initialWeather(seed: number, hour = 8): WeatherState {
  const rng = mulberry32(seed * 71 + 13);
  const r = rng();
  const kind: WeatherKind = r < 0.42 ? "clear" : r < 0.68 ? "fair" : r < 0.85 ? "cloudy" : r < 0.96 ? "rain" : "storm";
  const meta = WEATHER_META[kind];
  const rainy = kind === "rain" || kind === "storm";
  return {
    kind,
    cloud: meta.cloud,
    wet: rainy ? 0.5 : 0,
    wind: meta.wind,
    untilHour: hour + 1.5 + rng() * 2,
    rolls: 1,
    douseHour: 0,
  };
}

/** Repair/default for saves that predate weather. */
export function ensureWeather(world: World): WeatherState {
  const w = world.weather as WeatherState | undefined;
  if (!w || typeof w !== "object" || !(w.kind in WEATHER_META)) {
    world.weather = initialWeather(world.seed, world.hour);
    return world.weather;
  }
  if (typeof w.cloud !== "number" || Number.isNaN(w.cloud)) w.cloud = WEATHER_META[w.kind].cloud;
  if (typeof w.wet !== "number" || Number.isNaN(w.wet)) w.wet = 0;
  if (typeof w.wind !== "number" || Number.isNaN(w.wind)) w.wind = WEATHER_META[w.kind].wind;
  if (typeof w.untilHour !== "number" || Number.isNaN(w.untilHour)) w.untilHour = world.hour + 2;
  if (typeof w.rolls !== "number" || Number.isNaN(w.rolls)) w.rolls = 0;
  if (typeof w.douseHour !== "number" || Number.isNaN(w.douseHour)) w.douseHour = 0;
  return w;
}

function rollNext(world: World, wx: WeatherState) {
  const rng = mulberry32(world.seed * 131 + wx.rolls * 7919 + 17);
  const table = NEXT[wx.kind];
  const total = table.reduce((s, [, wgt]) => s + wgt, 0);
  let pick = rng() * total;
  let kind: WeatherKind = table[table.length - 1]![0];
  for (const [k, wgt] of table) {
    pick -= wgt;
    if (pick <= 0) {
      kind = k;
      break;
    }
  }
  const [lo, hi] = DURATION[kind];
  const hours = lo + rng() * (hi - lo);
  wx.kind = kind;
  wx.untilHour = world.hour + hours;
  wx.rolls += 1;
  const bark = WEATHER_META[kind].bark;
  if (bark) weatherLog(world, bark);
}

/** Rain that actually falls right now — cover has to thicken before drops. */
export function rainRate(world: World): number {
  const wx = world.weather;
  if (!wx) return 0;
  const target = WEATHER_META[wx.kind].rain;
  if (target <= 0) return 0;
  const cover = Math.max(0, Math.min(1, (wx.cloud - 0.55) / 0.4));
  return target * cover;
}

function tickTorch(world: World, wx: WeatherState, rain: number) {
  if (world.player.wear.main !== "torch") {
    wx.douseHour = 0;
    return;
  }
  if (rain < 0.25) {
    wx.douseHour = 0;
    return;
  }
  if (wx.douseHour <= 0) {
    const rng = mulberry32(world.seed * 57 + wx.rolls * 911 + world.tickCount);
    wx.douseHour = world.hour + DOUSE_MIN + rng() * DOUSE_SPAN;
    return;
  }
  if (world.hour >= wx.douseHour) {
    world.player.wear.main = undefined;
    wx.douseHour = 0;
    weatherLog(world, "The rain hisses your torch out.");
  }
}

export function tickWeather(world: World, dt: number) {
  const wx = ensureWeather(world);
  const dtHours = dt / SECONDS_PER_HOUR;

  if (world.hour >= wx.untilHour) rollNext(world, wx);

  const meta = WEATHER_META[wx.kind];
  const rain = rainRate(world);

  const cloudStep = CLOUD_EASE * dtHours;
  wx.cloud += Math.sign(meta.cloud - wx.cloud) * Math.min(Math.abs(meta.cloud - wx.cloud), cloudStep);
  const windStep = WIND_EASE * dtHours;
  wx.wind += Math.sign(meta.wind - wx.wind) * Math.min(Math.abs(meta.wind - wx.wind), windStep);

  if (rain > 0) {
    wx.wet = Math.min(1, wx.wet + WET_RATE * rain * dtHours);
  } else {
    const sun = meta.cloud < 0.4 ? 1.4 : 1;
    wx.wet = Math.max(0, wx.wet - DRY_RATE * sun * (1 + wx.wind) * dtHours);
  }

  tickTorch(world, wx, rain);
}

/** Whether wild small game bolts for cover. Wolves and wights don't mind the wet. */
export function sheltering(world: World): boolean {
  const wx = world.weather;
  return Boolean(wx && (wx.kind === "rain" || wx.kind === "storm"));
}

/** Snapshot view for the HUD. */
export function weatherSnap(world: World) {
  const wx = ensureWeather(world);
  return { kind: wx.kind, cloud: wx.cloud, wet: wx.wet, label: WEATHER_META[wx.kind].label };
}
