import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monsterClip, monsterPose, MONSTER_PHASE_CLIPS, monsterReaction } from './monster-animation.ts';
import type { Creature } from './types.ts';
const creature = (kind: Creature['kind']) => ({kind, task:'idle',hp:40,path:[]} as unknown as Creature);
for(const kind of ['slag_golem','embercrawler','gloomwraith'] as const) {
 test(`${kind}: all behavior phases resolve and death overrides flinch`,()=>{
  const c=creature(kind);
  const key=kind==='slag_golem'?'monster':kind==='embercrawler'?'crawler':'gloom';
  for(const [phase,clip] of Object.entries(MONSTER_PHASE_CLIPS[kind])) {
   Object.assign(c,{[key]:{phase,time:0}});
   assert.equal(monsterClip(c,true,false),clip);
  }
  delete c[key]; assert.equal(monsterClip(c,false,false),'idle');
  assert.equal(monsterClip(c,true,false),'prowl');
  assert.equal(monsterClip(c,true,true),'flinch');
  c.task='dead'; assert.equal(monsterClip(c,true,true),'death');
 });
 test(`${kind}: finite bounded poses, no stale death on idle`,()=>{
  for(const clip of ['idle','prowl','windup','strike','recover','retreat','flinch','death'] as const) {
   for(const age of [-1,0,.1,.5,1,10,Infinity,NaN]) {
    const p=monsterPose(kind,clip,age,age);
    for(const n of Object.values(p)) assert.ok(Number.isFinite(n),`${clip} ${age}`);
    assert.ok(p.opacity>=0&&p.opacity<=1);
   }
  }
  assert.equal(monsterPose(kind,'death',10,0).opacity,0);
  assert.equal(monsterPose(kind,'idle',0,0).opacity,1);
  assert.notDeepEqual(monsterPose(kind,'windup',.1,0),monsterPose(kind,'strike',.1,0));
 });
}
test('phase tables cover each authoritative state vocabulary',()=>{
 assert.deepEqual(Object.keys(MONSTER_PHASE_CLIPS.slag_golem),['patrol','windup','strike','recover']);
 assert.deepEqual(Object.keys(MONSTER_PHASE_CLIPS.embercrawler),['patrol','windup','lunge','retreat']);
 assert.deepEqual(Object.keys(MONSTER_PHASE_CLIPS.gloomwraith),['prowl','windup','bolt','recover']);
});
test('reactions only on HP loss, reset on time reversal and never on initial dead load',()=>{
 let s=monsterReaction(undefined,40,10);
 assert.equal(s.hitAt,null);
 s=monsterReaction(s,35,10.1);assert.equal(s.hitAt,10.1);
 s=monsterReaction(s,35,10.2);assert.equal(s.hitAt,10.1);
 s=monsterReaction(s,40,10.3);assert.equal(s.hitAt,10.1);
 s=monsterReaction(s,40,1);assert.equal(s.hitAt,null);
});
test('distinct death silhouettes: rubble collapse, crawler flip, wraith expansion',()=>{
 const golem=monsterPose('slag_golem','death',.6,0),crawler=monsterPose('embercrawler','death',.6,0),wraith=monsterPose('gloomwraith','death',.6,0);
 assert.ok(golem.rubble>0);assert.ok(crawler.roll>2);assert.ok(wraith.scaleX>1);assert.ok(wraith.y>0);
});
