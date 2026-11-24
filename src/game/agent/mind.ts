/**
 * Mind exchange — the slow path to the owner's BYO LLM (contract §4).
 *
 * runMindExchange assembles the prompt, calls the adapter with a 20s
 * per-attempt timeout and one retry on transport failure, then validates
 * the reply. ANY malformed output degrades to the standing goals with an
 * empty journal and no hints: a confused mind must never crash the body —
 * reflexes keep it alive on autopilot.
 *
 * Pure plumbing: no sim state, no network of its own (the adapter owns
 * the fetch), no secrets in errors. Hint legality against the live verb
 * menu stays downstream — this layer only checks the wire shape.
 */
import { MAP } from "../atlas.ts";
import { INTENT_KINDS } from "../save.ts";
import type { Intent } from "../types.ts";
import { assembleMindMessages, type Message } from "./assembler.ts";
import type { MindRequest, MindResponse } from "./types.ts";

/** Transport to one mind backend. Returns raw assistant text; throws on
 *  network / HTTP failure so the exchange can retry once. */
export interface MindAdapter {
  complete(messages: Message[], signal?: AbortSignal): Promise<string>;
}

/** Per-attempt wall clock for one mind call. */
export const MIND_TIMEOUT_MS = 20_000;

export interface MindExchangeOptions {
  /** Override the per-attempt timeout (tests use a small value). */
  timeoutMs?: number;
  /** Owner recall / runtime shutdown. Cancellation is terminal, never retried. */
  signal?: AbortSignal;
}

export type MindExchangeOutcome =
  | { ok: true; response: MindResponse }
  | { ok: false; reasonCode: "MIND_UNREACHABLE" | "MIND_INVALID_RESPONSE" | "MIND_AUTH" | "MIND_CANCELLED" };

/** Wire shape only — same kind set as save.ts, same bounds as intent.ts.
 *  Missing nullable refs normalize to null; reach and legality stay the
 *  sim's job. */
function isMindIntent(value: unknown): value is Intent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.kind !== "string" || !INTENT_KINDS.has(v.kind)) return false;
  if (!Number.isInteger(v.tx) || !Number.isInteger(v.ty)) return false;
  const tx = v.tx as number;
  const ty = v.ty as number;
  if (tx < 0 || ty < 0 || tx >= MAP || ty >= MAP) return false;
  if (v.targetId !== null && v.targetId !== undefined && typeof v.targetId !== "string") return false;
  if (v.spell !== null && v.spell !== undefined && typeof v.spell !== "string") return false;
  return true;
}

/** Parse + validate one raw reply. null = malformed (caller degrades). */
export function parseMindResponse(raw: string): MindResponse | null {
  let text = raw.trim();
  // Tolerate a single markdown fence even though the prompt forbids it.
  if (text.startsWith("```")) {
    const nl = text.indexOf("\n");
    if (nl === -1) return null;
    text = text.slice(nl + 1);
    if (text.endsWith("```")) text = text.slice(0, -3);
    text = text.trim();
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.goals) || !d.goals.every((g) => typeof g === "string")) return null;
  if (typeof d.journalEntry !== "string") return null;
  if (!Array.isArray(d.intentHints) || !d.intentHints.every(isMindIntent)) return null;
  return {
    goals: d.goals as string[],
    journalEntry: d.journalEntry,
    intentHints: (d.intentHints as Intent[]).map((h) => ({
      kind: h.kind,
      tx: h.tx,
      ty: h.ty,
      targetId: h.targetId ?? null,
      spell: h.spell ?? null,
    })),
  };
}

const CALL_TIMEOUT = Symbol("mind timeout");
const CALL_CANCELLED = Symbol("mind cancelled");

async function callWithTimeout(
  req: MindRequest,
  adapter: MindAdapter,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<string> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel = () => {};
  const interrupted = new Promise<never>((_resolve, reject) => {
    cancel = () => {
      reject(CALL_CANCELLED);
      ctrl.abort(); // Do not forward the owner's potentially private abort reason.
    };
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    timer = setTimeout(() => {
      reject(CALL_TIMEOUT);
      ctrl.abort();
    }, timeoutMs);
  });
  try {
    // Race even adapters that ignore AbortSignal. Promise.race also observes
    // late rejections, so a timed-out transport cannot leak an unhandled error.
    const completion = Promise.resolve().then(() => {
      if (signal?.aborted) throw CALL_CANCELLED;
      return adapter.complete(assembleMindMessages(req), ctrl.signal);
    });
    return await Promise.race([interrupted, completion]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

/** Explicit, sanitized outcomes for runtime accounting. At most two attempts;
 * malformed replies, auth failures and owner recall are terminal. */
export async function runMindExchangeOutcome(
  req: MindRequest,
  adapter: MindAdapter,
  opts: MindExchangeOptions = {},
): Promise<MindExchangeOutcome> {
  const timeoutMs = opts.timeoutMs ?? MIND_TIMEOUT_MS;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (opts.signal?.aborted) return { ok: false, reasonCode: "MIND_CANCELLED" };
    try {
      const raw = await callWithTimeout(req, adapter, timeoutMs, opts.signal);
      if (opts.signal?.aborted) return { ok: false, reasonCode: "MIND_CANCELLED" };
      const response = typeof raw === "string" ? parseMindResponse(raw) : null;
      return response
        ? { ok: true, response }
        : { ok: false, reasonCode: "MIND_INVALID_RESPONSE" };
    } catch (error) {
      if (opts.signal?.aborted || error === CALL_CANCELLED) {
        return { ok: false, reasonCode: "MIND_CANCELLED" };
      }
      // Only the adapter's exact, body-free status messages are recognized.
      if (error instanceof Error &&
          (error.message === "mind endpoint HTTP 401" || error.message === "mind endpoint HTTP 403")) {
        return { ok: false, reasonCode: "MIND_AUTH" };
      }
      // Unknown failures and timeouts retry once; never return raw errors.
    }
  }
  return { ok: false, reasonCode: "MIND_UNREACHABLE" };
}

/** Compatibility API: callers without outcome accounting retain standing goals. */
export async function runMindExchange(
  req: MindRequest,
  adapter: MindAdapter,
  opts: MindExchangeOptions = {},
): Promise<MindResponse> {
  const outcome = await runMindExchangeOutcome(req, adapter, opts);
  return outcome.ok
    ? outcome.response
    : { goals: req.goals, journalEntry: "", intentHints: [] };
}
