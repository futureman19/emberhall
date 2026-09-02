import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { SECONDS_PER_HOUR } from "@/game/catalog";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { getCombatFx } from "@/game/player";
import { useGame } from "@/game/store";
import type { Creature, FaunaKind } from "@/game/types";

const COLOR: Record<FaunaKind, string> = {
  hare: "#c4a882",
  hart: "#8a6a42",
  wolf: "#6a6a68",
  wight: "#c9c3b6",
  brambleback_stag: "#4d7a4f",
  ironwood_boar: "#7c5a39",
  pine_lynx: "#4f4f5f",
  ember_fox: "#c45f2b",
  moss_badger: "#6f5d44",
  ridgeback_warg: "#6d5c4e",
  thornhide_doe: "#5f774c",
  mire_croaker: "#5d7045",
  reedback_stalker: "#2f3a4a",
  bog_toad: "#5d7a5c",
  saltback_tortoise: "#6d5a44",
  brine_hound: "#6f8aa2",
  dune_crawler: "#b07a3f",
  coal_salamander: "#4d4c46",
  orebeetle: "#6f5b3a",
  stonecrawl_spider: "#3f4c58",
  greybarrow_wightling: "#8a8b8f",
  barrow_hound: "#6a6559",
  ashen_banshee: "#ddd7dd",
  bonecrow: "#3f3f44",
  brine_troll: "#5b6456",
  stonefang_ogre: "#6f6654",
  orc_marauder: "#7d5f47",
};

const SIZE: Record<FaunaKind, number> = {
  hare: 0.35,
  hart: 0.7,
  wolf: 0.55,
  wight: 0.8,
  brambleback_stag: 0.78,
  ironwood_boar: 0.74,
  pine_lynx: 0.53,
  ember_fox: 0.48,
  moss_badger: 0.33,
  ridgeback_warg: 0.8,
  thornhide_doe: 0.44,
  mire_croaker: 0.45,
  reedback_stalker: 0.78,
  bog_toad: 0.38,
  saltback_tortoise: 0.9,
  brine_hound: 0.64,
  dune_crawler: 0.58,
  coal_salamander: 0.62,
  orebeetle: 0.52,
  stonecrawl_spider: 0.58,
  greybarrow_wightling: 0.72,
  barrow_hound: 0.66,
  ashen_banshee: 0.85,
  bonecrow: 0.55,
  brine_troll: 1.15,
  stonefang_ogre: 1.05,
  orc_marauder: 0.98,
};

