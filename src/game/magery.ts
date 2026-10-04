import { emitSpellEffect, spellEffects } from "./spell-effects.ts";
import { PLACES, regionAt } from "./atlas.ts";
import { BLAST_RADIUS, BLESS_HOURS, CHAIN_FALLOFF, CHAIN_MAX, CHAIN_RANGE, CHILL_HOURS, CURSE_HOURS, FAUNA_META, FLASH_RADIUS, INVIS_HOURS, IRONWOOD_HOURS, ITEM_META, METEOR_RADIUS, PARALYZE_HOURS, POISON_FAUNA_HOURS, POISON_TICK_HOURS, BLIND_HOURS, SECONDS_PER_HOUR, SLEEP_HOURS, SNARE_HOURS, SNARE_TICK_HOURS, SUMMON_HOURS } from "./catalog.ts";
import { letGo, markAsleep, spawn } from "./ecology.ts";
import { astarToRange, nearestWalkable, tileOf } from "./pathfinding.ts";
import { spawnCorpsePile } from "./piles.ts";
import { rareName, rollKillRare } from "./rare.ts";
import { successChance, tryGain } from "./skills.ts";
import { playSfx, type SfxId } from "./vale-sfx.ts";
import { completeObjective, log, nid, revealAround } from "./world.ts";
import type { ItemId, Person, RecallMark, SpellId, World } from "./types.ts";

export const SPELL_ORDER: SpellId[] = [
  "nightsight", "heal", "magicarrow", "teleport", "fireball", "cure", "poison", "bless", "lightning", "summon", "paralyze", "invisibility", "curse", "mark", "recall",
  "thornsnare", "ironwood", "leech", "flash", "fireblast", "blizzard", "chainlightning", "sleep", "meteor",
];

export const SPELL_CIRCLES: { circle: number; label: string; ids: SpellId[] }[] = [
  { circle: 1, label: "First circle", ids: ["nightsight", "heal", "magicarrow"] },
  { circle: 2, label: "Second", ids: ["teleport", "fireball", "cure", "poison", "thornsnare"] },
  { circle: 3, label: "Third", ids: ["bless", "lightning", "ironwood", "leech", "flash"] },
  { circle: 4, label: "Fourth", ids: ["summon", "paralyze", "invisibility", "curse", "fireblast", "blizzard", "chainlightning", "sleep"] },
  { circle: 6, label: "Sixth", ids: ["meteor"] },
];

export const SPELL_META: Record<
  SpellId,
  { label: string; circle: number; diff: number; mana: number; reagents: ItemId[]; words: string; target: "self" | "fauna" | "person" | "tile" | "mark"; hint: string }
