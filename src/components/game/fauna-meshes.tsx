import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useRef } from "react";
import type { Group } from "three";
import { SECONDS_PER_HOUR } from "@/game/catalog";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { getCombatFx, getTamingFx } from "@/game/player";
import { TAMING_DURATION, tamingPulse } from "@/game/taming-animation";
import { COMPANION_DURATION, companionLabel, companionPose, getCompanionFx } from "@/game/companion-animation";
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

  const isWolfBody =
    c.kind === "wolf" ||
    c.kind === "ridgeback_warg" ||
    c.kind === "brine_hound" ||
    c.kind === "barrow_hound" ||
    c.kind === "pine_lynx";
  const isBoar =
    c.kind === "ironwood_boar" || c.kind === "moss_badger" || c.kind === "mire_croaker";
  const isSpider = c.kind === "orebeetle" || c.kind === "stonecrawl_spider";
  const isCrawler =
    c.kind === "dune_crawler" || c.kind === "reedback_stalker" || c.kind === "bog_toad";
  const isTortoise = c.kind === "saltback_tortoise";
  const isBird = c.kind === "bonecrow";
  const isGhost =
    c.kind === "wight" || c.kind === "greybarrow_wightling" || c.kind === "ashen_banshee";

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
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * s * 0.42, s * 0.18, Math.sin(a) * s * 0.42]}
              rotation={[0, a, 0]}
              castShadow
            >
              <boxGeometry args={[s * 0.7, s * 0.08, s * 0.24]} />
              <meshStandardMaterial color={color} roughness={1} />
            </mesh>
          );
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
    const world = getWorld();
    const fx = getCombatFx();
    const age = fx ? (world.hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const reacting = Boolean(fx && fx.targetId === c.id && age >= 0 && age < 0.34);
    const pulse = reacting ? Math.sin((age / 0.34) * Math.PI) : 0;
    const taming = world.player.intent.kind === "tame" && world.player.intent.targetId === c.id;
    const appeal = taming ? tamingPulse(world.player.workT) : 0;
    const result = getTamingFx();
    const resultAge = result ? (world.hour - result.at) * SECONDS_PER_HOUR : Infinity;
    const resultLive = Boolean(
      result && result.targetId === c.id && resultAge >= 0 && resultAge < 0.72,
    );
    const resultPulse = resultLive ? Math.sin((resultAge / 0.72) * Math.PI) : 0;
    const success = Boolean(resultLive && result?.success);
    const refusal = Boolean(resultLive && !result?.success);
    const companion = getCompanionFx(world);
    const companionAge = companion ? (world.hour - companion.at) * SECONDS_PER_HOUR : Infinity;
    const companionLive = Boolean(companion && companion.targetId === c.id && companionAge >= 0 && companionAge < COMPANION_DURATION);
    const companionMotion = companionLive && companion ? companionPose(companion.kind, companionAge) : { hop: 0, bow: 0, turn: 0, stretch: 0 };
    group.position.set(
      c.x,
      groundY(world, c.x, c.z) + pulse * 0.08 + appeal * 0.06 + (success ? resultPulse * 0.14 : 0) + companionMotion.hop,
      c.z,
    );
    group.rotation.set(
      dead ? Math.PI / 2 : -pulse * (fx?.clean ? 0.28 : 0.13) + (refusal ? resultPulse * -0.34 : 0) + companionMotion.bow,
      (taming ? Math.sin(world.player.workT * 20) * 0.2 : 0) + companionMotion.turn,
      dead ? 0 : pulse * 0.2 + appeal * 0.08 + (refusal ? resultPulse * 0.26 : 0),
    );
    group.scale.setScalar(
      1 +
        pulse * (fx?.clean ? 0.1 : 0.04) +
        (success ? resultPulse * 0.12 : 0) -
        (refusal ? resultPulse * 0.06 : 0) + companionMotion.stretch,
    );
  });

  return (
    <group
      ref={root}
      position={[c.x, groundY(getWorld(), c.x, c.z), c.z]}
      rotation={dead ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
    >
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
      <TamingBillboard c={c} />
      <CompanionBillboard c={c} />
    </group>
  );
}

