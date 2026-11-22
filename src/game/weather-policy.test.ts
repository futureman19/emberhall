import assert from "node:assert/strict";
import test from "node:test";
import { emptyChest, emptyLastGain, emptyPack, emptySkills, SECONDS_PER_HOUR } from "./catalog.ts";
import { createResourceInventory } from "./inventory/resources.ts";
import { ensureWeather, initialWeather, rainRate, sheltering, tickWeather, WEATHER_META } from "./weather.ts";
import { createWorld } from "./world.ts";
import { ensureHoles } from "./digging.ts";
import type { World } from "./types.ts";

/**
 * C1d ownership lock: weather is world-global singular (controller policy,
 * t_f37cd205). One authoritative sim, one world.weather record, the legacy
 * solo douse deadline, deterministic rolls, repaired stale state. These tests
 * characterize the approved boundary; they are expected to pass on first run.
 * See docs/actor-ownership-weather-ai.md.
 */

/** Bare-minimum world for the weather machine (same shape as weather.test.ts). */
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
    campfires: [],
    herbs: [],
    zones: [],
    buildings: [],
    plots: [],
    saplings: [],
    plantedTimber: {},
    placedObjects: [],
    structures: [],
    blueprints: [],
    player: {
      id: "p1",
      skills: emptySkills(),
      lastGain: emptyLastGain(),
      pack: emptyPack(),
      resources: createResourceInventory(),
      chest: emptyChest(),
      wear: {},
      rares: [],
      wearRare: {},
      vault: 0,
      notoriety: "innocent",
      criminalUntil: 0,
      intent: { kind: "none", tx: 0, ty: 0, targetId: null, spell: null },
      mana: 0,
      nightSightUntil: 0,
      poisonUntil: 0,
      poisonTickAt: 0,
      blessUntil: 0,
      invisUntil: 0,
      ironwoodUntil: 0,
      flyUntil: 0,
      armedSpell: null,
      armedTechnique: null,
      techniqueCoolUntil: {},
      lastBittenAt: 0,
      lastStrikeAt: 0,
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
    resourceNodes: {},
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

test("a regime never rolls early; one roll lands inside a valid kind with a bark", () => {
  const w = bareWorld(21);
  const before = { kind: w.weather.kind, until: w.weather.untilHour, rolls: w.weather.rolls };
  // Time before the deadline: many small ticks may not change the regime.
  let hour = w.hour;
  while (hour < before.until - 0.05) {
    hour += 0.04;
    w.hour = hour;
    w.tickCount += 1;
    tickWeather(w, 0.04 * SECONDS_PER_HOUR);
    assert.equal(w.weather.kind, before.kind, "no early roll");
    assert.equal(w.weather.rolls, before.rolls, "rolls untouched before the deadline");
  }
  // Cross the deadline exactly once: a single new roll, a real kind, a bark.
  w.hour = before.until + 0.01;
  w.tickCount += 1;
  tickWeather(w, 0.02 * SECONDS_PER_HOUR);
  assert.equal(w.weather.rolls, before.rolls + 1, "exactly one roll");
  assert.ok(w.weather.kind in WEATHER_META, `valid regime: ${w.weather.kind}`);
  assert.ok(w.weather.untilHour > w.hour, "the new regime has its own future deadline");
  assert.ok(w.log.some((l) => Object.values(WEATHER_META).some((m) => m.bark === l.text)), "the vale spoke of it");
});

test("wetness follows falling rain and dries under an open sky, never the reverse", () => {
  const w = bareWorld(33);
  w.weather.kind = "rain";
  w.weather.cloud = 1;
  w.weather.untilHour = w.hour + 500;
  let prev = w.weather.wet;
  for (let i = 0; i < 40; i++) {
    w.hour += 0.05;
    tickWeather(w, 0.05 * SECONDS_PER_HOUR);
    assert.ok(w.weather.wet >= prev, `wet rises in rain: ${prev} -> ${w.weather.wet}`);
    prev = w.weather.wet;
  }
  assert.ok(prev > 0.5, `soaked through: ${prev}`);
  w.weather.kind = "clear";
  w.weather.cloud = 0.06;
  for (let i = 0; i < 40; i++) {
    const before = w.weather.wet;
    w.hour += 0.05;
    tickWeather(w, 0.05 * SECONDS_PER_HOUR);
    assert.ok(w.weather.wet <= before, `drying under clear sky: ${before} -> ${w.weather.wet}`);
  }
  // Grey but dry cover never wets the ground.
  const dry = bareWorld(34);
  dry.weather.kind = "cloudy";
  dry.weather.cloud = 0.78;
  dry.weather.wet = 0.4;
  dry.weather.untilHour = dry.hour + 500;
  dry.hour += 0.05;
  tickWeather(dry, 0.05 * SECONDS_PER_HOUR);
  assert.ok(dry.weather.wet < 0.4, "no rain, no wetting");
});

test("only real rain (rate >= 0.35) fills open holes; a drizzle leaves them", () => {
  const w = createWorld(51);
  // A quiet grass tile far from civic footprints and farm plots.
  let tx = -1, ty = -1;
  outer: for (let y = 90; y < 150; y++) {
    for (let x = 380; x < 470; x++) {
      if (w.tiles[y]?.[x]?.kind !== "grass") continue;
      if (!w.buildings.every((b) => Math.abs(b.tx - x) > 6 || Math.abs(b.ty - y) > 6)) continue;
      if (!w.plots.every((pl) => Math.abs(pl.tx - x) > 4 || Math.abs(pl.ty - y) > 4)) continue;
      tx = x; ty = y; break outer;
    }
  }
  assert.ok(tx > 0, "found a quiet grass tile");
  const tile = w.tiles[ty]![tx]!;
  const origH = tile.h;
  const key = `${tx},${ty}`;
  tile.kind = "pit";
  tile.h = origH - 1;
  w.scars[key] = { kind: "pit", h: origH - 1 };
  ensureHoles(w)[key] = { kind: "grass", h: origH, open: true };

  w.weather.kind = "rain";
  w.weather.untilHour = w.hour + 500;
  w.weather.cloud = 0.65; // drizzle: cover 0.25 -> rate ~0.16
  assert.ok(rainRate(w) < 0.35, `drizzle rate ${rainRate(w)}`);
  w.hour += 0.02;
  tickWeather(w, 0.02 * SECONDS_PER_HOUR);
  assert.equal(tile.kind, "pit", "a drizzle never fills");
  assert.ok(w.holes![key]?.open, "hole record survives a drizzle");

  w.weather.cloud = 1; // downpour: rate 0.65
  assert.ok(rainRate(w) >= 0.35, `downpour rate ${rainRate(w)}`);
  w.hour += 0.02;
  tickWeather(w, 0.02 * SECONDS_PER_HOUR);
  assert.equal(tile.kind, "grass", "the rain filled the hole");
  assert.equal(tile.h, origH);
  assert.equal(w.holes![key], undefined, "hole record washed away");
  assert.equal(w.scars[key], undefined, "scar restored");
  assert.ok(w.log.some((l) => l.text.includes("rain fills")), "the vale noted the filling");
});

test("the torch deadline arms once, clears on unequip, and rearms on a fresh hold", () => {
  const w = bareWorld(11);
  w.player.wear.main = "torch";
  w.weather.kind = "rain";
  w.weather.cloud = 1;
  w.weather.untilHour = w.hour + 500;
  assert.ok(rainRate(w) >= 0.25, "the rain is real");

  w.tickCount += 1;
  tickWeather(w, 0.01 * SECONDS_PER_HOUR);
  const armed = w.weather.douseHour;
  assert.ok(armed > w.hour, `deadline armed ahead: ${armed}`);

  // Held steady: the armed deadline is stable, not re-rolled per tick.
  w.hour += 0.01;
  w.tickCount += 1;
  tickWeather(w, 0.01 * SECONDS_PER_HOUR);
  assert.equal(w.weather.douseHour, armed, "one armed deadline, not a re-roll");

  // Unequip clears it; idle ticks keep it cleared.
  w.player.wear.main = undefined;
  w.hour += 0.01;
  w.tickCount += 1;
  tickWeather(w, 0.01 * SECONDS_PER_HOUR);
  assert.equal(w.weather.douseHour, 0, "unequip clears the deadline");

  // A fresh hold arms a fresh deadline, which then fires on schedule.
  w.player.wear.main = "torch";
  w.tickCount += 1;
  tickWeather(w, 0.01 * SECONDS_PER_HOUR);
  const rearmed = w.weather.douseHour;
  assert.ok(rearmed > w.hour, "fresh hold, fresh deadline");
  w.hour = rearmed + 0.001;
  w.tickCount += 1;
  tickWeather(w, 0.01 * SECONDS_PER_HOUR);
  assert.equal(w.player.wear.main, undefined, "the rain hissed it out");
  assert.equal(w.weather.douseHour, 0, "deadline consumed");
  assert.ok(w.log.some((l) => l.text.includes("hisses")), "the vale noted it");
});

test("a stale or malformed deadline is repaired or rearmed, never silently honored", () => {
  const w = bareWorld(13);
  w.weather.douseHour = Number.NaN;
  ensureWeather(w);
  assert.equal(w.weather.douseHour, 0, "NaN deadline repaired");

  // A negative stale deadline from an old save does not instantly douse a
  // fresh torch; the next tick rearms a proper future deadline.
  w.player.wear.main = "torch";
  w.weather.kind = "rain";
  w.weather.cloud = 1;
  w.weather.untilHour = w.hour + 500;
  w.weather.douseHour = -5;
  w.tickCount += 1;
  tickWeather(w, 0.01 * SECONDS_PER_HOUR);
  assert.ok(w.weather.douseHour > w.hour, `stale deadline rearmed: ${w.weather.douseHour}`);
  assert.equal(w.player.wear.main, "torch", "no retroactive douse");

  // A garbage regime reseeds the whole record; NaN deadlines do not persist.
  const broken = bareWorld(17);
  // @ts-expect-error simulate a corrupt save
  broken.weather.kind = "hail";
  broken.weather.untilHour = Number.NaN;
  const repaired = ensureWeather(broken);
  assert.ok(repaired.kind in WEATHER_META, `reseeds a valid regime: ${repaired.kind}`);
  assert.ok(Number.isFinite(repaired.douseHour) && Number.isFinite(repaired.untilHour));
});

test("sheltering reads the regime, not the wetness: only rain and storm count", () => {
  const w = bareWorld(3);
  for (const kind of ["clear", "fair", "cloudy"] as const) {
    w.weather.kind = kind;
    assert.equal(sheltering(w), false, `${kind} is not shelter weather`);
  }
  for (const kind of ["rain", "storm"] as const) {
    w.weather.kind = kind;
    assert.equal(sheltering(w), true, `${kind} drives small game to cover`);
  }
});
