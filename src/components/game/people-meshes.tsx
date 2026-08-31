import { useFrame } from "@react-three/fiber";
import { memo, useMemo, useRef } from "react";
import { Quaternion, type Group } from "three";
import { CLASS_META } from "@/game/catalog";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { SLOT_ANCHOR, partsById } from "@/game/look/parts.ts";
import { resolveLook } from "@/game/look/resolve.ts";
import type { ResolvedLook } from "@/game/look/resolve.ts";
import { workPitch } from "@/game/player";
import { useGame } from "@/game/store";
import type { ItemId, Person, WearSlot } from "@/game/types";
import { sharedBlockGeometry, sharedBlockMaterial } from "./terrain-performance";

function groundAt(x: number, z: number) {
  return groundY(getWorld(), x, z);
}

const SharedBox = memo(
  function SharedBox({ args }: { args: readonly [number, number, number] }) {
    return <primitive object={sharedBlockGeometry(args[0], args[1], args[2])} attach="geometry" />;
  },
  (before, after) => before.args[0] === after.args[0] && before.args[1] === after.args[1] && before.args[2] === after.args[2],
);

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
        <SharedBox args={[0.3, 0.08, 0.28]} />
        <Mat color={c} ghost={ghost} />
      </mesh>
      {look.hairStyle === "shag" && (
        <>
          {[-0.17, 0.17].map((x) => (
            <mesh key={x} position={[x, 1.02, 0]} castShadow={!ghost}>
              <SharedBox args={[0.06, 0.2, 0.28]} />
              <Mat color={c} ghost={ghost} />
            </mesh>
          ))}
          <mesh position={[0, 1.02, 0.16]} castShadow={!ghost}>
            <SharedBox args={[0.3, 0.2, 0.06]} />
            <Mat color={c} ghost={ghost} />
          </mesh>
        </>
      )}
      {look.hairStyle === "tail" && (
        <mesh position={[0, 0.96, 0.18]} castShadow={!ghost}>
          <SharedBox args={[0.12, 0.34, 0.08]} />
          <Mat color={c} ghost={ghost} />
        </mesh>
      )}
      {look.hairStyle === "long" && (
        <mesh position={[0, 0.94, 0.17]} castShadow={!ghost}>
          <SharedBox args={[0.3, 0.4, 0.08]} />
          <Mat color={c} ghost={ghost} />
        </mesh>
      )}
    </group>
  );
}

const Mat = memo(function Mat({ color, ghost }: { color: string; ghost: boolean }) {
  const material = ghost
    ? sharedBlockMaterial({
        color: "#ece6d8",
        roughness: 0.4,
        metalness: 0,
        opacity: 0.58,
        kind: "standard",
        emissive: "#c9c3b6",
        emissiveIntensity: 0.55,
      })
    : sharedBlockMaterial({ color, roughness: 0.82, metalness: 0, opacity: 1, kind: "standard" });
  return <primitive object={material} attach="material" />;
});

function Hatchet({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.02, -0.44, 0.04]} rotation={[0.15, 0, 0.35]}>
      <mesh position={[0, 0.16, 0]} castShadow={!ghost}>
        <SharedBox args={[0.045, 0.42, 0.045]} />
        <Mat color="#5a3e28" ghost={ghost} />
      </mesh>
      <mesh position={[0.08, 0.36, 0]} castShadow={!ghost}>
        <SharedBox args={[0.2, 0.1, 0.07]} />
        <meshStandardMaterial color="#8a8680" metalness={0.45} roughness={0.4} />
      </mesh>
    </group>
  );
}

function Knife({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.02, -0.42, 0.04]} rotation={[0.2, 0, 0.2]}>
      <mesh position={[0, 0.08, 0]} castShadow={!ghost}>
        <SharedBox args={[0.04, 0.16, 0.04]} />
        <Mat color="#5a3e28" ghost={ghost} />
      </mesh>
      <mesh position={[0, 0.24, 0]} castShadow={!ghost}>
        <SharedBox args={[0.05, 0.22, 0.02]} />
        <meshStandardMaterial color="#9a9286" metalness={0.55} roughness={0.32} />
      </mesh>
    </group>
  );
}

