import assert from "node:assert/strict";
import test from "node:test";
import { Matrix4, RingGeometry, Vector3 } from "three";
import { TERRAIN_STREAM_WINDOW } from "./terrain-stream.ts";
import { groundY } from "./height.ts";
import { tickWorld } from "./sim.ts";
import { setWorld } from "./live.ts";
import { createWorld } from "./world.ts";
import { castNow, commandCast } from "./magery.ts";
import { CAST_WINDUP, SPELL_EFFECT_CAP, spellImpactOpacityScale, clearSpellEffects, emitSpellEffect, spellEffects, spellFlightProgress, visitSpellStatuses } from "./spell-effects.ts";

import * as spellVisuals from "./spell-effects.ts";

const event = { spell: "fireball" as const, x: 1, z: 2, tx: 3, tz: 4, at: 12, outcome: "success" as const };
test("crowded impact bodies share one opacity budget without dimming distant casts", () => {
  assert.equal(spellImpactOpacityScale([event], event), 1);
  const nearby = { ...event, tx: event.tx + 0.2 };
  const far = { ...event, tx: event.tx + 4 };
  const fizzle = { ...event, outcome: "fizzle" as const };
  assert.equal(spellImpactOpacityScale([event, nearby, far, fizzle], event), 0.5);
  assert.equal(spellImpactOpacityScale([event, nearby, far, fizzle], far), 1);
  const burst = Array.from({ length: SPELL_EFFECT_CAP }, () => ({ ...event }));
  assert.ok(burst.reduce((sum, fx) => sum + spellImpactOpacityScale(burst, fx), 0) <= 1.000001);
  assert.equal(spellImpactOpacityScale([], event), 1);
});

test("world-owned bounded events overlap, snapshot, expire and never cross a replacement", () => {
  const world = createWorld(7); world.hour = 12;
  emitSpellEffect(world, event);
  emitSpellEffect(world, { ...event, spell: "heal" });
  assert.equal(spellEffects(world).length, 2);
  assert.ok(Object.isFrozen(spellEffects(world)[0]));
  assert.equal(spellEffects(createWorld(7)).length, 0);
  clearSpellEffects(world);
  assert.equal(spellEffects(world).length, 0);
  for (let i = 0; i < 50; i++) emitSpellEffect(world, event);
  assert.equal(spellEffects(world).length, SPELL_EFFECT_CAP);
  world.hour += 1;
  assert.equal(spellEffects(world).length, 0);
  world.hour = 12; emitSpellEffect(world, event); world.hour = 11;
  assert.equal(spellEffects(world).length, 0);
});
test("flight is anticipation within existing windup, never a delayed damage promise", () => {
  assert.equal(CAST_WINDUP, 0.92);
  assert.equal(spellFlightProgress("fireball", 0.3), null);
  assert.equal(spellFlightProgress("fireball", 0.62), 0);
  assert.ok(spellFlightProgress("fireball", 0.8)! > 0);
  assert.equal(spellFlightProgress("fireball", CAST_WINDUP), null);
  assert.equal(spellFlightProgress("heal", 0.8), null);
});
test("status indicators derive from actual deadlines and disappear on cure, death or expiry", () => {
  const w = createWorld(7); w.hour = 12;
  w.player.blessUntil = 13; w.player.poisonUntil = 13;
  w.fauna = [];
  const read = () => { const statuses: string[] = []; visitSpellStatuses(w, (_x, _z, spell) => statuses.push(spell)); return statuses; };
  assert.deepEqual(read(), ["poison", "bless"]);
  w.player.poisonUntil = 0; assert.deepEqual(read(), ["bless"]);
  w.player.ghost = true; assert.deepEqual(read(), []);
  w.player.ghost = false; w.hour = 13; assert.deepEqual(read(), []);
});
test("fauna status seals follow moving targets, expire and obey a hard cap", () => {
  const w = createWorld(7); const p = w.people.find(p => p.isPlayer)!;
  const seed = { id: "status", kind: "wolf" as const, x: p.x + 1, z: p.z, hp: 100, maxHp: 100, path: [], task: "idle" as const, taskUntil: 99, corpseUntil: 0, home: { tx: 1, ty: 1 }, ownerId: null, loyalty: 0, stay: false, poisonUntil: w.hour + 1, paralyzeUntil: w.hour + 1, curseUntil: w.hour + 1, boundUntil: w.hour + 1 };
  w.fauna = [seed];
  spellVisuals.refreshSpellStatuses(w);
  const ids: string[] = [];
  assert.equal(visitSpellStatuses(w, (_x, _z, spell) => ids.push(spell)), 4);
  assert.deepEqual(ids, ["poison", "paralyze", "curse", "summon"]);
  seed.x += 2;
  visitSpellStatuses(w, x => assert.equal(x, seed.x));
  w.fauna = Array.from({ length: 50 }, (_, i) => ({ ...seed, id: `status-${i}` }));
  spellVisuals.refreshSpellStatuses(w);
  assert.equal(visitSpellStatuses(w, () => {}), 32);
  w.hour += 1;
  assert.equal(visitSpellStatuses(w, () => {}), 0);
});

