/**
 * Reflex autopilot tests — the wiring proofs: observations in, one bounded
 * reflex decision per event batch out, intents submitted through the same
 * pipeline the UI writes, a decision row per executed decision, and stop()
 * detaching the event source so nothing reaches the backend afterwards.
 *
 * The backend is the deterministic stub (stub.ts): zero-cost, offline — the
 * Jev backend (t_0b00ee59) drops into the same ReflexBackend seam.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createReflexAutopilot,
  intentForCandidate,
  type ObservationSource,
} from "./autopilot.ts";
import { createStubBackend } from "./stub.ts";
import { hashObservation } from "./log.ts";
import type { AttemptRecord } from "./scheduler.ts";
import { DEFAULT_CADENCE, type Observation, type ReflexExchange, type VerbCandidate } from "./types.ts";
import type { AgentIntent } from "./types.ts";

const CHOP: VerbCandidate = {
  verb: "chop",
  label: "Chop",
  target: { kind: "tile", id: "12,7", tx: 12, ty: 7, label: "tree" },
};
const WALK: VerbCandidate = {
  verb: "walk",
  label: "Walk",
  target: { kind: "tile", id: "5,5", tx: 5, ty: 5, label: "grass" },
};
const TALK: VerbCandidate = {
  verb: "talk",
  label: "Talk",
  target: { kind: "person", id: "mira", tx: 1, ty: 0, label: "Mira" },
};

/** Tests drive a fast reflex cadence; the production default is cost-bounded (cadence-cost.test.ts). */
const FAST_CADENCE = { riskGated: false, cadence: { ...DEFAULT_CADENCE, reflexCooldownTicks: 2 } };

function makeObs(overrides: {
  tick?: number;
  hour?: number;
  verbs?: VerbCandidate[];
  people?: string[];
} = {}): Observation {
  const { tick = 0, hour = 10, verbs = [CHOP, WALK], people = [] } = overrides;
  return {
    tick,
    hour,
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
      thirst: 80, inWater: false, drowning: false,
      energy: 100,
      ghost: false,
      mana: 10,
      notoriety: "innocent",
      skills: {},
      pack: {},
      wear: {},
      vault: 0,
    },
    people: people.map((id, i) => ({
      id,
      name: id,
      role: null,
      x: i + 1,
      z: 0,
      hp: 10,
      maxHp: 10,
      task: "idle",
      ghost: false,
      dist: i + 1,
    })),
    fauna: [],
    piles: [],
    buildings: [],
    plots: [],
    herbs: [],
    water: null,
    verbs,
    logTail: [],
  };
}

function makeSource() {
  const cbs = new Set<(obs: Observation) => void>();
  const state = { unsubs: 0 };
  const source: ObservationSource = {
    subscribe(cb) {
      cbs.add(cb);
      return () => {
        if (cbs.delete(cb)) state.unsubs++;
      };
    },
  };
  return {
    state,
    source,
    subscriberCount: () => cbs.size,
    push(obs: Observation) {
      for (const cb of [...cbs]) cb(obs);
    },
  };
}

