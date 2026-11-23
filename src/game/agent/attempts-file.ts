/**
 * Durable JSONL file sink for the attempt log. NODE-ONLY (node:fs) — the
 * browser client must never import this module; the host (src/server) and
 * offline tooling do.
 *
 * Durability contract: every line is written with writeSync + fsyncSync
 * before the call returns. A begin line on disk means the attempt is
 * visible even if the process dies before the end line — that is what
 * keeps interrupted attempts from vanishing.
 */
import { closeSync, fsyncSync, openSync, readFileSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { createAttemptLog, parseAttemptLines, type AttemptLine, type AttemptLog } from "./attempts.ts";

export interface JsonlAttemptLog extends AttemptLog {
  path: string;
  close(): void;
}

export function createJsonlAttemptLog(path: string): JsonlAttemptLog {
  mkdirSync(dirname(path), { recursive: true });
  const fd = openSync(path, "a");
  const sink = (line: AttemptLine) => {
    writeSync(fd, `${JSON.stringify(line)}\n`);
    fsyncSync(fd);
  };
  const memory = createAttemptLog(sink);
  return {
    path,
    begin: memory.begin,
    end: memory.end,
    lines: memory.lines,
    toJSONL: memory.toJSONL,
    close: () => closeSync(fd),
  };
}

export function readAttemptLogFile(path: string): AttemptLine[] {
  return parseAttemptLines(readFileSync(path, "utf8"));
}
