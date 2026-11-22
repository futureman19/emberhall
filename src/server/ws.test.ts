import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createShard, shardConfig } from "./shard.ts";
import { createTransport } from "./ws.ts";
import { runMain } from "./main.ts";
import type { Observation } from "../game/agent/types.ts";
import type { World } from "../game/types.ts";

type Message = { type: string; characterId?: string; name?: string; tick?: number; observation?: Observation; seq?: number; ok?: boolean; reason?: string };
async function fixture(t: test.TestContext) {
  const dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "shard-ws-"));
  const shard = createShard(shardConfig({ EMBERHALL_DATA_DIR: dir }), { log: () => {} });
  const transport = createTransport(shard);
  const port = await transport.listen(0, "127.0.0.1");
  t.after(async () => { await transport.close(); shard.stop(); rmSync(dir, { recursive: true, force: true }); });
  async function connect() {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    const messages: Message[] = [];
    socket.on("message", data => messages.push(JSON.parse(data.toString()) as Message));
    const closed = once(socket, "close");
    await once(socket, "open");
    return { socket, messages, closed,
      send: (message: unknown) => socket.send(JSON.stringify(message)),
      async next(type: string) {
        for (let i = 0; i < 200; i++) {
          const at = messages.findIndex(m => m.type === type);
          if (at >= 0) return messages.splice(at, 1)[0];
          await new Promise(resolve => setTimeout(resolve, 5));
        }
        throw new Error(`Missing ${type}: ${JSON.stringify(messages)}`);
      },
    };
  }
  return { shard, transport, port, connect };
}
test("entrypoint starts HTTP and WS on one port and shutdown releases it", async t => {
  const dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "shard-main-ws-"));
  const app = runMain({ ...shardConfig({ EMBERHALL_DATA_DIR: dir }), port: 0 });
  t.after(async () => { await app.shutdown(); rmSync(dir, { recursive: true, force: true }); });
  const port = await app.ready;
  assert.equal((await fetch(`http://127.0.0.1:${port}/healthz`)).status, 200);
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  await once(socket, "open");
  const welcome = once(socket, "message");
  socket.send(JSON.stringify({ type: "hello", apiKey: "dev-kett" }));
  assert.equal(JSON.parse((await welcome)[0].toString()).type, "welcome");
  const closed = once(socket, "close");
  await app.shutdown(); await closed;
  await assert.rejects(fetch(`http://127.0.0.1:${port}/healthz`));
});

const walk = { kind: "walk", tx: 256, ty: 295, targetId: null, spell: null };

test("two authenticated clients observe each other and socket-bound walking is pushed after ticks", async t => {
  const { shard, connect } = await fixture(t);
  const a = await connect(); const b = await connect();
  a.send({ type: "hello", apiKey: "dev-kett", bodyId: "foreign" });
  b.send({ type: "hello", apiKey: "dev-bran", client: "test" });
  const wa = await a.next("welcome"); const wb = await b.next("welcome");
  assert.equal(wa.name, "kett"); assert.equal(wa.tick, 0);
  assert.ok(wa.observation!.people.some(p => p.id === wb.characterId));
  assert.ok(wb.observation!.people.some(p => p.id === wa.characterId));
  a.send({ type: "intent", seq: 1, bodyId: wb.characterId, characterId: wb.characterId,
    intent: { ...walk, bodyId: wb.characterId, characterId: wb.characterId } });
  assert.deepEqual(await a.next("ack"), { type: "ack", seq: 1, ok: true });
  assert.equal(b.messages.length, 0, "no observation without a tick");
  for (let i = 0; i < 20; i++) shard.step(0.1);
  let observed: Message | undefined;
  for (let i = 0; i < 20; i++) observed = await b.next("obs");
  const other = observed!.observation!.people.find(p => p.id === wa.characterId)!;
  assert.equal(other.x, walk.tx); assert.equal(other.z, walk.ty);
  assert.equal(observed!.observation!.you.z, wb.observation!.you.z, "spoof did not move B");
});

