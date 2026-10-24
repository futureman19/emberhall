import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, MeshStandardMaterial, type Material } from 'three';
import type { Creature } from '@/game/types';
import { getWorld } from '@/game/live';
import { groundY } from '@/game/height';
import { SECONDS_PER_HOUR } from '@/game/catalog';
import { gloomPhase, gloomLightAt } from '@/game/gloomwraith';
import { monsterClip, monsterPose, monsterReaction, type AnimatedMonster, type MonsterReaction } from '@/game/monster-animation';
import { cloneFaunaArt, loadFaunaArt } from './fauna-art-data';

/** Same world renderer in tactical and first-person views. Cached GLBs stay immutable. */
export function AnimatedMonster({c}:{c:Creature}) {
 const root=useRef<Group>(null),body=useRef<Group>(null),ring=useRef<Mesh>(null),bolt=useRef<Mesh>(null),debris=useRef<Group>(null);
 const previous=useRef({x:c.x,z:c.z,movedAt:-Infinity});
 const reaction=useRef<MonsterReaction|undefined>(undefined);
 const [art,setArt]=useState<Group|null>(null);
 const kind=c.kind as AnimatedMonster;
 const wraith=kind==='gloomwraith',crawler=kind==='embercrawler';
 useEffect(()=>{
  let active=true;const owned:Material[]=[];
  void loadFaunaArt(kind).then(source=>{
   if(!source||!active)return;
   const scene=cloneFaunaArt(source);
   scene.traverse(o=>{if(o instanceof Mesh){
    o.castShadow=!wraith;
    const mats=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{
     const copy=m.clone();copy.transparent=true;copy.depthWrite=!wraith;
     if(wraith&&copy instanceof MeshStandardMaterial){copy.emissive.set('#30265e');copy.emissiveIntensity=.6;}
     owned.push(copy);return copy;
    });o.material=Array.isArray(o.material)?mats:mats[0]!;
   }});setArt(scene);
  });
  return()=>{active=false;owned.forEach(m=>m.dispose());};
 },[kind,wraith]);
 useFrame(()=>{
  if(!root.current||!body.current)return;
  const w=getWorld(),time=w.hour*SECONDS_PER_HOUR;
  const old=previous.current;
  const dx=c.x-old.x,dz=c.z-old.z;
  if(Math.hypot(dx,dz)>.0001)old.movedAt=time;
  if(time<old.movedAt)old.movedAt=-Infinity;
  const moving=time-old.movedAt<.15;
  old.x=c.x;old.z=c.z;
  reaction.current=monsterReaction(reaction.current,c.hp,time);
  const hitAge=reaction.current.hitAt===null?Infinity:time-reaction.current.hitAt;
  const clip=monsterClip(c,moving,hitAge>=0&&hitAge<.32);
  const state=c.monster??c.crawler??c.gloom;
  const age=clip==='death'?Math.max(0,(w.hour-c.corpseUntil+8)*SECONDS_PER_HOUR):clip==='flinch'?hitAge:state?.time??0;
  const pose=monsterPose(kind,clip,age,time);
  root.current.visible=pose.opacity>0;
  root.current.position.set(c.x,groundY(w,c.x,c.z),c.z);
  const target=state&&['windup','strike'].includes(clip)?{tx:state.targetX,ty:state.targetZ}:c.path[0];
  if(target&&Math.hypot(target.tx-c.x,target.ty-c.z)>.05)root.current.rotation.y=Math.atan2(target.tx-c.x,target.ty-c.z);
  else if(Math.hypot(dx,dz)>.0001)root.current.rotation.y=Math.atan2(dx,dz);
  body.current.position.set(0,pose.y,pose.z);body.current.rotation.set(pose.pitch,0,pose.roll);
  body.current.scale.set(pose.scaleX,pose.scaleY,pose.scaleZ);
  const visible=!wraith||gloomPhase(c.gloom?.clock??0,gloomLightAt(w,c.x,c.z))==='visible'||clip!=='idle'&&clip!=='prowl';
  const opacity=pose.opacity*(wraith?(visible?.65:.07):1);
  if(art)art.traverse(o=>{if(o instanceof Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.opacity=opacity;});
  if(ring.current){ring.current.visible=kind==='slag_golem'&&clip==='windup';ring.current.scale.setScalar(.7+Math.min(1,age/.9)*.8);}
  if(bolt.current){
   bolt.current.visible=wraith&&c.gloom?.phase==='bolt'&&clip!=='death';
   const t=Math.min(1,(c.gloom?.time??0)/.35),s=c.gloom;
   // Bolt is world-targeted even though the body faces its target.
   const yaw=root.current.rotation.y,x=((s?.targetX??c.x)-c.x)*t,z=((s?.targetZ??c.z)-c.z)*t;
   bolt.current.position.set(x*Math.cos(yaw)-z*Math.sin(yaw),1.4-t*.6,x*Math.sin(yaw)+z*Math.cos(yaw));
  }
  if(debris.current){
   const crumble=kind==='slag_golem'&&clip==='death';
   debris.current.visible=crumble||crawler&&moving&&clip!=='death';
   debris.current.children.forEach((o,i)=>{
    const t=crumble?pose.rubble:((time*2+i/8)%1),angle=i*2.4;
    o.position.set(Math.sin(angle)*(.25+t*.95),crumble?.12+Math.sin(t*Math.PI)*(.3+i%3*.15):.1+t*.6,Math.cos(angle)*(.25+t*.95));
    o.rotation.set(t*3+i,t*2,angle+t);o.scale.setScalar(crumble?(1-t)*(.18+i%3*.08):(1-t)*.045);
   });
  }
  // Inspectable live pose, not a synthetic QA state; no global bridge or gameplay writes.
  root.current.userData.monsterAnimation={kind,clip,age,pose,artReady:!!art};
 });
 const name=wraith?'gloomwraith':crawler?'embercrawler':'emberdeep-monster';
 return <group ref={root} name={`${name}:${c.id}`}>
  <group ref={body} name="monster-pose">
   <group scale={crawler?.85:wraith?1:1.25}>
    {art?<primitive object={art} dispose={null}/>:<mesh position={[0,.65,0]}><icosahedronGeometry args={[.45,1]}/><meshStandardMaterial color={wraith?'#736392':'#a84c26'}/></mesh>}
   </group>
  </group>
  {kind==='slag_golem'&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,.035,0]}><ringGeometry args={[1.65,1.8,32]}/><meshBasicMaterial color="#c95018" transparent opacity={.22}/></mesh>}
  <mesh ref={ring} rotation={[-Math.PI/2,0,0]} position={[0,.05,0]} visible={false}><ringGeometry args={[1.2,1.32,32]}/><meshBasicMaterial color="#ff9a46" transparent opacity={.8}/></mesh>
  <mesh ref={bolt} visible={false}><icosahedronGeometry args={[.16,1]}/><meshBasicMaterial color="#aba3ff"/></mesh>
  <group ref={debris} name={crawler?'embercrawler-moving-sparks':'golem-crumble'} visible={false}>
   {Array.from({length:8},(_,i)=><mesh key={i}><icosahedronGeometry args={[1,0]}/>{crawler?<meshBasicMaterial color="#ffb653"/>:<meshStandardMaterial color={i%3?'#50413a':'#ef7a2b'}/>}</mesh>)}
  </group>
 </group>;
}
