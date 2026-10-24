// Procedural item glyphs — one bold silhouette per family on a 24×24 grid.
// Body fills with the item's own color; accent draws in a contrasting tone.
// Hand-authored, dependency-free, and reviewed like any other code: an icon
// is a path string, not an asset pipeline. Direland-grade readability comes
// from the shape language (big, flat, chunky), not from painted detail.
import type { MaterialQuality } from "../../game/resources/types.ts";
import type { TechniqueId } from "../../game/techniques.ts";
import type { ItemId, WearSlot } from "../../game/types.ts";

export type IconKind =
  | "axe" | "knife" | "pick" | "hoe" | "rod" | "log" | "board" | "ore" | "ingot"
  | "club" | "shield" | "staff" | "bow" | "torch" | "crate" | "helm" | "armor"
  | "sword" | "mace" | "gloves" | "gorget" | "charm" | "tusk" | "meat" | "arrows"
  | "hide" | "bandage" | "potion" | "tunic" | "hood" | "cloak" | "legs" | "boots"
  | "pendant" | "ring" | "relic" | "book" | "rune" | "herb" | "mushroom" | "moss"
  | "silk" | "pearl" | "ash" | "cabbage" | "fish" | "bread" | "bowl" | "wheat"
  | "seed" | "acorn" | "scroll" | "cloth" | "bone" | "gem"
  | "lunge" | "riposte" | "cleave" | "aim" | "volley" | "mark"
  | "flurry" | "hamstring" | "veinfind" | "bash" | "sunder" | "doomblow";

export interface IconGlyph {
  readonly body: string;
  readonly accent?: string;
}

