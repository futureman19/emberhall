import assert from "node:assert/strict";
import test from "node:test";
import { commandCast, getFizzleFx, SPELL_ORDER, spellSfx } from "./magery.ts";
import {
  impactShard,
  moteState,
  ringBloom,
  spellFxProfile,
  windupGlow,
} from "./magery-animation.ts";
import { tickPlayer, you } from "./player.ts";
import { createWorld } from "./world.ts";

test("failed spellcasting emits a visible fizzle event at the caster", () => {
  const world = createWorld();
  const player = you(world)!;
  world.player.pack.spellbook = 1;
  world.player.pack.silk = 2;
  world.player.pack.ash = 2;
  world.player.mana = 100;
  world.player.skills.magery = 0;
  assert.equal(commandCast(world, "nightsight", { kind: "self", id: player.id }), null);
  const random = Math.random;
  Math.random = () => 0.999;
  try {
    assert.match(String(tickPlayer(world, 0.93)), /fizzles/);
  } finally {
    Math.random = random;
  }
  const fx = getFizzleFx();
  assert.ok(fx);
  assert.equal(fx.spell, "nightsight");
  assert.equal(fx.x, player.x);
  assert.equal(fx.z, player.z);
});

test("spell fx profiles - every spell has a complete, distinct identity", () => {
  assert.equal(SPELL_ORDER.length, 15);
  const kinds = new Set<string>();
  const voices = new Set<string>();
  for (const spell of SPELL_ORDER) {
    const p = spellFxProfile(spell);
    for (const color of [p.core, p.ring, p.motes, p.accent, p.glow]) {
      assert.match(color, /^#[0-9a-f]{6}$/i, `${spell} ${color} is a hex color`);
    }
    assert.ok(p.duration > 0.3, `${spell} has a visible lifetime`);
    assert.ok(p.motesCount >= 8 && p.motesCount <= 16, `${spell} mote budget sane`);
    kinds.add(p.kind);
    voices.add(p.motes);
    assert.equal(spellSfx(spell), `spell_${spell}`);
  }
  // Eight archetypes across fifteen spells — kin share a motion (heal/cure/bless
  // all fountain; magicarrow/poison/curse all dart; mark/summon both sigil)
  // but never a particle voice.
  assert.equal(kinds.size, 8);
  assert.equal(voices.size, 15);
});

test("windupGlow - tint per spell, safe fallback", () => {
  for (const spell of SPELL_ORDER) {
    assert.equal(windupGlow(spell), spellFxProfile(spell).glow);
  }
  assert.match(windupGlow(null), /^#/);
  assert.match(windupGlow(undefined), /^#/);
});

test("moteState - deterministic, finite, and rises for spiral and fountain", () => {
  for (const spell of ["nightsight", "heal"] as const) {
    const p = spellFxProfile(spell);
    for (let i = 0; i < p.motesCount; i++) {
      const a0 = moteState(spell, i, 0.1);
      const a1 = moteState(spell, i, 0.1);
      assert.deepEqual(a0, a1, `${spell} mote ${i} deterministic`);
      const b = moteState(spell, i, p.duration * 0.7);
      for (const v of [b.dx, b.dy, b.dz, b.scale, b.opacity]) {
        assert.ok(Number.isFinite(v), `${spell} mote ${i} finite`);
      }
      assert.ok(b.dy > a0.dy, `${spell} mote ${i} rises over the release`);
      assert.ok(b.opacity >= 0 && b.opacity < a0.opacity, `${spell} mote ${i} fades`);
    }
  }
});

test("moteState - sigil motes orbit at ground level", () => {
  const p = spellFxProfile("mark");
  for (let i = 0; i < p.motesCount; i++) {
    const m = moteState("mark", i, 0.4);
    assert.ok(Math.hypot(m.dx, m.dz) > 0.5, "sigil mote holds the ring");
    assert.ok(m.dy < 0.4, "sigil mote hugs the ground");
  }
});

test("impactShard - shards scatter outward and fade", () => {
  for (const spell of ["magicarrow", "fireball"] as const) {
    const near = Math.hypot(impactShard(spell, 3, 0.1).dx, impactShard(spell, 3, 0.1).dz);
    const far0 = impactShard(spell, 3, 0.9);
    const far = Math.hypot(far0.dx, far0.dz);
    assert.ok(far > near, `${spell} shard travels outward`);
    assert.ok(far0.opacity < 0.2, `${spell} shard nearly gone at the end`);
    assert.deepEqual(impactShard(spell, 5, 0.5), impactShard(spell, 5, 0.5), "deterministic");
  }
});

test("ringBloom - sigil holds its circle, others bloom outward", () => {
  const sigil0 = ringBloom("mark", 0);
  const sigil1 = ringBloom("mark", 0.8);
  assert.equal(sigil0.scale, sigil1.scale, "rune circle does not grow");
  const heal0 = ringBloom("heal", 0);
  const heal1 = ringBloom("heal", 0.8);
  assert.ok(heal1.scale > heal0.scale, "soft ring blooms");
  assert.ok(ringBloom("heal", 1).opacity <= 0.01, "ring fades out");
});
