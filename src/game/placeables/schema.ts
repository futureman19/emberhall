export const CREATOR_SCHEMA_VERSION = 1;
export const SIGN_TEXT_MAX = 80;
export const CREATOR_LEVEL_MAX = 8;
export const MATERIAL_SLOT_MAX = 8;
export const BLUEPRINT_OBJECT_MAX = 250;
export const STRUCTURE_OBJECT_MAX = 250;

export type Rotation = 0 | 1 | 2 | 3;

export interface PlacedObject {
  id: string;
  definitionId: string;
  definitionVersion: number;
  tx: number;
  ty: number;
  level: number;
  rotation: Rotation;
  materialSlots: Record<string, string>;
  ownerId: string;
  structureId: string | null;
  name: string | null;
  state: Record<string, unknown>;
}

export interface StructurePermissions {
  visit: "private" | "friends" | "public";
  use: "owner" | "members" | "visitors";
  build: "owner" | "members";
}

export interface Structure {
  id: string;
  name: string;
  ownerId: string;
  objectIds: string[];
  anchor: { tx: number; ty: number };
  permissions: StructurePermissions;
  revision: number;
}

export interface BlueprintObject {
  definitionId: string;
  definitionVersion: number;
  dx: number;
  dy: number;
  level: number;
  rotation: Rotation;
  materialSlots: Record<string, string>;
  state: Record<string, unknown>;
}

export interface ResourceRequirement {
  id: string;
  n: number;
}

export interface Blueprint {
  id: string;
  version: number;
  name: string;
  author: string;
  bounds: { w: number; d: number; h: number };
  objects: BlueprintObject[];
  billOfMaterials: ResourceRequirement[];
  tags: string[];
  thumbnail?: string;
}

export interface CreatorFields {
  placedObjects: PlacedObject[];
  structures: Structure[];
  blueprints: Blueprint[];
}

const ROTATIONS = new Set<number>([0, 1, 2, 3]);
const VISIT = new Set(["private", "friends", "public"]);
const USE = new Set(["owner", "members", "visitors"]);
const BUILD = new Set(["owner", "members"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInt(value: unknown, min: number, max: number): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= min && value <= max;
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

function isName(value: unknown, max = 48): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function isMaterialSlots(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (keys.length > MATERIAL_SLOT_MAX) return false;
  return keys.every((key) => isId(key) && isId(value[key]));
}

function isDoorState(value: unknown): boolean {
  return isRecord(value) && typeof value.open === "boolean" && Object.keys(value).length === 1;
}

function isSignState(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.text === "string" &&
    value.text.length <= SIGN_TEXT_MAX &&
    Object.keys(value).length === 1
  );
}

function isEmptyState(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length === 0;
}

export function isObjectState(value: unknown): boolean {
  if (!isRecord(value)) return false;
  for (const [key, item] of Object.entries(value)) {
    if (key === "door") {
      if (!isDoorState(item)) return false;
      continue;
    }
    if (key === "sign") {
      if (!isSignState(item)) return false;
      continue;
    }
    if (key === "chest" || key === "bed" || key === "hearth" || key === "bench" || key === "light" || key === "planter") {
      if (!isEmptyState(item)) return false;
      continue;
    }
    return false;
  }
  return true;
}

export function isPlacedObject(value: unknown): value is PlacedObject {
  if (!isRecord(value)) return false;
  return (
    isId(value.id) &&
    isId(value.definitionId) &&
    isInt(value.definitionVersion, 1, 999) &&
    isInt(value.tx, -1024, 1024) &&
    isInt(value.ty, -1024, 1024) &&
    isInt(value.level, 0, CREATOR_LEVEL_MAX) &&
    isFiniteNumber(value.rotation) &&
    ROTATIONS.has(value.rotation) &&
    isMaterialSlots(value.materialSlots) &&
    isId(value.ownerId) &&
    (value.structureId === null || isId(value.structureId)) &&
    (value.name === null || isName(value.name)) &&
    isObjectState(value.state)
  );
}

export function isStructure(value: unknown): value is Structure {
  if (!isRecord(value) || !isRecord(value.anchor) || !isRecord(value.permissions)) return false;
  if (!Array.isArray(value.objectIds) || value.objectIds.length > STRUCTURE_OBJECT_MAX) return false;
  return (
    isId(value.id) &&
    isName(value.name) &&
    isId(value.ownerId) &&
    value.objectIds.every(isId) &&
    isInt(value.anchor.tx, -1024, 1024) &&
    isInt(value.anchor.ty, -1024, 1024) &&
    typeof value.permissions.visit === "string" &&
    VISIT.has(value.permissions.visit) &&
    typeof value.permissions.use === "string" &&
    USE.has(value.permissions.use) &&
    typeof value.permissions.build === "string" &&
    BUILD.has(value.permissions.build) &&
    isInt(value.revision, 0, 1_000_000)
  );
}

function isBlueprintObject(value: unknown): value is BlueprintObject {
  if (!isRecord(value)) return false;
  return (
    isId(value.definitionId) &&
    isInt(value.definitionVersion, 1, 999) &&
    isInt(value.dx, -64, 64) &&
    isInt(value.dy, -64, 64) &&
    isInt(value.level, 0, CREATOR_LEVEL_MAX) &&
    isFiniteNumber(value.rotation) &&
    ROTATIONS.has(value.rotation) &&
    isMaterialSlots(value.materialSlots) &&
    isObjectState(value.state)
  );
}

function isRequirement(value: unknown): value is ResourceRequirement {
  return isRecord(value) && isId(value.id) && isInt(value.n, 0, 9999);
}

export function isBlueprint(value: unknown): value is Blueprint {
  if (!isRecord(value) || !isRecord(value.bounds)) return false;
  if (!Array.isArray(value.objects) || value.objects.length > BLUEPRINT_OBJECT_MAX) return false;
  if (!Array.isArray(value.billOfMaterials) || !Array.isArray(value.tags)) return false;
  if (value.thumbnail !== undefined && (typeof value.thumbnail !== "string" || value.thumbnail.length > 8000)) {
    return false;
  }
  return (
    isId(value.id) &&
    isInt(value.version, 1, 999) &&
    isName(value.name) &&
    isName(value.author) &&
    isInt(value.bounds.w, 1, 64) &&
    isInt(value.bounds.d, 1, 64) &&
    isInt(value.bounds.h, 1, CREATOR_LEVEL_MAX + 1) &&
    value.objects.every(isBlueprintObject) &&
    value.billOfMaterials.every(isRequirement) &&
    value.tags.every((tag) => isId(tag))
  );
}

export function emptyCreatorFields(): CreatorFields {
  return { placedObjects: [], structures: [], blueprints: [] };
}

export function parseCreatorFields(value: unknown): CreatorFields | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.placedObjects) || !Array.isArray(value.structures) || !Array.isArray(value.blueprints)) {
    return null;
  }
  if (!value.placedObjects.every(isPlacedObject)) return null;
  if (!value.structures.every(isStructure)) return null;
  if (!value.blueprints.every(isBlueprint)) return null;
  return {
    placedObjects: value.placedObjects,
    structures: value.structures,
    blueprints: value.blueprints,
  };
}
