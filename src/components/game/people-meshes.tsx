import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Quaternion, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { CLASS_META, SECONDS_PER_HOUR } from "@/game/catalog";
import { HEALING_DURATION, healingPose } from "@/game/healing-animation";
import { TAMING_DURATION, tamingPose } from "@/game/taming-animation";
import { CRAFTING_DURATION, craftingPose } from "@/game/crafting-animation";
import { getCraftFx } from "@/game/craft";
import { CORPSE_DURATION, corpseFxAge, corpsePose, getCorpseFx } from "@/game/corpse-animation";
import { GATHERING_DURATION, gatheringPose, gatheringVisualProfile, getGatheringFx } from "@/game/gathering-animation";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { SLOT_ANCHOR, partsById } from "@/game/look/parts.ts";
import { resolveLook } from "@/game/look/resolve.ts";
import type { ResolvedLook } from "@/game/look/resolve.ts";
import { getHealingFx, workPitch } from "@/game/player";
import { attackPhase, bowDrawAmount, meleeSwingPitch } from "@/game/combat-animation";
import { useGame } from "@/game/store";
import type { ItemId, Person, WearSlot } from "@/game/types";

function groundAt(x: number, z: number) {
  return groundY(getWorld(), x, z);
}

const WEAR_HEX: Partial<Record<ItemId, string>> = {
  tunic: "#c9a36a",
  leather: "#a85a42",
  mail: "#8a8680",
  cuirass: "#6a4a32",
  hood: "#6a3a32",
  helm: "#9a9286",
  cap: "#6a4a32",
  cloak: "#a85a42",
  hose: "#4a443c",
  greaves: "#7a7670",
  boots: "#4a3228",
  gloves: "#c9a36a",
  gauntlets: "#8a8680",
  gorget: "#9a9286",
};

// Hair vocabulary — crop alone is the vale's classic cap (bit-for-bit parity
// when no look is stored); the rest are the looking glass's offerings.
function HairMeshes({ look, ghost }: { look: ResolvedLook; ghost: boolean }) {
  const c = look.hairColor;
  if (look.hairStyle === "bald") return null;
  return (
    <group>
      <mesh position={[0, 1.14, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.3, 0.08, 0.28]} />
        <Mat color={c} ghost={ghost} />
      </mesh>
      {look.hairStyle === "shag" && (
        <>
          {[-0.17, 0.17].map((x) => (
            <mesh key={x} position={[x, 1.02, 0]} castShadow={!ghost}>
              <boxGeometry args={[0.06, 0.2, 0.28]} />
              <Mat color={c} ghost={ghost} />
            </mesh>
          ))}
          <mesh position={[0, 1.02, 0.16]} castShadow={!ghost}>
            <boxGeometry args={[0.3, 0.2, 0.06]} />
            <Mat color={c} ghost={ghost} />
          </mesh>
        </>
      )}
      {look.hairStyle === "tail" && (
        <mesh position={[0, 0.96, 0.18]} castShadow={!ghost}>
          <boxGeometry args={[0.12, 0.34, 0.08]} />
          <Mat color={c} ghost={ghost} />
        </mesh>
      )}
      {look.hairStyle === "long" && (
        <mesh position={[0, 0.94, 0.17]} castShadow={!ghost}>
          <boxGeometry args={[0.3, 0.4, 0.08]} />
          <Mat color={c} ghost={ghost} />
        </mesh>
      )}
    </group>
  );
}

function Mat({ color, ghost }: { color: string; ghost: boolean }) {
  if (ghost) {
    return (
      <meshStandardMaterial
        color="#ece6d8"
        emissive="#c9c3b6"
        emissiveIntensity={0.55}
        transparent
        opacity={0.58}
        roughness={0.4}
        depthWrite={false}
      />
    );
  }
  return <meshStandardMaterial color={color} roughness={0.82} />;
}

function Hatchet({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.02, -0.44, 0.04]} rotation={[0.15, 0, 0.35]}>
      <mesh position={[0, 0.16, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.045, 0.42, 0.045]} />
        <Mat color="#5a3e28" ghost={ghost} />
      </mesh>
      <mesh position={[0.08, 0.36, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.2, 0.1, 0.07]} />
        <meshStandardMaterial color="#8a8680" metalness={0.45} roughness={0.4} />
      </mesh>
    </group>
  );
}

function Knife({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.02, -0.42, 0.04]} rotation={[0.2, 0, 0.2]}>
      <mesh position={[0, 0.08, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.04, 0.16, 0.04]} />
        <Mat color="#5a3e28" ghost={ghost} />
      </mesh>
      <mesh position={[0, 0.24, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.05, 0.22, 0.02]} />
        <meshStandardMaterial color="#9a9286" metalness={0.55} roughness={0.32} />
      </mesh>
    </group>
  );
}

function Sword({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.02, -0.44, 0.04]} rotation={[0.12, 0, 0.28]}>
      <mesh position={[0, 0.1, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.045, 0.22, 0.045]} />
        <Mat color="#5a3e28" ghost={ghost} />
      </mesh>
      <mesh position={[0, 0.22, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.16, 0.04, 0.04]} />
        <meshStandardMaterial color="#8a8680" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.44, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.055, 0.46, 0.02]} />
        <meshStandardMaterial color="#c9c3b6" metalness={0.65} roughness={0.28} />
      </mesh>
    </group>
  );
}

