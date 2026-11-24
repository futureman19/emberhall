import assert from "node:assert/strict";
import test from "node:test";
import { createReflexScheduler, type AttemptRequest } from "./scheduler.ts";
import type { Observation } from "./types.ts";
import { BudgetGuard } from "./budget.ts";
import { createAttemptLog, foldAttempts } from "./attempts.ts";
import { createMeteredReflexBackend } from "./metered.ts";
import { createReflexAutopilot } from "./autopilot.ts";
import { DEFAULT_PRICE } from "./pricing.ts";
import { createWorld } from "../world.ts";
import { tickWorld } from "../sim.ts";
import { you, commandEat } from "../player.ts";
import { observeWorld } from "./observe.ts";
import { walkable } from "../pathfinding.ts";

function obs(tick: number, body: Partial<Observation["you"]> = {}): Observation {
  return { tick, hour: 12, isNight: false, weather: { kind: "clear", cloud: 0, wet: 0, wind: 0 },
    you: { id: "you", name: "You", x: 0, z: 0, hp: 40, maxHp: 40, hunger: 100, thirst: 80, inWater: false, drowning: false, energy: 100,
      ghost: false, mana: 10, notoriety: "innocent", skills: {}, pack: {}, wear: {}, vault: 0, ...body },
    people: [], fauna: [], piles: [], buildings: [], plots: [], herbs: [], verbs: [], logTail: [] };
}
async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
function probe() {
  const calls: AttemptRequest[] = [];
  const scheduler = createReflexScheduler({ thinker: { prepare: () => ({}), async execute(req) { calls.push(req); } } });
  return { scheduler, calls, async push(o: Observation) { scheduler.ingest(o); await flush(); } };
}

test("idle and harmless arrivals do not rearm paid work; hourly heartbeat does even on identical surface at night", async () => {
  const p = probe();
  await p.push(obs(0));
  p.scheduler.noteAction();
  for (let tick = 1; tick < 36000; tick += 100) {
    const o = obs(tick, { hunger: 100 - tick / 100000 });
    o.isNight = true; o.hour = 23; o.weather.kind = tick % 200 ? "rain" : "clear";
    o.fauna = [{ id: String(tick), kind: "deer", name: null, x: 1, z: 1, hp: 10, maxHp: 10, task: "idle", ownerId: null, dist: 1 }];
    await p.push(o);
  }
  assert.equal(p.calls.length, 1);
  const night = obs(36000); night.hour = 23; night.isNight = true;
  await p.push(night);
  assert.equal(p.calls.length, 2);
  assert.ok(p.calls[1]!.triggers.some(t => t.kind === "activity.heartbeat"));
  await p.push({ ...night, tick: 72000 });
  assert.equal(p.calls.length, 3, "heartbeat bypasses identical-surface dedupe");
  p.scheduler.stop();
});

test("hunger risk starts at 25, wakes at night, retries unresolved risk within 150 ticks and stops after recovery", async () => {
  const p = probe(); await p.push(obs(0));
  await p.push(obs(1, { hunger: 25.01 }));
  const risk = obs(2, { hunger: 25 }); risk.hour = 23; risk.isNight = true;
  await p.push(risk); assert.equal(p.calls.length, 1);
  await p.push({ ...risk, tick: 150 }); assert.equal(p.calls.length, 2);
  await p.push({ ...risk, tick: 300 }); assert.equal(p.calls.length, 3);
  await p.push(obs(301, { hunger: 57 }));
  await p.push(obs(450, { hunger: 56 }));
  assert.equal(p.calls.length, 3, "resolved risk must not leave a stale retry");
  p.scheduler.stop();
});

test("starting in critical risk at night cannot be silently dropped", async () => {
  for (const body of [{ hunger: 9 }, { hp: 9 }, { energy: 9 }]) {
    const p = probe(); const o = obs(0, body); o.hour = 23; o.isNight = true;
    await p.push(o); assert.equal(p.calls.length, 1); p.scheduler.stop();
  }
});

test("persistent engaged hostile retries; ghost does not buy endless critical-hp decisions", async () => {
  const p = probe(); const o = obs(0);
  o.fauna = [{ id: "wolf", kind: "wolf", name: null, x: 1, z: 1, hp: 10, maxHp: 10, task: "fight", ownerId: null, dist: 1 }];
  await p.push(o); await p.push({ ...o, tick: 150 });
  assert.equal(p.calls.length, 2);
  await p.push(obs(300, { hp: 0, ghost: true }));
  await p.push(obs(450, { hp: 0, ghost: true }));
  assert.equal(p.calls.length, 3);
  p.scheduler.stop();
});

test("energy crossings request help but idle is not energy recovery and cannot cause an endless paid loop", async () => {
  const p = probe(); await p.push(obs(0));
  await p.push(obs(150, { energy: 25 })); assert.equal(p.calls.length, 2);
  await p.push(obs(300, { energy: 24 })); assert.equal(p.calls.length, 2);
  await p.push(obs(450, { energy: 10 })); assert.equal(p.calls.length, 3);
  await p.push(obs(600, { energy: 9 })); assert.equal(p.calls.length, 3);
  p.scheduler.stop();
});

