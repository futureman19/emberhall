import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gloomPhase, gloomBoltDamage, gloomLightAt, GLOOM_SPAWNS, tickGloomwraith, ensureGloomwraiths } from './gloomwraith.ts';
import { createWorld } from './world.ts';
import { EMBERDEEP_ANCHORS } from './emberdeep.ts';

test('guard anchors match framework and retreat escapes even a fully lit neighbourhood', () => {
  const w=createWorld(42), p=w.people.find(p=>p.isPlayer)!;
  for(const a of GLOOM_SPAWNS) assert.deepEqual(a, (({id,roomId,tx,ty})=>({id,roomId,tx,ty}))(EMBERDEEP_ANCHORS.find(x=>x.id===a.id)!));
  ensureGloomwraiths(w);
  const c=w.fauna.find(c=>c.id===GLOOM_SPAWNS[0]!.id)!;
  p.x=c.x+2;p.z=c.z;w.player.wear={main:'torch'};w.player.invisUntil=0;
  const before=Math.hypot(c.x-p.x,c.z-p.z);
  tickGloomwraith(w,c,.1);
  assert.ok(Math.hypot(c.x-p.x,c.z-p.z)>before, 'must retreat through decreasing light rather than freeze');
});
test('hidden ambush cannot begin casting until visible window', () => {
  const w=createWorld(42),p=w.people.find(p=>p.isPlayer)!;
  ensureGloomwraiths(w);
  const c=w.fauna.find(c=>c.id===GLOOM_SPAWNS[0]!.id)!;
  p.x=c.x+3;p.z=c.z;w.player.wear={};w.player.invisUntil=0;
  tickGloomwraith(w,c,.1);assert.equal(c.gloom!.phase,'prowl');
  c.gloom!.clock=3;tickGloomwraith(w,c,.1);assert.equal(c.gloom!.phase,'windup');
});

for (const torch of [false, true]) test(`real bolt resolves once, torch=${torch}`, () => {
  const w = createWorld(42); ensureGloomwraiths(w); const p = w.people.find(p => p.isPlayer)!;
  const c = w.fauna.find(c => c.id === GLOOM_SPAWNS[0]!.id)!;
  p.x=c.x+3; p.z=c.z; p.hp=100; w.player.wear={};
  w.player.invisUntil=0; w.player.blessUntil=0; w.player.ironwoodUntil=0;
  if(torch) w.player.wear.main='torch';
  c.gloom={clock:3,phase:'windup',time:0,targetX:p.x,targetZ:p.z};
  tickGloomwraith(w,c,.65); assert.equal(p.hp,100); assert.equal(c.gloom.phase,'bolt');
  tickGloomwraith(w,c,.35); assert.equal(p.hp,100-gloomBoltDamage(torch));
  tickGloomwraith(w,c,.1); assert.equal(p.hp,100-gloomBoltDamage(torch));
});
test('spawn hydration is idempotent and dead anchors do not resurrect', () => {
  const w=createWorld(42); ensureGloomwraiths(w); const c=w.fauna.find(c=>c.id===GLOOM_SPAWNS[0]!.id)!;
  c.task='dead';c.hp=0;ensureGloomwraiths(w);ensureGloomwraiths(w);
  assert.equal(w.fauna.filter(c=>c.kind==='gloomwraith').length,2);
  assert.equal(c.hp,0);
});

test('darkness alternates concealed ambush and visible cast windows', () => {
  assert.equal(gloomPhase(0, false), 'hidden');
  assert.equal(gloomPhase(2.99, false), 'hidden');
  assert.equal(gloomPhase(3, false), 'visible');
  assert.equal(gloomPhase(6, false), 'hidden');
  assert.equal(gloomPhase(0, true), 'visible');
});
test('lit torch suppresses bolt damage without making damage negative', () => {
  assert.equal(gloomBoltDamage(false), 11);
  assert.equal(gloomBoltDamage(true), 4);
});
test('sparse dark guard anchors and equipped torch lighting', () => {
  const w = createWorld(42); ensureGloomwraiths(w); const p = w.people.find(p => p.isPlayer)!;
  assert.equal(GLOOM_SPAWNS.length, 2);
  for (const a of GLOOM_SPAWNS) assert.equal(gloomLightAt(w, a.tx, a.ty), false);
  p.x = GLOOM_SPAWNS[0]!.tx; p.z = GLOOM_SPAWNS[0]!.ty;
  w.player.wear.main = 'torch';
  assert.equal(gloomLightAt(w, p.x + 2, p.z), true);
  assert.equal(gloomLightAt(w, p.x + 8, p.z), false);
  w.player.wear.main = undefined;
  assert.equal(gloomLightAt(w, p.x, p.z), false);
});
