import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { Intent } from "../game/types.ts";
import type { createShard } from "./shard.ts";

type Shard = ReturnType<typeof createShard>;
const HELLO_MS = 5000;
const MAX_BUFFER = 2 * 1024 * 1024;
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function intentShape(value: unknown): value is Intent {
  return object(value) && typeof value.kind === "string" &&
    typeof value.tx === "number" && Number.isFinite(value.tx) &&
    typeof value.ty === "number" && Number.isFinite(value.ty) &&
    (value.targetId === null || typeof value.targetId === "string") &&
    (value.spell === null || typeof value.spell === "string");
}

/** Only key bindings cross into the shard; client identity fields are ignored.
 * Ack means queue admission, not completion of a simulated action.
 */
export function createTransport(shard: Shard) {
  const started = performance.now();
  const server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/healthz") {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ ok: true, ...shard.status(), uptimeSec: (performance.now() - started) / 1000 }));
    } else { res.writeHead(404); res.end(); }
  });
  const wss = new WebSocketServer({ server, maxPayload: 64 * 1024, perMessageDeflate: false });
  const sessions = new Map<string, { socket: WebSocket; hash: string }>();
  let closing: Promise<void> | undefined;
  function send(socket: WebSocket, message: unknown) {
    if (socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > MAX_BUFFER) { socket.terminate(); return; }
    socket.send(JSON.stringify(message));
  }
  const unsubscribe = shard.onTick(() => {
    for (const [id, session] of sessions) {
      const hash = shard.obsHash(id);
      if (hash !== session.hash) {
        session.hash = hash;
        send(session.socket, { type: "obs", observation: shard.observationFor(id) });
      }
    }
  });
  wss.on("connection", socket => {
    let id: string | undefined;
    let failed = false;
    function detach() {
      clearTimeout(deadline);
      if (id && sessions.get(id)?.socket === socket) {
        sessions.delete(id);
        shard.disconnect(id);
      }
    }
    function fail(reason: string) {
      if (failed) return;
      failed = true;
      send(socket, { type: "error", reason });
      detach();
      socket.close(1008, reason);
      // A peer must not keep a failed connection alive by ignoring close.
      const reap = setTimeout(() => socket.terminate(), 1000);
      reap.unref(); socket.once("close", () => clearTimeout(reap));
    }
    const deadline = setTimeout(() => fail("hello required"), HELLO_MS);
    deadline.unref();
    socket.on("error", () => { detach(); socket.terminate(); });
    socket.on("close", detach);
    socket.on("message", (data, binary) => {
      if (failed || socket.readyState !== WebSocket.OPEN) return;
      if (binary) return fail("schema-invalid message");
      let message: unknown;
      try { message = JSON.parse(data.toString()); }
      catch { return fail("malformed JSON"); }
      if (!object(message)) return fail("schema-invalid message");
      if (!id) {
        if (message.type !== "hello") return fail("hello required");
        if (typeof message.apiKey !== "string" || (message.client !== undefined && typeof message.client !== "string")) return fail("schema-invalid message");
        const bound = shard.resolveKey(message.apiKey);
        if (!bound) return fail("unknown apiKey");
        clearTimeout(deadline);
        const previous = sessions.get(bound);
        if (previous) {
          sessions.delete(bound);
          shard.disconnect(bound);
          previous.socket.close(4000, "replaced");
        }
        id = bound;
        const observation = shard.observationFor(id);
        sessions.set(id, { socket, hash: shard.obsHash(id) });
        send(socket, { type: "welcome", characterId: id, name: observation.you.name, tick: shard.status().tick, observation });
        return;
      }
      // A superseded socket cannot queue during its close handshake.
      if (sessions.get(id)?.socket !== socket) return;
      if (message.type !== "intent" || typeof message.seq !== "number" || !Number.isFinite(message.seq) || !intentShape(message.intent)) return fail("schema-invalid message");
      const reason = shard.enqueueIntent(id, message.intent);
      send(socket, { type: "ack", seq: message.seq, ok: reason === null, ...(reason ? { reason } : {}) });
    });
  });
  return {
    listen(port: number, host = "0.0.0.0"): Promise<number> {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          const address = server.address();
          if (!address || typeof address === "string") return reject(new Error("Missing listener address"));
          resolve(address.port);
        });
      });
    },
    close(): Promise<void> {
      if (closing) return closing;
      unsubscribe();
      for (const id of sessions.keys()) shard.disconnect(id);
      sessions.clear();
      for (const socket of wss.clients) socket.terminate();
      closing = new Promise(resolve => {
        wss.close(() => { server.close(() => resolve()); server.closeAllConnections(); });
      });
      return closing;
    },
  };
}
