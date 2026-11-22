/**
 * Replay tooling — reconstruct logged decisions WITHOUT new paid calls.
 *
 * Two fidelity levels, both pure functions over the log:
 *
 * - STRICT (backend recorded `raw` probabilities): the raw probabilities are
 *   re-run through the same normalization/answer builders (reflex.ts) and
 *   the result must deep-equal the recorded normalized answers, and the
 *   re-derived action digest must equal the recorded action. This proves the
 *   recorded inputs and outputs reproduce the recorded decision.
 * - SHALLOW (answers only, no raw): structural invariants are checked —
 *   every question answered exactly once, probabilities normalized and
 *   in-range, pick within options — plus digest consistency. Catches
 *   corruption/truncation, cannot prove pre-normalization fidelity.
 *
 * There is deliberately NO backend parameter anywhere in this module: replay
 * can never issue a provider call, paid or otherwise.
 */
import { digestAnswers, foldAttempts, type AttemptLine, type FoldedAttempt } from "./attempts.ts";
import { DEFAULT_PRICE } from "./pricing.ts";
import { answerChoice, answerNoul, answerScore } from "./reflex.ts";
import type { ReflexAnswer, ReflexExchange, ReflexQuestion } from "./types.ts";

export interface ReplayVerdict {
  attemptId: string;
  agentId: string;
  day: string;
  status: string;
  /** false for non-ok attempts (nothing to reconstruct) and non-reflex lanes. */
  replayed: boolean;
  /** re-derived decision equals the recorded decision. */
  match: boolean;
  /** "strict" when raw probabilities were available, else "shallow". */
  level: "strict" | "shallow" | null;
  /** reconstructed action digest (what the reflex decided). */
  action: string | null;
  problems: string[];
}

function questionsOf(f: FoldedAttempt): ReflexQuestion[] | null {
  const ex = f.request.exchange as Partial<ReflexExchange> | null;
  if (!ex || !Array.isArray(ex.questions)) return null;
  return ex.questions as ReflexQuestion[];
}

function checkAnswersAgainstQuestions(
  questions: ReflexQuestion[],
  answers: ReflexAnswer[],
): string[] {
  const problems: string[] = [];
  const byId = new Map(answers.map((a) => [a.id, a]));
  for (const q of questions) {
    const a = byId.get(q.id);
    if (!a) {
      problems.push(`missing answer for question ${q.id}`);
      continue;
    }
    if (a.type !== q.type) {
      problems.push(`answer ${q.id}: type ${a.type} != question type ${q.type}`);
      continue;
    }
    if (a.type === "choice" && q.type === "choice") {
      if (a.probabilities.length !== q.options.length) {
        problems.push(`answer ${q.id}: ${a.probabilities.length} probs for ${q.options.length} options`);
      }
      if (a.pick < 0 || a.pick >= q.options.length) {
        problems.push(`answer ${q.id}: pick ${a.pick} outside ${q.options.length} options`);
      }
      const sum = a.probabilities.reduce((x, y) => x + y, 0);
      if (Math.abs(sum - 1) > 1e-6) problems.push(`answer ${q.id}: probabilities sum ${sum}`);
    }
    if (a.type === "score" && q.type === "score" && a.probabilities.length !== q.levels) {
      problems.push(`answer ${q.id}: ${a.probabilities.length} probs for ${q.levels} levels`);
    }
    if (a.type === "noul" && (a.p < 0 || a.p > 1)) {
      problems.push(`answer ${q.id}: p ${a.p} out of range`);
    }
  }
  for (const a of answers) {
    if (!questions.some((q) => q.id === a.id)) problems.push(`answer for unknown question ${a.id}`);
  }
  return problems;
}

function rederiveFromRaw(
  questions: ReflexQuestion[],
  raw: Record<string, number[] | number>,
): { answers: ReflexAnswer[]; problems: string[] } {
  const answers: ReflexAnswer[] = [];
  const problems: string[] = [];
  for (const q of questions) {
    const r = raw[q.id];
    if (r === undefined) {
      problems.push(`raw probabilities missing for question ${q.id}`);
      continue;
    }
    try {
      if (q.type === "choice") answers.push(answerChoice(q, r as number[]));
      else if (q.type === "score") answers.push(answerScore(q, r as number[]));
      else answers.push(answerNoul(q, r as number));
    } catch (err) {
      problems.push(`raw for ${q.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { answers, problems };
}

/** Reconstruct one recorded decision. Pure — no provider is ever contacted. */
export function replayAttempt(f: FoldedAttempt): ReplayVerdict {
  const base: ReplayVerdict = {
    attemptId: f.attemptId,
    agentId: f.agentId,
    day: f.day,
    status: f.status,
    replayed: false,
    match: false,
    level: null,
    action: null,
    problems: [],
  };
  if (f.status !== "ok") {
    base.problems.push(`status ${f.status}: nothing to replay`);
    return base;
  }
  if (f.lane !== "reflex") {
    base.problems.push(`lane ${f.lane}: reflex-only reconstruction`);
    return base;
  }
  const questions = questionsOf(f);
  const answers = f.response?.answers ?? null;
  const recordedAction = f.response?.action ?? null;
  if (!questions || !answers) {
    base.problems.push("recorded request/response incomplete — cannot replay");
    base.match = false;
    return base;
  }
  base.replayed = true;

  const raw = (f.response?.raw ?? null) as Record<string, number[] | number> | null;
  if (raw) {
    base.level = "strict";
    const derived = rederiveFromRaw(questions, raw);
    base.problems.push(...derived.problems);
    if (derived.answers.length === questions.length) {
      if (JSON.stringify(derived.answers) !== JSON.stringify(answers)) {
        base.problems.push("re-derived answers differ from recorded answers");
      }
      base.action = digestAnswers(derived.answers);
    }
  } else {
    base.level = "shallow";
    base.problems.push(...checkAnswersAgainstQuestions(questions, answers));
    base.action = digestAnswers(answers);
  }

  if (base.action !== null && recordedAction !== null && base.action !== recordedAction) {
    base.problems.push(`action digest ${base.action} != recorded ${recordedAction}`);
  }
  base.match = base.problems.length === 0;
  return base;
}

export interface ReplaySummary {
  attempts: number;
  replayed: number;
  matched: number;
  mismatches: ReplayVerdict[];
  /** Always zero — replay issues no provider calls, by construction. */
  paidCallsIssued: 0;
}

export function replayLog(
  lines: AttemptLine[],
  opts: { agentId?: string; day?: string; lane?: string } = {},
): ReplaySummary {
  const folded = foldAttempts(lines, DEFAULT_PRICE).filter(
    (f) =>
      (opts.agentId === undefined || f.agentId === opts.agentId) &&
      (opts.day === undefined || f.day === opts.day) &&
      (opts.lane === undefined || f.lane === opts.lane),
  );
  const verdicts = folded.map(replayAttempt);
  const mismatches = verdicts.filter((v) => v.replayed && !v.match);
  return {
    attempts: folded.length,
    replayed: verdicts.filter((v) => v.replayed).length,
    matched: verdicts.filter((v) => v.replayed && v.match).length,
    mismatches,
    paidCallsIssued: 0,
  };
}