test("status traversal is bounded and excludes corpses, removed entities and distant beasts", () => {
  const w = createWorld(7); const p = w.people.find(p => p.isPlayer)!;
  const beast = { id: "status", kind: "wolf" as const, x: p.x + 1, z: p.z, hp: 100, maxHp: 100, path: [], task: "idle" as const, taskUntil: w.hour + 99, corpseUntil: 0, home: { tx: 1, ty: 1 }, ownerId: null, loyalty: 0, stay: false, poisonUntil: w.hour + 1, paralyzeUntil: w.hour + 1, curseUntil: w.hour + 1, boundUntil: w.hour + 1 };
  w.fauna = Array.from({ length: 30 }, (_, i) => ({ ...beast, id: `status-${i}` }));
  spellVisuals.refreshSpellStatuses(w);
  assert.equal(visitSpellStatuses(w, () => {}), 32);
  w.fauna = [{ ...beast, task: "dead" }, { ...beast, x: p.x + 40 }];
  spellVisuals.refreshSpellStatuses(w);
  assert.equal(visitSpellStatuses(w, () => {}), 0);
  w.fauna = [beast]; spellVisuals.refreshSpellStatuses(w); assert.equal(visitSpellStatuses(w, () => {}), 4);
  w.fauna = []; assert.equal(visitSpellStatuses(w, () => {}), 0);
});

test("render status examination is bounded with thousands of inactive/distant creatures before a nearby affected one", () => {
  const w = createWorld(7); const p = w.people.find(p => p.isPlayer)!;
  const seed = { ...w.fauna[0], hp: 100, task: "idle" as const, poisonUntil: 0, paralyzeUntil: 0, curseUntil: 0, boundUntil: 0 };
  let examinations = 0;
  w.fauna = Array.from({ length: 10000 }, (_, i) => new Proxy({ ...seed, id: `budget-${i}`, x: p.x + (i % 2 ? 100 : 1), z: p.z, poisonUntil: i % 2 ? w.hour + 1 : 0 }, {
    get(target, key, receiver) { if (key === "task") examinations++; return Reflect.get(target, key, receiver); },
  }));
  const near = { ...seed, id: "last-near", x: p.x + 2, z: p.z, poisonUntil: w.hour + 1 };
  w.fauna.push(near);
  // Preparation belongs to simulation/load boundaries, never the render visitor.
  let indexReads = 0;
  w.fauna = new Proxy(w.fauna, {
    get(target, key, receiver) { if (typeof key === "string" && /^\d+$/.test(key)) indexReads++; return Reflect.get(target, key, receiver); },
  });
  spellVisuals.refreshSpellStatuses(w);
  examinations = 0; indexReads = 0;
  for (let frame = 0; frame < 60; frame++) {
    const xs: number[] = [];
    assert.equal(visitSpellStatuses(w, x => xs.push(x)), 1);
    assert.deepEqual(xs, [near.x]);
  }
  assert.equal(examinations, 0, `render examined ${examinations} unrelated fauna`);
  assert.equal(indexReads, 60, "one candidate identity lookup per frame, no source traversal");
  near.poisonUntil = w.hour;
  indexReads = 0;
  assert.equal(visitSpellStatuses(w, () => {}), 0);
  assert.equal(indexReads, 1, "expiry cannot trigger a render-side refill scan");
});

