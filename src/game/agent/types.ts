/**
 * Agent harness — wire types between a body in the vale and its brain.
 *
 * Phase 0 (harness contract): these types are the protocol every later
 * workstream builds against — the host (src/server), the reflex backend
 * (Jev-shaped), and the BYO-LLM mind adapters. Phase 0 is player-centric:
 * `you` is always the solo player. The multi-body refactor (Codex lane)
 * generalizes every `bodyId` below without changing these shapes.
 */
import type {
  CtxTarget,
  CtxVerb,
  Intent,
  ItemId,
  Notoriety,
  SkillId,
  WearSlot,
} from "../types.ts";

/** What a body knows about itself. Flat, JSON-safe, no sim internals. */
export interface BodySheet {
  id: string;
  name: string;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  hunger: number;
  energy: number;
  ghost: boolean;
  mana: number;
  notoriety: Notoriety;
  skills: Partial<Record<SkillId, number>>;
  pack: Partial<Record<ItemId, number>>;
  wear: Partial<Record<WearSlot, ItemId>>;
  /** Bank gold. Pocket change lives in `pack` like every other good. */
  vault: number;
}

export interface ObservedPerson {
  id: string;
  name: string;
  role: string | null;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  task: string;
  ghost: boolean;
  dist: number;
}

export interface ObservedFauna {
  id: string;
  kind: string;
  name: string | null;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  task: string;
  ownerId: string | null;
  dist: number;
}

export interface ObservedPile {
  id: string;
  label: string;
  tx: number;
  ty: number;
  dist: number;
}

export interface ObservedBuilding {
  id: string;
  kind: string;
  tx: number;
  ty: number;
  dist: number;
}

export interface ObservedPlot {
  id: string;
  crop: string | null;
  stage: number;
  tx: number;
  ty: number;
  dist: number;
}

export interface ObservedHerb {
  id: string;
  kind: string;
  tx: number;
  ty: number;
  dist: number;
}

/** One legal action, exactly as the context menu computes it. */
export interface VerbCandidate {
  verb: CtxVerb;
  label: string;
  target: CtxTarget;
}

/** Everything a brain receives to decide. */
export interface Observation {
  tick: number;
  hour: number;
  isNight: boolean;
  weather: { kind: string; cloud: number; wet: number; wind: number };
  you: BodySheet;
  people: ObservedPerson[];
  fauna: ObservedFauna[];
  piles: ObservedPile[];
  buildings: ObservedBuilding[];
  plots: ObservedPlot[];
  herbs: ObservedHerb[];
  verbs: VerbCandidate[];
  logTail: string[];
}

/** The action wire is the sim's own Intent — no parallel protocol. */
export type AgentIntent = Intent;

/* ── Reflex exchange (System One / Jev-shaped) ─────────────────────── */

export interface ReflexChoice {
  type: "choice";
  id: string;
  question: string;
  options: string[];
}

export interface ReflexScore {
  type: "score";
  id: string;
  question: string;
  /** Ordered levels, 2..10. */
  levels: number;
}

/** Yes/no, priced as one probability. ("Noul" = bernoulli, Jev's spelling.) */
export interface ReflexNoul {
  type: "noul";
  id: string;
  question: string;
}

export type ReflexQuestion = ReflexChoice | ReflexScore | ReflexNoul;

export interface ReflexAnswerChoice {
  id: string;
  type: "choice";
  /** Normalized, same order as the question's options. */
  probabilities: number[];
  /** Index of the strongest option (first max on ties). */
  pick: number;
}

export interface ReflexAnswerScore {
  id: string;
  type: "score";
  probabilities: number[];
  expectation: number;
}

export interface ReflexAnswerNoul {
  id: string;
  type: "noul";
  p: number;
}

export type ReflexAnswer = ReflexAnswerChoice | ReflexAnswerScore | ReflexAnswerNoul;

export interface ReflexExchange {
  /** Serialized Observation slice — backend decides how much to send. */
  state: unknown;
  questions: ReflexQuestion[];
}

export interface ReflexResult {
  answers: ReflexAnswer[];
}

/* ── Mind exchange (BYO LLM — slow path) ───────────────────────────── */

export interface MindRequest {
  /** The owner's standing instruction, written at character creation. */
  directive: string;
  /** Injected skill pack markdown (role). */
  rolePack: string;
  /** Injected vale manual markdown. */
  manual: string;
  observation: Observation;
  /** Standing goals from prior exchanges. */
  goals: string[];
  /** Recent journal lines the mind wrote for its owner. */
  journalTail: string[];
}

export interface MindResponse {
  /** Updated standing goals. Reflexes evaluate against these. */
  goals: string[];
  /** A line for the owner's journal — the character's own voice. */
  journalEntry: string;
  /**
   * Advisory next actions. Never executed raw: each hint is validated
   * against the legal VerbCandidate set before it becomes an Intent.
   */
  intentHints: AgentIntent[];
}

/* ── Decision log (= training schema for Emberhall Reflex v1) ──────── */

export interface DecisionLogRow {
  tick: number;
  bodyId: string;
  lane: "reflex" | "mind";
  /** The question as asked, verbatim. */
  question: string;
  /** Candidate labels/ids as presented, in order. */
  candidates: string[];
  /** The chosen candidate (or free-form mind answer digest). */
  answer: string;
  /** The intent actually submitted, if any. */
  intent: AgentIntent | null;
  /** Stable hash of the observation the decision was made against. */
  stateHash: string;
  /** Back-filled sim deltas (hp, gold, pack counts) once known. */
  outcome: Record<string, number> | null;
}

/* ── Cadence (cost contract) ───────────────────────────────────────── */

export interface CadencePolicy {
  /** Slow-path mind think interval, in vale hours. */
  mindHeartbeatHours: number;
  /** Quiet window: reflexes sleep unless the body is in danger. */
  sleepStartHour: number;
  sleepEndHour: number;
  /** Minimum ticks between reflex calls for one body. */
  reflexCooldownTicks: number;
}

export const DEFAULT_CADENCE: CadencePolicy = {
  mindHeartbeatHours: 3,
  sleepStartHour: 22,
  sleepEndHour: 6,
  reflexCooldownTicks: 2,
};
