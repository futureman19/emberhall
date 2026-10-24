import test from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "./world.ts";
import { FAUNA_META } from "./catalog.ts";
import { EMBERDEEP_ANCHORS } from "./emberdeep.ts";
import { ensureEmberdeepMonsters, emberdeepSpawns, MONSTER_STATS, tickEmberdeepMonster } from "./emberdeep-monsters.ts";
import { faunaPhysicalDamage } from "./fauna-defense.ts";

function fixture() {
  const w = createWorld(41); ensureEmberdeepMonsters(w);
  const c = w.fauna.find(c => c.kind === "slag_golem")!;
  const p = w.people.find(p => p.isPlayer)!;
  p.x = c.x; p.z = c.z + 1; p.hp = p.maxHp = 100;
  w.player.invisUntil = 0;
  return { w, c, p };
}
test("golem is an armored slow tank, with registered chamber-only spawns", () => {
  const { w } = fixture();
  assert.ok(FAUNA_META.slag_golem.hp >= 84);
  assert.ok(MONSTER_STATS.slag_golem.speed <= 1.1);
  assert.equal(faunaPhysicalDamage("slag_golem", 10), 6);
  assert.equal(faunaPhysicalDamage("slag_golem", 0), 0);
  assert.equal(faunaPhysicalDamage("wolf", 10), 10);
  assert.equal(emberdeepSpawns().length, 3);
  for (const a of emberdeepSpawns()) {
    assert.ok(EMBERDEEP_ANCHORS.some(b => b.id === a.id));
    assert.equal(a.role, "chamber");
    assert.ok(!["entrance", "furnace"].includes(a.roomId));
    assert.equal(w.fauna.filter(c => c.id === a.id).length, 1);
  }
});
test("heat requires one second of continuous adjacency, resets on leaving and stops on death", () => {
  const { w, c, p } = fixture();
  c.monster = { phase: "recover", time: 0, targetX: p.x, targetZ: p.z };
  tickEmberdeepMonster(w, c, .5); assert.equal(p.hp, 100);
  tickEmberdeepMonster(w, c, .5); assert.equal(p.hp, 97);
  p.z += 4; tickEmberdeepMonster(w, c, .5);
  p.z -= 4; c.monster.phase = "recover"; c.monster.time = 0;
  tickEmberdeepMonster(w, c, .5); assert.equal(p.hp, 97);
  tickEmberdeepMonster(w, c, .5); assert.equal(p.hp, 94);
  c.task = "dead"; c.hp = 0;
  tickEmberdeepMonster(w, c, 1); assert.equal(p.hp, 94);
});
test("slam has a visible windup and can be dodged before impact", () => {
  const { w, c, p } = fixture();
  tickEmberdeepMonster(w, c, .01);
  assert.equal(c.monster?.phase, "windup"); assert.equal(p.hp, 100);
  p.z += 3;
  for (let i = 0; i < 24; i++) tickEmberdeepMonster(w, c, .05);
  assert.equal(p.hp, 100); assert.equal(c.monster?.phase, "recover");
});
