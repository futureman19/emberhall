/**
 * Reflex autopilot — a body run by reflexes alone.
 *
 * Contract §4: "Local minds sleep when the owner's machine sleeps. The
 * character never logs off; it runs on instinct. This is a feature, and the
 * marketing word for it is autopilot." There is deliberately NO planner slot
 * and NO human-action fallback here: observation in → reflex decision →
 * validated intent into the same pipeline the UI writes. If the backend
 * fails, the body keeps its current intent and the scheduler's backoff
 * bounds the burn — nothing else steps in.
 *
 * Wiring: Observation (pushed by the host feed — src/server/ws.ts serves
 * {type:"welcome"|"obs"} frames, adapted by hostfeed.ts — or pulled via
 * `step` in the solo-vale driver) → scheduler (event cadence) →
 * ReflexExchange (one choice question over the intent-mappable verb menu) →
 * ReflexBackend (stub by default; the Jev API backend from t_0b00ee59 drops
 * in behind the same interface) → AgentIntent via submitIntent (solo driver)
 * or the host's intent/ack wire (hostfeed submit).
 *
 * Coverage note: only CtxVerbs with an Intent-wire equivalent are offered as
 * options (see INTENT_FOR_VERB). UI-flow verbs (talk, bank, use station,
 * roster, …) are excluded so a picked option can always become an intent —
 * the reflex backend structurally cannot select an unexecutable action.
 * Widening the wire (eat, talk-as-intent, …) is a contract change owned by
 * the harness, not something the autopilot should smuggle in.
 */
import { bestPlantableTimber } from "../forestry.ts";
import type { CtxVerb, Intent, IntentKind, SpellId } from "../types.ts";
import { type DecisionLog, createDecisionLog } from "./log.ts";
import { observeLive } from "./observe.ts";
import { submitIntent } from "./intent.ts";
import { getWorld } from "../live.ts";
import {
  createReflexScheduler,
  type AttemptRequest,
  type ReflexBackend,
  type ReflexScheduler,
  type SchedulerConfig,
  type SchedulerHooks,
  type Thinker,
} from "./scheduler.ts";
import { createStubBackend } from "./stub.ts";
import type { ReflexEvent } from "./events.ts";
import type {
  AgentIntent,
  DecisionLogRow,
  Observation,
  ReflexChoice,
  ReflexResult,
  VerbCandidate,
} from "./types.ts";

/** CtxVerbs with an exact Intent-pipeline equivalent. Everything else is a
 *  UI flow (opens a gump, renames, immediate one-shot) and never offered. */
export const INTENT_FOR_VERB: Readonly<Partial<Record<CtxVerb, IntentKind>>> = {
  walk: "walk",
  chop: "chop",
  mine: "mine",
  fish: "fish",
  hunt: "hunt",
  skin: "skin",
  tame: "tame",
  cast: "cast",
  fireball: "cast",
  teleport: "cast",
  loot: "loot",
  harvest: "harvest",
  till: "till",
  dig: "dig",
  fill: "fill",
  pick: "pick",
  sowCabbage: "plant",
  sowWheat: "plant",
  sowGarlic: "plant",
  sowAcorn: "forest",
};

const CROP_FOR_VERB: Readonly<Partial<Record<CtxVerb, string>>> = {
  sowCabbage: "cabbage",
  sowWheat: "wheat",
  sowGarlic: "garlic",
};

const SPELL_FOR_VERB: Readonly<Partial<Record<CtxVerb, SpellId>>> = {
  cast: "magicarrow",
  fireball: "fireball",
  teleport: "teleport",
};

/**
 * Map a menu candidate to the sim's Intent wire. Returns null when the
 * candidate has no intent equivalent (never offered to the backend) or when
 * a required parameter is unavailable (e.g. sowAcorn without a plantable
 * species for the body's forestry skill).
 */