> = {
  nightsight: { label: "Night Sight", circle: 1, diff: 8, mana: 4, reagents: ["silk", "ash"], words: "In Lor", target: "self", hint: "See as if dusk." },
  heal: { label: "Heal", circle: 1, diff: 8, mana: 6, reagents: ["garlic", "ginseng", "silk"], words: "In Mani", target: "person", hint: "Close a wound." },
  magicarrow: { label: "Magic Arrow", circle: 1, diff: 8, mana: 5, reagents: ["pearl"], words: "In Por Ylem", target: "fauna", hint: "A dart of force." },
  teleport: { label: "Teleport", circle: 2, diff: 12, mana: 8, reagents: ["pearl", "mandrake"], words: "Rel Por", target: "tile", hint: "A few paces. Click the ground." },
  fireball: { label: "Fireball", circle: 2, diff: 14, mana: 9, reagents: ["pearl", "mandrake"], words: "Vas Flam", target: "fauna", hint: "A heavier dart." },
  cure: { label: "Cure", circle: 2, diff: 10, mana: 6, reagents: ["garlic", "ginseng"], words: "An Nox", target: "self", hint: "Draw the venom out." },
  poison: { label: "Poison", circle: 2, diff: 12, mana: 8, reagents: ["nightshade"], words: "In Nox", target: "fauna", hint: "Venom that keeps its teeth." },
  bless: { label: "Bless", circle: 3, diff: 13, mana: 9, reagents: ["garlic", "mandrake"], words: "Rel Sanct", target: "self", hint: "The blade and the breast, lifted." },
  lightning: { label: "Lightning", circle: 3, diff: 14, mana: 9, reagents: ["ash", "pearl"], words: "Por Ort Grav", target: "fauna", hint: "The sky answers at once." },
  summon: { label: "Summon Creature", circle: 4, diff: 16, mana: 14, reagents: ["mandrake", "moss", "silk"], words: "Kal Xen", target: "self", hint: "A vale-beast bound to your side." },
  paralyze: { label: "Paralyze", circle: 4, diff: 14, mana: 10, reagents: ["nightshade", "silk"], words: "An Ex Por", target: "fauna", hint: "Lock a beast mid-stride." },
  invisibility: { label: "Invisibility", circle: 4, diff: 14, mana: 10, reagents: ["nightshade", "moss"], words: "An Lor Xen", target: "self", hint: "The world forgets your shape." },
  curse: { label: "Curse", circle: 4, diff: 14, mana: 10, reagents: ["nightshade", "garlic", "silk"], words: "Des Sanct", target: "fauna", hint: "Sour a beast's strength." },
  mark: { label: "Mark", circle: 3, diff: 8, mana: 8, reagents: ["pearl", "moss", "mandrake"], words: "Kal Por Ylem", target: "self", hint: "Write this dirt on a rune." },
  recall: { label: "Recall", circle: 3, diff: 8, mana: 9, reagents: ["pearl", "moss", "mandrake"], words: "Kal Ort Por", target: "mark", hint: "Tap a mark. Walk off first." },
  thornsnare: { label: "Thorn Snare", circle: 2, diff: 11, mana: 7, reagents: ["nightshade", "moss"], words: "An Xen", target: "fauna", hint: "Thorns hold and bite." },
  ironwood: { label: "Ironwood", circle: 3, diff: 13, mana: 9, reagents: ["mandrake", "garlic"], words: "Rel Tym", target: "self", hint: "Skin like old bark." },
  leech: { label: "Leech", circle: 3, diff: 13, mana: 9, reagents: ["nightshade", "pearl"], words: "Des Mani", target: "fauna", hint: "Their wound, your blood." },
  flash: { label: "Flash", circle: 3, diff: 13, mana: 9, reagents: ["pearl", "ash"], words: "In Lor Vas", target: "self", hint: "Blind everything near." },
  fireblast: { label: "Fire Blast", circle: 4, diff: 15, mana: 12, reagents: ["ash", "pearl", "mandrake"], words: "Vas Flam Ort", target: "tile", hint: "A ring of fire. Click the ground." },
  blizzard: { label: "Blizzard", circle: 4, diff: 15, mana: 12, reagents: ["pearl", "ash", "moss"], words: "Vas Glaciem", target: "tile", hint: "Cold that slows. Click the ground." },
  chainlightning: { label: "Chain Lightning", circle: 4, diff: 16, mana: 13, reagents: ["ash", "pearl", "mandrake"], words: "Por Ort Grav Vas", target: "fauna", hint: "The bolt arcs to the pack." },
  sleep: { label: "Sleep", circle: 4, diff: 14, mana: 10, reagents: ["nightshade", "mandrake"], words: "In Zu", target: "fauna", hint: "It drifts off — until wounded." },
  meteor: { label: "Meteor", circle: 6, diff: 20, mana: 18, reagents: ["ash", "mandrake", "pearl", "nightshade"], words: "Vas Flam Grav", target: "tile", hint: "The sky falls. Click the ground." },
};

export const ARROW_RANGE = 14;
export const FIREBALL_RANGE = 16;
export const TELEPORT_RANGE = 10;
export const MARK_CAP = 8;
/** Spells that strike (or hex) a beast downrange. */
export const OFFENSIVE_SPELLS: ReadonlySet<SpellId> = new Set(["magicarrow", "fireball", "poison", "lightning", "paralyze", "curse", "thornsnare", "leech", "chainlightning", "sleep"]);
/** Spells that ruin the ground itself — armed, then released on a clicked tile. */
export const TILE_OFFENSIVE_SPELLS: ReadonlySet<SpellId> = new Set(["fireblast", "blizzard", "meteor"]);

/** Every spell has its own voice — the windup "cast" hum is shared, the
 * release is not. Fizzle keeps its own sad sputter. */
export function spellSfx(spell: SpellId): SfxId {
  return `spell_${spell}`;
}

export type CastTarget =
  | { kind: "fauna" | "person" | "self"; id?: string }
  | { kind: "tile"; tx: number; ty: number }
  | { kind: "mark"; id: string };

export interface CastFx {
  spell: SpellId;
  x: number;
  z: number;
  tx: number;
  tz: number;
  at: number;
}

export function getCastFx(world: World, slot = 0) {
  const fx = spellEffects(world)[slot];
  return fx?.outcome === "success" ? fx : null;
}

export interface FizzleFx {
  spell: SpellId;
  x: number;
  z: number;
  at: number;
}

export function getFizzleFx(world: World, slot = 0) {
  const fx = spellEffects(world)[slot];
  return fx?.outcome === "fizzle" ? fx : null;
}

export interface DeathFx {
  x: number;
  z: number;
  at: number;
}
let deathFx: DeathFx | null = null;
export function getDeathFx() {
  return deathFx;
}
export function burstDeath(x: number, z: number, at: number) {
  deathFx = { x, z, at };
}

function self(world: World): Person | null {
  return world.people.find((p) => p.isPlayer) ?? world.people.find((p) => p.id === world.player.id) ?? null;
}

