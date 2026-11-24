import assert from "node:assert/strict";
import { test } from "node:test";
import * as mind from "./mind.ts";
import { buildCourtMorning } from "./fixtures/court-morning.ts";
import { observeWorld } from "./observe.ts";
import type { MindRequest } from "./types.ts";

function request(): MindRequest {
  return {
    directive: "Stay safe", rolePack: "Ranger", manual: "Vale",
    observation: observeWorld(buildCourtMorning().world),
    goals: ["bank gold"], journalTail: [],
  };
}
const response = { goals: ["rest"], journalEntry: "Quiet.", intentHints: [] };
const cancelled = { ok: false, reasonCode: "MIND_CANCELLED" };

test("outcome returns validated response", async () => {
  assert.equal(typeof mind.runMindExchangeOutcome, "function");
  assert.deepEqual(await mind.runMindExchangeOutcome(request(), {
    complete: async () => JSON.stringify(response),
  }), { ok: true, response });
});

test("malformed response is explicit, sanitized, and never retried", async () => {
  for (const raw of ["secret malformed output", "{}", "null"]) {
    let calls = 0;
    const outcome = await mind.runMindExchangeOutcome(request(), {
      complete: async () => { calls++; return raw; },
    });
    assert.deepEqual(outcome, { ok: false, reasonCode: "MIND_INVALID_RESPONSE" });
    assert.equal(calls, 1);
  }
});

test("unreachable errors retry once without exposing raw errors", async () => {
  let calls = 0;
  assert.deepEqual(await mind.runMindExchangeOutcome(request(), {
    complete: async () => { calls++; throw new Error("secret network details"); },
  }), { ok: false, reasonCode: "MIND_UNREACHABLE" });
  assert.equal(calls, 2);
});

test("transport retry can recover", async () => {
  let calls = 0;
  assert.deepEqual(await mind.runMindExchangeOutcome(request(), {
    complete: async () => {
      if (++calls === 1) throw new Error("offline");
      return JSON.stringify(response);
    },
  }), { ok: true, response });
  assert.equal(calls, 2);
});

test("only exact known HTTP auth errors classify as auth, without retry", async () => {
  for (const message of ["mind endpoint HTTP 401", "mind endpoint HTTP 403", "HTTP 401 secret", "mind endpoint HTTP 401 secret"]) {
    let calls = 0;
    const auth = /^mind endpoint HTTP (401|403)$/.test(message);
    assert.deepEqual(await mind.runMindExchangeOutcome(request(), {
      complete: async () => { calls++; throw new Error(message); },
    }), { ok: false, reasonCode: auth ? "MIND_AUTH" : "MIND_UNREACHABLE" });
    assert.equal(calls, auth ? 1 : 2);
  }
});

test("never-resolving noncooperative adapter times out twice", { timeout: 2000 }, async () => {
  const signals: AbortSignal[] = [];
  assert.deepEqual(await mind.runMindExchangeOutcome(request(), {
    complete: (_messages, signal) => {
      signals.push(signal!);
      return new Promise<string>(() => {});
    },
  }, { timeoutMs: 10 }), { ok: false, reasonCode: "MIND_UNREACHABLE" });
  assert.equal(signals.length, 2);
  assert.ok(signals.every(signal => signal.aborted));
});

test("default total timeout is bounded to two 20-second attempts", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  let settled = false;
  const result = mind.runMindExchangeOutcome(request(), {
    complete: () => { calls++; return new Promise<string>(() => {}); },
  }).then(outcome => { settled = true; return outcome; });
  await new Promise<void>(resolve => setImmediate(resolve));
  t.mock.timers.tick(20_000);
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(calls, 2);
  assert.equal(settled, false);
  t.mock.timers.tick(20_000);
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(settled, true);
  assert.deepEqual(await result, { ok: false, reasonCode: "MIND_UNREACHABLE" });
});

test("recall cancels a noncooperative pending call without retry or late result", { timeout: 2000 }, async () => {
  const recall = new AbortController();
  let calls = 0;
  let signal: AbortSignal | undefined;
  let finish!: (raw: string) => void;
  const pending = mind.runMindExchangeOutcome(request(), {
    complete: (_messages, supplied) => {
      calls++; signal = supplied;
      return new Promise<string>(resolve => { finish = resolve; });
    },
  }, { signal: recall.signal });
  await new Promise<void>(resolve => setImmediate(resolve));
  recall.abort(new Error("private recall reason"));
  assert.deepEqual(await pending, cancelled);
  assert.equal(signal?.aborted, true);
  finish(JSON.stringify(response));
  assert.deepEqual(await pending, cancelled);
  assert.equal(calls, 1);
});

test("already-recalled exchange makes no adapter call; compatibility falls back", async () => {
  const recall = new AbortController();
  recall.abort();
  let calls = 0;
  const adapter = { complete: async () => { calls++; return JSON.stringify(response); } };
  const req = request();
  assert.deepEqual(await mind.runMindExchangeOutcome(req, adapter, { signal: recall.signal }), cancelled);
  assert.deepEqual(await mind.runMindExchange(req, adapter, { signal: recall.signal }), {
    goals: req.goals, journalEntry: "", intentHints: [],
  });
  assert.equal(calls, 0);
});
