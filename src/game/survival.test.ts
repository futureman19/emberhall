/**
 * Water-survival slice — focused contract tests (t_77f1af48).
 * Contract: docs/water-survival-slice.md. Covers player thirst/drink/drowning
 * transitions, reflex recognition + safe responses, persistence v7, the shard
 * drink verb wire, and food-decay regression anchors. Deterministic stub
 * worlds only; no paid providers, no network.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SECONDS_PER_HOUR } from "./catalog.ts";
import { verbsFor } from "./context.ts";
import { setWorld } from "./live.ts";
import { commandDrinkWater, tickPlayer } from "./player.ts";
import { tickWorld } from "./sim.ts";
import { decodeSave, encodeSave } from "./save.ts";
import { createShard, shardConfig, validateVerb } from "../server/shard.ts";
import { hydrateWorld } from "../server/hydrate.ts";
import { bodySheet, observeLive } from "./agent/observe.ts";
import { DEFAULT_EVENT_CONFIG, createDeriveState, deriveEvents } from "./agent/events.ts";
import { riskStillRelevant, unresolvedRisk } from "./agent/risk.ts";
import { createReflexAutopilot, type ObservationSource } from "./agent/autopilot.ts";
import { createStubBackend } from "./agent/stub.ts";
import { DEFAULT_CADENCE, type Observation, type ReflexExchange } from "./agent/types.ts";
import type { AgentIntent } from "./agent/types.ts";
import {
  DRINK_RESTORE,
  THIRST_START,
  nearestWater,
  shoreBesideWater,
  tickWaterSurvival,
  waterStatus,
} from "./survival.ts";
import { createPerson, createStubWorld } from "./world.ts";
import type { Person, World } from "./types.ts";

/** Stub vale: grass everywhere, one pond tile east of the body at (40,40). */
function waterWorld(thirst = THIRST_START): World {
  const world = createStubWorld();
  const player = createPerson(world, () => 0.5, {
    x: 40,
    z: 40,
    cls: "ranger",
    member: true,
    isPlayer: true,
  });
  world.player.id = player.id;
  world.people.push(player);
  // Mirror shard admission (src/server/shard.ts): the admitted actor's state
  // is projected into playerStates so save round-trips exercise the alias.
  world.playerStates![player.id] = { ...structuredClone(world.player), id: player.id };
  world.tiles[40]![41]!.kind = "water";
  player.thirst = thirst;
  return world;
}

function body(world: World): Person {
  return world.people.find((p) => p.isPlayer)!;
}

function drinkUntilDone(world: World, maxTicks = 400): void {
  for (let i = 0; i < maxTicks && world.player.intent.kind !== "none"; i++) {
    // tickPlayer resolves the drink once the body is beside the water; tickWorld
    // supplies the followPath movement that walks a distant body to the shore.
    tickPlayer(world, 0.1);
    if ((world.player.intent.kind as string) !== "none") tickWorld(world, 0.1);
  }
}

/** Minimal observation factory mirroring agent/autopilot.test.ts makeObs. */
function obsWith(you: Partial<Observation["you"]> = {}): Observation {
  return {
    tick: 0,
    hour: 10,
    isNight: false,
    weather: { kind: "clear", cloud: 0, wet: 0, wind: 0 },
    you: {
      id: "you",
      name: "You",
      x: 0,
      z: 0,
      hp: 30,
      maxHp: 30,
      hunger: 100,
      thirst: 80,
      inWater: false,
      drowning: false,
      energy: 100,
      ghost: false,
      mana: 10,
      notoriety: "innocent",
      skills: {},
      pack: {},
      wear: {},
      vault: 0,
      ...you,
    },
    people: [],
    fauna: [],
    piles: [],
    buildings: [],
    plots: [],
    herbs: [],
    water: null,
    verbs: [],
    logTail: [],
  };
}

function waterObs(thirst: number, inWater = false): Observation {
  const obs = obsWith({ thirst, inWater, drowning: inWater });
  obs.water = {
    nearest: { tx: 41, ty: 40, dist: 1 },
    shore: { tx: 42, ty: 40 },
    escape: inWater ? { tx: 42, ty: 40 } : null,
  };
  return obs;
}

