import assert from "node:assert/strict";
import test from "node:test";
import { FAUNA_META } from "./catalog.ts";
import { tickPlayer, you } from "./player.ts";
import { loadSave, writeSave } from "./save.ts";
import { createWorld } from "./world.ts";
import type { Creature, FaunaKind, World } from "./types.ts";
import {
  TECHNIQUES,
  armedTechniqueFor,
  commandArmTechnique,
  techniqueUnlocked,
} from "./techniques.ts";

// Techniques — spells for warriors. Moves gate on weapon skill tiers
// (25/50/75), arm like a spell, ride the next landed strike, then cool down.

function withRoll(v: number, fn: () => void) {
  const old = Math.random;
  Math.random = () => v;
  try {
    fn();
  } finally {
    Math.random = old;
  }
}

let beastSeq = 0;
function beast(kind: FaunaKind, x: number, z: number): Creature {
  return {
    id: `t-${kind}-${++beastSeq}`,
    kind,
    x,
    z,
    hp: FAUNA_META[kind].hp,
    maxHp: FAUNA_META[kind].hp,
    path: [],
    task: "idle",
    taskUntil: 999,
    corpseUntil: 0,
    home: { tx: Math.round(x), ty: Math.round(z) },
    ownerId: null,
    loyalty: 0,
    stay: false,
  };
}

/** A hunter mid-swing: target adjacent, intent set, one tick lands the strike. */
function strikeOnce(w: World, target: Creature, roll = 0.01): number {
  const hpBefore = target.hp;
  w.player.intent = { kind: "hunt", tx: Math.round(target.x), ty: Math.round(target.z), targetId: target.id, spell: null };
  withRoll(roll, () => {
    for (let i = 0; i < 12 && target.hp === hpBefore && target.task !== "dead"; i++) tickPlayer(w, 0.6);
  });
  return hpBefore - target.hp;
}

function hunterWorld(): World {
  const w = createWorld(7);
  const p = you(w)!;
  w.player.skills.swords = 100;
  w.player.skills.archery = 100;
  w.player.skills.anatomy = 0; // no crit noise in the math
  p.x = 10;
  p.z = 10;
  return w;
}

test("techniques - catalog: six moves, three per weapon, tiers 25/50/75", () => {
  const all = Object.values(TECHNIQUES);
  assert.equal(all.length, 6);
  for (const weapon of ["sword", "bow"] as const) {
    const kit = all.filter((t) => t.weapon === weapon);
    assert.equal(kit.length, 3, `${weapon} kit`);
    assert.deepEqual(kit.map((t) => t.minSkill).sort((a, b) => a - b), [25, 50, 75]);
    for (const t of kit) assert.ok(t.cooldownHours > 0, `${t.id} has a real cooldown`);
  }
});

test("techniques - a move unlocks exactly at its skill tier", () => {
  const w = hunterWorld();
  w.player.skills.swords = 24;
  assert.equal(techniqueUnlocked(w, "lunge"), false);
  w.player.skills.swords = 25;
  assert.equal(techniqueUnlocked(w, "lunge"), true);
  w.player.skills.archery = 74;
  assert.equal(techniqueUnlocked(w, "hunters_mark"), false);
  w.player.skills.archery = 75;
  assert.equal(techniqueUnlocked(w, "hunters_mark"), true);
});

test("techniques - arming validates weapon, unlock and cooldown; re-tap disarms", () => {
  const w = hunterWorld();
  w.player.wear.main = "sword";
  assert.equal(commandArmTechnique(w, "lunge"), null);
  assert.equal(w.player.armedTechnique, "lunge");
  // Re-tap lets go.
  assert.equal(commandArmTechnique(w, "lunge"), null);
  assert.equal(w.player.armedTechnique, null);
  // Wrong weapon in hand.
  w.player.wear.main = "bow";
  assert.ok(commandArmTechnique(w, "lunge"), "sword move with a bow in hand is refused");
  assert.equal(w.player.armedTechnique, null);
  // Locked tier.
  w.player.skills.swords = 10;
  w.player.wear.main = "sword";
  assert.ok(commandArmTechnique(w, "cleave"), "tier-75 move at skill 10 is refused");
  // Cooling down.
  w.player.skills.swords = 100;
  w.player.techniqueCoolUntil = { lunge: w.hour + 0.5 };
  assert.ok(commandArmTechnique(w, "lunge"), "a cooling move refuses");
});

test("techniques - ghosts cannot ready a strike", () => {
  const w = hunterWorld();
  w.player.wear.main = "sword";
  you(w)!.ghost = true;
  assert.ok(commandArmTechnique(w, "lunge"));
  assert.equal(w.player.armedTechnique, null);
});

test("techniques - lunge: the thrust bites deeper (+3) and then cools down", () => {
  const w = hunterWorld();
  w.player.wear.main = "sword";
  const p = you(w)!;
  const base = beast("orc_marauder", p.x + 1, p.z);
  w.fauna.push(base);
  const baseDmg = strikeOnce(w, base);
  assert.ok(baseDmg > 0, "baseline strike landed");

  const lunged = beast("orc_marauder", p.x + 1, p.z);
  w.fauna.push(lunged);
  w.player.armedTechnique = "lunge";
  const techDmg = strikeOnce(w, lunged);
  assert.equal(techDmg, baseDmg + 3, "lunge adds its bite");
  assert.equal(w.player.armedTechnique, null, "the strike spends the move");
  assert.ok((w.player.techniqueCoolUntil.lunge ?? 0) > w.hour, "and the cooldown starts");
});

