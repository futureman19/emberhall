import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createShard, shardConfig } from "./shard.ts";

test("fixed interval starts once, measures elapsed time, and stops once", t => {
  const dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "shard-clock-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  t.mock.timers.enable({ apis: ["setInterval"] });
  let now = 0;
  const shard = createShard(shardConfig({ EMBERHALL_DATA_DIR: dir }), { now: () => now, log: () => {} });
  shard.start(); shard.start();
  now = 10000;
  t.mock.timers.tick(100);
  assert.equal(JSON.parse(shard.checkpoint()).tickCount, 1);
  shard.stop(); shard.stop();
  t.mock.timers.tick(1000);
  assert.equal(JSON.parse(shard.checkpoint()).tickCount, 1);
  assert.throws(() => shard.start(), /stopped/);
  assert.throws(() => shard.step(0.1), /stopped/);
});

for (const signal of ["SIGTERM", "SIGINT"]) test(`entrypoint ${signal} handler saves and releases loop`, t => {
  const dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "shard-signal-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  // Portable Windows/Linux signal-handler test: emit the Node signal event in
  // a real child process (Windows kill() would terminate without a JS handler).
  const script = `import { runMain } from './src/server/main.ts'; const shard = runMain(); shard.step(0.1); process.emit('${signal}');`;
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script], {
    encoding: "utf8", timeout: 30000, env: { ...process.env, EMBERHALL_DATA_DIR: dir },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /shard save tick=1/);
  assert.equal(JSON.parse(readFileSync(join(dir, "shard-save.json"), "utf8")).tickCount, 1);
});