function makeSource() {
  const cbs = new Set<(obs: Observation) => void>();
  const source: ObservationSource = {
    subscribe(cb) {
      cbs.add(cb);
      return () => {
        cbs.delete(cb);
      };
    },
  };
  return {
    source,
    push(obs: Observation) {
      for (const cb of [...cbs]) cb(obs);
    },
  };
}

const FAST_CADENCE = { riskGated: false, cadence: { ...DEFAULT_CADENCE, reflexCooldownTicks: 0 } };

// --- Player transitions ---------------------------------------------------

test("thirst - fresh bodies start at 80 and decay 4.8/vale-hour beside hunger's 3.2", () => {
  const world = waterWorld();
  const p = body(world);
  assert.equal(p.thirst, THIRST_START);
  const hungerBefore = p.hunger;
  for (let i = 0; i < SECONDS_PER_HOUR * 10; i++) tickWorld(world, 0.1);
  assert.ok(Math.abs(p.thirst - (THIRST_START - 4.8)) < 1e-6, `thirst ${p.thirst}`);
  assert.ok(Math.abs(p.hunger - (hungerBefore - 3.2)) < 1e-6, `hunger ${p.hunger}`);
});

test("thirst - sleepers and ghosts do not decay", () => {
  const world = waterWorld();
  const p = body(world);
  p.task = "sleep";
  for (let i = 0; i < SECONDS_PER_HOUR * 10; i++) tickWorld(world, 0.1);
  assert.equal(p.thirst, THIRST_START);
  p.task = "idle";
  p.ghost = true;
  for (let i = 0; i < SECONDS_PER_HOUR * 10; i++) tickWorld(world, 0.1);
  assert.equal(p.thirst, THIRST_START);
});

test("drink - the verb is offered on water tiles only", () => {
  const world = waterWorld();
  setWorld(world);
  assert.ok(verbsFor({ kind: "tile", id: "41,40", tx: 41, ty: 40, label: "water" }).some((e) => e.verb === "drink"));
  assert.ok(!verbsFor({ kind: "tile", id: "40,40", tx: 40, ty: 40, label: "grass" }).some((e) => e.verb === "drink"));
});

test("drink - refusals: dry land, struggling in water, ghosts, closed shore", () => {
  const world = waterWorld();
  setWorld(world);
  const p = body(world);
  assert.equal(commandDrinkWater(world, 40, 40), "There is no water there.");
  p.x = 41;
  p.z = 40;
  assert.equal(commandDrinkWater(world, 41, 40), "You cannot drink while struggling in the water.");
  p.x = 40;
  p.z = 40;
  p.ghost = true;
  assert.equal(commandDrinkWater(world, 41, 40), "A ghost cannot.");
  p.ghost = false;
  // Wall every shore tile so no walkable approach exists. The body must start
  // beyond the shore ring: pathBeside accepts an already-adjacent body without
  // pathfinding, so standing at (40,40) would drink straight through the wall.
  // kindWalk only bars water/wall/rock — trees are walkable, so use "wall".
  p.x = 38;
  p.z = 40;
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
    world.tiles[40 + dy]![41 + dx]!.kind = "wall";
  }
  assert.equal(commandDrinkWater(world, 41, 40), "The shore is closed.");
});

test("drink - adjacent shore restores 40, capped at 100, and logs", () => {
  const world = waterWorld(30);
  setWorld(world);
  assert.equal(commandDrinkWater(world, 41, 40), null);
  assert.equal(world.player.intent.kind, "drink");
  drinkUntilDone(world, 32);
  assert.equal(world.player.intent.kind, "none");
  assert.equal(body(world).thirst, 30 + DRINK_RESTORE);
  assert.ok(world.log.some((l) => l.text.includes("drink")));

  const full = waterWorld(80);
  setWorld(full);
  assert.equal(commandDrinkWater(full, 41, 40), null);
  drinkUntilDone(full, 32);
  assert.equal(body(full).thirst, 100);
});