test("techniques - riposte: a beast that bit you since your last swing takes half again", () => {
  const w = hunterWorld();
  w.player.wear.main = "sword";
  const p = you(w)!;
  const base = beast("orc_marauder", p.x + 1, p.z);
  w.fauna.push(base);
  const baseDmg = strikeOnce(w, base);

  const biter = beast("orc_marauder", p.x + 1, p.z);
  w.fauna.push(biter);
  w.player.lastBittenAt = w.hour; // fresh teeth marks
  w.player.lastStrikeAt = 0;
  w.player.armedTechnique = "riposte";
  const techDmg = strikeOnce(w, biter);
  assert.equal(techDmg, Math.floor(baseDmg * 1.5), "riposte answers pain");

  // No fresh bite — the move reads as a plain committed swing.
  const calm = beast("orc_marauder", p.x + 1, p.z);
  w.fauna.push(calm);
  w.player.lastBittenAt = 0;
  w.player.lastStrikeAt = w.hour;
  w.player.armedTechnique = "riposte";
  assert.equal(strikeOnce(w, calm), baseDmg, "no bite, no fury");
});

test("techniques - cleave: the swing carries to a second beast at half strength", () => {
  const w = hunterWorld();
  w.player.wear.main = "sword";
  const p = you(w)!;
  const first = beast("orc_marauder", p.x + 1, p.z);
  const second = beast("orc_marauder", p.x + 1, p.z + 1);
  w.fauna.push(first, second);
  w.player.armedTechnique = "cleave";
  const main = strikeOnce(w, first);
  assert.ok(main > 0);
  assert.equal(second.maxHp - second.hp, Math.floor(main / 2), "the follow-through halves into the neighbor");
});

test("techniques - aimed shot: a miss still lands true (no graze)", () => {
  const w = hunterWorld();
  w.player.wear.main = "bow";
  w.player.skills.archery = 30; // low enough that a pinned-high roll truly misses
  w.player.pack.arrows = 5;
  const p = you(w)!;
  const far = beast("orc_marauder", p.x + 4, p.z);
  w.fauna.push(far);
  const grazed = strikeOnce(w, far, 0.99); // forced graze
  const hare2 = beast("orc_marauder", p.x + 4, p.z);
  w.fauna.push(hare2);
  w.player.armedTechnique = "aimed_shot";
  const trued = strikeOnce(w, hare2, 0.99);
  assert.ok(trued > grazed, "the aimed arrow bites where a graze would glance");
});

test("techniques - double loose: two arrows, two rolls", () => {
  const w = hunterWorld();
  w.player.wear.main = "bow";
  w.player.pack.arrows = 5;
  const p = you(w)!;
  const single = beast("orc_marauder", p.x + 4, p.z);
  w.fauna.push(single);
  const oneDmg = strikeOnce(w, single);
  const arrowsAfterSingle = w.player.pack.arrows;

  const pair = beast("orc_marauder", p.x + 4, p.z);
  w.fauna.push(pair);
  w.player.armedTechnique = "double_loose";
  const twoDmg = strikeOnce(w, pair);
  assert.equal(arrowsAfterSingle - w.player.pack.arrows, 2, "the second arrow leaves the quiver");
  assert.equal(twoDmg, oneDmg * 2, "both shafts tell");
});

test("techniques - hunter's mark: the marked beast takes a quarter more until it fades", () => {
  const w = hunterWorld();
  w.player.wear.main = "bow";
  w.player.pack.arrows = 9;
  const p = you(w)!;
  const plain = beast("orc_marauder", p.x + 4, p.z);
  w.fauna.push(plain);
  const baseDmg = strikeOnce(w, plain);

  const marked = beast("orc_marauder", p.x + 4, p.z);
  w.fauna.push(marked);
  w.player.armedTechnique = "hunters_mark";
  strikeOnce(w, marked); // the marking hit lands plain
  assert.ok((marked.markedUntil ?? 0) > w.hour, "the mark holds");
  const hpBefore = marked.hp;
  strikeOnce(w, marked); // unarmed follow-up
  assert.equal(hpBefore - marked.hp, Math.floor(baseDmg * 1.25), "marked prey bleeds extra");
});

test("techniques - a move armed for another weapon reads as none", () => {
  const w = hunterWorld();
  w.player.wear.main = "bow";
  w.player.armedTechnique = "lunge"; // a sword move with a bow in hand
  assert.equal(armedTechniqueFor(w), null);
  assert.equal(w.player.armedTechnique, null, "the stale arm clears");
});

test("techniques - the armed move and its cooldowns ride the save", () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, String(v)),
      removeItem: (k: string) => values.delete(k),
    },
  });
  try {
    const w = hunterWorld();
    w.player.armedTechnique = "lunge";
    w.player.techniqueCoolUntil = { lunge: w.hour + 0.4 };
    w.player.lastBittenAt = 3;
    w.player.lastStrikeAt = 2;
    const written = writeSave(w);
    assert.equal(written.ok, true, "the save accepts technique state");
    const loaded = loadSave();
    assert.ok(loaded, "and loads back");
    assert.equal(loaded.player.armedTechnique, "lunge");
    assert.equal(loaded.player.techniqueCoolUntil.lunge, w.player.techniqueCoolUntil.lunge);
    assert.equal(loaded.player.lastBittenAt, 3);
    assert.equal(loaded.player.lastStrikeAt, 2);
  } finally {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});