export const ICON_PATHS: Readonly<Record<IconKind, IconGlyph>> = {
  axe: { body: "M7 2h2.6v15.4H7z", accent: "M9.6 3.2c4.6 0 8 3 8.6 6.8-3 1.2-6.6.6-8.6-1.4z" },
  knife: { body: "M5 3c6 1 10 5 12 11l-3 3C9 14 6 9 5 3z", accent: "M14.5 17.5l2.5-2.5 3 3-2.5 2.5z" },
  pick: { body: "M8 4h2.4v17H8z", accent: "M3 7c5-4 13-4 18 0l-1.8 1.8C15 6 9 6 4.8 8.8z" },
  hoe: { body: "M8 3h2.4v18H8z", accent: "M10.4 4c5 0 8 2 8.6 6l-2.2.8c-.6-3-3-4.6-6.4-4.8z" },
  rod: { body: "M4 20L16 3l1.6 1L6 21.4z", accent: "M16.2 4.2c2.8 1 4.3 3 4.3 5.8l-1.8.2c0-2.2-1-3.6-2.8-4.6z" },
  log: { body: "M3 9h15a3 3 0 010 6H3a3 3 0 010-6z", accent: "M6 10.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" },
  board: { body: "M4 5h16v5H4zM4 14h16v5H4z", accent: "M6 7.2h8v1.2H6zM8 16.2h8v1.2H8z" },
  ore: { body: "M7 6l5-3 6 4 2 6-4 6H8l-4-5z", accent: "M10 9l2.5-1.5L15 9l-1 3h-3z" },
  ingot: { body: "M4 17l2.5-7h11L20 17z", accent: "M8 13h8v1.6H8z" },
  club: { body: "M8.8 12h2.4v9.4H8.8z", accent: "M6.4 2.6h7.2a2 2 0 012 2v5.4a2 2 0 01-2 2H6.4a2 2 0 01-2-2V4.6a2 2 0 012-2z" },
  shield: { body: "M12 2l8 2.6v6.2c0 5.2-3.4 9-8 11.2-4.6-2.2-8-6-8-11.2V4.6z", accent: "M12 4.6l5.4 1.8v4.4c0 3.6-2.2 6.4-5.4 8.2z" },
  staff: { body: "M11 6h2v15h-2z", accent: "M12 1.4a2.4 2.4 0 110 4.8 2.4 2.4 0 010-4.8z" },
  bow: { body: "M6 2c7 3 7 17 0 20l-1.4-1.4C10 18 10 6.8 4.6 3.4z", accent: "M5.2 3.8L17.4 12 5.2 20.2l.8-1.4L15.4 12 6 5.2z" },
  torch: { body: "M10.6 9.4h2.8V21h-2.8z", accent: "M12 2c2.6 2 3.6 4 2.6 6.4-1 .9-2.6.9-3.6 0C10 6 10.8 3.8 12 2z" },
  crate: { body: "M4 6h16v14H4z", accent: "M4 11h16v2H4zM11 6h2v14h-2z" },
  helm: { body: "M6 10a6 6 0 0112 0v8h-3.4v-4H9.4v4H6z", accent: "M11 13.6h2v3h-2z" },
  armor: { body: "M8 3l4 1.6L16 3l3 4-2.4 2v12H7.4V9L5 7z", accent: "M11.2 5h1.6v15h-1.6z" },
  sword: { body: "M12 2l1.8 2v9.6h-3.6V4z", accent: "M7 14.6h10v2H7zM11 16.6h2V21h-2z" },
  mace: { body: "M11 9h2v12h-2z", accent: "M12 1.6a4.4 4.4 0 100 8.8 4.4 4.4 0 000-8.8z" },
  gloves: { body: "M8 3h6a3 3 0 013 3v5h2v4l-2.6 6H8.6L5 15V7a4 4 0 013-4z", accent: "M14 8h3.4v3H14z" },
  gorget: { body: "M4 6a8 3.6 0 0016 0v4a8 3.6 0 01-16 0z", accent: "M10 10.4h4v3.2h-4z" },
  charm: { body: "M10 2h4v6l2 4v6a4 4 0 01-8 0v-6l2-4z", accent: "M10 2h4v3h-4z" },
  tusk: { body: "M4 20C4 10 10 4 20 4c-2 8-8 14-16 16z", accent: "M6.8 17.2c1-4.6 4.3-8 9-9.6-1.8 4.2-4.8 7.4-9 9.6z" },
  meat: { body: "M7 8a5 4.4 0 015-4.4A5 4.4 0 0117 8c2 1 3 2.4 3 4a4 4 0 01-4 4H8a4 4 0 01-4-4c0-1.6 1-3 3-4z", accent: "M4.6 19.4l1.8-1.8 2.4 2.4-1.8 1.8z" },
  arrows: { body: "M5.4 18.6L14.7 9.3l1 1-9.3 9.3zM8.4 18.6l9.3-9.3 1 1-9.3 9.3z", accent: "M14.6 5l4 4-1.5 1.5-4-4zM17.6 8l3 3-1.5 1.5-3-3z" },
  hide: { body: "M6 3l4 2h4l4-2 2 5-3 2v11H7V10L4 8z", accent: "M10 12h4v2h-4z" },
  bandage: { body: "M15 6a4 4 0 014 4v6H9a4 4 0 01-4-4v-2a4 4 0 014-4z", accent: "M9 10h2v2H9zM13 10h2v2h-2zM11 13h2v2h-2z" },
  potion: { body: "M10 2h4v4l3 4v8a2 2 0 01-2 2H9a2 2 0 01-2-2v-8l3-4z", accent: "M8 12h8v6H8z" },
  tunic: { body: "M8 3l4 2 4-2 4 4-3 3v10H7V10L4 7z", accent: "M10 3.6a2 2.4 0 004 0z" },
  hood: { body: "M12 2a7 7 0 017 7v9h-4l-3-3-3 3H5V9a7 7 0 017-7z", accent: "M9 9a3 3 0 016 0v3H9z" },
  cloak: { body: "M8 3h8l4 6-2 12H6L4 9z", accent: "M11 3h2v4h-2z" },
  legs: { body: "M7 3h10l1 9h-4l-1 9h-3l-1-9H6z", accent: "M7 3h10v2.4H7z" },
  boots: { body: "M6 3h5v9l6 2v4H6z", accent: "M6 15.6h11v2H6z" },
  pendant: { body: "M7 3l5 6 5-6 1.5 1.5L12 12l-6.5-7.5z", accent: "M12 12.4a3.2 3.2 0 100 6.4 3.2 3.2 0 000-6.4z" },
  ring: { body: "M12 7a5.5 5.5 0 100 11 5.5 5.5 0 000-11zm0 3a2.5 2.5 0 110 5 2.5 2.5 0 010-5z", accent: "M10 3h4l-1 4h-2z" },
  relic: { body: "M8 4h8v3l-1.5 2v9a2.5 2.5 0 01-5 0V9L8 7z", accent: "M10 11h4v1.6h-4z" },
  book: { body: "M5 3h11a3 3 0 013 3v15H8a3 3 0 01-3-3z", accent: "M8 6h7v2H8zM8 10h5v2H8z" },
  rune: { body: "M7 4h10l2 8-7 8-7-8z", accent: "M11 8h2v5h-2zM10 13.6h4v1.8h-4z" },
  herb: { body: "M11 8C7.4 8 4.6 5.6 4.6 2.4 8.2 2.4 11 4.8 11 8zm2 0c3.6 0 6.4-2.4 6.4-5.6-3.6 0-6.4 2.4-6.4 5.6z", accent: "M11 8h2v13h-2zM8 14.4c2.4 0 4 1.2 4 3-2.4 0-4-1.2-4-3z" },
  mushroom: { body: "M12 3a8 6 0 018 6H4a8 6 0 018-6z", accent: "M10 9h4v9a2 2 0 01-4 0z" },
  moss: { body: "M7 15.2a3.4 3.4 0 100-6.8 3.4 3.4 0 000 6.8zm6-2.2a4 4 0 100-8 4 4 0 000 8zm6 4.2a3 3 0 100-6 3 3 0 000 6z", accent: "M8.6 16.6h8v1.6h-8z" },
  silk: { body: "M12 3a9 9 0 100 18 9 9 0 000-18zm0 3a6 6 0 110 12 6 6 0 010-12z", accent: "M11 3h2v18h-2zM3 11h18v2H3z" },
  pearl: { body: "M12 6a6 6 0 100 12 6 6 0 000-12z", accent: "M8.8 10.2a2.2 2.2 0 012.6-2z" },
  ash: { body: "M6 18c-2-3-1-6 2-7 0-3 2-5 4-5s4 2 4 5c3 1 4 4 2 7z", accent: "M10 14c1 1 3 1 4 0v2c-1 1-3 1-4 0z" },
  cabbage: { body: "M12 5a7 7 0 100 14 7 7 0 000-14z", accent: "M11 5h2v14h-2zM5.4 10.4c3.4 1.8 9.8 1.8 13.2 0l.4 1.6c-3.8 2-10.2 2-14 0z" },
  fish: { body: "M2 12c4-4.6 8.6-6 13-5l5-3v16l-5-3c-4.4 1-9-.4-13-5z", accent: "M6.5 10.5a1.3 1.3 0 102.6 0 1.3 1.3 0 00-2.6 0z" },
  bread: { body: "M4 10a8 5 0 0116 0v6a2 2 0 01-2 2H6a2 2 0 01-2-2z", accent: "M8 8l1.5 2-.9.7L7 8.7zM12 7.6l1.5 2-.9.7-1.5-2zM16 8l1.5 2-.9.7-1.5-2z" },
  bowl: { body: "M4 11h16a8 8 0 01-16 0z", accent: "M9 8c0-2 2-2 2-4l1 .6c-1 2-2 2.4-2 3.4zM13 8c0-2 2-2 2-4l1 .6c-1 2-2 2.4-2 3.4z" },
  wheat: { body: "M11 9h2v12h-2z", accent: "M12 2l2 3-2 3-2-3zM8 5.4l3 2-1 3-3-2zM16 5.4l-3 2 1 3 3-2z" },
  seed: { body: "M8 12a3 4 0 016 0 3 4 0 01-6 0z", accent: "M15 6a2.4 3 0 100 6 2.4 3 0 000-6zM6 5a2 2.6 0 104 0 2 2.6 0 00-4 0z" },
  acorn: { body: "M12 8a5.5 6 0 00-5.5 6c0 3.4 2.5 6 5.5 6s5.5-2.6 5.5-6A5.5 6 0 0012 8z", accent: "M6 8a6 3 0 0112 0v1H6zM11 3h2v3h-2z" },
  scroll: { body: "M5 4h11v14H8a3 3 0 01-3-3z", accent: "M16 4a2.5 2.5 0 012.5 2.5V18h-2.5zM8 7h5v1.6H8zM8 10.5h5v1.6H8z" },
  cloth: { body: "M5 6h14v4H5zM5 12h14v4a2 2 0 01-2 2H7a2 2 0 01-2-2z", accent: "M8 7.4h8v1.2H8zM8 13.4h8v1.2H8z" },
  bone: { body: "M5.2 5.2a2.7 2.7 0 014-1l9.6 9.6a2.7 2.7 0 11-4 4L5.2 8.2a2.7 2.7 0 010-3z" },
  gem: { body: "M7 4h10l4 5-9 12L3 9z", accent: "M7 4l5 5 5-5 .9 1.2L12 10.4 6.1 5.2zM3 9h18v1.6H3z" },
  // Technique moves — warrior glyphs for the combat chips row.
  lunge: { body: "M2 11h13v2H2zM3 7v10h2V7z", accent: "M15 9l7 3-7 3z" },
  riposte: { body: "M4 20C4 10 10 4 20 4l-1 3C12 7 7 12 7 20z", accent: "M13 13l8 8-2 1-7-8z" },
  cleave: { body: "M10 2h4l-1 20h-2z", accent: "M2 6l7 5-1 2-7-5zM22 6l-7 5 1 2 7-5z" },
  aim: { body: "M12 3a9 9 0 100 18 9 9 0 000-18zm0 3a6 6 0 110 12 6 6 0 010-12z", accent: "M11 1h2v6h-2zM11 17h2v6h-2zM1 11h6v2H1zM17 11h6v2h-6z" },
  volley: { body: "M12 2l9 10h-3.5L12 6.5 6.5 12H3z", accent: "M12 11l9 10h-3.5L12 15.5 6.5 21H3z" },
  mark: { body: "M12 4l2.5 5.5L20 12l-5.5 2.5L12 20l-2.5-5.5L4 12l5.5-2.5z", accent: "M10.5 10.5h3v3h-3z" },
  flurry: { body: "M5 2l3-1 9 14-3 1z", accent: "M12 3l2-1 8 12-2 1zM17 4l2-1 6 9-1 1z" },
  hamstring: { body: "M2 15l14 6-1 2L2 18z", accent: "M4 8l2 3-1.5.5L3 9zM8 6l2 3-1.5.5L7 7z" },
  veinfind: { body: "M4 3l2-1 10 12-2 2z", accent: "M17 15s3 3.2 3 5a3 3 0 01-6 0c0-1.8 3-5 3-5z" },
  bash: { body: "M11 8h2v13h-2z", accent: "M7 2h10v6H7zM4 10l3 2-3 2zM20 10l-3 2 3 2z" },
  sunder: { body: "M12 2l8 3v6c0 6-3.5 9.5-8 11-4.5-1.5-8-5-8-11V5z", accent: "M12 4l-2 5 3 3-2 5 2 3 1-3 2-5-3-3z" },
  doomblow: { body: "M11 2h2l3 12-4 8-4-8z", accent: "M4 20h16v2H4zM6 16l2 2-1 1-2-2zM18 16l-2 2 1 1 2-2z" },
};

