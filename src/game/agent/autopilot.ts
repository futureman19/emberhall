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
import { ITEM_META } from "../catalog.ts";
import { bestFoodInPack, commandDrinkWater, commandEat } from "../player.ts";
import { DRINK_OFFER_THIRST, THIRST_LOW } from "../survival.ts";
import type { CtxVerb, Intent, IntentKind, ItemId, SpellId } from "../types.ts";
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

/** Log lines kept on the wire (Phase 3.5 cost contract). The full tail
 *  stays in the authoritative observation for hashing and the body. */
const WIRE_LOG_TAIL_LINES = 10;

/**
 * Phase 3.5 cost contract (t_d8b9704d): compact the observation for the
 * PROVIDER WIRE only. The model scores `options` + `candidateVerbs`; the
 * UI-flow verb menu was 76% of the measured r1 wire bytes and is never a
 * decision input (verbs outside the candidate set are dropped by prepare
 * anyway). Zero-count pack entries and long log tails are dropped the same
 * way. The FULL observation remains authoritative for action mapping, the
 * decision row and hashObservation (replay) — this function must never
 * mutate its input.
 */
export function compactObservationForWire(obs: Observation): Observation {
  const pack: Observation["you"]["pack"] = {};
  for (const [id, count] of Object.entries(obs.you.pack)) {
    if (typeof count === "number" && count > 0) pack[id as ItemId] = count;
  }
  return {
    ...obs,
    verbs: [],
    logTail: obs.logTail.slice(-WIRE_LOG_TAIL_LINES),
    you: { ...obs.you, pack },
  };
}

export interface PreparedDecision {
  observation: Observation;
  candidates: VerbCandidate[];
  options: string[];
  /** What submitting option i does: an Intent-pipeline action or a menu verb
   *  (the shard's verb wire — `eat` rides it, see hostfeed.verb). Parallel
   *  to options; a pick outside this array is a backend bug. */
  actions: PreparedAction[];
  /** Parallel to options: CtxVerb per intent option, "eat" for the
   *  synthetic pack-food option. Sent as exchange state so the backend can
   *  score what each option actually does. */
  optionVerbs: string[];
  question: ReflexChoice;
}