test("drink - a distant pond walks the body to the shore first", () => {
  const world = waterWorld(20);
  setWorld(world);
  world.tiles[40]![41]!.kind = "grass";
  world.tiles[40]![44]!.kind = "water";
  assert.equal(commandDrinkWater(world, 44, 40), null);
  drinkUntilDone(world);
  assert.equal(world.player.intent.kind, "none");
  // The walk to the shore costs a little thirst to decay; the drink still adds 40.
  assert.ok(Math.abs(body(world).thirst - (20 + DRINK_RESTORE)) < 1, `thirst ${body(world).thirst}`);
  assert.equal(Math.round(body(world).x), 43);
});

test("dehydration - zero thirst beats 1 HP per 0.25h and routes death through die()", () => {
  const world = waterWorld(0);
  const p = body(world);
  p.hp = 5;
  world.hour = 10;
  const deaths: string[] = [];
  const die = (q: Person) => {
    deaths.push(q.id);
    q.ghost = true;
    return "You collapse.";
  };
  const beat = () => tickWaterSurvival(world, p, { flyUntil: 0, die });
  assert.equal(beat(), null); // arms the first beat at 10.25
  world.hour = 10.24;
  assert.equal(beat(), null);
  assert.equal(p.hp, 5);
  world.hour = 10.25;
  assert.equal(beat(), "Dehydration drains you.");
  assert.equal(p.hp, 4);
  world.hour = 10.5;
  assert.equal(beat(), "Dehydration drains you.");
  assert.equal(p.hp, 3);
  p.hp = 1;
  world.hour = 10.75;
  assert.equal(beat(), "You collapse.");
  assert.deepEqual(deaths, [p.id]);
  assert.ok(p.ghost);
});

test("dehydration - sleepers at zero thirst take no damage", () => {
  const world = waterWorld(0);
  const p = body(world);
  p.hp = 5;
  p.task = "sleep";
  world.hour = 10;
  tickWaterSurvival(world, p, { flyUntil: 0, die: () => null });
  world.hour = 12;
  assert.equal(tickWaterSurvival(world, p, { flyUntil: 0, die: () => null }), null);
  assert.equal(p.hp, 5);
});

test("drowning - 0.5h grace, 2 HP per 0.1h, escape resets, fly and sleep guard", () => {
  const world = waterWorld();
  const p = body(world);
  p.x = 41;
  p.z = 40;
  p.hp = 20;
  world.hour = 10;
  const deaths: string[] = [];
  const die = (q: Person) => {
    deaths.push(q.id);
    q.ghost = true;
    return "You collapse.";
  };
  const beat = (flyUntil = 0) => tickWaterSurvival(world, p, { flyUntil, die });
  assert.equal(beat(), "You are in over your head — reach shore!");
  assert.equal(p.hp, 20);
  assert.deepEqual(waterStatus(world, p, 0), { inWater: true, drowning: false });
  world.hour = 10.49;
  assert.equal(beat(), null);
  assert.equal(p.hp, 20);
  world.hour = 10.5;
  assert.equal(beat(), "The water drags you under.");
  assert.equal(p.hp, 18);
  assert.deepEqual(waterStatus(world, p, 0), { inWater: true, drowning: true });
  world.hour = 10.6;
  assert.equal(beat(), "The water drags you under.");
  assert.equal(p.hp, 16);
  // Escape to shore resets the clock and stops the damage.
  p.x = 40;
  p.z = 40;
  world.hour = 10.7;
  assert.equal(beat(), null);
  assert.deepEqual(waterStatus(world, p, 0), { inWater: false, drowning: false });
  assert.equal(p.hp, 16);
  // Aloft on fly: no drowning even over water; lapsing starts a fresh grace.
  p.x = 41;
  p.z = 40;
  world.hour = 10.8;
  assert.equal(beat(11), null);
  assert.deepEqual(waterStatus(world, p, 11), { inWater: false, drowning: false });
  assert.equal(p.hp, 16);
  world.hour = 11;
  assert.equal(beat(11), "You are in over your head — reach shore!");
  assert.equal(p.hp, 16);
  world.hour = 11.5;
  assert.equal(beat(11), "The water drags you under.");
  assert.equal(p.hp, 14);
  p.hp = 2;
  world.hour = 11.6;
  assert.equal(beat(11), "You collapse.");
  assert.deepEqual(deaths, [p.id]);
});

