import { CLASS_META } from "./catalog.ts";
import { log } from "./world.ts";
import { LOOK_SCHEMA, type HairStyleId, type LookRecipeV1 } from "./look/types.ts";
import {
  PART_MAX_COLORS,
  PART_MAX_VOXELS,
  PART_SCHEMA,
  PART_SLOTS,
  listParts,
  partRarity,
  removePart,
  savePart,
  type PartRarity,
  type PartSlot,
  type Voxel,
  type VoxelPartV1,
} from "./look/parts.ts";
import type { ClassId, Person, World } from "./types.ts";

export const CHAIN_ARTIFACT_APP = "emberhall" as const;
export const CHAIN_ARTIFACT_VERSION = 4 as const;
export const CHAIN_MINT_AUTHORITY = "client-beta" as const;
export const MAX_LOOK_PARTS = 16;

export interface CharacterLookInscription {
  readonly app: typeof CHAIN_ARTIFACT_APP;
  readonly v: typeof CHAIN_ARTIFACT_VERSION;
  readonly type: "look";
  readonly name: string;
  readonly calling: ClassId;
  readonly look: LookRecipeV1;
  readonly world: number;
  readonly hour: number;
  readonly revision: number;
  readonly predecessor?: string;
}

export interface PartInscription {
  readonly app: typeof CHAIN_ARTIFACT_APP;
  readonly v: typeof CHAIN_ARTIFACT_VERSION;
  readonly type: "part";
  readonly part: VoxelPartV1 & { author: string; rarity: PartRarity };
  readonly world: number;
  readonly hour: number;
}

export type EmberhallChainArtifact = CharacterLookInscription | PartInscription;

const CLASS_IDS = Object.keys(CLASS_META) as ClassId[];
const HAIR_STYLES = ["bald", "crop", "shag", "tail", "long"] as const satisfies readonly HairStyleId[];
const HEX = /^#[0-9a-f]{6}$/i;
const OUTPOINT = /^[0-9a-f]{64}(?:[._])\d+$/i;

function snapshotRecord(value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const allowed = new Set([...required, ...optional]);
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !allowed.has(key))) return null;
  if (required.some((key) => !keys.includes(key))) return null;
  const out: Record<string, unknown> = Object.create(null);
  for (const key of keys as string[]) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) return null;
    out[key] = descriptor.value;
  }
  return out;
}

function validName(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim() === value && value.length >= 1 && value.length <= maximum;
}

function parseLookRecipe(value: unknown, calling: ClassId): LookRecipeV1 | null {
  const raw = snapshotRecord(value, ["schema"], ["cls", "skin", "hairStyle", "hairColor", "garb", "parts"]);
  if (!raw || raw.schema !== LOOK_SCHEMA) return null;
  if (raw.cls !== undefined && (raw.cls !== calling || !CLASS_IDS.includes(raw.cls as ClassId))) return null;
  if (raw.skin !== undefined && (typeof raw.skin !== "string" || !HEX.test(raw.skin))) return null;
  if (raw.hairStyle !== undefined && !HAIR_STYLES.includes(raw.hairStyle as HairStyleId)) return null;
  if (raw.hairColor !== undefined && (typeof raw.hairColor !== "string" || !HEX.test(raw.hairColor))) return null;
  if (raw.garb !== undefined && (typeof raw.garb !== "string" || !HEX.test(raw.garb))) return null;
  if (raw.parts !== undefined) {
    if (!Array.isArray(raw.parts) || raw.parts.length > MAX_LOOK_PARTS) return null;
    if (raw.parts.some((id) => typeof id !== "string" || id.length < 4 || id.length > 80)) return null;
    if (new Set(raw.parts).size !== raw.parts.length) return null;
  }
  return {
    schema: LOOK_SCHEMA,
    ...(raw.cls !== undefined ? { cls: raw.cls as ClassId } : {}),
    ...(raw.skin !== undefined ? { skin: raw.skin.toLowerCase() as string } : {}),
    ...(raw.hairStyle !== undefined ? { hairStyle: raw.hairStyle as HairStyleId } : {}),
    ...(raw.hairColor !== undefined ? { hairColor: raw.hairColor.toLowerCase() as string } : {}),
    ...(raw.garb !== undefined ? { garb: raw.garb.toLowerCase() as string } : {}),
    ...(raw.parts !== undefined ? { parts: [...raw.parts] as string[] } : {}),
  };
}

function playerPerson(world: World): Person | null {
  return world.people.find((person) => person.isPlayer) ?? null;
}

