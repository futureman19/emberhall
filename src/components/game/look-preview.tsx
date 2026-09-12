import { AuthoredCharacterGeometry, AuthoredCharacterFace, AuthoredCharacterTunic } from "./authored-character.tsx";
// The looking-glass preview — the vale's own chibi figure, drawn live in 3D
// from the same proportions as people-meshes.tsx (FIGURE in look/figure.ts).
// The mirror answers to fingers: drag to turn them, and when left alone it
// slowly twirls on its own. Standalone by contract: people-meshes shares this
// vocabulary.
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Group } from "three";
import { FIGURE, HAIR } from "@/game/look/figure.ts";
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
      <mesh position={[0, HAIR.cap.y, 0]}>
        <AuthoredCharacterGeometry part="hair_cap" size={HAIR.cap.size} />
        <Mat color={c} />
      </mesh>
      {look.hairStyle === "shag" && (
        <>
          {[-HAIR.shagSide.x, HAIR.shagSide.x].map((x) => (
            <mesh key={x} position={[x, HAIR.shagSide.y, 0]}>
              <AuthoredCharacterGeometry part="hair_shagSide" size={HAIR.shagSide.size} />
              <Mat color={c} />
            </mesh>
          ))}
          <mesh position={[0, HAIR.shagFront.y, HAIR.shagFront.z]}>
            <AuthoredCharacterGeometry part="hair_shagFront" size={HAIR.shagFront.size} />
            <Mat color={c} />
          </mesh>
        </>
      )}
      {look.hairStyle === "tail" && (
        <mesh position={[0, HAIR.tail.y, HAIR.tail.z]}>
          <AuthoredCharacterGeometry part="hair_tail" size={HAIR.tail.size} />
          <Mat color={c} />
        </mesh>
      )}
      {look.hairStyle === "long" && (
        <mesh position={[0, HAIR.long.y, HAIR.long.z]}>
          <AuthoredCharacterGeometry part="hair_long" size={HAIR.long.size} />
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
  useFrame(({ clock }) => {
    if (!g.current) return;
    g.current.position.y = Math.sin(clock.elapsedTime * 3) * 0.02;
  });
  return (
    <group ref={g}>
      <mesh position={[-FIGURE.leg.x, FIGURE.leg.y, 0]}>
        <AuthoredCharacterGeometry part="leg" size={FIGURE.leg.size} />
        <Mat color={LEGS} />
      </mesh>
      <mesh position={[FIGURE.leg.x, FIGURE.leg.y, 0]}>
        <AuthoredCharacterGeometry part="leg" size={FIGURE.leg.size} />
        <Mat color={LEGS} />
      </mesh>
      <mesh position={[-FIGURE.foot.x, FIGURE.foot.y, FIGURE.foot.z]}>
        <AuthoredCharacterGeometry part="foot" size={FIGURE.foot.size} />
        <Mat color={FEET} />
      </mesh>
      <mesh position={[FIGURE.foot.x, FIGURE.foot.y, FIGURE.foot.z]}>
        <AuthoredCharacterGeometry part="foot" size={FIGURE.foot.size} />
        <Mat color={FEET} />
      </mesh>
      <mesh position={[0, FIGURE.torso.y, 0]}>
        <AuthoredCharacterGeometry part="torso" size={FIGURE.torso.size} />
        <Mat color={look.garb} />
        <AuthoredCharacterTunic color={look.garb} />
      </mesh>
      {[-FIGURE.arm.x, FIGURE.arm.x].map((x) => (
        <group key={x} position={[x, FIGURE.arm.y, 0]} rotation={[0, 0, x < 0 ? 0.12 : -0.12]}>
          <mesh position={[0, FIGURE.armMesh.y, 0]}>
            <AuthoredCharacterGeometry part="arm" size={FIGURE.arm.size} />
            <Mat color={look.garb} />
          </mesh>
          <mesh position={[0, FIGURE.hand.y, 0]}>
            <AuthoredCharacterGeometry part="hand" size={FIGURE.hand.size} />
            <Mat color={look.skin} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, FIGURE.head.y, 0]}>
        <AuthoredCharacterGeometry part="head" size={FIGURE.head.size} />
        <Mat color={look.skin} />
        <AuthoredCharacterFace skin={look.skin} />
      </mesh>
      <Hair look={look} />
      <PartMeshes parts={parts} />
    </group>
  );
}

// Drag to orbit; idle for a breath and the mirror resumes its slow twirl.
function MirrorControls() {
  const [idle, setIdle] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <OrbitControls
      makeDefault
      target={[0, FIGURE.torso.y, 0]}
      enableZoom={false}
      enablePan={false}
      autoRotate={idle}
      autoRotateSpeed={-2.4}
      minPolarAngle={0.85}
      maxPolarAngle={1.65}
      onStart={() => {
        if (timer.current) clearTimeout(timer.current);
        setIdle(false);
      }}
      onEnd={() => {
        timer.current = setTimeout(() => setIdle(true), 2500);
      }}
    />
  );
}

export function LookPreview({ look, parts = [] }: { look: ResolvedLook; parts?: VoxelPartV1[] }) {
  // Canvas is client-only; wait for mount so SSR skips it cleanly.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <Canvas camera={{ position: [1.5, 1.1, -2.7], fov: 38 }} onCreated={({ camera }) => camera.lookAt(0, FIGURE.torso.y, 0)}>
      <hemisphereLight args={["#efe3c4", "#3a342e", 1.25]} />
      <directionalLight position={[3, 5, -4]} intensity={1.1} color="#f2e4c8" />
      <Figure look={look} parts={parts} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <circleGeometry args={[0.85, 24]} />
        <meshStandardMaterial color="#2a2620" roughness={0.9} />
      </mesh>
      <MirrorControls />
    </Canvas>
  );
}
