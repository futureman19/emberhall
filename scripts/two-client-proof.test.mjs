// P2-C gate wrapper: rides the existing scripts test glob in package.json
// ("node --test" over scripts/*.test.mjs — no package.json edit needed).
// Runs the full locked two-client proof against a freshly booted local
// shard and asserts the evidence JSON is all-PASS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runProof } from "./two-client-proof.mjs";

test("P2-C locked two-client proof against a local shard", { timeout: 300_000 }, async () => {
  const evidence = await runProof({ quiet: true });
  const failed = evidence.steps
    .filter((s) => s.status === "FAIL")
    .map((s) => ({
      step: s.name,
      error: s.error ?? null,
      failedAssertions: s.assertions.filter((a) => !a.pass),
    }));
  assert.equal(evidence.summary.fail, 0, `proof steps failed:\n${JSON.stringify(failed, null, 1)}`);
  assert.equal(evidence.summary.skip, 0, "no step may be skipped in local mode");
  assert.equal(evidence.summary.pass, 5, "all five proof steps must run");
  assert.equal(evidence.exactlyOnce.felledCount, 1, "exactly one felling transition across both feeds");
  assert.equal(evidence.exactlyOnce.saveLogTotal, 1, "persisted resources hold exactly one tree's logs");
  assert.equal(evidence.protocol.violations.length, 0, "pinned wire protocol respected");
  assert.equal(Object.hasOwn(evidence.config, "keysSpec"), false, "evidence never stores credentials");
  assert.equal(JSON.stringify(evidence).includes("proof-kett"), false, "key values stay out of evidence");
});
