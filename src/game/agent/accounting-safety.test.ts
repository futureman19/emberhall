import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createAttemptLog,
  foldAttempts,
  costForOutcome,
  type AttemptBegin,
  type AttemptEnd,
} from "./attempts.ts";
import { BudgetGuard } from "./budget.ts";
import { callReflexMetered } from "./metering.ts";
import { DEFAULT_PRICE, estimateTokens, microsForReservation, microsForUsage } from "./pricing.ts";

const clock = () => Date.UTC(2026, 10, 21);
const input = {
  agentId: "a",
  bodyId: "b",
  trigger: { kind: "test", detail: "" },
  tick: 0,
  stateHash: "x",
  exchange: { state: {}, questions: [] },
};
const begin: AttemptBegin = {
  type: "begin",
  attemptId: "one",
  ...input,
  lane: "reflex",
  startedAt: clock(),
  provider: null,
  request: { exchange: input.exchange, bytes: 2, redactions: 0 },
  reservationId: "r",
  retryOf: null,
  retryN: 0,
};
const end: AttemptEnd = {
  type: "end",
  attemptId: "one",
  endedAt: clock(),
  status: "ok",
  response: null,
  error: null,
  usage: null,
  cost: { micros: 10, basis: "reported", price: DEFAULT_PRICE },
  latencyMs: 0,
};
const invalid = [-1, NaN, Infinity, -Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1];

test("invalid accounting quantities are rejected without releasing a hold or refunding spend", () => {
  for (const amount of invalid) {
    assert.throws(() => new BudgetGuard({ dailyCapMicros: amount }));
    assert.throws(() => new BudgetGuard({ reservationTtlMs: amount }));
    const guard = new BudgetGuard({ clock });
    const hold = guard.reserve("a", 100);
    assert.ok(hold.ok);
    assert.throws(() => guard.reserve("a", amount));
    assert.throws(() => guard.settle("a", hold.reservationId, amount));
    assert.equal(guard.snapshot("a").reservedMicros, 100);
    assert.equal(guard.snapshot("a").spentMicros, 0);
    assert.throws(() => estimateTokens(amount));
    for (const usage of [
      { promptTokens: amount, completionTokens: 0 },
      { promptTokens: 0, completionTokens: amount },
    ]) {
      assert.throws(() => microsForUsage(usage, DEFAULT_PRICE));
      const cost = costForOutcome(usage, 100, 10, DEFAULT_PRICE);
      assert.equal(cost.basis, "estimated");
      assert.ok(cost.micros > 0);
    }
  }
});

test("invalid prices and overflowing computed costs cannot authorize a call", async () => {
  let calls = 0;
  for (const amount of [-1, NaN, Infinity, -Infinity, Number.MAX_VALUE]) {
    for (const field of ["promptPerMTok", "completionPerMTok"]) {
      const price = { ...DEFAULT_PRICE, [field]: amount };
      assert.throws(() => microsForReservation(100, price));
      const guard = new BudgetGuard({ clock });
      await assert.rejects(
        callReflexMetered(
          {
            guard,
            log: createAttemptLog(),
            price,
            clock,
            backend: {
              call: async () => {
                calls++;
                return {};
              },
            },
          },
          input,
        ),
      );
      assert.equal(guard.snapshot("a").openReservations, 0);
    }
  }
  assert.equal(calls, 0);
});

test("begin sink failure leaves no mirror, releases unsent hold, and latches the shared guard", async () => {
  const guard = new BudgetGuard({ clock });
  const log = createAttemptLog(() => {
    throw new Error("disk begin");
  });
  let calls = 0;
  const backend = {
    call: async () => {
      calls++;
      return {};
    },
  };
  await assert.rejects(callReflexMetered({ guard, log, backend, clock }, input), /disk begin/);
  assert.deepEqual(log.lines(), []);
  assert.equal(log.toJSONL(), "");
  assert.equal(guard.snapshot("a").reservedMicros, 0);
  assert.equal(guard.snapshot("a").spentMicros, 0);
  await assert.rejects(
    callReflexMetered({ guard, log: createAttemptLog(), backend, clock }, input),
    /begin write failed/,
  );
  assert.equal(guard.reserve("other-agent", 0).ok, false);
  assert.equal(calls, 0);
});

