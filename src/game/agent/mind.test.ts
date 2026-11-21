/**
 * Mind exchange tests — every transport is a scripted fetchImpl; no test
 * ever touches the network. Covers the happy path, graceful degradation
 * on malformed output, the 20s timeout contract (shortened via options),
 * one-retry recovery on HTTP/network failure, prompt assembly, and the
 * no-secrets-in-logs rule.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Intent } from "../types.ts";
import { createLocalAdapter } from "./adapters/local.ts";
import { createOpenAIAdapter } from "./adapters/openai-compatible.ts";
import { assembleMindMessages, LOG_TAIL_LINES } from "./assembler.ts";
import { buildCourtMorning } from "./fixtures/court-morning.ts";
import { MIND_TIMEOUT_MS, runMindExchange } from "./mind.ts";
import { observeWorld } from "./observe.ts";
import type { MindRequest, MindResponse, Observation } from "./types.ts";

const ROLE_PACK = "# Ranger role pack\nYou are a ranger of the vale. Chop, plant, track.";
const MANUAL = "# Vale manual\nThe vale runs on intents. Bank gold survives death.";
const DIRECTIVE = "Earn an honest living and keep the woods standing.";

function makeReq(overrides: Partial<MindRequest> = {}): MindRequest {
  const { world } = buildCourtMorning();
  return {
    directive: DIRECTIVE,
    rolePack: ROLE_PACK,
    manual: MANUAL,
    observation: observeWorld(world),
    goals: ["chop two oaks", "bank the gold"],
    journalTail: ["Morning at the court."],
    ...overrides,
  };
}

const VALID_HINT: Intent = { kind: "walk", tx: 258, ty: 293, targetId: null, spell: null };
const VALID_REPLY: MindResponse = {
  goals: ["bank the gold"],
  journalEntry: "The court is quiet; I will bank what I carry.",
  intentHints: [VALID_HINT],
};

const fallbackOf = (req: MindRequest): MindResponse => ({
  goals: req.goals,
  journalEntry: "",
  intentHints: [],
});

function completion(content: string, status = 200): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { role: "assistant", content } }] }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

/** Scripted transport: each step is a fresh Response factory or a thrown
 *  Error. An exhausted script throws, so extra calls can never pass silently. */
function scriptedFetch(steps: Array<() => Response | Error>): {
  fetchImpl: typeof fetch;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    const step = steps[calls.length - 1];
    if (!step) throw new Error("unexpected extra fetch call");
    const out = step();
    if (out instanceof Error) throw out;
    return out;
  };
  return { fetchImpl, calls };
}

function adapterFor(fetchImpl: typeof fetch, apiKey?: string) {
  return createOpenAIAdapter({
    baseUrl: "http://mind.test/v1",
    apiKey,
    model: "test-model",
    fetchImpl,
  });
}

/* ── assembler ─────────────────────────────────────────────────────── */

test("assembler system carries the role pack, manual, cadence and strict-JSON demand", () => {
  const msgs = assembleMindMessages(makeReq());
  assert.equal(msgs.length, 2);
  const [system, user] = msgs;
  assert.equal(system.role, "system");
  assert.ok(system.content.includes(ROLE_PACK), "system must contain the role pack text");
  assert.ok(system.content.includes(MANUAL), "system must contain the vale manual");
  assert.match(system.content, /strict JSON/i);
  assert.match(system.content, /NOTHING else/);
  assert.match(system.content, /no prose, no markdown fences/);
  assert.match(system.content, /3 vale hours/);
  assert.equal(user.role, "user");
});

test("assembler user carries directive, goals, compact observation and journal", () => {
  const req = makeReq();
  req.observation.logTail = Array.from({ length: 25 }, (_, i) => `line ${i}`);
  req.observation.you.pack = { board: 4, acorn: 0 };
  const before = JSON.stringify(req.observation);

  const [, user] = assembleMindMessages(req);
  assert.ok(user.content.includes(DIRECTIVE));
  assert.ok(user.content.includes("- chop two oaks"));
  assert.ok(user.content.includes("- bank the gold"));
  assert.ok(user.content.includes("Morning at the court."));

  const marker = "Observation (JSON):\n";
  const start = user.content.indexOf(marker) + marker.length;
  const end = user.content.indexOf("\n\nRecent journal:");
  const obs = JSON.parse(user.content.slice(start, end)) as Observation;
  assert.equal(obs.logTail.length, LOG_TAIL_LINES);
  assert.equal(obs.logTail[0], "line 15");
  assert.equal(obs.logTail[9], "line 24");
  assert.deepEqual(obs.you.pack, { board: 4 }, "zero-count pack entries are dropped");
  assert.equal(JSON.stringify(req.observation), before, "assembler must not mutate the request");
});