export function maxMana(intel: number, magery: number) {
  return Math.max(8, Math.floor(12 + intel + magery / 4));
}

export function hasBook(world: World) {
  return (world.player.pack.spellbook ?? 0) > 0;
}

function missingReagent(world: World, spell: SpellId): ItemId | null {
  for (const id of SPELL_META[spell].reagents) {
    if ((world.player.pack[id] ?? 0) < 1) return id;
  }
  return null;
}

function takeReagents(world: World, spell: SpellId) {
  for (const id of SPELL_META[spell].reagents) {
    world.player.pack[id] = Math.max(0, (world.player.pack[id] ?? 0) - 1);
  }
}

export function tickMana(world: World, dt: number) {
  const p = self(world);
  if (!p) return;
  const max = maxMana(p.int, world.player.skills.magery ?? 0);
  if (world.player.mana == null || Number.isNaN(world.player.mana)) world.player.mana = max;
  const dtHours = dt / SECONDS_PER_HOUR;
  const rate = p.path.length ? 1.6 : 5;
  world.player.mana = Math.min(max, world.player.mana + rate * dtHours);
}

function pathToward(world: World, tx: number, ty: number, range: number) {
  const p = self(world);
  if (!p) return false;
  const from = tileOf(p.x, p.z);
  const path = astarToRange(world, from.tx, from.ty, tx, ty, range, 2500);
  if (!path) return false;
  p.path = path.map((n) => ({ tx: n.x, ty: n.y }));
  return true;
}

/** Release reach for a harmful spell — the one resolver behind command
 *  admission, ongoing pursuit, terrain replanning, and impact validation. */
export function offensiveRange(spell: SpellId) {
  return spell === "fireball" || spell === "lightning" || spell === "chainlightning" || TILE_OFFENSIVE_SPELLS.has(spell) ? FIREBALL_RANGE : ARROW_RANGE;
}

function footing(world: World, tx: number, ty: number) {
  const dest = nearestWalkable(world, tx, ty);
  if (!dest) return null;
  if (Math.hypot(dest.x - tx, dest.y - ty) > 1.6) return null;
  return dest;
}

function snapFollowers(world: World, px: number, pz: number) {
  for (const c of world.fauna) {
    if (c.ownerId !== world.player.id || c.stay || c.task === "dead") continue;
    if (Math.hypot(c.x - px, c.z - pz) <= 12) continue;
    const dest = nearestWalkable(world, Math.round(px), Math.round(pz));
    if (!dest) continue;
    c.x = dest.x + (Math.random() - 0.5) * 1.4;
    c.z = dest.y + (Math.random() - 0.5) * 1.4;
    c.path = [];
    c.home = { tx: dest.x, ty: dest.y };
    c.task = "follow";
  }
}

function landAt(world: World, p: Person, tx: number, ty: number) {
  const dest = nearestWalkable(world, tx, ty);
  if (!dest) return false;
  p.x = dest.x;
  p.z = dest.y;
  p.path = [];
  p.facing = 0;
  revealAround(world, dest.x, dest.y, 22);
  snapFollowers(world, dest.x, dest.y);
  return true;
}

function markLabel(world: World, tx: number, ty: number) {
  let best = PLACES[0]!;
  let d = Infinity;
  for (const place of PLACES) {
    const dd = Math.hypot(place.tx - tx, place.ty - ty);
    if (dd < d) {
      d = dd;
      best = place;
    }
  }
  const base = d < 18 ? best.name : regionAt(tx, ty).name;
  const used = (world.player.marks ?? []).filter((m) => m.name === base || m.name.startsWith(`${base} `)).length;
  return used ? `${base} ${used + 1}` : base;
}

/** One strike against a beast: the wound, the turn-on-you, and — when it
 *  drops — the full kill rites (corpse, pile, hunt objective, rare glint).
 *  Shared by the batch-one strikes and ground rings. */
function woundBeast(world: World, c: World["fauna"][number], dmg: number): { killed: boolean; rareFound: string | null } {
  c.hp -= dmg;
  if (c.hp > 0) {
    c.task = "fight";
    c.taskUntil = world.hour + 0.25;
    return { killed: false, rareFound: null };
  }
  c.hp = 0;
  c.task = "dead";
  c.path = [];
  c.corpseUntil = world.hour + 8;
  spawnCorpsePile(world, c);
  completeObjective(world, "hunt");
  const found = rollKillRare(world, c.kind, Math.random);
  if (found) world.player.rares.push(found);
  return { killed: true, rareFound: found ? rareName(found) : null };
}

export function forgetMark(world: World, id: string) {
  if (!world.player.marks) world.player.marks = [];
  const n = world.player.marks.length;
  world.player.marks = world.player.marks.filter((m) => m.id !== id);
  return n === world.player.marks.length ? "No such mark." : "The rune fades.";
}

