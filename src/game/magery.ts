import { PLACES, regionAt } from "./atlas.ts";
import { FAUNA_META, ITEM_META, SECONDS_PER_HOUR } from "./catalog.ts";
import { astar, nearestWalkable, tileOf } from "./pathfinding.ts";
import { spawnCorpsePile } from "./piles.ts";
import { successChance, tryGain } from "./skills.ts";
import { playSfx } from "./vale-sfx.ts";
import { completeObjective, nid, revealAround } from "./world.ts";
import type { ItemId, Person, RecallMark, SpellId, World } from "./types.ts";

export const SPELL_ORDER: SpellId[] = [
  "nightsight", "heal", "magicarrow", "teleport", "fireball", "mark", "recall",
];

export const SPELL_CIRCLES: { circle: number; label: string; ids: SpellId[] }[] = [
  { circle: 1, label: "First circle", ids: ["nightsight", "heal", "magicarrow"] },
  { circle: 2, label: "Second", ids: ["teleport", "fireball"] },
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
  mark: { label: "Mark", circle: 3, diff: 8, mana: 8, reagents: ["pearl", "moss", "mandrake"], words: "Kal Por Ylem", target: "self", hint: "Write this dirt on a rune." },
  recall: { label: "Recall", circle: 3, diff: 8, mana: 9, reagents: ["pearl", "moss", "mandrake"], words: "Kal Ort Por", target: "mark", hint: "Tap a mark. Walk off first." },
};

export const ARROW_RANGE = 14;
export const FIREBALL_RANGE = 16;
export const TELEPORT_RANGE = 10;
export const MARK_CAP = 8;

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

let castFx: CastFx | null = null;
export function getCastFx() {
  return castFx;
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

function pathToward(world: World, tx: number, ty: number) {
  const p = self(world);
  if (!p) return false;
  const from = tileOf(p.x, p.z);
  const dest = nearestWalkable(world, tx, ty);
  if (!dest) return false;
  const path = astar(world, from.tx, from.ty, dest.x, dest.y);
  if (!path) return false;
  p.path = path.map((n) => ({ tx: n.x, ty: n.y }));
  return true;
}

function faunaRange(spell: SpellId) {
  return spell === "fireball" ? FIREBALL_RANGE : ARROW_RANGE;
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

  if (spell === "magicarrow" || spell === "fireball") {
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
    const range = faunaRange(spell);
    if (Math.hypot(p.x - c.x, p.z - c.z) > range) pathToward(world, Math.round(c.x), Math.round(c.z));
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

  if (spell === "magicarrow" || spell === "fireball") {
    const c = world.fauna.find((x) => x.id === world.player.intent.targetId);
    if (!c || c.task === "dead") {
      world.player.intent.kind = "none";
      return "It fled.";
    }
    if (Math.hypot(p.x - c.x, p.z - c.z) > faunaRange(spell)) {
      pathToward(world, Math.round(c.x), Math.round(c.z));
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
    playSfx("fizzle", 0.4);
    return `${meta.words}. The spell fizzles.`;
  }

  world.player.mana = Math.max(0, (world.player.mana ?? 0) - meta.mana);
  const gain = tryGain(world, "magery", true, chance >= 0.45 && chance <= 0.75);

  if (spell === "nightsight") {
    world.player.nightSightUntil = world.hour + 8;
    castFx = { spell, x: p.x, z: p.z, tx: p.x, tz: p.z, at: world.hour };
    playSfx("spark", 0.48);
    return withGain(`${meta.words}. The dark thins.`, gain);
  }
  if (spell === "heal") {
    const amt = 5 + Math.floor(skill / 10) + Math.floor(p.int / 5);
    p.hp = Math.min(p.maxHp, p.hp + amt);
    castFx = { spell, x: p.x, z: p.z, tx: p.x, tz: p.z, at: world.hour };
    completeObjective(world, "healcast");
    playSfx("spark", 0.48);
    return withGain(`${meta.words}. The wound closes.`, gain);
  }
  if (spell === "magicarrow" || spell === "fireball") {
    const c = world.fauna.find((x) => x.id === savedId);
    if (!c) return "It fled.";
    const dmg = spell === "fireball" ? 10 + Math.floor(skill / 8) + Math.floor(p.int / 4) : 5 + Math.floor(skill / 10) + Math.floor(p.int / 6);
    c.hp -= dmg;
    c.task = "fight";
    c.taskUntil = world.hour + 0.25;
    castFx = { spell, x: p.x, z: p.z, tx: c.x, tz: c.z, at: world.hour };
    playSfx(spell === "fireball" ? "fire" : "spark", 0.52);
    if (c.hp <= 0) {
      c.hp = 0;
      c.task = "dead";
      c.path = [];
      c.corpseUntil = world.hour + 8;
      spawnCorpsePile(world, c);
      completeObjective(world, "hunt");
      completeObjective(world, spell === "fireball" ? "fireball" : "arrow");
      return withGain(`${meta.words}. The ${FAUNA_META[c.kind].label.toLowerCase()} falls.`, gain);
    }
    return withGain(`${meta.words}. The ${FAUNA_META[c.kind].label.toLowerCase()} is struck.`, gain);
  }
  if (spell === "teleport") {
    const fromX = p.x;
    const fromZ = p.z;
    if (!landAt(world, p, savedTx, savedTy)) return "No footing.";
    castFx = { spell, x: fromX, z: fromZ, tx: p.x, tz: p.z, at: world.hour };
    completeObjective(world, "teleport");
    playSfx("gate", 0.5);
    return withGain(`${meta.words}. The dirt folds.`, gain);
  }
  if (spell === "mark") {
    world.player.pack.rune = Math.max(0, (world.player.pack.rune ?? 0) - 1);
    const tx = Math.round(p.x);
    const ty = Math.round(p.z);
    const mark: RecallMark = { id: nid(world, "mk"), tx, ty, name: markLabel(world, tx, ty) };
    world.player.marks = [...world.player.marks, mark];
    castFx = { spell, x: p.x, z: p.z, tx: p.x, tz: p.z, at: world.hour };
    completeObjective(world, "mark");
    playSfx("spark", 0.48);
    return withGain(`${meta.words}. ${mark.name} is written.`, gain);
  }
  if (spell === "recall") {
    const mark = world.player.marks.find((m) => m.id === savedId);
    if (!mark) return "That mark is gone.";
    const fromX = p.x;
    const fromZ = p.z;
    if (!landAt(world, p, mark.tx, mark.ty)) return "No footing.";
    castFx = { spell, x: fromX, z: fromZ, tx: p.x, tz: p.z, at: world.hour };
    completeObjective(world, "recall");
    playSfx("gate", 0.5);
    return withGain(`${meta.words}. ${mark.name}.`, gain);
  }
  return "The words fade.";
}
