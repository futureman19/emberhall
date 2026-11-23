/**
 * Host feed tests — the autopilot wired against the REAL host shell
 * (src/server shard + ws transport), not a mock of it. Boots a shard in
 * process, connects connectHostFeed over a loopback WebSocket, and proves:
 * welcome replay boots the reflex loop, host obs pushes drive it afterwards,
 * intents queue through the shard's own admission path, and stop() detaches
 * the subscription so a live host cannot reach the backend anymore.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createShard, shardConfig } from "../../server/shard.ts";
import { createTransport } from "../../server/ws.ts";
import { connectHostFeed, type HostFeed } from "./hostfeed.ts";
import { createReflexAutopilot } from "./autopilot.ts";
import { createStubBackend } from "./stub.ts";
import { DEFAULT_CADENCE, type Observation } from "./types.ts";

type Shard = ReturnType<typeof createShard>;
type Transport = ReturnType<typeof createTransport>;

async function fixture(t: test.TestContext): Promise<{ shard: Shard; transport: Transport; port: number }> {
  const dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "hostfeed-"));
  const shard = createShard(shardConfig({ EMBERHALL_DATA_DIR: dir }), { log: () => {} });
  const transport = createTransport(shard);
  const port = await transport.listen(0, "127.0.0.1");
  t.after(async () => {
    await transport.close();
    shard.stop();
    rmSync(dir, { recursive: true, force: true });
  });
  return { shard, transport, port };
}

async function waitFor(cond: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (cond()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`timed out waiting for ${label}`);
}

test("the feed replays welcome to subscribers and forwards host obs pushes", async (t) => {
  const { shard, port } = await fixture(t);
  const feed: HostFeed = await connectHostFeed({ url: `ws://127.0.0.1:${port}`, apiKey: "dev-kett" });
  t.after(() => feed.close());

  assert.ok(feed.characterId.length > 0);
  assert.equal(feed.latest.tick, 0);
  assert.ok(feed.latest.verbs.length > 0, "the host observation carries the legal verb menu");

  const seen: Observation[] = [];
  const unsubscribe = feed.source.subscribe((obs) => seen.push(obs));
  await waitFor(() => seen.length === 1, "welcome replay");
  assert.equal(seen[0]!.tick, 0, "a late subscriber boots from the latest observation");

  shard.step(0.1);
  shard.step(0.1);
  await waitFor(() => feed.latest.tick >= 2, "obs pushes after ticks");
  assert.ok(seen.length >= 3, "every pushed frame reaches subscribers");
  assert.ok(feed.latest.verbs.length > 0);

  unsubscribe();
  const count = seen.length;
  shard.step(0.1);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(seen.length, count, "unsubscribed callbacks receive nothing");
  await feed.close();
});

test("submit resolves null on admission and the refusal reason on rejection", async (t) => {
  const { port } = await fixture(t);
  const feed = await connectHostFeed({ url: `ws://127.0.0.1:${port}`, apiKey: "dev-kett" });
  t.after(() => feed.close());

  const admitted = await feed.submit({ kind: "walk", tx: 256, ty: 295, targetId: null, spell: null });
  assert.equal(admitted, null, "queue admission is not a refusal");

  const refused = await feed.submit({ kind: "walk", tx: -1, ty: 0, targetId: null, spell: null });
  assert.ok(typeof refused === "string" && refused.length > 0, "the shard's refusal reaches the caller");
  await feed.close();
});

test("autopilot over the host feed boots on reflexes and stop() silences it", async (t) => {
  const { shard, port } = await fixture(t);
  const feed = await connectHostFeed({ url: `ws://127.0.0.1:${port}`, apiKey: "dev-kett" });
  t.after(() => feed.close());
  const backend = createStubBackend();
  const auto = createReflexAutopilot({
      config: { cadence: { ...DEFAULT_CADENCE, reflexCooldownTicks: 2 } },
      backend,
      source: feed.source,
    submit: (intent) => feed.submit(intent),
  });
  auto.start();
  await waitFor(() => backend.calls.length >= 1, "boot decision over the host feed");
  await auto.settled();

  assert.equal(auto.log.rows.length, 1, "one decision row for the boot decision");
  const row = auto.log.rows[0]!;
  assert.equal(row.bodyId, feed.characterId);
  assert.equal(row.lane, "reflex");
  assert.ok(row.candidates.length >= 2, "the host's verb menu fed the choice question");
  assert.ok(row.intent !== null, "the decision became an intent on the shard's wire");

  const callsAtStop = backend.calls.length;
  auto.stop();
  for (let i = 0; i < 5; i++) shard.step(0.1);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(backend.calls.length, callsAtStop, "a live host cannot reach the backend after stop");
  await feed.close();
});