function beginCast(world: World, p: Person, spell: SpellId, tx: number, ty: number, targetId: string | null) {
  world.player.armedSpell = null;
  world.player.intent = { kind: "cast", tx, ty, targetId, spell };
  p.path = [];
}

export function commandCast(world: World, spell: SpellId, target?: CastTarget): string | null {
  const p = self(world);
  if (!p) return "You are not in the vale.";
  if (p.ghost || world.player.ghost) return "The dead have no words.";
  if (!hasBook(world)) return "You need a spellbook.";
  const meta = SPELL_META[spell];
  const miss = missingReagent(world, spell);
  if (miss) return `Need ${ITEM_META[miss].label.toLowerCase()}.`;
  if ((world.player.mana ?? 0) < meta.mana) return "Not enough mana.";
  if (!world.player.marks) world.player.marks = [];

  if (OFFENSIVE_SPELLS.has(spell)) {
    if (!target || target.kind !== "fauna") {
      world.player.armedSpell = spell;
      world.player.intent = { kind: "none", tx: 0, ty: 0, targetId: null, spell: null };
      return "Click a beast.";
    }
    const c = world.fauna.find((x) => x.id === target.id);
    if (!c || c.task === "dead") return "Nothing to strike.";
    if (c.ownerId === world.player.id) return "It is yours.";
    world.player.armedSpell = null;
    world.player.intent = { kind: "cast", tx: Math.round(c.x), ty: Math.round(c.z), targetId: c.id, spell };
    const range = offensiveRange(spell);
    if (Math.hypot(p.x - c.x, p.z - c.z) > range) pathToward(world, c.x, c.z, range - 0.75);
    else p.path = [];
    return null;
  }

  if (TILE_OFFENSIVE_SPELLS.has(spell)) {
    if (!target || target.kind !== "tile") {
      world.player.armedSpell = spell;
      world.player.intent = { kind: "none", tx: 0, ty: 0, targetId: null, spell: null };
      return "Click the ground.";
    }
    world.player.armedSpell = null;
    world.player.intent = { kind: "cast", tx: target.tx, ty: target.ty, targetId: null, spell };
    const range = offensiveRange(spell);
    if (Math.hypot(p.x - target.tx, p.z - target.ty) > range) pathToward(world, target.tx, target.ty, range - 0.75);
    else p.path = [];
    return null;
  }

  if (spell === "teleport") {
    if (!target || target.kind !== "tile") {
      world.player.armedSpell = "teleport";
      world.player.intent = { kind: "none", tx: 0, ty: 0, targetId: null, spell: null };
      return "Click the ground.";
    }
    const dest = footing(world, target.tx, target.ty);
    if (!dest) return "No footing.";
    if (Math.hypot(p.x - dest.x, p.z - dest.y) < 0.8) return "You already stand there.";
    if (Math.hypot(p.x - dest.x, p.z - dest.y) > TELEPORT_RANGE) return "Too far.";
    beginCast(world, p, spell, dest.x, dest.y, null);
    return null;
  }

  if (spell === "mark") {
    if ((world.player.pack.rune ?? 0) < 1) return "Need a blank rune.";
    if (world.player.marks.length >= MARK_CAP) return "The book holds eight marks.";
    beginCast(world, p, spell, Math.round(p.x), Math.round(p.z), p.id);
    return null;
  }

  if (spell === "recall") {
    const marks = world.player.marks;
    if (!marks.length) return "Nothing is marked.";
    let chosen: RecallMark | undefined;
    if (target?.kind === "mark") chosen = marks.find((m) => m.id === target.id);
    else if (marks.length === 1) chosen = marks[0];
    else return "Pick a mark.";
    if (!chosen) return "That mark is gone.";
    if (Math.hypot(p.x - chosen.tx, p.z - chosen.ty) < 2) return "You already stand there.";
    beginCast(world, p, spell, chosen.tx, chosen.ty, chosen.id);
    return null;
  }

  if (spell === "cure") {
    if (world.hour >= world.player.poisonUntil) return "There is no venom in you.";
    beginCast(world, p, spell, Math.round(p.x), Math.round(p.z), p.id);
    return null;
  }

  beginCast(world, p, spell, Math.round(p.x), Math.round(p.z), p.id);
  return null;
}