test("drowning - a sleeper on water does not drown", () => {
  const world = waterWorld();
  const p = body(world);
  p.x = 41;
  p.z = 40;
  p.task = "sleep";
  world.hour = 10;
  assert.equal(tickWaterSurvival(world, p, { flyUntil: 0, die: () => null }), null);
  world.hour = 12;
  assert.equal(tickWaterSurvival(world, p, { flyUntil: 0, die: () => null }), null);
  assert.deepEqual(waterStatus(world, p, 0), { inWater: false, drowning: false });
});

test("water awareness - nearestWater and shoreBesideWater", () => {
  const world = waterWorld();
  assert.deepEqual(nearestWater(world, 40, 40), { tx: 41, ty: 40, dist: 1 });
  assert.deepEqual(shoreBesideWater(world, 41, 40), { tx: 42, ty: 40 });
  assert.equal(nearestWater(world, 0, 0), null, "outside the 24-tile observation radius");
  assert.equal(nearestWater(createStubWorld(), 40, 40), null, "a dry vale has no water");
});

// --- Observation layer ----------------------------------------------------

test("observation - bodySheet carries thirst and water flags; observe exposes nearest/shore/escape", () => {
  const world = waterWorld(55);
  setWorld(world);
  const sheet = bodySheet(world);
  assert.equal(sheet.thirst, 55);
  assert.equal(sheet.inWater, false);
  assert.equal(sheet.drowning, false);
  const obs = observeLive();
  assert.deepEqual(obs.water!.nearest, { tx: 41, ty: 40, dist: 1 });
  assert.deepEqual(obs.water!.shore, { tx: 42, ty: 40 });
  assert.equal(obs.water!.escape, null);
  const p = body(world);
  p.x = 41;
  p.z = 40;
  const wet = observeLive();
  assert.equal(wet.you.inWater, true);
  assert.deepEqual(wet.water!.escape, { tx: 42, ty: 40 });
});

// --- Reflex recognition and safe responses --------------------------------

test("events - thirst and water crossings fire once per crossing", () => {
  const state = createDeriveState();
  state.prev = obsWith({ thirst: 26 });
  const low = deriveEvents(state, obsWith({ thirst: 25 }));
  assert.ok(low.some((e) => e.kind === "vitals.thirst_low"));
  assert.ok(!low.some((e) => e.kind === "vitals.thirst_critical"));
  state.prev = obsWith({ thirst: 25 });
  const still = deriveEvents(state, obsWith({ thirst: 24 }));
  assert.ok(!still.some((e) => e.kind === "vitals.thirst_low"), "no re-fire without a crossing");
  state.prev = obsWith({ thirst: 11 });
  assert.ok(deriveEvents(state, obsWith({ thirst: 10 })).some((e) => e.kind === "vitals.thirst_critical"));
  state.prev = obsWith({ inWater: false, drowning: false });
  const wet = deriveEvents(state, obsWith({ inWater: true, drowning: true }));
  assert.ok(wet.some((e) => e.kind === "vitals.in_water"));
  assert.ok(wet.some((e) => e.kind === "vitals.drowning"));
});

test("risk - thirst critical and open water are unresolved risks with relevance rules", () => {
  const dry = obsWith({ thirst: 5 });
  assert.ok(unresolvedRisk(dry, DEFAULT_EVENT_CONFIG).includes("thirst needs water"));
  assert.ok(unresolvedRisk(obsWith({ inWater: true }), DEFAULT_EVENT_CONFIG).includes("body in open water"));
  const state = createDeriveState();
  state.prev = obsWith({ thirst: 26 });
  const events = deriveEvents(state, obsWith({ thirst: 9, inWater: true, drowning: true }));
  const active = obsWith({ thirst: 9, inWater: true, drowning: true });
  for (const kind of ["vitals.thirst_low", "vitals.thirst_critical", "vitals.in_water", "vitals.drowning"] as const) {
    const event = events.find((e) => e.kind === kind);
    assert.ok(event, `${kind} fired`);
    assert.ok(riskStillRelevant(event, active, DEFAULT_EVENT_CONFIG), `${kind} relevant while active`);
  }
  const recovered = obsWith({ thirst: 80 });
  assert.ok(!riskStillRelevant(events.find((e) => e.kind === "vitals.thirst_low")!, recovered, DEFAULT_EVENT_CONFIG));
  assert.ok(!riskStillRelevant(events.find((e) => e.kind === "vitals.in_water")!, recovered, DEFAULT_EVENT_CONFIG));
});

