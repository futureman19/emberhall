import type { LookRecipeV1 } from "./look/types.ts";
import type {
  CraftedComponent,
  GemInlay,
  ItemFormId,
  ResolvedItemStats,
  Workmanship,
} from "./crafting/types.ts";
import type {
  QualityForResource,
  ResourceFormFor,
  ResourceId,
} from "./resources/types.ts";

export type TileKind =
  | "grass"
  | "dirt"
  | "cobble"
  | "road"
  | "tree"
  | "rock"
  | "water"
  | "sand"
  | "floor"
  | "wall"
  | "step"
  | "pit"
  | "snow"
  | "marsh";

export type BiomeId = "vale" | "tundra" | "taiga" | "fen" | "jungle" | "desert";

export type SkillId =
  | "swords"
  | "lumberjack"
  | "mining"
  | "anatomy"
  | "healing"
  | "cooking"
  | "smithing"
  | "carpentry"
  | "taming"
  | "magery"
  | "farming"
  | "forestry"
  // Placeholders — on the books, not yet taught. Mechanics arrive one
  // window at a time; until then they sit at zero and gain nothing.
  | "alchemy"
  | "archery"
  | "cartography"
  | "fencing"
  | "lockpicking"
  | "mace"
  | "music"
  | "poisoning"
  | "stealing"
  | "tailoring"
  | "tinkering"
  | "tracking";

export type ItemId =
  | "hatchet"
  | "knife"
  | "pick"
  | "hoe"
  | "log"
  | "board"
  | "ore"
  | "ingot"
  | "club"
  | "shield"
  | "staff"
  | "bow"
  | "torch"
  | "crate"
  | "cap"
  | "cuirass"
  | "sword"
  | "mace"
  | "gauntlets"
  | "gorget"
  | "heater"
  | "rabbit_foot"
  | "orc_tusk"
  | "meat"
  | "hide"
  | "bandage"
  | "tunic"
  | "leather"
  | "mail"
  | "hood"
  | "helm"
  | "cloak"
  | "gloves"
  | "hose"
  | "greaves"
  | "boots"
  | "pendant"
  | "ring"
  | "relic"
  | "spellbook"
  | "rune"
  | "garlic"
  | "ginseng"
  | "silk"
  | "nightshade"
  | "pearl"
  | "moss"
  | "mandrake"
  | "ash"
  | "cabbage"
  | "wheat"
  | "cooked_meat"
  | "bread"
  | "stew"
  | "cabbage_seed"
  | "wheat_seed"
  | "garlic_seed"
  | "acorn"
  | "deed_porch"
  | "deed_hut"
  | "deed_homestead";

export type WearSlot =
  | "head"
  | "chest"
  | "cloak"
  | "hands"
  | "legs"
  | "feet"
  | "neck"
  | "finger"
  | "main"
  | "off";

/**
 * UO-style resource tags — items carry descriptive labels (WOOD, METAL,
 * CLOTH...) and crafting/tool logic queries the tag, not the item id, so a
 * new material slots into every existing recipe with no script changes.
 * Material tags say what a thing IS; property tags say what it can DO.
 */
export type ResourceTag =
  | "wood"
  | "metal"
  | "cloth"
  | "leather"
  | "hide"
  | "meat"
  | "plant"
  | "reagent"
  | "gem"
  | "magic"
  | "food"
  | "seed"
  | "fuel"
  | "blade"
  | "weapon"
  | "armor"
  | "tool";

/**
 * A catalog-correlated material stack. Mapping over ResourceId keeps each
 * resource paired with only its own forms and quality vocabulary.
 */
export type ResourceStackKey = {
  [I in ResourceId]: `${I}:${ResourceFormFor<I>}:${QualityForResource<I>}`;
}[ResourceId];

/** Sparse by design: absent and zero are the same, and zero is never stored. */
export interface ResourceInventory {
  stacks: Partial<Record<ResourceStackKey, number>>;
}

/** Persistent metadata only; family and quality always resolve from Task 5. */
export interface ResourceNodeState {
  nodeId: string;
  tx: number;
  ty: number;
  nodeKind: "tree" | "rock";
  discoveredAtHour: number;
  depletedAtHour: number | null;
}

/** Sparse by canonical node id: undiscovered tiles have no entry. */
export type ResourceNodeStateMap = Record<string, ResourceNodeState>;

export type SpellId =
  | "nightsight"
  | "heal"
  | "magicarrow"
  | "teleport"
  | "fireball"
  | "mark"
  | "recall";

