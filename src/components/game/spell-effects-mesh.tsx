import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getWorld } from "@/game/live";
import { groundY } from "@/game/height";
import { offensiveRange } from "@/game/magery";
import { spellFxProfile } from "@/game/magery-animation";
import { SPELL_STATUS_CAP, spellFlightProgress, visitSpellStatuses, writeSpellStatusMatrix } from "@/game/spell-effects";

/** The last part of the existing cast anticipation is a gathering dart, not
 * a second release after damage. No speculative target flashes on failed rolls. */
export function SpellFlightMesh() {
  const core = useRef<THREE.Mesh>(null);
  const trail = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!core.current || !trail.current) return;
    const w = getWorld();
    const intent = w.player.intent;
    const p = w.people.find(p => p.isPlayer);
    const target = w.fauna.find(c => c.id === intent.targetId);
    const k = intent.kind === "cast" && intent.spell ? spellFlightProgress(intent.spell, w.player.workT) : null;
    const visible = k !== null && p && !p.path.length && !p.ghost && !w.player.ghost && target && target.task !== "dead" && Math.hypot(target.x - p.x, target.z - p.z) <= offensiveRange(intent.spell!);
    core.current.visible = trail.current.visible = Boolean(visible);
    if (!visible || k === null || !p || !target || !intent.spell) return;
    const profile = spellFxProfile(intent.spell);
    const y0 = groundY(w, p.x, p.z) + 0.95;
    const y1 = groundY(w, target.x, target.z) + 0.75;
    core.current.position.set(p.x + (target.x - p.x) * k, y0 + (y1 - y0) * k, p.z + (target.z - p.z) * k);
    core.current.scale.setScalar(profile.kind === "burst" ? 1.7 : 1.1);
    (core.current.material as THREE.MeshBasicMaterial).color.set(profile.core);
    // Short, attached tail (not a full-screen beam), with exact primitive length.
    const back = Math.max(0, k - 0.22);
    const bx = p.x + (target.x - p.x) * back;
    const by = y0 + (y1 - y0) * back;
    const bz = p.z + (target.z - p.z) * back;
    trail.current.position.set((bx + core.current.position.x) / 2, (by + core.current.position.y) / 2, (bz + core.current.position.z) / 2);
    trail.current.lookAt(core.current.position);
    trail.current.scale.set(0.075, 0.075, Math.max(0.01, Math.hypot(core.current.position.x - bx, core.current.position.y - by, core.current.position.z - bz)));
    (trail.current.material as THREE.MeshBasicMaterial).color.set(profile.motes);
  });
  return <group name="spell-flight">
    <mesh ref={core} visible={false}><octahedronGeometry args={[0.18]} /><meshBasicMaterial toneMapped={false} /></mesh>
    <mesh ref={trail} visible={false}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial transparent opacity={0.65} depthWrite={false} toneMapped={false} /></mesh>
  </group>;
}

/** One instanced draw call, fixed capacity. Separate from the decorative FX
 * preference gate: static, open status seals remain meaningful in reduced mode.
 * Height lanes encode simultaneous conditions without covering the silhouette. */
export function SpellStatusMesh() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const scratch = useMemo(() => ({ pose: new THREE.Object3D(), color: new THREE.Color() }), []);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const w = getWorld();
    let i = 0;
    visitSpellStatuses(w, (x, z, spell, lane) => {
      writeSpellStatusMatrix(w, x, z, lane, scratch.pose.matrix.elements);
      mesh.setMatrixAt(i, scratch.pose.matrix);
      mesh.setColorAt(i, scratch.color.set(spellFxProfile(spell).ring));
      i++;
    });
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  return <instancedMesh name="spell-status-seals" ref={ref} args={[undefined, undefined, SPELL_STATUS_CAP]} frustumCulled={false}>
    <ringGeometry args={[0.86, 1, 6, 1, 0, Math.PI * 0.4]} />
    <meshBasicMaterial transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
  </instancedMesh>;
}