function Club({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.02, -0.44, 0.04]} rotation={[0.15, 0, 0.3]}>
      <mesh position={[0, 0.22, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.055, 0.5, 0.055]} />
        <Mat color="#5a3e28" ghost={ghost} />
      </mesh>
      <mesh position={[0, 0.48, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.12, 0.16, 0.12]} />
        <Mat color="#6a4a32" ghost={ghost} />
      </mesh>
    </group>
  );
}

function Mace({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.02, -0.44, 0.04]} rotation={[0.15, 0, 0.3]}>
      <mesh position={[0, 0.2, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.045, 0.42, 0.045]} />
        <Mat color="#5a3e28" ghost={ghost} />
      </mesh>
      <mesh position={[0, 0.46, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.16, 0.16, 0.16]} />
        <meshStandardMaterial color="#8a8680" metalness={0.5} roughness={0.38} />
      </mesh>
    </group>
  );
}

function Staff({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.02, -0.5, 0.04]} rotation={[0.08, 0, 0.22]}>
      <mesh position={[0, 0.38, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.04, 0.9, 0.04]} />
        <Mat color="#5a3e28" ghost={ghost} />
      </mesh>
      <mesh position={[0, 0.86, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshStandardMaterial color="#c9a36a" roughness={0.45} />
      </mesh>
    </group>
  );
}

function Bow({ ghost }: { ghost: boolean }) {
  const arrow = useRef<Group>(null);
  useFrame(() => {
    const a = arrow.current;
    if (!a) return;
    const world = getWorld();
    const draw = bowDrawAmount(world.player.workT);
    a.visible = !ghost && world.player.intent.kind === "hunt" && draw > 0.04;
    a.position.z = -0.05 - draw * 0.26;
  });
  return (
    <group position={[0.04, -0.4, 0.02]} rotation={[0.1, 0.4, 0.15]}>
      <mesh position={[0, 0.28, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.04, 0.62, 0.04]} />
        <Mat color="#6a4a32" ghost={ghost} />
      </mesh>
      <mesh position={[0.08, 0.28, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.02, 0.56, 0.02]} />
        <meshStandardMaterial color="#ece6d8" roughness={0.6} />
      </mesh>
      <group ref={arrow} position={[0, 0.28, -0.05]} visible={false}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.78, 5]} />
          <meshBasicMaterial color="#d8efff" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.035, 0.1, 5]} />
          <meshStandardMaterial color="#9a9286" metalness={0.35} roughness={0.45} />
        </mesh>
      </group>
    </group>
  );
}

function Torch({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.02, -0.44, 0.04]} rotation={[0.18, 0, 0.25]}>
      <mesh position={[0, 0.18, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.045, 0.36, 0.045]} />
        <Mat color="#5a3e28" ghost={ghost} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.08, 0.1, 0.08]} />
        <meshStandardMaterial
          color="#a85a42"
          emissive="#a85a42"
          emissiveIntensity={ghost ? 0.2 : 0.8}
        />
      </mesh>
      {!ghost && <pointLight color="#e0b56a" intensity={1.6} distance={5.2} />}
    </group>
  );
}

function Shield({ id, ghost }: { id: ItemId; ghost: boolean }) {
  const iron = id === "heater";
  return (
    <group position={[-0.02, -0.28, 0.08]} rotation={[0.2, 0.15, -0.35]}>
      <mesh castShadow={!ghost}>
        <boxGeometry args={[0.28, 0.38, 0.06]} />
        <meshStandardMaterial
          color={iron ? "#8a8680" : "#6a4a32"}
          metalness={iron ? 0.5 : 0.05}
          roughness={iron ? 0.4 : 0.85}
        />
      </mesh>
      <mesh position={[0, 0.02, 0.04]}>
        <boxGeometry args={[0.1, 0.1, 0.04]} />
        <meshStandardMaterial color="#c9a36a" roughness={0.5} />
      </mesh>
    </group>
  );
}

function Held({ id, ghost }: { id: ItemId; ghost: boolean }) {
  if (id === "hatchet") return <Hatchet ghost={ghost} />;
  if (id === "pick") return <Pick ghost={ghost} />;
  if (id === "hoe") return <Hoe ghost={ghost} />;
  if (id === "knife") return <Knife ghost={ghost} />;
  if (id === "sword") return <Sword ghost={ghost} />;
  if (id === "club") return <Club ghost={ghost} />;
  if (id === "mace") return <Mace ghost={ghost} />;
  if (id === "staff") return <Staff ghost={ghost} />;
  if (id === "bow") return <Bow ghost={ghost} />;
  if (id === "torch") return <Torch ghost={ghost} />;
  return null;
}

function Hoe({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.02, -0.44, 0.04]} rotation={[0.15, 0, 0.35]}>
      <mesh position={[0, 0.16, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.04, 0.44, 0.04]} />
        <Mat color="#5a3e28" ghost={ghost} />
      </mesh>
      <mesh position={[0.1, 0.38, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.22, 0.05, 0.12]} />
        <meshStandardMaterial color="#8a8680" metalness={0.45} roughness={0.4} />
      </mesh>
    </group>
  );
}