test("status cache drops in-place removals, resets and clock rewind without retaining old world entities", () => {
  const w = createWorld(7); const p = w.people.find(p => p.isPlayer)!;
  w.fauna = [{ ...w.fauna[0], x: p.x, z: p.z, hp: 100, task: "idle", poisonUntil: w.hour + 1 }];
  spellVisuals.refreshSpellStatuses(w);
  assert.equal(visitSpellStatuses(w, () => {}), 1);
  const removed = w.fauna.pop()!;
  assert.equal(visitSpellStatuses(w, () => {}), 0);
  w.fauna.push(removed); spellVisuals.refreshSpellStatuses(w);
  clearSpellEffects(w);
  assert.equal(visitSpellStatuses(w, () => {}), 0);
  spellVisuals.refreshSpellStatuses(w); w.hour -= 1;
  assert.equal(visitSpellStatuses(w, () => {}), 0);
});

test("simulation refresh brings distant live statuses into range and world loading rebuilds persisted deadlines", () => {
  const w = createWorld(7); const p = w.people.find(p => p.isPlayer)!;
  const beast = { ...w.fauna[0], x: p.x + 40, z: p.z, hp: 100, task: "idle" as const, taskUntil: w.hour + 99, paralyzeUntil: w.hour + 1 };
  w.fauna = [beast];
  setWorld(w);
  assert.equal(visitSpellStatuses(w, () => {}), 0);
  beast.x = p.x + 1;
  w.speed = 1; tickWorld(w, 0.02);
  assert.equal(visitSpellStatuses(w, () => {}), 1);
  beast.paralyzeUntil = 0;
  assert.equal(visitSpellStatuses(w, () => {}), 0);
  beast.paralyzeUntil = w.hour + 1;
  w.fauna.splice(0, 1); tickWorld(w, 0.02);
  assert.equal(visitSpellStatuses(w, () => {}), 0);
  w.fauna.push(beast); setWorld(w);
  assert.equal(visitSpellStatuses(w, () => {}), 1);
  const replacement = createWorld(7); setWorld(replacement);
  assert.equal(visitSpellStatuses(w, () => {}), 0);
  assert.equal(visitSpellStatuses(replacement, () => {}), 0);
});

test("routine status updates examine active creatures only and retain distant overflow for re-entry", () => {
  const w = createWorld(7); const p = w.people.find(p => p.isPlayer)!;
  const seed = { ...w.fauna[0], hp: 100, task: "idle" as const, poisonUntil: 0, paralyzeUntil: 0, curseUntil: 0, boundUntil: 0, x: p.x + 1, z: p.z };
  w.fauna = Array.from({ length: 10000 }, (_, i) => ({ ...seed, id: `inactive-${i}` }));
  const active = Array.from({ length: 40 }, (_, i) => ({ ...seed, id: `active-${i}`, x: p.x + 100, poisonUntil: w.hour + 1 }));
  w.fauna.push(...active);
  let reads = 0;
  w.fauna = new Proxy(w.fauna, { get(target, key, receiver) {
    if (typeof key === "string" && /^\d+$/.test(key)) reads++;
    return Reflect.get(target, key, receiver);
  } });
  spellVisuals.refreshSpellStatuses(w);
  const update = () => spellVisuals.updateSpellStatuses(w);
  reads = 0;
  for (let i = 0; i < 60; i++) update();
  assert.ok(reads <= 40 * 60, `routine status updates read ${reads} source entries`);
  active[39].x = p.x + 1; update();
  assert.equal(visitSpellStatuses(w, () => {}), 1, "distant active entries beyond render cap must re-enter");
  w.hour += 1; update(); reads = 0; update();
  assert.equal(reads, 0, "expired active entries are pruned without rescanning inactive fauna");
  w.hour -= 1; update();
  assert.equal(visitSpellStatuses(w, () => {}), 1, "rewind rebuilds deadlines from source");
  w.fauna.splice(0, 1); update();
  assert.equal(visitSpellStatuses(w, () => {}), 1, "index shifts preserve remaining active creatures");
  w.fauna = [{ ...seed, id: "replacement", poisonUntil: w.hour + 1 }]; update();
  assert.equal(visitSpellStatuses(w, () => {}), 1);
  w.fauna[0] = { ...seed, id: "same-length-replacement", curseUntil: w.hour + 1 }; update();
  const spells: string[] = []; visitSpellStatuses(w, (_x, _z, spell) => spells.push(spell));
  assert.deepEqual(spells, ["curse"]);
});

