/**
 * Stub reflex backend — deterministic, offline, zero-cost.
 *
 * Exists so the scheduler/autopilot work is testable end-to-end WITHOUT the
 * Jev API (implemented in t_0b00ee59 behind the same ReflexBackend shape).
 * The stub is honest about being a stub: it scores options by deterministic
 * keyword heuristics over the candidate labels, context-aware only through
 * the trigger list (danger prefers movement/combat verbs, hunger prefers
 * food verbs). It never sleeps, never calls the network, and never uses
 * Math.random (replay must stay byte-stable — drift guard).
 *
 * It is NOT a survival policy. Proving "one agent survives a full vale day"
 * against the real backend is the integration gate (t_166eb9f5); this stub
 * only proves the wiring is event-driven, bounded, and replayable.
 */
import { answerChoice, answerNoul, answerScore } from "./reflex.ts";
import type { ReflexBackend } from "./scheduler.ts";
import type { ReflexEvent } from "./events.ts";
import type { ReflexAnswer, ReflexExchange, ReflexResult } from "./types.ts";

/** Verb preference when survival triggers are present: move or fight. */
const DANGER_VERB_SCORE: Record<string, number> = {
  walk: 100,
  cast: 90,
  fireball: 90,
  teleport: 95,
  hunt: 60,
  loot: 10,
};

/** Verb preference for hunger triggers: acquire food. */
const HUNGER_VERB_SCORE: Record<string, number> = {
  fish: 100,
  harvest: 90,
  pick: 80,
  hunt: 70,
  loot: 60,
};

/** Baseline verb preference for a quiet vale: work the menu. */
const DEFAULT_VERB_SCORE: Record<string, number> = {
  chop: 100,
  mine: 95,
  harvest: 90,
  pick: 85,
  till: 80,
  sowCabbage: 78,
  sowWheat: 78,
  sowGarlic: 78,
  sowAcorn: 76,
  dig: 70,
  fish: 65,
  hunt: 60,
  fill: 40,
  skin: 50,
  tame: 45,
  loot: 55,
  cast: 30,
  fireball: 30,
  teleport: 20,
  walk: 10,
};

interface StubState {
  observation?: {
    verbs?: { verb: string; label: string; target: { tx: number; ty: number } }[];
  };
  /** Parallel to the exchange's choice options (autopilot integration). */
  candidateVerbs?: string[];
  triggers?: ReflexEvent[];
}

function scoreTableFor(triggers: ReflexEvent[]): Record<string, number> {
  if (triggers.some((t) => t.kind.startsWith("vitals.hunger"))) return HUNGER_VERB_SCORE;
  if (triggers.some((t) => t.survival)) return DANGER_VERB_SCORE;
  return DEFAULT_VERB_SCORE;
}

/**
 * Create a deterministic stub backend. `opts.onCall` observes every exchange
 * (test probe). The backend answers every question it is given; choice
 * answers pick the highest-scored option (ties resolve to the FIRST option,
 * via the contract's topPick).
 */
export function createStubBackend(opts: {
  onCall?: (exchange: ReflexExchange) => void;
  /** Force a verb-visibility quirk for tests: extra score by verb name. */
  prefer?: Record<string, number>;
} = {}): ReflexBackend & { calls: ReflexExchange[] } {
  const calls: ReflexExchange[] = [];
  return {
    calls,
    async decide(exchange: ReflexExchange): Promise<ReflexResult> {
      calls.push(exchange);
      opts.onCall?.(exchange);
      const state = (exchange.state ?? {}) as StubState;
      const triggers = state.triggers ?? [];
      // candidateVerbs is parallel to the option list; the raw observation
      // menu is not (unmappable UI-flow verbs are filtered out upstream).
      const verbs = state.candidateVerbs ?? state.observation?.verbs?.map((v) => v.verb) ?? [];
      const table = { ...scoreTableFor(triggers), ...(opts.prefer ?? {}) };

      const answers: ReflexAnswer[] = exchange.questions.map((q) => {
        if (q.type === "choice") {
          // Options are "<label> [tx,ty]" (see autopilot.optionLabel). Score
          // by the option's verb when known; fall back to label keywords so
          // hand-built exchanges still behave.
          const scores = q.options.map((label, i) => {
            const verb = verbs[i];
            if (verb && verb in table) return table[verb]!;
            if (verb === "eat") return triggers.some((t) => t.kind.startsWith("vitals.hunger")) ? 90 : 35;
            for (const [key, score] of Object.entries(table)) {
              if (label.toLowerCase().includes(key.toLowerCase())) return score;
            }
            return 1;
          });
          return answerChoice(q, scores);
        }
        if (q.type === "score") {
          return answerScore(q, Array.from({ length: q.levels }, (_, i) => i + 1));
        }
        return answerNoul(q, 0.5);
      });
      return { answers };
    },
  };
}
