import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { COURT } from "../game/atlas.ts";
import { createPerson, createStubWorld, createWorld } from "../game/world.ts";
import { decodeSave, encodeSave } from "../game/save.ts";
import { submitIntent, validateIntent } from "../game/agent/intent.ts";
import { candidatesFor } from "../game/agent/candidates.ts";
import { observeBody } from "../game/agent/observe.ts";
import { hashObservation } from "../game/agent/log.ts";
import { SPELL_META } from "../game/magery.ts";
import { ITEM_META, SKILL_META } from "../game/catalog.ts";
import { commandDrinkWater, commandEat, commandEquip } from "../game/player.ts";
import { commandBankGold, commandBankItem } from "../game/bank.ts";
import { commandTrack } from "../game/tracking.ts";
import { commandCraft } from "../game/craft.ts";
import { tickWorld } from "../game/sim.ts";
import { mulberry32 } from "../game/rng.ts";
import type { Intent, ItemId, World } from "../game/types.ts";
import { hydrateWorld } from "./hydrate.ts";

export const TICK_MS = 100;
export const SAVE_EVERY_TICKS = 300;
const QUEUE_LIMIT = 1024;

/** Soak harness extension (AI-MMO soak t_8b32a7bd): the non-intent menu verbs
 * (eat/track/bank/craft/equip) are command* calls in the solo UI. On a shard they
 * must execute server-side too, so the wire carries them as a second request
 * type with the same admission semantics as intents: ack = queue admission,
 * execution happens in the serialized drain, refusals go to the sim log.
 * Additive — intent wire and spawn behavior are unchanged. */
export const VERB_KINDS = ["eat", "drink", "track", "bank_gold", "bank_item", "craft", "equip"] as const;
export type VerbKind = (typeof VERB_KINDS)[number];
export interface VerbRequest { verb: VerbKind; item?: string | null; n?: number | null; recipeId?: string | null; tx?: number | null; ty?: number | null }

export function validateVerb(req: VerbRequest): string | null {
  if (!req || typeof req !== "object") return "Unknown verb";
  if (!(VERB_KINDS as readonly string[]).includes(req.verb)) return `Unknown verb ${String(req.verb)}`;
  if (req.item !== undefined && req.item !== null && (typeof req.item !== "string" || !Object.hasOwn(ITEM_META, req.item))) return "Unknown item";
  if (req.n !== undefined && req.n !== null && (!Number.isInteger(req.n) || req.n < 1 || req.n > 999)) return "Bad count";
  if (req.recipeId !== undefined && req.recipeId !== null && (typeof req.recipeId !== "string" || !req.recipeId.trim() || req.recipeId.length > 48)) return "Bad recipe";
  if ((req.verb === "bank_item" || req.verb === "equip") && !req.item) return "Verb needs an item";
  if (req.verb === "craft" && !req.recipeId) return "Verb needs a recipe";
  if (req.verb === "drink" && (!Number.isInteger(req.tx) || !Number.isInteger(req.ty))) return "Drink needs a water tile";
  return null;
}

function executeVerb(world: World, characterId: string, req: VerbRequest): string | null {
  switch (req.verb) {
    case "eat": return commandEat(world, (req.item ?? undefined) as ItemId | undefined, characterId);
    case "drink": return commandDrinkWater(world, req.tx as number, req.ty as number, characterId);
    case "track": return commandTrack(world, characterId);
    case "bank_gold": return commandBankGold(world, characterId);
    case "bank_item": return commandBankItem(world, req.item as ItemId, req.n ?? undefined, characterId);
    case "craft": return commandCraft(world, req.recipeId ?? "", characterId);
    case "equip": return commandEquip(world, req.item as ItemId, characterId);
  }
}
export interface ShardConfig {
  port: number;
  dataDir: string;
  seed: number;
  keys: { name: string; key: string }[];
}
interface Character { key: string; characterId: string; name: string; createdAt: string }

export function shardConfig(env: NodeJS.ProcessEnv = process.env): ShardConfig {
  const port = Number(env.PORT ?? 8080);
  const seed = Number(env.EMBERHALL_SEED ?? 20261121);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  if (!Number.isSafeInteger(seed)) throw new Error("Invalid EMBERHALL_SEED");
  const dataDir = env.EMBERHALL_DATA_DIR ?? "./shard-data";
  if (!dataDir.trim()) throw new Error("Empty EMBERHALL_DATA_DIR");
  const raw = env.EMBERHALL_KEYS ?? "kett:dev-kett,bran:dev-bran";
  const keys = raw === "" ? [] : raw.split(",").map(pair => {
    const split = pair.indexOf(":");
    const name = pair.slice(0, split).trim();
    const key = pair.slice(split + 1);
    if (split < 1 || !name || name.length > 48 || !key.trim()) throw new Error("Invalid EMBERHALL_KEYS pair");
    return { name, key };
  });
  if (new Set(keys.map(k => k.name)).size !== keys.length || new Set(keys.map(k => k.key)).size !== keys.length) throw new Error("Duplicate character name or key");
  return { port, dataDir, seed, keys };
}

