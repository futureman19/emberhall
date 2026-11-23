#!/usr/bin/env node
/**
 * Replay a logged day of reflex decisions offline — reconstructs every
 * recorded decision from the recorded inputs/outputs. Issues NO provider
 * calls (paidCallsIssued is 0 by construction: no backend exists here).
 *
 *   node --experimental-strip-types scripts/agent-cost-replay.ts <attempts.jsonl> [--day YYYY-MM-DD] [--agent ID]
 *
 * Exit 0 when every replayable attempt matches its record, 1 on mismatch.
 */
import { readAttemptLogFile } from "../src/game/agent/attempts-file.ts";
import { replayLog } from "../src/game/agent/replay.ts";

const args = process.argv.slice(2);
const path = args[0];
if (!path) {
  console.error("usage: agent-cost-replay.ts <attempts.jsonl> [--day YYYY-MM-DD] [--agent ID]");
  process.exit(2);
}
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const lines = readAttemptLogFile(path);
const summary = replayLog(lines, { day: opt("--day"), agentId: opt("--agent") });
console.log(
  `replay: ${summary.matched}/${summary.replayed} replayed attempts match ` +
    `(${summary.attempts} total, paid calls issued: ${summary.paidCallsIssued})`,
);
for (const m of summary.mismatches) {
  console.log(`MISMATCH ${m.attemptId} (${m.agentId}/${m.day}):`);
  for (const p of m.problems) console.log(`  - ${p}`);
}
process.exit(summary.mismatches.length === 0 ? 0 : 1);
