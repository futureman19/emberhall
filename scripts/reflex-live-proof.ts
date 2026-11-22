/** Opt-in one-body proof recorder. No provider call without explicit spending approval. */
import { existsSync, mkdirSync, openSync, closeSync, writeSync, fsyncSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import { connectHostFeed } from "../src/game/agent/hostfeed.ts";
import { jevConfigFromEnv } from "../src/game/agent/jev.ts";
import { createHostReflex } from "../src/game/agent/reflex-runtime.ts";
import { createJsonlAttemptLog, readAttemptLogFile } from "../src/game/agent/attempts-file.ts";
import { foldAttempts } from "../src/game/agent/attempts.ts";
import { BudgetGuard } from "../src/game/agent/budget.ts";
import { DEFAULT_PRICE } from "../src/game/agent/pricing.ts";
import { buildSpendReport } from "../src/game/agent/report.ts";
import { replayLog } from "../src/game/agent/replay.ts";

if (process.env.EMBERHALL_REFLEX_PAID_APPROVED !== "1") throw new Error("BLOCKED: explicit paid-run authorization required; no calls made");
const jev = jevConfigFromEnv(process.env);
if (!jev) throw new Error("BLOCKED: TYPESAFE_API_KEY missing; no calls made");
const url = process.env.EMBERHALL_REFLEX_WS;
const apiKey = process.env.EMBERHALL_REFLEX_CHARACTER_KEY;
const agentId = process.env.EMBERHALL_REFLEX_AGENT_ID;
if (!url || !apiKey || !agentId) throw new Error("BLOCKED: dedicated host WS URL, character key and agent ID required");
if (jev.model && jev.model !== DEFAULT_PRICE.model) throw new Error("BLOCKED: model has no verified price table");
jev.model = DEFAULT_PRICE.model; // pin the priced model, never a moving alias
const dir = resolve(process.argv[2] ?? "evidence/phase3-live");
mkdirSync(dir, { recursive: true });
const lock = join(dir, "runner.lock"), lockFd = openSync(lock, "wx");
const path = join(dir, "attempts.jsonl");
const history = existsSync(path) ? readAttemptLogFile(path) : [];
const guard = BudgetGuard.fromAttempts(foldAttempts(history, DEFAULT_PRICE));
const log = createJsonlAttemptLog(path);
const decisionsFd = openSync(join(dir, "decisions.jsonl"), "a");
let finish!: (reason: string) => void;
const done = new Promise<string>(r => { finish = r; });
const signal = () => finish("operator-stop");
process.once("SIGINT", signal); process.once("SIGTERM", signal);
let feed: Awaited<ReturnType<typeof connectHostFeed>> | undefined;
let auto: ReturnType<typeof createHostReflex>["autopilot"] | undefined;
let unsubscribe: (() => void) | undefined;
// One bounded watchdog, not observation polling or a decision heartbeat.
const timeout = setTimeout(() => finish("watchdog-timeout"), 4 * 60 * 60 * 1000);
const startedAt = Date.now();
let startHour: number | null = null, lastHour: number | null = null, samples = 0, died = false, rejected = 0;
let reason = "setup-failed";
try {
  feed = await connectHostFeed({ url, apiKey });
  startHour = feed.latest.hour;
  lastHour = startHour;
  if (feed.latest.you.ghost || feed.latest.you.hp <= 0) {
    died = true;
    throw new Error("BLOCKED: proof requires an initially living body");
  }
  const runtime = createHostReflex({ feed, jev, log, guard, agentId, price: DEFAULT_PRICE,
    onDecision(row) {
      if (row.outcome?.submitRejected) rejected++;
      writeSync(decisionsFd, JSON.stringify(row) + "\n"); fsyncSync(decisionsFd);
    },
  });
  auto = runtime.autopilot;
  unsubscribe = feed.source.subscribe(obs => {
    samples++; lastHour = obs.hour;
    writeSync(decisionsFd, JSON.stringify({ type: "survival", tick: obs.tick, hour: obs.hour, hp: obs.you.hp, ghost: obs.you.ghost, hunger: obs.you.hunger, energy: obs.you.energy, wallMs: Date.now() }) + "\n"); fsyncSync(decisionsFd);
    if (obs.you.ghost || obs.you.hp <= 0) { died = true; finish("death"); }
    else if (obs.hour - startHour! >= 24) finish("full-vale-day");
  });
  auto.start();
  reason = await done;
} finally {
  clearTimeout(timeout); unsubscribe?.(); auto?.stop(); await auto?.settled(); await feed?.close();
  log.close(); closeSync(decisionsFd);
  const lines = readAttemptLogFile(path), rows = buildSpendReport(lines), replay = replayLog(lines);
  const elapsedMs = Date.now() - startedAt;
  const spendMicros = rows.reduce((sum, row) => sum + row.spendMicros, 0);
  const report = {
    reason, startedAt, elapsedMs, startHour, lastHour, samples, died, rejected,
    agentId, model: jev.model, price: DEFAULT_PRICE, attemptsPath: path,
    survivalGate: reason === "full-vale-day" && !died && samples > 1,
    costGate: "REVIEW_REQUIRED: UTC buckets are measured; one vale day is not a wall day",
    spendRows: rows, spendMicros, wallDayProjectionMicros: elapsedMs > 0 && history.length === 0 ? spendMicros * 86400000 / elapsedMs : null,
    projectionCaveat: "Projection assumes sustained identical cadence, not a measured 24h bill. Disabled when prior history exists; retain the same directory to preserve same-day budget accounting.",
    replayMismatches: replay.mismatches.length,
    liveAcceptance: "UNPASSED until reviewer confirms duration, no interventions, runtime log, usage completeness, pricing, rejections and cost normalization",
  };
  writeFileSync(join(dir, "report.json"), JSON.stringify(report, null, 2) + "\n");
  closeSync(lockFd); unlinkSync(lock);
  process.removeListener("SIGINT", signal); process.removeListener("SIGTERM", signal);
  console.log(JSON.stringify(report, null, 2));
}
