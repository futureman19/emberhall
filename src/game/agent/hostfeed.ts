/**
 * Host feed — the Phase 2 host shell (src/server) as an autopilot source.
 *
 * Wire (authoritative: src/server/ws.ts): the client opens a WebSocket and
 * says {type:"hello", apiKey}; the host binds the key to a character and
 * replies {type:"welcome", characterId, name, tick, observation}, then pushes
 * {type:"obs", observation} after any tick in which the body's observation
 * hash changed. Intents go out as {type:"intent", seq, intent} and are
 * answered by {type:"ack", seq, ok, reason?} — an ack means QUEUE ADMISSION
 * (schema + legality + queue room), never execution; the shard drains the
 * queue in its serialized step. A hostile frame ({type:"error", reason})
 * means the host is closing the connection.
 *
 * This is the event source the contract's cadence rules (§5) mean: frames
 * arrive only when the host observes a state change, and the reflex
 * scheduler (scheduler.ts) turns that push stream into sparse paid calls.
 * This module holds no timers except bounded hello/ack deadlines and never
 * polls the host.
 *
 * Lifecycle: connectHostFeed resolves after the welcome frame. close() ends
 * the socket and detaches subscribers; there is deliberately no reconnect
 * here — reconnect policy belongs to the runner that owns the feed, and the
 * scheduler's failure backoff bounds the burn meanwhile.
 */
import { WebSocket } from "ws";
import type { AgentIntent, Observation } from "./types.ts";
import type { ObservationSource } from "./autopilot.ts";

const HELLO_TIMEOUT_MS = 8000;
const ACK_TIMEOUT_MS = 6000;

export interface HostFeed {
  /** The character id the host bound to this connection's key. */
  readonly characterId: string;
  /** Latest pushed observation (welcome or obs). Null only before welcome —
   *  connectHostFeed resolves after welcome, so this is always set. */
  readonly latest: Observation;
  /** Autopilot seam. subscribe replays the latest observation first (the
   *  body's current state), then forwards every pushed obs frame. The
   *  returned unsubscribe detaches the callback; frames after it are dropped. */
  readonly source: ObservationSource;
  /** Queue one intent on the shard. Resolves null on admission, or the
   *  refusal reason ("Unknown verb", "Intent queue is full", "ack-timeout",
   *  a host error frame, …). Never throws for host-side refusals. */
  submit(intent: AgentIntent): Promise<string | null>;
  /** Queue a menu verb on the shard ({type:"verb"} — eat/track/equip/…;
   *  src/server/shard.ts VERB_KINDS). Same ack semantics as submit. */
  verb(req: { verb: string; item?: string | null; n?: number | null; recipeId?: string | null; tx?: number | null; ty?: number | null }): Promise<string | null>;
  /** Close the socket and detach every subscriber. Idempotent. */
  close(): Promise<void>;
  readonly closed: boolean;
}

type ServerFrame =
  | { type: "welcome"; characterId: string; name: string; tick: number; observation: Observation }
  | { type: "obs"; observation: Observation }
  | { type: "ack"; seq: number; ok: boolean; reason?: string }
  | { type: "error"; reason: string };