function Sword({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.02, -0.44, 0.04]} rotation={[0.12, 0, 0.28]}>
      <mesh position={[0, 0.1, 0]} castShadow={!ghost}>
        <SharedBox args={[0.045, 0.22, 0.045]} />
        <Mat color="#5a3e28" ghost={ghost} />
      </mesh>
      <mesh position={[0, 0.22, 0]} castShadow={!ghost}>
        <SharedBox args={[0.16, 0.04, 0.04]} />
        <meshStandardMaterial color="#8a8680" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.44, 0]} castShadow={!ghost}>
        <SharedBox args={[0.055, 0.46, 0.02]} />
        <meshStandardMaterial color="#c9c3b6" metalness={0.65} roughness={0.28} />
      </mesh>
    </group>
  );
}

function Club({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.02, -0.44, 0.04]} rotation={[0.15, 0, 0.3]}>
      <mesh position={[0, 0.22, 0]} castShadow={!ghost}>
        <SharedBox args={[0.055, 0.5, 0.055]} />
        <Mat color="#5a3e28" ghost={ghost} />
      </mesh>
      <mesh position={[0, 0.48, 0]} castShadow={!ghost}>
        <SharedBox args={[0.12, 0.16, 0.12]} />
        <Mat color="#6a4a32" ghost={ghost} />
      </mesh>
    </group>
  );
}

function Mace({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.02, -0.44, 0.04]} rotation={[0.15, 0, 0.3]}>
      <mesh position={[0, 0.2, 0]} castShadow={!ghost}>
        <SharedBox args={[0.045, 0.42, 0.045]} />
        <Mat color="#5a3e28" ghost={ghost} />
      </mesh>
      <mesh position={[0, 0.46, 0]} castShadow={!ghost}>
        <SharedBox args={[0.16, 0.16, 0.16]} />
        <meshStandardMaterial color="#8a8680" metalness={0.5} roughness={0.38} />
      </mesh>
    </group>
  );
}

function Staff({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.02, -0.5, 0.04]} rotation={[0.08, 0, 0.22]}>
      <mesh position={[0, 0.38, 0]} castShadow={!ghost}>
        <SharedBox args={[0.04, 0.9, 0.04]} />
        <Mat color="#5a3e28" ghost={ghost} />
      </mesh>
      <mesh position={[0, 0.86, 0]} castShadow={!ghost}>
        <SharedBox args={[0.1, 0.1, 0.1]} />
        <meshStandardMaterial color="#c9a36a" roughness={0.45} />
      </mesh>
    </group>
  );
}

function Bow({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.04, -0.4, 0.02]} rotation={[0.1, 0.4, 0.15]}>
      <mesh position={[0, 0.28, 0]} castShadow={!ghost}>
        <SharedBox args={[0.04, 0.62, 0.04]} />
        <Mat color="#6a4a32" ghost={ghost} />
      </mesh>
      <mesh position={[0.08, 0.28, 0]} castShadow={!ghost}>
        <SharedBox args={[0.02, 0.56, 0.02]} />
        <meshStandardMaterial color="#ece6d8" roughness={0.6} />
      </mesh>
    </group>
  );
}

function Torch({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.02, -0.44, 0.04]} rotation={[0.18, 0, 0.25]}>
      <mesh position={[0, 0.18, 0]} castShadow={!ghost}>
        <SharedBox args={[0.045, 0.36, 0.045]} />
        <Mat color="#5a3e28" ghost={ghost} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <SharedBox args={[0.08, 0.1, 0.08]} />
        <meshStandardMaterial color="#a85a42" emissive="#a85a42" emissiveIntensity={ghost ? 0.2 : 0.8} />
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
        <SharedBox args={[0.28, 0.38, 0.06]} />
        <meshStandardMaterial color={iron ? "#8a8680" : "#6a4a32"} metalness={iron ? 0.5 : 0.05} roughness={iron ? 0.4 : 0.85} />
      </mesh>
      <mesh position={[0, 0.02, 0.04]}>
        <SharedBox args={[0.1, 0.1, 0.04]} />
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
        <SharedBox args={[0.04, 0.44, 0.04]} />
        <Mat color="#5a3e28" ghost={ghost} />
      </mesh>
      <mesh position={[0.1, 0.38, 0]} castShadow={!ghost}>
        <SharedBox args={[0.22, 0.05, 0.12]} />
        <meshStandardMaterial color="#8a8680" metalness={0.45} roughness={0.4} />
      </mesh>
    </group>
  );
}

