/**
 * Reflex scheduler tests — the Phase 3 cadence proofs (contract §5):
 * idle produces no calls, events produce bounded calls, bursts collapse,
 * survival triggers are retained (never silently dropped), the budget hook
 * gates every provider touch, and stop() unsubscribes from the event flow.
 *
 * All observations are fabricated; no sim, no network, no timers. Attempts
 * resolve on microtasks, so `await flush()` drains an unblocked scheduler.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createReflexScheduler,
  inQuietWindow,
  type AttemptRecord,
  type AttemptRequest,
  type ReflexScheduler,
  type SchedulerHooks,
  type Thinker,
} from "./scheduler.ts";
import { hashObservation } from "./log.ts";
import type { ReflexEvent } from "./events.ts";
import { DEFAULT_CADENCE, type Observation } from "./types.ts";

/* ── Fabricated observations ─────────────────────────────────────────── */

function makeObs(overrides: {
  tick?: number;
  hour?: number;
  hp?: number;
  hunger?: number;
  ghost?: boolean;
  people?: string[];
  weather?: string;
} = {}): Observation {
  const {
    tick = 0,
    hour = 10,
    hp = 30,
    hunger = 100,
    ghost = false,
    people = [],
    weather = "clear",
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
      hp,
      maxHp: 30,
      hunger,
      energy: 100,
      ghost,
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
    verbs: [],
    logTail: [],
  };
}

/* ── Scripted thinker ────────────────────────────────────────────────── */

interface ThinkerProbe {
  thinker: Thinker<Record<string, never>>;
  prepareCalls: AttemptRequest[];
  executeCalls: AttemptRequest[];
  /** When > 0, the next N execute calls reject. */
  failNext(n: number): void;
  /** When set, prepare returns null (nothing worth a paid call). */
  skipPrepare(): void;
}

function makeThinker(): ThinkerProbe {
  let failures = 0;
  let skip = false;
  const probe: ThinkerProbe = {
    prepareCalls: [],
    executeCalls: [],
    failNext(n) {
      failures = n;
    },
    skipPrepare() {
      skip = true;
    },
    thinker: {
      prepare(ctx) {
        probe.prepareCalls.push(ctx);
        if (skip) {
          skip = false;
          return null;
        }
        return {};
      },
      async execute(req) {
        probe.executeCalls.push(req);
        if (failures > 0) {
          failures -= 1;
          throw new Error("backend down");
        }
      },
    },
  };
  return probe;
}

interface SchedulerProbe {
  scheduler: ReflexScheduler;
  thinker: ThinkerProbe;
  records: AttemptRecord[];
  starts: AttemptRequest[];
  authorizations: AttemptRequest[];
}

function makeScheduler(opts: {
  thinker?: ThinkerProbe;
  hooks?: SchedulerHooks;
  config?: Parameters<typeof createReflexScheduler>[0]["config"];
} = {}): SchedulerProbe {
  const thinker = opts.thinker ?? makeThinker();
  const records: AttemptRecord[] = [];
  const starts: AttemptRequest[] = [];
  const authorizations: AttemptRequest[] = [];
  const scheduler = createReflexScheduler({
    thinker: thinker.thinker,
    hooks: {
      authorize: async (req) => {
        authorizations.push(req);
        return (await opts.hooks?.authorize?.(req)) ?? true;
      },
      onAttemptStart: (req) => {
        starts.push(req);
        opts.hooks?.onAttemptStart?.(req);
      },
      onAttemptEnd: (rec) => {
        records.push(rec);
        opts.hooks?.onAttemptEnd?.(rec);
      },
    },
    config: { cadence: { ...DEFAULT_CADENCE, reflexCooldownTicks: 2 }, ...opts.config },
    now: () => 1000,
  });
  return { scheduler, thinker, records, starts, authorizations };
}

/** Let queued microtasks run so a fired attempt completes. */
async function flush(times = 10): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

test("quiet-window math handles overnight and disabled windows", () => {
  const cadence = { mindHeartbeatHours: 3, sleepStartHour: 22, sleepEndHour: 6, reflexCooldownTicks: 2 };
  assert.equal(inQuietWindow(23.5, cadence), true);
  assert.equal(inQuietWindow(2, cadence), true);
  assert.equal(inQuietWindow(6, cadence), false);
  assert.equal(inQuietWindow(21.9, cadence), false);
  assert.equal(inQuietWindow(12, { ...cadence, sleepStartHour: 0, sleepEndHour: 0 }), false);
});

test("idle pushes produce no calls beyond the one-shot boot", async () => {
  const { scheduler, thinker } = makeScheduler();
  scheduler.ingest(makeObs({ tick: 0 }));
  await scheduler.settled();
  assert.equal(thinker.executeCalls.length, 1, "boot decision fires once");
  assert.equal(thinker.executeCalls[0]!.triggers[0]!.kind, "boot");

  for (let tick = 1; tick <= 40; tick++) scheduler.ingest(makeObs({ tick }));
  await scheduler.settled();
  assert.equal(thinker.executeCalls.length, 1, "unchanged world never re-fires");
  assert.equal(scheduler.attemptsStarted, 1);
  scheduler.stop();
});

