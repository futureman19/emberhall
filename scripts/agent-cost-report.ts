#!/usr/bin/env node
/**
 * Per-agent daily spend report from a durable attempt log.
 *
 *   node --experimental-strip-types scripts/agent-cost-report.ts <attempts.jsonl> [--day YYYY-MM-DD] [--agent ID] [--cap MICROS]
 *
 * Exit 0 when every reported agent/day is within the cap, 1 otherwise —
 * wire it into the Phase 3 gate.
 */
import {
  readAttemptLogFile,
} from "../src/game/agent/attempts-file.ts";
import { buildSpendReport, formatSpendReport } from "../src/game/agent/report.ts";

const args = process.argv.slice(2);
const path = args[0];
if (!path) {
  console.error("usage: agent-cost-report.ts <attempts.jsonl> [--day YYYY-MM-DD] [--agent ID] [--cap MICROS]");
  process.exit(2);
}
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const day = opt("--day");
const agent = opt("--agent");
const cap = opt("--cap");

const lines = readAttemptLogFile(path);
const rows = buildSpendReport(lines, {
  day,
  agentId: agent,
  capMicros: cap ? Number.parseInt(cap, 10) : undefined,
});
console.log(formatSpendReport(rows));
process.exit(rows.every((r) => r.withinCap) ? 0 : 1);
