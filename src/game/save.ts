import {
  BUILDING_META,
  CLASS_META,
  FAUNA_META,
  ITEM_META,
  NOTORIETY_META,
  NPC_META,
  SKILL_META,
  VOCATION_META,
} from "./catalog.ts";
import { WEATHER_META } from "./weather.ts";
import { generateTiles } from "./world.ts";
import {
  createResourceInventory,
  parseResourceInventory,
} from "./inventory/resources.ts";
import {
  createResourceNodeStateMap,
  parseResourceNodeStateMapAtHour,
  regrowResourceNodes,
} from "./resources/state.ts";
import type { World } from "./types.ts";

export const SAVE_KEY = "emberhall-save-v4";
export const CURRENT_SAVE_VERSION = 3;

type SaveRecord = Record<string, unknown>;

const INTENT_KINDS = new Set([
  "walk",
  "chop",
  "mine",
  "hunt",
  "skin",
  "loot",
  "gate",
  "tame",
  "cast",
  "plant",
  "harvest",
  "till",
  "none",
]);
const SPELL_IDS = new Set([
  "nightsight",
  "heal",
  "magicarrow",
  "teleport",
  "fireball",
  "mark",
  "recall",
]);
const CREATURE_TASKS = new Set(["wander", "flee", "fight", "follow", "dead", "idle"]);
const CROP_IDS = new Set(["cabbage", "wheat", "garlic"]);
const CROP_STAGES = new Set([0, 1, 2, 3]);
const SPEEDS = new Set([0, 1, 2, 3]);
const TILE_KINDS = new Set([
  "grass",
  "dirt",
  "cobble",
  "road",
  "tree",
  "rock",
  "water",
  "sand",
  "floor",
  "wall",
  "step",
  "pit",
  "snow",
  "marsh",
]);
const WEAR_SLOTS = new Set([
  "head",
  "chest",
  "cloak",
  "hands",
  "legs",
  "feet",
  "neck",
  "finger",
  "main",
  "off",
]);
const PILE_SOURCES = new Set(["drop", "corpse", "death"]);

function isRecord(value: unknown): value is SaveRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isArrayOf(value: unknown, validate: (item: unknown) => boolean): boolean {
  return Array.isArray(value) && value.every(validate);
}

function isNumberRecord(value: unknown): boolean {
  return isRecord(value) && Object.values(value).every(isFiniteNumber);
}

function isBooleanRecord(value: unknown): boolean {
  return isRecord(value) && Object.values(value).every(isBoolean);
}

function isRegistryKey(value: unknown, registry: object): value is string {
  return isString(value) && Object.hasOwn(registry, value);
}

function isNullableRegistryKey(value: unknown, registry: object): boolean {
  return value === null || isRegistryKey(value, registry);
}

function isClosedNumberRecord(value: unknown, registry: object): boolean {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([key, item]) => Object.hasOwn(registry, key) && isFiniteNumber(item),
    )
  );
}

function isItemRecord(value: unknown): boolean {
  return isClosedNumberRecord(value, ITEM_META);
}

function isWearRecord(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([slot, item]) => WEAR_SLOTS.has(slot) && isRegistryKey(item, ITEM_META),
    )
  );
}

function isRareWearRecord(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.entries(value).every(([slot, uid]) => WEAR_SLOTS.has(slot) && isString(uid))
  );
}

function isPoint(value: unknown): boolean {
  return isRecord(value) && isFiniteNumber(value.tx) && isFiniteNumber(value.ty);
}

function isNullablePoint(value: unknown): boolean {
  return value === null || isPoint(value);
}

function isIntent(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.kind) &&
    INTENT_KINDS.has(value.kind) &&
    isFiniteNumber(value.tx) &&
    isFiniteNumber(value.ty) &&
    isNullableString(value.targetId) &&
    (value.spell === null || (isString(value.spell) && SPELL_IDS.has(value.spell)))
  );
}

function isRecallMark(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isFiniteNumber(value.tx) &&
    isFiniteNumber(value.ty) &&
    isString(value.name)
  );
}

function isRareItem(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.uid) &&
    isRegistryKey(value.base, ITEM_META) &&
    isArrayOf(value.affixes, isString) &&
    (value.maker === undefined || isString(value.maker)) &&
    isFiniteNumber(value.seed) &&
    isFiniteNumber(value.hour)
  );
}

function isResourceInventory(value: unknown): boolean {
  try {
    parseResourceInventory(value);
    return true;
  } catch {
    return false;
  }
}

function isResourceNodeState(value: unknown, seed: unknown, hour: unknown): boolean {
  if (typeof seed !== "number" || !Number.isSafeInteger(seed) || typeof hour !== "number") return false;
  try {
    parseResourceNodeStateMapAtHour({ seed, hour, resourceNodes: value });
    return true;
  } catch {
    return false;
  }
}

