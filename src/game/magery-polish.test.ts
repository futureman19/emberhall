import assert from "node:assert/strict";
import test from "node:test";
import { visitSpellStatuses, updateSpellStatuses } from "./spell-effects.ts";
import { commandCast, castNow } from "./magery.ts";
import { spellEffects } from "./spell-effects.ts";
import { createStubWorld } from "./world.ts";
import type { Creature, Person, SpellId, World } from "./types.ts";

function fixture(): { world: World; player: Person } {
  const world = createStubWorld();
  const player = { id: world.player.id, isPlayer: true, int: 20, x: 30, z: 30, path: [], hp: 50, maxHp: 50, kind: "human", task: "idle", taskUntil: 0, member: true, ghost: false } as unknown as Person;
  world.people.push(player);
  world.player.skills.magery = 100;
  world.player.mana = 999;
  Object.assign(world.player.pack, { spellbook: 1, silk: 9, ash: 9 });
  for (let y = 26; y <= 34; y++) for (let x = 26; x <= 40; x++) world.tiles[y]![x]!.kind = "grass";
  return { world, player };
}

function seals(world: World): { spell: SpellId; lane: number }[] {
  updateSpellStatuses(world);
  const out: { spell: SpellId; lane: number }[] = [];
  visitSpellStatuses(world, (_x, _z, spell, lane) => out.push({ spell, lane }));
  return out;
}

test("polish - fly wears a wind ring while aloft", () => {
  const { world } = fixture();
  world.player.flyUntil = world.hour + 1;
  assert.ok(seals(world).some((s) => s.spell === "fly"), "the ring shows");
  world.player.flyUntil = world.hour - 1;
  assert.ok(!seals(world).some((s) => s.spell === "fly"), "and it fades with the working");
});

test("polish - a hare-shaped beast wears the polymorph seal", () => {
  const { world } = fixture();
  const c = { id: "c1", kind: "hare", x: 31, z: 30, hp: 10, maxHp: 10, path: [], task: "idle", taskUntil: 0, wasKind: "wolf", polyUntil: world.hour + 1, home: { tx: 31, ty: 30 }, ownerId: null, loyalty: 0, stay: false, corpseUntil: 0 } as unknown as Creature;
  world.fauna.push(c);
  assert.ok(seals(world).some((s) => s.spell === "polymorph"), "the borrowed shape shimmers");
  c.polyUntil = world.hour - 1;
  assert.ok(!seals(world).some((s) => s.spell === "polymorph"), "until it lapses");
});

test("polish - mirror images shimmer with their own seal", () => {
  const { world } = fixture();
  const m = { id: "m1", kind: "hare", x: 31, z: 30, hp: 1, maxHp: 1, path: [], task: "idle", taskUntil: world.hour + 0.2, mirror: true, home: { tx: 31, ty: 30 }, ownerId: null, loyalty: 0, stay: false, corpseUntil: 0 } as unknown as Creature;
  world.fauna.push(m);
  assert.ok(seals(world).some((s) => s.spell === "mirrorimage"), "the images gleam");
  m.taskUntil = world.hour - 1;
  assert.ok(!seals(world).some((s) => s.spell === "mirrorimage"), "spent images show nothing");
});

test("polish - a leap flashes where you leave and where you land", () => {
  const { world, player } = fixture();
  world.hour = 100;
  // Pin the fizzle roll — at 100 skill the chance is high but never 1.
  const r = Math.random;
  Math.random = () => 0;
  let note: string | null = null;
  try {
    assert.equal(commandCast(world, "jump", { kind: "tile", tx: 34, ty: 30 }), null);
    note = castNow(world);
  } finally {
    Math.random = r;
  }
  assert.match(note ?? "", /ground rushes up/i);
  const jumps = spellEffects(world).filter((e) => e.spell === "jump");
  assert.ok(jumps.length >= 2, `two flashes (${jumps.length})`);
  assert.ok(jumps.some((e) => Math.hypot(e.x - 30, e.z - 30) < 1), "one where you stood");
  assert.ok(jumps.some((e) => Math.hypot(e.x - player.x, e.z - player.z) < 1), "one where you land");
});
