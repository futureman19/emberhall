import assert from "node:assert/strict";
import { test } from "node:test";
import { digestAnswers, type AttemptBegin, type AttemptEnd } from "./attempts.ts";
import { DEFAULT_PRICE } from "./pricing.ts";
import { answerChoice, answerNoul, answerScore, choice, noul, score } from "./reflex.ts";
import { replayLog } from "./replay.ts";
import type { ReflexAnswer } from "./types.ts";

const next = choice("next", "Next?", ["wait", "walk"]);
const risk = score("risk", "Risk?", 2);
const danger = noul("danger", "Danger?");

function fixture(strict = false): [AttemptBegin, AttemptEnd] {
  const answers = [answerChoice(next, [1, 3]), answerScore(risk, [1, 3]), answerNoul(danger, 0.25)];
  return [
    {
      type: "begin",
      attemptId: "a1",
      agentId: "agent",
      bodyId: "body",
      lane: "reflex",
      trigger: { kind: "heartbeat", detail: "" },
      tick: 1,
      stateHash: "x",
      startedAt: 0,
      provider: null,
      request: {
        exchange: { state: {}, questions: [next, risk, danger] },
        bytes: 100,
        redactions: 0,
      },
      reservationId: null,
      retryOf: null,
      retryN: 0,
    },
    {
      type: "end",
      attemptId: "a1",
      endedAt: 1,
      status: "ok",
      response: {
        answers,
        raw: strict ? { next: [1, 3], risk: [1, 3], danger: 0.25 } : null,
        action: digestAnswers(answers),
      },
      error: null,
      usage: null,
      cost: { micros: 1, basis: "estimated", price: DEFAULT_PRICE },
      latencyMs: 1,
    },
  ];
}

for (const strict of [false, true]) {
  test(`valid ${strict ? "strict" : "shallow"} replay remains accepted`, () => {
    const summary = replayLog(fixture(strict));
    assert.equal(summary.matched, 1);
    assert.deepEqual(summary.mismatches, []);
    assert.equal(summary.paidCallsIssued, 0);
  });
  for (const missing of ["exchange", "response", "answers", "action"] as const) {
    test(`${strict ? "strict" : "shallow"} successful row missing ${missing} counts as mismatch`, () => {
      const lines = fixture(strict);
      if (missing === "exchange") lines[0].request.exchange = null;
      else if (missing === "response") lines[1].response = null;
      else lines[1].response![missing] = null;
      const summary = replayLog(lines);
      assert.equal(summary.replayed, 1);
      assert.equal(summary.matched, 0);
      assert.equal(summary.mismatches.length, 1);
      assert.match(summary.mismatches[0]!.problems.join("; "), /incomplete|digest/);
      assert.equal(summary.paidCallsIssued, 0);
    });
  }
}

const corruptions: [string, (answers: ReflexAnswer[]) => void, RegExp][] = [
  [
    "duplicate answer",
    (a) => {
      a.push({ ...a[0]! });
    },
    /duplicate answer/,
  ],
  [
    "missing answer",
    (a) => {
      a.pop();
    },
    /answer count/,
  ],
  [
    "unknown answer",
    (a) => {
      a[0]!.id = "unknown";
    },
    /unknown question/,
  ],
  [
    "fractional pick",
    (a) => {
      if (a[0]!.type === "choice") a[0]!.pick = 0.5;
    },
    /pick/,
  ],
  [
    "NaN pick",
    (a) => {
      if (a[0]!.type === "choice") a[0]!.pick = NaN;
    },
    /pick/,
  ],
  [
    "out-of-range pick",
    (a) => {
      if (a[0]!.type === "choice") a[0]!.pick = 2;
    },
    /pick/,
  ],
];
for (const index of [0, 1]) {
  for (const probabilities of [[-1, 2], [NaN, 1], [Infinity, 0], [0.2, 0.2], [1]]) {
    corruptions.push([
      `${index === 0 ? "choice" : "score"} probabilities ${probabilities}`,
      (a) => {
        const answer = a[index]!;
        if (answer.type !== "noul") answer.probabilities = probabilities;
      },
      /probabilities|probs/,
    ]);
  }
}
for (const expectation of [1, NaN, Infinity]) {
  corruptions.push([
    `score expectation ${expectation}`,
    (a) => {
      if (a[1]!.type === "score") a[1]!.expectation = expectation;
    },
    /expectation/,
  ]);
}
for (const p of [-1, 2, NaN, Infinity]) {
  corruptions.push([
    `noul probability ${p}`,
    (a) => {
      if (a[2]!.type === "noul") a[2]!.p = p;
    },
    /out of range/,
  ]);
}
for (const [name, corrupt, problem] of corruptions) {
  test(`shallow replay rejects ${name} even with matching digest`, () => {
    const lines = fixture();
    const response = lines[1].response!;
    corrupt(response.answers!);
    response.action = digestAnswers(response.answers!);
    const summary = replayLog(lines);
    assert.equal(summary.matched, 0);
    assert.equal(summary.mismatches.length, 1);
    assert.match(summary.mismatches[0]!.problems.join("; "), problem);
  });
}

test("an orphan successful end is a mismatch, not a silently skipped row", () => {
  const summary = replayLog([fixture()[1]]);
  assert.equal(summary.mismatches.length, 1);
});

test("non-ok and non-reflex attempts remain excluded from replay", () => {
  for (const excluded of ["error", "mind"] as const) {
    const lines = fixture();
    if (excluded === "error") lines[1].status = "error";
    else lines[0].lane = "mind";
    lines[1].response = null;
    const summary = replayLog(lines);
    assert.equal(summary.replayed, 0);
    assert.deepEqual(summary.mismatches, []);
  }
});
