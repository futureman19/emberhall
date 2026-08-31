// The looking-glass preview — the vale's own boxy figure, drawn live in 3D
// from the same proportions as people-meshes.tsx (legs 0.14×0.4, torso
// 0.42×0.5, head 0.28³). Standalone by contract: at merge, people-meshes
// learns to read ResolvedLook and this preview keeps one shared vocabulary.
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Group } from "three";
import { SLOT_ANCHOR, type VoxelPartV1 } from "@/game/look/parts.ts";
import type { ResolvedLook } from "@/game/look/resolve.ts";

const LEGS = "#3a342e";
const FEET = "#2e241c";

function Mat({ color }: { color: string }) {
  return <meshStandardMaterial color={color} roughness={0.82} />;
}

function Hair({ look }: { look: ResolvedLook }) {
  const c = look.hairColor;
  if (look.hairStyle === "bald") return null;
  return (
    <group>
      <mesh position={[0, 1.14, 0]}>
        <boxGeometry args={[0.3, 0.08, 0.28]} />
        <Mat color={c} />
      </mesh>
      {look.hairStyle === "shag" && (
        <>
          {[-0.17, 0.17].map((x) => (
            <mesh key={x} position={[x, 1.02, 0]}>
              <boxGeometry args={[0.06, 0.2, 0.28]} />
              <Mat color={c} />
            </mesh>
          ))}
          <mesh position={[0, 1.02, 0.16]}>
            <boxGeometry args={[0.3, 0.2, 0.06]} />
            <Mat color={c} />
          </mesh>
        </>
      )}
      {look.hairStyle === "tail" && (
        <mesh position={[0, 0.96, 0.18]}>
          <boxGeometry args={[0.12, 0.34, 0.08]} />
          <Mat color={c} />
        </mesh>
      )}
      {look.hairStyle === "long" && (
        <mesh position={[0, 0.94, 0.17]}>
          <boxGeometry args={[0.3, 0.4, 0.08]} />
          <Mat color={c} />
        </mesh>
      )}
    </group>
  );
}

function PartMeshes({ parts }: { parts: VoxelPartV1[] }) {
  return (
    <>
      {parts.map((p) => {
        const { at, voxel } = SLOT_ANCHOR[p.slot];
        return p.voxels.map((v, i) => (
          <mesh key={`${p.id}-${i}`} position={[at[0] + v.x * voxel, at[1] + v.y * voxel, at[2] + v.z * voxel]}>
            <boxGeometry args={[voxel, voxel, voxel]} />
            <Mat color={v.c} />
          </mesh>
        ));
      })}
    </>
  );
}

function Figure({ look, parts = [] }: { look: ResolvedLook; parts?: VoxelPartV1[] }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }, delta) => {
    if (!g.current) return;
    g.current.rotation.y += delta * 0.55;
    g.current.position.y = Math.sin(clock.elapsedTime * 3) * 0.02;
  });
  return (
    <group ref={g}>
      <mesh position={[-0.1, 0.22, 0]}><boxGeometry args={[0.14, 0.4, 0.16]} /><Mat color={LEGS} /></mesh>
      <mesh position={[0.1, 0.22, 0]}><boxGeometry args={[0.14, 0.4, 0.16]} /><Mat color={LEGS} /></mesh>
      <mesh position={[-0.1, 0.04, 0.02]}><boxGeometry args={[0.16, 0.08, 0.22]} /><Mat color={FEET} /></mesh>
      <mesh position={[0.1, 0.04, 0.02]}><boxGeometry args={[0.16, 0.08, 0.22]} /><Mat color={FEET} /></mesh>
      <mesh position={[0, 0.58, 0]}><boxGeometry args={[0.42, 0.5, 0.26]} /><Mat color={look.garb} /></mesh>
      {[-0.28, 0.28].map((x) => (
        <group key={x} position={[x, 0.62, 0]} rotation={[0, 0, x < 0 ? 0.12 : -0.12]}>
          <mesh position={[0, -0.16, 0]}><boxGeometry args={[0.12, 0.42, 0.12]} /><Mat color={look.garb} /></mesh>
          <mesh position={[0, -0.38, 0]}><boxGeometry args={[0.12, 0.1, 0.12]} /><Mat color={look.skin} /></mesh>
        </group>
      ))}
      <mesh position={[0, 0.98, 0]}><boxGeometry args={[0.28, 0.28, 0.26]} /><Mat color={look.skin} /></mesh>
      <Hair look={look} />
      <PartMeshes parts={parts} />
    </group>
  );
}

export function LookPreview({ look, parts = [] }: { look: ResolvedLook; parts?: VoxelPartV1[] }) {
  // Canvas is client-only; wait for mount so SSR skips it cleanly.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <Canvas camera={{ position: [1.5, 1.1, 2.7], fov: 38 }} onCreated={({ camera }) => camera.lookAt(0, 0.62, 0)}>
      <hemisphereLight args={["#efe3c4", "#3a342e", 0.9]} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} color="#f2e4c8" />
      <Figure look={look} parts={parts} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <circleGeometry args={[0.85, 24]} />
        <meshStandardMaterial color="#2a2620" roughness={0.9} />
      </mesh>
    </Canvas>
  );
}
