import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

test("live reflex recorder refuses before host/provider access without spending approval", () => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "scripts/reflex-live-proof.ts"], {
    encoding: "utf8", env: { ...process.env, EMBERHALL_REFLEX_PAID_APPROVED: "", TYPESAFE_API_KEY: "" },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /explicit paid-run authorization required; no calls made/);
});

test("proof recorder rejects dead starts and never normalizes historical spend over a new run", () => {
  const source = readFileSync("scripts/reflex-live-proof.ts", "utf8");
  assert.match(source, /feed\.latest\.you\.ghost \|\| feed\.latest\.you\.hp <= 0/);
  assert.ok(source.indexOf("proof requires an initially living body") < source.indexOf("const runtime = createHostReflex"));
  assert.match(source, /elapsedMs > 0 && history\.length === 0 \? spendMicros/);
  assert.doesNotMatch(source, /use a fresh run directory for normalization/);
});

test("production Jev construction has one metered composition path and scheduler has no polling timers", () => {
  const path = "src/game/agent/";
  const callers = readdirSync(path).filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "jev.ts")
    .filter(f => /\bcreateJevBackend\s*\(/.test(readFileSync(path + f, "utf8")));
  assert.deepEqual(callers, ["metered.ts"]);
  assert.match(readFileSync(path + "metered.ts", "utf8"), /createJevBackend\(\{ \.\.\.opts\.jev, maxRetries: 0 \}\)/);
  assert.doesNotMatch(readFileSync(path + "scheduler.ts", "utf8"), /\bset(?:Interval|Timeout)\s*\(/);
  assert.doesNotMatch(readFileSync(path + "reflex-runtime.ts", "utf8"), /createStubBackend|setInterval/);
});