/* ── exchange: happy path ──────────────────────────────────────────── */

test("happy path: valid JSON parses; the request is OpenAI-compatible", async () => {
  const req = makeReq();
  const { fetchImpl, calls } = scriptedFetch([() => completion(JSON.stringify(VALID_REPLY))]);
  const adapter = createOpenAIAdapter({
    baseUrl: "https://api.example.test/v1/",
    apiKey: "sk-test-123",
    model: "test-model",
    fetchImpl,
  });
  const res = await runMindExchange(req, adapter);
  assert.deepEqual(res, VALID_REPLY);
  assert.equal(calls.length, 1);

  const call = calls[0];
  assert.equal(call.url, "https://api.example.test/v1/chat/completions");
  assert.equal(call.init?.method, "POST");
  const headers = call.init?.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer sk-test-123");
  assert.equal(headers["Content-Type"], "application/json");
  const body = JSON.parse(String(call.init?.body)) as {
    model: string;
    temperature: number;
    messages: { role: string; content: string }[];
  };
  assert.equal(body.model, "test-model");
  assert.equal(body.temperature, 0.7);
  assert.equal(body.messages.length, 2);
  assert.equal(body.messages[0].role, "system");
  assert.ok(body.messages[0].content.includes(ROLE_PACK));
  assert.ok(body.messages[1].content.includes(DIRECTIVE));
});

test("a fenced JSON reply still parses", async () => {
  const req = makeReq();
  const fenced = "```json\n" + JSON.stringify(VALID_REPLY) + "\n```";
  const { fetchImpl } = scriptedFetch([() => completion(fenced)]);
  const res = await runMindExchange(req, adapterFor(fetchImpl));
  assert.deepEqual(res, VALID_REPLY);
});

test("hints missing nullable refs normalize to null; extra reply keys are dropped", async () => {
  const req = makeReq();
  const payload = {
    goals: ["g"],
    journalEntry: "j",
    intentHints: [{ kind: "chop", tx: 258, ty: 293 }],
    mood: "sunny",
  };
  const { fetchImpl } = scriptedFetch([() => completion(JSON.stringify(payload))]);
  const res = await runMindExchange(req, adapterFor(fetchImpl));
  assert.deepEqual(res, {
    goals: ["g"],
    journalEntry: "j",
    intentHints: [{ kind: "chop", tx: 258, ty: 293, targetId: null, spell: null }],
  });
});

/* ── exchange: graceful degradation ────────────────────────────────── */

test("malformed JSON degrades to the standing goals without retry", async () => {
  const req = makeReq();
  const { fetchImpl, calls } = scriptedFetch([() => completion("I am not JSON {{{")]);
  const res = await runMindExchange(req, adapterFor(fetchImpl));
  assert.deepEqual(res, fallbackOf(req));
  assert.equal(calls.length, 1, "malformed output is not a network failure: no retry");
});

test("wrong-shaped replies degrade gracefully", async () => {
  const bad: unknown[] = [
    { goals: "bank gold", journalEntry: "x", intentHints: [] },
    { goals: [1, 2], journalEntry: "x", intentHints: [] },
    { goals: [], intentHints: [] },
    { goals: [], journalEntry: 7, intentHints: [] },
    { goals: [], journalEntry: "x", intentHints: "walk" },
    { goals: [], journalEntry: "x", intentHints: [{ kind: "dance", tx: 1, ty: 1, targetId: null, spell: null }] },
    { goals: [], journalEntry: "x", intentHints: [{ kind: "walk", tx: 1.5, ty: 1, targetId: null, spell: null }] },
    { goals: [], journalEntry: "x", intentHints: [{ kind: "walk", tx: -1, ty: 1, targetId: null, spell: null }] },
    { goals: [], journalEntry: "x", intentHints: [{ kind: "walk", tx: 99999, ty: 1, targetId: null, spell: null }] },
    { goals: [], journalEntry: "x", intentHints: [{ kind: "walk", tx: 1, ty: 1, targetId: 42, spell: null }] },
    [1, 2, 3],
    "just a string",
    null,
  ];
  for (const payload of bad) {
    const req = makeReq();
    const { fetchImpl, calls } = scriptedFetch([() => completion(JSON.stringify(payload))]);
    const res = await runMindExchange(req, adapterFor(fetchImpl));
    assert.deepEqual(res, fallbackOf(req), `payload ${JSON.stringify(payload)} must degrade`);
    assert.equal(calls.length, 1);
  }
});