test("inactive same-length fauna replacement invalidates status membership without routine rescans", () => {
  const w = createWorld(7), p = w.people.find(p => p.isPlayer)!;
  const inactive = { ...w.fauna[0], hp: 100, task: "idle" as const, x: p.x + 1, z: p.z,
    poisonUntil: 0, paralyzeUntil: 0, curseUntil: 0, boundUntil: 0 };
  w.fauna = Array.from({ length: 10000 }, (_, i) => ({ ...inactive, id: `inactive-${i}` }));
  let reads = 0;
  w.fauna = new Proxy(w.fauna, { get(target, key, receiver) {
    if (typeof key === "string" && /^\d+$/.test(key)) reads++;
    return Reflect.get(target, key, receiver);
  } });
  spellVisuals.refreshSpellStatuses(w);
  reads = 0;
  for (let i = 0; i < 60; i++) spellVisuals.updateSpellStatuses(w);
  assert.equal(reads, 0);
  w.fauna.splice(9999, 1, { ...inactive, id: "replacement", poisonUntil: w.hour + 1 });
  spellVisuals.updateSpellStatuses(w);
  assert.equal(visitSpellStatuses(w, () => {}), 1);
  reads = 0;
  for (let i = 0; i < 60; i++) spellVisuals.updateSpellStatuses(w);
  assert.ok(reads <= 60, `replacement caused routine rescans: ${reads}`);
  w.fauna[9999] = { ...inactive, id: "inactive-again" };
  spellVisuals.updateSpellStatuses(w);
  assert.equal(visitSpellStatuses(w, () => {}), 0);
  w.fauna.splice(0, 1, { ...inactive, id: "spliced-active", curseUntil: w.hour + 1 });
  spellVisuals.updateSpellStatuses(w);
  assert.equal(visitSpellStatuses(w, () => {}), 1);
  // The live world must remain structured-cloneable for Vault preflight.
  w.fauna = w.fauna.map(c => ({ ...c }));
  spellVisuals.refreshSpellStatuses(w);
  assert.doesNotThrow(() => structuredClone(w));
  assert.equal(Object.keys(w.fauna).includes("splice"), false);
  assert.equal(JSON.stringify(w.fauna), JSON.stringify(structuredClone(w.fauna)));
});

test("status seal footprint stays above sloping and uneven terrain without losing flat-ground placement", () => {
  const w = createWorld(7);
  const x = 64.125, z = 64.25;
  for (const shape of ["flat", "slope", "ridge"] as const) {
    for (let tz = 58; tz <= 70; tz++) for (let tx = 58; tx <= 70; tx++) {
      w.tiles[tz][tx].kind = "grass";
      w.tiles[tz][tx].h = 20 + (shape === "slope" ? (tx - 64) * 2 + (tz - 64) * 3 : shape === "ridge" && tx === 65 ? 8 : 0);
    }
    for (let lane = 0; lane < 4; lane++) {
      const m = Array<number>(16).fill(0);
      spellVisuals.writeSpellStatusMatrix(w, x, z, lane, m);
      assert.ok(m.every(Number.isFinite));
      if (shape === "flat") assert.ok(Math.abs(m[13] - groundY(w, x, z) - .08) < 1e-8);
      // Cover arc edges AND interior between geometry vertices, not just its center.
      for (let j = 0; j <= 24; j++) for (const radius of [.86, .93, 1]) {
        const theta = j / 24 * Math.PI * .4;
        const u = radius * Math.cos(theta), v = radius * Math.sin(theta);
        const wx = m[0] * u + m[4] * v + m[12];
        const wy = m[1] * u + m[5] * v + m[13];
        const wz = m[2] * u + m[6] * v + m[14];
        const clearance = wy - groundY(w, wx, wz);
        assert.ok(clearance >= .07999, `${shape} lane ${lane}: seal buried (clearance ${clearance})`);
      }
    }
  }
});