export type PreparedAction =
  | { type: "intent"; intent: AgentIntent }
  | { type: "verb"; verb: string; item: string | null; tx?: number; ty?: number };

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
  /** Menu-verb channel (eat/… — the shard's {type:"verb"} wire on a host,
   *  commandEat locally in the solo driver). Returns null on acceptance. */
  verb?: (req: { verb: string; item: string | null; tx?: number | null; ty?: number | null }) => string | null | Promise<string | null>;
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
  const verb =
    opts.verb ??
    ((req: { verb: string; item: string | null; tx?: number | null; ty?: number | null }) => {
      if (req.verb === "drink") {
        if (req.tx == null || req.ty == null) return "No water selected";
        const before = observeLive().you.thirst;
        const message = commandDrinkWater(getWorld(), req.tx, req.ty);
        return observeLive().you.thirst > before ? null : message;
      }
      if (req.verb !== "eat") return `Unknown verb ${req.verb}`;
      const item = req.item as ItemId | null;
      if (!item) return "No food selected";
      const before = observeLive().you.pack[item] ?? 0;
      const message = commandEat(getWorld(), item);
      return (observeLive().you.pack[item] ?? 0) < before ? null : message;
    });
  const hooks = opts.hooks ?? {};
  const log = createDecisionLog();
  let running = false;
  let stopped = false;
  let unsubscribe: (() => void) | null = null;

  /** A metering backend (t_166eb9f5) exposes budgetExhausted(); when the
   *  guard has closed the agent's cost day there is nothing to prepare —
   *  the body rides its last intent, no attempt record, no reservation. */
  const budgetClosed = (): boolean =>
    backend.budgetExhausted?.() ?? false;

  /** Build the exchange inputs. Null when fewer than two options map to an
   *  executable action — a one-option "choice" is not worth a paid call. */
  const prepare = (ctx: {
    observation: Observation;
    triggers: ReflexEvent[];
  }): PreparedDecision | null => {
    if (budgetClosed()) return null;
    const obs = ctx.observation;
    const candidates: VerbCandidate[] = [];
    const options: string[] = [];
    const actions: PreparedAction[] = [];
    /** Parallel to options/actions: the CtxVerb for intent options, the
     *  pseudo-verb "eat" for the synthetic pack-food option. */
    const optionVerbs: string[] = [];
    for (const c of obs.verbs) {
      const intent = intentForCandidate(c, obs);
      if (intent === null) continue;
      candidates.push(c);
      const label = optionLabel(c);
      options.push(options.includes(label) ? `${label} (#${options.length + 1})` : label);
      actions.push({ type: "intent", intent });
      optionVerbs.push(c.verb);
      if (options.length >= 253) break; // reserve food + rest slots
    }
    // Pack food is not a context-menu verb, so the sim's menu never offers
    // it — but a reflex layer that cannot answer hunger cannot survive. The
    // shard's verb wire (src/server/shard.ts VERB_KINDS) executes "eat"
    // server-side; offer it whenever the pack carries a meal.
    const food = bestFoodInPack(obs.you.pack);
    if (food !== null && options.length < 255) {
      const label = ITEM_META[food]?.label ?? food;
      options.push(`Eat ${label} from pack`);
      actions.push({ type: "verb", verb: "eat", item: food });
      optionVerbs.push("eat");
    }
    // Water survival: the context menu only offers Drink when a water tile is
    // tapped, so a reflex body far from water would never see it. Mirror the
    // pack-food precedent with synthetic options from Observation.water.
    if (obs.water && options.length < 254) {
      const w = obs.water;
      if (obs.you.inWater && w.escape) {
        options.push(`Scramble to shore (${w.escape.tx}, ${w.escape.ty})`);
        actions.push({ type: "intent", intent: { kind: "walk", tx: w.escape.tx, ty: w.escape.ty, targetId: null, spell: null } });
        optionVerbs.push("walk");
      } else if (w.nearest && w.shore && obs.you.thirst <= DRINK_OFFER_THIRST) {
        options.push(`Drink from the water (${w.nearest.tx}, ${w.nearest.ty})`);
        actions.push({ type: "verb", verb: "drink", item: null, tx: w.nearest.tx, ty: w.nearest.ty });
        optionVerbs.push("drink");
        if (Math.round(obs.you.x) !== w.shore.tx || Math.round(obs.you.z) !== w.shore.ty) {
          options.push(`Walk to the water’s edge (${w.shore.tx}, ${w.shore.ty})`);
          actions.push({ type: "intent", intent: { kind: "walk", tx: w.shore.tx, ty: w.shore.ty, targetId: null, spell: null } });
          optionVerbs.push("walk");
        }
      }
    }
    if (options.length < 255) {
      options.push("Rest / remain idle");
      actions.push({ type: "intent", intent: { kind: "none", tx: 0, ty: 0, targetId: null, spell: null } });
      optionVerbs.push("idle");
    }
    if (options.length < 2) return null;
    const question: ReflexChoice = {
      type: "choice",
      id: "next_action",
      question: "What now?",
      options,
    };
    return { observation: obs, candidates, options, actions, optionVerbs, question };
  };

  const execute = async (req: AttemptRequest, prepared: PreparedDecision): Promise<void> => {
    const result: ReflexResult = await backend.decide(
      {
        state: {
          // Wire compaction (Phase 3.5 cost contract): the provider never
          // needs the UI verb menu, zero-count pack entries or long log
          // tails. The FULL observation stays authoritative for action
          // mapping; req.stateHash already hashes it, so replay is intact.
          observation: compactObservationForWire(prepared.observation),
          triggers: req.triggers,
          // Verbs parallel to the OPTION list (CtxVerb for intent options,
          // "eat" for the synthetic pack option), so the backend scores
          // exactly what each option does — options alone are display strings.
          candidateVerbs: prepared.optionVerbs,
        },
        questions: [prepared.question],
      },
      req,
    );
    if (!running) return; // stop fences late provider results from action submission
    const answer = result.answers.find(
      (a) => a.id === prepared.question.id && a.type === "choice",
    );
    if (!answer || answer.type !== "choice") {
      throw new Error(`backend returned no choice answer for ${prepared.question.id}`);
    }
    if (!Number.isInteger(answer.pick) || answer.pick < 0 || answer.pick >= prepared.options.length) {
      throw new Error(`backend pick ${answer.pick} out of range (${prepared.options.length} options)`);
    }
    const action = prepared.actions[answer.pick] ?? null;
    if (action === null) {
      throw new Error(`option ${answer.pick} has no action mapping`);
    }
    // A submit/verb reject is sim-pipeline information, not a provider
    // failure — the attempt still counts (the backend was paid) and the row
    // logs the outcome so training data learns which picks the sim refused.
    let intent: AgentIntent | null = null;
    let verbName: string | null = null;
    let rejectReason: string | null = null;
    if (action.type === "intent") {
      intent = action.intent;
      rejectReason = await submit(action.intent);
    } else {
      verbName = action.verb;
      rejectReason = await verb({ verb: action.verb, item: action.item, tx: action.tx ?? null, ty: action.ty ?? null });
    }
    const row: DecisionLogRow = {
      tick: prepared.observation.tick,
      bodyId: prepared.observation.you.id,
      lane: "reflex",
      question: prepared.question.question,
      candidates: prepared.options,
      answer: prepared.options[answer.pick]!,
      intent,
      verb: verbName,
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