export function clampElapsed(seconds: number): number {
  return Number.isFinite(seconds) ? Math.max(0, Math.min(1, seconds)) : 0;
}

function atomicWrite(path: string, content: string) {
  writeFileSync(`${path}.tmp`, content, { encoding: "utf8", mode: 0o600 });
  renameSync(`${path}.tmp`, path);
}
function readRegistry(path: string): Character[] {
  if (!existsSync(path)) return [];
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw) || raw.some(c => !c || typeof c !== "object" ||
    typeof c.key !== "string" || !c.key || typeof c.name !== "string" || !c.name || c.name.length > 48 ||
    typeof c.characterId !== "string" || !c.characterId || typeof c.createdAt !== "string" || !Number.isFinite(Date.parse(c.createdAt)))) {
    throw new Error("Invalid character registry; refusing to replace identities");
  }
  const rows = raw as Character[];
  for (const key of ["key", "characterId", "name"] as const) if (new Set(rows.map(row => row[key])).size !== rows.length) throw new Error("Duplicate character registry identity");
  return rows;
}

/** Transport gets only value projections and the queue, never a mutable World.
 * Enqueue performs the harness's pure validation; submitIntent is called only
 * during the serialized drain, immediately before the authoritative sim beat.
 * Later requests for one body in the same drain replace its earlier intent,
 * matching the sim's single intent slot. Queue admission is NOT action success.
 */