test("autopilot - thirst_low offers drink + walk-to-water and the stub drinks", async () => {
  const feed = makeSource();
  let current = waterObs(26);
  const verbCalls: { verb: string; item: string | null; tx?: number | null; ty?: number | null }[] = [];
  const backend = createStubBackend();
  const auto = createReflexAutopilot({
    config: FAST_CADENCE,
    backend,
    source: feed.source,
    observe: () => current,
    submit: () => null,
    verb: (req) => {
      verbCalls.push(req);
      return null;
    },
  });
  auto.start();
  feed.push(current);
  await auto.settled();
  current = waterObs(20);
  feed.push(current);
  await auto.settled();
  const last = backend.calls[backend.calls.length - 1] as ReflexExchange;
  const q = last.questions[0]!;
  assert.equal(q.type, "choice");
  if (q.type !== "choice") return;
  assert.ok(q.options.some((o) => o.startsWith("Drink from the water")), JSON.stringify(q.options));
  assert.ok(q.options.some((o) => o.startsWith("Walk to the water")), JSON.stringify(q.options));
  const state = last.state as { triggers: { kind: string }[] };
  assert.ok(state.triggers.some((t) => t.kind === "vitals.thirst_low"));
  assert.deepEqual(verbCalls[verbCalls.length - 1], { verb: "drink", item: null, tx: 41, ty: 40 });
  auto.stop();
});

test("autopilot - drowning scrambles to shore and outranks any drink offer", async () => {
  const feed = makeSource();
  let current = waterObs(26);
  const submitted: AgentIntent[] = [];
  const backend = createStubBackend();
  const auto = createReflexAutopilot({
    config: FAST_CADENCE,
    backend,
    source: feed.source,
    observe: () => current,
    submit: (intent) => {
      submitted.push(intent);
      return null;
    },
    verb: () => null,
  });
  auto.start();
  feed.push(current);
  await auto.settled();
  current = waterObs(9, true);
  feed.push(current);
  await auto.settled();
  const last = backend.calls[backend.calls.length - 1] as ReflexExchange;
  const q = last.questions[0]!;
  assert.equal(q.type, "choice");
  if (q.type !== "choice") return;
  assert.ok(q.options.some((o) => o.startsWith("Scramble to shore")), JSON.stringify(q.options));
  assert.ok(!q.options.some((o) => o.startsWith("Drink")), "no drink offer while struggling in water");
  assert.deepEqual(submitted[submitted.length - 1], { kind: "walk", tx: 42, ty: 40, targetId: null, spell: null });
  auto.stop();
});

test("autopilot - no synthetic drink offer above the offer threshold", async () => {
  const feed = makeSource();
  const current = waterObs(80);
  // Pack food keeps the exchange alive (two options); above the offer
  // threshold the water options must stay out of it entirely.
  current.you.pack = { trail_rations: 2 };
  const backend = createStubBackend();
  const auto = createReflexAutopilot({
    config: FAST_CADENCE,
    backend,
    source: feed.source,
    observe: () => current,
    submit: () => null,
  });
  auto.start();
  feed.push(current);
  await auto.settled();
  const last = backend.calls[backend.calls.length - 1] as ReflexExchange;
  const q = last.questions[0]!;
  assert.equal(q.type, "choice");
  if (q.type !== "choice") return;
  assert.ok(!q.options.some((o) => o.startsWith("Drink")), JSON.stringify(q.options));
  assert.ok(!q.options.some((o) => o.startsWith("Walk to the water")), JSON.stringify(q.options));
  assert.deepEqual(q.options, ["Eat Trail rations from pack", "Rest / remain idle"]);
  auto.stop();
});

// --- Persistence ----------------------------------------------------------