export function connectHostFeed(opts: {
  url: string;
  apiKey: string;
  client?: string;
  helloTimeoutMs?: number;
  ackTimeoutMs?: number;
}): Promise<HostFeed> {
  const ackTimeoutMs = opts.ackTimeoutMs ?? ACK_TIMEOUT_MS;

  return new Promise<HostFeed>((resolvePromise, rejectPromise) => {
    const socket = new WebSocket(opts.url);
    const subscribers = new Set<(obs: Observation) => void>();
    const pending = new Map<number, (reason: string | null) => void>();
    let seq = 0;
    let latest: Observation | null = null;
    let characterId = "";
    let closed = false;
    let welcomed = false;

    const helloTimer = setTimeout(() => {
      socket.terminate();
      rejectPromise(new Error("host feed: welcome timeout"));
    }, opts.helloTimeoutMs ?? HELLO_TIMEOUT_MS);

    const failPending = (reason: string) => {
      const waiters = [...pending.values()];
      pending.clear();
      for (const w of waiters) w(reason);
    };

    socket.on("open", () => {
      socket.send(JSON.stringify({ type: "hello", apiKey: opts.apiKey, client: opts.client ?? "reflex-autopilot" }));
    });

    socket.on("message", (data: Buffer) => {
      let frame: ServerFrame;
      try {
        frame = JSON.parse(data.toString()) as ServerFrame;
      } catch {
        return; // host closes on malformed frames itself; ignore noise
      }
      if (frame.type === "welcome") {
        clearTimeout(helloTimer);
        welcomed = true;
        characterId = frame.characterId;
        latest = frame.observation;
        resolvePromise(feed);
        return;
      }
      if (frame.type === "obs") {
        latest = frame.observation;
        for (const cb of [...subscribers]) cb(frame.observation);
        return;
      }
      if (frame.type === "ack") {
        const waiter = pending.get(frame.seq);
        if (waiter) {
          pending.delete(frame.seq);
          waiter(frame.ok ? null : (frame.reason ?? "refused"));
        }
        return;
      }
      if (frame.type === "error") {
        failPending(`host error: ${frame.reason}`);
        if (!welcomed) {
          clearTimeout(helloTimer);
          rejectPromise(new Error(`host feed: ${frame.reason}`));
        }
      }
    });

    socket.on("close", () => {
      closed = true;
      clearTimeout(helloTimer);
      failPending("host feed closed");
      if (!welcomed) rejectPromise(new Error("host feed closed before welcome"));
    });
    socket.on("error", (err: Error) => {
      if (!welcomed) {
        clearTimeout(helloTimer);
        rejectPromise(err);
      }
    });

    const send = (frame: object): Promise<string | null> => {
      if (closed || socket.readyState !== WebSocket.OPEN) return Promise.resolve("host feed closed");
      const id = ++seq;
      return new Promise((resolve) => {
        const timer = setTimeout(() => { pending.delete(id); resolve("ack-timeout"); }, ackTimeoutMs);
        pending.set(id, (reason) => { clearTimeout(timer); resolve(reason); });
        socket.send(JSON.stringify({ ...frame, seq: id }));
      });
    };

    const feed: HostFeed = {
      get characterId() {
        return characterId;
      },
      get latest() {
        if (latest === null) throw new Error("host feed: no observation before welcome");
        return latest;
      },
      get closed() {
        return closed;
      },
      source: {
        subscribe(cb) {
          subscribers.add(cb);
          // Replay current state so a subscriber that starts after welcome
          // still boots from the body's latest observation.
          if (latest !== null) {
            const obs = latest;
            queueMicrotask(() => {
              if (subscribers.has(cb)) cb(obs);
            });
          }
          return () => {
            subscribers.delete(cb);
          };
        },
      },
      verb: (req) => send({ type: "verb", verb: req }),
      submit(intent) {
        if (closed || socket.readyState !== WebSocket.OPEN) {
          return Promise.resolve("host feed closed");
        }
        const id = ++seq;
        return new Promise<string | null>((resolvePromise2) => {
          const timer = setTimeout(() => {
            pending.delete(id);
            resolvePromise2("ack-timeout");
          }, ackTimeoutMs);
          pending.set(id, (reason) => {
            clearTimeout(timer);
            resolvePromise2(reason);
          });
          socket.send(JSON.stringify({ type: "intent", seq: id, intent }));
        });
      },
      close() {
        if (closed) return Promise.resolve();
        subscribers.clear();
        return new Promise<void>((resolveClose) => {
          socket.once("close", () => resolveClose());
          socket.close();
          // A dead peer must not hang shutdown: terminate as a fallback.
          const reap = setTimeout(() => {
            socket.terminate();
            resolveClose();
          }, 1000);
          reap.unref?.();
          socket.once("close", () => clearTimeout(reap));
        });
      },
    };
  });
}