function isPlayer(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isClosedNumberRecord(value.skills, SKILL_META) &&
    isClosedNumberRecord(value.lastGain, SKILL_META) &&
    isItemRecord(value.pack) &&
    Object.hasOwn(value, "resources") &&
    isResourceInventory(value.resources) &&
    isItemRecord(value.chest) &&
    isWearRecord(value.wear) &&
    isArrayOf(value.rares, isRareItem) &&
    isRareWearRecord(value.wearRare) &&
    isFiniteNumber(value.vault) &&
    isRegistryKey(value.notoriety, NOTORIETY_META) &&
    isFiniteNumber(value.criminalUntil) &&
    isIntent(value.intent) &&
    isFiniteNumber(value.mana) &&
    isFiniteNumber(value.nightSightUntil) &&
    (value.armedSpell === null ||
      (isString(value.armedSpell) && SPELL_IDS.has(value.armedSpell))) &&
    isArrayOf(value.marks, isRecallMark) &&
    isFiniteNumber(value.gateCoolUntil) &&
    isBoolean(value.ghost) &&
    isNullablePoint(value.corpseAt) &&
    isFiniteNumber(value.workT)
  );
}

function isPerson(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isRegistryKey(value.cls, CLASS_META) &&
    isBoolean(value.isPlayer) &&
    isBoolean(value.member) &&
    isNullableRegistryKey(value.role, NPC_META) &&
    isNullableRegistryKey(value.vocation, VOCATION_META) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.z) &&
    isFiniteNumber(value.facing) &&
    isFiniteNumber(value.hp) &&
    isFiniteNumber(value.maxHp) &&
    isFiniteNumber(value.hunger) &&
    isFiniteNumber(value.energy) &&
    isFiniteNumber(value.morale) &&
    isFiniteNumber(value.int) &&
    isFiniteNumber(value.str) &&
    isFiniteNumber(value.dex) &&
    isArrayOf(value.path, isPoint) &&
    isString(value.task) &&
    isFiniteNumber(value.taskUntil) &&
    isFiniteNumber(value.lingerUntil) &&
    isFiniteNumber(value.awayUntil) &&
    isNullablePoint(value.home) &&
    isFiniteNumber(value.bob) &&
    isBoolean(value.ghost)
  );
}

function isCreature(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isRegistryKey(value.kind, FAUNA_META) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.z) &&
    isFiniteNumber(value.hp) &&
    isFiniteNumber(value.maxHp) &&
    isArrayOf(value.path, isPoint) &&
    isString(value.task) &&
    CREATURE_TASKS.has(value.task) &&
    isFiniteNumber(value.taskUntil) &&
    isFiniteNumber(value.corpseUntil) &&
    isPoint(value.home) &&
    isNullableString(value.ownerId) &&
    isFiniteNumber(value.loyalty) &&
    isBoolean(value.stay) &&
    (value.name === undefined || isNullableString(value.name)) &&
    (value.warnedLoyal === undefined || isBoolean(value.warnedLoyal))
  );
}

function isGroundPile(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isFiniteNumber(value.tx) &&
    isFiniteNumber(value.ty) &&
    isItemRecord(value.items) &&
    isFiniteNumber(value.gold) &&
    isFiniteNumber(value.until) &&
    isString(value.source) &&
    PILE_SOURCES.has(value.source) &&
    isString(value.label)
  );
}

function isCampfire(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isFiniteNumber(value.tx) &&
    isFiniteNumber(value.ty) &&
    isFiniteNumber(value.until)
  );
}

function isBuilding(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isRegistryKey(value.kind, BUILDING_META) &&
    isFiniteNumber(value.tx) &&
    isFiniteNumber(value.ty) &&
    isArrayOf(value.beds, (bed) => isRecord(bed) && isNullableString(bed.occupantId))
  );
}

function isPlot(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isFiniteNumber(value.tx) &&
    isFiniteNumber(value.ty) &&
    (value.crop === null || (isString(value.crop) && CROP_IDS.has(value.crop))) &&
    isFiniteNumber(value.plantedHour) &&
    isFiniteNumber(value.stage) &&
    CROP_STAGES.has(value.stage)
  );
}

function isLogLine(value: unknown): boolean {
  return isRecord(value) && isFiniteNumber(value.t) && isString(value.text);
}

function isObjective(value: unknown): boolean {
  return isRecord(value) && isString(value.id) && isString(value.text) && isBoolean(value.done);
}

function isQuest(value: unknown): boolean {
  return isRecord(value) && isString(value.id) && isString(value.title);
}

function isWeather(value: unknown): boolean {
  return (
    isRecord(value) &&
    isRegistryKey(value.kind, WEATHER_META) &&
    isFiniteNumber(value.cloud) &&
    isFiniteNumber(value.wet) &&
    isFiniteNumber(value.wind) &&
    isFiniteNumber(value.untilHour) &&
    isFiniteNumber(value.rolls) &&
    isFiniteNumber(value.douseHour)
  );
}

