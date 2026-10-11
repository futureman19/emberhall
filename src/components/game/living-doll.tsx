import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState, useEffect } from "react";
import type { Group } from "three";
import { FIGURE } from "@/game/look/figure.ts";
import { SLOT_ANCHOR, partsById } from "@/game/look/parts.ts";
import { resolveLook } from "@/game/look/resolve.ts";
import { useGame } from "@/game/store";
import type { ItemId, RareItem, WearSlot } from "@/game/types";
import { Hair } from "./look-preview.tsx";
import { Held, Shield } from "./people-meshes.tsx";
import { RowanCharacterProvider } from "./rowan-character.tsx";
import { WEAR_HEX } from "./wear-hex.ts";
import {
  AuthoredCharacterFace,
  AuthoredCharacterGeometry,
  AuthoredCharacterTunic,
} from "./authored-character.tsx";

// The living paperdoll — the vale's real chibi figure standing in the You
// drawer, dressed in exactly what the world shows: per-slot wardrobe tints,
// hood or helm, cloak, the weapon in hand and the shield on the arm. Same
// vocabulary as people-meshes.tsx, posed still for close reading; drag to
// turn, left alone it slowly twirls like the looking glass.

function Mat({ color }: { color: string }) {
  return <meshStandardMaterial color={color} roughness={0.82} />;
}

function DollBody({
  wear,
  rareByUid,
}: {
  wear: Partial<Record<WearSlot, ItemId>>;
  rareByUid: (slot: WearSlot) => RareItem | null;
}) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    g.current.position.y = Math.sin(clock.elapsedTime * 3) * 0.02;
  });
  const snap = useGame((s) => s.snap);
  const self = snap.people.find((p) => p.isPlayer);
  const look = resolveLook(self?.look);
  const wornParts = partsById(self?.look?.parts);
  // A rare dresses the doll by its base item — the wonder keeps its cut.
  const worn = (slot: WearSlot): ItemId | undefined => rareByUid(slot)?.base ?? wear[slot];
  const tint = (slot: WearSlot): string | undefined => {
    const id = worn(slot);
    return id ? WEAR_HEX[id] : undefined;
  };
  const chest = tint("chest") ?? look.garb;
  const legs = tint("legs") ?? "#3a342e";
  const feet = tint("feet") ?? "#2e241c";
  const hands = tint("hands") ?? look.skin;
  const head = worn("head");
  const hoodColor = (head && WEAR_HEX[head]) ?? "#9a9286";
  const cloak = tint("cloak") ?? null;
  const main = worn("main");
  const off = worn("off");
  return (
    <group ref={g}>
      {cloak ? (
        <mesh position={[0, FIGURE.cloak.y, FIGURE.cloak.z]}>
          <AuthoredCharacterGeometry part="cloak" size={FIGURE.cloak.size} />
          <Mat color={cloak} />
        </mesh>
      ) : null}
      <mesh position={[-FIGURE.leg.x, FIGURE.leg.y, 0]}>
        <AuthoredCharacterGeometry part="leg" side={-1} size={FIGURE.leg.size} />
        <Mat color={legs} />
      </mesh>
      <mesh position={[FIGURE.leg.x, FIGURE.leg.y, 0]}>
        <AuthoredCharacterGeometry part="leg" size={FIGURE.leg.size} />
        <Mat color={legs} />
      </mesh>
      <mesh position={[-FIGURE.foot.x, FIGURE.foot.y, FIGURE.foot.z]}>
        <AuthoredCharacterGeometry part="foot" side={-1} size={FIGURE.foot.size} />
        <Mat color={feet} />
      </mesh>
      <mesh position={[FIGURE.foot.x, FIGURE.foot.y, FIGURE.foot.z]}>
        <AuthoredCharacterGeometry part="foot" size={FIGURE.foot.size} />
        <Mat color={feet} />
      </mesh>
      <mesh position={[0, FIGURE.torso.y, 0]}>
        <AuthoredCharacterGeometry part="torso" size={FIGURE.torso.size} />
        <Mat color={chest} />
        <AuthoredCharacterTunic color={chest} />
      </mesh>
      <group position={[-FIGURE.arm.x, FIGURE.arm.y, 0]} rotation={[0, 0, 0.12]}>
        <mesh position={[0, FIGURE.armMesh.y, 0]}>
          <AuthoredCharacterGeometry part="arm" side={-1} size={FIGURE.arm.size} />
          <Mat color={chest} />
        </mesh>
        <mesh position={[0, FIGURE.hand.y, 0]}>
          <AuthoredCharacterGeometry part="hand" side={-1} size={FIGURE.hand.size} />
          <Mat color={hands} />
        </mesh>
        {off ? <Shield id={off} ghost={false} /> : null}
      </group>
      <group position={[FIGURE.arm.x, FIGURE.arm.y, 0]} rotation={[0, 0, -0.12]}>
        <mesh position={[0, FIGURE.armMesh.y, 0]}>
          <AuthoredCharacterGeometry part="arm" size={FIGURE.arm.size} />
          <Mat color={chest} />
        </mesh>
        <mesh position={[0, FIGURE.hand.y, 0]}>
          <AuthoredCharacterGeometry part="hand" size={FIGURE.hand.size} />
          <Mat color={hands} />
        </mesh>
        {main ? <Held id={main} ghost={false} /> : null}
      </group>
      <mesh position={[0, FIGURE.head.y, 0]}>
        <AuthoredCharacterGeometry part="head" size={FIGURE.head.size} />
        <Mat color={look.skin} />
        <AuthoredCharacterFace skin={look.skin} />
      </mesh>
      {head === "helm" || head === "cap" ? (
        <mesh position={[0, FIGURE.helm.y, 0]}>
          <AuthoredCharacterGeometry part="helm" size={FIGURE.helm.size} />
          <Mat color={hoodColor} />
        </mesh>
      ) : head ? (
        <mesh position={[0, FIGURE.hood.y, FIGURE.hood.z]}>
          <AuthoredCharacterGeometry part="hood" size={FIGURE.hood.size} />
          <Mat color={hoodColor} />
        </mesh>
      ) : (
        <Hair look={look} />
      )}
      <mesh position={[0, FIGURE.belt.y, FIGURE.belt.z]}>
        <AuthoredCharacterGeometry part="belt" size={FIGURE.belt.size} />
        <meshStandardMaterial color="#c9a36a" roughness={0.7} />
      </mesh>
      {wornParts.map((part) => {
        const { at, voxel } = SLOT_ANCHOR[part.slot];
        return part.voxels.map((v, i) => (
          <mesh key={`${part.id}-${i}`} position={[at[0] + v.x * voxel, at[1] + v.y * voxel, at[2] + v.z * voxel]}>
            <boxGeometry args={[voxel, voxel, voxel]} />
            <Mat color={v.c} />
          </mesh>
        ));
      })}
    </group>
  );
}

