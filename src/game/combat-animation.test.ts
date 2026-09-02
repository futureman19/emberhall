import assert from "node:assert/strict";
import test from "node:test";
import {
  COMBAT_BEAT,
  attackPhase,
  bowDrawAmount,
  meleeSwingPitch,
  projectileProgress,
  spellProjectileProfile,
  travelEffectProfile,
} from "./combat-animation.ts";

test("combat animation phase is deterministic and wraps on the combat beat", () => {
  assert.equal(attackPhase(0), 0);
  assert.ok(Math.abs(attackPhase(COMBAT_BEAT * 0.5) - 0.5) < Number.EPSILON);
  assert.ok(Math.abs(attackPhase(COMBAT_BEAT * 1.25) - 0.25) < Number.EPSILON);
});

test("melee swing winds up, strikes, and recovers", () => {
  const ready = meleeSwingPitch(0);
  const windup = meleeSwingPitch(COMBAT_BEAT * 0.35);
  const strike = meleeSwingPitch(COMBAT_BEAT * 0.66);
  const recovered = meleeSwingPitch(COMBAT_BEAT * 0.98);
  assert.ok(windup > ready, "weapon raises during windup");
  assert.ok(strike < ready, "weapon cuts through on impact");
  assert.ok(Math.abs(recovered) < Math.abs(strike), "weapon returns toward rest");
});

test("bow draw peaks before release and resets after impact", () => {
  assert.equal(bowDrawAmount(0), 0);
  assert.ok(bowDrawAmount(COMBAT_BEAT * 0.55) > 0.9);
  assert.ok(bowDrawAmount(COMBAT_BEAT * 0.9) < 0.35);
});

test("projectile progress clamps to the complete flight", () => {
  assert.equal(projectileProgress(-1, 0.4), 0);
  assert.equal(projectileProgress(0.2, 0.4), 0.5);
  assert.equal(projectileProgress(2, 0.4), 1);
});

test("Magic Arrow and Fireball have distinct visual identities", () => {
  const arrow = spellProjectileProfile("magicarrow");
  const fireball = spellProjectileProfile("fireball");
  assert.notDeepEqual(arrow, fireball);
  assert.ok(fireball.coreScale > arrow.coreScale);
  assert.ok(fireball.impactScale > arrow.impactScale);
  assert.notEqual(fireball.core, arrow.core);
  assert.notEqual(fireball.trail, arrow.trail);
});

test("Teleport and Recall have distinct departure and arrival identities", () => {
  const teleport = travelEffectProfile("teleport");
  const recall = travelEffectProfile("recall");
  assert.notDeepEqual(teleport, recall);
  assert.notEqual(teleport.source, recall.source);
  assert.notEqual(teleport.destination, recall.destination);
});