export type ClassId = "ranger" | "warrior" | "mage" | "rogue" | "merchant";
export type NpcRole = "banker" | "provisioner" | "healer";
export type FaunaKind =
  | "hare"
  | "hart"
  | "wolf"
  | "wight"
  | "brambleback_stag"
  | "ironwood_boar"
  | "pine_lynx"
  | "ember_fox"
  | "moss_badger"
  | "ridgeback_warg"
  | "thornhide_doe"
  | "mire_croaker"
  | "reedback_stalker"
  | "bog_toad"
  | "saltback_tortoise"
  | "brine_hound"
  | "dune_crawler"
  | "coal_salamander"
  | "orebeetle"
  | "stonecrawl_spider"
  | "greybarrow_wightling"
  | "barrow_hound"
  | "ashen_banshee"
  | "bonecrow"
  | "brine_troll"
  | "stonefang_ogre"
  | "orc_marauder";
export type BuildingKind =
  | "hall"
  | "dormitory"
  | "kitchen"
  | "yard"
  | "board"
  | "market"
  | "forge"
  | "tavern"
  | "notice"
  | "farm"
  | "bank"
  // Kingsford — the capital stamps these at world-gen; not player-buildable.
  | "keep"
  | "rampart"
  | "rampartV"
  | "tower"
  | "gatehouse"
  | "shop"
  | "townhome"
  | "townhouse"
  | "cottage"
  | "porch"
  | "hut"
  | "homestead";
export type VocationId = "cook" | "armourer" | "trader" | "recruiter" | "guard";
export type Notoriety = "innocent" | "criminal" | "murderer";
export type IntentKind = "walk" | "chop" | "mine" | "hunt" | "skin" | "loot" | "gate" | "tame" | "cast" | "plant" | "harvest" | "till" | "forest" | "none";
export type Speed = 0 | 1 | 2 | 3;
export type PanelId = "none" | "help" | "you" | "journal" | "vale" | "roster" | "build";
export type WeatherKind = "clear" | "fair" | "cloudy" | "rain" | "storm";

export interface WeatherState {
  kind: WeatherKind;
  /** Actual cover 0..1, eased toward the kind's target. */
  cloud: number;
  /** Ground wetness 0..1 — rises in rain, dries in wind and sun. */
  wet: number;
  /** Wind strength 0..1, eased. */
  wind: number;
  /** World hour the current regime ends. */
  untilHour: number;
  /** Regime rolls so far — seeds the deterministic scheduler. */
  rolls: number;
  /** World hour the held torch hisses out, 0 when not dousing. */
  douseHour: number;
}

export interface Tile {
  h: number;
  kind: TileKind;
}

export interface PathNode {
  tx: number;
  ty: number;
}

export interface Intent {
  kind: IntentKind;
  tx: number;
  ty: number;
  targetId: string | null;
  spell: SpellId | null;
}

export interface RecallMark {
  id: string;
  tx: number;
  ty: number;
  name: string;
}

export interface Person {
  id: string;
  name: string;
  cls: ClassId;
  isPlayer: boolean;
  member: boolean;
  look?: LookRecipeV1;
  role: NpcRole | null;
  vocation: VocationId | null;
  x: number;
  z: number;
  facing: number;
  hp: number;
  maxHp: number;
  hunger: number;
  energy: number;
  morale: number;
  int: number;
  str: number;
  dex: number;
  path: PathNode[];
  task: string;
  taskUntil: number;
  lingerUntil: number;
  awayUntil: number;
  home: { tx: number; ty: number } | null;
  bob: number;
  ghost: boolean;
}

export interface Creature {
  id: string;
  kind: FaunaKind;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  path: PathNode[];
  task: "wander" | "flee" | "fight" | "follow" | "dead" | "idle";
  taskUntil: number;
  corpseUntil: number;
  home: { tx: number; ty: number };
  ownerId: string | null;
  loyalty: number;
  stay: boolean;
  /** Given name (auto-named at the bond; rename anytime). */
  name?: string | null;
  /** One-time "looks restless" warning latch — feeding re-arms it. */
  warnedLoyal?: boolean;
}

export interface GroundPile {
  id: string;
  tx: number;
  ty: number;
  items: Partial<Record<ItemId, number>>;
  gold: number;
  until: number;
  source: "drop" | "corpse" | "death";
  label: string;
}

/** A campfire built in the field — a cooking station that burns out. */
export interface Campfire {
  id: string;
  tx: number;
  ty: number;
  /** World hour the fire dies to embers. */
  until: number;
}

export interface Building {
  id: string;
  kind: BuildingKind;
  tx: number;
  ty: number;
  beds: { occupantId: string | null }[];
  ownerId?: string | null;
  chest?: Record<ItemId, number>;
  chestGold?: number;
}

export type CropId = "cabbage" | "wheat" | "garlic";

export interface CropPlot {
  id: string;
  tx: number;
  ty: number;
  crop: CropId | null;
  plantedHour: number;
  stage: 0 | 1 | 2 | 3;
}