export const ITEM_ICON_KIND: Readonly<Record<ItemId, IconKind>> = {
  furnace_heart: "ore",
  hatchet: "axe",
  knife: "knife",
  pick: "pick",
  hoe: "hoe",
  fishing_rod: "rod",
  log: "log",
  board: "board",
  ore: "ore",
  ingot: "ingot",
  club: "club",
  shield: "shield",
  staff: "staff",
  bow: "bow",
  torch: "torch",
  crate: "crate",
  cap: "helm",
  cuirass: "armor",
  sword: "sword",
  mace: "mace",
  gauntlets: "gloves",
  gorget: "gorget",
  heater: "shield",
  rabbit_foot: "charm",
  orc_tusk: "tusk",
  meat: "meat",
  arrows: "arrows",
  hide: "hide",
  bandage: "bandage",
  potion_heal: "potion",
  potion_night: "potion",
  tunic: "tunic",
  leather: "tunic",
  mail: "armor",
  hood: "hood",
  helm: "helm",
  cloak: "cloak",
  gloves: "gloves",
  hose: "legs",
  greaves: "legs",
  boots: "boots",
  pendant: "pendant",
  ring: "ring",
  relic: "relic",
  spellbook: "book",
  rune: "rune",
  garlic: "herb",
  ginseng: "herb",
  silk: "silk",
  nightshade: "mushroom",
  pearl: "pearl",
  moss: "moss",
  mandrake: "herb",
  ash: "ash",
  cabbage: "cabbage",
  cooked_meat: "meat",
  raw_fish: "fish",
  cooked_fish: "fish",
  bread: "bread",
  stew: "bowl",
  wheat: "wheat",
  cabbage_seed: "seed",
  wheat_seed: "seed",
  garlic_seed: "seed",
  ginseng_seed: "seed",
  mandrake_seed: "seed",
  moss_seed: "seed",
  acorn: "acorn",
  deed_porch: "scroll",
  deed_hut: "scroll",
  deed_homestead: "scroll",
};

