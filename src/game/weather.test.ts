import assert from "node:assert/strict";
import test from "node:test";
import { emptyChest, emptyLastGain, emptyPack, emptySkills } from "./catalog.ts";
import { ensureWeather, initialWeather, rainRate, tickWeather, weatherSnap } from "./weather.ts";
import type { World } from "./types.ts";

/** Bare-minimum world for the weather machine (no tiles, no people). */
function bareWorld(seed = 7): World {
  return {
    seed,
    hour: 8,
    speed: 1,
    gold: 0,
    prestige: 0,
    tiles: [],
    people: [],
    fauna: [],
    piles: [],
    buildings: [],
    plots: [],
    player: {
      id: "p1",
      skills: emptySkills(),
      lastGain: emptyLastGain(),
      pack: emptyPack(),
      chest: emptyChest(),
      wear: {},
      vault: 0,
      notoriety: "innocent",
      criminalUntil: 0,
      intent: { kind: "none", tx: 0, ty: 0, targetId: null, spell: null },
      mana: 0,
      nightSightUntil: 0,
      armedSpell: null,
      marks: [],
      gateCoolUntil: 0,
      ghost: false,
      corpseAt: null,
      workT: 0,
    },
    log: [],
    objectives: [],
    quests: [],
    rep: {},
    scars: {},
    seen: {},
    seenRev: 0,
    landRev: 1,
    tickCount: 0,
    restored: false,
    weather: initialWeather(seed, 8),
    boom: null,
    nightOffer: null,
  };
}

/** Tick until `rolls` transitions have happened (fast-forwarding the clock). */
function runRegimes(w: World, rolls: number) {
  const seen: string[] = [w.weather.kind];
  while (w.weather.rolls < rolls) {
    w.hour += 0.25;
    tickWeather(w, 36); // one full world hour per call
    if (w.weather.kind !== seen[seen.length - 1]) seen.push(w.weather.kind);
  }
  return seen;
}

test("the sky is deterministic for a given seed", () => {
  const a = bareWorld(42);
  const b = bareWorld(42);
  const seqA = runRegimes(a, 40);
  const seqB = runRegimes(b, 40);
  assert.deepEqual(seqA, seqB);
  assert.ok(seqA.length > 5, "weather actually changes");
});

test("different seeds drift different skies", () => {
  const seqA = runRegimes(bareWorld(1), 30);
  const seqB = runRegimes(bareWorld(999), 30);
  assert.notDeepEqual(seqA, seqB);
});

test("cloud, wet and wind stay inside 0..1 forever", () => {
  const w = bareWorld(5);
  for (let i = 0; i < 4000; i++) {
    w.hour += 0.05;
    tickWeather(w, 1.8);
    const wx = w.weather;
    assert.ok(wx.cloud >= 0 && wx.cloud <= 1, `cloud ${wx.cloud}`);
    assert.ok(wx.wet >= 0 && wx.wet <= 1, `wet ${wx.wet}`);
    assert.ok(wx.wind >= 0 && wx.wind <= 1, `wind ${wx.wind}`);
  }
});

test("rain falls only under thick cover, never from a clear sky", () => {
  const w = bareWorld(3);
  w.weather.kind = "clear";
  w.weather.cloud = 0.06;
  assert.equal(rainRate(w), 0);
  w.weather.kind = "rain";
  w.weather.cloud = 0.6;
  const light = rainRate(w);
  w.weather.cloud = 1;
  const heavy = rainRate(w);
  assert.ok(light > 0 && heavy > light, `rain eases in with cover: ${light} < ${heavy}`);
  w.weather.kind = "storm";
  w.weather.cloud = 1;
  assert.equal(rainRate(w), 1);
});

test("the rain hisses a held torch out, and leaves sheathed ones alone", () => {
  const w = bareWorld(11);
  w.player.wear.main = "torch";
  w.weather.kind = "rain";
  w.weather.cloud = 1;
  w.weather.untilHour = w.hour + 50; // hold the regime
  for (let i = 0; i < 200 && w.player.wear.main === "torch"; i++) {
    w.hour += 0.02;
    w.tickCount += 1;
    tickWeather(w, 0.72);
  }
  assert.equal(w.player.wear.main, undefined);
  assert.ok(w.log.some((l) => l.text.includes("torch")), "the vale noted it");

  const dry = bareWorld(11);
  dry.player.wear.main = "torch";
  dry.weather.kind = "cloudy";
  dry.weather.cloud = 0.8;
  dry.weather.untilHour = dry.hour + 50;
  for (let i = 0; i < 200; i++) {
    dry.hour += 0.02;
    tickWeather(dry, 0.72);
  }
  assert.equal(dry.player.wear.main, "torch");
});

test("ensureWeather repairs old and broken saves", () => {
  const w = bareWorld(13);
  // @ts-expect-error simulate a pre-weather save
  w.weather = undefined;
  const wx = ensureWeather(w);
  assert.ok(["clear", "fair", "cloudy", "rain", "storm"].includes(wx.kind), `valid opening kind: ${wx.kind}`);
  w.weather.kind = "storm";
  w.weather.cloud = Number.NaN;
  ensureWeather(w);
  assert.equal(w.weather.cloud, 1);
  assert.equal(weatherSnap(w).label, "Storm");
});