function isScars(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (scar) =>
        isRecord(scar) &&
        isString(scar.kind) &&
        TILE_KINDS.has(scar.kind) &&
        (scar.h === undefined || isFiniteNumber(scar.h)),
    )
  );
}

function isStoredTiles(value: unknown): boolean {
  return (
    value === null ||
    isArrayOf(value, (row) =>
      isArrayOf(
        row,
        (tile) =>
          isRecord(tile) &&
          isFiniteNumber(tile.h) &&
          isString(tile.kind) &&
          TILE_KINDS.has(tile.kind),
      ),
    )
  );
}

/** Validate migrated data before any expensive derived-world generation. */
function isCurrentSave(save: SaveRecord): boolean {
  return (
    save.saveVersion === CURRENT_SAVE_VERSION &&
    typeof save.seed === "number" &&
    Number.isSafeInteger(save.seed) &&
    isFiniteNumber(save.hour) &&
    isFiniteNumber(save.speed) &&
    SPEEDS.has(save.speed) &&
    isFiniteNumber(save.gold) &&
    isFiniteNumber(save.prestige) &&
    isStoredTiles(save.tiles) &&
    isArrayOf(save.people, isPerson) &&
    isArrayOf(save.fauna, isCreature) &&
    isArrayOf(save.piles, isGroundPile) &&
    isArrayOf(save.campfires, isCampfire) &&
    isArrayOf(save.buildings, isBuilding) &&
    isArrayOf(save.plots, isPlot) &&
    isPlayer(save.player) &&
    isArrayOf(save.log, isLogLine) &&
    isArrayOf(save.objectives, isObjective) &&
    isArrayOf(save.quests, isQuest) &&
    isNumberRecord(save.rep) &&
    Object.hasOwn(save, "resourceNodes") &&
    isResourceNodeState(save.resourceNodes, save.seed, save.hour) &&
    isScars(save.scars) &&
    isBooleanRecord(save.seen) &&
    isFiniteNumber(save.seenRev) &&
    isFiniteNumber(save.landRev) &&
    isFiniteNumber(save.tickCount) &&
    isBoolean(save.restored) &&
    isWeather(save.weather) &&
    (save.boom === null || (isRecord(save.boom) && isFiniteNumber(save.boom.untilHour))) &&
    isNullableString(save.nightOffer)
  );
}

function migrateSave(value: unknown): SaveRecord | null {
  if (!isRecord(value)) return null;
  if (value.saveVersion === CURRENT_SAVE_VERSION) return value;
  if (value.saveVersion !== 1 && value.saveVersion !== 2) return null;

  // Clone once at the version boundary. Generic copies deliberately carry
  // every existing/optional nested field, including Person.look.
  const migrated = structuredClone(value);
  if (migrated.saveVersion === 1) {
    if (!isRecord(migrated.player)) return migrated;
    migrated.player = {
      ...migrated.player,
      resources: createResourceInventory(),
    };
    migrated.saveVersion = 2;
  }
  if (migrated.saveVersion === 2) {
    migrated.resourceNodes = createResourceNodeStateMap();
    migrated.saveVersion = 3;
  }
  return migrated;
}

export function hasSave() {
  try {
    return Boolean(localStorage.getItem(SAVE_KEY));
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function writeSave(world: World) {
  try {
    const resources = parseResourceInventory(world.player.resources);
    const resourceNodes = parseResourceNodeStateMapAtHour({
      seed: world.seed,
      hour: world.hour,
      resourceNodes: world.resourceNodes,
    });
    const { tiles: _tiles, player, ...rest } = world;
    const payload = {
      ...rest,
      resourceNodes,
      player: { ...player, resources },
      saveVersion: CURRENT_SAVE_VERSION,
      tiles: null,
    };
    if (!isCurrentSave(payload)) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    /* invalid runtime state or quota */
  }
}

export function loadSave(): World | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;

    const migrated = migrateSave(JSON.parse(raw));
    if (!migrated || !isCurrentSave(migrated)) {
      return null;
    }

    const { saveVersion: _saveVersion, ...storedWorld } = migrated;
    const data = storedWorld as unknown as World;
    data.resourceNodes = parseResourceNodeStateMapAtHour({
      seed: data.seed,
      hour: data.hour,
      resourceNodes: data.resourceNodes,
    });
    data.tiles = generateTiles(data.seed);
    if (data.scars) {
      for (const [key, scar] of Object.entries(data.scars)) {
        const [x, y] = key.split(",").map(Number);
        const tile = data.tiles[y!]?.[x!];
        if (tile && scar.kind) tile.kind = scar.kind;
        if (tile && scar.h != null) tile.h = scar.h;
      }
    }
    regrowResourceNodes(data);
    data.restored = true;
    return data;
  } catch {
    return null;
  }
}
