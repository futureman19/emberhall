/**
 * Decision log — every reflex/mind call, one row. Append-only.
 *
 * This schema IS the training set for Emberhall Reflex v1: (state, candidates,
 * answer) plus back-filled outcome deltas once the sim has moved on. Keep it
 * stable; additive fields only.
 */
import type { DecisionLogRow, Observation } from "./types.ts";

export interface DecisionLog {
  rows: DecisionLogRow[];
  append(row: DecisionLogRow): void;
  toJSONL(): string;
}

export function createDecisionLog(): DecisionLog {
  const rows: DecisionLogRow[] = [];
  return {
    rows,
    append(row) {
      rows.push(row);
    },
    toJSONL() {
      return rows.map((r) => JSON.stringify(r)).join("\n");
    },
  };
}

/** Deterministic key-sorted stringify (no runtime dep, stable across hosts). */
function stable(x: unknown): string {
  if (x === null || typeof x !== "object") return JSON.stringify(x) ?? "null";
  if (Array.isArray(x)) return `[${x.map(stable).join(",")}]`;
  const rec = x as Record<string, unknown>;
  return `{${Object.keys(rec)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(rec[k])}`)
    .join(",")}}`;
}

/** FNV-1a over the decision-relevant slice: you + verb menu + tick. Two
 *  observations with the same decision surface hash equal — that is what
 *  makes logged states replayable and dedupe-able in training. */
export function hashObservation(obs: Observation): string {
  const s = stable({
    tick: obs.tick,
    you: obs.you,
    verbs: obs.verbs.map((v) => `${v.verb}@${v.target.id}`),
  });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
