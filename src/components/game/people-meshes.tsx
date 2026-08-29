import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Quaternion, type Group } from "three";
import { CLASS_META } from "@/game/catalog";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { workPitch } from "@/game/player";
import { useGame } from "@/game/store";
import type { ItemId, Person, WearSlot } from "@/game/types";

function groundAt(x: number, z: number) {
  return groundY(getWorld(), x, z);
}

const SKIN = "#c9c3b6";
const HAIR = "#3a322c";
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

function Mat({ color, ghost }: { color: string; ghost: boolean }) {
  if (ghost) {
    return <meshStandardMaterial color="#ece6d8" emissive="#c9c3b6" emissiveIntensity={0.55} transparent opacity={0.58} roughness={0.4} depthWrite={false} />;
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
    const live = Boolean(you && !you.ghost && !you.path.length && world.player.intent.kind === "cast");
    w.visible = live;
    if (!live) return;
    w.parent?.getWorldQuaternion(q);
    f.quaternion.copy(q).invert();
    const t = world.player.workT * 14 + dt;
    const s = 0.72 + Math.min(1, world.player.workT / 0.28) * 0.45 + Math.sin(t) * 0.12 + Math.sin(t * 2.4) * 0.08;
    f.scale.setScalar(s);
    f.rotation.y += dt * 5;
  });
  return (
    <group ref={wrap} position={[0, -0.44, 0.02]} visible={false}>
      <group ref={flame}>
        <mesh position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.07, 8, 6]} />
          <meshBasicMaterial color="#e8f2ff" transparent opacity={0.95} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <coneGeometry args={[0.06, 0.22, 6]} />
          <meshBasicMaterial color="#4a7ec8" transparent opacity={0.78} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.15, 8, 6]} />
          <meshBasicMaterial color="#7aa8e8" transparent opacity={0.3} depthWrite={false} toneMapped={false} />
        </mesh>
        <pointLight color="#8eb8ff" intensity={1.7} distance={2.6} />
      </group>
    </group>
  );
}

function Figure({ p, selected, wear }: { p: Person; selected: boolean; wear: Partial<Record<WearSlot, ItemId>> }) {
  const ghost = Boolean(p.ghost);
  const intent = useGame((s) => s.snap.player.intent);
  const working = p.isPlayer && !ghost && !p.path.length && (intent.kind === "chop" || intent.kind === "mine");
  const bob = Math.sin(p.bob) * (ghost ? 0.08 : 0.04);
  const walkSwing = p.path.length ? Math.sin(p.bob) * 0.35 : 0;
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  useFrame(() => {
    if (!p.isPlayer) return;
    const w = getWorld();
    const you = w.people.find((x) => x.isPlayer);
    const it = w.player.intent;
    const idle = Boolean(you && !you.ghost && !you.path.length);
    const chopping = idle && (it.kind === "chop" || it.kind === "mine");
    const casting = idle && it.kind === "cast";
    if (left.current) {
      if (casting) {
        const u = Math.min(1, w.player.workT / 0.26);
        const e = u * u * (3 - 2 * u);
        left.current.rotation.set(walkSwing * (1 - e) + 1.1 * e, 0.28 * e, 0.12 * (1 - e) + 1.08 * e);
      } else {
        left.current.rotation.set(walkSwing, 0, 0.12);
      }
    }
    if (right.current) {
      if (chopping) {
        const pitch = workPitch(w.player.workT);
        right.current.rotation.set(pitch, 0.18, -0.22);
      } else if (casting) {
        const u = Math.min(1, w.player.workT / 0.26);
        const e = u * u * (3 - 2 * u);
        right.current.rotation.set(-walkSwing * (1 - e) + 1.1 * e, -0.28 * e, -0.12 * (1 - e) - 1.08 * e);
      } else {
        right.current.rotation.set(-walkSwing, 0, -0.12);
      }
    }
  });
  const chest = (p.isPlayer && wear.chest && WEAR_HEX[wear.chest]) || (p.isPlayer ? "#a85a42" : CLASS_META[p.cls].color);
  const legs = (p.isPlayer && wear.legs && WEAR_HEX[wear.legs]) || "#3a342e";
  const feet = (p.isPlayer && wear.feet && WEAR_HEX[wear.feet]) || "#2e241c";
  const hands = (p.isPlayer && wear.hands && WEAR_HEX[wear.hands]) || SKIN;
  const hood = p.isPlayer
    ? wear.head
    : p.cls === "mage" || p.role === "healer"
      ? "hood"
      : p.cls === "warrior"
        ? "helm"
        : null;
  const hoodColor =
    (hood && WEAR_HEX[hood as ItemId]) || (p.role === "healer" ? "#ece6d8" : hood === "helm" ? "#9a9286" : "#6a3a32");
  const cloak = ghost || (p.isPlayer ? Boolean(wear.cloak) : p.cls === "mage" || p.role === "healer" || p.cls === "ranger");
  const cloakColor = ghost
    ? "#ece6d8"
    : (p.isPlayer && wear.cloak && WEAR_HEX[wear.cloak]) ||
      (p.role === "healer" ? "#ece6d8" : p.cls === "ranger" ? "#6a7a48" : "#a85a42");
  const hover = ghost ? 0.32 : 0;

  return (
    <group position={[p.x, groundAt(p.x, p.z) + hover, p.z]} rotation={[0, p.facing, 0]}>
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
        {working && intent.kind === "chop" && <Hatchet ghost={ghost} />}
        {working && intent.kind === "mine" && <Pick ghost={ghost} />}
        {p.isPlayer && !ghost && <PalmFlame />}
      </group>
      <mesh position={[0, 0.98 + bob, 0]} castShadow={!ghost}>
        <boxGeometry args={[0.28, 0.28, 0.26]} />
        <Mat color={SKIN} ghost={ghost} />
      </mesh>
      {!hood && (
        <mesh position={[0, 1.14 + bob, 0]} castShadow={!ghost}>
          <boxGeometry args={[0.3, 0.08, 0.28]} />
          <Mat color={HAIR} ghost={ghost} />
        </mesh>
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
