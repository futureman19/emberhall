import type { Creature } from './types.ts';
import { projectileProgress } from './combat-animation.ts';

export type AnimatedMonster = 'slag_golem' | 'embercrawler' | 'gloomwraith';
export type MonsterClip = 'idle' | 'prowl' | 'windup' | 'strike' | 'recover' | 'retreat' | 'flinch' | 'death';
/** Exhaustive against the gameplay unions; visual poses never advance AI or damage. */
export const MONSTER_PHASE_CLIPS = {
 slag_golem: {patrol:'prowl',windup:'windup',strike:'strike',recover:'recover'} satisfies Record<NonNullable<Creature['monster']>['phase'],MonsterClip>,
 embercrawler: {patrol:'prowl',windup:'windup',lunge:'strike',retreat:'retreat'} satisfies Record<NonNullable<Creature['crawler']>['phase'],MonsterClip>,
 gloomwraith: {prowl:'prowl',windup:'windup',bolt:'strike',recover:'recover'} satisfies Record<NonNullable<Creature['gloom']>['phase'],MonsterClip>,
} as const;
export function monsterClip(c:Creature,moving:boolean,hit:boolean):MonsterClip {
 if(c.task==='dead'||c.hp<=0)return 'death';
 if(hit)return 'flinch';
 let clip:MonsterClip='idle';
 if(c.kind==='slag_golem'&&c.monster)clip=MONSTER_PHASE_CLIPS.slag_golem[c.monster.phase];
 if(c.kind==='embercrawler'&&c.crawler)clip=MONSTER_PHASE_CLIPS.embercrawler[c.crawler.phase];
 if(c.kind==='gloomwraith'&&c.gloom)clip=MONSTER_PHASE_CLIPS.gloomwraith[c.gloom.phase];
 return clip==='idle'||clip==='prowl' ? moving?'prowl':'idle' : clip;
}
export interface MonsterReaction { hp:number; time:number; hitAt:number|null }
export function monsterReaction(previous:MonsterReaction|undefined,hp:number,time:number):MonsterReaction {
 if(!previous||time<previous.time)return {hp,time,hitAt:null};
 return {hp,time,hitAt:hp<previous.hp&&hp>0?time:previous.hitAt};
}
const smooth=(t:number)=>t*t*(3-2*t);
/** Pure normalized phase curves, like combat-animation.ts. No RNG, clip assets or global clock. */
export function monsterPose(kind:AnimatedMonster,clip:MonsterClip,age:number,clock:number) {
 age=Number.isFinite(age)?Math.max(0,age):0;
 clock=Number.isFinite(clock)?Math.max(0,clock):0;
 const crawler=kind==='embercrawler',wraith=kind==='gloomwraith';
 const p={pitch:0,roll:0,y:wraith?.3:0,z:0,scaleX:1,scaleY:1,scaleZ:1,opacity:1,rubble:0};
 const wave=Math.sin(clock*(crawler?22:wraith?2:3));
 if(clip==='idle'||clip==='prowl') {
  const moving=clip==='prowl';
  p.y+=wraith?wave*.12:moving?Math.abs(wave)*(crawler?.055:.09):Math.sin(clock*2)*.012;
  p.roll=moving?wave*(crawler?.08:.035):0;
  p.scaleY=1+Math.sin(clock*2)*(crawler?.018:.025);
 }
 if(clip==='windup') {
  const t=smooth(projectileProgress(age,crawler?.25:wraith?.65:.9));
  p.pitch=-t*(crawler?.3:wraith?.25:.55);p.scaleY=1-t*.15;p.scaleZ=1+t*.1;p.y+=wraith?t*.2:0;
 }
 if(clip==='strike') {
  const t=smooth(projectileProgress(age,crawler?.2:wraith?.35:.15));
  p.pitch=(crawler?-.3:wraith?-.25:-.55)+t*(crawler?.65:wraith?.7:1.3);
  p.z=Math.sin(t*Math.PI)*(crawler?.18:.12);
 }
 if(clip==='recover'||clip==='retreat') {
  const t=1-smooth(projectileProgress(age,crawler?1.1:wraith?1.6:1.8));
  p.pitch=(crawler?.35:wraith?.45:.75)*t;
  if(clip==='retreat'){p.y=Math.abs(wave)*.055;p.roll=wave*.08;}
 }
 if(clip==='flinch') {
  const t=Math.sin(projectileProgress(age,.32)*Math.PI);
  p.pitch=-t*(crawler?.4:.28);p.roll=t*.14;p.z=-t*.16;p.scaleY=1-t*.12;
 }
 if(clip==='death') {
  const t=smooth(projectileProgress(age,1.2));p.opacity=1-t;
  if(crawler){const flip=smooth(projectileProgress(age,.55));p.roll=Math.PI*flip;p.y=.65*flip+.25*Math.sin(t*Math.PI);p.scaleY=1;}
  else if(wraith){p.y=.3+t*1.4;p.scaleX=1+t*.9;p.scaleY=1+t*.6;p.scaleZ=p.scaleX;p.roll=t*.25;}
  else {p.rubble=t;p.scaleY=Math.max(.02,1-t*1.4);p.scaleX=1+t*.3;p.scaleZ=p.scaleX;}
 }
 return p;
}