test("health endpoint exposes live tick, character count and uptime on the WS port", async t => {
  const { shard, port } = await fixture(t);
  shard.step(0.1);
  const response = await fetch(`http://127.0.0.1:${port}/healthz`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type")!, /application\/json/);
  const health = await response.json();
  assert.equal(health.ok, true); assert.equal(health.tick, 1); assert.equal(health.characters, 2);
  assert.ok(health.uptimeSec >= 0);
  assert.equal((await fetch(`http://127.0.0.1:${port}/missing`)).status, 404);
});

for (const [name, payload, reason] of [
  ["unknown key", JSON.stringify({ type: "hello", apiKey: "nope" }), "unknown apiKey"],
  ["malformed JSON", "{", "malformed JSON"],
  ["schema invalid hello", JSON.stringify({ type: "hello", apiKey: 1 }), "schema-invalid message"],
  ["wrong first message", JSON.stringify({ type: "intent", seq: 1, intent: walk }), "hello required"],
] as const) test(`${name} sends error and closes without mutation`, async t => {
  const { shard, connect } = await fixture(t); const before = shard.checkpoint();
  const c = await connect(); c.socket.send(payload);
  assert.equal((await c.next("error")).reason, reason);
  await c.closed;
  assert.equal(shard.checkpoint(), before);
});

test("silent connections must hello within five seconds", async t => {
  const { connect } = await fixture(t); const c = await connect();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  // The connection's timer was installed before enabling mocks: use a second
  // connection so the real network still drives the actual handshake.
  const d = await connect();
  t.mock.timers.tick(5000);
  t.mock.timers.reset();
  assert.equal((await d.next("error")).reason, "hello required");
  await d.closed; c.socket.close(); await c.closed;
});

test("schema-invalid intent closes, while a well-shaped rejected intent gets one ack and no mutation", async t => {
  const { shard, connect } = await fixture(t); const c = await connect();
  c.send({ type: "hello", apiKey: "dev-kett" }); await c.next("welcome");
  const before = shard.checkpoint();
  c.send({ type: "intent", seq: 10, intent: { ...walk, tx: -1 } });
  const ack = await c.next("ack"); assert.equal(ack.ok, false); assert.equal(ack.seq, 10); assert.ok(ack.reason);
  assert.equal(shard.checkpoint(), before);
  c.send({ type: "intent", seq: "not-number", intent: walk });
  assert.equal((await c.next("error")).reason, "schema-invalid message"); await c.closed;
});

test("replacement closes old socket without cancelling the new session's queued intent", async t => {
  const { shard, connect } = await fixture(t);
  const old = await connect(); old.send({ type: "hello", apiKey: "dev-kett" }); const welcome = await old.next("welcome");
  old.send({ type: "intent", seq: 1, intent: walk }); await old.next("ack"); shard.step(0.1);
  const next = await connect(); next.send({ type: "hello", apiKey: "dev-kett" }); await next.next("welcome");
  next.send({ type: "intent", seq: 2, intent: walk }); await next.next("ack");
  const [code, reason] = await old.closed; assert.equal(code, 4000); assert.equal(reason.toString(), "replaced");
  shard.step(0.1);
  const w = JSON.parse(shard.checkpoint()) as World;
  assert.equal(w.playerStates![welcome.characterId!].intent.kind, "walk");
  assert.ok(w.people.find(p => p.id === welcome.characterId)!.path.length);
});

test("disconnect removes pending orders, clears intent/path, preserves body and idles", async t => {
  const { shard, connect } = await fixture(t); const c = await connect();
  c.send({ type: "hello", apiKey: "dev-kett" }); const welcome = await c.next("welcome");
  c.send({ type: "intent", seq: 1, intent: walk }); await c.next("ack"); shard.step(0.1);
  c.send({ type: "intent", seq: 2, intent: { ...walk, ty: 296 } }); await c.next("ack");
  c.socket.close(); await c.closed;
  // Server close delivery follows the client's close handshake.
  await new Promise(resolve => setTimeout(resolve, 20));
  const before = JSON.parse(shard.checkpoint()) as World; const id = welcome.characterId!;
  assert.equal(before.playerStates![id].intent.kind, "none");
  assert.deepEqual(before.people.find(p => p.id === id)!.path, []);
  shard.step(0.1);
  const after = JSON.parse(shard.checkpoint()) as World;
  assert.equal(after.people.find(p => p.id === id)!.z, before.people.find(p => p.id === id)!.z);
  assert.equal(after.playerStates![id].intent.kind, "none");
});