export function castNow(world: World): string | null {
  const p = self(world);
  const spell = world.player.intent.spell;
  if (!p || !spell) {
    world.player.intent.kind = "none";
    return "The words fade.";
  }
  const meta = SPELL_META[spell];
  if (!hasBook(world)) {
    world.player.intent.kind = "none";
    return "You need a spellbook.";
  }
  const miss = missingReagent(world, spell);
  if (miss) {
    world.player.intent.kind = "none";
    return `Need ${ITEM_META[miss].label.toLowerCase()}.`;
  }
  if ((world.player.mana ?? 0) < meta.mana) {
    world.player.intent.kind = "none";
    return "Not enough mana.";
  }
  if (!world.player.marks) world.player.marks = [];

  if (OFFENSIVE_SPELLS.has(spell)) {
    const c = world.fauna.find((x) => x.id === world.player.intent.targetId);
    if (!c || c.task === "dead") {
      world.player.intent.kind = "none";
      return "It fled.";
    }
    const range = offensiveRange(spell);
    if (Math.hypot(p.x - c.x, p.z - c.z) > range) {
      pathToward(world, c.x, c.z, range - 0.75);
      return null;
    }
    p.path = [];
  }
  if (TILE_OFFENSIVE_SPELLS.has(spell)) {
    const range = offensiveRange(spell);
    if (Math.hypot(p.x - world.player.intent.tx, p.z - world.player.intent.ty) > range) {
      pathToward(world, world.player.intent.tx, world.player.intent.ty, range - 0.75);
      return null;
    }
    p.path = [];
  }
  if (spell === "teleport") {
    const dest = footing(world, world.player.intent.tx, world.player.intent.ty);
    if (!dest) {
      world.player.intent.kind = "none";
      return "No footing.";
    }
    if (Math.hypot(p.x - dest.x, p.z - dest.y) > TELEPORT_RANGE) {
      world.player.intent.kind = "none";
      return "Too far.";
    }
  }
  if (spell === "mark") {
    if ((world.player.pack.rune ?? 0) < 1) {
      world.player.intent.kind = "none";
      return "Need a blank rune.";
    }
    if (world.player.marks.length >= MARK_CAP) {
      world.player.intent.kind = "none";
      return "The book holds eight marks.";
    }
  }
  if (spell === "recall") {
    const mark = world.player.marks.find((m) => m.id === world.player.intent.targetId);
    if (!mark) {
      world.player.intent.kind = "none";
      return "That mark is gone.";
    }
  }

  takeReagents(world, spell);
  const skill = world.player.skills.magery ?? 0;
  const chance = successChance(skill, meta.diff);
  const ok = Math.random() < chance;
  const savedTx = world.player.intent.tx;
  const savedTy = world.player.intent.ty;
  const savedId = world.player.intent.targetId;
  world.player.intent.kind = "none";
  world.player.armedSpell = null;
  completeObjective(world, "book");
  const withGain = (flavor: string, gain: string | null) => (gain ? `${flavor} ${gain}.` : flavor);

  if (!ok) {
    emitSpellEffect(world, { spell, x: p.x, z: p.z, tx: p.x, tz: p.z, at: world.hour, outcome: "fizzle" });
    playSfx("fizzle", 0.4);
    return `${meta.words}. The spell fizzles.`;
  }

  world.player.mana = Math.max(0, (world.player.mana ?? 0) - meta.mana);
  const gain = tryGain(world, "magery", true, chance >= 0.45 && chance <= 0.75);
  // Harmful work betrays the shimmer.
  if (OFFENSIVE_SPELLS.has(spell) && world.hour < world.player.invisUntil) {
    world.player.invisUntil = 0;
    log(world, "Your hand betrays the shimmer.");
  }

  if (spell === "nightsight") {
    world.player.nightSightUntil = world.hour + 8;
    emitSpellEffect(world, { spell, x: p.x, z: p.z, tx: p.x, tz: p.z, at: world.hour, outcome: "success" });
    playSfx(spellSfx(spell), 0.5);
    return withGain(`${meta.words}. The dark thins.`, gain);
  }
  if (spell === "heal") {
    const amt = 5 + Math.floor(skill / 10) + Math.floor(p.int / 5);
    p.hp = Math.min(p.maxHp, p.hp + amt);
    emitSpellEffect(world, { spell, x: p.x, z: p.z, tx: p.x, tz: p.z, at: world.hour, outcome: "success" });
    completeObjective(world, "healcast");
    playSfx(spellSfx(spell), 0.5);
    return withGain(`${meta.words}. The wound closes.`, gain);
  }
  if (spell === "cure") {
    if (world.hour >= world.player.poisonUntil) {
      emitSpellEffect(world, { spell, x: p.x, z: p.z, tx: p.x, tz: p.z, at: world.hour, outcome: "success" });
      playSfx(spellSfx(spell), 0.5);
      return withGain(`${meta.words}. The venom had already passed.`, gain);
    }
    world.player.poisonUntil = 0;
    world.player.poisonTickAt = 0;
    emitSpellEffect(world, { spell, x: p.x, z: p.z, tx: p.x, tz: p.z, at: world.hour, outcome: "success" });
    playSfx(spellSfx(spell), 0.5);
    return withGain(`${meta.words}. The venom leaves the blood.`, gain);
  }
  if (spell === "bless") {
    world.player.blessUntil = world.hour + BLESS_HOURS;
    emitSpellEffect(world, { spell, x: p.x, z: p.z, tx: p.x, tz: p.z, at: world.hour, outcome: "success" });
    playSfx(spellSfx(spell), 0.5);
    return withGain(`${meta.words}. The arm remembers old battles.`, gain);
  }
  if (spell === "summon") {
    const old = world.fauna.find((c) => c.ownerId === world.player.id && c.boundUntil && c.boundUntil > world.hour);
    if (old) world.fauna = world.fauna.filter((x) => x.id !== old.id);
    const roll = skill + Math.random() * 30;
    const kind = roll >= 70 ? "ironwood_boar" : roll >= 40 ? "wolf" : "ember_fox";
    const dest = nearestWalkable(world, Math.round(p.x) + 1, Math.round(p.z)) ?? nearestWalkable(world, Math.round(p.x), Math.round(p.z));
    if (!dest) return "The vale has no room for a guest.";
    const beast = spawn(world, kind, dest.x, dest.y);
    beast.ownerId = world.player.id;
    beast.loyalty = 100;
    beast.boundUntil = world.hour + SUMMON_HOURS;
    world.fauna.push(beast);
    emitSpellEffect(world, { spell, x: p.x, z: p.z, tx: dest.x, tz: dest.y, at: world.hour, outcome: "success" });
    playSfx(spellSfx(spell), 0.55);
    const oldNote = old ? " The old binding loosens." : "";
    return withGain(`${meta.words}. A ${FAUNA_META[kind].label.toLowerCase()} pads to your side.${oldNote}`, gain);
  }
  if (spell === "invisibility") {
    world.player.invisUntil = world.hour + INVIS_HOURS;
    // The pack loses your scent.
    for (const c of world.fauna) {
      if (c.task === "fight" && !c.ownerId) {
        c.task = "idle";
        c.path = [];
      }
    }
    emitSpellEffect(world, { spell, x: p.x, z: p.z, tx: p.x, tz: p.z, at: world.hour, outcome: "success" });
    playSfx(spellSfx(spell), 0.5);
    return withGain(`${meta.words}. The world forgets your shape.`, gain);
  }
  if (spell === "paralyze") {
    const c = world.fauna.find((x) => x.id === savedId);
    if (!c) return "It fled.";
    c.paralyzeUntil = world.hour + PARALYZE_HOURS;
    c.path = [];
    c.task = "idle";
    c.taskUntil = c.paralyzeUntil;
    emitSpellEffect(world, { spell, x: p.x, z: p.z, tx: c.x, tz: c.z, at: world.hour, outcome: "success" });
    playSfx(spellSfx(spell), 0.5);
    return withGain(`${meta.words}. The ${FAUNA_META[c.kind].label.toLowerCase()} locks mid-stride.`, gain);
  }
  if (spell === "curse") {
    const c = world.fauna.find((x) => x.id === savedId);
    if (!c) return "It fled.";
    c.curseUntil = world.hour + CURSE_HOURS;
    c.task = "fight";
    c.taskUntil = world.hour + 0.25;
    emitSpellEffect(world, { spell, x: p.x, z: p.z, tx: c.x, tz: c.z, at: world.hour, outcome: "success" });
    playSfx(spellSfx(spell), 0.5);
    return withGain(`${meta.words}. The ${FAUNA_META[c.kind].label.toLowerCase()}'s strength sours.`, gain);
  }
  if (spell === "magicarrow" || spell === "fireball" || spell === "poison" || spell === "lightning") {
    const c = world.fauna.find((x) => x.id === savedId);
    if (!c) return "It fled.";
    let dmg = 5 + Math.floor(skill / 10) + Math.floor(p.int / 6);
    if (spell === "fireball") dmg = 10 + Math.floor(skill / 8) + Math.floor(p.int / 4);
    if (spell === "lightning") dmg = 8 + Math.floor(skill / 9) + Math.floor(p.int / 4);
    if (spell === "poison") dmg = 3 + Math.floor(skill / 12) + Math.floor(p.int / 8);
    c.hp -= dmg;
    c.task = "fight";
    c.taskUntil = world.hour + 0.25;
    if (spell === "poison") {
      c.poisonUntil = world.hour + POISON_FAUNA_HOURS;
      c.poisonTickAt = world.hour + POISON_TICK_HOURS;
    }
    emitSpellEffect(world, { spell, x: p.x, z: p.z, tx: c.x, tz: c.z, at: world.hour, outcome: "success" });
    playSfx(spellSfx(spell), 0.54);
    if (c.hp <= 0) {
      c.hp = 0;
      c.task = "dead";
      c.path = [];
      c.corpseUntil = world.hour + 8;
      spawnCorpsePile(world, c);
      completeObjective(world, "hunt");
      completeObjective(world, spell === "fireball" ? "fireball" : spell === "magicarrow" ? "arrow" : spell);
      const found = rollKillRare(world, c.kind, Math.random);
      if (found) {
        world.player.rares.push(found);
        return withGain(`${meta.words}. The ${FAUNA_META[c.kind].label.toLowerCase()} falls. Something glints in the kill — ${rareName(found)}!`, gain);
      }
      return withGain(`${meta.words}. The ${FAUNA_META[c.kind].label.toLowerCase()} falls.`, gain);
    }
    const struck = spell === "poison" ? "sickens" : spell === "lightning" ? "is blasted" : "is struck";
    return withGain(`${meta.words}. The ${FAUNA_META[c.kind].label.toLowerCase()} ${struck}.`, gain);
  }
  if (spell === "thornsnare") {
    const c = world.fauna.find((x) => x.id === savedId);
    if (!c) return "It fled.";
    c.snareUntil = world.hour + SNARE_HOURS;
    c.snareTickAt = world.hour + SNARE_TICK_HOURS;
    c.path = [];
    c.task = "idle";
    c.taskUntil = c.snareUntil;
    emitSpellEffect(world, { spell, x: p.x, z: p.z, tx: c.x, tz: c.z, at: world.hour, outcome: "success" });
    playSfx(spellSfx(spell), 0.5);
    return withGain(`${meta.words}. Thorns coil around the ${FAUNA_META[c.kind].label.toLowerCase()}.`, gain);
  }
  if (spell === "ironwood") {
    world.player.ironwoodUntil = world.hour + IRONWOOD_HOURS;
    emitSpellEffect(world, { spell, x: p.x, z: p.z, tx: p.x, tz: p.z, at: world.hour, outcome: "success" });
    playSfx(spellSfx(spell), 0.5);
    return withGain(`${meta.words}. Your skin takes the grain of old bark.`, gain);
  }
  if (spell === "leech") {
    const c = world.fauna.find((x) => x.id === savedId);
    if (!c) return "It fled.";
    const dmg = 6 + Math.floor(skill / 9) + Math.floor(p.int / 5);
    const { killed, rareFound } = woundBeast(world, c, dmg);
    p.hp = Math.min(p.maxHp, p.hp + dmg);
    emitSpellEffect(world, { spell, x: p.x, z: p.z, tx: c.x, tz: c.z, at: world.hour, outcome: "success" });
    playSfx(spellSfx(spell), 0.52);
    if (killed) {
      const glint = rareFound ? ` Something glints in the kill — ${rareFound}!` : "";
      return withGain(`${meta.words}. The ${FAUNA_META[c.kind].label.toLowerCase()} falls, and its last strength feeds you.${glint}`, gain);
    }
    return withGain(`${meta.words}. The ${FAUNA_META[c.kind].label.toLowerCase()}'s wound feeds you.`, gain);
  }
  if (spell === "flash") {
    let blinded = 0;
    for (const c of world.fauna) {
      if (c.task === "dead" || c.ownerId === world.player.id) continue;
      if (Math.hypot(c.x - p.x, c.z - p.z) > FLASH_RADIUS) continue;
      c.blindUntil = world.hour + BLIND_HOURS;
      if (c.task === "fight") letGo(c, world);
      blinded += 1;
    }
    emitSpellEffect(world, { spell, x: p.x, z: p.z, tx: p.x, tz: p.z, at: world.hour, outcome: "success" });
    playSfx(spellSfx(spell), 0.55);
    if (!blinded) return withGain(`${meta.words}. White — but the burst finds no eyes.`, gain);
    return withGain(`${meta.words}. White. ${blinded === 1 ? "A beast loses" : `${blinded} beasts lose`} the fight.`, gain);
  }
  if (spell === "fireblast" || spell === "blizzard" || spell === "meteor") {
    const radius = spell === "meteor" ? METEOR_RADIUS : BLAST_RADIUS;
    let dmg = 10 + Math.floor(skill / 8) + Math.floor(p.int / 4);
    if (spell === "blizzard") dmg = 7 + Math.floor(skill / 9) + Math.floor(p.int / 4);
    if (spell === "meteor") dmg = 16 + Math.floor(skill / 6) + Math.floor(p.int / 3);
    let burned = 0;
    let felled = 0;
    const glints: string[] = [];
    for (const c of world.fauna) {
      if (c.task === "dead" || c.ownerId === world.player.id) continue;
      if (Math.hypot(c.x - savedTx, c.z - savedTy) > radius) continue;
      const { killed, rareFound } = woundBeast(world, c, dmg);
      if (!killed && spell === "blizzard") c.chillUntil = world.hour + CHILL_HOURS;
      if (killed) felled += 1;
      else burned += 1;
      if (rareFound) glints.push(rareFound);
    }
    emitSpellEffect(world, { spell, x: p.x, z: p.z, tx: savedTx, tz: savedTy, at: world.hour, outcome: "success" });
    playSfx(spellSfx(spell), 0.58);
    const glintNote = glints.length ? ` Something glints in the ruin — ${glints.join(", ")}!` : "";
    const toll = burned + felled === 0 ? "the ring finds nothing"
      : `${burned + felled === 1 ? "one beast" : `${burned + felled} beasts`} caught${felled ? `, ${felled} felled` : ""}`;
    const sky = spell === "meteor" ? "The sky falls" : spell === "blizzard" ? "The cold front takes the ring" : "The ground erupts";
    return withGain(`${meta.words}. ${sky} — ${toll}.${glintNote}`, gain);
  }
  if (spell === "chainlightning") {
    const c = world.fauna.find((x) => x.id === savedId);
    if (!c) return "It fled.";
    const dmg = 8 + Math.floor(skill / 9) + Math.floor(p.int / 4);
    const first = woundBeast(world, c, dmg);
    const arcs = world.fauna
      .filter((x) => x.id !== c.id && x.task !== "dead" && x.ownerId !== world.player.id && Math.hypot(x.x - c.x, x.z - c.z) <= CHAIN_RANGE)
      .sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z))
      .slice(0, CHAIN_MAX);
    const arcDmg = Math.max(1, Math.floor(dmg * CHAIN_FALLOFF));
    const glints: string[] = first.rareFound ? [first.rareFound] : [];
    for (const arc of arcs) {
      const { rareFound } = woundBeast(world, arc, arcDmg);
      if (rareFound) glints.push(rareFound);
    }
    emitSpellEffect(world, { spell, x: p.x, z: p.z, tx: c.x, tz: c.z, at: world.hour, outcome: "success" });
    playSfx(spellSfx(spell), 0.56);
    const glintNote = glints.length ? ` Something glints in the kill — ${glints.join(", ")}!` : "";
    const arcNote = arcs.length ? ` The bolt arcs to ${arcs.length === 1 ? "another" : `${arcs.length} more`}.` : "";
    const fell = first.killed ? "falls" : "is blasted";
    return withGain(`${meta.words}. The ${FAUNA_META[c.kind].label.toLowerCase()} ${fell}.${arcNote}${glintNote}`, gain);
  }
  if (spell === "sleep") {
    const c = world.fauna.find((x) => x.id === savedId);
    if (!c) return "It fled.";
    c.sleptUntil = world.hour + SLEEP_HOURS;
    c.path = [];
    c.task = "idle";
    c.taskUntil = c.sleptUntil;
    markAsleep(c);
    emitSpellEffect(world, { spell, x: p.x, z: p.z, tx: c.x, tz: c.z, at: world.hour, outcome: "success" });
    playSfx(spellSfx(spell), 0.5);
    return withGain(`${meta.words}. The ${FAUNA_META[c.kind].label.toLowerCase()} drifts off.`, gain);
  }
  if (spell === "teleport") {
    const fromX = p.x;
    const fromZ = p.z;
    if (!landAt(world, p, savedTx, savedTy)) return "No footing.";
    emitSpellEffect(world, { spell, x: fromX, z: fromZ, tx: p.x, tz: p.z, at: world.hour, outcome: "success" });
    completeObjective(world, "teleport");
    playSfx(spellSfx(spell), 0.52);
    return withGain(`${meta.words}. The dirt folds.`, gain);
  }
  if (spell === "mark") {
    world.player.pack.rune = Math.max(0, (world.player.pack.rune ?? 0) - 1);
    const tx = Math.round(p.x);
    const ty = Math.round(p.z);
    const mark: RecallMark = { id: nid(world, "mk"), tx, ty, name: markLabel(world, tx, ty) };
    world.player.marks = [...world.player.marks, mark];
    emitSpellEffect(world, { spell, x: p.x, z: p.z, tx: p.x, tz: p.z, at: world.hour, outcome: "success" });
    completeObjective(world, "mark");
    playSfx(spellSfx(spell), 0.5);
    return withGain(`${meta.words}. ${mark.name} is written.`, gain);
  }
  if (spell === "recall") {
    const mark = world.player.marks.find((m) => m.id === savedId);
    if (!mark) return "That mark is gone.";
    const fromX = p.x;
    const fromZ = p.z;
    if (!landAt(world, p, mark.tx, mark.ty)) return "No footing.";
    emitSpellEffect(world, { spell, x: fromX, z: fromZ, tx: p.x, tz: p.z, at: world.hour, outcome: "success" });
    completeObjective(world, "recall");
    playSfx(spellSfx(spell), 0.52);
    return withGain(`${meta.words}. ${mark.name}.`, gain);
  }
  return "The words fade.";
}
