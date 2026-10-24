import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, MeshStandardMaterial, type Material } from 'three';
import type { Creature } from '@/game/types';
import { getWorld } from '@/game/live';
import { groundY } from '@/game/height';
import { gloomPhase, gloomLightAt } from '@/game/gloomwraith';
import { cloneFaunaArt, loadFaunaArt } from './fauna-art-data';

export function GloomwraithMesh({ c }: { c: Creature }) {
  const root = useRef<Group>(null); const body = useRef<Group>(null); const bolt = useRef<Mesh>(null);
  const [art, setArt] = useState<Group | null>(null);
  useEffect(() => {
    let active = true; const owned: Material[] = [];
    void loadFaunaArt('gloomwraith').then(source => {
      if (!source || !active) return;
      const scene = cloneFaunaArt(source);
      scene.traverse(o => { if (o instanceof Mesh) {
        o.castShadow = false;
        const mats = (Array.isArray(o.material) ? o.material : [o.material]).map(m => {
          const clone = m.clone(); clone.transparent = true; clone.depthWrite = false;
          if (clone instanceof MeshStandardMaterial) { clone.emissive.set('#30265e'); clone.emissiveIntensity = .6; }
          owned.push(clone); return clone;
        }); o.material = Array.isArray(o.material) ? mats : mats[0]!;
      } }); setArt(scene);
    });
    return () => { active = false; owned.forEach(m => m.dispose()); };
  }, []);
  useFrame(({ clock }) => {
    if (!root.current || !body.current) return;
    const w = getWorld(); const s = c.gloom;
    root.current.visible = c.task !== 'dead' && c.hp > 0;
    root.current.position.set(c.x, groundY(w,c.x,c.z),c.z);
    body.current.position.y = .3 + Math.sin(clock.elapsedTime*2)*.12;
    const visible = gloomPhase(s?.clock ?? 0,gloomLightAt(w,c.x,c.z)) === 'visible' || (s && s.phase !== 'prowl');
    if (art) art.traverse(o => { if(o instanceof Mesh) for(const m of Array.isArray(o.material)?o.material:[o.material]) m.opacity = visible ? .65 : .07; });
    if(s) body.current.rotation.y = Math.atan2(s.targetX-c.x,s.targetZ-c.z);
    if(bolt.current) { bolt.current.visible = s?.phase === 'bolt'; const t = Math.min(1,(s?.time ?? 0)/.35); bolt.current.position.set(((s?.targetX ?? c.x)-c.x)*t,1.4-t*.6,((s?.targetZ ?? c.z)-c.z)*t); }
  });
  return <group ref={root} name={`gloomwraith:${c.id}`}>
    <group ref={body}>{art ? <primitive object={art} dispose={null}/> : <mesh position={[0,1,0]}><coneGeometry args={[.3,1.5,8]}/><meshStandardMaterial color="#736392" transparent opacity={.5}/></mesh>}</group>
    <mesh ref={bolt} visible={false}><icosahedronGeometry args={[.16,1]}/><meshBasicMaterial color="#aba3ff"/></mesh>
  </group>;
}
