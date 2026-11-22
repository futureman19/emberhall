import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { COURT } from "../game/atlas.ts";
import { createPerson, createStubWorld, createWorld } from "../game/world.ts";
import { decodeSave, encodeSave } from "../game/save.ts";
import { submitIntent, validateIntent } from "../game/agent/intent.ts";
import { observeBody } from "../game/agent/observe.ts";
import { hashObservation } from "../game/agent/log.ts";
import { SPELL_META } from "../game/magery.ts";
import { tickWorld } from "../game/sim.ts";
import { mulberry32 } from "../game/rng.ts";
import type { Intent } from "../game/types.ts";
import { hydrateWorld } from "./hydrate.ts";

export const TICK_MS = 100;
export const SAVE_EVERY_TICKS = 300;
const QUEUE_LIMIT = 1024;
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
  let timer: ReturnType<typeof setInterval> | undefined;
  let last = now();
  let stopped = false;
  let ticksSinceSave = 0;
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
    const pending = queue; queue = [];
    for (const item of pending) submitIntent(world, item.intent, item.characterId);
    tickWorld(world, clampElapsed(realDt));
    if (++ticksSinceSave >= SAVE_EVERY_TICKS) save();
  }
  return {
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
    observationFor(characterId: string) {
      if (!known(characterId)) throw new Error("Unknown character");
      return observeBody(world, characterId);
    },
    obsHash(characterId: string) {
      if (!known(characterId)) throw new Error("Unknown character");
      return hashObservation(observeBody(world, characterId));
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
    },
  };
}