test("meaningful loot arrival is retained over cooldown; ambient nightfall is not paid", async () => {
  const p = probe(); await p.push(obs(0));
  const o = obs(1); o.piles = [{ id: "loot", label: "Corpse", tx: 1, ty: 0, dist: 1 }];
  await p.push(o); await p.push({ ...o, tick: 150 });
  assert.equal(p.calls.length, 2);
  await p.push({ ...o, tick: 300, isNight: true, hour: 20 });
  assert.equal(p.calls.length, 2); p.scheduler.stop();
});

test("resolved threshold crossings do not leave stale paid work behind cooldown", async () => {
  for (const risk of [{ hunger: 25 }, { hunger: 9 }, { hp: 9 }, { energy: 9 }]) {
    const p = probe(); await p.push(obs(0));
    await p.push(obs(1, risk));
    await p.push(obs(2)); await p.push(obs(150));
    // HP loss itself is a discrete meaningful event, even after healing.
    const expected = "hp" in risk ? 2 : 1;
    assert.equal(p.calls.length, expected, JSON.stringify(risk));
    if ("hp" in risk) assert.ok(!p.calls[1]!.triggers.some(t => t.kind === "vitals.hp_critical"));
    p.scheduler.stop();
  }
});

test("settled resolves with cooldown-retained risk and recovered risk cancels the pending reminder", async () => {
  const p = probe(); await p.push(obs(0, { hunger: 20 }));
  await p.push(obs(1, { hunger: 20 }));
  assert.ok(p.scheduler.retained > 0);
  let settled = false;
  void p.scheduler.settled().then(() => { settled = true; });
  await flush();
  assert.equal(settled, true, "settled must not wait for an observation that has not arrived");
  await p.push(obs(2, { hunger: 60 }));
  await p.push(obs(150, { hunger: 59 }));
  assert.equal(p.calls.length, 1);
  p.scheduler.stop();
});

test("default risk gate cannot bypass the real $0.50 UTC-day metered guard; next day reopens", async () => {
  let clock = Date.UTC(2026, 10, 22, 23, 59);
  const guard = new BudgetGuard({ clock: () => clock });
  const reservation = guard.reserve("risk-agent", 500_000);
  assert.ok(reservation.ok);
  guard.settle("risk-agent", reservation.reservationId, 500_000);
  assert.equal(guard.snapshot("risk-agent").capMicros, 500_000);
  let calls = 0;
  const log = createAttemptLog();
  const backend = createMeteredReflexBackend({ agentId: "risk-agent", guard, log, maxRetries: 0, now: () => clock,
    jev: { apiKey: "fixture", fetchImpl: async (_url, init) => {
      calls++;
      const request = JSON.parse(String(init?.body));
      const criteria = request.questions.next_action.criteria;
      const options = Object.keys(criteria);
      return new Response(JSON.stringify({ model: DEFAULT_PRICE.model, usage: { input_tokens: 100, output_tokens: 0 },
        answers: { next_action: { type: "choice", choice: options[0], probabilities: Object.fromEntries(options.map((s, i) => [s, i === 0 ? 1 : 0])) } } }));
    } },
  });
  const auto = createReflexAutopilot({ backend, verb: () => null, submit: () => null });
  auto.start();
  for (const tick of [0, 150, 36000]) { auto.ingest(obs(tick, { hunger: 9, pack: { bread: 1 } })); await flush(); }
  assert.equal(calls, 0);
  clock += 120_000;
  auto.ingest(obs(36150, { hunger: 9, pack: { bread: 1 } }));
  await auto.settled();
  assert.equal(calls, 1);
  assert.equal(foldAttempts(log.lines(), DEFAULT_PRICE).filter(r => r.status === "ok").length, 1);
  assert.equal(guard.snapshot("other-agent").spentMicros, 0);
  auto.stop();
});

test("real full-day decay and eating keep hunger above 23 through night, without inventing water or energy damage", async () => {
  const world = createWorld(1);
  const me = you(world)!;
  // Isolated stocked-body mechanics fixture, not a live/provider survival proof.
  world.people = [me]; world.fauna = []; world.speed = 1; world.hour = 19;
  me.hunger = 30; me.energy = 30; world.player.pack.bread = 20;
  const initialHp = me.hp;
  const initialBread = world.player.pack.bread;
  const water = world.tiles.flat().find(t => t.kind === "water")!;
  assert.ok(water);
  const waterY = world.tiles.findIndex(row => row.includes(water));
  assert.equal(walkable(world, world.tiles[waterY]!.indexOf(water), waterY), false);
  let meals = 0, nights = 0, minimum = 100;
  const scheduler = createReflexScheduler({ thinker: {
    prepare: () => ({}),
    async execute() { if (me.hunger <= 25) { commandEat(world, "bread"); meals++; } },
  } });
  for (let tick = 0; tick <= 8640; tick++) {
    const o = observeWorld(world);
    if (o.isNight) nights++;
    scheduler.ingest(o); await flush();
    minimum = Math.min(minimum, me.hunger);
    if (tick < 8640) tickWorld(world, 0.1);
  }
  assert.ok(Math.abs(world.hour - 43) < 1e-7);
  assert.ok(nights > 0); assert.equal(world.player.ghost, false);
  assert.equal(me.hp, initialHp);
  assert.equal(me.energy, 0, "energy drains but idle does not recover it or damage HP");
  assert.ok(minimum > 23, String(minimum)); assert.equal(meals, 3);
  assert.equal(world.player.pack.bread, initialBread - meals);
  assert.ok(scheduler.attemptsStarted <= 6, `actual mechanics fixture calls: ${scheduler.attemptsStarted}`);
  scheduler.stop();
});