test("boot: one reflex decision becomes a submitted intent and a decision row", async () => {
  const obs = makeObs();
  const submitted: AgentIntent[] = [];
  const backend = createStubBackend();
  const auto = createReflexAutopilot({
    config: FAST_CADENCE,
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

  assert.equal(backend.calls.length, 1, "boot costs exactly one decision");
  const exchange: ReflexExchange = backend.calls[0]!;
  assert.equal(exchange.questions.length, 1);
  const q = exchange.questions[0]!;
  assert.equal(q.type, "choice");
  if (q.type !== "choice") return;
  assert.deepEqual(q.options, ["Chop [12,7]", "Walk [5,5]", "Rest / remain idle"]);
  const state = exchange.state as { triggers: { kind: string }[]; candidateVerbs: string[] };
  assert.deepEqual(state.triggers.map((t) => t.kind), ["boot"]);
  assert.deepEqual(state.candidateVerbs, ["chop", "walk", "idle"]);

  // Stub scores chop over walk; the picked option must be the submitted intent.
  assert.deepEqual(submitted, [{ kind: "chop", tx: 12, ty: 7, targetId: null, spell: null }]);

  assert.equal(auto.log.rows.length, 1);
  const row = auto.log.rows[0]!;
  assert.equal(row.lane, "reflex");
  assert.equal(row.bodyId, "you");
  assert.equal(row.tick, 0);
  assert.equal(row.question, "What now?");
  assert.deepEqual(row.candidates, ["Chop [12,7]", "Walk [5,5]", "Rest / remain idle"]);
  assert.equal(row.answer, "Chop [12,7]");
  assert.deepEqual(row.intent, submitted[0]!);
  assert.equal(row.stateHash, hashObservation(obs));
  assert.equal(row.outcome, null, "accepted intent has no rejection outcome");
  auto.stop();
});

test("reflex decisions alone: the backend pick drives the intent, nothing else", async () => {
  const submitted: AgentIntent[] = [];
  const backend = createStubBackend({ prefer: { walk: 1000 } });
  const auto = createReflexAutopilot({
    config: FAST_CADENCE,
    backend,
    observe: () => makeObs(),
    submit: (intent) => {
      submitted.push(intent);
      return null;
    },
  });
  auto.start();
  auto.step();
  await auto.settled();
  assert.deepEqual(submitted, [{ kind: "walk", tx: 5, ty: 5, targetId: null, spell: null }]);
  auto.stop();
});

test("an out-of-range backend pick is an attempt error, never a submitted intent", async () => {
  const submitted: AgentIntent[] = [];
  const records: AttemptRecord[] = [];
  const auto = createReflexAutopilot({
    config: FAST_CADENCE,
    backend: {
      async decide() {
        return { answers: [{ id: "next_action", type: "choice", probabilities: [0, 1], pick: 9 }] };
      },
    },
    observe: () => makeObs(),
    submit: (intent) => {
      submitted.push(intent);
      return null;
    },
    hooks: { onAttemptEnd: (rec) => records.push(rec) },
  });
  auto.start();
  auto.step();
  await auto.settled();
  assert.equal(submitted.length, 0);
  assert.equal(records.length, 1);
  assert.equal(records[0]!.status, "error");
  assert.match(records[0]!.error ?? "", /out of range/);
  assert.equal(auto.log.rows.length, 0);
  auto.stop();
});

test("idle time produces no backend calls", async () => {
  const backend = createStubBackend();
  let tick = 0;
  const auto = createReflexAutopilot({
    config: FAST_CADENCE,
    backend,
    observe: () => makeObs({ tick: tick++ }),
    submit: () => null,
  });
  auto.start();
  auto.step();
  await auto.settled();
  assert.equal(backend.calls.length, 1, "boot decision only");
  for (let i = 0; i < 25; i++) auto.step();
  await auto.settled();
  assert.equal(backend.calls.length, 1, "an unchanging vale never re-fires");
  auto.stop();
});

test("a burst of eventful pushes cannot create unbounded backend calls", async () => {
  const backend = createStubBackend();
  const feed = makeSource();
  const auto = createReflexAutopilot({ config: FAST_CADENCE, backend, source: feed.source, submit: () => null });
  auto.start();
  // Synchronous burst: 60 pushes, each with a fresh arrival trigger.
  for (let tick = 0; tick < 60; tick++) feed.push(makeObs({ tick, people: [`p${tick}`] }));
  await auto.settled();
  assert.equal(backend.calls.length, 2, "in-flight attempt + one coalesced pending, never 60");
  auto.stop();
});

test("stopping autopilot removes the subscription; pushes afterwards reach nothing", async () => {
  const backend = createStubBackend();
  const feed = makeSource();
  const auto = createReflexAutopilot({ config: FAST_CADENCE, backend, source: feed.source, submit: () => null });
  auto.start();
  assert.equal(feed.subscriberCount(), 1);
  feed.push(makeObs({ tick: 0 }));
  await auto.settled();
  assert.equal(backend.calls.length, 1);

  auto.stop();
  assert.equal(feed.subscriberCount(), 0, "source subscription removed");
  assert.equal(feed.state.unsubs, 1);
  assert.equal(auto.running, false);

  feed.push(makeObs({ tick: 1, people: ["intruder"] }));
  auto.ingest(makeObs({ tick: 2, people: ["intruder"] }));
  auto.step();
  await auto.settled();
  assert.equal(backend.calls.length, 1, "no path to the backend survives stop");
  assert.throws(() => auto.start(), /create a fresh one/);
});

test("budget authorization gates the backend; denial leaves the provider untouched", async () => {
  const backend = createStubBackend();
  const records: AttemptRecord[] = [];
  const auto = createReflexAutopilot({
    config: FAST_CADENCE,
    backend,
    observe: () => makeObs(),
    submit: () => null,
    hooks: { authorize: () => false, onAttemptEnd: (rec) => records.push(rec) },
  });
  auto.start();
  auto.step();
  await auto.settled();
  assert.equal(backend.calls.length, 0, "denied attempt never reaches the provider");
  assert.deepEqual(records.map((r) => r.status), ["denied"]);
  auto.stop();
});

test("a submit rejection is logged as an outcome, not thrown as a provider error", async () => {
  const backend = createStubBackend();
  const records: AttemptRecord[] = [];
  const auto = createReflexAutopilot({
    config: FAST_CADENCE,
    backend,
    observe: () => makeObs(),
    submit: () => "too far",
    hooks: { onAttemptEnd: (rec) => records.push(rec) },
  });
  auto.start();
  auto.step();
  await auto.settled();
  assert.equal(backend.calls.length, 1, "the backend was paid — the attempt counts");
  assert.deepEqual(records.map((r) => r.status), ["ok"]);
  assert.equal(auto.log.rows.length, 1);
  assert.deepEqual(auto.log.rows[0]!.outcome, { submitRejected: 1 });
  auto.stop();
});

test("one executable candidate still offers a reflex choice against resting", async () => {
  const backend = createStubBackend();
  const auto = createReflexAutopilot({
    config: FAST_CADENCE,
    backend,
    observe: () => makeObs({ verbs: [CHOP, TALK] }), // talk has no intent wire
    submit: () => null,
  });
  auto.start();
  auto.step();
  await auto.settled();
  assert.equal(backend.calls.length, 1, "one candidate plus rest is a real choice");
  auto.stop();
});

test("onDecision receives the row instead of the default in-memory log", async () => {
  const rows: unknown[] = [];
  const auto = createReflexAutopilot({
    config: FAST_CADENCE,
    backend: createStubBackend(),
    observe: () => makeObs(),
    submit: () => null,
    hooks: { onDecision: (row) => rows.push(row) },
  });
  auto.start();
  auto.step();
  await auto.settled();
  assert.equal(rows.length, 1, "the durable-writer hook (t_e3f72207) sees every decision");
  assert.equal(auto.log.rows.length, 0);
  auto.stop();
});

test("intentForCandidate maps menu verbs and rejects UI-flow-only verbs", () => {
  const obs = makeObs();
  assert.deepEqual(intentForCandidate(CHOP, obs), {
    kind: "chop",
    tx: 12,
    ty: 7,
    targetId: null,
    spell: null,
  });
  assert.equal(intentForCandidate(TALK, obs), null, "talk is a UI flow, never an option");
});
