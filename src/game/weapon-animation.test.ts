import assert from "node:assert/strict";
import test from "node:test";
import { COMBAT_BEAT } from "./combat-animation.ts";
import { weaponForm, weaponPose, WEAPON_PROFILES } from "./weapon-animation.ts";
import { commandEquip, commandUnequip } from "./player.ts";
import { getPersonalActionFx } from "./personal-action-animation.ts";
import { createWorld } from "./world.ts";

const forms = ["dagger", "spear", "war_axe"] as const;
test("only the three forged forms opt into new poses", () => {
  for (const form of forms) assert.equal(weaponForm(form), form);
  for (const item of [null, "sword", "knife", "bow"]) assert.equal(weaponForm(item), null);
});
test("distinct visual timing preserves the shared combat damage beat", () => {
  assert.deepEqual(forms.map(f => WEAPON_PROFILES[f].windup), [0.78, 0.56, 0.7]);
  assert.deepEqual(forms.map(f => WEAPON_PROFILES[f].draw), [0.48, 0.7, 0.82]);
  for (const f of forms) assert.equal(WEAPON_PROFILES[f].beat, COMBAT_BEAT);
});
for (const form of forms) {
  test(`${form}: draw and sheathe are reverse paths with finite endpoints`, () => {
    const duration = WEAPON_PROFILES[form].draw;
    assert.deepEqual(weaponPose(form, "draw", duration), weaponPose(form, "idle", 0));
    assert.deepEqual(weaponPose(form, "sheathe", 0), weaponPose(form, "idle", 0));
    const draw = Object.values(weaponPose(form, "draw", duration * 0.3));
    const stow = Object.values(weaponPose(form, "sheathe", duration * 0.7));
    draw.forEach((value, i) => assert.ok(Math.abs(value - stow[i]) < 1e-12));
    assert.notDeepEqual(weaponPose(form, "draw", 0), weaponPose(form, "idle", 0));
    for (const age of [-2, NaN, Infinity, 999]) assert.ok(Object.values(weaponPose(form, "draw", age)).every(Number.isFinite));
  });
  test(`${form}: windup, impact and recovery have no pose pop at damage boundary`, () => {
    const idle = weaponPose(form, "idle", 0);
    const windup = weaponPose(form, "attack", COMBAT_BEAT * WEAPON_PROFILES[form].windup);
    const strike = weaponPose(form, "attack", COMBAT_BEAT);
    assert.notDeepEqual(idle, windup);
    assert.deepEqual(strike, weaponPose(form, "hit", 0));
    assert.deepEqual(weaponPose(form, "hit", WEAPON_PROFILES[form].recover), idle);
    if (form === "war_axe") assert.ok(windup.pitch > 2.5 && strike.pitch > 1 && strike.pitch < windup.pitch);
    else assert.ok(strike.reach > 0.25 && strike.pitch > 1);
  });
  test(`${form}: real equipment commands provide draw/stow identity without changing inventory`, () => {
    const world = createWorld(17);
    world.player.pack[form] = 1;
    commandEquip(world, form);
    assert.equal(world.player.wear.main, form);
    assert.equal(getPersonalActionFx(world)?.kind, "equipment");
    assert.equal(getPersonalActionFx(world)?.item, form);
    commandUnequip(world, "main");
    const fx = getPersonalActionFx(world);
    assert.ok(fx?.kind === "equipment" && fx.direction === "unequip");
    assert.equal(fx.item, form);
    assert.equal(world.player.pack[form], 1);
    assert.equal(world.player.wear.main, undefined);
  });
}
test("spear lunges farther than dagger and axe remains an overhead cleave", () => {
  const [dagger, spear, axe] = forms.map(f => weaponPose(f, "attack", COMBAT_BEAT));
  assert.ok(spear.reach > dagger.reach);
  assert.ok(spear.lean > dagger.lean);
  assert.ok(axe.pitch < dagger.pitch);
});
