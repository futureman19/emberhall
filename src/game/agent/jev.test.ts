import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createJevBackend,
  JEV_PROVIDER,
  jevConfigFromEnv,
} from "./jev.ts";
import { choice, noul, score } from "./reflex.ts";
import type { ReflexExchange } from "./types.ts";

const KEY = "test-jev-key-abc123";

const EXCHANGE: ReflexExchange = {
  state: { tick: 12, you: { hp: 20, maxHp: 30, hunger: 0.7 } },
  questions: [
    choice("verb", "Which verb should the body take right now?", ["chop oak", "walk north", "wait"]),
    noul("danger", "Is the body in immediate danger?"),
    score("hunger", "How urgently does the body need food?", 3),
  ],
};

const OK_BODY = {
  model: "jev-1.13.0",
  answers: {
    verb: {
      type: "choice",
      choice: "chop oak",
      confidence: 0.8,
      probabilities: { "chop oak": 0.7, "walk north": 0.2, wait: 0.1 },
    },
    danger: { type: "noul", noul: 0.9 },
    hunger: {
      type: "score",
      score: 1.1,
      confidence: 0.5,
      legend: { "0": "Level 1 of 3", "1": "Level 2 of 3", "2": "Level 3 of 3" },
      probabilities: { "0": 0.2, "1": 0.5, "2": 0.3 },
    },
  },
  usage: { input_tokens: 300, output_tokens: 25 },
};

interface Captured {
  url: string;
  headers: Record<string, string>;
  body: { model: string; state: unknown; questions: Record<string, unknown> };
}

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

/** Mock fetch returning scripted responses (a function may compute one per call). */
function mockFetch(
  script: Array<Response | (() => Response) | (() => never)>,
  captured: Captured[] = [],
  calls: { n: number } = { n: 0 },
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.n += 1;
    captured.push({
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: JSON.parse(String(init?.body ?? "null")),
    });
    const step = script[Math.min(calls.n - 1, script.length - 1)]!;
    if (typeof step === "function") return (step as () => Response)();
    return step.clone(); // a Response body can be consumed once — retries get a fresh copy
  }) as typeof fetch;
}

function backend(overrides: Partial<Parameters<typeof createJevBackend>[0]> = {}) {
  const sleeps: number[] = [];
  let tick = 1_000;
  const b = createJevBackend({
    apiKey: KEY,
    sleep: (ms) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
    now: () => (tick += 5),
    ...overrides,
  });
  return { backend: b, sleeps };
}

test("valid exchange maps answers through the contract and exposes usage/latency/provider metadata", async () => {
  const captured: Captured[] = [];
  const { backend: b } = backend({ fetchImpl: mockFetch([jsonResponse(200, OK_BODY)], captured) });

  const out = await b.decide(EXCHANGE);
  assert.equal(out.ok, true);
  if (!out.ok) return;

  // Contract-shaped answers, probabilities in QUESTION option order.
  assert.equal(out.result.answers.length, 3);
  const [verb, danger, hunger] = out.result.answers;
  assert.equal(verb?.type, "choice");
  if (verb?.type === "choice") {
    // normalize() divides by the float sum — compare with epsilon.
    [0.7, 0.2, 0.1].forEach((p, i) => assert.ok(Math.abs(verb.probabilities[i]! - p) < 1e-9));
    assert.equal(verb.pick, 0);
    assert.equal(verb.id, "verb");
  }
  assert.deepEqual(danger, { id: "danger", type: "noul", p: 0.9 });
  assert.equal(hunger?.type, "score");
  if (hunger?.type === "score") {
    // 1-based harness expectation: 0.2·1 + 0.5·2 + 0.3·3 = 2.1 (Jev's own 0-based score is ignored).
    assert.ok(Math.abs(hunger.expectation - 2.1) < 1e-9);
    assert.deepEqual(hunger.probabilities, [0.2, 0.5, 0.3]);
  }

  // Accounting metadata for the DecisionLog lane.
  assert.equal(out.meta.provider, JEV_PROVIDER);
  assert.equal(out.meta.model, "jev-latest");
  assert.equal(out.meta.resolvedModel, "jev-1.13.0");
  assert.deepEqual(out.meta.usage, { inputTokens: 300, outputTokens: 25 });
  assert.equal(out.meta.attempts.length, 1);
  assert.equal(out.meta.attempts[0]?.outcome, "ok");
  assert.equal(out.meta.attempts[0]?.httpStatus, 200);
  assert.deepEqual(out.meta.attempts[0]?.usage, { inputTokens: 300, outputTokens: 25 });
  assert.ok(out.meta.attempts[0]?.latencyMs >= 0);
  assert.ok(out.meta.latencyMs >= 0);

  // Wire shape: bearer auth, model field, Jev question map.
  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.url, "https://api.typesafe.ai/v1/systemone");
  assert.equal(captured[0]?.headers.authorization, `Bearer ${KEY}`);
  assert.equal(captured[0]?.body.model, "jev-latest");
  assert.deepEqual(captured[0]?.body.state, EXCHANGE.state);
  const qs = captured[0]?.body.questions ?? {};
  assert.deepEqual(qs.verb, {
    type: "choice",
    instructions: "Which verb should the body take right now?",
    criteria: { "chop oak": "chop oak", "walk north": "walk north", wait: "wait" },
  });
  assert.deepEqual(qs.danger, { type: "noul", instructions: "Is the body in immediate danger?" });
  assert.deepEqual(qs.hunger, {
    type: "score",
    instructions: "How urgently does the body need food?",
    criteria: ["Level 1 of 3", "Level 2 of 3", "Level 3 of 3"],
  });
});

