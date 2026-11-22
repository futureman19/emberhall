/** Explicit paid-path composition. No stub, planner, timer or implicit start. Node host only. */
import { createReflexAutopilot } from "./autopilot.ts";
import { createMeteredReflexBackend } from "./metered.ts";
import type { HostFeed } from "./hostfeed.ts";
import type { JevBackendConfig } from "./jev.ts";
import type { BudgetGuard } from "./budget.ts";
import type { AttemptLog } from "./attempts.ts";
import type { PriceProvenance } from "./pricing.ts";
import type { DecisionLogRow } from "./types.ts";

export function createHostReflex(opts: {
  feed: HostFeed;
  jev: JevBackendConfig;
  guard: BudgetGuard;
  log: AttemptLog;
  price: PriceProvenance;
  agentId: string;
  maxRetries?: number;
  backoffMs?: number;
  onDecision?: (row: DecisionLogRow) => void;
}) {
  const backend = createMeteredReflexBackend({ ...opts, bodyId: opts.feed.characterId });
  const autopilot = createReflexAutopilot({
    backend,
    source: opts.feed.source,
    submit: (intent) => opts.feed.submit(intent),
    verb: (req) => opts.feed.verb(req),
    hooks: { onDecision: opts.onDecision },
  });
  return { backend, autopilot };
}
