/**
 * Reflex helpers — pure builders/normalizers for the Jev-shaped exchange.
 *
 * Backend-pluggable by design: TypeSafe's Jev API is the day-one backend,
 * a self-hosted small decision model (NanoJev recipe) is the scale backend.
 * Both speak these shapes; the sim never cares which answered.
 */
import type {
  ReflexAnswerChoice,
  ReflexAnswerNoul,
  ReflexAnswerScore,
  ReflexChoice,
  ReflexNoul,
  ReflexScore,
} from "./types.ts";

export function choice(id: string, question: string, options: string[]): ReflexChoice {
  if (options.length < 2) throw new Error(`choice ${id}: needs at least two options`);
  if (options.length > 255) throw new Error(`choice ${id}: 255 options max`);
  return { type: "choice", id, question, options };
}

export function score(id: string, question: string, levels: number): ReflexScore {
  if (!Number.isInteger(levels) || levels < 2 || levels > 10) {
    throw new Error(`score ${id}: levels must be an integer 2..10`);
  }
  return { type: "score", id, question, levels };
}

export function noul(id: string, question: string): ReflexNoul {
  return { type: "noul", id, question };
}

/** Defensive normalize: non-positive/NaN entries go to 0; an all-zero row
 *  falls back to uniform so a dead backend can never silently bias. */
export function normalize(probabilities: number[]): number[] {
  const clean = probabilities.map((p) => (Number.isFinite(p) && p > 0 ? p : 0));
  const sum = clean.reduce((a, b) => a + b, 0);
  if (sum <= 0) return clean.map(() => 1 / clean.length);
  return clean.map((p) => p / sum);
}

/** First max wins ties — deterministic, replayable. */
export function topPick(probabilities: number[]): number {
  let best = 0;
  for (let i = 1; i < probabilities.length; i++) {
    if (probabilities[i]! > probabilities[best]!) best = i;
  }
  return best;
}

export function answerChoice(q: ReflexChoice, probabilities: number[]): ReflexAnswerChoice {
  if (probabilities.length !== q.options.length) {
    throw new Error(`choice ${q.id}: ${probabilities.length} probabilities for ${q.options.length} options`);
  }
  const ps = normalize(probabilities);
  return { id: q.id, type: "choice", probabilities: ps, pick: topPick(ps) };
}

export function answerScore(q: ReflexScore, probabilities: number[]): ReflexAnswerScore {
  if (probabilities.length !== q.levels) {
    throw new Error(`score ${q.id}: ${probabilities.length} probabilities for ${q.levels} levels`);
  }
  const ps = normalize(probabilities);
  const expectation = ps.reduce((acc, p, i) => acc + p * (i + 1), 0);
  return { id: q.id, type: "score", probabilities: ps, expectation };
}

export function answerNoul(q: ReflexNoul, p: number): ReflexAnswerNoul {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0));
  return { id: q.id, type: "noul", p: clamped };
}