test("save v7 - round-trips thirst, migrates v6 absent thirst to 80, rejects malformed bodies", () => {
  const world = waterWorld(37);
  const payload = JSON.parse(encodeSave(world));
  assert.equal(payload.saveVersion, 7);
  // Thirst lives on the Person record (people), not the PlayerState projection.
  assert.equal(payload.people[0].thirst, 37);
  const restored = decodeSave(JSON.stringify(payload));
  assert.ok(restored);
  assert.equal(restored.people.find((p) => p.id === restored.player.id)!.thirst, 37);

  delete payload.player.thirst;
  for (const person of payload.people) delete person.thirst;
  payload.saveVersion = 6;
  const migrated = decodeSave(JSON.stringify(payload));
  assert.ok(migrated);
  assert.equal(migrated.people.find((p) => p.id === migrated.player.id)!.thirst, THIRST_START);
  assert.ok(migrated.people.every((p) => p.thirst === THIRST_START));
  if (migrated.playerStates) {
    assert.equal(migrated.playerStates[migrated.player.id], migrated.player);
  }

  const bad = JSON.parse(encodeSave(waterWorld()));
  for (const person of bad.people) delete person.thirst;
  assert.equal(decodeSave(JSON.stringify(bad)), null, "a current-version body without thirst is rejected");
});

// --- Shard verb wire ------------------------------------------------------

test("shard verb wire - drink validates integer coordinates and restores thirst", (t) => {
  assert.equal(validateVerb({ verb: "drink" }), "Drink needs a water tile");
  assert.equal(validateVerb({ verb: "drink", tx: 41.5, ty: 40 }), "Drink needs a water tile");
  assert.equal(validateVerb({ verb: "drink", tx: 41, ty: 40 }), null);
  assert.equal(validateVerb({ verb: "eat", item: "bread" }), null);

  const dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "emberhall-water-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const config = shardConfig({ EMBERHALL_DATA_DIR: dir });
  const seedShard = createShard(config, { log: () => {} });
  const id = seedShard.resolveKey("dev-kett")!;
  assert.ok(id);
  const w = hydrateWorld(decodeSave(seedShard.checkpoint())!);
  const p = w.people.find((x) => x.id === id)!;
  // encodeSave persists tiles:null — the vale regenerates from the seed on
  // load, so hand-edited tiles never survive. Use the seed vale's own pond:
  // stand the body on its walkable shore and target the real water tile.
  const pond = nearestWater(w, p.x, p.z);
  assert.ok(pond, "the seed vale has water within observation range of the spawn");
  const shore = shoreBesideWater(w, pond.tx, pond.ty);
  assert.ok(shore);
  p.x = shore.tx;
  p.z = shore.ty;
  p.thirst = 20;
  // stop() checkpoints the seed world on the way out — write the modified
  // save AFTER it so the hand-edited thirst/position survive hydration.
  seedShard.stop();
  writeFileSync(join(dir, "shard-save.json"), encodeSave(w));

  const shard = createShard(config, { log: () => {} });
  assert.equal(shard.lastAppliedActionTick(id), null);
  assert.equal(shard.enqueueVerb(id, { verb: "drink" }), "Drink needs a water tile");
  // A reachable coordinate that is not water is admitted, then refused by the
  // sim. Neither that rejection nor passive thirst decay counts as an effect.
  assert.equal(shard.enqueueVerb(id, { verb: "drink", tx: shore.tx, ty: shore.ty }), null);
  shard.step(0.1);
  assert.equal(shard.lastAppliedActionTick(id), null, "rejected drink/passive decay is not an applied action");
  const rejectedTick = (JSON.parse(shard.checkpoint()) as World).tickCount;
  assert.equal(shard.enqueueVerb(id, { verb: "drink", tx: pond.tx, ty: pond.ty }), null);
  assert.equal(shard.lastAppliedActionTick(id), null, "queue admission is not an applied action");
  for (let i = 0; i < 60; i++) shard.step(0.1);
  assert.ok((shard.lastAppliedActionTick(id) ?? -1) > rejectedTick, "completed adjacent-shore drink records its authoritative effect");
  const after = JSON.parse(shard.checkpoint()) as World;
  const restored = after.people.find((x) => x.id === id)!;
  assert.ok(restored.thirst > 20, `thirst did not rise: ${restored.thirst}`);
  assert.ok(restored.thirst <= 60 + 1e-6, `thirst overshoot: ${restored.thirst}`);
  shard.stop();
});
