/** Production Phase 3 composition. No key => unavailable, never a stub. */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { jevConfigFromEnv } from "../game/agent/jev.ts";
import { createMeteredReflexBackend } from "../game/agent/metered.ts";
import { createJsonlAttemptLog, readAttemptLogFile } from "../game/agent/attempts-file.ts";
import { foldAttempts } from "../game/agent/attempts.ts";
import { BudgetGuard } from "../game/agent/budget.ts";
import { DEFAULT_PRICE } from "../game/agent/pricing.ts";

export function bundledReflex(dataDir: string, env: NodeJS.ProcessEnv = process.env) {
  const jev = jevConfigFromEnv(env);
  if (!jev) return { factory: null, close() {} };
  const path = join(dataDir, "director-reflex-attempts.jsonl");
  const guard = BudgetGuard.fromAttempts(existsSync(path) ? foldAttempts(readAttemptLogFile(path), DEFAULT_PRICE) : []);
  const log = createJsonlAttemptLog(path);
  return {
    factory: (id: string, signal: AbortSignal) => createMeteredReflexBackend({
      jev: { ...jev, fetchImpl: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal }) },
      guard, log, agentId: id, bodyId: id, price: DEFAULT_PRICE, isActive: () => !signal.aborted,
    }),
    close: () => log.close(),
  };
}