export function createShard(config: ShardConfig = shardConfig(), options: {
  log?: (line: string) => void;
  now?: () => number;
} = {}) {
  const log = options.log ?? console.log;
  const now = options.now ?? (() => performance.now());
  mkdirSync(config.dataDir, { recursive: true });
  const savePath = join(config.dataDir, "shard-save.json");
  const registryPath = join(config.dataDir, "characters.json");
  const restored = existsSync(savePath) ? decodeSave(readFileSync(savePath, "utf8")) : null;
  if (!restored && existsSync(join(config.dataDir, "director-characters.json")) && existsSync(savePath)) throw new Error("Director shard checkpoint is corrupt; refusing to reset durable bodies");
  const world = hydrateWorld(restored ?? createWorld(config.seed));
  if (restored) log(`shard restore tick=${world.tickCount}`);
  else if (existsSync(savePath)) log("shard restore invalid; starting fresh");
  const characters = readRegistry(registryPath);
  for (const entry of config.keys) {
    // Persisted registry is authoritative; configuration seeds missing names,
    // not an implicit credential-rotation or identity-reset mechanism.
    if (characters.some(c => c.name === entry.name)) continue;
    if (characters.some(c => c.key === entry.key)) throw new Error("Configured key already belongs to another character");
    const id = `host-${createHash("sha256").update(entry.name).digest("hex").slice(0, 24)}`;
    characters.push({ ...entry, characterId: id, createdAt: new Date().toISOString() });
  }
  const template = createStubWorld().player;
  world.playerStates ??= {};
  for (const character of characters) {
    const id = character.characterId;
    if (id === world.player.id) throw new Error("Hosted identity aliases host camera");
    const body = world.people.find(p => p.id === id);
    if (body?.isPlayer) throw new Error("Hosted identity aliases player body");
    if (character.key.startsWith("dir-") && (!body || !Object.hasOwn(world.playerStates, id))) throw new Error("Director body checkpoint missing; refusing to reset assets");
    if (!body) {
      const person = createPerson(world, mulberry32(world.seed + characters.indexOf(character)), {
        x: COURT.tx, z: COURT.ty + 1, cls: "ranger", member: true, isPlayer: false, name: character.name,
      });
      person.id = id;
      world.people.push(person);
    }
    if (!Object.hasOwn(world.playerStates, id)) world.playerStates[id] = { ...structuredClone(template), id };
  }
  // The legacy camera is not an agent and cannot continue a saved work order.
  world.player.intent = { kind: "none", tx: 0, ty: 0, targetId: null, spell: null };
  world.player.workT = 0;
  const camera = world.people.find(p => p.id === world.player.id);
  if (camera) camera.path = [];
  let queue: { characterId: string; intent: Intent }[] = [];
  let verbQueue: { characterId: string; req: VerbRequest }[] = [];
  let timer: ReturnType<typeof setInterval> | undefined;
  let last = now();
  let stopped = false;
  let ticksSinceSave = 0;
  const tickListeners = new Set<() => void>();
  const effectTicks = new Map<string, number>();
  function actionState(id: string) {
    const p = world.people.find(p => p.id === id);
    const s = world.playerStates?.[id];
    return JSON.stringify([p?.x, p?.z, p?.task, s?.pack, s?.vault, s?.resources, s?.wear, s?.workT]);
  }
  const known = (id: string) => characters.some(c => c.characterId === id);
  function save() {
    atomicWrite(savePath, encodeSave(world));
    log(`shard save tick=${world.tickCount}`);
    ticksSinceSave = 0;
  }
  // World first: a crash before registry rename is recoverable because seeded
  // names have stable IDs. Registry-first could authenticate a nonexistent body.
  save();
  atomicWrite(registryPath, JSON.stringify(characters));
  function step(realDt: number) {
    if (stopped) throw new Error("Shard is stopped");
    const before = new Map(characters.map(c => [c.characterId, actionState(c.characterId)]));
    const active = new Set([...queue.map(q => q.characterId), ...verbQueue.map(q => q.characterId), ...characters.filter(c => world.playerStates?.[c.characterId]?.intent.kind !== "none").map(c => c.characterId)]);
    const pending = queue; queue = [];
    for (const item of pending) submitIntent(world, item.intent, item.characterId);
    // Menu verbs drain in the same serialized beat, after intents: a walk
    // queued this tick lands before an eat/bank that depends on position.
    const verbs = verbQueue; verbQueue = [];
    for (const item of verbs) {
      const result = executeVerb(world, item.characterId, item.req);
      log(`[verb ${item.characterId}] ${item.req.verb}: ${result ?? "ok"}`);
    }
    // Snapshot accepted drink work only after verb dispatch. Completion below
    // requires the intent to finish AND thirst to rise: queue admission,
    // rejected drinks, failed reachability, and passive decay are not effects.
    const drinkStarts = new Map<string, number>();
    for (const character of characters) {
      const sheet = world.playerStates?.[character.characterId];
      const person = world.people.find(p => p.id === character.characterId);
      if (sheet?.intent.kind === "drink" && person) drinkStarts.set(character.characterId, person.thirst);
    }
    tickWorld(world, clampElapsed(realDt));
    for (const id of active) {
      const thirstBefore = drinkStarts.get(id);
      const person = world.people.find(p => p.id === id);
      const completedDrink = thirstBefore !== undefined && person !== undefined
        && world.playerStates?.[id]?.intent.kind === "none" && person.thirst > thirstBefore;
      if (completedDrink || before.get(id) !== actionState(id)) effectTicks.set(id, world.tickCount);
    }
    if (++ticksSinceSave >= SAVE_EVERY_TICKS) save();
    for (const listener of tickListeners) listener();
  }
  /* Phase 4 director seam (additive): durable agent bodies for owned
   * characters. Registration never re-grants skills to an existing body —
   * restart, crash recovery and re-unleash are all idempotent (v1 §3). */
  function registerAgent(body: { id: string; name: string; key: string; skills: Partial<Record<string, number>> }, inject: boolean): { created: boolean } {
    if (stopped) throw new Error("Shard is stopped");
    if (body.id === world.player.id) throw new Error("Director identity aliases host camera");
    if (known(body.id)) return { created: false };
    if (characters.some(c => c.key === body.key)) throw new Error("Director key already bound");
    let name = body.name;
    if (characters.some(c => c.name === name)) name = `${body.name} (${body.id.slice(-4)})`;
    characters.push({ key: body.key, characterId: body.id, name, createdAt: new Date().toISOString() });
    // A checkpoint can precede its registry rename. Reuse orphaned durable
    // bodies/state instead of cloning or granting the initial kit again.
    let person = world.people.find(p => p.id === body.id);
    if (!person) {
      person = createPerson(world, mulberry32(world.seed + characters.length), {
        x: COURT.tx, z: COURT.ty + 1, cls: "ranger", member: true, isPlayer: false, name,
      });
      person.id = body.id;
      world.people.push(person);
    }
    const existing = world.playerStates![body.id];
    const state = existing ?? { ...structuredClone(template), id: body.id };
    if (inject && !existing) {
      for (const [skill, level] of Object.entries(body.skills)) {
        if (Object.hasOwn(SKILL_META, skill) && typeof level === "number") state.skills[skill as keyof typeof SKILL_META] = level;
      }
    }
    world.playerStates![body.id] = state;
    // World first, then registry — the same crash-safety order as seeding.
    save();
    atomicWrite(registryPath, JSON.stringify(characters));
    return { created: true };
  }
  function agentBody(id: string) {
    if (!known(id)) return null;
    const person = world.people.find(p => p.id === id);
    if (!person) return null;
    return { hp: person.hp, maxHp: person.maxHp, x: person.x, z: person.z, task: person.task };
  }
  function recallAgent(id: string) {
    if (!known(id)) return;
    queue = queue.filter(item => item.characterId !== id);
    verbQueue = verbQueue.filter(item => item.characterId !== id);
    submitIntent(world, { kind: "none", tx: 0, ty: 0, targetId: null, spell: null }, id);
    world.playerStates![id].workT = 0;
  }
  return {
    status: () => ({ tick: world.tickCount, characters: characters.length }),
    registerAgent,
    hasAgent: known,
    agentBody,
    recallAgent,
    currentTick: () => world.tickCount,
    lastAppliedActionTick: (id: string) => effectTicks.get(id) ?? null,
    onTick(listener: () => void) {
      tickListeners.add(listener);
      return () => { tickListeners.delete(listener); };
    },
    disconnect(characterId: string) {
      if (!known(characterId)) return;
      queue = queue.filter(item => item.characterId !== characterId);
      verbQueue = verbQueue.filter(item => item.characterId !== characterId);
      submitIntent(world, { kind: "none", tx: 0, ty: 0, targetId: null, spell: null }, characterId);
      world.playerStates![characterId].workT = 0;
    },
    resolveKey(apiKey: string): string | null { return characters.find(c => c.key === apiKey)?.characterId ?? null; },
    enqueueIntent(characterId: string, intent: Intent): string | null {
      if (stopped) return "Shard is stopped";
      if (!known(characterId)) return "Unknown character";
      const error = validateIntent(world, intent);
      if (error) return error;
      // Harness shape validation accepts any string, but the shared save
      // schema requires a catalog spell. Never admit an unsaveable intent.
      if (intent.spell !== null && !Object.hasOwn(SPELL_META, intent.spell)) return "Unknown spell";
      if (queue.length >= QUEUE_LIMIT) return "Intent queue is full";
      queue.push({ characterId, intent: { kind: intent.kind, tx: intent.tx, ty: intent.ty, targetId: intent.targetId, spell: intent.spell } });
      return null;
    },
    enqueueVerb(characterId: string, req: VerbRequest): string | null {
      if (stopped) return "Shard is stopped";
      if (!known(characterId)) return "Unknown character";
      const error = validateVerb(req);
      if (error) return error;
      if (verbQueue.length >= QUEUE_LIMIT) return "Verb queue is full";
      verbQueue.push({ characterId, req: { verb: req.verb, item: req.item ?? null, n: req.n ?? null, recipeId: req.recipeId ?? null, tx: req.tx ?? null, ty: req.ty ?? null } });
      return null;
    },
    observationFor(characterId: string) {
      if (!known(characterId)) throw new Error("Unknown character");
      // Contract Phase 0: an Observation carries the body's legal verb menu —
      // without it a reflex autopilot over this feed has nothing to choose
      // from. Menu computation walks nearby targets (candidatesFor) and, like
      // the UI's own menu, may record node discoveries on the world.
      return observeBody(world, characterId, { verbs: candidatesFor(world, characterId) });
    },
    obsHash(characterId: string) {
      if (!known(characterId)) throw new Error("Unknown character");
      // Hash the same shape observationFor serves (hashObservation covers
      // tick + body + verb menu), so a menu change alone pushes a fresh obs.
      return hashObservation(observeBody(world, characterId, { verbs: candidatesFor(world, characterId) }));
    },
    checkpoint: () => encodeSave(world),
    step,
    save,
    start() {
      if (stopped) throw new Error("Shard is stopped");
      if (timer) return;
      last = now();
      timer = setInterval(() => { const current = now(); const elapsed = (current - last) / 1000; last = current; step(elapsed); }, TICK_MS);
    },
    stop() {
      if (stopped) return;
      if (timer) clearInterval(timer);
      timer = undefined;
      // Pending admissions have not executed and are intentionally not saved.
      save();
      stopped = true;
      queue = [];
      verbQueue = [];
    },
  };
}