export function LivingDoll({
  wear,
  rareByUid,
}: {
  wear: Partial<Record<WearSlot, ItemId>>;
  rareByUid: (slot: WearSlot) => RareItem | null;
}) {
  // Canvas is client-only; wait for mount so SSR skips it cleanly.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const self = useGame((s) => s.snap).people.find((p) => p.isPlayer);
  const look = resolveLook(self?.look);
  if (!mounted) return null;
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [1.1, 1.05, -2.2], fov: 36 }}
      onCreated={({ camera }) => camera.lookAt(0, FIGURE.torso.y, 0)}
    >
      <hemisphereLight args={["#efe3c4", "#3a342e", 1.25]} />
      <directionalLight position={[3, 5, -4]} intensity={1.1} color="#f2e4c8" />
      <RowanCharacterProvider skin={look.skin} hair={look.hairColor}>
        <DollBody wear={wear} rareByUid={rareByUid} />
      </RowanCharacterProvider>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <circleGeometry args={[0.85, 24]} />
        <meshStandardMaterial color="#2a2620" roughness={0.9} />
      </mesh>
      <OrbitControls
        makeDefault
        target={[0, FIGURE.torso.y, 0]}
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={-2.4}
        minPolarAngle={0.85}
        maxPolarAngle={1.65}
      />
    </Canvas>
  );
}