export function encodeCharacterLookInscription(
  world: World,
  person: Person,
  previous?: Pick<CharacterLookInscription, "revision"> & { outpoint: string },
): CharacterLookInscription | null {
  if (!person.isPlayer || !validName(person.name, 24) || !CLASS_IDS.includes(person.cls)) return null;
  const look = parseLookRecipe(person.look ?? { schema: LOOK_SCHEMA, cls: person.cls }, person.cls);
  if (!look) return null;
  if (previous && (!Number.isSafeInteger(previous.revision) || previous.revision < 1 || !OUTPOINT.test(previous.outpoint))) return null;
  return Object.freeze({
    app: CHAIN_ARTIFACT_APP,
    v: CHAIN_ARTIFACT_VERSION,
    type: "look",
    name: person.name,
    calling: person.cls,
    look,
    world: world.seed,
    hour: Math.floor(world.hour),
    revision: previous ? previous.revision + 1 : 1,
    ...(previous ? { predecessor: previous.outpoint.replace(/\.(\d+)$/, "_$1") } : {}),
  });
}

export function decodeCharacterLookInscription(value: unknown): CharacterLookInscription | null {
  const raw = snapshotRecord(
    value,
    ["app", "v", "type", "name", "calling", "look", "world", "hour", "revision"],
    ["predecessor"],
  );
  if (!raw || raw.app !== CHAIN_ARTIFACT_APP || raw.v !== CHAIN_ARTIFACT_VERSION || raw.type !== "look") return null;
  if (!validName(raw.name, 24) || !CLASS_IDS.includes(raw.calling as ClassId)) return null;
  if (!Number.isSafeInteger(raw.world) || !Number.isFinite(raw.hour)) return null;
  if (!Number.isSafeInteger(raw.revision) || (raw.revision as number) < 1) return null;
  if (raw.predecessor !== undefined && (typeof raw.predecessor !== "string" || !OUTPOINT.test(raw.predecessor))) return null;
  if (raw.revision === 1 && raw.predecessor !== undefined) return null;
  if ((raw.revision as number) > 1 && raw.predecessor === undefined) return null;
  const look = parseLookRecipe(raw.look, raw.calling as ClassId);
  if (!look) return null;
  return {
    app: CHAIN_ARTIFACT_APP,
    v: CHAIN_ARTIFACT_VERSION,
    type: "look",
    name: raw.name,
    calling: raw.calling as ClassId,
    look,
    world: raw.world as number,
    hour: raw.hour as number,
    revision: raw.revision as number,
    ...(raw.predecessor !== undefined ? { predecessor: raw.predecessor as string } : {}),
  };
}

export function latestCharacterLook<T extends { id: string; inscription: CharacterLookInscription }>(entries: readonly T[]): T | null {
  return [...entries].sort((a, b) => b.inscription.revision - a.inscription.revision || b.id.localeCompare(a.id))[0] ?? null;
}

export function applyCharacterLook(world: World, inscription: CharacterLookInscription): string | null {
  const person = playerPerson(world);
  if (!person) return null;
  person.name = inscription.name;
  person.cls = inscription.calling;
  person.look = structuredClone(inscription.look);
  const note = `${person.name} returns to the looking glass.`;
  log(world, note);
  return note;
}

function parseVoxel(value: unknown): Voxel | null {
  const raw = snapshotRecord(value, ["x", "y", "z", "c"]);
  if (!raw) return null;
  if (![raw.x, raw.y, raw.z].every((coordinate) => Number.isSafeInteger(coordinate) && (coordinate as number) >= 0 && (coordinate as number) < 8)) return null;
  if (typeof raw.c !== "string" || !HEX.test(raw.c)) return null;
  return { x: raw.x as number, y: raw.y as number, z: raw.z as number, c: raw.c.toLowerCase() };
}

function parsePart(value: unknown): PartInscription["part"] | null {
  const raw = snapshotRecord(value, ["schema", "id", "name", "slot", "voxels", "createdAt", "author", "rarity"]);
  if (!raw || raw.schema !== PART_SCHEMA || !validName(raw.id, 80) || !/^[a-z0-9][a-z0-9_-]{3,79}$/i.test(raw.id) || !validName(raw.name, 24)) return null;
  if (!PART_SLOTS.includes(raw.slot as PartSlot)) return null;
  if (!Array.isArray(raw.voxels) || raw.voxels.length < 1 || raw.voxels.length > PART_MAX_VOXELS) return null;
  const voxels = raw.voxels.map(parseVoxel);
  if (voxels.some((voxel) => voxel === null)) return null;
  const typedVoxels = (voxels as Voxel[]).sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z);
  const positions = typedVoxels.map(({ x, y, z }) => `${x},${y},${z}`);
  if (new Set(positions).size !== positions.length) return null;
  if (new Set(typedVoxels.map(({ c }) => c)).size > PART_MAX_COLORS) return null;
  if (!Number.isSafeInteger(raw.createdAt) || (raw.createdAt as number) < 0) return null;
  if (!validName(raw.author, 24)) return null;
  if (!["common", "uncommon", "rare", "masterwork"].includes(String(raw.rarity))) return null;
  const part = {
    schema: PART_SCHEMA,
    id: raw.id,
    name: raw.name,
    slot: raw.slot as PartSlot,
    voxels: typedVoxels,
    createdAt: raw.createdAt as number,
    author: raw.author,
    rarity: raw.rarity as PartRarity,
  };
  if (partRarity(part) !== part.rarity) return null;
  return part;
}

