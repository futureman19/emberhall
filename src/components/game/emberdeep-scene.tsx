import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGame } from "@/game/store";
import * as THREE from "three";
import { EMBERDEEP_BOUNDS, EMBERDEEP_ENTRY, EMBERDEEP_EXIT, EMBERDEEP_GATE, EMBERDEEP_ROOMS, emberdeepFloor, inEmberdeep } from "@/game/emberdeep";
import { getWorld } from "@/game/live";
import { groundY } from "@/game/height";
import { useOffhandGeometry } from "./offhand-geometry";

const walls: [number, number][] = [];
for (let z = EMBERDEEP_BOUNDS.y0; z <= EMBERDEEP_BOUNDS.y1; z++) {
  for (let x = EMBERDEEP_BOUNDS.x0; x <= EMBERDEEP_BOUNDS.x1; x++) {
    if (!emberdeepFloor(x, z) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => emberdeepFloor(x + dx!, z + dz!))) walls.push([x, z]);
  }
}
function Sconce({ x, z }: { x: number; z: number }) {
  const handle = useOffhandGeometry("torch_handle");
  const ember = useOffhandGeometry("torch_ember");
  return <group position={[x, 0.35, z]} raycast={() => {}}>
    <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.3, 0.5, 0.8, 6]} /><meshStandardMaterial color="#514437" roughness={0.92} /></mesh>
    <group position={[0, 1, 0]} scale={4}>
      <mesh geometry={handle ?? undefined}>{!handle && <boxGeometry args={[0.045, 0.36, 0.045]} />}<meshStandardMaterial color="#44312a" /></mesh>
      <mesh position={[0, 0.22, 0]} geometry={ember ?? undefined}>{!ember && <boxGeometry args={[0.08, 0.1, 0.08]} />}<meshStandardMaterial color="#ffc274" emissive="#ff823c" emissiveIntensity={2} /></mesh>
    </group>
  </group>;
}
function Stair({ x, z }: { x: number; z: number }) {
  return <group position={[x, 0, z]} raycast={() => {}}>
    {[-2, 2].map(dx => <mesh key={dx} position={[dx, 1.5, 0]} castShadow><boxGeometry args={[0.8, 3, 1.5]} /><meshStandardMaterial color="#514b48" roughness={0.95} /></mesh>)}
    <mesh position={[0, 3, 0]} castShadow><boxGeometry args={[5, 0.8, 1.6]} /><meshStandardMaterial color="#736353" /></mesh>
    <mesh position={[0, 1.2, -0.6]}><planeGeometry args={[3.2, 2.4]} /><meshBasicMaterial color="#171515" /></mesh>
    {[0, 1, 2].map(i => <mesh key={i} position={[0, 0.08 + i * 0.1, 1 - i * 0.5]}><boxGeometry args={[3, 0.16, 0.5]} /><meshStandardMaterial color="#8d8171" /></mesh>)}
    <mesh position={[0, 3.5, 0.85]}><boxGeometry args={[0.55, 0.22, 0.12]} /><meshBasicMaterial color="#f8ad5e" /></mesh>
  </group>;
}
export function EmberdeepScene() {
  const gl = useThree(s => s.gl);
  const underground = useGame(s => inEmberdeep(s.snap.youX, s.snap.youZ));
  // A shared terrain world must not expose distant overworld scenery through
  // the roofless tactical view. Preserve renderer state on exit/unmount.
  useLayoutEffect(() => {
    if (!underground) return;
    const previous = gl.clippingPlanes;
    gl.clippingPlanes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -EMBERDEEP_BOUNDS.x0),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), EMBERDEEP_BOUNDS.x1),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -EMBERDEEP_BOUNDS.y0),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), EMBERDEEP_BOUNDS.y1),
    ];
    return () => { gl.clippingPlanes = previous; };
  }, [gl, underground]);
  const dungeon = useRef<THREE.Group>(null);
  const entrance = useRef<THREE.Group>(null);
  const boundary = useRef<THREE.InstancedMesh>(null);
  const seal = useRef<THREE.Group>(null);
  const fill = useRef<THREE.PointLight>(null);
  useLayoutEffect(() => {
    const m = boundary.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    walls.forEach(([x, z], i) => {
      dummy.position.set(x, 1.25, z);
      dummy.scale.set(1, 2.5, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, []);
  useFrame(() => {
    const w = getWorld();
    const p = w.people.find(p => p.isPlayer);
    const inside = !!p && inEmberdeep(p.x, p.z);
    if (dungeon.current) dungeon.current.visible = inside;
    if (entrance.current) {
      entrance.current.visible = !!p && Math.hypot(p.x - EMBERDEEP_ENTRY.tx, p.z - EMBERDEEP_ENTRY.ty) < 100;
      entrance.current.position.y = groundY(w, EMBERDEEP_ENTRY.tx, EMBERDEEP_ENTRY.ty);
    }
    if (seal.current) seal.current.visible = !w.emberdeep?.bossDoorOpen;
    if (fill.current && p) { fill.current.position.set(p.x, 3, p.z); fill.current.intensity = inside ? 26 : 0; }
  });
  return <>
    <group ref={entrance} name="emberdeep-overworld-entrance">
      <Stair x={EMBERDEEP_ENTRY.tx} z={EMBERDEEP_ENTRY.ty} />
      <Sconce x={EMBERDEEP_ENTRY.tx - 3} z={EMBERDEEP_ENTRY.ty} />
      <Sconce x={EMBERDEEP_ENTRY.tx + 3} z={EMBERDEEP_ENTRY.ty} />
    </group>
    <group ref={dungeon} name="emberdeep-dungeon" visible={false}>
      <instancedMesh ref={boundary} args={[undefined, undefined, walls.length]} raycast={() => {}} castShadow receiveShadow>
        <boxGeometry args={[0.98, 1, 0.98]} /><meshStandardMaterial color="#625b55" roughness={0.96} />
      </instancedMesh>
      <Stair x={EMBERDEEP_EXIT.tx} z={EMBERDEEP_EXIT.ty - 2} />
      {EMBERDEEP_ROOMS.flatMap(r => [-1, 1].map(side => <Sconce key={`${r.id}:${side}`} x={r.tx + side * (r.rx - 1)} z={r.ty - r.ry + 1} />))}
      <group ref={seal} position={[EMBERDEEP_GATE.tx, 0, 674]} name="emberdeep-boss-seal" raycast={() => {}}>
        {[-2, -1, 0, 1, 2].map(z => <mesh key={z} position={[0, 1.5, z]}><boxGeometry args={[0.6, 3, 0.92]} /><meshStandardMaterial color="#3e302b" metalness={0.6} roughness={0.5} /></mesh>)}
        <mesh position={[-0.35, 1.8, 0]}><boxGeometry args={[0.08, 0.3, 4.8]} /><meshStandardMaterial color="#e69852" emissive="#aa421a" emissiveIntensity={0.7} /></mesh>
      </group>
    </group>
    <pointLight ref={fill} color="#ffc68b" distance={22} decay={1.5} intensity={0} />
  </>;
}