function TamingBillboard({ c }: { c: Creature }) {
  const label = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const element = label.current;
    if (!element) return;
    const world = getWorld();
    const attempting =
      world.player.intent.kind === "tame" &&
      world.player.intent.targetId === c.id &&
      world.player.workT < TAMING_DURATION;
    const result = getTamingFx();
    const resultAge = result ? (world.hour - result.at) * SECONDS_PER_HOUR : Infinity;
    const resultLive = Boolean(
      result && result.targetId === c.id && resultAge >= 0 && resultAge < 0.78,
    );
    const mode = attempting
      ? "Calming"
      : resultLive
        ? result!.success
          ? "Bonded"
          : "Refused"
        : null;
    element.style.display = mode ? "grid" : "none";
    if (!mode) return;
    element.textContent = mode;
    const success = mode === "Bonded";
    const failure = mode === "Refused";
    element.style.color = success ? "#fff8e7" : failure ? "#ece6d8" : "#ffd36a";
    element.style.borderColor = success
      ? "rgba(255, 211, 106, 0.9)"
      : failure
        ? "rgba(168, 90, 66, 0.9)"
        : "rgba(224, 181, 106, 0.75)";
    element.style.background = success
      ? "rgba(126, 88, 18, 0.92)"
      : failure
        ? "rgba(92, 38, 28, 0.94)"
        : "rgba(20, 18, 15, 0.88)";
    element.style.boxShadow = success
      ? "0 0 18px rgba(255, 211, 106, 0.85)"
      : failure
        ? "0 0 16px rgba(168, 90, 66, 0.8)"
        : "0 4px 16px rgba(0, 0, 0, 0.45)";
    element.style.transform = `scale(${0.94 + (attempting ? tamingPulse(world.player.workT) : Math.sin((resultAge / 0.78) * Math.PI)) * 0.12})`;
  });
  return (
    <Html position={[0, 2.8, 0]} center zIndexRange={[38, 0]} style={{ pointerEvents: "none" }}>
      <div
        ref={label}
        style={{
          display: "none",
          placeItems: "center",
          minWidth: 70,
          padding: "6px 9px",
          border: "1px solid rgba(224, 181, 106, 0.75)",
          borderRadius: 8,
          background: "rgba(20, 18, 15, 0.88)",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.45)",
          fontFamily: "serif",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          transformOrigin: "center",
        }}
      />
    </Html>
  );
}

function CompanionBillboard({ c }: { c: Creature }) {
  const label = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const element = label.current;
    if (!element) return;
    const world = getWorld();
    const fx = getCompanionFx(world);
    const age = fx ? (world.hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const visible = Boolean(fx && fx.targetId === c.id && age >= 0 && age < COMPANION_DURATION);
    element.style.display = visible ? "grid" : "none";
    if (!fx || !visible) return;
    element.textContent = fx.kind === "name" ? `NAMED ${fx.name.toUpperCase()}` : companionLabel(fx.kind).toUpperCase();
    element.style.borderColor = fx.kind === "release" ? "rgba(168, 90, 66, 0.92)" : fx.kind === "feed" ? "rgba(122, 170, 88, 0.92)" : "rgba(255, 211, 106, 0.9)";
    element.style.color = fx.kind === "release" ? "#f0c0aa" : "#fff8e7";
  });
  return (
    <Html position={[0, 3.8, 0]} center zIndexRange={[37, 0]} style={{ pointerEvents: "none" }}>
      <div ref={label} style={{ display: "none", placeItems: "center", minWidth: 78, padding: "6px 9px", border: "1px solid", borderRadius: 8, background: "rgba(20, 18, 15, 0.92)", boxShadow: "0 0 16px rgba(0, 0, 0, 0.55)", fontFamily: "serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", whiteSpace: "nowrap" }} />
    </Html>
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