test("invalid action: pick outside the candidate set is rejected and retried, never applied", async () => {
  const bad = jsonResponse(200, {
    ...OK_BODY,
    answers: { ...OK_BODY.answers, verb: { ...OK_BODY.answers.verb, choice: "fly away" } },
  });
  const calls = { n: 0 };
  const { backend: b } = backend({ fetchImpl: mockFetch([bad], [], calls) });

  const out = await b.decide(EXCHANGE);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.equal(out.error.kind, "exhausted");
  assert.equal(calls.n, 3, "bounded: 1 + 2 retries");
  assert.ok(out.meta.attempts.every((a) => a.outcome === "invalid_response"));
  assert.match(out.meta.attempts[0]?.error ?? "", /not a candidate/);
  // The provider still consumed tokens — usage is visible on every attempt.
  assert.ok(out.meta.attempts.every((a) => a.usage !== null));
  assert.deepEqual(out.meta.usage, { inputTokens: 300, outputTokens: 25 });
});

test("invalid action: missing probability for a candidate fails the attempt", async () => {
  const bad = jsonResponse(200, {
    ...OK_BODY,
    answers: {
      ...OK_BODY.answers,
      verb: {
        ...OK_BODY.answers.verb,
        probabilities: { "chop oak": 0.9, "walk north": 0.1 }, // "wait" missing
      },
    },
  });
  const { backend: b } = backend({ fetchImpl: mockFetch([bad]) });
  const out = await b.decide(EXCHANGE);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.equal(out.meta.attempts[0]?.outcome, "invalid_response");
  assert.match(out.meta.attempts[0]?.error ?? "", /probability/);
});

test("invalid action: answer type must match its question type", async () => {
  const bad = jsonResponse(200, {
    ...OK_BODY,
    answers: { ...OK_BODY.answers, verb: { type: "noul", noul: 0.5 } },
  });
  const { backend: b } = backend({ fetchImpl: mockFetch([bad], [], { n: 0 }), maxRetries: 0 });
  const out = await b.decide(EXCHANGE);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.equal(out.meta.attempts.length, 1, "maxRetries 0 = single attempt");
  assert.match(out.meta.attempts[0]?.error ?? "", /answer type/);
});

test("provider 500 is retried and a later success still reports the failed attempt", async () => {
  const calls = { n: 0 };
  const { backend: b, sleeps } = backend({
    fetchImpl: mockFetch([jsonResponse(500, { detail: "upstream blew up" }), () => jsonResponse(200, OK_BODY)], [], calls),
  });
  const out = await b.decide(EXCHANGE);
  assert.equal(out.ok, true);
  if (!out.ok) return;
  assert.equal(calls.n, 2);
  assert.equal(out.meta.attempts[0]?.outcome, "http_error");
  assert.equal(out.meta.attempts[0]?.httpStatus, 500);
  assert.equal(out.meta.attempts[1]?.outcome, "ok");
  assert.deepEqual(sleeps, [250], "one backoff between attempts");
  assert.deepEqual(out.meta.usage, { inputTokens: 300, outputTokens: 25 });
});