export function intentForCandidate(c: VerbCandidate, obs: Observation): AgentIntent | null {
  const kind = INTENT_FOR_VERB[c.verb];
  if (!kind) return null;
  const base = { tx: c.target.tx, ty: c.target.ty };
  switch (c.verb) {
    case "walk":
    case "chop":
    case "mine":
    case "fish":
    case "till":
    case "dig":
    case "fill":
      return { kind, ...base, targetId: null, spell: null };
    case "hunt":
    case "skin":
    case "tame":
    case "loot":
    case "harvest":
    case "pick":
      return { kind, ...base, targetId: c.target.id, spell: null };
    case "cast":
    case "fireball":
      return { kind, ...base, targetId: c.target.id, spell: SPELL_FOR_VERB[c.verb] ?? null };
    case "teleport":
      return { kind, ...base, targetId: null, spell: SPELL_FOR_VERB.teleport ?? null };
    case "sowCabbage":
    case "sowWheat":
    case "sowGarlic": {
      const crop = CROP_FOR_VERB[c.verb];
      if (!crop) return null;
      return { kind, ...base, targetId: crop, spell: null };
    }
    case "sowAcorn": {
      const species = bestPlantableTimber(obs.you.skills.forestry ?? 0);
      if (!species) return null;
      return { kind, ...base, targetId: species, spell: null };
    }
    default:
      return null;
  }
}

/** One display string per option; coordinates disambiguate same-label tiles. */
export function optionLabel(c: VerbCandidate): string {
  return `${c.label} [${c.target.tx},${c.target.ty}]`;
}

export interface PreparedDecision {
  observation: Observation;
  candidates: VerbCandidate[];
  options: string[];
  intents: (AgentIntent | null)[];
  question: ReflexChoice;
}

export interface AutopilotHooks extends SchedulerHooks {
  /** One DecisionLogRow per executed decision (contract §7). Default appends
   *  to the autopilot's in-memory log; t_e3f72207 plugs the durable writer. */
  onDecision?(row: DecisionLogRow): void;
}

export interface ReflexAutopilot {
  /** Begin acting. Idempotent while running; throws once stopped — a stopped
   *  autopilot's scheduler is dead by design, so create a fresh autopilot
   *  instead of reviving this one. */
  start(): void;
  /** Stop deciding AND unsubscribe from any push source. After stop, pushed
   *  observations cannot reach the backend (verified by test). */
  stop(): void;
  readonly running: boolean;
  /** Push one observation (host feed / tests). No-op unless running. */
  ingest(obs: Observation): void;
  /** Pull one observation via the injected observe() and ingest it — the
   *  solo-vale driver calls this once per sim tick. */
  step(): void;
  /** Resolves when no attempt is in flight and nothing is queued. */
  settled(): Promise<void>;
  /** In-memory decision log (contract shape; durable writer is t_e3f72207). */
  readonly log: DecisionLog;
  readonly scheduler: ReflexScheduler;
}

/** Optional push source seam for the future host feed: anything with a
 *  subscribe(cb) → unsubscribe shape wires straight in (WebSocket feed,
 *  EventEmitter, test fake). `stop` MUST call the returned unsubscribe. */
export interface ObservationSource {
  subscribe(cb: (obs: Observation) => void): () => void;
}

