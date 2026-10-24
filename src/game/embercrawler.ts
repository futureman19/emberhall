import type { Creature, World } from './types.ts';
import { EMBERDEEP_ANCHORS, EMBERDEEP_TORCHES, inEmberdeep } from './emberdeep.ts';
import { spawn, strikePlayer } from './ecology.ts';
import { astar, walkable } from './pathfinding.ts';
import { CURSE_SLOW, CHILL_SLOW } from './catalog.ts';
import { sanctuaryAt, zoneFaunaSlowAt } from './zones.ts';

export const CRAWLER_STATS = { speed: 3.4, lungeSpeed: 5.8, aggro: 7, reach: 1.8, windup: .25, lunge: .2, retreat: 1.1 } as const;
export const CRAWLER_SPAWN_WEIGHTS = { corridor: 1, chamber: .35, guard: 0 } as const;
/** Stable seed-local occupancy: all corridors, occasional pairs, two small chambers.
 * Species-prefixed IDs leave other monster anchors and room-clear ownership alone. */
export function crawlerSpawns(seed: number) {
  return EMBERDEEP_ANCHORS.flatMap((a,i) => {
    if (a.role !== 'corridor' && !(a.role === 'chamber' && ['cinder','cistern'].includes(a.roomId))) return [];
    const roll = ((Math.imul(seed ^ (i + 31), 1664525) >>> 0) % 1000) / 1000;
    if (roll > CRAWLER_SPAWN_WEIGHTS[a.role]) return [];
    const count = a.role === 'corridor' && (seed + i) % 2 === 0 ? 2 : 1;
    return Array.from({length:count},(_,n)=>({...a,id:`embercrawler:${a.id}:${n}`,tx:a.tx,ty:a.ty+n}));
  });
}
export function ensureEmbercrawlers(w: World) {
  for (const a of crawlerSpawns(w.seed)) {
    if (w.fauna.some(c=>c.id===a.id) || w.emberdeep?.cleared.includes(a.roomId) || !walkable(w,a.tx,a.ty)) continue;
    const c = spawn(w,'embercrawler',a.tx,a.ty); c.id=a.id; w.fauna.push(c);
  }
}
export function crawlerSight(w: World,x:number,z:number,tx:number,tz:number) {
  const n = Math.ceil(Math.hypot(tx-x,tz-z)*4);
  for(let i=0;i<=n;i++) {
    const t=n?i/n:0;
    if(!walkable(w,Math.round(x+(tx-x)*t),Math.round(z+(tz-z)*t)))return false;
  }
  return true;
}
export function crawlerTorchTarget(w:World,c:Creature) {
  return EMBERDEEP_TORCHES.filter(t=>Math.hypot(t.tx-c.home.tx,t.ty-c.home.ty)<18 && crawlerSight(w,c.x,c.z,t.tx,t.ty))
    .sort((a,b)=>Math.hypot(a.tx-c.x,a.ty-c.z)-Math.hypot(b.tx-c.x,b.ty-c.z))[0] ?? null;
}
function move(w:World,c:Creature,x:number,z:number,speed:number,dt:number,direct=false) {
  const slow=(c.curseUntil&&w.hour<c.curseUntil?CURSE_SLOW:1)*(c.chillUntil&&w.hour<c.chillUntil?CHILL_SLOW:1)*zoneFaunaSlowAt(w,c.x,c.z);
  if (direct) c.path = [{tx:x,ty:z}];
  else if(!c.path.length || Math.hypot(c.path.at(-1)!.tx-x,c.path.at(-1)!.ty-z)>1) {
    c.path=astar(w,Math.round(c.x),Math.round(c.z),Math.round(x),Math.round(z),1800)?.map(n=>({tx:n.x,ty:n.y}))??[];
  }
  const n=c.path[0];if(!n)return;
  const d=Math.hypot(n.tx-c.x,n.ty-c.z);if(d<.05){c.path.shift();return;}
  const step=Math.min(d,speed*dt*slow),nx=c.x+(n.tx-c.x)/d*step,nz=c.z+(n.ty-c.z)/d*step;
  if(!crawlerSight(w,c.x,c.z,nx,nz)||sanctuaryAt(w,nx,nz)){c.path=[];return;}
  c.x=nx;c.z=nz;
}
export function tickEmbercrawler(w:World,c:Creature,dt:number) {
  if(c.kind!=='embercrawler'||c.task==='dead'||c.hp<=0||!Number.isFinite(dt)||dt<=0)return;
  const s=c.crawler??={phase:'patrol',time:0,targetX:c.x,targetZ:c.z};
  const p=w.people.find(p=>p.isPlayer);
  const dist=p?Math.hypot(p.x-c.x,p.z-c.z):Infinity;
  const valid=p&&!p.ghost&&!w.player.ghost&&p.hp>0&&inEmberdeep(p.x,p.z)&&w.hour>=w.player.invisUntil&&
    !(c.blindUntil&&w.hour<c.blindUntil)&&Math.hypot(p.x-c.home.tx,p.z-c.home.ty)<14&&!sanctuaryAt(w,p.x,p.z);
  if(!valid || (c.task!=='fight' && (dist>CRAWLER_STATS.aggro||!crawlerSight(w,c.x,c.z,p.x,p.z)))) {
    if(s.phase!=='patrol')c.path=[];
    c.task='wander';s.phase='patrol';s.time=0;
    const t=crawlerTorchTarget(w,c);const x=t?.tx??c.home.tx,z=t?.ty??c.home.ty;
    if(Math.hypot(x-c.x,z-c.z)>1)move(w,c,x,z,CRAWLER_STATS.speed*.5,dt);else c.path=[];
    return;
  }
  c.task='fight';
  if(s.phase==='patrol') {
    if(dist>CRAWLER_STATS.reach||!crawlerSight(w,c.x,c.z,p.x,p.z)){move(w,c,p.x,p.z,CRAWLER_STATS.speed,dt);return;}
    c.path=[];s.phase='windup';s.time=0;s.targetX=p.x;s.targetZ=p.z;return;
  }
  s.time+=dt;
  if(s.phase==='windup'&&s.time>=CRAWLER_STATS.windup){s.phase='lunge';s.time=0;}
  else if(s.phase==='lunge') {
    move(w,c,s.targetX,s.targetZ,CRAWLER_STATS.lungeSpeed,dt,true);
    if(s.time>=CRAWLER_STATS.lunge){
      if(Math.hypot(p.x-s.targetX,p.z-s.targetZ)<1&&Math.hypot(p.x-c.x,p.z-c.z)<1.4&&crawlerSight(w,c.x,c.z,p.x,p.z))strikePlayer(w,c,p);
      const dx=c.x-p.x,dz=c.z-p.z,d=Math.hypot(dx,dz);
      s.targetX=c.x+(d>.05?dx/d:-1)*3;s.targetZ=c.z+(d>.05?dz/d:0)*3;
      // Prefer away from the strike, then a wall-safe lateral escape.
      if(!crawlerSight(w,c.x,c.z,s.targetX,s.targetZ)) {
        const side=[{x:c.x,z:c.z+2},{x:c.x,z:c.z-2}].find(t=>crawlerSight(w,c.x,c.z,t.x,t.z));
        s.targetX=side?.x??c.x;s.targetZ=side?.z??c.z;
      }
      s.phase='retreat';s.time=0;c.path=[];
    }
  } else if(s.phase==='retreat') {
    move(w,c,s.targetX,s.targetZ,CRAWLER_STATS.speed,dt);
    if(s.time>=CRAWLER_STATS.retreat){s.phase='patrol';s.time=0;c.path=[];}
  }
}