test("provider 400 is not retried — retrying a rejected request only burns tokens", async () => {
  const calls = { n: 0 };
  const { backend: b } = backend({ fetchImpl: mockFetch([jsonResponse(400, { detail: "unknown model" })], [], calls) });
  const out = await b.decide(EXCHANGE);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.equal(out.error.kind, "provider_rejected");
  assert.equal(calls.n, 1);
  assert.equal(out.meta.attempts.length, 1);
  assert.equal(out.meta.attempts[0]?.httpStatus, 400);
  assert.match(out.error.message, /unknown model/);
});

test("provider 429 with Retry-After is retried within the bounded wait", async () => {
  const { backend: b, sleeps } = backend({
    fetchImpl: mockFetch([
      jsonResponse(429, { detail: "slow down" }, { "retry-after": "1" }),
      () => jsonResponse(200, OK_BODY),
    ]),
  });
  const out = await b.decide(EXCHANGE);
  assert.equal(out.ok, true);
  assert.deepEqual(sleeps, [1000], "Retry-After honored under the 5s cap");
});

test("Retry-After hints above the cap are clamped — a provider cannot park the loop", async () => {
  const { backend: b, sleeps } = backend({
    fetchImpl: mockFetch([
      jsonResponse(429, { detail: "slow down" }, { "retry-after": "60" }),
      () => jsonResponse(200, OK_BODY),
    ]),
  });
  const out = await b.decide(EXCHANGE);
  assert.equal(out.ok, true);
  assert.deepEqual(sleeps, [5000], "clamped to JEV_MAX_RETRY_AFTER_MS");
});

test("provider 422 validation rejection is not retried — the request itself is wrong", async () => {
  const calls = { n: 0 };
  const { backend: b } = backend({
    fetchImpl: mockFetch([
      jsonResponse(422, { detail: [{ msg: "field required", loc: ["body", "questions"] }] }),
    ], [], calls),
  });
  const out = await b.decide(EXCHANGE);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.equal(out.error.kind, "provider_rejected");
  assert.equal(calls.n, 1);
  assert.match(out.error.message, /field required/);
  assert.match(out.error.message, /body\.questions/);
});

test("provider 529 overloaded is retried like any 5xx", async () => {
  const calls = { n: 0 };
  const { backend: b } = backend({
    fetchImpl: mockFetch([
      jsonResponse(529, { detail: "overloaded" }),
      () => jsonResponse(200, OK_BODY),
    ], [], calls),
  });
  const out = await b.decide(EXCHANGE);
  assert.equal(out.ok, true);
  assert.equal(calls.n, 2);
});

test("invalid request: oversized state is rejected before any HTTP", async () => {
  const calls = { n: 0 };
  const { backend: b } = backend({ fetchImpl: mockFetch([jsonResponse(200, OK_BODY)], [], calls) });
  const big: ReflexExchange = {
    state: { blob: "x".repeat(40 * 1024) },
    questions: [noul("a", "ok?")],
  };
  const out = await b.decide(big);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.equal(out.error.kind, "invalid_request");
  assert.match(out.error.message, /max/);
  assert.equal(calls.n, 0);
});

test("network failure exhausts bounded retries and reports every attempt", async () => {
  const calls = { n: 0 };
  const { backend: b, sleeps } = backend({
    fetchImpl: mockFetch([() => {
      throw new Error("socket hang up");
    }], [], calls),
  });
  const out = await b.decide(EXCHANGE);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.equal(out.error.kind, "exhausted");
  assert.equal(calls.n, 3);
  assert.deepEqual(sleeps, [250, 500], "exponential backoff");
  assert.ok(out.meta.attempts.every((a) => a.outcome === "network_error"));
  assert.equal(out.meta.usage, null, "provider never reported usage — unknown, not free");
});

