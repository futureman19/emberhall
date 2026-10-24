import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from './world.ts';
import { FAUNA_META } from './catalog.ts';
import { spawn, tickEcology } from './ecology.ts';
import { walkable } from './pathfinding.ts';
import { EMBERDEEP_TORCHES } from './emberdeep.ts';
import { CRAWLER_STATS, CRAWLER_SPAWN_WEIGHTS, crawlerSpawns, ensureEmbercrawlers, tickEmbercrawler, crawlerTorchTarget } from './embercrawler.ts';

function fixture() {
  const w = createWorld(41); w.fauna = [];
  const p = w.people.find(p => p.isPlayer)!;
  p.x = 1024; p.z = 674; p.hp = p.maxHp = 100;
  w.player.invisUntil = 0;
  const c = spawn(w, 'embercrawler', 1023, 674); w.fauna.push(c);
  return { w, p, c };
}
test('low HP fast skirmisher and corridor-weighted deterministic pair spawns', () => {
  assert.equal(FAUNA_META.embercrawler.hp, 20);
  assert(CRAWLER_STATS.speed > 3); assert(CRAWLER_STATS.windup < .3);
  assert(CRAWLER_SPAWN_WEIGHTS.corridor > CRAWLER_SPAWN_WEIGHTS.chamber);
  const a = crawlerSpawns(41); assert.deepEqual(a, crawlerSpawns(41));
  assert(a.filter(x => x.role === 'corridor').length > a.filter(x => x.role === 'chamber').length);
  assert(a.some(x => x.id.endsWith(':1'))); assert(a.some(x => x.role === 'chamber'));
  const { w } = fixture(); for (const x of a) assert(walkable(w, x.tx, x.ty), x.id);
  ensureEmbercrawlers(w); const ids = w.fauna.map(c => c.id); ensureEmbercrawlers(w);
  assert.deepEqual(w.fauna.map(c => c.id), ids);
});
test('lunge moves, strikes once, then retreats and recovers', () => {
  const { w, p, c } = fixture();
  tickEmbercrawler(w,c,.05); assert.equal(c.crawler?.phase,'windup');
  tickEmbercrawler(w,c,.25); assert.equal(c.crawler?.phase,'lunge');
  const x = c.x; tickEmbercrawler(w,c,.1); assert(c.x > x);
  tickEmbercrawler(w,c,.1); assert.equal(c.crawler?.phase,'retreat'); assert(p.hp < 100);
  const hp = p.hp, near = Math.hypot(c.x-p.x,c.z-p.z);
  for(let i=0;i<12;i++) tickEmbercrawler(w,c,.05);
  assert(Math.hypot(c.x-p.x,c.z-p.z)>near); assert.equal(p.hp,hp);
  for(let i=0;i<20;i++) tickEmbercrawler(w,c,.05);
  assert.notEqual(c.crawler?.phase,'retreat');
});
test('dodging the committed lunge avoids damage; ghosts and walls are safe', () => {
  const { w,p,c }=fixture(); tickEmbercrawler(w,c,.05); tickEmbercrawler(w,c,.25);
  p.z+=3; for(let i=0;i<8;i++) tickEmbercrawler(w,c,.05); assert.equal(p.hp,100);
  p.ghost=true; tickEmbercrawler(w,c,.05); assert.equal(c.crawler?.phase,'patrol');
  c.x=1087;c.z=674;c.home={tx:1087,ty:674};p.x=1090;p.z=674;p.ghost=false;
  for(let i=0;i<30;i++) tickEmbercrawler(w,c,.05); assert.equal(p.hp,100);assert(c.x<1089);
});
test('patrol is attracted to the actual shared torch prop positions', () => {
  const {w,p,c}=fixture(); p.x=650;p.z=565;
  const torch=EMBERDEEP_TORCHES.find(t=>t.roomId==='cinder')!;
  c.x=torch.tx+4;c.z=torch.ty;c.home={tx:c.x,ty:c.z};
  assert.deepEqual(crawlerTorchTarget(w,c),torch);
  const d=Math.hypot(c.x-torch.tx,c.z-torch.ty);
  for(let i=0;i<20;i++) tickEmbercrawler(w,c,.05);
  assert(Math.hypot(c.x-torch.tx,c.z-torch.ty)<d);
});
test('ecology respects paralysis and keeps authored death tombstones from respawning', () => {
  const {w,c}=fixture(); c.paralyzeUntil=w.hour+1; tickEcology(w,.5);assert.equal(c.crawler,undefined);
  ensureEmbercrawlers(w);const a=w.fauna.find(c=>c.id.startsWith('embercrawler:'))!;
  a.task='dead';a.hp=0;a.corpseUntil=w.hour-1;tickEcology(w,.1);ensureEmbercrawlers(w);
  assert.equal(w.fauna.find(c=>c.id===a.id)?.task,'dead');
});