export function encodePartInscription(world: World, part: VoxelPartV1): PartInscription | null {
  const person = playerPerson(world);
  const parsed = parsePart({
    ...part,
    author: part.author ?? person?.name ?? "an unknown hand",
    rarity: part.rarity ?? partRarity(part),
  });
  if (!parsed) return null;
  return Object.freeze({
    app: CHAIN_ARTIFACT_APP,
    v: CHAIN_ARTIFACT_VERSION,
    type: "part",
    part: parsed,
    world: world.seed,
    hour: Math.floor(world.hour),
  });
}

export function decodePartInscription(value: unknown): PartInscription | null {
  const raw = snapshotRecord(value, ["app", "v", "type", "part", "world", "hour"]);
  if (!raw || raw.app !== CHAIN_ARTIFACT_APP || raw.v !== CHAIN_ARTIFACT_VERSION || raw.type !== "part") return null;
  if (!Number.isSafeInteger(raw.world) || !Number.isFinite(raw.hour)) return null;
  const part = parsePart(raw.part);
  if (!part) return null;
  return { app: CHAIN_ARTIFACT_APP, v: CHAIN_ARTIFACT_VERSION, type: "part", part, world: raw.world as number, hour: raw.hour as number };
}

export function decodeChainArtifact(value: unknown): EmberhallChainArtifact | null {
  if (typeof value !== "object" || value === null) return null;
  const type = Reflect.getOwnPropertyDescriptor(value, "type");
  if (!type || !("value" in type)) return null;
  if (type.value === "look") return decodeCharacterLookInscription(value);
  if (type.value === "part") return decodePartInscription(value);
  return null;
}

export function artifactBase64(artifact: EmberhallChainArtifact): string {
  const json = JSON.stringify(artifact);
  if (typeof btoa !== "undefined") return btoa(unescape(encodeURIComponent(json)));
  return Buffer.from(json, "utf8").toString("base64");
}

export function applyMintPart(world: World, id: string): string | null {
  const part = listParts().find((candidate) => candidate.id === id);
  if (!part) return "No such sculpture.";
  removePart(id);
  const person = playerPerson(world);
  if (person?.look?.parts?.includes(id)) {
    person.look = { ...person.look, parts: person.look.parts.filter((partId) => partId !== id) };
  }
  const note = `${part.name} passes into the chain. Its shape is yours — truly.`;
  log(world, note);
  return note;
}

export function localPartIdFromOrigin(origin: string): string | null {
  if (!OUTPOINT.test(origin)) return null;
  return `o_${origin.replace(/[._]/g, "_")}`;
}

export function previewRedeemPart(inscription: PartInscription, origin: string): string | null {
  const id = localPartIdFromOrigin(origin);
  if (!id) return "That ordinal has no stable origin.";
  const existing = listParts().find((part) => part.id === id);
  if (!existing) return null;
  const candidate = { ...structuredClone(inscription.part), id };
  return JSON.stringify(existing) === JSON.stringify(candidate) ? null : "A different sculpture already holds that chain origin.";
}

export function applyRedeemPart(world: World, inscription: PartInscription, origin: string): string {
  const blocked = previewRedeemPart(inscription, origin);
  if (blocked) throw new Error(blocked);
  const id = localPartIdFromOrigin(origin)!;
  savePart({ ...structuredClone(inscription.part), id });
  const note = `${inscription.part.name} returns to the sculptor's bench.`;
  log(world, note);
  return note;
}

export function applyTogglePart(world: World, id: string): string | null {
  const part = listParts().find((candidate) => candidate.id === id);
  const person = playerPerson(world);
  if (!part || !person) return null;
  const look = person.look ?? { schema: LOOK_SCHEMA, cls: person.cls };
  const worn = look.parts ?? [];
  if (worn.includes(id)) {
    person.look = { ...look, parts: worn.filter((partId) => partId !== id) };
    return `${part.name} returns to the bench.`;
  }
  const sameSlot = new Set(listParts().filter((candidate) => candidate.slot === part.slot).map(({ id: partId }) => partId));
  person.look = { ...look, parts: [...worn.filter((partId) => !sameSlot.has(partId)), id] };
  return `${person.name} wears ${part.name}.`;
}