test("timeout: a hung provider call is aborted, bounded, and recorded", async () => {
  const hungFetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("The operation was aborted", "AbortError")),
      );
    })) as typeof fetch;
  const calls = { n: 0 };
  const counted: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.n += 1;
    return hungFetch(input, init);
  }) as typeof fetch;
  const { backend: b } = backend({
    fetchImpl: counted,
    timeoutMs: 20,
    maxRetries: 1,
    sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 5))),
    now: () => Date.now(),
  });
  const out = await b.decide(EXCHANGE);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.equal(out.error.kind, "exhausted");
  assert.equal(calls.n, 2);
  assert.ok(out.meta.attempts.every((a) => a.outcome === "timeout"));
});

test("config: no API key fails before any HTTP and says how to fix it", async () => {
  const calls = { n: 0 };
  const { backend: b } = backend({ apiKey: "", fetchImpl: mockFetch([jsonResponse(200, OK_BODY)], [], calls) });
  const out = await b.decide(EXCHANGE);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.equal(out.error.kind, "config");
  assert.equal(calls.n, 0, "no HTTP attempted");
  assert.equal(out.meta.attempts.length, 0);
  assert.match(out.error.message, /TYPESAFE_API_KEY/);
});

test("invalid request: duplicate question ids fail before any HTTP", async () => {
  const calls = { n: 0 };
  const { backend: b } = backend({ fetchImpl: mockFetch([jsonResponse(200, OK_BODY)], [], calls) });
  const bad: ReflexExchange = { state: {}, questions: [noul("a", "one?"), noul("a", "two?")] };
  const out = await b.decide(bad);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.equal(out.error.kind, "invalid_request");
  assert.match(out.error.message, /duplicate question id/);
  assert.equal(calls.n, 0);
});

test("invalid request: unserializable state fails before any HTTP", async () => {
  const calls = { n: 0 };
  const { backend: b } = backend({ fetchImpl: mockFetch([jsonResponse(200, OK_BODY)], [], calls) });
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  const out = await b.decide({ state: circular, questions: [noul("a", "ok?")] });
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.equal(out.error.kind, "invalid_request");
  assert.equal(calls.n, 0);
});

test("credentials never leak: a provider echoing the key is redacted from errors", async () => {
  const malicious = jsonResponse(400, { detail: `bad key ${KEY} rejected` });
  const { backend: b } = backend({ fetchImpl: mockFetch([malicious]) });
  const out = await b.decide(EXCHANGE);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.ok(!out.error.message.includes(KEY), "error message carries the key");
  assert.ok(out.error.message.includes("[redacted]"));
  assert.ok(!out.meta.attempts[0]?.error?.includes(KEY), "attempt error carries the key");
  assert.ok(!JSON.stringify(out.meta).includes(KEY), "metadata carries the key");
});

test("missing usage on a valid response stays null — unknown, never silently free", async () => {
  const noUsage = jsonResponse(200, { model: "jev-1.13.0", answers: OK_BODY.answers });
  const { backend: b } = backend({ fetchImpl: mockFetch([noUsage]) });
  const out = await b.decide(EXCHANGE);
  assert.equal(out.ok, true);
  if (!out.ok) return;
  assert.equal(out.meta.usage, null);
  assert.equal(out.meta.attempts[0]?.usage, null);
  assert.equal(out.meta.resolvedModel, "jev-1.13.0");
});

test("jevConfigFromEnv: null without a key, wired config with one", () => {
  assert.equal(jevConfigFromEnv({}), null);
  assert.equal(jevConfigFromEnv({ TYPESAFE_API_KEY: "  " }), null);
  const cfg = jevConfigFromEnv({
    TYPESAFE_API_KEY: " k ",
    TYPESAFE_MODEL: "jev-latest",
    TYPESAFE_TIMEOUT_MS: "4000",
    TYPESAFE_MAX_RETRIES: "1",
  });
  assert.ok(cfg);
  assert.equal(cfg.apiKey, "k");
  assert.equal(cfg.model, "jev-latest");
  assert.equal(cfg.timeoutMs, 4000);
  assert.equal(cfg.maxRetries, 1);
});