export function createReflexAutopilot(opts: {
  backend?: ReflexBackend;
  observe?: () => Observation;
  /** Returns the pipeline's refusal reason, or null on acceptance. May be
   *  async: the host feed resolves with the shard's ack (queue admission). */
  submit?: (intent: AgentIntent) => string | null | Promise<string | null>;
  hooks?: AutopilotHooks;
  config?: Partial<SchedulerConfig>;
  source?: ObservationSource;
  now?: () => number;
}): ReflexAutopilot {
  const backend = opts.backend ?? createStubBackend();
  const observe = opts.observe ?? (() => observeLive());
  const submit =
    opts.submit ??
    ((intent: Intent) => {
      const world = getWorld();
      return submitIntent(world, intent);
    });
  const hooks = opts.hooks ?? {};
  const log = createDecisionLog();
  let running = false;
  let stopped = false;
  let unsubscribe: (() => void) | null = null;

  /** Build the exchange inputs. Null when fewer than two options map to the
   *  intent wire — a one-option "choice" is not worth a paid call. */
  const prepare = (ctx: {
    observation: Observation;
    triggers: ReflexEvent[];
  }): PreparedDecision | null => {
    const obs = ctx.observation;
    const candidates: VerbCandidate[] = [];
    const options: string[] = [];
    const intents: (AgentIntent | null)[] = [];
    for (const c of obs.verbs) {
      const intent = intentForCandidate(c, obs);
      if (intent === null) continue;
      candidates.push(c);
      options.push(optionLabel(c));
      intents.push(intent);
      if (options.length >= 255) break; // contract choice() cap
    }
    if (options.length < 2) return null;
    const question: ReflexChoice = {
      type: "choice",
      id: "next_action",
      question: "What now?",
      options,
    };
    return { observation: obs, candidates, options, intents, question };
  };

  const execute = async (req: AttemptRequest, prepared: PreparedDecision): Promise<void> => {
    const result: ReflexResult = await backend.decide({
      state: {
        observation: prepared.observation,
        triggers: req.triggers,
        // Verbs parallel to the option list, so the backend scores exactly
        // what each option does (options alone are display strings).
        candidateVerbs: prepared.candidates.map((c) => c.verb),
      },
      questions: [prepared.question],
    });
    const answer = result.answers.find(
      (a) => a.id === prepared.question.id && a.type === "choice",
    );
    if (!answer || answer.type !== "choice") {
      throw new Error(`backend returned no choice answer for ${prepared.question.id}`);
    }
    if (!Number.isInteger(answer.pick) || answer.pick < 0 || answer.pick >= prepared.options.length) {
      throw new Error(`backend pick ${answer.pick} out of range (${prepared.options.length} options)`);
    }
    const intent = prepared.intents[answer.pick] ?? null;
    if (intent === null) {
      throw new Error(`option ${answer.pick} has no intent mapping`);
    }
    const rejectReason = await submit(intent);
    // A submit reject is sim-pipeline information, not a provider failure —
    // the attempt still counts (the backend was paid) and the row logs the
    // outcome so training data learns which picks the sim refused.
    const row: DecisionLogRow = {
      tick: prepared.observation.tick,
      bodyId: prepared.observation.you.id,
      lane: "reflex",
      question: prepared.question.question,
      candidates: prepared.options,
      answer: prepared.options[answer.pick]!,
      intent,
      stateHash: req.stateHash,
      // Outcome deltas are back-filled from sim movement by the cost/log
      // infrastructure (t_e3f72207); a submit reject is recorded here now.
      outcome: rejectReason === null ? null : { submitRejected: 1 },
    };
    if (hooks.onDecision) hooks.onDecision(row);
    else log.append(row);
    scheduler.noteAction();
  };

  const thinker: Thinker<PreparedDecision> = { prepare, execute };
  const scheduler = createReflexScheduler<PreparedDecision>({
    thinker,
    hooks,
    config: opts.config,
    now: opts.now,
  });

  return {
    get running() {
      return running;
    },
    get log() {
      return log;
    },
    scheduler,
    start(): void {
      if (running) return;
      if (stopped) throw new Error("autopilot stopped; create a fresh one");
      running = true;
      if (opts.source) {
        unsubscribe = opts.source.subscribe((obs) => {
          if (running) scheduler.ingest(obs);
        });
      }
    },
    stop(): void {
      if (!running) return;
      running = false;
      stopped = true;
      if (unsubscribe !== null) {
        unsubscribe();
        unsubscribe = null;
      }
      scheduler.stop();
    },
    ingest(obs: Observation): void {
      if (!running) return;
      scheduler.ingest(obs);
    },
    step(): void {
      if (!running) return;
      scheduler.ingest(observe());
    },
    settled(): Promise<void> {
      return scheduler.settled();
    },
  };
}