test("a survival event is retained across cooldown, then fires with the trigger intact", async () => {
  const { scheduler, thinker, records } = makeScheduler();
  scheduler.ingest(makeObs({ tick: 0 }));
  await scheduler.settled();

  // hp 6/30 crosses the critical threshold; one tick after the boot attempt
  // the cooldown (2 ticks) defers it — retained, never dropped.
  scheduler.ingest(makeObs({ tick: 1, hp: 6 }));
  await flush();
  assert.equal(thinker.executeCalls.length, 1, "cooldown defers the survival trigger");
  assert.ok(scheduler.retained > 0);

  scheduler.ingest(makeObs({ tick: 2, hp: 6 })); // eventless push: window passed, releases
  await scheduler.settled();
  assert.equal(thinker.executeCalls.length, 2);
  assert.deepEqual(
    thinker.executeCalls[1]!.triggers.map((t) => t.kind),
    ["vitals.hp_drop", "vitals.hp_critical"],
  );
  assert.equal(records[1]!.status, "ok");
  assert.equal(records[1]!.stateHash, hashObservation(makeObs({ tick: 2, hp: 6 })));
  scheduler.stop();
});

test("a synchronous burst of eventful pushes collapses to two attempts", async () => {
  const { scheduler, thinker } = makeScheduler();
  // 50 pushes, each with a fresh person arriving (a real trigger each) and
  // no microtask drain between them: one in flight + one coalesced pending.
  for (let tick = 0; tick < 50; tick++) {
    scheduler.ingest(makeObs({ tick, people: [`p${tick}`] }));
  }
  assert.equal(scheduler.attemptsStarted, 1, "concurrency bound: one in flight");
  assert.ok(scheduler.retained > 0, "the burst coalesced into the pending slot");
  await scheduler.settled();
  assert.equal(thinker.executeCalls.length, 2, "burst collapses to in-flight + one coalesced attempt");
  const merged = thinker.executeCalls[1]!.triggers.map((t) => t.kind);
  assert.ok(merged.includes("social.person_arrived"));
  scheduler.stop();
});

test("cooldown bounds the attempt rate across spaced eventful pushes", async () => {
  const { scheduler, thinker } = makeScheduler(); // default cooldown: 2 ticks
  for (let tick = 0; tick < 10; tick++) {
    scheduler.ingest(makeObs({ tick, people: [`p${tick}`] }));
    await flush();
  }
  // Attempts at ticks 0 (boot), 2, 4, 6, 8 — every other push, never more.
  assert.equal(thinker.executeCalls.length, 5);
  scheduler.ingest(makeObs({ tick: 10 })); // eventless push releases the retained t9 trigger
  await scheduler.settled();
  assert.equal(thinker.executeCalls.length, 6);
  scheduler.stop();
});

test("prepare=null closes the cycle with no attempt, no record, no reservation", async () => {
  const thinker = makeThinker();
  thinker.skipPrepare();
  const { scheduler, records, authorizations } = makeScheduler({ thinker });
  scheduler.ingest(makeObs({ tick: 0 }));
  await scheduler.settled();
  assert.equal(thinker.prepareCalls.length, 1);
  assert.equal(thinker.executeCalls.length, 0, "provider never touched");
  assert.equal(records.length, 0, "no attempt record for a null prepare");
  assert.equal(authorizations.length, 0, "no budget reservation for a null prepare");
  assert.equal(scheduler.attemptsStarted, 0);
  scheduler.stop();
});

test("budget denial consumes the trigger without touching the provider", async () => {
  const thinker = makeThinker();
  const denials: AttemptRecord[] = [];
  const scheduler = createReflexScheduler({
    thinker: thinker.thinker,
    hooks: {
      authorize: () => false,
      onAttemptEnd: (rec) => denials.push(rec),
    },
  });
  scheduler.ingest(makeObs({ tick: 0 }));
  await scheduler.settled();
  assert.equal(thinker.executeCalls.length, 0, "denied attempt never reaches execute");
  assert.equal(denials.length, 1);
  assert.equal(denials[0]!.status, "denied");
  scheduler.stop();
});

test("quiet window drops opportunity triggers but survival wakes reflexes", async () => {
  const { scheduler, thinker } = makeScheduler();
  scheduler.ingest(makeObs({ tick: 0, hour: 10 })); // boot, daytime
  await scheduler.settled();
  assert.equal(thinker.executeCalls.length, 1);

  scheduler.ingest(makeObs({ tick: 2, hour: 23, weather: "rain" })); // opportunity only
  await flush();
  assert.equal(thinker.executeCalls.length, 1, "weather shift is dropped while asleep");

  scheduler.ingest(makeObs({ tick: 3, hour: 23, hp: 20, weather: "rain" })); // danger
  await scheduler.settled();
  assert.equal(thinker.executeCalls.length, 2, "hp loss wakes the reflexes");
  assert.equal(thinker.executeCalls[1]!.triggers[0]!.kind, "vitals.hp_drop");
  scheduler.stop();
});

