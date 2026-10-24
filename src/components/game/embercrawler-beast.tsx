import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { Creature } from '@/game/types';
import { getWorld } from '@/game/live';
import { groundY } from '@/game/height';
import { SECONDS_PER_HOUR } from '@/game/catalog';
import { getCombatFx } from '@/game/player';
import { CRAWLER_STATS } from '@/game/embercrawler';
import { FaunaArtBody } from './fauna-art';

/** Separate pose owner keeps ordinary fauna animations byte-preserved. */
export function EmbercrawlerBeast({c}:{c:Creature}) {
  const root=useRef<Group>(null),body=useRef<Group>(null),sparks=useRef<Group>(null);
  const previous=useRef({x:c.x,z:c.z,time:0});
  useFrame(({clock},delta)=>{
    if(!root.current||!body.current||!sparks.current)return;
    const w=getWorld(),s=c.crawler,dead=c.task==='dead';
    const moved=Math.hypot(c.x-previous.current.x,c.z-previous.current.z)>.0001;
    if(moved)previous.current.time=clock.elapsedTime;
    previous.current.x=c.x;previous.current.z=c.z;
    const moving=!dead&&w.speed>0&&clock.elapsedTime-previous.current.time<.12;
    root.current.visible=!dead || w.hour < c.corpseUntil-8+.04;
    root.current.position.set(c.x,groundY(w,c.x,c.z),c.z);
    const target=s&&(s.phase==='windup'||s.phase==='lunge')?{tx:s.targetX,ty:s.targetZ}:c.path[0];
    if(target&&Math.hypot(target.tx-c.x,target.ty-c.z)>.05)body.current.rotation.y=Math.atan2(target.tx-c.x,target.ty-c.z);
    const fx=getCombatFx(),age=fx?(w.hour-fx.at)*SECONDS_PER_HOUR:Infinity;
    const hit=fx?.targetId===c.id&&age>=0&&age<.34?Math.sin(age/.34*Math.PI):0;
    const wind=s?.phase==='windup'?Math.min(1,s.time/CRAWLER_STATS.windup):0;
    body.current.rotation.x=dead?Math.PI/2:-wind*.18+hit*.25;
    body.current.rotation.z=moving?Math.sin(clock.elapsedTime*32)*.035:0;
    body.current.position.y=moving?Math.abs(Math.sin(clock.elapsedTime*22))*.045:0;
    body.current.scale.set(1,1-wind*.2,1+wind*.08);
    sparks.current.visible=moving;
    sparks.current.children.forEach((spark,i)=>{
      const t=(clock.elapsedTime*2+i/8)%1;
      spark.position.set(Math.sin(i*2.4)*(.3+t*.5),.1+t*.6,Math.cos(i*2.4)*(.3+t*.5));
      spark.scale.setScalar((1-t)*.045);
    });
    // Delta is capped by Fiber; no simulation or gameplay RNG is consumed here.
    root.current.userData.poseDelta=Math.min(delta,.1);
  });
  return <group ref={root} name={`embercrawler:${c.id}`} position={[c.x,groundY(getWorld(),c.x,c.z),c.z]}>
    <group ref={body}>
      <FaunaArtBody kind="embercrawler" size={.85}>
        <mesh position={[0,.36,-.15]} scale={[.36,.23,.5]}><icosahedronGeometry args={[1,1]}/><meshStandardMaterial color="#a84c26"/></mesh>
        <mesh position={[0,.3,.35]} scale={[.23,.18,.24]}><icosahedronGeometry args={[1,1]}/><meshStandardMaterial color="#432c2a"/></mesh>
        {[-1,1].flatMap(side=>[-.4,0,.4].map(z=><group key={`${side}:${z}`}>
          <mesh position={[side*.48,.23,z]} rotation={[0,0,side*.9]}><boxGeometry args={[.07,.65,.07]}/><meshStandardMaterial color="#4a3230"/></mesh>
          <mesh position={[side*.72,.06,z]}><icosahedronGeometry args={[.075,0]}/><meshStandardMaterial color="#ed7d28" emissive="#ed7d28" emissiveIntensity={1.4}/></mesh>
        </group>))}
      </FaunaArtBody>
    </group>
    <group ref={sparks} name="embercrawler-moving-sparks" visible={false} raycast={()=>{}}>
      {Array.from({length:8},(_,i)=><mesh key={i}><icosahedronGeometry args={[1,0]}/><meshBasicMaterial color="#ffb653"/></mesh>)}
    </group>
  </group>;
}
