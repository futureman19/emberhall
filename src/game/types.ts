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
  | "pit";

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
  | "farming";

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
  | "cabbage_seed"
  | "wheat_seed"
  | "garlic_seed";

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
export type FaunaKind = "hare" | "hart" | "wolf" | "wight";
export type BuildingKind = "hall" | "dormitory" | "kitchen" | "yard" | "board" | "market" | "forge" | "tavern" | "notice" | "farm";
export type VocationId = "cook" | "armourer" | "trader" | "recruiter" | "guard";
export type Notoriety = "innocent" | "criminal" | "murderer";
export type IntentKind = "walk" | "chop" | "mine" | "hunt" | "skin" | "loot" | "gate" | "tame" | "cast" | "plant" | "harvest" | "till" | "none";
export type Speed = 0 | 1 | 2 | 3;
export type PanelId = "none" | "help" | "you" | "journal" | "vale" | "roster" | "build";

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

export interface Building {
  id: string;
  kind: BuildingKind;
  tx: number;
  ty: number;
  beds: { occupantId: string | null }[];
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
  chest: Record<ItemId, number>;
  wear: Partial<Record<WearSlot, ItemId>>;
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

export interface LogLine {
  t: number;
  text: string;
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
  buildings: Building[];
  plots: CropPlot[];
  player: PlayerState;
  log: LogLine[];
  objectives: Objective[];
  quests: { id: string; title: string }[];
  rep: Record<string, number>;
  scars: Record<string, { kind: TileKind; h?: number }>;
  seen: Record<string, boolean>;
  seenRev: number;
  landRev: number;
  tickCount: number;
  restored: boolean;
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
  quests: { id: string; title: string }[];
  log: LogLine[];
  rep: Record<string, number>;
  nightOffer: string | null;
  boom: { untilHour: number } | null;
  objectives: Objective[];
  restored: boolean;
  isNight: boolean;
  isDusk: boolean;
  player: PlayerState;
  fauna: Creature[];
  piles: GroundPile[];
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
  | "cast"
  | "fireball"
  | "teleport"
  | "enter"
  | "drop"
  | "take"
  | "use"
  | "harvest"
  | "till"
  | "sowCabbage"
  | "sowWheat"
  | "sowGarlic";

export interface CtxTarget {
  kind: CtxKind;
  id: string;
  tx: number;
  ty: number;
  label: string;
}