test("rendered seal triangle interiors clear triangulated terrain on irregular heightfields", () => {
  const w = createWorld(7);
  const geometry = new RingGeometry(.86, 1, 6, 1, 0, Math.PI * .4);
  const step = TERRAIN_STREAM_WINDOW / Math.min(TERRAIN_STREAM_WINDOW * 2, 180);
  const terrainY = (x: number, z: number) => {
    const x0 = Math.floor(x / step) * step, z0 = Math.floor(z / step) * step;
    const u = (x - x0) / step, v = (z - z0) / step;
    const a = groundY(w, x0, z0), b = groundY(w, x0 + step, z0);
    const c = groundY(w, x0, z0 + step), d = groundY(w, x0 + step, z0 + step);
    // terrain.tsx emits a,c,b / b,c,d, not a bilinear surface.
    return u + v <= 1 ? a + u * (b - a) + v * (c - a)
      : d + (1 - u) * (c - d) + (1 - v) * (b - d);
  };
  let samples = 0;
  try {
    for (let field = 0; field < 6; field++) {
      for (let z = 58; z <= 70; z++) for (let x = 58; x <= 70; x++) {
        w.tiles[z][x].kind = "grass";
        w.tiles[z][x].h = 20 + Math.sin(x * 1.7 + field) * 5 + Math.cos(z * 2.1 - field) * 7;
      }
      for (let lane = 0; lane < 4; lane++) {
        const matrix = new Matrix4();
        spellVisuals.writeSpellStatusMatrix(w, 64.125 + field * .07, 64.25, lane, matrix.elements);
        const pos = geometry.attributes.position, indices = geometry.index!;
        for (let i = 0; i < indices.count; i += 3) {
          const a = new Vector3().fromBufferAttribute(pos, indices.getX(i)).applyMatrix4(matrix);
          const b = new Vector3().fromBufferAttribute(pos, indices.getX(i + 1)).applyMatrix4(matrix);
          const c = new Vector3().fromBufferAttribute(pos, indices.getX(i + 2)).applyMatrix4(matrix);
          for (let u = 0; u <= 8; u++) for (let v = 0; v <= 8 - u; v++) {
            const point = a.clone().multiplyScalar(1 - (u + v) / 8).addScaledVector(b, u / 8).addScaledVector(c, v / 8);
            assert.ok(point.y - terrainY(point.x, point.z) >= .07999, `field ${field}, lane ${lane}: buried triangle`);
            samples++;
          }
        }
      }
    }
    assert.ok(samples > 10000);
  } finally { geometry.dispose(); }
});

test("label chooses current windup before latest live release, including same-clock overlap", () => {
  assert.equal(typeof spellVisuals.selectSpellLabel, "function");
  const w = createWorld(7); w.hour = 12;
  const p = w.people.find(p => p.isPlayer)!; p.path = [];
  emitSpellEffect(w, event);
  emitSpellEffect(w, { ...event, spell: "bless" });
  assert.equal(spellVisuals.selectSpellLabel(w)?.spell, "bless");
  w.player.intent = { kind: "cast", spell: "poison", targetId: null, tx: p.x, ty: p.z };
  assert.equal(spellVisuals.selectSpellLabel(w)?.spell, "poison");
  assert.equal(spellVisuals.selectSpellLabel(w)?.phase, "windup");
  w.player.intent.kind = "none";
  emitSpellEffect(w, { ...event, spell: "poison", outcome: "fizzle" });
  assert.equal(spellVisuals.selectSpellLabel(w)?.spell, "poison");
  w.hour += 0.61 / 36;
  assert.equal(spellVisuals.selectSpellLabel(w)?.spell, "bless");
  w.hour += 1;
  assert.equal(spellVisuals.selectSpellLabel(w), null);
  assert.equal(spellVisuals.selectSpellLabel(createWorld(7)), null);
});

test("real casts emit overlapping impacts at unchanged immediate damage boundary; fizzle has no success", () => {
  const w = createWorld(7); const p = w.people.find(p => p.isPlayer)!;
  w.player.pack = { ...w.player.pack, spellbook: 1, pearl: 20, mandrake: 20 };
  w.player.mana = 100; w.player.skills.magery = 100;
  w.fauna = [{ id: "fx-target", kind: "wolf", x: p.x + 1, z: p.z, hp: 100, maxHp: 100, path: [], task: "idle", taskUntil: w.hour + 99, corpseUntil: 0, home: { tx: 1, ty: 1 }, ownerId: null, loyalty: 0, stay: false }];
  const random = Math.random;
  try {
    Math.random = () => 0;
    for (const spell of ["magicarrow", "fireball"] as const) {
      assert.equal(commandCast(w, spell, { kind: "fauna", id: "fx-target" }), null);
      const hp = w.fauna[0].hp;
      castNow(w);
      assert.ok(w.fauna[0].hp < hp);
      assert.equal(spellEffects(w).at(-1)!.at, w.hour);
    }
    assert.equal(spellEffects(w).length, 2);
    Math.random = () => 0.999;
    commandCast(w, "magicarrow", { kind: "fauna", id: "fx-target" });
    const hp = w.fauna[0].hp;
    castNow(w);
    assert.equal(w.fauna[0].hp, hp);
    assert.equal(spellEffects(w).at(-1)!.outcome, "fizzle");
  } finally { Math.random = random; }
});