function Body({ c }: { c: Creature }) {
  const s = SIZE[c.kind];
  const color = COLOR[c.kind];

  const isWolfBody = c.kind === "wolf" || c.kind === "ridgeback_warg" || c.kind === "brine_hound" || c.kind === "barrow_hound" || c.kind === "pine_lynx";
  const isBoar = c.kind === "ironwood_boar" || c.kind === "moss_badger" || c.kind === "mire_croaker";
  const isSpider = c.kind === "orebeetle" || c.kind === "stonecrawl_spider";
  const isCrawler = c.kind === "dune_crawler" || c.kind === "reedback_stalker" || c.kind === "bog_toad";
  const isTortoise = c.kind === "saltback_tortoise";
  const isBird = c.kind === "bonecrow";
  const isGhost = c.kind === "wight" || c.kind === "greybarrow_wightling" || c.kind === "ashen_banshee";

  if (c.kind === "hare") {
    return (
      <>
        <mesh position={[0, s * 0.42, 0]} castShadow>
          <boxGeometry args={[s * 0.9, s * 0.7, s * 1.15]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[0, s * 0.72, s * 0.42]} castShadow>
          <boxGeometry args={[s * 0.55, s * 0.45, s * 0.5]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[-s * 0.12, s * 1.08, s * 0.36]} castShadow>
          <boxGeometry args={[s * 0.12, s * 0.42, s * 0.08]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[s * 0.12, s * 1.08, s * 0.36]} castShadow>
          <boxGeometry args={[s * 0.12, s * 0.42, s * 0.08]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      </>
    );
  }

  if (c.kind === "hart") {
    return (
      <>
        <mesh position={[0, s * 0.5, 0]} castShadow>
          <boxGeometry args={[s * 0.7, s * 0.65, s * 1.35]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[0, s * 0.95, s * 0.55]} castShadow>
          <boxGeometry args={[s * 0.28, s * 0.55, s * 0.28]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[0, s * 1.2, s * 0.72]} castShadow>
          <boxGeometry args={[s * 0.38, s * 0.32, s * 0.42]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[-s * 0.12, s * 1.5, s * 0.62]} castShadow>
          <boxGeometry args={[s * 0.08, s * 0.38, s * 0.08]} />
          <meshStandardMaterial color="#d8c8a8" roughness={0.85} />
        </mesh>
        <mesh position={[s * 0.12, s * 1.5, s * 0.62]} castShadow>
          <boxGeometry args={[s * 0.08, s * 0.38, s * 0.08]} />
          <meshStandardMaterial color="#d8c8a8" roughness={0.85} />
        </mesh>
      </>
    );
  }

  if (isWolfBody) {
    return (
      <>
        <mesh position={[0, s * 0.48, 0]} castShadow>
          <boxGeometry args={[s * 0.75, s * 0.55, s * 1.35]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[0, s * 0.72, s * 0.62]} castShadow>
          <boxGeometry args={[s * 0.5, s * 0.42, s * 0.5]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[0, s * 0.55, -s * 0.8]} castShadow>
          <boxGeometry args={[s * 0.16, s * 0.16, s * 0.5]} />
          <meshStandardMaterial color="#4a4a48" roughness={0.9} />
        </mesh>
      </>
    );
  }

  if (isBoar) {
    return (
      <>
        <mesh position={[0, s * 0.5, 0]} castShadow>
          <boxGeometry args={[s * 0.8, s * 0.6, s * 1.25]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[0, s * 0.72, -s * 0.58]} castShadow>
          <boxGeometry args={[s * 0.55, s * 0.5, s * 0.45]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      </>
    );
  }

  if (isSpider) {
    return (
      <>
        <mesh position={[0, s * 0.35, 0]} castShadow>
          <boxGeometry args={[s * 0.62, s * 0.25, s * 0.62]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
        {[0, 1, 2, 3].map((i) => {
          const a = (Math.PI / 2) * i;
          return <mesh key={i} position={[Math.cos(a) * s * 0.42, s * 0.18, Math.sin(a) * s * 0.42]} rotation={[0, a, 0]} castShadow>
            <boxGeometry args={[s * 0.7, s * 0.08, s * 0.24]} />
            <meshStandardMaterial color={color} roughness={1} />
          </mesh>;
        })}
      </>
    );
  }

  if (isCrawler) {
    return (
      <>
        <mesh position={[0, s * 0.24, 0]} castShadow>
          <boxGeometry args={[s * 0.7, s * 0.24, s * 1.2]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[0, s * 0.4, 0]} castShadow>
          <boxGeometry args={[s * 0.45, s * 0.22, s * 0.45]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      </>
    );
  }

  if (isTortoise) {
    return (
      <>
        <mesh position={[0, s * 0.45, 0]} castShadow>
          <boxGeometry args={[s * 1.05, s * 0.55, s * 0.95]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[0, s * 0.82, 0]} castShadow>
          <boxGeometry args={[s * 0.35, s * 0.2, s * 0.25]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
      </>
    );
  }

  if (isBird) {
    return (
      <>
        <mesh position={[0, s * 0.5, 0]} castShadow>
          <boxGeometry args={[s * 0.42, s * 0.34, s * 0.62]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
        <mesh position={[-s * 0.34, s * 0.28, s * 0.1]} rotation={[0, 0, 0.6]} castShadow>
          <boxGeometry args={[s * 0.68, s * 0.06, s * 0.17]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
        <mesh position={[s * 0.34, s * 0.28, s * 0.1]} rotation={[0, 0, -0.6]} castShadow>
          <boxGeometry args={[s * 0.68, s * 0.06, s * 0.17]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      </>
    );
  }

  if (isGhost) {
    return (
      <>
        <mesh position={[0, 0.7, 0]} castShadow>
          <boxGeometry args={[0.32, 1.1, 0.22]} />
          <meshStandardMaterial color={color} roughness={0.7} transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, 1.35, 0]} castShadow>
          <boxGeometry args={[0.28, 0.28, 0.24]} />
          <meshStandardMaterial color="#ece6d8" roughness={0.6} />
        </mesh>
      </>
    );
  }

  return (
    <>
      <mesh position={[0, s * 0.5, 0]} castShadow>
        <boxGeometry args={[s * 0.62, s * 0.55, s * 1.05]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0, s * 0.76, s * 0.36]} castShadow>
        <boxGeometry args={[s * 0.44, s * 0.48, s * 0.44]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </>
  );
}

function Beast({ c }: { c: Creature }) {
  const dead = c.task === "dead";
  const color = COLOR[c.kind];
  const root = useRef<Group>(null);

  useFrame(() => {
    const group = root.current;
    if (!group) return;
    const fx = getCombatFx();
    const age = fx ? (getWorld().hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const reacting = Boolean(fx && fx.targetId === c.id && age >= 0 && age < 0.34);
    const pulse = reacting ? Math.sin((age / 0.34) * Math.PI) : 0;
    group.position.set(c.x, groundY(getWorld(), c.x, c.z) + pulse * 0.08, c.z);
    group.rotation.set(dead ? Math.PI / 2 : -pulse * (fx?.clean ? 0.28 : 0.13), 0, dead ? 0 : pulse * 0.2);
    group.scale.setScalar(1 + pulse * (fx?.clean ? 0.1 : 0.04));
  });

  return (
    <group ref={root} position={[c.x, groundY(getWorld(), c.x, c.z), c.z]} rotation={dead ? [Math.PI / 2, 0, 0] : [0, 0, 0]}>
      <Body c={c} />
      {c.ownerId && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[0.22, 0.3, 12]} />
          <meshBasicMaterial color="#c9a36a" transparent opacity={0.7} />
        </mesh>
      )}
      {c.kind === "wight" && (
        <mesh position={[0, 1.45, 0]}>
          <boxGeometry args={[0.08, 0.02, 0.08]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      )}
    </group>
  );
}

export function Fauna() {
  const fauna = useGame((s) => s.snap.fauna);
  return (
    <group>
      {fauna.map((c) => (
        <Beast key={c.id} c={c} />
      ))}
    </group>
  );
}