export interface Sapling {
  id: string;
  tx: number;
  ty: number;
  plantedHour: number;
  stage: 1 | 2 | 3;
  resourceId?: string;
}

export interface Objective {
  id: string;
  text: string;
  done: boolean;
}

export interface PlayerState {
  id: string;
  skills: Record<SkillId, number>;
  lastGain: Record<SkillId, number>;
  pack: Record<ItemId, number>;
  resources: ResourceInventory;
  chest: Record<ItemId, number>;
  wear: Partial<Record<WearSlot, ItemId>>;
  rares: RareItem[];
  wearRare: Partial<Record<WearSlot, string>>;
  vault: number;
  notoriety: Notoriety;
  criminalUntil: number;
  intent: Intent;
  mana: number;
  nightSightUntil: number;
  armedSpell: SpellId | null;
  marks: RecallMark[];
  gateCoolUntil: number;
  ghost: boolean;
  corpseAt: { tx: number; ty: number } | null;
  workT: number;
}

/**
 * A singular item: legacy/loot magic or an exact material-specific craft.
 * Mundane items remain fungible pack stacks; meaningful workmanship,
 * materials, provenance, and later gem inlays live on this instance path.
 */
export interface RareItem {
  uid: string;
  base: ItemId;
  affixes: string[];
  maker?: string;
  seed: number;
  hour: number;
  /** Present on material-specific crafted instances; absent on legacy/loot rares. */
  formId?: ItemFormId;
  workmanship?: Workmanship;
  components?: CraftedComponent[];
  inlays?: GemInlay[];
  resolvedStats?: ResolvedItemStats;
  recipeId?: string;
  recipeVersion?: number;
  source?: "crafted" | "loot" | "legacy";
}

export interface LogLine {
  t: number;
  text: string;
}

/** One possible find in a corpse — chance to appear, min–max count. */
export interface LootDrop {
  item: ItemId;
  chance: number;
  min: number;
  max: number;
}

/** A corpse's purse — chance to hold coin, min–max sats. */
export interface LootGold {
  chance: number;
  min: number;
  max: number;
}

export interface World {
  seed: number;
  hour: number;
  speed: Speed;
  gold: number;
  prestige: number;
  tiles: Tile[][];
  people: Person[];
  fauna: Creature[];
  piles: GroundPile[];
  campfires: Campfire[];
  buildings: Building[];
  plots: CropPlot[];
  saplings: Sapling[];
  plantedTimber: Record<string, string>;
  player: PlayerState;
  log: LogLine[];
  objectives: Objective[];
  quests: { id: string; title: string }[];
  rep: Record<string, number>;
  resourceNodes: ResourceNodeStateMap;
  scars: Record<string, { kind: TileKind; h?: number }>;
  seen: Record<string, boolean>;
  seenRev: number;
  landRev: number;
  tickCount: number;
  restored: boolean;
  weather: WeatherState;
  boom: { untilHour: number } | null;
  nightOffer: string | null;
}

export interface Snapshot {
  hour: number;
  day: number;
  clock: number;
  gold: number;
  prestige: number;
  speed: Speed;
  memberCount: number;
  visitorCount: number;
  people: Person[];
  buildings: Building[];
  plots: CropPlot[];
  saplings: Sapling[];
  quests: { id: string; title: string }[];
  log: LogLine[];
  rep: Record<string, number>;
  nightOffer: string | null;
  boom: { untilHour: number } | null;
  objectives: Objective[];
  restored: boolean;
  isNight: boolean;
  isDusk: boolean;
  weather: { kind: WeatherKind; cloud: number; wet: number; label: string };
  player: PlayerState;
  fauna: Creature[];
  piles: GroundPile[];
  campfires: Campfire[];
  landKey: string;
  region: string;
  youX: number;
  youZ: number;
  youPath: number;
  seenRev: number;
}

export type CtxKind = "tile" | "person" | "fauna" | "pile" | "pack" | "gate" | "building" | "plot";
export type CtxVerb =
  | "walk"
  | "chop"
  | "mine"
  | "hunt"
  | "skin"
  | "loot"
  | "talk"
  | "tame"
  | "stay"
  | "follow"
  | "release"
  | "feed"
  | "name"
  | "cast"
  | "fireball"
  | "teleport"
  | "enter"
  | "roster"
  | "bank"
  | "care"
  | "drop"
  | "take"
  | "use"
  | "harvest"
  | "till"
  | "sowCabbage"
  | "sowWheat"
  | "sowGarlic"
  | "sowAcorn"
  | "house";

export interface CtxTarget {
  kind: CtxKind;
  id: string;
  tx: number;
  ty: number;
  label: string;
}