test("duplicate suppression: an unchanged surface does not re-fire normal triggers", async () => {
  const { scheduler, thinker } = makeScheduler({ config: { events: { idleStasisPushes: 3 } } });
  scheduler.ingest(makeObs({ tick: 0 }));
  await scheduler.settled();
  assert.equal(thinker.executeCalls.length, 1);

  scheduler.noteAction(); // driver acted; arm idle detection
  scheduler.ingest(makeObs({ tick: 2 }));
  scheduler.ingest(makeObs({ tick: 3 }));
  scheduler.ingest(makeObs({ tick: 4 })); // stasis 3 → activity.idle, surface unchanged
  await flush();
  assert.equal(thinker.executeCalls.length, 1, "idle on an answered surface is free");
  scheduler.stop();
});

test("a failed attempt backs off and the retained survival trigger refires after the window", async () => {
  const thinker = makeThinker();
  thinker.failNext(10); // backend stays down for the whole test
  const { scheduler, records } = makeScheduler({ thinker, config: { failureBackoffTicks: 4 } });
  scheduler.ingest(makeObs({ tick: 0 }));
  await scheduler.settled(); // boot failure leaves nothing retained
  assert.equal(thinker.executeCalls.length, 1);
  assert.equal(records[0]!.status, "error");

  scheduler.ingest(makeObs({ tick: 1, hp: 10 })); // survival: retained under backoff
  await flush(); // settled() deliberately does not await backoff-retained triggers
  scheduler.ingest(makeObs({ tick: 2, hp: 9 }));
  scheduler.ingest(makeObs({ tick: 3, hp: 8 }));
  await flush();
  assert.equal(thinker.executeCalls.length, 1, "backoff suppresses attempts");
  assert.ok(scheduler.retained > 0, "survival trigger retained, not dropped");

  scheduler.ingest(makeObs({ tick: 4, hp: 8 })); // backoff window passed (tick >= 0+4)
  await flush();
  assert.equal(thinker.executeCalls.length, 2, "retained survival refires once backoff expires");
  assert.ok(
    thinker.executeCalls[1]!.triggers.some((t) => t.kind === "vitals.hp_drop"),
    "the retained survival trigger is what refired",
  );

  // Second failure doubles the backoff (8 ticks): pushes at 5..11 stay quiet.
  for (let tick = 5; tick <= 11; tick++) scheduler.ingest(makeObs({ tick, hp: 8 }));
  await flush();
  assert.equal(thinker.executeCalls.length, 2, "exponential backoff bounds the burn on a dead backend");
  scheduler.ingest(makeObs({ tick: 12, hp: 8 }));
  await flush();
  assert.equal(thinker.executeCalls.length, 3);
  scheduler.stop();
  await scheduler.settled();
});

test("stop discards retained triggers and unsubscribes from the event flow", async () => {
  const { scheduler, thinker } = makeScheduler();
  scheduler.ingest(makeObs({ tick: 0 }));
  await scheduler.settled();
  scheduler.ingest(makeObs({ tick: 1, hp: 5 })); // retained under cooldown
  assert.ok(scheduler.retained > 0);

  scheduler.stop();
  assert.equal(scheduler.running, false);
  assert.equal(scheduler.retained, 0, "stop discards retained triggers");
  await scheduler.settled();

  scheduler.ingest(makeObs({ tick: 5, hp: 1 })); // would be survival — but unsubscribed
  scheduler.ingest(makeObs({ tick: 6, people: ["p1"] }));
  await flush();
  assert.equal(thinker.executeCalls.length, 1, "no pushes reach the backend after stop");
});

test("attempt hooks observe start and end with a full record", async () => {
  const { scheduler, starts, records } = makeScheduler();
  scheduler.ingest(makeObs({ tick: 0 }));
  await scheduler.settled();
  assert.equal(starts.length, 1);
  assert.equal(records.length, 1);
  const rec = records[0]!;
  assert.equal(rec.attemptId, 1);
  assert.equal(rec.tick, 0);
  assert.equal(rec.bodyId, "you");
  assert.equal(rec.status, "ok");
  assert.equal(rec.error, null);
  assert.equal(rec.startedAtMs, 1000);
  assert.equal(rec.latencyMs, 0);
  assert.equal(typeof rec.stateHash, "string");
  assert.equal(typeof rec.surfaceDigest, "string");
  assert.deepEqual(
    rec.triggers.map((t: ReflexEvent) => t.kind),
    ["boot"],
  );
  scheduler.stop();
});