/* ── exchange: timeout + retry ─────────────────────────────────────── */

test("the mind timeout contract is 20 seconds", () => {
  assert.equal(MIND_TIMEOUT_MS, 20_000);
});

test("timeout degrades after one retry", async () => {
  const req = makeReq();
  let calls = 0;
  const hang: typeof fetch = (_input, init) => {
    calls++;
    return new Promise<Response>((_resolve, reject) => {
      const sig = init?.signal;
      if (!sig) return;
      if (sig.aborted) reject(new Error("aborted"));
      else sig.addEventListener("abort", () => reject(new Error("aborted")));
    });
  };
  const res = await runMindExchange(req, adapterFor(hang), { timeoutMs: 25 });
  assert.deepEqual(res, fallbackOf(req));
  assert.equal(calls, 2, "one retry on timeout");
});

test("HTTP 500 twice degrades; 500 then success recovers on the retry", async () => {
  const req = makeReq();
  const both = scriptedFetch([() => completion("boom", 500), () => completion("boom", 500)]);
  const res1 = await runMindExchange(req, adapterFor(both.fetchImpl));
  assert.deepEqual(res1, fallbackOf(req));
  assert.equal(both.calls.length, 2);

  const recovers = scriptedFetch([
    () => completion("boom", 500),
    () => completion(JSON.stringify(VALID_REPLY)),
  ]);
  const res2 = await runMindExchange(req, adapterFor(recovers.fetchImpl));
  assert.deepEqual(res2, VALID_REPLY);
  assert.equal(recovers.calls.length, 2);
});

test("a network failure recovers on the retry", async () => {
  const req = makeReq();
  const { fetchImpl, calls } = scriptedFetch([
    () => new TypeError("fetch failed"),
    () => completion(JSON.stringify(VALID_REPLY)),
  ]);
  const res = await runMindExchange(req, adapterFor(fetchImpl));
  assert.deepEqual(res, VALID_REPLY);
  assert.equal(calls.length, 2);
});

/* ── local adapter + secrets ───────────────────────────────────────── */

test("local adapter is the same wire without an Authorization header", async () => {
  const req = makeReq();
  const { fetchImpl, calls } = scriptedFetch([() => completion(JSON.stringify(VALID_REPLY))]);
  const adapter = createLocalAdapter({
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "llama3",
    fetchImpl,
  });
  const res = await runMindExchange(req, adapter);
  assert.deepEqual(res, VALID_REPLY);
  assert.equal(calls[0].url, "http://127.0.0.1:11434/v1/chat/completions");
  const headers = calls[0].init?.headers as Record<string, string>;
  assert.equal(headers.Authorization, undefined);
  assert.ok(!("authorization" in headers));
});

test("the apiKey never reaches logs or error messages", async () => {
  const secret = "sk-SECRET-do-not-log-9f8e7d";
  const req = makeReq();
  const recorded: string[] = [];
  const orig = { log: console.log, warn: console.warn, error: console.error };
  const spy = (...args: unknown[]) => {
    recorded.push(args.map(String).join(" "));
  };
  console.log = spy;
  console.warn = spy;
  console.error = spy;
  try {
    const { fetchImpl } = scriptedFetch([
      () => completion("boom", 500),
      () => completion("boom", 500),
      () => completion("boom", 500),
    ]);
    const adapter = adapterFor(fetchImpl, secret);
    await runMindExchange(req, adapter);
    await assert.rejects(
      () => adapter.complete(assembleMindMessages(req)),
      (err: Error) => err.message === "mind endpoint HTTP 500" && !err.message.includes(secret),
    );
  } finally {
    console.log = orig.log;
    console.warn = orig.warn;
    console.error = orig.error;
  }
  for (const line of recorded) {
    assert.ok(!line.includes(secret), "secret leaked into console output");
  }
});