function Pick({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.02, -0.44, 0.04]} rotation={[0.15, 0, 0.35]}>
      <mesh position={[0, 0.16, 0]} castShadow={!ghost}>
        <SharedBox args={[0.04, 0.44, 0.04]} />
        <Mat color="#5a3e28" ghost={ghost} />
      </mesh>
      <mesh position={[0.02, 0.38, 0]} castShadow={!ghost}>
        <SharedBox args={[0.28, 0.07, 0.06]} />
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
    const chopping = idle && (it.kind === "chop" || it.kind === "mine" || it.kind === "plant" || it.kind === "harvest" || it.kind === "till");
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
  const look = resolveLook(p.look);
  const wornParts = ghost ? [] : partsById(p.look?.parts);
  const chest = (p.isPlayer && wear.chest && WEAR_HEX[wear.chest]) || (p.isPlayer ? look.garb : CLASS_META[p.cls].color);
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
          <SharedBox args={[0.52, 0.72, 0.12]} />
          <Mat color={cloakColor} ghost={ghost} />
        </mesh>
      )}
      <mesh position={[-0.1, 0.22 + bob, 0]} castShadow={!ghost}>
        <SharedBox args={[0.14, 0.4, 0.16]} />
        <Mat color={legs} ghost={ghost} />
      </mesh>
      <mesh position={[0.1, 0.22 + bob, 0]} castShadow={!ghost}>
        <SharedBox args={[0.14, 0.4, 0.16]} />
        <Mat color={legs} ghost={ghost} />
      </mesh>
      <mesh position={[-0.1, 0.04 + bob, 0.02]} castShadow={!ghost}>
        <SharedBox args={[0.16, 0.08, 0.22]} />
        <Mat color={feet} ghost={ghost} />
      </mesh>
      <mesh position={[0.1, 0.04 + bob, 0.02]} castShadow={!ghost}>
        <SharedBox args={[0.16, 0.08, 0.22]} />
        <Mat color={feet} ghost={ghost} />
      </mesh>
      <mesh position={[0, 0.58 + bob, 0]} castShadow={!ghost}>
        <SharedBox args={[0.42, 0.5, 0.26]} />
        <Mat color={chest} ghost={ghost} />
      </mesh>
      <group ref={left} position={[-0.28, 0.62 + bob, 0]} rotation={[walkSwing, 0, 0.12]}>
        <mesh position={[0, -0.16, 0]} castShadow={!ghost}>
          <SharedBox args={[0.12, 0.42, 0.12]} />
          <Mat color={chest} ghost={ghost} />
        </mesh>
        <mesh position={[0, -0.38, 0]} castShadow={!ghost}>
          <SharedBox args={[0.12, 0.1, 0.12]} />
          <Mat color={hands} ghost={ghost} />
        </mesh>
        {p.isPlayer && !ghost && <PalmFlame />}
        {p.isPlayer && wear.off && <Shield id={wear.off} ghost={ghost} />}
      </group>
      <group ref={right} position={[0.28, 0.62 + bob, 0]} rotation={[-walkSwing, 0, -0.12]}>
        <mesh position={[0, -0.16, 0]} castShadow={!ghost}>
          <SharedBox args={[0.12, 0.42, 0.12]} />
          <Mat color={chest} ghost={ghost} />
        </mesh>
        <mesh position={[0, -0.38, 0]} castShadow={!ghost}>
          <SharedBox args={[0.12, 0.1, 0.12]} />
          <Mat color={hands} ghost={ghost} />
        </mesh>
        {p.isPlayer && wear.main && intent.kind !== "cast" && <Held id={wear.main} ghost={ghost} />}
        {p.isPlayer && !ghost && <PalmFlame />}
      </group>
      <mesh position={[0, 0.98 + bob, 0]} castShadow={!ghost}>
        <SharedBox args={[0.28, 0.28, 0.26]} />
        <Mat color={look.skin} ghost={ghost} />
      </mesh>
      {!hood && (
        <group position={[0, bob, 0]}>
          <HairMeshes look={look} ghost={ghost} />
        </group>
      )}
      {hood === "helm" || hood === "cap" ? (
        <mesh position={[0, 1.12 + bob, 0]} castShadow={!ghost}>
          <SharedBox args={[0.34, 0.16, 0.32]} />
          <Mat color={hoodColor} ghost={ghost} />
        </mesh>
      ) : hood ? (
        <mesh position={[0, 1.12 + bob, -0.02]} castShadow={!ghost}>
          <SharedBox args={[0.34, 0.2, 0.34]} />
          <Mat color={hoodColor} ghost={ghost} />
        </mesh>
      ) : null}
      {p.isPlayer && !ghost && (
        <mesh position={[0, 0.62 + bob, -0.14]} castShadow>
          <SharedBox args={[0.22, 0.18, 0.06]} />
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
            <SharedBox args={[voxel, voxel, voxel]} />
            <Mat color={v.c} ghost={false} />
          </mesh>
        ));
      })}
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