function Pick({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.02, -0.44, 0.04]} rotation={[0.15, 0, 0.35]}>
      <mesh position={[0, 0.16, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.04, 0.44, 0.04]} />
        <Mat color="#5a3e28" ghost={ghost} />
      </mesh>
      <mesh position={[0.02, 0.38, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.28, 0.07, 0.06]} />
        <meshStandardMaterial color="#9a9286" metalness={0.5} roughness={0.38} />
      </mesh>
    </group>
  );
}

function MeleeSwingArc() {
  const arc = useRef<Mesh>(null);
  useFrame(() => {
    const mesh = arc.current;
    if (!mesh) return;
    const world = getWorld();
    const phase = attackPhase(world.player.workT);
    const live =
      world.player.intent.kind === "hunt" &&
      world.player.wear.main !== "bow" &&
      phase > 0.36 &&
      phase < 0.82;
    mesh.visible = live;
    if (!live) return;
    const strike = Math.sin(((phase - 0.36) / 0.46) * Math.PI);
    mesh.rotation.z = -0.95 + phase * 1.9;
    mesh.scale.setScalar(1 + strike * 0.5);
    const material = mesh.material as MeshBasicMaterial;
    material.opacity = 0.55 + strike * 0.4;
  });
  return (
    <mesh
      ref={arc}
      visible={false}
      renderOrder={6}
      position={[0, 0.14, 0.14]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[0.48, 0.76, 24, 1, -1.05, 2.1]} />
      <meshBasicMaterial
        color="#ffd36a"
        transparent
        opacity={0.9}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function PalmFlame() {
  const wrap = useRef<Group>(null);
  const flame = useRef<Group>(null);
  const q = useMemo(() => new Quaternion(), []);
  useFrame((_, dt) => {
    const w = wrap.current;
    const f = flame.current;
    if (!w || !f) return;
    const world = getWorld();
    const you = world.people.find((x) => x.isPlayer);
    const live = Boolean(
      you && !you.ghost && !you.path.length && world.player.intent.kind === "cast",
    );
    w.visible = live;
    if (!live) return;
    w.parent?.getWorldQuaternion(q);
    f.quaternion.copy(q).invert();
    const t = world.player.workT * 14 + dt;
    const s =
      0.72 +
      Math.min(1, world.player.workT / 0.28) * 0.45 +
      Math.sin(t) * 0.12 +
      Math.sin(t * 2.4) * 0.08;
    f.scale.setScalar(s);
    f.rotation.y += dt * 5;
  });
  return (
    <group ref={wrap} position={[0, -0.44, 0.02]} visible={false}>
      <group ref={flame}>
        <mesh position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.07, 8, 6]} />
          <meshBasicMaterial
            color="#e8f2ff"
            transparent
            opacity={0.95}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <coneGeometry args={[0.06, 0.22, 6]} />
          <meshBasicMaterial
            color="#4a7ec8"
            transparent
            opacity={0.78}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.15, 8, 6]} />
          <meshBasicMaterial
            color="#7aa8e8"
            transparent
            opacity={0.3}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <pointLight color="#8eb8ff" intensity={1.7} distance={2.6} />
      </group>
    </group>
  );
}

