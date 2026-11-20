import type { Creature, World } from './types.ts';
import { EMBERDEEP_ROOMS, clearEmberdeepRoom, emberdeepState, emberdeepRoomAt } from './emberdeep.ts';
import { emberdeepSpawns, monsterSight } from './emberdeep-monsters.ts';
import { crawlerSpawns } from './embercrawler.ts';
import { GLOOM_SPAWNS } from './gloomwraith.ts';
import { spawn, strikePlayer } from './ecology.ts';
import { astar, walkable } from './pathfinding.ts';
import { addToPile } from './piles.ts';
import { log } from './world.ts';
import { sanctuaryAt } from './zones.ts';
export const WARDEN_ID = 'emberdeep:furnace:warden';
export const WARDEN_STATS = {
  1: { speed: 1.05, reach: 3.4, radius: 1.5, windup: 1.1, recovery: 1.8 },
  2: { speed: 1.75, reach: 5, radius: 5, windup: .85, recovery: 1.0 },
} as const;
export const wardenPhase = (c: Creature): 1|2 => c.hp <= c.maxHp * .5 ? 2 : 1;
export const dungeonSpawns = (w: World) => [...emberdeepSpawns(), ...crawlerSpawns(w.seed), ...GLOOM_SPAWNS];
/** All authored species own a room together. Missing live/tombstone entries are not kills. */
export function updateFurnace(w: World) {
  const state = emberdeepState(w);
  const anchors = dungeonSpawns(w);
  for (const r of EMBERDEEP_ROOMS) {
    if (r.id === 'furnace') continue;
    const members = anchors.filter(a => a.roomId === r.id);
    if (members.length && members.every(a => w.fauna.some(c => c.id === a.id && c.task === 'dead')))
      clearEmberdeepRoom(w, r.id);
  }
  const p = w.people.find(p => p.isPlayer);
  const inside = !!p && emberdeepRoomAt(p.x,p.z)?.id === 'furnace';
  const c = w.fauna.find(c => c.id === WARDEN_ID);
  if (state.bossDefeated) { state.bossDoorOpen = true; return; }
  // A simultaneous kill counts as a clear; loot remains after resurrection.
  if (c && (c.hp <= 0 || c.task === 'dead')) {
    state.bossDefeated = true; state.bossDoorOpen = true; state.bossEncounter = 'ready';
    clearEmberdeepRoom(w,'furnace');
    addToPile(w,Math.round(c.x),Math.round(c.z),{furnace_heart:1},'corpse',Number.MAX_SAFE_INTEGER,'Furnace Heart — first clear');
    log(w,'The Furnace Warden falls. Emberdeep is free. Claim its Furnace Heart; a forge can reclaim six ingots.');
    return;
  }
  if (!p || p.hp <= 0 || p.ghost || w.player.ghost) {
    if(state.bossEncounter === 'fighting') {
      state.bossEncounter = 'reset';
      w.fauna = w.fauna.filter(c=>c.id!==WARDEN_ID);
    }
    state.bossDoorOpen = state.bossEncounter === 'reset' || ['cinder','cistern','forge','vault'].every(id=>state.cleared.some(r=>r===id));
    return;
  }
  if(state.bossEncounter === 'reset') {
    state.bossDoorOpen = true;
    if(!inside) state.bossEncounter = 'ready';
    return;
  }
  const unlocked = ['cinder','cistern','forge','vault'].every(id=>state.cleared.some(r=>r===id));
  if(!unlocked) { state.bossDoorOpen = false; return; }
  if(inside) {
    if(!c) { const boss=spawn(w,'furnace_warden',1106,674);boss.id=WARDEN_ID;w.fauna=[...w.fauna,boss]; }
    state.bossEncounter = 'fighting';state.bossDoorOpen = false;
  } else {
    // Includes an interrupted encounter loaded outside the chamber.
    state.bossDoorOpen = true;
    if(state.bossEncounter === 'fighting') {
      w.fauna=w.fauna.filter(c=>c.id!==WARDEN_ID);state.bossEncounter='ready';
    }
  }
}
export function tickWarden(w:World,c:Creature,dt:number) {
  if(c.kind!=='furnace_warden'||c.hp<=0||c.task==='dead'||w.emberdeep?.bossEncounter!=='fighting')return;
  const p=w.people.find(p=>p.isPlayer);
  if(!p||p.hp<=0||p.ghost||w.player.ghost||emberdeepRoomAt(p.x,p.z)?.id!=='furnace')return;
  const s=c.monster??={phase:'patrol',time:0,targetX:c.x,targetZ:c.z};
  const stats=WARDEN_STATS[wardenPhase(c)];
  if(w.hour<w.player.invisUntil||sanctuaryAt(w,p.x,p.z)||(c.blindUntil&&w.hour<c.blindUntil)){s.phase='patrol';s.time=0;c.path=[];return;}
  c.task='fight';
  const d=Math.hypot(p.x-c.x,p.z-c.z);
  if(s.phase==='patrol') {
    if(d<=stats.reach&&monsterSight(w,c.x,c.z,p.x,p.z)){
      c.path=[];s.phase='windup';s.time=0;
      // Phase two circle is centered on boss, locked until impact.
      s.targetX=wardenPhase(c)===2?c.x:p.x;s.targetZ=wardenPhase(c)===2?c.z:p.z;return;
    }
    if(!c.path.length)c.path=(astar(w,Math.round(c.x),Math.round(c.z),Math.round(p.x),Math.round(p.z),1800)??[]).map(n=>({tx:n.x,ty:n.y}));
    const n=c.path[0];if(!n||!walkable(w,n.tx,n.ty))return;
    const len=Math.hypot(n.tx-c.x,n.ty-c.z);if(len<.05){c.path.shift();return;}
    const step=Math.min(len,stats.speed*dt);c.x+=(n.tx-c.x)/len*step;c.z+=(n.ty-c.z)/len*step;return;
  }
  s.time+=dt;
  if(s.phase==='windup'&&s.time>=stats.windup){s.phase='strike';s.time=0;}
  else if(s.phase==='strike'&&s.time>=.15){
    if(Math.hypot(p.x-s.targetX,p.z-s.targetZ)<=stats.radius&&monsterSight(w,c.x,c.z,p.x,p.z))strikePlayer(w,c,p);
    s.phase='recover';s.time=0;
  }else if(s.phase==='recover'&&s.time>=stats.recovery){s.phase='patrol';s.time=0;}
}
