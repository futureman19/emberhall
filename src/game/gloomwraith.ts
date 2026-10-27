import type { Creature, World } from './types.ts';
import { EMBERDEEP_ROOMS, inEmberdeep } from './emberdeep.ts';
import { spawn, strikePlayer } from './ecology.ts';
import { walkable } from './pathfinding.ts';
import { sanctuaryAt } from './zones.ts';

export const GLOOM_SPAWNS = [
  { id: 'emberdeep:forge:guard', roomId: 'forge' as const, tx: 1076, ty: 715 },
  { id: 'emberdeep:vault:guard', roomId: 'vault' as const, tx: 1076, ty: 677 },
];
export const gloomPhase = (seconds: number, lit: boolean) => lit || seconds % 6 >= 3 ? 'visible' : 'hidden';
export const gloomBoltDamage = (torch: boolean) => torch ? 4 : 11;
/** Equipped torches burn until weather removes them; bag torches give no light. */
export const gloomTorch = (w: World) => w.player.wear.main === 'torch';
/** Continuous exposure allows escape when every neighbouring tile is lit. */
export function gloomExposure(w: World, x: number, z: number) {
  const p = w.people.find(p => p.isPlayer);
  const torch = p && gloomTorch(w) ? Math.max(0, 5.01-Math.hypot(x-p.x,z-p.z)) : 0;
  return Math.max(torch, ...EMBERDEEP_ROOMS.flatMap(r => [-1,1].map(side => Math.max(0,4.01-Math.hypot(x-r.tx-side*(r.rx-1),z-r.ty+r.ry-1)))));
}
export function gloomLightAt(w: World, x: number, z: number) {
  return gloomExposure(w,x,z)>0;
}
export function ensureGloomwraiths(w: World) {
  for (const a of GLOOM_SPAWNS) if (!w.fauna.some(c => c.id === a.id) && !w.emberdeep?.cleared.includes(a.roomId)) {
    const c = spawn(w, 'gloomwraith', a.tx, a.ty); c.id = a.id; w.fauna.push(c);
  }
}
export function gloomSight(w: World, x: number, z: number, tx: number, tz: number) {
  const n = Math.max(1, Math.ceil(Math.hypot(tx-x, tz-z)*4));
  for (let i=0;i<=n;i++) if (!walkable(w, Math.round(x+(tx-x)*i/n), Math.round(z+(tz-z)*i/n))) return false;
  return true;
}
export function tickGloomwraith(w: World, c: Creature, dt: number) {
  if (c.kind !== 'gloomwraith' || c.hp <= 0 || c.task === 'dead') return;
  const s = c.gloom ??= { clock: 0, phase: 'prowl', time: 0, targetX: c.x, targetZ: c.z };
  s.clock += dt;
  const p = w.people.find(p => p.isPlayer);
  const lit = gloomLightAt(w, c.x, c.z);
  const visible = gloomPhase(s.clock, lit) === 'visible';
  const valid = p && !p.ghost && !w.player.ghost && p.hp > 0 && inEmberdeep(p.x,p.z) && w.hour >= w.player.invisUntil && !(c.blindUntil && w.hour < c.blindUntil) && !sanctuaryAt(w,p.x,p.z) && Math.hypot(p.x-c.home.tx,p.z-c.home.ty) < 14;
  c.path = [];
  if (!valid) { c.task = 'wander'; s.phase = 'prowl'; s.time = 0; return; }
  c.task = 'fight';
  const dist = Math.hypot(p.x-c.x,p.z-c.z);
  if (s.phase === 'prowl') {
    if (lit || dist > 7 || !visible) {
      const exposure = gloomExposure(w,c.x,c.z);
      const choices = [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz]) => ({ x: Math.round(c.x)+dx!, z: Math.round(c.z)+dz! })).filter(t => walkable(w,t.x,t.z) && (lit ? gloomExposure(w,t.x,t.z)<exposure : !gloomLightAt(w,t.x,t.z)) && !sanctuaryAt(w,t.x,t.z) && Math.hypot(t.x-c.home.tx,t.z-c.home.ty)<10);
      choices.sort((a,b) => gloomExposure(w,a.x,a.z)-gloomExposure(w,b.x,b.z) || (lit ? -1 : 1)*(Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z)));
      const next = choices[0];
      if(next) { const d=Math.hypot(next.x-c.x,next.z-c.z); const step=Math.min(d,dt*1.8); if(d>0) {c.x+=(next.x-c.x)/d*step;c.z+=(next.z-c.z)/d*step;} }
      if (!visible || dist > 7) return;
    }
    if (!gloomSight(w,c.x,c.z,p.x,p.z)) return;
    s.phase='windup'; s.time=0; s.targetX=p.x; s.targetZ=p.z; return;
  }
  s.time += dt;
  if (s.phase==='windup' && s.time>=0.65) { s.phase='bolt'; s.time=0; }
  else if(s.phase==='bolt' && s.time>=0.35) {
    if(dist<=7.4 && Math.hypot(p.x-s.targetX,p.z-s.targetZ)<1 && gloomSight(w,c.x,c.z,p.x,p.z)) strikePlayer(w,c,p);
    s.phase='recover';s.time=0;
  } else if(s.phase==='recover' && s.time>=1.6) {s.phase='prowl';s.time=0;}
}
