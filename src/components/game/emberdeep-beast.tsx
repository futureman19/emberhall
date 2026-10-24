import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, type Material } from "three";
import type { Creature } from "@/game/types";
import { getWorld } from "@/game/live";
import { groundY } from "@/game/height";
import { SECONDS_PER_HOUR } from "@/game/catalog";
import { MONSTER_STATS, isEmberdeepMonster } from "@/game/emberdeep-monsters";
import { cloneFaunaArt, loadFaunaArt } from "./fauna-art-data";

/** Monster-only pose owner; ordinary fauna and shared cached materials are untouched. */
export function EmberdeepBeast({ c }: { c: Creature }) {
  const root = useRef<Group>(null); const body = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const [art, setArt] = useState<Group | null>(null);
  useEffect(() => {
    let active = true; let owned: Material[] = [];
    void loadFaunaArt(c.kind).then(source => {
      if (!source || !active) return;
      const scene = cloneFaunaArt(source);
      scene.traverse(o => { if (o instanceof Mesh) {
        const mats = (Array.isArray(o.material) ? o.material : [o.material]).map(m => m.clone());
        owned.push(...mats); o.material = Array.isArray(o.material) ? mats : mats[0]!;
      } });
      setArt(scene);
    });
    return () => { active = false; owned.forEach(m => m.dispose()); owned = []; };
  }, [c.kind]);
  useFrame(({ clock }) => {
    if (!root.current || !body.current || !isEmberdeepMonster(c.kind)) return;
    const w = getWorld(); const s = c.monster; const stats = MONSTER_STATS[c.kind];
    const dead = c.task === "dead";
    const deathAge = dead ? Math.max(0, (w.hour - (c.corpseUntil - 8)) * SECONDS_PER_HOUR) : 0;
    const fade = dead ? Math.max(0, 1 - deathAge / 1.2) : 1;
    root.current.visible = !dead || fade > 0;
    root.current.position.set(c.x, groundY(w, c.x, c.z), c.z);
    const target = s && c.task === "fight" ? { tx: s.targetX, ty: s.targetZ } : c.path[0];
    if (target) body.current.rotation.y = Math.atan2(target.tx - c.x, target.ty - c.z);
    const wind = s?.phase === "windup" ? Math.min(1, s.time / stats.windup) : 0;
    const strike = s?.phase === "strike" ? Math.sin(Math.min(1, s.time / stats.flight) * Math.PI) : 0;
    body.current.rotation.x = dead ? Math.PI / 2 : c.kind === "slag_golem" ? -wind * .4 + strike * .65 : 0;
    body.current.position.set(0, c.path.length ? Math.abs(Math.sin(clock.elapsedTime * 4)) * .05 : 0, 0);
    if (art) art.traverse(o => { if (o instanceof Mesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      m.transparent = fade < 1; m.opacity = fade;
    } });
    if (ring.current) { ring.current.visible = !dead && c.kind === "slag_golem" && wind > 0; ring.current.scale.setScalar(.7 + wind * .8); }
  });
  const size = 1.25;
  return <group ref={root} name={`emberdeep-monster:${c.id}`}>
    <group ref={body} scale={size}>
      {art ? <primitive object={art} dispose={null} /> : <mesh position={[0,.6,0]}><icosahedronGeometry args={[.5,1]}/><meshStandardMaterial color="#a67d66" /></mesh>}
    </group>
    <mesh rotation={[-Math.PI / 2,0,0]} position={[0,.035,0]}><ringGeometry args={[1.65,1.8,32]}/><meshBasicMaterial color="#c95018" transparent opacity={.22}/></mesh>
    <mesh ref={ring} rotation={[-Math.PI / 2,0,0]} position={[0,.05,0]} visible={false}><ringGeometry args={[1.2,1.32,32]}/><meshBasicMaterial color="#ff9a46" transparent opacity={.8}/></mesh>
  </group>;
}