test("end sink failure settles known usage exactly and blocks subsequent calls even with a fresh log", async () => {
  const guard = new BudgetGuard({ clock });
  const log = createAttemptLog((line) => {
    if (line.type === "end") throw new Error("disk end");
  });
  let calls = 0;
  const backend = {
    call: async () => {
      calls++;
      return { usage: { promptTokens: 1000, completionTokens: 0 } };
    },
  };
  await assert.rejects(callReflexMetered({ guard, log, backend, clock }, input), /disk end/);
  assert.equal(guard.snapshot("a").spentMicros, 42);
  assert.equal(guard.snapshot("a").reservedMicros, 0);
  assert.equal(log.lines().length, 1);
  assert.equal(log.lines()[0]!.type, "begin");
  await assert.rejects(
    callReflexMetered({ guard, log: createAttemptLog(), backend, clock }, input),
    /end write failed/,
  );
  assert.equal(calls, 1);
});

test("invalid provider usage settles conservatively instead of decreasing spend", async () => {
  for (const amount of invalid) {
    const guard = new BudgetGuard({ clock });
    const log = createAttemptLog();
    const result = await callReflexMetered(
      {
        guard,
        log,
        clock,
        backend: { call: async () => ({ usage: { promptTokens: amount, completionTokens: 0 } }) },
      },
      input,
    );
    const first = log.lines()[0] as AttemptBegin;
    assert.equal(result.cost.basis, "estimated");
    assert.ok(result.cost.micros >= first.reservationMicros!);
    assert.equal(guard.snapshot("a").spentMicros, result.cost.micros);
  }
});

test("begin persists a tariff snapshot and restart never drops the original hold", async () => {
  const price = { ...DEFAULT_PRICE, promptPerMTok: 2, completionPerMTok: 5 };
  const log = createAttemptLog();
  const guard = new BudgetGuard({ clock });
  await callReflexMetered(
    {
      guard,
      log,
      clock,
      price,
      backend: {
        call: async () => {
          price.promptPerMTok = 0;
          price.completionPerMTok = 0;
          return {};
        },
      },
    },
    input,
  );
  const first = log.lines()[0] as AttemptBegin;
  assert.equal(first.price!.promptPerMTok, 2);
  assert.equal(first.price!.completionPerMTok, 5);
  assert.ok(first.reservationMicros! > 0);
  const folded = foldAttempts([first], DEFAULT_PRICE);
  assert.ok(folded[0]!.cost.micros >= first.reservationMicros!);
  assert.equal(folded[0]!.cost.price!.completionPerMTok, 5);
  const restored = BudgetGuard.fromAttempts(folded, { clock });
  assert.ok(restored.snapshot("a").spentMicros >= first.reservationMicros!);
  assert.ok(
    foldAttempts([begin], DEFAULT_PRICE)[0]!.cost.micros >= microsForReservation(2, DEFAULT_PRICE),
    "legacy fields may be omitted",
  );
});

test("restore rejects malformed holds, end costs, folded costs, and overflowing totals", () => {
  for (const amount of invalid) {
    assert.throws(() => foldAttempts([{ ...begin, reservationMicros: amount }], DEFAULT_PRICE));
    assert.throws(() =>
      foldAttempts([begin, { ...end, cost: { ...end.cost, micros: amount } }], DEFAULT_PRICE),
    );
    const folded = foldAttempts([begin], DEFAULT_PRICE);
    folded[0]!.cost.micros = amount;
    assert.throws(() => BudgetGuard.fromAttempts(folded, { clock }));
  }
  assert.throws(() =>
    foldAttempts(
      [{ ...begin, price: { ...DEFAULT_PRICE, completionPerMTok: NaN } }],
      DEFAULT_PRICE,
    ),
  );
  const folded = foldAttempts([begin], DEFAULT_PRICE);
  folded[0]!.cost.micros = Number.MAX_SAFE_INTEGER;
  assert.throws(() => BudgetGuard.fromAttempts([...folded, ...folded], { clock }));
});
