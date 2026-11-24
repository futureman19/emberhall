/**
 * Cost-contract regressions (Phase 3.5, t_d8b9704d).
 *
 * The first live acceptance run (2026-11-22, evidence/phase3-live) measured
 * 611 paid calls in 277s at the old 2-tick cooldown — the $0.50/day budget
 * exhausted in ~4.6 minutes and the vale day survived on budget-forced idle.
 * These tests lock the two fixes:
 *   1. DEFAULT_CADENCE bounds a full vale day of continuous events to a few
 *      dozen paid calls (150 ticks = 15s at the host's 10 ticks/s).
 *   2. The wire exchange carries a compacted observation — no UI-flow verb
 *      menu (76% of the old state bytes), no zero-count pack entries, a
 *      bounded log tail — while action mapping and stateHash still use the
 *      full observation.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createReflexAutopilot } from "./autopilot.ts";
import { createStubBackend } from "./stub.ts";
import { hashObservation } from "./log.ts";
import { createReflexScheduler, type Thinker } from "./scheduler.ts";
import {
  DEFAULT_CADENCE,
  type Observation,
  type ReflexExchange,
  type VerbCandidate,
} from "./types.ts";
import type { ItemId } from "../types.ts";

function makeObs(overrides: {
  tick?: number;
  hour?: number;
  weather?: string;
  verbs?: VerbCandidate[];
  pack?: Partial<Record<ItemId, number>>;
  logTail?: string[];
} = {}): Observation {
  const {
    tick = 0,
    hour = 12,
    weather = "clear",
    verbs = [],
    pack = {},
    logTail = [],
  } = overrides;
  return {
    tick,
    hour,
    isNight: hour < 6 || hour >= 20,
    weather: { kind: weather, cloud: 0, wet: 0, wind: 0 },
    you: {
      id: "you",
      name: "You",
      x: 0,
      z: 0,
      hp: 30,
      maxHp: 30,
      hunger: 100,
      thirst: 80, inWater: false, drowning: false,
      energy: 100,
      ghost: false,
      mana: 10,
      notoriety: "innocent",
      skills: {},
      pack,
      wear: {},
      vault: 0,
    },
    people: [],
    fauna: [],
    piles: [],
    buildings: [],
    plots: [],
    herbs: [],
    water: null,
    verbs,
    logTail,
  };
}

const WALK = (tx: number, ty: number): VerbCandidate => ({
  verb: "walk",
  label: "Walk",
  target: { kind: "tile", id: `${tx},${ty}`, tx, ty, label: "grass" },
});
const CHOP: VerbCandidate = {
  verb: "chop",
  label: "Chop",
  target: { kind: "tile", id: "12,7", tx: 12, ty: 7, label: "tree" },
};
const TALK = (id: string): VerbCandidate => ({
  verb: "talk",
  label: "Talk",
  target: { kind: "person", id, tx: 1, ty: 0, label: id },
});

test("default reflex cooldown is at least ten host seconds", () => {
  // The host shard ticks at 10 Hz (TICK_MS=100). Anything under 100 ticks
  // re-opens the per-second polling shape the cost contract forbids.
  assert.ok(
    DEFAULT_CADENCE.reflexCooldownTicks >= 100,
    `reflexCooldownTicks=${DEFAULT_CADENCE.reflexCooldownTicks} is too hot for the cost contract`,
  );
});

test("default risk gate suppresses a full vale day of ambient weather events", async () => {
  // A vale day is ~9,550 host ticks (measured: 955s at 10 ticks/s). Feed a
  // continuous non-survival event stream (weather alternates every tick) at
  // noon — the worst case for reflex burn — and count paid attempts.
  const thinker: Thinker<Record<string, never>> = {
    prepare: () => ({}),
    async execute() {},
  };
  const scheduler = createReflexScheduler({
    thinker,
    config: { cadence: DEFAULT_CADENCE },
  });
  const DAY_TICKS = 9550;
  for (let i = 0; i < DAY_TICKS; i++) {
    scheduler.ingest(makeObs({ tick: i, weather: i % 2 ? "rain" : "clear" }));
    for (let f = 0; f < 3; f++) await Promise.resolve();
  }
  // The pump scheduler retains cooldown-blocked triggers until a later push;
  // settled() never awaits retained work (it needs another push). Close the
  // day with one eventless push — same weather, tick past the cooldown — so
  // any retained trigger releases and the scheduler drains.
  scheduler.ingest(
    makeObs({
      tick: DAY_TICKS + DEFAULT_CADENCE.reflexCooldownTicks,
      weather: (DAY_TICKS - 1) % 2 ? "rain" : "clear",
    }),
  );
  await scheduler.settled();
  const n = scheduler.attemptsStarted;
  assert.ok(n <= 65, `a vale day must cost at most ~65 reflex calls, got ${n}`);
  assert.equal(n, 1, "ambient weather alone must not buy decisions after boot");
  scheduler.stop();
});

test("wire state is compacted; action mapping and stateHash use the full observation", async () => {
  const obs = makeObs({
    verbs: [CHOP, WALK(5, 5), TALK("mira")],
    pack: { bread: 2, log: 0 },
    logTail: Array.from({ length: 20 }, (_, i) => `line ${i}`),
  });
  const backend = createStubBackend();
  const submitted: unknown[] = [];
  const auto = createReflexAutopilot({
    backend,
    observe: () => obs,
    submit: (intent) => {
      submitted.push(intent);
      return null;
    },
  });
  auto.start();
  auto.step();
  await auto.settled();

  assert.equal(backend.calls.length, 1);
  const exchange: ReflexExchange = backend.calls[0]!;
  const wire = exchange.state as {
    observation: Observation;
    candidateVerbs: string[];
  };
  // The UI-flow verb menu never rides the wire: options + candidateVerbs
  // already describe every executable choice.
  assert.deepEqual(wire.observation.verbs, []);
  assert.equal(wire.observation.you.pack.log, undefined, "zero-count pack entries dropped");
  assert.equal(wire.observation.you.pack.bread, 2);
  assert.equal(wire.observation.logTail.length, 10, "log tail bounded");
  assert.deepEqual(wire.candidateVerbs, ["chop", "walk", "eat", "idle"]);
  // The original observation is untouched: action mapping, the decision row
  // and the replay hash all keep the full surface.
  assert.equal(obs.verbs.length, 3);
  assert.equal(obs.you.pack.log, 0);
  assert.equal(obs.logTail.length, 20);
  assert.equal(auto.log.rows[0]!.stateHash, hashObservation(obs));
  assert.equal(submitted.length, 1, "the compacted wire still produces a real action");
  auto.stop();
});

test("an r1-sized menu compacts to a fraction of the old wire bytes", async () => {
  // r1 shape: 165 verb candidates (127 executable walks + 38 UI talks),
  // 129 options with pack food. The old exchange measured 26,849 bytes.
  const verbs: VerbCandidate[] = [];
  for (let i = 0; i < 127; i++) verbs.push(WALK(200 + i, 300));
  for (let i = 0; i < 38; i++) verbs.push(TALK(`npc-${i}`));
  const obs = makeObs({ verbs, pack: { bread: 1 } });
  const backend = createStubBackend();
  const auto = createReflexAutopilot({ backend, observe: () => obs, submit: () => null });
  auto.start();
  auto.step();
  await auto.settled();
  const exchange: ReflexExchange = backend.calls[0]!;
  const q = exchange.questions[0]!;
  assert.equal(q.type, "choice");
  if (q.type !== "choice") return;
  assert.equal(q.options.length, 129, "menu coverage is unchanged by compaction");
  const bytes = JSON.stringify(exchange).length;
  assert.ok(bytes < 9000, `compacted exchange must stay under 9KB, got ${bytes}`);
  auto.stop();
});
