/** Server-owned Phase 4 runtime. One reflex writer per body; the mind only plans. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AUTOPILOT_COPY, effectiveModel, mindBaseUrl, type Character } from "../game/agent/account.ts";
import { createReflexAutopilot, type ReflexAutopilot } from "../game/agent/autopilot.ts";
import type { ReflexBackend, SchedulerConfig } from "../game/agent/scheduler.ts";
import { runMindExchangeOutcome } from "../game/agent/mind.ts";
import { createOpenAIAdapter } from "../game/agent/adapters/openai-compatible.ts";
import { createLocalAdapter } from "../game/agent/adapters/local.ts";
import type { MindResponse, Observation } from "../game/agent/types.ts";
import type { RuntimePort, RuntimeServices, RuntimeStatus } from "./accounts.ts";
import type { createShard, VerbRequest } from "./shard.ts";

type Entry = {
  character: Character;
  status: RuntimeStatus;
  autopilot: ReflexAutopilot;
  backend: ReflexBackend;
  reflexController: AbortController;
  goals: MindResponse["goals"];
  hints: MindResponse["intentHints"];
  controller: AbortController | null;
  pending: Promise<void> | null;
  epoch: number;
  failed: number;
  nextMindAt: number;
  requested: boolean;
  previous: Observation | null;
};

export function createAgentRuntime(opts: {
  shard: ReturnType<typeof createShard>;
  services: RuntimeServices;
  /** Required explicitly. Production supplies the durable metered P3 backend. */
  backendFactory: ((characterId: string, signal: AbortSignal) => ReflexBackend) | null;
  fetchImpl: typeof fetch;
  defaultModel?: string | null;
  now?: () => number;
  retryMs?: number[];
  mindTimeoutMs?: number;
  schedulerConfig?: Partial<SchedulerConfig>;
}) {
  const now = opts.now ?? Date.now;
  const backoff = opts.retryMs ?? [60_000, 300_000, 900_000];
  const agents = new Map<string, Entry>();
  const pending = new Set<Promise<void>>();
  const inactive = (c: Character): RuntimeStatus => ({ driver: "none", mindState: c.mind ? "asleep" : "unconfigured", runtimeState: "inactive", reflexState: "unavailable", reasonCode: null, autopilotSince: null, lastMindExchangeTick: null, lastReflexTick: null, lastAppliedActionTick: null, configRevision: c.revision });
  const current = (id: string, e: Entry) => agents.get(id) === e;
  const text = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
  const packs = new Map<string, string>();
  let manual: string | null = null;
  function pack(c: Character) {
    if (!c.roleId || !["ranger", "smith", "banker", "mule"].includes(c.roleId)) throw new Error("CONFIG_UNAVAILABLE");
    if (!packs.has(c.roleId)) packs.set(c.roleId, text(`../../agent-packs/${c.roleId}.md`));
    manual ??= text("../../docs/vale-manual.md");
    return packs.get(c.roleId)!;
  }
  function reflect(e: Entry) {
    if (e.backend.budgetExhausted?.()) {
      e.status.reflexState = "budget-exhausted";
      e.status.reasonCode = "REFLEX_BUDGET_EXHAUSTED";
    }
    if (e.status.reflexState === "unavailable") e.status.reasonCode = "REFLEX_UNAVAILABLE";
    e.status.runtimeState = e.status.reflexState === "ready" && e.status.mindState !== "error" ? "running" : "degraded";
    e.status.driver = e.status.reflexState !== "ready" ? "none" : e.status.mindState === "awake" ? "mind" : "reflex";
  }
  function exchange(id: string, e: Entry, observation: Observation) {
    if (e.pending || !e.character.mind) return;
    const c = structuredClone(e.character);
    const epoch = e.epoch;
    const controller = new AbortController(); e.controller = controller;
    e.requested = false;
    const run = async () => {
      const model = effectiveModel(c.mind!, opts.defaultModel ?? null);
      if (!model) throw new Error("MODEL_REQUIRED");
      const common = { baseUrl: mindBaseUrl(c.mind!), model, fetchImpl: opts.fetchImpl };
      const adapter = c.mind!.kind === "cloud"
        ? createOpenAIAdapter({ ...common, apiKey: opts.services.readSecret(id) ?? undefined })
        : createLocalAdapter(common);
      const result = await runMindExchangeOutcome({ directive: c.directive, rolePack: pack(c), manual: manual!, observation, goals: e.goals, journalTail: opts.services.journalTail(id) }, adapter, { signal: controller.signal, timeoutMs: opts.mindTimeoutMs });
      if (!current(id, e) || e.epoch !== epoch || opts.services.character(id).revision !== c.revision) return;
      if (result.ok) {
        const wasAsleep = e.status.autopilotSince !== null;
        e.status.mindState = "awake";
        e.status.lastMindExchangeTick = opts.shard.currentTick();
        e.status.autopilotSince = null;
        e.status.reasonCode = null;
        e.failed = 0;
        e.goals = result.response.goals.slice(0, 32).map(s => s.slice(0, 2000));
        e.hints = result.response.intentHints.slice(0, 32);
        if (wasAsleep) opts.services.appendJournal(id, "system", AUTOPILOT_COPY.wakeLine(c.name));
        // Never insert credentials into prompts; additionally remove an exact stored
        // secret if an untrusted completion happens to echo one in its journal.
        let entry = result.response.journalEntry.slice(0, 4000);
        const secret = opts.services.readSecret(id);
        if (secret) entry = entry.split(secret).join("[redacted]");
        if (entry) opts.services.appendJournal(id, "mind", entry);
        e.nextMindAt = now() + 60_000;
      } else if (result.reasonCode !== "MIND_CANCELLED") {
        e.status.mindState = result.reasonCode === "MIND_UNREACHABLE" ? "asleep" : "error";
        e.status.reasonCode = result.reasonCode;
        if (e.status.autopilotSince === null) {
          e.status.autopilotSince = opts.shard.currentTick();
          opts.services.appendJournal(id, "system", AUTOPILOT_COPY.sleepLine(c.name));
        }
        e.nextMindAt = now() + backoff[Math.min(e.failed++, backoff.length - 1)]!;
      }
      reflect(e);
    };
    const work = run().catch(() => {
      if (current(id, e) && e.epoch === epoch) {
        e.status.mindState = "error"; e.status.reasonCode = "MIND_CONFIGURATION";
        e.nextMindAt = now() + backoff[Math.min(e.failed++, backoff.length - 1)]!;
        reflect(e);
      }
    }).finally(() => { if (e.pending === work) { e.pending = null; e.controller = null; } pending.delete(work); });
    e.pending = work; pending.add(work);
  }
  function tick(id: string, e: Entry) {
    if (!current(id, e)) return;
    const c = opts.services.character(id);
    if (c.lifecycle !== "unleashed") { stopAgent(id); return; }
    if (c.revision !== e.character.revision) {
      e.character = structuredClone(c);
      e.epoch++; e.controller?.abort(); e.requested = true; e.nextMindAt = 0;
      e.goals = []; e.hints = [];
      e.status.configRevision = c.revision;
    }
    const obs = opts.shard.observationFor(id);
    e.status.lastAppliedActionTick = opts.shard.lastAppliedActionTick(id);
    if (e.previous && (obs.you.hp < e.previous.you.hp)) e.requested = true;
    const retry = e.status.mindState !== "awake" && now() >= e.nextMindAt;
    if (!e.pending && (retry || (e.requested && (c.revision !== e.status.configRevision || now() >= e.nextMindAt)))) exchange(id, e, obs);
    e.previous = obs;
    e.autopilot.ingest(obs);
    reflect(e);
  }
  function stopAgent(id: string) {
    const e = agents.get(id); if (!e) return;
    agents.delete(id); e.epoch++; e.controller?.abort(); e.reflexController.abort(); e.autopilot.stop();
    const drain = e.autopilot.settled().finally(() => pending.delete(drain));
    pending.add(drain);
    opts.shard.recallAgent(id);
  }
  const unsubscribe = opts.shard.onTick(() => { for (const [id, e] of agents) tick(id, e); });
  const port: RuntimePort = {
    ensureAgent(c) {
      if (agents.has(c.characterId)) return { ok: true };
      if (!opts.backendFactory) return { ok: false, reason: "REFLEX_UNCONFIGURED" };
      try { pack(c); } catch { return { ok: false, reason: "CONFIG_UNAVAILABLE" }; }
      let backend: ReflexBackend;
      const reflexController = new AbortController();
      try { backend = opts.backendFactory(c.characterId, reflexController.signal); } catch { return { ok: false, reason: "REFLEX_UNAVAILABLE" }; }
      const id = c.characterId;
      const e: Entry = { character: structuredClone(c), status: { ...inactive(c), driver: "reflex", mindState: "connecting", runtimeState: "starting", reflexState: "ready" }, backend, reflexController, autopilot: null as unknown as ReflexAutopilot, goals: [], hints: [], controller: null, pending: null, epoch: 0, failed: 0, nextMindAt: 0, requested: true, previous: null };
      e.autopilot = createReflexAutopilot({
        backend: { budgetExhausted: () => backend.budgetExhausted?.() ?? false, async decide(input, ctx) {
          const epoch = e.epoch;
          const result = await backend.decide({ ...input, state: { ...(input.state as object), directive: e.character.directive, goals: e.goals, intentHints: e.hints } }, ctx);
          if (!current(id, e) || e.epoch !== epoch || opts.services.character(id).revision !== e.character.revision) throw new Error("STALE_CONFIGURATION");
          return result;
        } },
        submit: intent => current(id, e) ? opts.shard.enqueueIntent(id, intent) : "recalled",
        verb: req => current(id, e) ? opts.shard.enqueueVerb(id, req as VerbRequest) : "recalled",
        config: opts.schedulerConfig,
        now,
        hooks: {
          onDecision: row => {
            if (!current(id, e)) return;
            e.status.lastReflexTick = opts.shard.currentTick();
            e.status.reflexState = "ready";
            if (e.status.reasonCode?.startsWith("REFLEX_")) e.status.reasonCode = null;
            opts.services.recordDecision(row);
          },
          onAttemptEnd: rec => {
            if (!current(id, e)) return;
            if (rec.status === "error") { e.status.reflexState = backend.budgetExhausted?.() ? "budget-exhausted" : "unavailable"; e.status.reasonCode = e.status.reflexState === "budget-exhausted" ? "REFLEX_BUDGET_EXHAUSTED" : "REFLEX_UNAVAILABLE"; }
            reflect(e);
          },
        },
      });
      agents.set(id, e); e.autopilot.start();
      queueMicrotask(() => { if (current(id, e)) tick(id, e); });
      return { ok: true };
    },
    stopAgent,
    status(c) { const e = agents.get(c.characterId); if (e) { reflect(e); return { ...e.status }; } const s = inactive(c); if (c.lifecycle === "unleashed") { s.runtimeState = "degraded"; s.reasonCode = "RUNTIME_UNAVAILABLE"; } return s; },
  };
  return { ...port, get size() { return agents.size; }, stopAll() { for (const id of agents.keys()) stopAgent(id); unsubscribe(); }, async settled() { await Promise.all([...pending, ...[...agents.values()].map(e => e.autopilot.settled())]); } };
}