/** Resource families reuse the same silhouettes, tinted by the family's palette. */
export const RESOURCE_ICON_KIND: Readonly<Record<"timber" | "ore" | "fiber" | "hide" | "bone" | "gem", IconKind>> = {
  timber: "log",
  ore: "ore",
  fiber: "cloth",
  hide: "hide",
  bone: "bone",
  gem: "gem",
};

/** Technique chips reuse the silhouette language: one move glyph per move. */
export const TECHNIQUE_ICON_KIND: Readonly<Record<TechniqueId, IconKind>> = {
  lunge: "lunge",
  riposte: "riposte",
  cleave: "cleave",
  aimed_shot: "aim",
  double_loose: "volley",
  hunters_mark: "mark",
  flurry: "flurry",
  hamstring: "hamstring",
  veinfind: "veinfind",
  bash: "bash",
  sunder: "sunder",
  doomblow: "doomblow",
};

/** Empty gear slots show the slot's glyph — symbols, not words (Direland doll). */
export const SLOT_ICON_KIND: Readonly<Record<WearSlot, IconKind>> = {
  head: "helm",
  neck: "pendant",
  chest: "armor",
  cloak: "cloak",
  finger: "ring",
  main: "sword",
  off: "shield",
  hands: "gloves",
  legs: "legs",
  feet: "boots",
};

/** Grid-cell ring per material quality — grade at a glance: plain for
 *  rough/cracked, accent mid-tier, gold for choice and beyond. */
export const GRADE_RING: Readonly<Record<MaterialQuality, string>> = {
  rough: "border-border",
  sound: "border-accent/60",
  choice: "border-gold/70",
  pristine: "border-gold",
  cracked: "border-border",
  flawed: "border-accent/60",
  cut: "border-gold/70",
  flawless: "border-gold/85",
  perfect: "border-gold",
};