function BandageWrap() {
  const group = useRef<Group>(null);
  useFrame(() => {
    const wrap = group.current;
    if (!wrap) return;
    const fx = getHealingFx();
    const age = fx ? (getWorld().hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const pose = healingPose(age);
    wrap.visible = pose.wrap > 0;
    if (!wrap.visible) return;
    wrap.rotation.y = age * 5.5;
    wrap.scale.setScalar(0.82 + pose.wrap * 0.22);
  });
  return (
    <group ref={group} visible={false} renderOrder={7}>
      <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.34, 0.065, 8, 24]} />
        <meshBasicMaterial
          color="#fff8e7"
          transparent
          opacity={0.92}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.72, 0]} rotation={[Math.PI / 2, 0.22, 0]}>
        <torusGeometry args={[0.32, 0.06, 8, 24]} />
        <meshBasicMaterial
          color="#ece6d8"
          transparent
          opacity={0.9}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0.28, 0.48, 0.04]} rotation={[0.2, 0, -0.35]}>
        <boxGeometry args={[0.12, 0.58, 0.055]} />
        <meshBasicMaterial
          color="#fff8e7"
          transparent
          opacity={0.9}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.82, -0.16]} rotation={[0, 0, 0.72]}>
        <boxGeometry args={[0.52, 0.09, 0.045]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.92}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.82, -0.15]} rotation={[0, 0, -0.72]}>
        <boxGeometry args={[0.52, 0.09, 0.045]} />
        <meshBasicMaterial
          color="#ece6d8"
          transparent
          opacity={0.9}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh renderOrder={8} position={[0, 0.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.46, 0.59, 28, 1, 0.2, 4.8]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.88}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh renderOrder={8} position={[0, 0.86, 0]} rotation={[-Math.PI / 2, 0, Math.PI]}>
        <ringGeometry args={[0.4, 0.52, 24, 1, 0.35, 4.4]} />
        <meshBasicMaterial
          color="#fff8e7"
          transparent
          opacity={0.82}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <group position={[0.72, 1.48, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh renderOrder={9}>
          <cylinderGeometry args={[0.32, 0.32, 0.68, 16]} />
          <meshBasicMaterial
            color="#ffffff"
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
        <mesh renderOrder={10} position={[0, 0.345, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.02, 14]} />
          <meshBasicMaterial
            color="#8a8d90"
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
      </group>
      <mesh renderOrder={9} position={[0.24, 1.26, 0]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[1.05, 0.17, 0.07]} />
        <meshBasicMaterial
          color="#fff8e7"
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function BandageBillboard() {
  const label = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const element = label.current;
    if (!element) return;
    const fx = getHealingFx();
    const age = fx ? (getWorld().hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const pose = healingPose(age);
    const visible = age >= 0 && age < HEALING_DURATION && pose.wrap > 0;
    element.style.display = visible ? "grid" : "none";
    if (!visible) return;
    element.style.opacity = String(Math.min(1, pose.wrap * 1.35));
    element.style.transform = `scale(${0.9 + pose.wrap * 0.12})`;
  });
  return (
    <Html position={[0, 3.2, 0]} center zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
      <div
        ref={label}
        style={{
          display: "none",
          placeItems: "center",
          gap: 3,
          minWidth: 72,
          padding: "5px 8px",
          border: "1px solid rgba(255, 211, 106, 0.75)",
          borderRadius: 8,
          background: "rgba(20, 18, 15, 0.86)",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.45)",
          color: "#fff8e7",
          fontFamily: "serif",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          transformOrigin: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", height: 16 }}>
          <div
            style={{
              width: 22,
              height: 14,
              borderRadius: 7,
              background: "#fff",
              border: "2px solid #d8d4cc",
              boxShadow: "inset 0 0 0 4px #8a8d90",
            }}
          />
          <div
            style={{
              width: 26,
              height: 7,
              marginLeft: -2,
              borderRadius: "0 4px 4px 0",
              background: "#fff8e7",
              transform: "rotate(-8deg)",
              transformOrigin: "left center",
            }}
          />
        </div>
        <span>Bandaging</span>
      </div>
    </Html>
  );
}

function CraftingTool() {
  const hammer = useRef<Group>(null);
  const saw = useRef<Group>(null);
  const spoon = useRef<Group>(null);
  useFrame(() => {
    const fx = getCraftFx();
    const age = fx ? (getWorld().hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const live = Boolean(fx && age >= 0 && age < CRAFTING_DURATION);
    const pose = fx ? craftingPose(fx.kind, age) : { work: 0, strike: 0, stir: 0 };
    if (hammer.current) { hammer.current.visible = live && fx?.kind === "smithing"; hammer.current.rotation.z = -0.25 - pose.strike * 0.75; }
    if (saw.current) { saw.current.visible = live && fx?.kind === "carpentry"; saw.current.position.z = -0.18 + Math.sin(age * 26) * 0.18 * pose.work; }
    if (spoon.current) { spoon.current.visible = live && fx?.kind === "cooking"; spoon.current.rotation.y = age * 8; spoon.current.rotation.z = 0.32 + pose.stir * 0.24; }
  });
  return (
    <group>
      <group ref={hammer} visible={false} position={[0.02, -0.48, 0.04]}><mesh position={[0, 0.2, 0]}><boxGeometry args={[0.05, 0.5, 0.05]} /><meshStandardMaterial color="#5a3e28" roughness={0.9} /></mesh><mesh position={[0, 0.48, 0]}><boxGeometry args={[0.28, 0.14, 0.14]} /><meshStandardMaterial color="#9a9286" metalness={0.65} roughness={0.3} /></mesh></group>
      <group ref={saw} visible={false} position={[0, -0.34, 0]} rotation={[0.25, 0, 0.4]}><mesh><boxGeometry args={[0.08, 0.46, 0.04]} /><meshStandardMaterial color="#5a3e28" roughness={0.9} /></mesh><mesh position={[0, -0.28, 0]}><boxGeometry args={[0.42, 0.18, 0.025]} /><meshStandardMaterial color="#c9c3b6" metalness={0.55} roughness={0.3} /></mesh></group>
      <group ref={spoon} visible={false} position={[0, -0.42, 0]}><mesh><cylinderGeometry args={[0.025, 0.025, 0.58, 6]} /><meshStandardMaterial color="#8a6a42" roughness={0.85} /></mesh><mesh position={[0, -0.32, 0]}><sphereGeometry args={[0.09, 8, 6]} /><meshStandardMaterial color="#8a6a42" roughness={0.85} /></mesh></group>
    </group>
  );
}

function CraftingBillboard() {
  const label = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const element = label.current;
    if (!element) return;
    const fx = getCraftFx();
    const age = fx ? (getWorld().hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const visible = Boolean(fx && age >= 0 && age < CRAFTING_DURATION);
    element.style.display = visible ? "grid" : "none";
    if (!fx || !visible) return;
    const labelText = fx.kind === "smithing" ? "Smithing" : fx.kind === "carpentry" ? "Carpentry" : "Cooking";
    const icon = fx.kind === "smithing" ? "⚒" : fx.kind === "carpentry" ? "SAW" : "♨";
    element.innerHTML = `<span style="font-size:18px;line-height:1">${icon}</span><span>${labelText}</span>`;
    element.style.borderColor = fx.success ? "rgba(255, 211, 106, 0.88)" : "rgba(168, 90, 66, 0.9)";
    element.style.color = fx.success ? "#fff8e7" : "#ece6d8";
  });
  return (
    <Html position={[0, 3.2, 0]} center zIndexRange={[36, 0]} style={{ pointerEvents: "none" }}>
      <div ref={label} style={{ display: "none", placeItems: "center", gap: 2, minWidth: 82, padding: "6px 9px", border: "1px solid rgba(255, 211, 106, 0.8)", borderRadius: 8, background: "rgba(20, 18, 15, 0.9)", boxShadow: "0 0 16px rgba(0, 0, 0, 0.5)", fontFamily: "serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }} />
    </Html>
  );
}

function GatheringTool() {
  const seed = useRef<Group>(null);
  const crop = useRef<Group>(null);
  const sapling = useRef<Group>(null);
  useFrame(() => {
    const fx = getGatheringFx();
    const age = fx ? (getWorld().hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const live = Boolean(fx && age >= 0 && age < GATHERING_DURATION);
    const pose = fx ? gatheringPose(fx.kind, age) : { scatter: 0, pull: 0, settle: 0 };
    if (seed.current) { seed.current.visible = live && fx?.kind === "sowing"; seed.current.rotation.z = -0.45 + pose.scatter * 0.5; }
    if (crop.current) { crop.current.visible = live && fx?.kind === "harvesting"; crop.current.position.y = -0.45 + pose.pull * 0.24; }
    if (sapling.current) { sapling.current.visible = live && fx?.kind === "forestry"; sapling.current.rotation.z = 0.25 - pose.settle * 0.35; }
  });
  return (
    <group>
      <group ref={seed} visible={false} position={[0, -0.42, -0.08]}>
        {[-0.08, 0, 0.08].map((x) => <mesh key={x} position={[x, 0, Math.abs(x) * 0.5]}><sphereGeometry args={[0.055, 7, 5]} /><meshStandardMaterial color="#e7c76d" roughness={0.85} /></mesh>)}
      </group>
      <group ref={crop} visible={false} position={[0, -0.42, 0]}><mesh><sphereGeometry args={[0.18, 8, 6]} /><meshStandardMaterial color="#7f9f52" roughness={0.85} /></mesh><mesh position={[0, 0.22, 0]}><boxGeometry args={[0.05, 0.34, 0.05]} /><meshStandardMaterial color="#d9b65f" roughness={0.9} /></mesh></group>
      <group ref={sapling} visible={false} position={[0, -0.44, 0]}><mesh position={[0, 0.18, 0]}><boxGeometry args={[0.05, 0.42, 0.05]} /><meshStandardMaterial color="#6a4a32" roughness={0.9} /></mesh><mesh position={[0, 0.45, 0]}><boxGeometry args={[0.3, 0.18, 0.3]} /><meshStandardMaterial color="#80a958" roughness={0.85} /></mesh></group>
    </group>
  );
}

function GatheringBillboard() {
  const label = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const element = label.current;
    if (!element) return;
    const fx = getGatheringFx();
    const age = fx ? (getWorld().hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const visible = Boolean(fx && age >= 0 && age < GATHERING_DURATION);
    element.style.display = visible ? "grid" : "none";
    if (!fx || !visible) return;
    const profile = gatheringVisualProfile(fx.kind);
    const icon = fx.kind === "tilling" ? "HOE" : fx.kind === "sowing" ? "SEED" : fx.kind === "harvesting" ? "CROP" : "SAPLING";
    element.textContent = `${icon} · ${profile.label}`;
    element.style.borderColor = fx.success ? profile.primary : "#a85a42";
  });
  return (
    <Html position={[0, 3.2, 0]} center zIndexRange={[35, 0]} style={{ pointerEvents: "none" }}>
      <div ref={label} style={{ display: "none", placeItems: "center", minWidth: 96, padding: "7px 10px", border: "1px solid", borderRadius: 8, background: "rgba(20, 18, 15, 0.92)", boxShadow: "0 0 16px rgba(0, 0, 0, 0.55)", color: "#fff8e7", fontFamily: "serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }} />
    </Html>
  );
}

function CorpseBillboard() {
  const label = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const element = label.current;
    if (!element) return;
    const world = getWorld();
    const fx = getCorpseFx();
    const age = fx ? corpseFxAge(world, fx) : Infinity;
    const visible = Boolean(fx && age >= 0 && age < CORPSE_DURATION);
    element.style.display = visible ? "grid" : "none";
    if (!fx || !visible) return;
    element.textContent = fx.kind === "skinning" ? "BLADE · SKINNING" : "SACK · LOOTING";
    element.style.borderColor = fx.kind === "skinning" ? "#d09a72" : "#ffd36a";
  });
  return (
    <Html position={[0, 3.2, 0]} center zIndexRange={[34, 0]} style={{ pointerEvents: "none" }}>
      <div ref={label} style={{ display: "none", placeItems: "center", minWidth: 104, padding: "7px 10px", border: "1px solid", borderRadius: 8, background: "rgba(20, 18, 15, 0.92)", boxShadow: "0 0 16px rgba(0, 0, 0, 0.55)", color: "#fff8e7", fontFamily: "serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }} />
    </Html>
  );
}

function Figure({
  p,
  selected,
  wear,
}: {
  p: Person;
  selected: boolean;
  wear: Partial<Record<WearSlot, ItemId>>;
}) {
  const ghost = Boolean(p.ghost);
  const bob = Math.sin(p.bob) * (ghost ? 0.08 : 0.04);
  const walkSwing = p.path.length ? Math.sin(p.bob) * 0.35 : 0;
  const root = useRef<Group>(null);
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const held = useRef<Group>(null);
  useFrame(() => {
    if (!p.isPlayer) return;
    const w = getWorld();
    const you = w.people.find((x) => x.isPlayer);
    const healFx = getHealingFx();
    const healAge = healFx ? (w.hour - healFx.at) * SECONDS_PER_HOUR : Infinity;
    const healPose = healingPose(healAge);
    const healing = healAge >= 0 && healAge < HEALING_DURATION && healPose.wrap > 0;
    const tamePose = tamingPose(w.player.workT);
    const taming = Boolean(
      you &&
      !you.path.length &&
      w.player.intent.kind === "tame" &&
      w.player.workT < TAMING_DURATION,
    );
    const craftFx = getCraftFx();
    const craftAge = craftFx ? (w.hour - craftFx.at) * SECONDS_PER_HOUR : Infinity;
    const crafting = Boolean(craftFx && craftAge >= 0 && craftAge < CRAFTING_DURATION);
    const craftPose = craftFx ? craftingPose(craftFx.kind, craftAge) : { work: 0, strike: 0, stir: 0 };
    const gatheringFx = getGatheringFx();
    const gatheringAge = gatheringFx ? (w.hour - gatheringFx.at) * SECONDS_PER_HOUR : Infinity;
    const gathering = Boolean(gatheringFx && gatheringAge >= 0 && gatheringAge < GATHERING_DURATION);
    const gatherPose = gatheringFx ? gatheringPose(gatheringFx.kind, gatheringAge) : { work: 0, strike: 0, scatter: 0, pull: 0, settle: 0 };
    const corpseFx = getCorpseFx();
    const corpseAge = corpseFx ? corpseFxAge(w, corpseFx) : Infinity;
    const corpseWorking = Boolean(corpseFx && corpseAge >= 0 && corpseAge < CORPSE_DURATION);
    const corpseWorkPose = corpseFx ? corpsePose(corpseFx.kind, corpseAge) : { crouch: 0, lean: 0, reach: 0, cut: 0 };
    if (you && root.current) {
      root.current.position.set(
        you.x,
        groundAt(you.x, you.z) + (you.ghost ? 0.32 : 0) - healPose.crouch - corpseWorkPose.crouch,
        you.z,
      );
      root.current.rotation.x = healPose.lean + corpseWorkPose.lean + (taming ? tamePose.bow : 0) + (crafting ? craftPose.work * 0.14 : 0) + (gathering ? gatherPose.work * 0.2 : 0);
      root.current.rotation.y = you.facing;
    }
    const it = w.player.intent;
    const idle = Boolean(you && !you.ghost && !you.path.length);
    const chopping =
      idle &&
      (it.kind === "chop" ||
        it.kind === "mine" ||
        it.kind === "plant" ||
        it.kind === "harvest" ||
        it.kind === "till");
    const casting = idle && it.kind === "cast";
    const hunting = idle && it.kind === "hunt";
    const bowing = hunting && w.player.wear.main === "bow";
    const draw = bowing ? bowDrawAmount(w.player.workT) : 0;
    if (held.current) held.current.visible = !casting && !healing && !taming && !crafting && (!gathering || gatheringFx?.kind === "tilling") && (!corpseWorking || corpseFx?.kind === "skinning");
    if (left.current) {
      if (healing) {
        left.current.rotation.set(0.98, 0.48, 1.02);
      } else if (taming) {
        left.current.rotation.set(0.72 + tamePose.reach * 0.25, 0.36, 0.82 + tamePose.reach * 0.2);
      } else if (crafting && craftFx) {
        left.current.rotation.set(craftFx.kind === "smithing" ? 0.72 : 0.9, 0.34, craftFx.kind === "cooking" ? 0.82 : 0.62);
      } else if (gathering && gatheringFx) {
        left.current.rotation.set(gatheringFx.kind === "tilling" ? 0.7 : 1.02, 0.38, gatheringFx.kind === "harvesting" ? 0.94 : 0.7);
      } else if (corpseWorking) {
        left.current.rotation.set(0.88 + corpseWorkPose.reach * 0.35, 0.4, 0.82 + corpseWorkPose.reach * 0.22);
      } else if (casting) {
        const u = Math.min(1, w.player.workT / 0.26);
        const e = u * u * (3 - 2 * u);
        left.current.rotation.set(
          walkSwing * (1 - e) + 1.1 * e,
          0.28 * e,
          0.12 * (1 - e) + 1.08 * e,
        );
      } else if (bowing) {
        left.current.rotation.set(0.88 + draw * 0.32, 0.42, 0.72 + draw * 0.22);
      } else if (hunting) {
        left.current.rotation.set(-0.42, 0.18, 0.38);
      } else {
        left.current.rotation.set(walkSwing, 0, 0.12);
      }
    }
    if (right.current) {
      if (healing) {
        right.current.rotation.set(1.08, -0.5, -1.02);
      } else if (taming) {
        right.current.rotation.set(
          0.72 + tamePose.reach * 0.25,
          -0.36,
          -0.82 - tamePose.reach * 0.2,
        );
      } else if (crafting && craftFx) {
        const pitch = craftFx.kind === "smithing"
          ? -0.55 + craftPose.strike * 1.75
          : craftFx.kind === "carpentry"
            ? 0.85 + Math.sin(craftAge * 26) * 0.28 * craftPose.work
            : 0.9 + craftPose.stir * 0.2;
        right.current.rotation.set(pitch, -0.3, craftFx.kind === "cooking" ? -0.92 : -0.58);
      } else if (gathering && gatheringFx) {
        const pitch = gatheringFx.kind === "tilling" ? -0.65 + gatherPose.strike * 1.8 : gatheringFx.kind === "sowing" ? 0.65 + gatherPose.scatter * 0.55 : gatheringFx.kind === "harvesting" ? 1.2 - gatherPose.pull * 0.55 : 0.95 + gatherPose.settle * 0.25;
        right.current.rotation.set(pitch, -0.35, gatheringFx.kind === "sowing" ? -1.05 : -0.72);
      } else if (corpseWorking && corpseFx) {
        const pitch = corpseFx.kind === "skinning" ? 0.7 + corpseWorkPose.cut * 0.55 : 0.92 - corpseWorkPose.reach * 0.42;
        right.current.rotation.set(pitch, -0.38, -0.82 - corpseWorkPose.reach * 0.18);
      } else if (chopping) {
        const pitch = workPitch(w.player.workT);
        right.current.rotation.set(pitch, 0.18, -0.22);
      } else if (casting) {
        const u = Math.min(1, w.player.workT / 0.26);
        const e = u * u * (3 - 2 * u);
        right.current.rotation.set(
          -walkSwing * (1 - e) + 1.1 * e,
          -0.28 * e,
          -0.12 * (1 - e) - 1.08 * e,
        );
      } else if (bowing) {
        right.current.rotation.set(0.82 + draw * 0.5, -0.38 - draw * 0.22, -0.84 - draw * 0.32);
      } else if (hunting) {
        right.current.rotation.set(meleeSwingPitch(w.player.workT), 0.28, -0.42);
      } else {
        right.current.rotation.set(-walkSwing, 0, -0.12);
      }
    }
  });
  const look = resolveLook(p.look);
  const wornParts = ghost ? [] : partsById(p.look?.parts);
  const chest =
    (p.isPlayer && wear.chest && WEAR_HEX[wear.chest]) ||
    (p.isPlayer ? look.garb : CLASS_META[p.cls].color);
  const legs = (p.isPlayer && wear.legs && WEAR_HEX[wear.legs]) || "#3a342e";
  const feet = (p.isPlayer && wear.feet && WEAR_HEX[wear.feet]) || "#2e241c";
  const hands = (p.isPlayer && wear.hands && WEAR_HEX[wear.hands]) || look.skin;
  const hood = p.isPlayer
    ? wear.head
    : p.cls === "mage" || p.role === "healer"
      ? "hood"
      : p.cls === "warrior"
        ? "helm"
        : null;
  const hoodColor =
    (hood && WEAR_HEX[hood as ItemId]) ||
    (p.role === "healer" ? "#ece6d8" : hood === "helm" ? "#9a9286" : "#6a3a32");
  const cloak =
    ghost ||
    (p.isPlayer
      ? Boolean(wear.cloak)
      : p.cls === "mage" || p.role === "healer" || p.cls === "ranger");
  const cloakColor = ghost
    ? "#ece6d8"
    : (p.isPlayer && wear.cloak && WEAR_HEX[wear.cloak]) ||
      (p.role === "healer" ? "#ece6d8" : p.cls === "ranger" ? "#6a7a48" : "#a85a42");
  const hover = ghost ? 0.32 : 0;

  return (
    <group ref={root} position={[p.x, groundAt(p.x, p.z) + hover, p.z]} rotation={[0, p.facing, 0]}>
      {cloak && (
        <mesh position={[0, 0.62 + bob, 0.16]} castShadow={!ghost}>
          <boxGeometry args={[0.52, 0.72, 0.12]} />
          <Mat color={cloakColor} ghost={ghost} />
        </mesh>
      )}
      <mesh position={[-0.1, 0.22 + bob, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.14, 0.4, 0.16]} />
        <Mat color={legs} ghost={ghost} />
      </mesh>
      <mesh position={[0.1, 0.22 + bob, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.14, 0.4, 0.16]} />
        <Mat color={legs} ghost={ghost} />
      </mesh>
      <mesh position={[-0.1, 0.04 + bob, 0.02]} castShadow={!ghost}>
        <boxGeometry args={[0.16, 0.08, 0.22]} />
        <Mat color={feet} ghost={ghost} />
      </mesh>
      <mesh position={[0.1, 0.04 + bob, 0.02]} castShadow={!ghost}>
        <boxGeometry args={[0.16, 0.08, 0.22]} />
        <Mat color={feet} ghost={ghost} />
      </mesh>
      <mesh position={[0, 0.58 + bob, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.42, 0.5, 0.26]} />
        <Mat color={chest} ghost={ghost} />
      </mesh>
      <group ref={left} position={[-0.28, 0.62 + bob, 0]} rotation={[walkSwing, 0, 0.12]}>
        <mesh position={[0, -0.16, 0]} castShadow={!ghost}>
          <boxGeometry args={[0.12, 0.42, 0.12]} />
          <Mat color={chest} ghost={ghost} />
        </mesh>
        <mesh position={[0, -0.38, 0]} castShadow={!ghost}>
          <boxGeometry args={[0.12, 0.1, 0.12]} />
          <Mat color={hands} ghost={ghost} />
        </mesh>
        {p.isPlayer && !ghost && <PalmFlame />}
        {p.isPlayer && wear.off && <Shield id={wear.off} ghost={ghost} />}
      </group>
      <group ref={right} position={[0.28, 0.62 + bob, 0]} rotation={[-walkSwing, 0, -0.12]}>
        <mesh position={[0, -0.16, 0]} castShadow={!ghost}>
          <boxGeometry args={[0.12, 0.42, 0.12]} />
          <Mat color={chest} ghost={ghost} />
        </mesh>
        <mesh position={[0, -0.38, 0]} castShadow={!ghost}>
          <boxGeometry args={[0.12, 0.1, 0.12]} />
          <Mat color={hands} ghost={ghost} />
        </mesh>
        <group ref={held}>{p.isPlayer && wear.main && <Held id={wear.main} ghost={ghost} />}</group>
        {p.isPlayer && !ghost && <CraftingTool />}
        {p.isPlayer && !ghost && <GatheringTool />}
        {p.isPlayer && !ghost && <PalmFlame />}
      </group>
      <mesh position={[0, 0.98 + bob, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.28, 0.28, 0.26]} />
        <Mat color={look.skin} ghost={ghost} />
      </mesh>
      {!hood && (
        <group position={[0, bob, 0]}>
          <HairMeshes look={look} ghost={ghost} />
        </group>
      )}
      {hood === "helm" || hood === "cap" ? (
        <mesh position={[0, 1.12 + bob, 0]} castShadow={!ghost}>
          <boxGeometry args={[0.34, 0.16, 0.32]} />
          <Mat color={hoodColor} ghost={ghost} />
        </mesh>
      ) : hood ? (
        <mesh position={[0, 1.12 + bob, -0.02]} castShadow={!ghost}>
          <boxGeometry args={[0.34, 0.2, 0.34]} />
          <Mat color={hoodColor} ghost={ghost} />
        </mesh>
      ) : null}
      {p.isPlayer && !ghost && (
        <mesh position={[0, 0.62 + bob, -0.14]} castShadow>
          <boxGeometry args={[0.22, 0.18, 0.06]} />
          <meshStandardMaterial color="#c9a36a" roughness={0.7} />
        </mesh>
      )}
      {wornParts.map((part) => {
        const { at, voxel } = SLOT_ANCHOR[part.slot];
        return part.voxels.map((v, i) => (
          <mesh
            key={`${part.id}-${i}`}
            position={[at[0] + v.x * voxel, at[1] + v.y * voxel + bob, at[2] + v.z * voxel]}
            castShadow
          >
            <boxGeometry args={[voxel, voxel, voxel]} />
            <Mat color={v.c} ghost={false} />
          </mesh>
        ));
      })}
      {p.isPlayer && !ghost && <BandageWrap />}
      {p.isPlayer && !ghost && <BandageBillboard />}
      {p.isPlayer && !ghost && <CraftingBillboard />}
      {p.isPlayer && !ghost && <GatheringBillboard />}
      {p.isPlayer && !ghost && <CorpseBillboard />}
      {p.isPlayer && !ghost && <MeleeSwingArc />}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[0.34, 0.46, 16]} />
          <meshBasicMaterial color={ghost ? "#d8d4cc" : "#c9a36a"} transparent opacity={0.8} />
        </mesh>
      )}
      {ghost && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.18, 0.28, 12]} />
          <meshBasicMaterial color="#ece6d8" transparent opacity={0.35} />
        </mesh>
      )}
    </group>
  );
}

export function People() {
  const people = useGame((s) => s.snap.people);
  const selected = useGame((s) => s.selectedId);
  const wear = useGame((s) => s.snap.player?.wear ?? {});
  return (
    <group>
      {people.map((p) => (
        <Figure key={p.id} p={p} selected={selected === p.id} wear={p.isPlayer ? wear : {}} />
      ))}
    </group>
  );
}
